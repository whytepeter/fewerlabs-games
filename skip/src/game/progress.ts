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

/** Characters (the stones you throw) in shop order. Ids match STONES in sim.ts and are saved. */
export const STONE_ITEMS: (ShopItem & { blurb: string; bio: string })[] = [
  { id: 'pebble', name: 'Pip', price: 0, blurb: 'All-rounder', bio: 'Small, grey and absolutely sure of itself.' },
  { id: 'flat', name: 'Zip', price: 200, blurb: 'Fast, tight timing', bio: 'Flat as a pancake, quick as a rumour.' },
  { id: 'heavy', name: 'Bruno', price: 350, blurb: 'Forgiving, slower', bio: 'Big, grumpy and very hard to stop.' },
  { id: 'bouncy', name: 'Boing', price: 500, blurb: 'Big hops, hoops', bio: 'Made of something springy. Nobody asks.' },
  { id: 'lucky', name: 'Clover', price: 300, blurb: 'Saves one streak', bio: 'Found in a field of four-leaf clovers.' },
];

/**
 * How each character looks, in the Golden Hour style: a smooth flat stone with no outline, a soft
 * shade underneath, a tiny dot face and one lakeside accessory. rx/ry: stone size. `null` colours
 * use the theme's stone colour.
 */
export interface StoneLook {
  body: string | null; shade: string | null; rx: number; ry: number;
  eyes: 'dot' | 'sleepy';
  mouth: 'smile' | 'o' | 'grin' | 'flat';
  /** Its one accessory. */
  extra: 'hat' | 'goggles' | 'moss' | 'lilypad' | 'ladybug';
}
export const STONE_LOOKS: Record<string, StoneLook> = {
  pebble: { body: null, shade: null, rx: 15, ry: 11, eyes: 'dot', mouth: 'smile', extra: 'hat' },
  flat: { body: '#9cc6ea', shade: '#79a6d1', rx: 17.5, ry: 8, eyes: 'dot', mouth: 'grin', extra: 'goggles' },
  heavy: { body: '#a99cc6', shade: '#8677ab', rx: 17, ry: 13.5, eyes: 'sleepy', mouth: 'flat', extra: 'moss' },
  bouncy: { body: '#f7b6cc', shade: '#e692b0', rx: 14, ry: 13, eyes: 'dot', mouth: 'o', extra: 'lilypad' },
  lucky: { body: '#a8e0b6', shade: '#82c896', rx: 15, ry: 11, eyes: 'dot', mouth: 'grin', extra: 'ladybug' },
};
