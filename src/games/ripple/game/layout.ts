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

/** Space the HUD needs above the pond: score + lives row. Short (landscape phone) screens use a compact HUD. */
export const hudHeight = (h: number) => (h < 500 ? 58 : 74);

const MARGIN = 14;
// On big desktop windows the pond stops growing so trips stay phone-sized; the shore fills the rest.
const MAX_W = 880, MAX_H = 780;

export function computePond(w: number, h: number, ins: Insets): Rect {
  let x = ins.l + MARGIN, y = ins.t + hudHeight(h);
  let pw = w - ins.l - ins.r - MARGIN * 2;
  let ph = h - y - ins.b - MARGIN;
  if (pw > MAX_W) { x += (pw - MAX_W) / 2; pw = MAX_W; }
  if (ph > MAX_H) { y += (ph - MAX_H) / 2; ph = MAX_H; }
  pw = Math.max(160, pw);
  ph = Math.max(140, ph);
  return { x, y, w: pw, h: ph, r: Math.min(60, pw * 0.12, ph * 0.2) };
}
