import { coins } from '../core/meta';
import { BOOSTERS, boosters, type BoosterId } from './boosters';
import { shells } from './shells';

/** What's inside a treasure chest. */
export type ChestPrize = { kind: 'coins'; n: number } | { kind: 'shell' } | { kind: 'booster'; id: BoosterId };

const SHELL_CHANCE = 0.06, BOOSTER_CHANCE = 0.14;

/**
 * Treasure chests are collected during a dive and opened on the game-over screen. The prizes are
 * rolled and paid out when the dive ends, so leaving without tapping a chest loses nothing.
 */
export function openChests(n: number): ChestPrize[] {
  return Array.from({ length: n }, (): ChestPrize => {
    const r = Math.random();
    if (r < SHELL_CHANCE) { shells.add(1); return { kind: 'shell' }; }
    if (r < SHELL_CHANCE + BOOSTER_CHANCE) {
      const id = BOOSTERS[(Math.random() * BOOSTERS.length) | 0].id;
      boosters.add(id);
      return { kind: 'booster', id };
    }
    // Chests are rare, so the coins are worth the detour: usually 30–90, now and then up to 150.
    const c = 30 + Math.round(Math.random() * Math.random() * 120);
    coins.add(c);
    return { kind: 'coins', n: c };
  });
}
