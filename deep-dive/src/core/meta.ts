/**
 * Game progression, stored on this device:
 *   - coins: the wallet, spent in the game's shop
 *   - shop: owned / equipped cosmetics
 *   - missions: three active goals, each paying coins
 *
 * Everything goes through `persist` below so a backend (e.g. Firebase) can replace localStorage
 * later without changing the games.
 */

const ROOT = 'deep-dive:';

const persist = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(ROOT + key);
      return v === null ? fallback : (JSON.parse(v) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try { localStorage.setItem(ROOT + key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  },
};

type Listener = () => void;
const listeners: Listener[] = [];
const changed = () => listeners.forEach(fn => fn());
/** Called whenever coins, ownership or missions change. */
export function onMeta(fn: Listener) { listeners.push(fn); }

// ---------- Coins

export const coins = {
  get balance() { return persist.get('coins', 0); },
  add(n: number) {
    if (n <= 0) return;
    persist.set('coins', this.balance + Math.round(n));
    persist.set('coinsEarned', persist.get('coinsEarned', 0) + Math.round(n));
    changed();
  },
  /** Returns false (and spends nothing) if the balance is too low. */
  spend(n: number) {
    if (n > this.balance) return false;
    persist.set('coins', this.balance - n);
    changed();
    return true;
  },
};

// ---------- Shop

export interface ShopItem { id: string; name: string; price: number }

export function shop(game: string, slot: string, items: ShopItem[]) {
  const ownedKey = `${game}:owned:${slot}`, eqKey = `${game}:equipped:${slot}`;
  const owned = () => new Set<string>([...persist.get<string[]>(ownedKey, []), ...items.filter(i => i.price === 0).map(i => i.id)]);
  return {
    items,
    owns: (id: string) => owned().has(id),
    get equipped() {
      const id = persist.get<string>(eqKey, items[0].id);
      return owned().has(id) ? id : items[0].id;
    },
    equip(id: string) {
      if (!owned().has(id)) return false;
      persist.set(eqKey, id);
      changed();
      return true;
    },
    /** Buy (if affordable) and equip. Returns 'owned' | 'bought' | 'poor'. */
    buy(id: string): 'owned' | 'bought' | 'poor' {
      const item = items.find(i => i.id === id);
      if (!item) return 'poor';
      if (owned().has(id)) { this.equip(id); return 'owned'; }
      if (!coins.spend(item.price)) return 'poor';
      persist.set(ownedKey, [...owned(), id]);
      this.equip(id);
      return 'bought';
    },
  };
}

// ---------- Missions

/**
 * A mission template. `stat` is a number the game reports at the end of each run.
 *   kind 'run':   reach `target` in a single run (e.g. dive 500 m)
 *   kind 'total': add up across runs until `target` (e.g. collect 200 pearls in total)
 * `text` may contain {n} for the target.
 */
export interface MissionDef { id: string; text: string; stat: string; kind: 'run' | 'total'; targets: number[]; reward: number }
export interface Mission { id: string; text: string; stat: string; kind: 'run' | 'total'; target: number; reward: number; progress: number; tier: number }
export interface MissionResult { mission: Mission; done: boolean; gained: number }

export function missions(game: string, pool: MissionDef[]) {
  const key = `${game}:missions`, tierKey = `${game}:missionTiers`;
  const tiers = () => persist.get<Record<string, number>>(tierKey, {});

  const make = (def: MissionDef): Mission => {
    const tier = Math.min(def.targets.length - 1, tiers()[def.id] ?? 0);
    const target = def.targets[tier];
    return { id: def.id, text: def.text.replace('{n}', target.toLocaleString()), stat: def.stat, kind: def.kind, target, reward: Math.round(def.reward * (1 + tier * 0.5)), progress: 0, tier };
  };
  const load = (): Mission[] => {
    let list = persist.get<Mission[]>(key, []).filter(m => pool.some(d => d.id === m.id));
    // Top up to three, never two of the same template.
    const free = pool.filter(d => !list.some(m => m.id === d.id));
    while (list.length < 3 && free.length) list = [...list, make(free.splice((Math.random() * free.length) | 0, 1)[0])];
    persist.set(key, list);
    return list;
  };

  return {
    get active() { return load(); },
    /**
     * Report a finished run's stats. Completed missions pay their coins and are replaced by a
     * fresh one (the same template comes back harder later). Returns what happened to each.
     */
    report(stats: Record<string, number>): MissionResult[] {
      const list = load();
      const results: MissionResult[] = [];
      const next: Mission[] = [];
      for (const m of list) {
        const v = stats[m.stat] ?? 0;
        const before = m.progress;
        m.progress = m.kind === 'run' ? Math.max(m.progress, v) : m.progress + v;
        const done = m.progress >= m.target;
        results.push({ mission: { ...m }, done, gained: m.progress - before });
        if (done) {
          coins.add(m.reward);
          const t = tiers(); t[m.id] = (t[m.id] ?? 0) + 1; persist.set(tierKey, t);
        } else next.push(m);
      }
      persist.set(key, next);
      load(); // refill
      changed();
      return results;
    },
  };
}

/** "So close" line for the game-over card, or '' when the run wasn't near the best. */
export function soClose(score: number, best: number, unit = '') {
  if (best <= 0 || score >= best || score < best * 0.8) return '';
  const gap = Math.ceil(best - score);
  return `So close! Just ${gap.toLocaleString()}${unit} short of your best.`;
}
