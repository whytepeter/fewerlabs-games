import { coins } from '../core/meta';
import { shells } from './shells';

/** What's inside a treasure chest. */
export type ChestPrize = { kind: 'coins'; n: number } | { kind: 'shell' };

const SHELL_CHANCE = 0.06;

/**
 * Treasure chests are collected during a dive and opened on the game-over screen. The prizes are
 * rolled and paid out when the dive ends, so leaving without tapping a chest loses nothing.
 */
export function openChests(n: number): ChestPrize[] {
  return Array.from({ length: n }, (): ChestPrize => {
    if (Math.random() < SHELL_CHANCE) { shells.add(1); return { kind: 'shell' }; }
    // Chests are rare, so the coins are worth the detour: usually 30–90, now and then up to 150.
    const c = 30 + Math.round(Math.random() * Math.random() * 120);
    coins.add(c);
    return { kind: 'coins', n: c };
  });
}
