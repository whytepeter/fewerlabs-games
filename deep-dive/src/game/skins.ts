import { shop } from '../core/meta';
import { store } from '../core/settings';
import { lifetime } from './lifetime';
import { deepMissions } from './missions';
import { shells } from './shells';
import type { SpecialId } from './specials';

/** A look drawn on top of the basic diver (see BootScene.makeDiver). */
export type Extra = 'spots' | 'stripes' | 'crown' | 'glow' | 'spikes' | 'lure' | 'cap';

/**
 * Characters (as in Subway Surfers): each has its own body, art and special move, and wears one of
 * its outfits (the SKINS below). Owning a character means owning its base outfit. Ids are saved.
 */
export type CharId = 'brass' | 'scuba' | 'otter' | 'pod';

export interface Character { id: CharId; name: string; bio: string; special: SpecialId; /** Its first outfit; buying that unlocks the character. */ base: string }

export const CHARACTERS: Character[] = [
  { id: 'brass', name: 'Little Brass', bio: 'Grew up in a helmet two sizes too big.',      special: 'wind',  base: 'classic' },
  { id: 'scuba', name: 'Scuba Kid',    bio: 'Mask on, fins on, gone before you blink.',     special: 'dash',  base: 'scuba' },
  { id: 'otter', name: 'Otter',        bio: 'Holds hands with the kelp. Hoards pearls.',    special: 'bloom', base: 'otter' },
  { id: 'pod',   name: 'Pod',          bio: 'A tiny sub with a big lamp and no fear.',      special: 'flash', base: 'pod' },
];

export const charOf = (s: Skin) => CHARACTERS.find(c => c.id === (s.char ?? 'brass'))!;
export const outfitsOf = (c: CharId) => SKINS.filter(s => (s.char ?? 'brass') === c);
export const charOwned = (c: Character) => suits.owns(c.base);

/** Each diver's small advantage in the dive (see DIVER_PERK for the numbers). */
export type DiverPerk = 'steer' | 'kelp' | 'eelguard' | 'coins' | 'light' | 'blink' | 'ice';

/**
 * Divers, each with its own way in: some cost coins, some Sea Hearts, one is a mission-rank reward,
 * and some are earned by playing (a lifetime goal, or a login streak), with a Sea Heart price to
 * skip the goal. Each has a small perk that suits one cave or play style. Ids are saved, so never
 * rename one: the first five were the original colour "suits".
 */
export interface Skin {
  id: string; name: string; bio: string;
  /** Whose outfit this is (default: Little Brass, who wore the original eight). */
  char?: CharId;
  /** Main colour, its shade, and the accent (fins, the otter's pack, the pod's stripe). */
  body: string; belly: string; fins: string; extra?: Extra;
  /** Little Brass's helmet (default brass); the Scuba Kid's skin, hair and mask; the Otter's muzzle. */
  metal?: 'brass' | 'silver' | 'copper';
  tone?: string; hair?: string; mask?: string; cream?: string;
  /** Price (0 = free, or unlocked by `rank` instead), in coins or, with `shells`, in Sea Hearts. */
  price: number;
  shells?: boolean;
  /** Mission rank that unlocks this diver for free. */
  rank?: number;
  /** Earned by reaching a lifetime goal (see lifetime.ts); `price` in Sea Hearts skips it. */
  earn?: { stat: string; n: number; text: string };
  perk?: DiverPerk;
  /** The perk in a few words, for the Divers screen. */
  perkText: string;
}

export const SKINS: Skin[] = [
  { id: 'classic', name: 'Sunny',   bio: 'First in the water every morning.',  body: '#ffd23f', belly: '#f2a91e', fins: '#ff7a2f', metal: 'silver', price: 0, perkText: 'A steady all-rounder' },
  { id: 'coral',   name: 'Coral',   bio: 'Pink, quick and a little reckless.',  body: '#ff7aa8', belly: '#e9558a', fins: '#7a5cff', extra: 'spots', price: 1000, perk: 'steer', perkText: 'Steers 12% sharper' },
  { id: 'kelp',    name: 'Kelp',    bio: 'Hides in the seaweed. Mostly naps.',  body: '#4fdc7a', belly: '#2fb35c', fins: '#ffd23f', extra: 'stripes', metal: 'copper', price: 3000, perk: 'kelp', perkText: 'Kelp barely slows them' },
  { id: 'puff',    name: 'Puff',    bio: 'Gets spiky when the eels show up.',   body: '#ffb03a', belly: '#ff8a1f', fins: '#ff5a7a', extra: 'spikes', metal: 'silver', price: 3, shells: true, earn: { stat: 'eels', n: 50, text: 'Slip past 50 electric eels' }, perk: 'eelguard', perkText: 'Shrugs off the first eel zap of each dive' },
  { id: 'royal',   name: 'Royal',   bio: 'Only dives in style.',                body: '#9b6bff', belly: '#7a49e6', fins: '#ffc43d', extra: 'crown', price: 4, shells: true, earn: { stat: 'streak', n: 7, text: 'Claim all 7 daily gifts in a row' }, perk: 'coins', perkText: '+10% coins from every dive' },
  { id: 'lumi',    name: 'Lumi',    bio: 'Brings their own light to the deep.', body: '#2b3f8f', belly: '#1d2c6b', fins: '#5fe8ff', extra: 'lure', price: 5, shells: true, earn: { stat: 'anglers', n: 100, text: 'Dodge 100 anglerfish' }, perk: 'light', perkText: 'A bigger pool of light in the dark' },
  { id: 'ghost',   name: 'Ghost',   bio: 'Nobody has ever seen them surface.',  body: '#eef4ff', belly: '#c9d6ee', fins: '#5fd3ff', extra: 'glow', metal: 'silver', price: 8, shells: true, perk: 'blink', perkText: 'Stays untouchable longer after a hit' },
  { id: 'captain', name: 'Captain', bio: 'A thousand dives and counting.',      body: '#f4f7fb', belly: '#c5d0de', fins: '#2a4f9e', extra: 'cap', metal: 'silver', price: 0, rank: 10, perk: 'ice', perkText: 'Grips the ice and needs 10% less air' },
  // Scuba Kid
  { id: 'scuba',        char: 'scuba', name: 'Reef',      bio: 'Knows every fish by name.',          body: '#ff7aa8', belly: '#e9558a', fins: '#7a5cff', mask: '#7a5cff', tone: '#8d5a3b', hair: '#1e1410', price: 5000, perkText: 'A steady all-rounder' },
  { id: 'scuba-night',  char: 'scuba', name: 'Night Swim', bio: 'Likes the deep best after dark.',   body: '#2b3f8f', belly: '#1d2c6b', fins: '#5fe8ff', mask: '#ffd23f', tone: '#f6c9a0', hair: '#5a3a22', price: 8000, perk: 'light', perkText: 'A bigger pool of light in the dark' },
  { id: 'scuba-sunset', char: 'scuba', name: 'Sunset',    bio: 'Surfs in, dives down, never stops.', body: '#ffb03a', belly: '#ff8a1f', fins: '#ff5a7a', mask: '#33dcb8', tone: '#e8b48a', hair: '#f2c94c', price: 3, shells: true, perk: 'steer', perkText: 'Steers 12% sharper' },
  // Otter
  { id: 'otter',        char: 'otter', name: 'River',     bio: 'Floats on their back between dives.', body: '#a8673a', belly: '#7a4422', fins: '#ffd23f', cream: '#ffe3c2', price: 4, shells: true, perkText: 'A steady all-rounder' },
  { id: 'otter-arctic', char: 'otter', name: 'Arctic',    bio: 'Born on the ice, never feels cold.',  body: '#eef1f7', belly: '#b9c4d8', fins: '#ff7aa8', cream: '#ffffff', price: 3, shells: true, perk: 'ice', perkText: 'Grips the ice and needs 10% less air' },
  { id: 'otter-choc',   char: 'otter', name: 'Cocoa',     bio: 'Naps in the kelp, wakes up hungry.',  body: '#5b3a2a', belly: '#3a2219', fins: '#33dcb8', cream: '#e9c79f', price: 10000, perk: 'kelp', perkText: 'Kelp barely slows them' },
  // Pod
  { id: 'pod',          char: 'pod',   name: 'Sunbeam',   bio: 'Fresh off the slipway, paint still wet.', body: '#ffd23f', belly: '#f2a91e', fins: '#ff7a2f', price: 12000, perkText: 'A steady all-rounder' },
  { id: 'pod-royal',    char: 'pod',   name: 'Regal',     bio: 'Gold trim on every rivet.',           body: '#9b6bff', belly: '#7a49e6', fins: '#ffc43d', price: 4, shells: true, perk: 'coins', perkText: '+10% coins from every dive' },
  { id: 'pod-navy',     char: 'pod',   name: 'Admiral',   bio: 'Built for the long haul.',            body: '#eef4ff', belly: '#c9d6ee', fins: '#2a4f9e', price: 15000, perk: 'blink', perkText: 'Stays untouchable longer after a hit' },
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

/** Progress towards an earned diver's goal (capped at the goal), or null if it isn't earned that way. */
export const earnProgress = (s: Skin) => (s.earn ? Math.min(s.earn.n, lifetime.get(s.earn.stat)) : null);
export const earned = (s: Skin) => !!s.earn && lifetime.get(s.earn.stat) >= s.earn.n;

/** Wear a diver, buying it first (with coins or Sea Hearts, or skipping an earn goal) if needed. */
export function getDiver(s: Skin): 'owned' | 'bought' | 'poor' {
  if (suits.owns(s.id)) { suits.equip(s.id); return 'owned'; }
  if (!charOwned(charOf(s)) && s.id !== charOf(s).base) return 'poor';
  if (!s.shells) return suits.buy(s.id);
  if (!earned(s) && !shells.spend(s.price)) return 'poor';
  suits.grant(s.id);
  suits.equip(s.id);
  return 'bought';
}

/** Can the player pay for this diver right now? */
export const canAfford = (s: Skin, coins: number) => (s.shells ? shells.count : coins) >= s.price;

/** Give every earned diver whose goal is now reached; returns the new ones (for a "diver unlocked" moment). */
export function grantEarned(): Skin[] {
  const fresh = SKINS.filter(s => earned(s) && !suits.owns(s.id));
  fresh.forEach(s => suits.grant(s.id));
  return fresh;
}

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
