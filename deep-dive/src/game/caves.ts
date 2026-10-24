import { store } from '../core/settings';
import type { Song } from '../core/music';
import type { Biome } from './biomes';
import { DEEP_SONG, FROST_SONG, KELP_SONG } from './song';

/**
 * Caves you can dive in. Each one has its own depth zones (colours and names), trench shape,
 * creature mix, hazards and soundtrack. The Reef Trench is open from the start; every other cave
 * opens once you reach a depth in the cave before it. Bests are kept per cave.
 */

export type CaveId = 'reef' | 'kelp' | 'frost';
export type Kind = 'jelly' | 'mine' | 'angler' | 'eel';

/** Trench shape: the gap narrows from `start` to `end` (fractions of the view height) over `over` metres. */
export interface CaveShape { start: number; end: number; over: number; wave: number; wave2: number }

export interface CaveDef {
  id: CaveId;
  name: string;
  blurb: string;
  /** Reach `depth` metres in `cave` to open this one. */
  unlock?: { cave: CaveId; depth: number };
  biomes: Biome[];
  shape: CaveShape;
  /** Each creature joins the mix from this depth (m); below `crowdFrom` every kind is doubled up. */
  creatures: Partial<Record<Kind, number>>;
  crowdFrom: number;
  /** Sharp coral: from this depth, and how often compared with the Reef Trench. */
  spikeFrom: number;
  spikes: number;
  /** Sharp ice instead of coral: pale blue, and a different message when it gets you. */
  iceSpikes?: boolean;
  /** Distance between pearl rows (world px). */
  pearlGap: [number, number];
  /** Kelp patches that slow you down: from this depth, this far apart (world px). */
  kelp?: { from: number; gap: [number, number] };
  /** Icicles on the ceiling that shake loose and fall as you come near: from this depth, this far apart (world px). */
  icicles?: { from: number; gap: [number, number] };
  /** Slippery steering: how fast you drift to a stop (normal 2.6) and how hard steering pushes (normal 1). */
  glide?: { drag: number; steer: number };
  /** How fast air runs out compared with the Reef Trench. */
  airDrain?: number;
  /** Shown once, on the first dive in this cave. */
  tip?: string;
  /** Sun rays and floor plants fade out by these depths (m); `coral` is the share of plants that are coral. */
  raysUntil: number;
  plantsUntil: number;
  coral: number;
  song: Song;
}

export const CAVES: CaveDef[] = [
  {
    id: 'reef',
    name: 'Reef Trench',
    blurb: 'Bright reefs down to the hydrothermal vents.',
    biomes: [
      { at: 0,    name: 'Sunlit Reef',        top: 0x2ec4f0, bot: 0x0e74ad, rock: 0x2a7a96, dark: 0,    vent: 0 },
      { at: 150,  name: 'Twilight Zone',      top: 0x1c78c2, bot: 0x0c3f7c, rock: 0x1f4f86, dark: 0.35, vent: 0 },
      { at: 400,  name: 'Midnight Zone',      top: 0x173579, bot: 0x0b1c4c, rock: 0x243a74, dark: 0.62, vent: 0 },
      { at: 750,  name: 'The Abyss',          top: 0x0f1a42, bot: 0x070c25, rock: 0x252b5c, dark: 0.76, vent: 0 },
      { at: 1200, name: 'Hydrothermal Vents', top: 0x441a1a, bot: 0x16080c, rock: 0x5a2416, dark: 0.7,  vent: 1 },
    ],
    shape: { start: 0.84, end: 0.5, over: 1500, wave: 0.15, wave2: 0.06 },
    creatures: { jelly: 0, mine: 50, angler: 200, eel: 320 },
    crowdFrom: 450,
    spikeFrom: 160,
    spikes: 1,
    pearlGap: [520, 900],
    raysUntil: 180,
    plantsUntil: 220,
    coral: 0.4,
    song: DEEP_SONG,
  },
  {
    id: 'kelp',
    name: 'Kelp Forest',
    blurb: 'A wide, wavy forest. Kelp slows you down: steer around it.',
    unlock: { cave: 'reef', depth: 300 },
    biomes: [
      { at: 0,   name: 'Kelp Shallows',  top: 0x47d9b0, bot: 0x137a66, rock: 0x2f7a52, dark: 0,    vent: 0 },
      { at: 180, name: 'Swaying Canopy', top: 0x23a184, bot: 0x0d5a4e, rock: 0x2a6646, dark: 0.3,  vent: 0 },
      { at: 420, name: 'Kelp Gloom',     top: 0x146a5c, bot: 0x08362f, rock: 0x24523c, dark: 0.58, vent: 0 },
      { at: 780, name: 'The Tangle',     top: 0x0c3d36, bot: 0x041d1a, rock: 0x1e3f30, dark: 0.72, vent: 0 },
    ],
    shape: { start: 0.88, end: 0.58, over: 1800, wave: 0.19, wave2: 0.08 },
    creatures: { jelly: 0, angler: 150, mine: 260, eel: 420 },
    crowdFrom: 550,
    spikeFrom: 250,
    spikes: 0.7,
    pearlGap: [400, 700],
    kelp: { from: 15, gap: [520, 900] },
    raysUntil: 320,
    plantsUntil: Infinity,
    coral: 0.18,
    song: KELP_SONG,
  },
  {
    id: 'frost',
    name: 'Frozen Trench',
    blurb: 'Slippery ice, falling icicles and cold air that runs out faster.',
    unlock: { cave: 'kelp', depth: 400 },
    biomes: [
      { at: 0,   name: 'Frost Shelf',      top: 0xbfefff, bot: 0x5fb3db, rock: 0x2a5d8c, dark: 0,    vent: 0 },
      { at: 160, name: 'Glacier Hollow',   top: 0x6cc4ec, bot: 0x2a6fa8, rock: 0x224d7c, dark: 0.3,  vent: 0 },
      { at: 400, name: 'Blue Ice Deep',    top: 0x2d74b8, bot: 0x123a72, rock: 0x203f72, dark: 0.58, vent: 0 },
      { at: 750, name: 'The Frozen Heart', top: 0x18306a, bot: 0x0a1638, rock: 0x1d3462, dark: 0.74, vent: 0 },
    ],
    shape: { start: 0.82, end: 0.52, over: 1500, wave: 0.13, wave2: 0.05 },
    creatures: { jelly: 0, mine: 80, eel: 220, angler: 380 },
    crowdFrom: 500,
    spikeFrom: 120,
    spikes: 1.1,
    iceSpikes: true,
    pearlGap: [480, 820],
    icicles: { from: 20, gap: [380, 700] },
    glide: { drag: 0.9, steer: 0.62 },
    airDrain: 1.25,
    tip: 'Icy water: you slide, and air runs out faster',
    raysUntil: 260,
    plantsUntil: 40,
    coral: 0,
    song: FROST_SONG,
  },
];

const byId = (id: string) => CAVES.find(c => c.id === id);

/** Where each cave's best depth is saved (the Reef Trench keeps the original key). */
export const bestKey = (id: CaveId) => (id === 'reef' ? 'best' : `best:${id}`);
export const caveBest = (id: CaveId) => store.get(bestKey(id), 0);

export function isUnlocked(c: CaveDef) {
  return !c.unlock || caveBest(c.unlock.cave) >= c.unlock.depth;
}

/** The cave picked on the title screen (back to the Reef Trench if it isn't open). */
export function currentCave(): CaveDef {
  const c = byId(store.get('cave', 'reef'));
  return c && isUnlocked(c) ? c : CAVES[0];
}

export function selectCave(id: CaveId) {
  const c = byId(id);
  if (!c || !isUnlocked(c)) return false;
  store.set('cave', id);
  return true;
}

/** Caves opened since the player last looked at the caves screen (for the "New" badge). */
export function newCaves() {
  const seen = new Set(store.get<string[]>('cavesSeen', ['reef']));
  return CAVES.filter(c => isUnlocked(c) && !seen.has(c.id));
}
export function markCavesSeen() {
  store.set('cavesSeen', CAVES.filter(isUnlocked).map(c => c.id));
}
