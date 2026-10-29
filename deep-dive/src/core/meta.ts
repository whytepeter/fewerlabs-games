/**
 * Game progression, stored on this device:
 *   - coins: the wallet, spent in the game's shop
 *   - shop: owned / equipped cosmetics
 *   - missions: three active goals, each paying coins
 *
 * Everything goes through the same `store` as the rest of the game, so core/cloud.ts can back it
 * up to Firebase without changing the games.
 */
import { store as persist } from './settings';

type Listener = () => void;
const listeners: Listener[] = [];
const changed = () => listeners.forEach(fn => fn());
/** Tell every listener the saved progress changed (e.g. after a cloud restore). */
export const metaChanged = changed;
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
    /** Own an item without paying coins (it was paid for some other way). */
    grant(id: string) {
      if (owned().has(id)) return;
      persist.set(ownedKey, [...owned(), id]);
      changed();
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
export interface Mission { id: string; text: string; stat: string; kind: 'run' | 'total'; target: number; reward: number; progress: number; tier: number; done?: boolean }
export interface MissionResult { mission: Mission; done: boolean; gained: number }
export interface RankUp { rank: number; reward: number }

/** Each rank adds this much to the coin bonus, up to MAX_BONUS. */
const RANK_BONUS = 0.1, MAX_BONUS = 3;
export const SKIP_COST = 50;

/**
 * Missions come in sets of three (as in Jetpack Joyride). Finished ones stay ticked until the
 * whole set is done; then the player ranks up, earns a bonus and gets a fresh, harder set.
 * Every rank raises the coin bonus for good.
 */
export function missions(game: string, pool: MissionDef[]) {
  const key = `${game}:missions`, tierKey = `${game}:missionTiers`, rankKey = `${game}:rank`;
  const tiers = () => persist.get<Record<string, number>>(tierKey, {});

  const make = (def: MissionDef): Mission => {
    const tier = Math.min(def.targets.length - 1, tiers()[def.id] ?? 0);
    const target = def.targets[tier];
    return { id: def.id, text: def.text.replace('{n}', target.toLocaleString()).replace('{s}', target === 1 ? '' : 's'), stat: def.stat, kind: def.kind, target, reward: Math.round(def.reward * (1 + tier * 0.5)), progress: 0, tier };
  };
  const load = (): Mission[] => {
    let list = persist.get<Mission[]>(key, []).filter(m => pool.some(d => d.id === m.id));
    // Top up to three, never two of the same template.
    const free = pool.filter(d => !list.some(m => m.id === d.id));
    while (list.length < 3 && free.length) list = [...list, make(free.splice((Math.random() * free.length) | 0, 1)[0])];
    persist.set(key, list);
    return list;
  };
  const rankReward = (rank: number) => 50 + rank * 25;

  return {
    get active() { return load(); },
    /** Missions ranks completed so far (starts at 1). */
    get rank() { return persist.get(rankKey, 1); },
    /** Coin multiplier earned by rank: x1.1 at rank 1, x2 at rank 10, capped at x3. */
    get bonus() { return Math.min(MAX_BONUS, 1 + this.rank * RANK_BONUS); },
    /** Coins paid for finishing the current set. */
    get rankReward() { return rankReward(this.rank + 1); },

    /**
     * Report a finished run's stats. Completed missions pay their coins and stay ticked; when the
     * whole set is done the player ranks up. Returns what happened to each, and any rank-up.
     */
    report(stats: Record<string, number>): { results: MissionResult[]; rankUp: RankUp | null } {
      const list = load();
      const results: MissionResult[] = [];
      for (const m of list) {
        if (m.done) { results.push({ mission: { ...m }, done: true, gained: 0 }); continue; }
        const v = stats[m.stat] ?? 0;
        const before = m.progress;
        m.progress = m.kind === 'run' ? Math.max(m.progress, v) : m.progress + v;
        if (m.progress >= m.target) {
          m.done = true;
          coins.add(m.reward);
          const t = tiers(); t[m.id] = (t[m.id] ?? 0) + 1; persist.set(tierKey, t);
        }
        // Only missions finished in this run count as "done" on the card; older ticks show as ticked.
        results.push({ mission: { ...m }, done: !!m.done, gained: m.progress - before });
      }
      let rankUp: RankUp | null = null;
      if (list.every(m => m.done)) {
        const rank = this.rank + 1, reward = rankReward(rank);
        persist.set(rankKey, rank);
        coins.add(reward);
        persist.set(key, []);
        rankUp = { rank, reward };
      } else persist.set(key, list);
      load(); // refill
      changed();
      return { results, rankUp };
    },

    /** Swap an unfinished mission for a new one, for SKIP_COST coins. */
    skip(id: string) {
      const list = load(), i = list.findIndex(m => m.id === id && !m.done);
      const free = pool.filter(d => !list.some(m => m.id === d.id));
      if (i < 0 || !free.length || !coins.spend(SKIP_COST)) return false;
      list[i] = make(free[(Math.random() * free.length) | 0]);
      persist.set(key, list);
      changed();
      return true;
    },
  };
}

/** "So close" line for the game-over card, or '' when the run wasn't near the best. */
export function soClose(score: number, best: number, unit = '') {
  if (best <= 0 || score >= best || score < best * 0.8) return '';
  const gap = Math.ceil(best - score);
  return `So close! Just ${gap.toLocaleString()}${unit} short of your best.`;
}
