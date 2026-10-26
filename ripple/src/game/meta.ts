import { missions, shop, type MissionDef } from '../core/meta';
import { SKINS } from './skins';

/** Ripple's hooks into the meta progression (core/meta.ts): missions and the boat shop. */
export const GAME = 'ripple';

/**
 * Mission pool. `run` stats are per run, `total` add up across runs. Each template comes back
 * one tier harder after it's completed (reward grows +50% per tier, see core/meta).
 * Stats reported by Game.gameOver: score, docked, golden, barges, combo, wave, freezes, hearts, perfectWaves.
 */
export const MISSION_POOL: MissionDef[] = [
  { id: 'dock-run', text: 'Dock {n} boats in one run', stat: 'docked', kind: 'run', targets: [8, 15, 25], reward: 20 },
  { id: 'dock-total', text: 'Dock {n} boats in total', stat: 'docked', kind: 'total', targets: [40, 120, 300], reward: 40 },
  { id: 'barges', text: 'Dock {n} barges', stat: 'barges', kind: 'total', targets: [2, 6, 15], reward: 30 },
  { id: 'gold', text: 'Dock {n} golden boats', stat: 'golden', kind: 'total', targets: [3, 10, 25], reward: 30 },
  { id: 'wave', text: 'Reach wave {n}', stat: 'wave', kind: 'run', targets: [3, 5, 8], reward: 25 },
  { id: 'combo', text: 'Get a x{n} combo', stat: 'combo', kind: 'run', targets: [3, 4, 5], reward: 25 },
  { id: 'perfect', text: 'Finish {n} waves without losing a boat', stat: 'perfectWaves', kind: 'run', targets: [2, 3, 5], reward: 30 },
  { id: 'score', text: 'Score {n} points in one run', stat: 'score', kind: 'run', targets: [15, 30, 50], reward: 30 },
  { id: 'freeze', text: 'Pop {n} freeze bubbles', stat: 'freezes', kind: 'total', targets: [2, 6, 15], reward: 20 },
  { id: 'hearts', text: 'Catch {n} heart bubbles', stat: 'hearts', kind: 'total', targets: [1, 4, 10], reward: 25 },
];

export const rippleMissions = missions(GAME, MISSION_POOL);
export const boatShop = shop(GAME, 'boat', SKINS);


/** Coins for a finished run: 2 per boat home, +3 per golden boat, +5 per perfect wave. */
export function runCoins(s: { docked: number; golden: number; perfectWaves: number }) {
  return s.docked * 2 + s.golden * 3 + s.perfectWaves * 5;
}
