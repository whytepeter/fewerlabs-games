import type { Song } from '../core/music';

/**
 * "Bubble Run": bright and adventurous, in F Lydian (the raised B gives it a floaty, wide-eyed
 * colour). A bouncy triangle bass line and kalimba arpeggios over soft chords, with a short marimba
 * hook that surfaces twice every 16 bars and then gets out of the way. Deeper dives add energy rather
 * than darkness: brushed drums, glassy sparkles, a harp-like counter-melody that answers the hook,
 * and finally a busier groove. The A and E in most chords sit with the ambient drone.
 */
export const DEEP_SONG: Song = {
  bpm: 108,
  root: 53, // F3
  swing: 0.1,
  // Counter-melody notes: C D F G A, centred on F4.
  scale: [-5, -3, 0, 2, 4],
  // Fmaj7 – G – Am7 – G – Fmaj7 – G6 – Bbmaj7 – C
  progression: [
    [0, 4, 7, 11], [2, 6, 9, 14], [4, 7, 11, 14], [2, 6, 9, 14],
    [0, 4, 7, 11], [2, 6, 11, 14], [-7, 4, 9, 12], [-5, 2, 7, 11],
  ],
  // 1 = root, 2 = fifth, 3 = octave
  bass:  [1, 0, 0, 0, 0, 0, 2, 0, 1, 0, 0, 0, 3, 0, 2, 0],
  arp:   [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0],
  kick:  [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  hat:   [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  // Counter-melody rhythm (two bars), heard only between hooks.
  lead:  [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0],
  hook: {
    at: 0.3,
    cycle: 16,
    bars: [0, 8],
    // Over Fmaj7 then G: C F E C · A C | D B D E · G
    notes: [
      7, null, 12, null, 11, null, 7, null, null, null, 4, null, 7, null, null, null,
      9, null, null, 6, null, null, 9, null, 11, null, null, 14, null, null, null, null,
    ],
  },
  arp2: {
    at: 0.65,
    octave: 1,
    pattern: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0,
              0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  // Deepest water: the same chords, just more drive.
  tense: {
    at: 0.88,
    bass:  [1, 0, 0, 1, 0, 0, 2, 0, 1, 0, 3, 0, 0, 2, 0, 0],
    arp:   [1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 0],
    kick:  [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    hat:   [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
  },
  layers: { bass: 0.2, arp: 0.28, drums: 0.55, lead: 0.75 },
  instruments: { pad: 'triangle', bass: 'bounce', arp: 'kalimba', hook: 'marimba', lead: 'pluck', arp2: 'glass' },
  drums: 'brush',
  arpOctave: 0,
  bassLen: 1.5,
  leadOctave: 1,
  fx: { delay: 0.22, delayBeats: 0.75, feedback: 0.3, reverb: 0.35, reverbSecs: 2.6, lowpass: 6000 },
  gain: 1,
};
