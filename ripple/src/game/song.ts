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

/** "Koi Garden": an unhurried pentatonic stroll in D, a plucked koto-ish arp and a bell tune. */
export const KOI_SONG: Song = {
  ...RIPPLE_SONG,
  bpm: 84,
  root: 50, // D3
  scale: [0, 2, 4, 7, 9],
  progression: [[-3, 0, 4], [-7, -3, 0], [0, 4, 7], [-5, -1, 2]],
  arp:   [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
  lead:  [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  instruments: { pad: 'warm', bass: 'sine', arp: 'pluck', lead: 'bell' },
  fx: { delay: 0.3, delayBeats: 0.75, feedback: 0.35, reverb: 0.32, reverbSecs: 2.4, lowpass: 5200 },
  swing: 0.08,
};

/** "Rainy Marsh": a slow, misty E minor pentatonic with a whistled tune and soft drums. */
export const MARSH_SONG: Song = {
  ...RIPPLE_SONG,
  bpm: 76,
  root: 52, // E3
  scale: [0, 3, 5, 7, 10],
  progression: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]],
  arp:   [1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
  lead:  [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0],
  instruments: { pad: 'warm', bass: 'sine', arp: 'marimba', lead: 'whistle' },
  drums: 'soft',
  fx: { delay: 0.22, delayBeats: 0.75, feedback: 0.3, reverb: 0.4, reverbSecs: 2.8, lowpass: 4200 },
  swing: 0.1,
};

/** "Frozen Lake": a twinkly music box in A, bells over kalimba, no drums. */
export const FROST_SONG: Song = {
  ...RIPPLE_SONG,
  bpm: 100,
  root: 57, // A3
  scale: [0, 2, 4, 7, 9],
  progression: [[0, 4, 7], [4, 7, 11], [5, 9, 12], [2, 5, 9]],
  arp:   [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1],
  lead:  [1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
  instruments: { pad: 'warm', bass: 'sine', arp: 'bell', lead: 'kalimba' },
  drums: 'none',
  fx: { delay: 0.3, delayBeats: 0.5, feedback: 0.38, reverb: 0.45, reverbSecs: 3, lowpass: 7500 },
  swing: 0,
  gain: 0.7,
};
