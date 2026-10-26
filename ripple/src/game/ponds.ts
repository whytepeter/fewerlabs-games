import { store } from '../core/settings';
import type { Song } from '../core/music';
import { POND_RULES, type PondId, type PondRules } from './sim';
import { FROST_SONG, KOI_SONG, MARSH_SONG, RIPPLE_SONG } from './song';

/**
 * Ponds you can play. Each has its own colours (style.css, `html[data-pond]`), hazard, twists
 * (sim.ts POND_RULES) and song. The Lily Pond is open from the start; every other pond opens once
 * you score `unlock.score` in the pond before it. Bests are kept per pond.
 */

export type { PondId };

export interface PondDef {
  id: PondId;
  name: string;
  /** One short line under the name on the title. */
  blurb: string;
  /** Shown once, on the first run in this pond. */
  tip?: [string, string];
  unlock?: { pond: PondId; score: number };
  /** Coins for a run here, compared with the Lily Pond: harder ponds pay more. */
  pay: number;
  rules: PondRules;
  song: Song;
}

export const PONDS: PondDef[] = [
  {
    id: 'lily',
    name: 'Lily Pond',
    blurb: 'Sunny water and lily pads',
    pay: 1,
    rules: POND_RULES.lily,
    song: RIPPLE_SONG,
  },
  {
    id: 'koi',
    name: 'Koi Garden',
    blurb: 'Koi bump boats · Coins ×1.25',
    tip: ['Koi Garden', 'Ripple the koi away!'],
    unlock: { pond: 'lily', score: 15 },
    pay: 1.25,
    rules: POND_RULES.koi,
    song: KOI_SONG,
  },
  {
    id: 'marsh',
    name: 'Rainy Marsh',
    blurb: 'Rain makes ripples too · Coins ×1.5',
    tip: ['Rainy Marsh', 'Raindrops push boats too!'],
    unlock: { pond: 'koi', score: 15 },
    pay: 1.5,
    rules: POND_RULES.marsh,
    song: MARSH_SONG,
  },
  {
    id: 'frost',
    name: 'Frozen Lake',
    blurb: 'Slippery ice, drifting floes · Coins ×1.75',
    tip: ['Frozen Lake', 'Slippery! Tap gently.'],
    unlock: { pond: 'marsh', score: 15 },
    pay: 1.75,
    rules: POND_RULES.frost,
    song: FROST_SONG,
  },
];

const byId = (id: string) => PONDS.find(p => p.id === id);

/** Best score in a pond. The Lily Pond keeps the original 'best' key, so old records carry over. */
export function pondBest(id: PondId): number {
  return store.get(id === 'lily' ? 'best' : `best:${id}`, 0) || 0;
}
export function setPondBest(id: PondId, n: number) {
  store.set(id === 'lily' ? 'best' : `best:${id}`, n);
}
/** The best score in any pond (what the store shows). */
export const overallBest = () => Math.max(...PONDS.map(p => pondBest(p.id)));

export function isUnlocked(p: PondDef) {
  return !p.unlock || pondBest(p.unlock.pond) >= p.unlock.score;
}

/** The pond picked on the title screen (back to the Lily Pond if it isn't open). */
export function currentPond(): PondDef {
  const p = byId(store.get('pond', 'lily'));
  return p && isUnlocked(p) ? p : PONDS[0];
}
/** Remember the pond for next time (only an open one). */
export function selectPond(id: PondId) {
  const p = byId(id);
  if (!p || !isUnlocked(p)) return false;
  store.set('pond', id);
  return true;
}

/** Ponds opened since the player last flipped to them (their ring on the title pulses). */
export function newPonds() {
  const seen = new Set(store.get<string[]>('pondsSeen', ['lily']));
  return PONDS.filter(p => isUnlocked(p) && !seen.has(p.id));
}
export function markPondSeen(id: PondId) {
  const seen = store.get<string[]>('pondsSeen', ['lily']);
  if (!seen.includes(id)) store.set('pondsSeen', [...seen, id]);
}

/** True the first time it's asked for a pond (to show its tip once). */
export function firstVisit(id: PondId) {
  const seen = store.get<string[]>('pondTips', []);
  if (seen.includes(id)) return false;
  store.set('pondTips', [...seen, id]);
  return true;
}

/** Colours, hazards and twists follow the pond: style.css keys its palette off this attribute. */
export function applyPondTheme(p: PondDef) {
  if (p.id === 'lily') delete document.documentElement.dataset.pond;
  else document.documentElement.dataset.pond = p.id;
}
