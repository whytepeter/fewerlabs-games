import type { CaveShape } from './caves';

/**
 * Trench ceiling and floor at a world x, for a view of height H, in a cave of the given shape.
 * The gap narrows the deeper you go (10 world px = 1 m) and never drops below 170 px.
 */
export function cave(wx: number, H: number, out: [number, number], s: CaveShape): [number, number] {
  const d = wx / 10;
  const c = H * 0.5 + Math.sin(wx * 0.0016) * H * s.wave + Math.sin(wx * 0.0047 + 1.3) * H * s.wave2;
  const narrow = s.start + (s.end - s.start) * Math.min(1, Math.max(0, d / s.over));
  const gap = Math.max(170, H * narrow + Math.sin(wx * 0.0031) * H * 0.05);
  const rough = Math.sin(wx * 0.05) * 3 + Math.sin(wx * 0.13) * 2;
  out[0] = c - gap / 2 + rough;
  out[1] = c + gap / 2 - rough;
  return out;
}
