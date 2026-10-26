// The palette lives in CSS custom properties on :root (light and dark sets, chosen by
// prefers-color-scheme or a data-theme override). The game reads them so art and UI always match.

const KEYS = [
  'water-in', 'water-out', 'shimmer', 'ripple', 'shore', 'shore-dark', 'reed', 'pad', 'pad-hi',
  'rock', 'rock-hi', 'boat', 'boat-fold', 'mote', 'c1', 'c2', 'c3', 'ink', 'accent',
] as const;
export type PaletteKey = (typeof KEYS)[number];

/** Raw CSS colour strings, usable directly with the 2D canvas API. */
export const P = {} as Record<PaletteKey, string>;
/** Parsed colours for Phaser: `n` is 0xRRGGBB, `a` is the colour's own alpha. */
export const C = {} as Record<PaletteKey, { n: number; a: number }>;

export const laneKey = (ci: number) => (['c1', 'c2', 'c3'] as const)[ci] ?? 'c1';
export const LANE_NAMES = ['Amber', 'Rose', 'Violet'];
/** Cartoon outline colour shared with the UI kit (--k-outline). */
export const OUTLINE = '#16233b';
export const OUTLINE_N = 0x16233b;

function parse(s: string): { n: number; a: number } {
  s = s.trim();
  if (s.startsWith('#')) {
    let h = s.slice(1);
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    return { n: parseInt(h.slice(0, 6), 16), a: h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1 };
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const [r, g, b, a] = m[1].split(',').map(v => parseFloat(v));
    return { n: (r << 16) | (g << 8) | b, a: a === undefined || Number.isNaN(a) ? 1 : a };
  }
  return { n: 0x888888, a: 1 };
}

let sig = '';
export function readPalette() {
  const s = getComputedStyle(document.documentElement);
  for (const k of KEYS) {
    P[k] = s.getPropertyValue('--' + k).trim() || '#888888';
    C[k] = parse(P[k]);
  }
  const next = KEYS.map(k => P[k]).join('|');
  const changed = next !== sig;
  sig = next;
  return changed;
}
readPalette();

export const isDark = () => (C.ink.n & 0xff) > 0x80; // light ink means a dark theme

const listeners: (() => void)[] = [];
export function onTheme(fn: () => void) {
  listeners.push(fn);
  return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
}
const check = () => { if (readPalette()) listeners.forEach(fn => fn()); };
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', check); } catch { /* old Safari */ }
new MutationObserver(check).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-pond'] });
