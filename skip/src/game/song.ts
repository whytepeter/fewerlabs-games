import type { Song } from '../core/music';

/**
 * "Lakeside": a sunny, strummy skip song. C major, 118 bpm, I–V–vi–IV.
 * Strummed acoustic-guitar chords (pluck voice) in a down-down-up-up-down-up pattern,
 * a plucky bass, a pop kit (kick, clap, shaker) and a whistled tune, with a touch of reverb.
 * The skip plips (audio.ts) use the C major pentatonic, so they always land in key on top.
 */
export const SKIP_SONG: Song = {
  bpm: 118,
  root: 48, // C3
  scale: [0, 2, 4, 7, 9], // major pentatonic: the whistle can't hit a sour note
  // open guitar-style voicings: root, fifth, octave, third on top
  progression: [
    [0, 7, 12, 16],   // C
    [7, 14, 19, 23],  // G
    [9, 16, 21, 24],  // Am
    [5, 12, 17, 21],  // F
  ],
  // classic campfire strum: D . D U . U D U
  strum: [1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 0],
  bass: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
  arp: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  kick: [1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], // clap
  hat: [0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1],  // shaker
  lead: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0],
  instruments: { pad: 'pluck', bass: 'pluck', arp: 'pluck', lead: 'whistle' },
  drums: 'pop',
  fx: { reverb: 0.15, reverbSecs: 1.4, delay: 0.12, delayBeats: 0.75, feedback: 0.25, lowpass: 7000 },
  leadOctave: 2,
  swing: 0.08,
  gain: 0.95,
};

export const MUSIC = {
  calm: 0.35, // title and aiming: strummed guitar, bass, a few plucks
  throwBase: 0.5,
  /** Flight intensity from the Perfect streak: 0.5 at none, 1.0 by ×8 (drums at ×1, whistle at ×4). */
  flight: (streak: number) => 0.5 + Math.min(streak, 8) / 8 * 0.5,
  splash: 0.22,
};
