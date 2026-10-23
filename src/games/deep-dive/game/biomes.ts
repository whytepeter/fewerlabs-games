import { mixNum } from '../../../core/tex';

export interface Biome { at: number; name: string; top: number; bot: number; rock: number; dark: number; vent: number }

/** Depth zones in metres. Colours blend over the last 80 m before each boundary. */
export const BIOMES: Biome[] = [
  { at: 0,    name: 'Sunlit Reef',        top: 0x2ec4f0, bot: 0x0e74ad, rock: 0x2a7a96, dark: 0,    vent: 0 },
  { at: 150,  name: 'Twilight Zone',      top: 0x1c78c2, bot: 0x0c3f7c, rock: 0x1f4f86, dark: 0.35, vent: 0 },
  { at: 400,  name: 'Midnight Zone',      top: 0x173579, bot: 0x0b1c4c, rock: 0x243a74, dark: 0.62, vent: 0 },
  { at: 750,  name: 'The Abyss',          top: 0x0f1a42, bot: 0x070c25, rock: 0x252b5c, dark: 0.76, vent: 0 },
  { at: 1200, name: 'Hydrothermal Vents', top: 0x441a1a, bot: 0x16080c, rock: 0x5a2416, dark: 0.7,  vent: 1 },
];

export function biomeIndex(depth: number) {
  let i = 0;
  while (i < BIOMES.length - 1 && depth >= BIOMES[i + 1].at) i++;
  return i;
}

export interface Palette { top: number; bot: number; rock: number; dark: number; vent: number }

export function palette(depth: number, out: Palette): Palette {
  const i = biomeIndex(depth);
  const a = BIOMES[i], b = BIOMES[Math.min(i + 1, BIOMES.length - 1)];
  const t = a === b ? 0 : Math.max(0, Math.min(1, (depth - (b.at - 80)) / 80));
  out.top = mixNum(a.top, b.top, t);
  out.bot = mixNum(a.bot, b.bot, t);
  out.rock = mixNum(a.rock, b.rock, t);
  out.dark = a.dark + (b.dark - a.dark) * t;
  out.vent = a.vent + (b.vent - a.vent) * t;
  return out;
}
