import { shop } from '../core/meta';
import { store } from '../core/settings';
import { deepMissions } from './missions';
import { shells } from './shells';

/** A look drawn on top of the basic diver (see BootScene.makeDiver). */
export type Extra = 'spots' | 'stripes' | 'crown' | 'glow' | 'spikes' | 'lure' | 'cap';

/** Each diver's small advantage in the dive (see DIVER_PERK for the numbers). */
export type DiverPerk = 'steer' | 'kelp' | 'eelguard' | 'coins' | 'light' | 'blink' | 'ice';

/**
 * Divers. A couple cost coins and one is a mission-rank reward; most are paid for with rare Golden
 * Shells. Each has a small perk that suits one cave or play style. Ids are saved, so never rename
 * one: the first five were the original colour "suits".
 */
export interface Skin {
  id: string; name: string; bio: string;
  body: string; belly: string; fins: string; extra?: Extra;
  /** Price (0 = free, or unlocked by `rank` instead), in coins or, with `shells`, in Golden Shells. */
  price: number;
  shells?: boolean;
  /** Mission rank that unlocks this diver for free. */
  rank?: number;
  perk?: DiverPerk;
  /** The perk in a few words, for the Divers screen. */
  perkText: string;
}

export const SKINS: Skin[] = [
  { id: 'classic', name: 'Sunny',   bio: 'First in the water every morning.',  body: '#ffd23f', belly: '#f2a91e', fins: '#ff7a2f', price: 0, perkText: 'A steady all-rounder' },
  { id: 'coral',   name: 'Coral',   bio: 'Pink, quick and a little reckless.',  body: '#ff7aa8', belly: '#e9558a', fins: '#7a5cff', extra: 'spots', price: 500, perk: 'steer', perkText: 'Steers 12% sharper' },
  { id: 'kelp',    name: 'Kelp',    bio: 'Hides in the seaweed. Mostly naps.',  body: '#4fdc7a', belly: '#2fb35c', fins: '#ffd23f', extra: 'stripes', price: 2, shells: true, perk: 'kelp', perkText: 'Kelp barely slows them' },
  { id: 'puff',    name: 'Puff',    bio: 'Gets spiky when the eels show up.',   body: '#ffb03a', belly: '#ff8a1f', fins: '#ff5a7a', extra: 'spikes', price: 3, shells: true, perk: 'eelguard', perkText: 'Shrugs off the first eel zap of each dive' },
  { id: 'royal',   name: 'Royal',   bio: 'Only dives in style.',                body: '#9b6bff', belly: '#7a49e6', fins: '#ffc43d', extra: 'crown', price: 4, shells: true, perk: 'coins', perkText: '+10% coins from every dive' },
  { id: 'lumi',    name: 'Lumi',    bio: 'Brings their own light to the deep.', body: '#2b3f8f', belly: '#1d2c6b', fins: '#5fe8ff', extra: 'lure', price: 5, shells: true, perk: 'light', perkText: 'A bigger pool of light in the dark' },
  { id: 'ghost',   name: 'Ghost',   bio: 'Nobody has ever seen them surface.',  body: '#eef4ff', belly: '#c9d6ee', fins: '#5fd3ff', extra: 'glow', price: 8, shells: true, perk: 'blink', perkText: 'Stays untouchable longer after a hit' },
  { id: 'captain', name: 'Captain', bio: 'A thousand dives and counting.',      body: '#f4f7fb', belly: '#c5d0de', fins: '#2a4f9e', extra: 'cap', price: 0, rank: 10, perk: 'ice', perkText: 'Grips the ice and needs 10% less air' },
];

/** Perk strengths. */
export const DIVER_PERK = {
  steer: 1.12,      // steering push
  kelpSlow: 0.8,    // forward speed while tangled (normally 0.55)
  coins: 1.1,
  light: 1.3,       // headlamp pool size
  blink: 2.4,       // seconds untouchable after a hit (normally 1.6)
  iceGrip: 0.5,     // how much of the ice's slipperiness is taken away
  air: 0.9,         // oxygen drain
};

export const suits = shop('deep-dive', 'suit', SKINS);
export const skinIndex = (id: string) => Math.max(0, SKINS.findIndex(s => s.id === id));

/** Still waiting on a mission rank? */
export const rankLocked = (s: Skin, rank: number) => !!s.rank && rank < s.rank;

/** Wear a diver, buying it first (with coins or shells) if needed. */
export function getDiver(s: Skin): 'owned' | 'bought' | 'poor' {
  if (!s.shells) return suits.buy(s.id);
  if (suits.owns(s.id)) { suits.equip(s.id); return 'owned'; }
  if (!shells.spend(s.price)) return 'poor';
  suits.grant(s.id);
  suits.equip(s.id);
  return 'bought';
}

/** Can the player pay for this diver right now? */
export const canAfford = (s: Skin, coins: number) => (s.shells ? shells.count : coins) >= s.price;

/**
 * Puff and Lumi used to be free rank rewards (ranks 3 and 6); players who had already reached
 * those ranks keep them now that they cost shells. Runs once per save.
 */
export function migrateDivers() {
  if (store.get('diversV2', false)) return;
  const rank = deepMissions.rank;
  if (rank >= 3) suits.grant('puff');
  if (rank >= 6) suits.grant('lumi');
  store.set('diversV2', true);
}

/** Data URLs of each diver's first frame, filled in by BootScene for the menus. */
export const portraits: Record<string, string> = {};
