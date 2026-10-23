import type { Rect } from './sim';

export interface Insets { t: number; r: number; b: number; l: number }

/** Safe-area insets (notch, home indicator) measured from the #safe probe element. */
export function readInsets(w: number, h: number): Insets {
  const el = document.getElementById('safe');
  if (!el) return { t: 0, r: 0, b: 0, l: 0 };
  const r = el.getBoundingClientRect();
  if (!(r.width > 0 && r.height > 0)) return { t: 0, r: 0, b: 0, l: 0 };
  return {
    t: Math.max(0, r.top), l: Math.max(0, r.left),
    r: Math.max(0, w - r.right), b: Math.max(0, h - r.bottom),
  };
}

/** Compact (two-column, slim HUD) layouts: short screens and landscape-ish ones. Keep in sync with style.css. */
export const isCompact = (w: number, h: number) => h <= 520 || w / h >= 1.25;
/** Space the HUD needs above the pond (CSS px before UI zoom): score + lives row. */
export const hudHeight = (w: number, h: number) => (isCompact(w, h) ? 58 : 74);

/** The UI zoom set by core autoScaleUI() (--ui on <html>). */
export function uiScale() {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui'));
  return v > 0 ? v : 1;
}

/**
 * World zoom (CSS px per world unit). Phones see a wide view of the pond (~0.87x portrait,
 * ~0.9x landscape) so there is room to plan ripples; big screens grow only a little, to 1.15x.
 */
export const MAX_WORLD_SCALE = 1.15;
export function worldScale(w: number, h: number) {
  return Math.max(0.8, Math.min(MAX_WORLD_SCALE, Math.min(Math.min(w, h) / 430, Math.max(w, h) / 930)));
}

/**
 * Play area in world units for a world of w x h, given insets and HUD height already in world
 * units. The water itself is drawn edge to edge (see Game.buildScenery); this is the part boats
 * move in: the whole screen apart from the HUD strip and the notch/home-indicator insets.
 */
export function computePond(w: number, h: number, ins: Insets, hud: number): Rect {
  const x = ins.l, y = ins.t + hud;
  const pw = Math.max(160, w - ins.l - ins.r);
  const ph = Math.max(140, h - y - ins.b);
  return { x, y, w: pw, h: ph, r: 0 };
}
