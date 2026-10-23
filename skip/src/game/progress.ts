import type { MissionDef, ShopItem } from '../core/meta';

// Skip's side of the arcade meta: coin payout, mission pool and the stone shop.
// No runtime imports, so the headless bot can use it too.

export const GAME_ID = 'skip';

/** Coins for one throw: distance/25 + Perfects/3 + 3 per hoop. A decent throw pays ~15–40. */
export function coinsForRun(metres: number, perfects: number, hoops: number) {
  const throwCoins = Math.floor(metres / 25);
  const perfectCoins = Math.floor(perfects / 3);
  const hoopCoins = hoops * 3;
  return { throwCoins, perfectCoins, hoopCoins, total: throwCoins + perfectCoins + hoopCoins };
}

/** Stats reported to missions at the end of a throw (keys match MissionDef.stat). */
export interface RunStats {
  distance: number; skips: number; perfects: number; bestStreak: number; glass: number;
  hoops: number; fever: number; pads: number; ducks: number; throws: number;
}

export const MISSION_POOL: MissionDef[] = [
  { id: 'dist', text: 'Skip {n} m in one throw', stat: 'distance', kind: 'run', targets: [300, 600, 1000, 1500], reward: 30 },
  { id: 'streak', text: 'Get a ×{n} Perfect streak', stat: 'bestStreak', kind: 'run', targets: [8, 15, 25, 40], reward: 30 },
  { id: 'hoops', text: 'Fly through {n} hoops', stat: 'hoops', kind: 'total', targets: [3, 10, 25, 50], reward: 40 },
  { id: 'glass', text: 'Collect {n} lake glass', stat: 'glass', kind: 'total', targets: [100, 300, 800, 2000], reward: 30 },
  { id: 'fever', text: 'Reach Fever {n} times', stat: 'fever', kind: 'total', targets: [2, 6, 15, 30], reward: 40 },
  { id: 'pads', text: 'Bounce off {n} lily pads in one throw', stat: 'pads', kind: 'run', targets: [2, 3, 5, 7], reward: 30 },
  { id: 'perfects', text: 'Land {n} Perfects', stat: 'perfects', kind: 'total', targets: [50, 150, 400, 1000], reward: 25 },
  { id: 'skips', text: 'Make {n} skips in one throw', stat: 'skips', kind: 'run', targets: [30, 50, 80, 120], reward: 25 },
  { id: 'ducks', text: 'Startle {n} ducks', stat: 'ducks', kind: 'total', targets: [10, 30, 80, 200], reward: 20 },
  { id: 'throws', text: 'Throw {n} stones', stat: 'throws', kind: 'total', targets: [5, 15, 40, 100], reward: 20 },
];

/** Stones in shop order. Ids match STONES in sim.ts. */
export const STONE_ITEMS: (ShopItem & { blurb: string })[] = [
  { id: 'pebble', name: 'Pebble', price: 0, blurb: 'All-rounder' },
  { id: 'flat', name: 'Flat', price: 200, blurb: 'Fast, tight timing' },
  { id: 'heavy', name: 'Heavy', price: 350, blurb: 'Forgiving, slower' },
  { id: 'bouncy', name: 'Bouncy', price: 500, blurb: 'Big hops, hoops' },
  { id: 'lucky', name: 'Lucky', price: 300, blurb: 'Saves one streak' },
];

/** How each stone looks: body / highlight colours and shape. `null` colours use the theme's stone. */
export interface StoneLook { body: string | null; hi: string | null; rx: number; ry: number; clover?: boolean; band?: string }
export const STONE_LOOKS: Record<string, StoneLook> = {
  pebble: { body: null, hi: null, rx: 13, ry: 7.4 },
  flat: { body: '#86b7d6', hi: '#dff1fb', rx: 14.5, ry: 5.4 },
  heavy: { body: '#6d6880', hi: '#b2adc6', rx: 13.5, ry: 8.8 },
  bouncy: { body: '#ff7aa8', hi: '#ffd0e0', rx: 12.5, ry: 8, band: '#ffd23f' },
  lucky: { body: '#5ccf7d', hi: '#c4f5d1', rx: 13, ry: 7.4, clover: true },
};
