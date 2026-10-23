import type { Song } from '../core/music';

/**
 * "Lily Pond": a cozy, sunny loop in G major at 92 bpm with a gentle swing.
 *   pad   warm, held chords (soft and round, never strummed)
 *   bass  sine, light roots
 *   arp   kalimba, rippling up and down the chord like drops on water
 *   lead  marimba, a hummable pentatonic tune once a run warms up
 *   drums brush kit, soft and sparse
 *   fx    dotted-eighth echo and a short pond-side reverb
 * Chords: I – vi – IV – V7, a classic warm, wistful cycle (G – Em – C – D7).
 */
export const RIPPLE_SONG: Song = {
  bpm: 92,
  root: 55, // G3
  scale: [0, 2, 4, 7, 9], // major pentatonic: always sweet
  progression: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2, 5]],
  bass:  [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  arp:   [1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1],
  kick:  [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  hat:   [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1],
  snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  lead:  [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0],
  instruments: { pad: 'warm', bass: 'sine', arp: 'kalimba', lead: 'marimba' },
  drums: 'brush',
  fx: { delay: 0.25, delayBeats: 0.75, feedback: 0.32, reverb: 0.25, reverbSecs: 1.8, lowpass: 6500 },
  leadOctave: 1,
  swing: 0.14,
  gain: 0.8, // keep the pond's sound effects on top
};

/** Music intensity: calm on the title, building with boats docked, gentle after game over. */
export const MUSIC = {
  title: 0.38,
  over: 0.25,
  forRun: (docked: number) => Math.min(1, 0.45 + docked / 15 * 0.55),
};
