import { store } from '../core/settings';

/**
 * Remote tuning: the game's balance numbers, adjustable without a release. The defaults below are
 * the game as shipped; the Firestore document config/deep-dive can override any of them (edit it
 * in the Firebase console). The same values go to every player: this tunes the game, never one
 * person's prices.
 *
 * A fetched config is kept on the device and takes effect from the next dive (never mid-dive), so
 * an offline player keeps the last one they saw. Unknown keys, wrong types and out-of-range numbers
 * are ignored, so a typo in the console can't break the game. The Daily Dive always uses the
 * defaults for the keys that shape the course, so the day's trench stays the same for everyone.
 */
export const DEFAULTS = {
  /** × every rare treasure's chance per dive (1 = as in treasures.ts). */
  treasureOdds: 1,
  /** Chance a chest holds a Sea Heart, or a booster (otherwise coins). */
  chestHeart: 0.06,
  chestBooster: 0.14,
  /** Coin prices of the week's Sea Hearts in the shop, cheapest first. */
  heartPrices: [3000, 5000, 8000],
  /** × the spacing of power-ups, chests and floating Sea Hearts (above 1 = rarer). Course keys. */
  perkGap: 1,
  chestGap: 1,
  heartGap: 1,
  /** × the coins a dive pays (not missions). */
  coinRate: 1,
  /** Rewarded-ad saves allowed per dive (0 turns that ad off). */
  adSaves: 1,
  /** 1 offers the double-coins ad on game over, 0 doesn't. */
  adDoubleCoins: 1,
};
export type Tuning = typeof DEFAULTS;
type Key = keyof Tuning;

/** Allowed range of each number (each price, for heartPrices). */
const LIMITS: Record<Key, [number, number]> = {
  treasureOdds: [0, 5], chestHeart: [0, 0.5], chestBooster: [0, 0.5], heartPrices: [100, 100000],
  perkGap: [0.25, 4], chestGap: [0.25, 4], heartGap: [0.25, 4], coinRate: [0.25, 4], adSaves: [0, 3], adDoubleCoins: [0, 1],
};
/** Keys that change where things spawn: the Daily Dive keeps these at their defaults. */
const COURSE: Key[] = ['perkGap', 'chestGap', 'heartGap'];
const SAVED = 'tuning';

const fits = (k: Key, v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= LIMITS[k][0] && v <= LIMITS[k][1];

/** Keep only the valid overrides from a fetched config. */
export function clean(raw: unknown): Partial<Tuning> {
  const out: Record<string, unknown> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw)) {
    if (!(k in DEFAULTS)) continue;
    const key = k as Key;
    if (key === 'heartPrices') {
      if (Array.isArray(v) && v.length >= 1 && v.length <= 6 && v.every(p => fits(key, p))) out[k] = v.map(Math.round);
    } else if (fits(key, v)) out[k] = v;
  }
  return out as Partial<Tuning>;
}

let live: Tuning = { ...DEFAULTS, ...clean(store.get(SAVED, {})) };

export const tuning = {
  /** The values for a dive starting now. */
  dive(daily: boolean): Tuning {
    if (!daily) return { ...live };
    const t = { ...live };
    COURSE.forEach(k => { (t[k] as number) = DEFAULTS[k] as number; });
    return t;
  },
  /** The values outside a dive (shop prices, chest odds). */
  get now(): Tuning { return live; },
  /** A config fetched from the server: saved on this device, used from the next dive. */
  apply(raw: unknown) {
    const o = clean(raw);
    store.set(SAVED, o);
    live = { ...DEFAULTS, ...o };
  },
};
