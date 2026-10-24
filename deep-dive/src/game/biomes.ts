import { mixNum } from '../core/tex';

/** A depth zone in metres; each cave has its own list (see caves.ts). Colours blend over the last 80 m before each boundary. */
export interface Biome { at: number; name: string; top: number; bot: number; rock: number; dark: number; vent: number }

export function biomeIndex(biomes: Biome[], depth: number) {
  let i = 0;
  while (i < biomes.length - 1 && depth >= biomes[i + 1].at) i++;
  return i;
}

export interface Palette { top: number; bot: number; rock: number; dark: number; vent: number }

export function palette(biomes: Biome[], depth: number, out: Palette): Palette {
  const i = biomeIndex(biomes, depth);
  const a = biomes[i], b = biomes[Math.min(i + 1, biomes.length - 1)];
  const t = a === b ? 0 : Math.max(0, Math.min(1, (depth - (b.at - 80)) / 80));
  out.top = mixNum(a.top, b.top, t);
  out.bot = mixNum(a.bot, b.bot, t);
  out.rock = mixNum(a.rock, b.rock, t);
  out.dark = a.dark + (b.dark - a.dark) * t;
  out.vent = a.vent + (b.vent - a.vent) * t;
  return out;
}
