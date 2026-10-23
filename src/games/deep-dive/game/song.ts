import type { Song } from '../../../core/music';

/** Dreamy A-minor loop (Am F C G), in the same key as the ambient drone. Builds with depth. */
export const DEEP_SONG: Song = {
  bpm: 86,
  root: 57, // A3
  scale: [0, 3, 5, 7, 10], // minor pentatonic
  progression: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]],
  bass:  [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  arp:   [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
  kick:  [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
  hat:   [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1],
  snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  lead:  [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0],
  sounds: { pad: 'sine', arp: 'triangle', arpTone: 2200, lead: 'sine' },
  swing: 0.12,
};
