import type { Song } from '../../../core/music';

/**
 * "Lily Pond": a cozy F-major loop at 92 bpm with a little swing. Pluck-like arp (filtered
 * triangle), soft sine pad, light brushed hats, and a hummable lead once the run heats up.
 * I – vi – IV – V  (F – Dm – Bb – C).
 */
export const RIPPLE_SONG: Song = {
  bpm: 92,
  root: 53, // F3
  scale: [0, 2, 4, 7, 9], // major pentatonic: always sweet
  progression: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]],
  bass:  [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0],
  arp:   [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0],
  kick:  [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  hat:   [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0],
  snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  lead:  [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0],
  sounds: { pad: 'sine', arp: 'triangle', lead: 'triangle', arpTone: 2600 },
  swing: 0.16,
  gain: 0.8, // keep the pond's sound effects on top
};

/** Music intensity: calm on the title, building with boats docked, gentle after game over. */
export const MUSIC = {
  title: 0.38,
  over: 0.25,
  forRun: (docked: number) => Math.min(1, 0.45 + docked / 15 * 0.55),
};
