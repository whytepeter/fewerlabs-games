import { shop } from '../core/meta';

/** A look drawn on top of the basic diver (see BootScene.makeDiver). */
export type Extra = 'spots' | 'stripes' | 'crown' | 'glow' | 'spikes' | 'lure' | 'cap';

/**
 * Divers, bought with arcade coins or unlocked by mission rank. Ids are saved, so never rename
 * one: the first five were the original colour "suits".
 */
export interface Skin {
  id: string; name: string; bio: string;
  body: string; belly: string; fins: string; extra?: Extra;
  /** Coin price (0 = free, or unlocked by `rank` instead). */
  price: number;
  /** Mission rank that unlocks this diver for free. */
  rank?: number;
}

export const SKINS: Skin[] = [
  { id: 'classic', name: 'Sunny',   bio: 'First in the water every morning.',  body: '#ffd23f', belly: '#f2a91e', fins: '#ff7a2f', price: 0 },
  { id: 'coral',   name: 'Coral',   bio: 'Pink, quick and a little reckless.',  body: '#ff7aa8', belly: '#e9558a', fins: '#7a5cff', extra: 'spots', price: 120 },
  { id: 'kelp',    name: 'Kelp',    bio: 'Hides in the seaweed. Mostly naps.',  body: '#4fdc7a', belly: '#2fb35c', fins: '#ffd23f', extra: 'stripes', price: 300 },
  { id: 'puff',    name: 'Puff',    bio: 'Gets spiky when the eels show up.',   body: '#ffb03a', belly: '#ff8a1f', fins: '#ff5a7a', extra: 'spikes', price: 0, rank: 3 },
  { id: 'royal',   name: 'Royal',   bio: 'Only dives in style.',                body: '#9b6bff', belly: '#7a49e6', fins: '#ffc43d', extra: 'crown', price: 600 },
  { id: 'lumi',    name: 'Lumi',    bio: 'Brings their own light to the deep.', body: '#2b3f8f', belly: '#1d2c6b', fins: '#5fe8ff', extra: 'lure', price: 0, rank: 6 },
  { id: 'ghost',   name: 'Ghost',   bio: 'Nobody has ever seen them surface.',  body: '#eef4ff', belly: '#c9d6ee', fins: '#5fd3ff', extra: 'glow', price: 1200 },
  { id: 'captain', name: 'Captain', bio: 'A thousand dives and counting.',      body: '#f4f7fb', belly: '#c5d0de', fins: '#2a4f9e', extra: 'cap', price: 0, rank: 10 },
];

export const suits = shop('deep-dive', 'suit', SKINS);
export const skinIndex = (id: string) => Math.max(0, SKINS.findIndex(s => s.id === id));

/** Still waiting on a mission rank? */
export const rankLocked = (s: Skin, rank: number) => !!s.rank && rank < s.rank;

/** Data URLs of each diver's first frame, filled in by BootScene for the menus. */
export const portraits: Record<string, string> = {};
