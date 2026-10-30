import { store } from '../core/settings';
import type { Song } from '../core/music';
import type { Biome } from './biomes';
import { DEEP_SONG, FROST_SONG, KELP_SONG, LINER_SONG, PIRATE_SONG, RIPTIDE_SONG, SUNKEN_SONG } from './song';
import { FROST_AMBIENCE, KELP_AMBIENCE, LINER_AMBIENCE, PIRATE_AMBIENCE, REEF_AMBIENCE, RIPTIDE_AMBIENCE, SUNKEN_AMBIENCE, type Soundscape } from './ambient';

/**
 * Caves you can dive in. Each one has its own depth zones (colours and names), trench shape,
 * creature mix, hazards and soundtrack. The Reef Trench is open from the start; every other cave
 * opens once you reach a depth in the cave before it. Bests are kept per cave.
 */

export type CaveId = 'reef' | 'kelp' | 'frost' | 'pirate' | 'titanic' | 'riptide' | 'sunken';
export type Kind = 'jelly' | 'mine' | 'angler' | 'eel'
  // Each cave's own creature (its `star`):
  | 'puffer' | 'crab' | 'squid' | 'octopus' | 'shark' | 'swordfish' | 'snake';

/** How a cave's sharp walls look, glow in the dark, and what the message says when they get you. */
export interface SpikeLook { fill: number; shine: number; glow: number; hit: string }

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
  /** This cave's own creature: found only here, and twice as common as the others once it's in. */
  star: Kind;
  crowdFrom: number;
  /**
   * Room between creatures (world px): `gap[0]` at the surface, closing to `gap[1]` by `over` m. On top of
   * that the spacing breathes in and out every few hundred metres, and each new zone opens with a calm stretch.
   */
  pace: { gap: [number, number]; over: number };
  /** Coins for a dive here, compared with the Reef Trench: harder caves pay more. */
  pay: number;
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
  /** Cannons on wrecked hulls that aim at you and fire once as you come near: from this depth, this far apart (world px). */
  cannons?: { from: number; gap: [number, number] };
  /** Anchors swinging on chains from the ceiling: from this depth, this far apart (world px). */
  anchors?: { from: number; gap: [number, number] };
  /** Broken boiler pipes on the walls that burst scalding steam on a beat: from this depth, this far apart (world px). */
  vents?: { from: number; gap: [number, number] };
  /** Sections of deck that tear loose from the ceiling and swing down as you come near: from this depth, this far apart (world px). */
  decks?: { from: number; gap: [number, number] };
  /** Wreckage drawn along the walls (scenery only). */
  decor?: 'ship' | 'liner' | 'canyon' | 'city';
  /**
   * Currents: stretches of the trench where the water pushes you up or down (`push`, compared with
   * your own steering), from this depth, `len` long and this far apart (world px). A row of pearls
   * shows where the current carries you if you let it.
   */
  currents?: { from: number; gap: [number, number]; len: [number, number]; push: number };
  /** Temple gates: a stone wall with a doorway that jumps between heights on the music's beat. From this depth, this far apart (world px). */
  gates?: { from: number; gap: [number, number] };
  /** Statues on the walls that thrust a spear across the trench on the beat. From this depth, this far apart (world px). */
  spears?: { from: number; gap: [number, number] };
  /** Once a dive, somewhere between these depths (m): a ghost ship sails alongside and fires a broadside at you. */
  broadside?: { from: number; to: number };
  /** Sharp walls that aren't coral or ice. */
  spikeLook?: SpikeLook;
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
  ambience: Soundscape;
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
    creatures: { puffer: 60, jelly: 0, mine: 50, angler: 200, eel: 320 },
    star: 'puffer',
    crowdFrom: 450,
    pace: { gap: [440, 220], over: 1300 },
    pay: 1,
    spikeFrom: 160,
    spikes: 1,
    pearlGap: [520, 900],
    raysUntil: 180,
    plantsUntil: 220,
    coral: 0.4,
    song: DEEP_SONG,
    ambience: REEF_AMBIENCE,
  },
  {
    id: 'kelp',
    name: 'Kelp Forest',
    blurb: 'A wide, wavy forest. Kelp slows you down: steer around it. Coins ×1.25.',
    unlock: { cave: 'reef', depth: 1200 },
    biomes: [
      { at: 0,   name: 'Kelp Shallows',  top: 0x47d9b0, bot: 0x137a66, rock: 0x2f7a52, dark: 0,    vent: 0 },
      { at: 180, name: 'Swaying Canopy', top: 0x23a184, bot: 0x0d5a4e, rock: 0x2a6646, dark: 0.3,  vent: 0 },
      { at: 420, name: 'Kelp Gloom',     top: 0x146a5c, bot: 0x08362f, rock: 0x24523c, dark: 0.58, vent: 0 },
      { at: 780, name: 'The Tangle',     top: 0x0c3d36, bot: 0x041d1a, rock: 0x1e3f30, dark: 0.72, vent: 0 },
    ],
    shape: { start: 0.88, end: 0.58, over: 1800, wave: 0.19, wave2: 0.08 },
    creatures: { crab: 60, jelly: 0, angler: 150, mine: 260, eel: 420 },
    star: 'crab',
    crowdFrom: 550,
    pace: { gap: [420, 210], over: 1200 },
    pay: 1.25,
    spikeFrom: 250,
    spikes: 0.7,
    pearlGap: [400, 700],
    kelp: { from: 15, gap: [520, 900] },
    raysUntil: 320,
    plantsUntil: Infinity,
    coral: 0.18,
    song: KELP_SONG,
    ambience: KELP_AMBIENCE,
  },
  {
    id: 'frost',
    name: 'Frozen Trench',
    blurb: 'Slippery ice, falling icicles and cold air that runs out faster. Coins ×1.5.',
    unlock: { cave: 'kelp', depth: 1450 },
    biomes: [
      { at: 0,   name: 'Frost Shelf',      top: 0xbfefff, bot: 0x5fb3db, rock: 0x2a5d8c, dark: 0,    vent: 0 },
      { at: 160, name: 'Glacier Hollow',   top: 0x6cc4ec, bot: 0x2a6fa8, rock: 0x224d7c, dark: 0.3,  vent: 0 },
      { at: 400, name: 'Blue Ice Deep',    top: 0x2d74b8, bot: 0x123a72, rock: 0x203f72, dark: 0.58, vent: 0 },
      { at: 750, name: 'The Frozen Heart', top: 0x18306a, bot: 0x0a1638, rock: 0x1d3462, dark: 0.74, vent: 0 },
    ],
    shape: { start: 0.82, end: 0.52, over: 1500, wave: 0.13, wave2: 0.05 },
    creatures: { squid: 70, jelly: 0, mine: 80, eel: 220, angler: 380 },
    star: 'squid',
    crowdFrom: 500,
    pace: { gap: [400, 205], over: 1100 },
    pay: 1.5,
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
    ambience: FROST_AMBIENCE,
  },
  {
    id: 'pirate',
    name: 'Pirate Shipwreck',
    blurb: 'A graveyard of pirate ships. Dodge cannon fire and swinging anchors. Coins ×1.75.',
    unlock: { cave: 'frost', depth: 1450 },
    biomes: [
      { at: 0,   name: "Smugglers' Cove",    top: 0x3fc6d8, bot: 0x16839a, rock: 0x8a6440, dark: 0,    vent: 0 },
      { at: 170, name: 'Ship Graveyard',     top: 0x228aa8, bot: 0x0f4f72, rock: 0x6e4b30, dark: 0.32, vent: 0 },
      { at: 420, name: 'Cannon Row',         top: 0x175a7c, bot: 0x0a2e4c, rock: 0x5a3c2a, dark: 0.56, vent: 0 },
      { at: 780, name: "Davy Jones' Locker", top: 0x14284a, bot: 0x08122a, rock: 0x45302a, dark: 0.72, vent: 0 },
    ],
    shape: { start: 0.85, end: 0.55, over: 1500, wave: 0.16, wave2: 0.07 },
    creatures: { shark: 90, jelly: 0, eel: 160, angler: 300, mine: 480 },
    star: 'shark',
    crowdFrom: 620,
    pace: { gap: [440, 225], over: 1200 },
    pay: 1.75,
    spikeFrom: 180,
    spikes: 0.8,
    spikeLook: { fill: 0xc98a4b, shine: 0xf6d6a8, glow: 0xffa64d, hit: 'Spiked on splintered wood' },
    pearlGap: [460, 800],
    cannons: { from: 30, gap: [900, 1500] },
    anchors: { from: 90, gap: [1100, 1800] },
    decor: 'ship',
    broadside: { from: 450, to: 750 },
    tip: 'Cannons aim at you: keep moving when the fuse fizzes',
    raysUntil: 240,
    plantsUntil: 120,
    coral: 0.3,
    song: PIRATE_SONG,
    ambience: PIRATE_AMBIENCE,
  },
  {
    id: 'titanic',
    name: 'Titanic Wreck',
    blurb: 'A great liner lost in the cold and dark. Mind the steam and falling decks. Coins ×2.',
    unlock: { cave: 'pirate', depth: 1550 },
    biomes: [
      { at: 0,   name: 'Promenade Deck',  top: 0x2b5f8a, bot: 0x143a5e, rock: 0x45566a, dark: 0.3,  vent: 0 },
      { at: 160, name: 'Grand Staircase', top: 0x1d4468, bot: 0x0e2742, rock: 0x3e4c60, dark: 0.5,  vent: 0 },
      { at: 420, name: 'Boiler Rooms',    top: 0x2c2733, bot: 0x120f18, rock: 0x4a3c3a, dark: 0.66, vent: 0.35 },
      { at: 780, name: 'The Lost Hold',   top: 0x10203a, bot: 0x060b16, rock: 0x2c374a, dark: 0.8,  vent: 0 },
    ],
    shape: { start: 0.82, end: 0.54, over: 1400, wave: 0.1, wave2: 0.04 },
    creatures: { octopus: 80, jelly: 0, angler: 120, eel: 280, mine: 450 },
    star: 'octopus',
    crowdFrom: 600,
    pace: { gap: [430, 215], over: 1100 },
    pay: 2,
    spikeFrom: 140,
    spikes: 0.9,
    spikeLook: { fill: 0x9fb3c4, shine: 0xeef5fb, glow: 0x8fd0ff, hit: 'Cut on torn steel' },
    pearlGap: [480, 820],
    vents: { from: 40, gap: [800, 1300] },
    decks: { from: 120, gap: [1100, 1700] },
    decor: 'liner',
    tip: 'Cold and dark: watch for steam bursts and decks giving way',
    raysUntil: 60,
    plantsUntil: 30,
    coral: 0,
    song: LINER_SONG,
    ambience: LINER_AMBIENCE,
  },
  {
    id: 'riptide',
    name: 'Riptide Canyon',
    blurb: 'A sunny sandstone canyon full of fast currents. Ride them, or fight them. Coins ×1.5.',
    unlock: { cave: 'reef', depth: 1800 },
    biomes: [
      { at: 0,   name: 'Sandbar Shallows', top: 0x5fd8e6, bot: 0x1b9cb8, rock: 0xd08a52, dark: 0,    vent: 0 },
      { at: 170, name: 'Red Rock Narrows', top: 0x2fa6c9, bot: 0x12648f, rock: 0xb4643c, dark: 0.28, vent: 0 },
      { at: 420, name: 'Tidal Gorge',      top: 0x1d6f9e, bot: 0x0c3a63, rock: 0x8f4a34, dark: 0.52, vent: 0 },
      { at: 780, name: 'The Undertow',     top: 0x163c66, bot: 0x081a36, rock: 0x6a3a32, dark: 0.7,  vent: 0 },
    ],
    shape: { start: 0.78, end: 0.54, over: 1500, wave: 0.1, wave2: 0.04 },
    creatures: { swordfish: 100, jelly: 0, mine: 90, eel: 260, angler: 420 },
    star: 'swordfish',
    crowdFrom: 600,
    pace: { gap: [450, 230], over: 1250 },
    pay: 1.5,
    spikeFrom: 150,
    spikes: 0.9,
    spikeLook: { fill: 0x5b3a7a, shine: 0xb48cff, glow: 0xc77dff, hit: 'Spiked by sea urchins' },
    pearlGap: [520, 900],
    currents: { from: 15, gap: [380, 760], len: [380, 680], push: 0.5 },
    decor: 'canyon',
    tip: 'Currents push you up or down: ride them for pearls',
    raysUntil: 320,
    plantsUntil: 260,
    coral: 0.35,
    song: RIPTIDE_SONG,
    ambience: RIPTIDE_AMBIENCE,
  },
  {
    id: 'sunken',
    name: 'Sunken City',
    blurb: 'A drowned temple city. Its gates and spears move on the beat of the music. Coins ×2.25.',
    unlock: { cave: 'titanic', depth: 1700 },
    biomes: [
      { at: 0,   name: 'Marble Terraces',  top: 0x4fd6c8, bot: 0x1a8f99, rock: 0xbfae8c, dark: 0.05, vent: 0 },
      { at: 170, name: 'Temple Gates',     top: 0x2a9db0, bot: 0x105a78, rock: 0xa89470, dark: 0.32, vent: 0 },
      { at: 420, name: 'Hall of Statues',  top: 0x1d5f86, bot: 0x0b3156, rock: 0x8a7a62, dark: 0.55, vent: 0 },
      { at: 780, name: 'The Drowned Throne', top: 0x162f5a, bot: 0x07142e, rock: 0x5e5450, dark: 0.74, vent: 0 },
    ],
    shape: { start: 0.84, end: 0.56, over: 1500, wave: 0.08, wave2: 0.03 },
    creatures: { snake: 80, jelly: 0, angler: 160, eel: 320, mine: 520 },
    star: 'snake',
    crowdFrom: 650,
    pace: { gap: [470, 235], over: 1250 },
    pay: 2.25,
    spikeFrom: 160,
    spikes: 0.8,
    spikeLook: { fill: 0xe8e2d0, shine: 0xffffff, glow: 0x7fffd4, hit: 'Cut on broken marble' },
    pearlGap: [480, 820],
    gates: { from: 30, gap: [700, 1100] },
    spears: { from: 140, gap: [900, 1400] },
    decor: 'city',
    tip: 'Gates and spears move on the beat: listen, then line up with the doorway',
    raysUntil: 260,
    plantsUntil: 160,
    coral: 0.25,
    song: SUNKEN_SONG,
    ambience: SUNKEN_AMBIENCE,
  },
];

const byId = (id: string) => CAVES.find(c => c.id === id);

/** Where each cave's best depth is saved (the Reef Trench keeps the original key). */
export const bestKey = (id: CaveId) => (id === 'reef' ? 'best' : `best:${id}`);
export const caveBest = (id: CaveId) => store.get(bestKey(id), 0);

export function isUnlocked(c: CaveDef) {
  // A cave the player has already opened stays open, even if its unlock depth was raised since.
  return !c.unlock || caveBest(c.unlock.cave) >= c.unlock.depth || store.get<string[]>('cavesSeen', []).includes(c.id);
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
