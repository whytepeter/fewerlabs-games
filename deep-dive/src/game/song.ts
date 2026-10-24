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

/**
 * "Kelp Drift": the Kelp Forest's version of Bubble Run, soft and swaying. A step higher in G and a
 * little slower, with a lilting swing, slow-swelling pads, a kalimba hook over marimba arpeggios,
 * a lazy echo, and the brushes only drifting in further down.
 */
export const KELP_SONG: Song = {
  ...DEEP_SONG,
  bpm: 100,
  root: 55, // G3
  swing: 0.2,
  // Gmaj7 – Am7 – Bm7 – Am7 – Gmaj7 – C – Em7 – D
  progression: [
    [0, 4, 7, 11], [2, 5, 9, 12], [4, 7, 11, 14], [2, 5, 9, 12],
    [0, 4, 7, 11], [-7, 4, 9, 12], [-3, 4, 7, 11], [-5, 2, 7, 9],
  ],
  arp:   [1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
  hat:   [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0],
  hook: {
    at: 0.3,
    cycle: 16,
    bars: [0, 8],
    // Over Gmaj7 then Am7: D G F# D · B D | E C E G · E
    notes: [
      7, null, 12, null, 11, null, 7, null, null, null, 4, null, 7, null, null, null,
      9, null, null, 5, null, null, 9, null, 12, null, null, 14, null, null, 9, null,
    ],
  },
  layers: { bass: 0.2, arp: 0.28, drums: 0.62, lead: 0.72 },
  instruments: { pad: 'warm', bass: 'sub', arp: 'marimba', hook: 'kalimba', lead: 'pluck', arp2: 'glass' },
  fx: { delay: 0.3, delayBeats: 1, feedback: 0.34, reverb: 0.38, reverbSecs: 3, lowpass: 5200 },
};

/**
 * "Frost Glide": the Frozen Trench's version. Down to E, a little slower and airier, with glassy
 * music-box arpeggios, a bell hook and lighter drums, so it sparkles like ice instead of bouncing.
 */
export const FROST_SONG: Song = {
  ...DEEP_SONG,
  bpm: 100,
  root: 52, // E3
  swing: 0.06,
  // Emaj7 – F#6 – G#m7 – F# – Emaj7 – C#m7 – Amaj7 – B
  progression: [
    [0, 4, 7, 11], [2, 6, 9, 14], [4, 7, 11, 14], [2, 6, 9, 14],
    [0, 4, 7, 11], [-3, 4, 7, 9], [-7, 4, 9, 12], [-5, 2, 7, 11],
  ],
  arp:   [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0],
  hook: {
    at: 0.3,
    cycle: 16,
    bars: [0, 8],
    // Over Emaj7 then F#6: B E D# B · G# B | C# A# C# D# · F#
    notes: [
      7, null, 12, null, 11, null, 7, null, null, null, 4, null, 7, null, null, null,
      9, null, null, 6, null, null, 9, null, 11, null, null, null, 14, null, null, null,
    ],
  },
  layers: { bass: 0.18, arp: 0.25, drums: 0.6, lead: 0.78 },
  instruments: { pad: 'triangle', bass: 'sub', arp: 'glass', hook: 'bell', lead: 'kalimba', arp2: 'kalimba' },
  fx: { delay: 0.28, delayBeats: 0.75, feedback: 0.36, reverb: 0.45, reverbSecs: 3.4, lowpass: 7000 },
};

/**
 * "Sunken Shanty": the Pirate Shipwreck's tune. A swung jig in D minor: an oom-pah bass, strummed
 * chords on the off-beats, a tin-whistle hook that sounds like an old sea song, plucked mandolin
 * arpeggios, and a dry little room so it feels like it's played below deck.
 */
export const PIRATE_SONG: Song = {
  bpm: 116,
  root: 50, // D3
  swing: 0.24,
  // Lead notes: D minor pentatonic, A C D F G.
  scale: [-5, -2, 0, 3, 5],
  // Dm – C6 – Dm – Am – F6 – C – Dm – A7
  progression: [
    [0, 3, 7, 10], [-2, 2, 5, 7], [0, 3, 7, 12], [-5, 2, 7, 10],
    [3, 7, 10, 12], [-2, 2, 5, 10], [0, 3, 7, 10], [-5, -1, 2, 5],
  ],
  strum: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  bass:  [1, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0],
  arp:   [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
  kick:  [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  hat:   [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
  snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  lead:  [1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0,
          1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  hook: {
    at: 0.3,
    cycle: 16,
    bars: [0, 8],
    // Over Dm then C6: A A D' C' A F D | E G C' · G E C
    notes: [
      7, null, 7, null, 12, null, 10, null, 7, null, 3, null, 0, null, null, null,
      2, null, 5, null, 10, null, null, null, 7, null, 5, null, 2, null, null, null,
    ],
  },
  arp2: {
    at: 0.7,
    octave: 2,
    pattern: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0,
              0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  tense: {
    at: 0.88,
    bass:  [1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0, 3, 0, 2, 0],
    arp:   [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1],
    kick:  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
  },
  layers: { bass: 0.2, arp: 0.35, drums: 0.5, lead: 0.75 },
  instruments: { pad: 'pluck', bass: 'bounce', arp: 'pluck', hook: 'whistle', lead: 'marimba', arp2: 'bell' },
  drums: 'soft',
  arpOctave: 1,
  bassLen: 2.5,
  leadOctave: 1,
  fx: { delay: 0.12, delayBeats: 0.5, feedback: 0.2, reverb: 0.22, reverbSecs: 1.4, lowpass: 5200 },
  gain: 0.95,
};

/**
 * "Ballroom Below": the Titanic Wreck's tune. Slow and haunting in A minor: dark breathing pads,
 * a music-box arpeggio in threes against the beat (like a waltz heard through a wall), a bell melody,
 * a slow heartbeat, and a long echo that keeps going down empty corridors.
 */
export const LINER_SONG: Song = {
  bpm: 72,
  root: 57, // A3
  swing: 0,
  // Lead notes: A natural minor, A B C E F.
  scale: [0, 2, 3, 7, 8],
  // Am(add9) – Fmaj7 – Dm7 – E7 – Am – Cmaj7 – Fmaj7 – E7
  progression: [
    [0, 3, 7, 14], [-4, 0, 3, 7], [-7, -4, 0, 3], [-5, -1, 2, 5],
    [0, 3, 7, 12], [3, 7, 10, 14], [-4, 0, 3, 7], [-5, -1, 2, 5],
  ],
  bass:  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  arp:   [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0],
  kick:  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  hat:   [0],
  snare: [0],
  lead:  [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  hook: {
    at: 0.3,
    cycle: 16,
    bars: [0, 8],
    // Over Am then Fmaj7: E · · A' · G · E | F · · E · C
    notes: [
      7, null, null, null, null, null, 12, null, null, null, 10, null, null, null, 7, null,
      8, null, null, null, null, null, 7, null, null, null, 3, null, null, null, null, null,
    ],
  },
  arp2: {
    at: 0.7,
    octave: 2,
    pattern: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  tense: {
    at: 0.9,
    arp:   [1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0],
    kick:  [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  },
  layers: { bass: 0.2, arp: 0.3, drums: 0.6, lead: 0.78 },
  instruments: { pad: 'drift', bass: 'sub', arp: 'glass', hook: 'bell', lead: 'glass', arp2: 'bell' },
  drums: 'heartbeat',
  arpOctave: 1,
  bassLen: 14,
  leadOctave: 1,
  fx: { delay: 0.34, delayBeats: 1.5, feedback: 0.45, reverb: 0.6, reverbSecs: 5, lowpass: 3600 },
  gain: 1.1,
};
