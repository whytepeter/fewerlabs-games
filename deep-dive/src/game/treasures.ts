import { todayKey } from '../core/rng';
import { store } from '../core/settings';
import type { CaveId } from './caves';

/**
 * Rare treasures: one or two per cave, each turning up in only a few dives in a hundred (the Heart
 * of the Sea far less), tucked against a wall with a big glow. Finds are kept in the save under
 * `treasures` (id -> how many and the date of the first), so the collection syncs like the rest.
 * The first find of each pays a handful of Sea Hearts; later ones pay a little.
 */

export interface Treasure {
  id: string;
  name: string;
  cave: CaveId;
  /** One line for the collection screen. */
  story: string;
  /** It turns up in about one dive in `chance`, somewhere between `from` and `to` metres (if you get that deep). */
  from: number;
  to: number;
  chance: number;
  /** Sea Hearts for the first one ever, and for each one after that. */
  first: number;
  again: number;
  glow: number;
  /** The rarest find: a longer slow-motion, a bigger flash and chime. */
  legendary?: boolean;
}

export const TREASURES: Treasure[] = [
  {
    id: 'blackpearl', name: 'Black Pearl', cave: 'reef', glow: 0xc49cff,
    story: 'Dark as the deep and shining green-purple. One oyster in a million grows one.',
    from: 250, to: 1000, chance: 25, first: 2, again: 1,
  },
  {
    id: 'bottle', name: 'Message in a Bottle', cave: 'kelp', glow: 0x8fffc0,
    story: 'Corked tight long ago. The note inside just says: "Keep diving."',
    from: 200, to: 900, chance: 25, first: 2, again: 1,
  },
  {
    id: 'fossil', name: 'Frozen Fossil', cave: 'frost', glow: 0x9fe8ff,
    story: 'An ancient spiral shell, locked in blue ice since before the dinosaurs.',
    from: 250, to: 1000, chance: 30, first: 2, again: 1,
  },
  {
    id: 'doubloon', name: 'Gold Doubloon', cave: 'pirate', glow: 0xffd23f,
    story: 'Old Spanish gold stamped with a cross. Where there was one, there were thousands.',
    from: 200, to: 800, chance: 20, first: 2, again: 1,
  },
  {
    id: 'compass', name: "Captain's Compass", cave: 'pirate', glow: 0xffc94d,
    story: 'It never points north. They say it points to whatever you want most.',
    from: 450, to: 1200, chance: 38, first: 3, again: 1,
  },
  {
    id: 'watch', name: 'Pocket Watch', cave: 'titanic', glow: 0xd8e4f0,
    story: 'Silver and engraved, its hands stopped at twenty past two.',
    from: 250, to: 1000, chance: 30, first: 3, again: 1,
  },
  {
    id: 'heart', name: 'Heart of the Sea', cave: 'titanic', glow: 0x5fb8ff, legendary: true,
    story: 'A great blue diamond on a silver chain, lost with the ship. The rarest thing in the deep.',
    from: 650, to: 1400, chance: 70, first: 5, again: 2,
  },
];

export const caveTreasures = (cave: CaveId) => TREASURES.filter(t => t.cave === cave);

type Log = Record<string, { n: number; first: string }>;
const KEY = 'treasures';
const listeners = new Set<() => void>();

export const treasureLog = {
  all: () => store.get<Log>(KEY, {}),
  /** How many of this treasure have been found. */
  count: (id: string) => treasureLog.all()[id]?.n ?? 0,
  /** How many different treasures have been found. */
  found: () => TREASURES.filter(t => treasureLog.count(t.id) > 0).length,
  /** Record a find; true if it's the first one ever. */
  add(id: string) {
    const log = treasureLog.all(), e = log[id];
    log[id] = { n: (e?.n ?? 0) + 1, first: e?.first ?? todayKey() };
    store.set(KEY, log);
    listeners.forEach(fn => fn());
    return !e;
  },
  onChange(fn: () => void) { listeners.add(fn); },
};

/** This dive's treasure in a cave, if any: at most one, at a depth (m) inside its range. `odds` scales every chance (remote tuning). */
export function rollTreasure(cave: CaveId, r: () => number = Math.random, odds = 1): { t: Treasure; depth: number } | null {
  const hits = caveTreasures(cave).filter(t => r() < odds / t.chance);
  if (!hits.length) return null;
  const t = hits[(r() * hits.length) | 0];
  return { t, depth: t.from + r() * (t.to - t.from) };
}
