import type { PKey } from './palette';
import type { LakeRules } from './sim';

/**
 * The lakes: each its own Golden Hour mood and its own twist on the throw, picked on the home
 * screen. The first is open; each next one opens when you skip far enough on the one before.
 * Ids are saved (the selected lake, and each lake's best), so never rename one.
 */
export type LakeId = 'sunset' | 'marsh' | 'frozen' | 'lagoon';

export interface Lake {
  id: LakeId;
  name: string;
  /** One line about its mood. */
  blurb: string;
  /** What plays differently here, for the home screen. */
  twist: string;
  /** Opens once the player's best on `lake` reaches `m` metres. */
  unlock?: { lake: LakeId; m: number };
  rules: LakeRules;
  /** Base mist and night tint over the scene (0..1). Sunset Lake instead deepens as you go (zones). */
  mist: number;
  night: number;
  /** Palette overrides on top of the theme's (light and dark), so each lake has its own light. */
  light: Partial<Record<PKey, string>>;
  dark: Partial<Record<PKey, string>>;
}

export const LAKES: Lake[] = [
  {
    id: 'sunset', name: 'Sunset Lake', blurb: 'Warm light, calm water.',
    twist: 'The classic lake. Go far and it turns misty, then moonlit.',
    rules: { log: 0.22, duck: 0.23, pad: 0.21, ice: 0, hoop: 0.14, drag: 1, fireflies: false },
    mist: 0, night: 0, light: {}, dark: {},
  },
  {
    id: 'marsh', name: 'Misty Marsh', blurb: 'Soft fog over sage-green water.',
    twist: 'Lily pads everywhere: chain the bounces. Ducks too.',
    unlock: { lake: 'sunset', m: 400 },
    rules: { log: 0.1, duck: 0.3, pad: 0.4, ice: 0, hoop: 0.1, drag: 1, fireflies: false },
    mist: 0.38, night: 0,
    light: {
      'sky-top': '#8fa8a0', 'sky-mid': '#d9c2a3', 'sky-bot': '#f3dcb5', 'sun-glow': 'rgba(255, 236, 196, .8)',
      'hill-far': '#9db5a2', 'hill-mid': '#7a9a86', trees: '#56786a', 'water-top': '#b7c9a8', 'water-deep': '#5f8077',
      cloud: 'rgba(250, 246, 236, .8)', pier: '#7a6a58', 'pier-dark': '#56786a',
    },
    dark: {
      'sky-top': '#1c2a2a', 'sky-mid': '#34483f', 'sky-bot': '#5e6b55', 'hill-far': '#2f4a40', 'hill-mid': '#243a33',
      trees: '#172821', 'water-top': '#3d5a4c', 'water-deep': '#0f1d19', cloud: 'rgba(120, 150, 130, .5)',
    },
  },
  {
    id: 'frozen', name: 'Frozen Pond', blurb: 'An icy pastel dawn.',
    twist: 'Ice floes: the stone slides across them and keeps its speed.',
    unlock: { lake: 'marsh', m: 500 },
    rules: { log: 0.32, duck: 0, pad: 0, ice: 0.2, hoop: 0.12, drag: 1.12, fireflies: false },
    mist: 0.12, night: 0,
    light: {
      'sky-top': '#9fb6e8', 'sky-mid': '#f2c6d6', 'sky-bot': '#fde7e1', sun: '#ffffff', 'sun-glow': 'rgba(255, 238, 245, .85)',
      'hill-far': '#c3cdf0', 'hill-mid': '#a6b2e2', trees: '#8794c8', 'water-top': '#cfe0f5', 'water-deep': '#8ea2d6',
      cloud: 'rgba(255, 255, 255, .85)', pier: '#8794c8', 'pier-dark': '#6e7bb0', log: '#8e9cc8', 'log-hi': '#b9c4ea',
    },
    dark: {
      'sky-top': '#141a3a', 'sky-mid': '#3a3f78', 'sky-bot': '#6b6aa6', 'hill-far': '#353f7a', 'hill-mid': '#262f63',
      trees: '#1a2150', 'water-top': '#40508e', 'water-deep': '#121738', cloud: 'rgba(150, 160, 220, .5)',
    },
  },
  {
    id: 'lagoon', name: 'Firefly Lagoon', blurb: 'A warm night full of fireflies.',
    twist: 'Fireflies drift up and down and count double. More hoops.',
    unlock: { lake: 'frozen', m: 600 },
    rules: { log: 0.22, duck: 0.24, pad: 0.18, ice: 0, hoop: 0.22, drag: 1, fireflies: true },
    mist: 0, night: 0.35,
    light: {
      'sky-top': '#241f52', 'sky-mid': '#5b3f86', 'sky-bot': '#c2789a', sun: '#fff4d6', 'sun-glow': 'rgba(255, 220, 160, .55)',
      'hill-far': '#4a3a7a', 'hill-mid': '#33285c', trees: '#211a42', 'water-top': '#5a4386', 'water-deep': '#17123a',
      cloud: 'rgba(140, 110, 190, .5)', glass: '#fff1a8', pier: '#4a3a7a', 'pier-dark': '#33285c',
    },
    dark: { glass: '#fff1a8' },
  },
];

export const lakeById = (id: string) => LAKES.find(l => l.id === id) ?? LAKES[0];
/** Where each lake's best is saved (Sunset Lake keeps the original key). */
export const lakeBestKey = (id: LakeId) => (id === 'sunset' ? 'best' : `best:${id}`);
