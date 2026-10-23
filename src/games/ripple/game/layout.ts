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
 * World zoom (CSS px per world unit). The pond is viewed closer than 1:1 on phones
 * (~1.17x portrait, ~1.22x landscape) so boats, docks and ripples read big under a thumb.
 * Tablets and desktops grow a little more but stop at 1.5x (~1.3x the phone view), so a big
 * window shows a comfortably sized pond rather than an oversized one.
 */
export const MAX_WORLD_SCALE = 1.5;
export function worldScale(w: number, h: number) {
  return Math.max(1, Math.min(MAX_WORLD_SCALE, Math.min(Math.min(w, h) / 320, Math.max(w, h) / 680)));
}

const MARGIN = 10;
// On big desktop windows the pond stops growing so trips stay phone-sized; the shore fills the rest.
const MAX_W = 880, MAX_H = 780;

/** Pond rect in world units for a world of w x h, given insets and HUD height already in world units. */
export function computePond(w: number, h: number, ins: Insets, hud: number): Rect {
  let x = ins.l + MARGIN, y = ins.t + hud;
  let pw = w - ins.l - ins.r - MARGIN * 2;
  let ph = h - y - ins.b - MARGIN;
  if (pw > MAX_W) { x += (pw - MAX_W) / 2; pw = MAX_W; }
  if (ph > MAX_H) { y += (ph - MAX_H) / 2; ph = MAX_H; }
  pw = Math.max(160, pw);
  ph = Math.max(140, ph);
  return { x, y, w: pw, h: ph, r: Math.min(60, pw * 0.12, ph * 0.2) };
}
