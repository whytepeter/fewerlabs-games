import { coins } from '../core/meta';
import { shells } from './shells';

/** What's inside a treasure chest. */
export type ChestPrize = { kind: 'coins'; n: number } | { kind: 'shell' };

const SHELL_CHANCE = 0.12;

/**
 * Treasure chests are collected during a dive and opened on the game-over screen. The prizes are
 * rolled and paid out when the dive ends, so leaving without tapping a chest loses nothing.
 */
export function openChests(n: number): ChestPrize[] {
  return Array.from({ length: n }, (): ChestPrize => {
    if (Math.random() < SHELL_CHANCE) { shells.add(1); return { kind: 'shell' }; }
    const c = 15 + Math.round(Math.random() * Math.random() * 65); // usually 15–40, sometimes up to 80
    coins.add(c);
    return { kind: 'coins', n: c };
  });
}
