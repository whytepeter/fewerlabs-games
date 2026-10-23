import type { Song } from '../core/music';

/**
 * "Abyssal": slow, dark and wet. A warm pad and sub bass, sonar pings from a bell that echo
 * into a long reverb, a soft heartbeat instead of drums, and a whale-like whistle melody that
 * only surfaces once the dive gets deep. A minor, to sit with the ambient drone.
 */
export const DEEP_SONG: Song = {
  bpm: 66,
  root: 45, // A2
  scale: [0, 3, 5, 7, 10], // minor pentatonic
  // Am – Fmaj7 – Dm – Esus: drifting, never quite resolving
  progression: [[0, 7, 12, 15], [-4, 3, 7, 12], [5, 12, 17, 20], [7, 12, 14, 19]],
  bass:  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  arp:   [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0], // sonar pings
  kick:  [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], // heartbeat
  hat:   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  snare: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  lead:  [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  instruments: { pad: 'warm', bass: 'sine', arp: 'bell', lead: 'whistle' },
  drums: 'heartbeat',
  fx: { delay: 0.4, delayBeats: 1.5, feedback: 0.5, reverb: 0.55, reverbSecs: 3.6, lowpass: 2600 },
  leadOctave: 1,
  gain: 1.1,
};
