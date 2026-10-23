import { hashString, todayKey } from './rng';

/**
 * Arcade-wide progression shared by every game, stored on this device:
 *   - coins: one wallet across all games, spent in each game's shop
 *   - shop: owned / equipped cosmetics per game
 *   - missions: three active goals per game, each paying coins
 *   - daily: one seeded run per game per day, plus a play streak across days
 *
 * Everything goes through `persist` below so a backend (e.g. Firebase) can replace localStorage
 * later without changing the games.
 */

const ROOT = 'arcade:';

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
/** Called whenever coins, ownership, missions or the streak change. */
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

// ---------- Daily challenge and streak

export interface DailyInfo { key: string; seed: number; best: number; playedToday: boolean }
export interface DailyResult { firstToday: boolean; isBest: boolean; bonus: number; best: number }

/** Coins for the first daily run of the day, plus a little per day of streak. */
const DAILY_BONUS = 25;

export const daily = {
  info(game: string): DailyInfo {
    const key = todayKey();
    const rec = persist.get<{ key: string; best: number }>(`${game}:daily`, { key: '', best: 0 });
    return { key, seed: hashString(`${game}:${key}`), best: rec.key === key ? rec.best : 0, playedToday: rec.key === key };
  },
  record(game: string, score: number): DailyResult {
    const info = this.info(game);
    const firstToday = !info.playedToday;
    const best = Math.max(info.best, score);
    persist.set(`${game}:daily`, { key: info.key, best });
    const bonus = firstToday ? DAILY_BONUS + Math.min(10, streak.count) * 5 : 0;
    if (bonus) coins.add(bonus);
    return { firstToday, isBest: score > info.best, bonus, best };
  },
};

/** Consecutive days with at least one run in any game. */
export const streak = {
  get count() {
    const s = persist.get<{ last: string; count: number }>('streak', { last: '', count: 0 });
    const today = todayKey(), yesterday = todayKey(new Date(Date.now() - 864e5));
    return s.last === today || s.last === yesterday ? s.count : 0;
  },
  /** Call once per finished run. */
  touch() {
    const s = persist.get<{ last: string; count: number }>('streak', { last: '', count: 0 });
    const today = todayKey(), yesterday = todayKey(new Date(Date.now() - 864e5));
    if (s.last === today) return;
    persist.set('streak', { last: today, count: s.last === yesterday ? s.count + 1 : 1 });
    changed();
  },
};

/** "So close" line for the game-over card, or '' when the run wasn't near the best. */
export function soClose(score: number, best: number, unit = '') {
  if (best <= 0 || score >= best || score < best * 0.8) return '';
  const gap = Math.ceil(best - score);
  return `So close! Just ${gap.toLocaleString()}${unit} short of your best.`;
}
