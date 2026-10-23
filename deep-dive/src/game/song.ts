import type { Song } from '../core/music';

/**
 * "Undertow": calm on top, tense underneath. Breathing pads that swell over slow two-bar chords,
 * a soft sub-bass pulse and marimba droplets that echo into a long reverb. As the dive deepens a
 * slow heartbeat joins, then a sparse glassy melody; past ~0.82 intensity the harmony slides into
 * darker chords (Bbmaj7, E7b9), the heartbeat doubles and the pulse quickens. The chord loop is a
 * minute long and the melody is reseeded every 16 bars, so it doesn't loop audibly.
 * A minor, to sit with the ambient drone.
 */
export const DEEP_SONG: Song = {
  bpm: 64,
  root: 57, // A3
  barsPerChord: 2,
  // Lead notes: E G A C D, centred around A4 so the melody never gets shrill.
  scale: [-5, -2, 0, 3, 5],
  // Am9 – Fmaj7 – Cmaj7 – G6 – Am9 – Fmaj9 – Dm7 – Esus4
  progression: [
    [0, 3, 7, 14], [-4, 3, 7, 12], [3, 7, 10, 14], [-2, 2, 7, 10],
    [0, 3, 7, 14], [-4, 3, 7, 10], [-7, 3, 8, 12], [-5, 0, 2, 7],
  ],
  bass:  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  arp:   [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0,
          1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  kick:  [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], // resting heartbeat
  hat:   [],
  snare: [],
  // A four-bar phrase with long rests between notes.
  lead:  [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  tense: {
    at: 0.82,
    // Am9 – Bbmaj7 – Fmaj7 – E7b9 – Am9 – Dm7 – Bbmaj7#11 – E7b9
    progression: [
      [0, 3, 7, 14], [1, 5, 8, 12], [-4, 3, 7, 12], [-5, 2, 5, 8],
      [0, 3, 7, 14], [-7, 3, 8, 12], [1, 5, 7, 12], [-5, 2, 5, 8],
    ],
    bass: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
    arp:  [1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0],
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], // heart rate doubles
  },
  layers: { bass: 0.2, arp: 0.28, drums: 0.55, lead: 0.7 },
  instruments: { pad: 'drift', bass: 'sub', arp: 'marimba', lead: 'glass' },
  drums: 'heartbeat',
  arpOctave: 0,
  bassLen: 5,
  leadOctave: 1,
  fx: { delay: 0.3, delayBeats: 0.75, feedback: 0.45, reverb: 0.6, reverbSecs: 4.5, lowpass: 3200 },
  gain: 1.05,
};
