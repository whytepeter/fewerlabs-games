// The light and dark palettes live in CSS (style.css) so the DOM UI and the canvas share them.
// This reads them into numbers for Phaser and strings for canvas drawing, and re-reads on theme change.

export const KEYS = [
  'sky-top', 'sky-mid', 'sky-bot', 'sun', 'sun-glow', 'cloud', 'hill-far', 'hill-mid', 'trees', 'water-top', 'water-deep', 'shimmer', 'ripple',
  'stone', 'stone-hi', 'log', 'log-hi', 'pad', 'pad-hi', 'flower', 'duck', 'duck-head', 'beak', 'glass', 'glass-hi',
  'pier', 'pier-dark', 'ink', 'accent', 'perfect', 'good', 'bad', 'flame',
] as const;
export type PKey = (typeof KEYS)[number];

/** CSS colour strings, for canvas drawing. */
export const P = {} as Record<PKey, string>;
/** Packed 0xRRGGBB, for Phaser tints and Graphics. */
export const N = {} as Record<PKey, number>;
/** Alpha component (1 for opaque hex colours). */
export const A = {} as Record<PKey, number>;

function parse(c: string): [number, number] {
  const s = c.trim();
  if (s.startsWith('#')) {
    const h = s.length === 4 ? s.slice(1).split('').map(x => x + x).join('') : s.slice(1, 7);
    return [parseInt(h, 16), 1];
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const [r, g, b, a = '1'] = m[1].split(',').map(x => x.trim());
    return [(+r << 16) | (+g << 8) | +b, +a];
  }
  return [0x888888, 1];
}

export function readPalette() {
  const st = getComputedStyle(document.documentElement);
  for (const k of KEYS) {
    const v = st.getPropertyValue('--' + k).trim() || '#888888';
    P[k] = v;
    [N[k], A[k]] = parse(v);
  }
}

export const isDark = () => document.documentElement.dataset.theme === 'dark' ||
  (document.documentElement.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);

/** Calls `fn` after the palette has been re-read because the colour scheme changed. */
export function onTheme(fn: () => void) {
  const run = () => { readPalette(); fn(); };
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', run); } catch { /* old Safari */ }
  new MutationObserver(run).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

readPalette();
