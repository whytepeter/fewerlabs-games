import { coins, metaChanged } from '../core/meta';
import { store } from '../core/settings';

/** Permanent power-up upgrades bought in the shop (Jetpack Joyride style), five levels each. */
export type UpgradeId = 'shield' | 'magnet' | 'bubbles' | 'lifeline';

export interface Upgrade {
  id: UpgradeId; name: string; icon: string;
  /** What the upgrade does at a level (0 = not bought yet). */
  effect(level: number): string;
}

export const MAX_LEVEL = 5;
const COSTS = [300, 600, 1200, 2200, 3500];

export const UPGRADES: Upgrade[] = [
  { id: 'shield',   name: 'Tough shield',   icon: 'pk-shield', effect: l => `Shield lasts ${shieldTime(l)} s` },
  { id: 'magnet',   name: 'Strong magnet',  icon: 'pk-magnet', effect: l => `Magnet lasts ${magnetTime(l)} s` },
  { id: 'bubbles',  name: 'Big bubbles',    icon: 'air',       effect: l => `Each bubble refills ${bubbleAir(l)}% air` },
  { id: 'lifeline', name: 'Lucky lifeline', icon: 'pk-life',   effect: l => `${Math.round(lifelineChance(l) * 100)}% of power-ups are lifelines` },
];

export const shieldTime = (l: number) => 12 + l * 2;
export const magnetTime = (l: number) => 9 + l * 2;
export const bubbleAir = (l: number) => 11 + l * 2;
export const lifelineChance = (l: number) => 0.25 + l * 0.05;

export const upgrades = {
  level(id: UpgradeId) { return Math.min(MAX_LEVEL, store.get<Record<string, number>>('upgrades', {})[id] ?? 0); },
  /** Price of the next level, or null at max. */
  cost(id: UpgradeId) { const l = this.level(id); return l >= MAX_LEVEL ? null : COSTS[l]; },
  buy(id: UpgradeId): 'bought' | 'poor' | 'max' {
    const price = this.cost(id);
    if (price === null) return 'max';
    if (!coins.spend(price)) return 'poor';
    const all = store.get<Record<string, number>>('upgrades', {});
    all[id] = this.level(id) + 1;
    store.set('upgrades', all);
    metaChanged();
    return 'bought';
  },
};
