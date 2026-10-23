import type { Song } from '../../../core/music';

/**
 * "Skip Song": breezy C major, 112 bpm, I–V–vi–IV. A plucky triangle arp like a ukulele,
 * warm pad, light kick and offbeat hats, a sunny lead. The skip plips (audio.ts) use the
 * C major pentatonic, so they always land in key on top of it.
 */
export const SKIP_SONG: Song = {
  bpm: 112,
  root: 48, // C3
  scale: [0, 2, 4, 7, 9], // major pentatonic: the lead can't hit a sour note
  progression: [
    [0, 4, 7, 12],   // C
    [7, 11, 14, 19], // G
    [9, 12, 16, 21], // Am
    [5, 9, 12, 17],  // F
  ],
  bass: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0],
  arp: [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0],
  kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0],
  hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1],
  snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  lead: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0],
  sounds: { pad: 'sine', arp: 'triangle', lead: 'triangle', arpTone: 2600 },
  swing: 0.14,
  gain: 0.9,
};

export const MUSIC = {
  calm: 0.35, // title and aiming: pad, bass, arp
  throwBase: 0.5,
  /** Flight intensity from the Perfect streak: 0.5 at none, 1.0 by ×8 (drums at ×1, lead at ×4). */
  flight: (streak: number) => 0.5 + Math.min(streak, 8) / 8 * 0.5,
  splash: 0.22,
};
