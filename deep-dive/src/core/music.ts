import { onSettings } from './settings';
import { sfx } from './sfx';

/**
 * Generated background music: a small step sequencer on the shared AudioContext, so there are
 * no audio files. A game defines a Song (key, tempo, chord loop, patterns, instruments, effects)
 * and calls music.play(song). Layers fade in with intensity (0..1):
 *   pad always · bass ≥ 0.2 · arp ≥ 0.35 · drums ≥ 0.55 · lead ≥ 0.7
 * (a song can move these with `layers`, and swap in darker parts above `tense.at`).
 * Patterns are usually 16 steps (one bar) but may be any length, e.g. a 64-step lead phrase.
 * The Music setting mutes it; pausing the game (sfx.suspend) pauses it with the rest of the audio.
 */

/** Instrument voices. Plain oscillator types still work. */
export type Voice =
  | OscillatorType
  | 'pluck'    // filtered saw with a quick filter sweep: guitar / harp-ish
  | 'kalimba'  // sine + bright overtone, fast decay
  | 'marimba'  // woody sine with a soft 4th-harmonic knock
  | 'bell'     // FM bell with a long tail: sonar pings, music boxes
  | 'warm'     // two detuned saws through a soft lowpass: big slow pads
  | 'whistle'  // sine with gentle vibrato
  | 'drift'    // dark detuned saws whose filter swells and opens with intensity: breathing pads
  | 'glass'    // soft sine with a faint octave and a long tail: droplets, music-box notes
  | 'sub'      // rounded sine bass with an octave-down sub, soft attack
  | 'bounce';  // short round triangle bass with a little pitch blip: playful, bubbly

export type DrumKit = 'none' | 'soft' | 'brush' | 'pop' | 'heartbeat';

export interface Song {
  bpm: number;
  /** MIDI note of the key centre, e.g. 57 = A3. */
  root: number;
  /** Scale degrees (semitones) the lead melody picks from. */
  scale: number[];
  /** One chord per bar, as semitone offsets from root (e.g. [0, 3, 7] = minor triad). */
  progression: number[][];
  /** 16-step patterns, 1 = hit. */
  bass: number[];
  arp: number[];
  kick: number[];
  hat: number[];
  snare: number[];
  /** Lead rhythm: 1 = note, 0 = rest. Pitches are a seeded walk over `scale`. */
  lead: number[];
  /** Optional strum pattern: when set, the pad is strummed on these steps instead of held. */
  strum?: number[];
  instruments?: { pad?: Voice; bass?: Voice; arp?: Voice; lead?: Voice; hook?: Voice; arp2?: Voice };
  /** Older form, kept for compatibility. */
  sounds?: { pad?: OscillatorType; arp?: OscillatorType; lead?: OscillatorType; arpTone?: number };
  drums?: DrumKit;
  fx?: {
    /** Echo: wet level 0..1, time in beats (0.75 = dotted eighth), feedback 0..0.8. */
    delay?: number; delayBeats?: number; feedback?: number;
    /** Reverb wet level 0..1 and tail length in seconds. */
    reverb?: number; reverbSecs?: number;
    /** Master lowpass cutoff, Hz (darker = lower). */
    lowpass?: number;
  };
  /** Octave shift for the lead (default +1). */
  leadOctave?: number;
  /** 0..0.5, delays every other 16th for a swung feel. */
  swing?: number;
  /** Overall level, default 1. */
  gain?: number;
  /** Bars each chord lasts (default 1). */
  barsPerChord?: number;
  /** Octave shifts for the arp (default +1) and bass (default -1). */
  arpOctave?: number;
  bassOctave?: number;
  /** Bass note length in 16th steps (default 1.8). Bass steps: 1 = chord root, 2 = fifth, 3 = octave. */
  bassLen?: number;
  /** Intensity at which each layer comes in (defaults in the header). */
  layers?: { bass?: number; arp?: number; drums?: number; lead?: number };
  /** Alternate (darker or busier) parts used once intensity reaches `at`. Chords switch only on a chord change. */
  tense?: {
    at: number; progression?: number[][]; bass?: number[]; arp?: number[];
    kick?: number[]; hat?: number[]; snare?: number[];
  };
  /**
   * A written melody: one entry per 16th, semitones above the lead octave, null = rest. It plays
   * from each bar in `bars` (counted modulo `cycle`), and the seeded lead only plays between hooks.
   */
  hook?: { notes: (number | null)[]; bars: number[]; cycle: number; at: number };
  /** A second arpeggio layer, e.g. high sparkles that join at higher intensity. */
  arp2?: { pattern: number[]; at: number; octave?: number };
}

const BUS_VOLUME = 0.32;
const LOOKAHEAD = 0.15;

let ctx: AudioContext | null = null;
let out: GainNode | null = null;     // master music level (Music setting, fades)
let dry: GainNode | null = null;     // everything plays into this
let tone: BiquadFilterNode | null = null;
let delay: DelayNode | null = null, delayWet: GainNode | null = null, delayFb: GainNode | null = null;
let verb: ConvolverNode | null = null, verbWet: GainNode | null = null;
let noise: AudioBuffer | null = null;
let enabled = true;
let song: Song | null = null;
let intensity = 0.4;
let step = 0;
let nextTime = 0;
let timer = 0;
let leadNote = 0;
let chord: number[] = [0];
let stopTimer = 0;
let stopping = false;
let beatStep = 0, beatTime = 0; // the last step scheduled and when it plays, for music.beat()

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
/** Pattern lookup that works for any pattern length. */
const at = (p: number[] | undefined, n: number) => (p && p.length ? p[n % p.length] : 0);
/** Integer hash to 0..1, for the lead's seeded walk. */
function hash01(x: number) {
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

onSettings(s => {
  enabled = s.music;
  if (ctx && out) out.gain.setTargetAtTime(enabled ? BUS_VOLUME * (song?.gain ?? 1) : 0, ctx.currentTime, 0.4);
});

sfx.onUnlock(ac => {
  ctx = ac;
  out = ac.createGain();
  out.gain.value = 0;
  out.connect(ac.destination);
  tone = ac.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 5200;
  tone.connect(out);
  dry = ac.createGain();
  dry.connect(tone);
  // Echo send
  delay = ac.createDelay(2);
  delayFb = ac.createGain();
  delayWet = ac.createGain();
  delayWet.gain.value = 0;
  const delayTone = ac.createBiquadFilter();
  delayTone.type = 'lowpass';
  delayTone.frequency.value = 2600;
  dry.connect(delay);
  delay.connect(delayTone).connect(delayFb).connect(delay);
  delayTone.connect(delayWet).connect(tone);
  // Reverb send
  verb = ac.createConvolver();
  verbWet = ac.createGain();
  verbWet.gain.value = 0;
  dry.connect(verb);
  verb.connect(verbWet).connect(tone);
  noise = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  if (song) start();
});

/** A simple generated room: decaying stereo noise. */
function impulse(ac: AudioContext, secs: number) {
  const len = Math.max(1, Math.floor(ac.sampleRate * secs));
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  return buf;
}

function applyFx(sg: Song) {
  if (!ctx || !tone || !delay || !delayWet || !delayFb || !verb || !verbWet) return;
  const fx = sg.fx ?? {}, t = ctx.currentTime;
  tone.frequency.setTargetAtTime(fx.lowpass ?? 5200, t, 0.2);
  delay.delayTime.setValueAtTime((60 / sg.bpm) * (fx.delayBeats ?? 0.75), t);
  delayFb.gain.setValueAtTime(Math.min(0.8, fx.feedback ?? 0.35), t);
  delayWet.gain.setTargetAtTime(fx.delay ?? 0, t, 0.2);
  verb.buffer = impulse(ctx, fx.reverbSecs ?? 2.2);
  verbWet.gain.setTargetAtTime(fx.reverb ?? 0, t, 0.2);
}

function start() {
  if (!ctx || !out || !song) return;
  applyFx(song);
  out.gain.cancelScheduledValues(ctx.currentTime);
  out.gain.setTargetAtTime(enabled ? BUS_VOLUME * (song.gain ?? 1) : 0, ctx.currentTime, 0.8);
  step = 0;
  leadNote = 0;
  nextTime = ctx.currentTime + 0.1;
  beatStep = 0; beatTime = nextTime;
  clearInterval(timer);
  timer = window.setInterval(tick, 25);
}

function tick() {
  if (!ctx || !song) return;
  if (ctx.state !== 'running') return;
  // After a long pause (tab hidden), skip ahead instead of firing a burst of stale notes.
  if (nextTime < ctx.currentTime - 0.2) nextTime = ctx.currentTime + 0.05;
  const s16 = 60 / song.bpm / 4;
  while (nextTime < ctx.currentTime + LOOKAHEAD) {
    const swing = step % 2 ? (song.swing ?? 0) * s16 : 0;
    playStep(song, step, nextTime + swing, s16);
    beatStep = step; beatTime = nextTime;
    nextTime += s16;
    step++;
  }
}

function playStep(sg: Song, n: number, t: number, s16: number) {
  const i = n % 16, bar = Math.floor(n / 16), bpc = sg.barsPerChord ?? 1;
  const tense = sg.tense && intensity >= sg.tense.at ? sg.tense : null;
  const chordStart = i === 0 && bar % bpc === 0;
  // Pick the chord only when it changes, so crossing the tense threshold never clashes mid-chord.
  if (chordStart) {
    const prog = tense?.progression ?? sg.progression;
    chord = prog[Math.floor(bar / bpc) % prog.length];
  }
  const root = sg.root;
  const lv = { bass: 0.2, arp: 0.35, drums: 0.55, lead: 0.7, ...sg.layers };
  const inst = {
    pad: sg.instruments?.pad ?? sg.sounds?.pad ?? 'triangle',
    bass: sg.instruments?.bass ?? 'sine',
    arp: sg.instruments?.arp ?? sg.sounds?.arp ?? 'square',
    lead: sg.instruments?.lead ?? sg.sounds?.lead ?? 'triangle',
    hook: sg.instruments?.hook ?? 'marimba',
    arp2: sg.instruments?.arp2 ?? 'glass',
  };
  const leadBase = root + 12 * (sg.leadOctave ?? 1);

  // Pad: held chord each bar, or strummed on the strum pattern.
  if (sg.strum) {
    if (at(sg.strum, n)) chord.forEach((c, k) => voice(inst.pad, midiHz(root + c), t + k * 0.022, s16 * 3, 0.05));
  } else if (chordStart) {
    for (const c of chord) voice(inst.pad, midiHz(root + c), t, s16 * 16 * bpc, 0.045, { pad: true });
  }
  const b = intensity >= lv.bass ? at(tense?.bass ?? sg.bass, n) : 0;
  if (b) {
    const up = b === 2 ? 7 : b === 3 ? 12 : 0;
    voice(inst.bass, midiHz(root + 12 * (sg.bassOctave ?? -1) + chord[0] + up), t, s16 * (sg.bassLen ?? 1.8), 0.16);
  }
  if (intensity >= lv.arp && at(tense?.arp ?? sg.arp, n)) {
    const c = chord[(n >> 1) % chord.length] + (((n >> 3) & 1) ? 12 : 0);
    voice(inst.arp, midiHz(root + 12 * (sg.arpOctave ?? 1) + c), t, s16 * 1.4, 0.04, { cutoff: sg.sounds?.arpTone });
  }
  if (sg.arp2 && intensity >= sg.arp2.at && at(sg.arp2.pattern, n)) {
    const c = chord[((n >> 1) + 2) % chord.length];
    voice(inst.arp2, midiHz(root + 12 * (sg.arp2.octave ?? 1) + c), t, s16 * 1.4, 0.03);
  }
  if (intensity >= lv.drums) drums(sg.drums ?? 'soft', sg, n, t, tense?.kick, tense?.hat, tense?.snare);
  // Hook: find where we are inside a hook pass, if any.
  let hookPos = -1;
  if (sg.hook) {
    const cb = bar % sg.hook.cycle;
    for (const s of sg.hook.bars) {
      const p = (cb - s) * 16 + i;
      if (p >= 0 && p < sg.hook.notes.length) hookPos = p;
    }
    const note = hookPos >= 0 ? sg.hook.notes[hookPos] : null;
    if (note != null && intensity >= sg.hook.at) voice(inst.hook, midiHz(leadBase + note), t, s16 * 1.9, 0.06);
  }
  // The walk restarts each 8-bar phrase: a phrase plays twice, then the next 16 bars get a new one.
  if (i === 0 && bar % 8 === 0) leadNote = Math.floor(sg.scale.length / 2);
  if (intensity >= lv.lead && hookPos < 0 && at(sg.lead, n)) {
    const r = hash01((bar % 8) * 16 + i + Math.floor(bar / 16) * 7919);
    leadNote = Math.max(0, Math.min(sg.scale.length * 2 - 1, leadNote + (r < 0.4 ? -1 : r < 0.75 ? 1 : r < 0.88 ? 2 : -2)));
    const deg = sg.scale[leadNote % sg.scale.length] + 12 * Math.floor(leadNote / sg.scale.length);
    voice(inst.lead, midiHz(leadBase + deg), t, s16 * 1.9, 0.06);
  }
}

function drums(kit: DrumKit, sg: Song, n: number, t: number, kickPat = sg.kick, hatPat = sg.hat, snarePat = sg.snare) {
  if (kit === 'none') return;
  if (kit === 'heartbeat') {
    // Two soft low thumps, like a slow heartbeat.
    if (at(kickPat, n)) { kick(t, 0.18, 70); kick(t + 0.16, 0.12, 62); }
    return;
  }
  if (at(kickPat, n)) kick(t, kit === 'brush' ? 0.18 : 0.3, kit === 'pop' ? 150 : 130);
  if (at(hatPat, n)) {
    if (kit === 'brush') hit(t, 0.09, 3200, 0.035);       // swishy brush
    else if (kit === 'pop') hit(t, 0.05, 9000, 0.05);     // bright shaker
    else hit(t, 0.03, 8000, 0.05);
  }
  if (at(snarePat, n)) {
    if (kit === 'brush') hit(t, 0.2, 1400, 0.06);
    else if (kit === 'pop') { for (let k = 0; k < 3; k++) hit(t + k * 0.011, 0.07, 1500, 0.07); } // clap
    else hit(t, 0.12, 1800, 0.09);
  }
}

interface VoiceOpts { pad?: boolean; cutoff?: number }

function voice(v: Voice, freq: number, t: number, dur: number, vol: number, o: VoiceOpts = {}) {
  if (!ctx || !dry) return;
  switch (v) {
    case 'pluck': {
      const osc = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      osc.type = 'sawtooth'; osc.frequency.value = freq;
      f.type = 'lowpass'; f.Q.value = 2;
      f.frequency.setValueAtTime(Math.min(7000, freq * 8), t);
      f.frequency.exponentialRampToValueAtTime(Math.max(300, freq * 1.2), t + 0.25);
      env(g, t, 0.004, vol * 1.3, 0.55);
      osc.connect(f).connect(g).connect(dry);
      osc.start(t); osc.stop(t + 0.6);
      return;
    }
    case 'kalimba':
      partial(freq, 'sine', t, vol * 1.4, 0.002, 0.9);
      partial(freq * 5.95, 'sine', t, vol * 0.35, 0.001, 0.12);
      return;
    case 'marimba':
      partial(freq, 'sine', t, vol * 1.5, 0.003, 0.5);
      partial(freq * 4, 'sine', t, vol * 0.3, 0.002, 0.08);
      return;
    case 'bell': {
      const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
      car.frequency.value = freq; mod.frequency.value = freq * 3.5;
      mg.gain.setValueAtTime(freq * 2.2, t);
      mg.gain.exponentialRampToValueAtTime(freq * 0.05, t + 1.4);
      mod.connect(mg).connect(car.frequency);
      env(g, t, 0.004, vol * 1.2, 2.2);
      car.connect(g).connect(dry);
      car.start(t); mod.start(t); car.stop(t + 2.3); mod.stop(t + 2.3);
      return;
    }
    case 'warm': {
      const g = ctx.createGain(), f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = Math.min(1600, freq * 4);
      const a = o.pad ? 1.2 : 0.05, end = t + dur + (o.pad ? 1.2 : 0.3);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * 0.7, t + a);
      g.gain.setValueAtTime(vol * 0.7, Math.max(t + a, t + dur * 0.7));
      g.gain.exponentialRampToValueAtTime(0.0001, end);
      for (const det of [-7, 7]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth'; osc.frequency.value = freq; osc.detune.value = det;
        osc.connect(f);
        osc.start(t); osc.stop(end + 0.05);
      }
      f.connect(g).connect(dry);
      return;
    }
    case 'whistle': {
      const osc = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain();
      osc.frequency.value = freq; lfo.frequency.value = 5.5; lg.gain.value = freq * 0.012;
      lfo.connect(lg).connect(osc.frequency);
      env(g, t, 0.03, vol, dur + 0.15);
      osc.connect(g).connect(dry);
      osc.start(t); lfo.start(t); osc.stop(t + dur + 0.2); lfo.stop(t + dur + 0.2);
      return;
    }
    case 'drift': {
      // Slow 2s swell; the filter breathes open then closes over the note, and sits brighter as intensity rises.
      const g = ctx.createGain(), f = ctx.createBiquadFilter();
      const peak = Math.min(2400, freq * 3) * (0.6 + 0.6 * intensity), end = t + dur + 2;
      f.type = 'lowpass'; f.Q.value = 0.9;
      f.frequency.setValueAtTime(peak * 0.35, t);
      f.frequency.linearRampToValueAtTime(peak, t + dur * 0.45);
      f.frequency.linearRampToValueAtTime(peak * 0.5, end);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * 0.8, t + 2);
      g.gain.setValueAtTime(vol * 0.8, Math.max(t + 2, t + dur * 0.75));
      g.gain.exponentialRampToValueAtTime(0.0001, end);
      for (const det of [-6, 6]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth'; osc.frequency.value = freq; osc.detune.value = det;
        osc.connect(f);
        osc.start(t); osc.stop(end + 0.05);
      }
      f.connect(g).connect(dry);
      return;
    }
    case 'glass': {
      const decay = Math.max(1.1, dur);
      partial(freq, 'sine', t, vol * 1.5, 0.012, decay);
      partial(freq * 2, 'sine', t, vol * 0.25, 0.008, decay * 0.4);
      return;
    }
    case 'sub':
      // A soft-attack sine plus a quieter octave down; the upper note keeps it audible on phone speakers.
      partial(freq, 'sine', t, vol, 0.05, dur + 0.4);
      partial(freq / 2, 'sine', t, vol * 0.7, 0.06, dur + 0.5);
      return;
    case 'bounce': {
      const osc = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq * 1.06, t);
      osc.frequency.exponentialRampToValueAtTime(freq, t + 0.04);
      f.type = 'lowpass'; f.frequency.value = 900;
      env(g, t, 0.006, vol * 1.3, dur + 0.12);
      osc.connect(f).connect(g).connect(dry);
      osc.start(t); osc.stop(t + dur + 0.2);
      return;
    }
    default: {
      // plain oscillator with a sustain, optional lowpass
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = v; osc.frequency.value = freq;
      const attack = o.pad ? 0.5 : 0.01, end = t + dur + (o.pad ? 0.8 : 0.1);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + attack);
      g.gain.setValueAtTime(vol, Math.max(t + attack, t + dur * 0.6));
      g.gain.exponentialRampToValueAtTime(0.0001, end);
      let node: AudioNode = osc;
      if (o.cutoff) {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = o.cutoff;
        osc.connect(f); node = f;
      }
      node.connect(g).connect(dry);
      osc.start(t); osc.stop(end + 0.02);
    }
  }
}

function env(g: GainNode, t: number, attack: number, vol: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function partial(freq: number, type: OscillatorType, t: number, vol: number, attack: number, decay: number) {
  if (!ctx || !dry) return;
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = type; osc.frequency.value = freq;
  env(g, t, attack, vol, decay);
  osc.connect(g).connect(dry);
  osc.start(t); osc.stop(t + attack + decay + 0.05);
}

function kick(t: number, vol = 0.32, from = 130) {
  if (!ctx || !dry) return;
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.14);
  env(g, t, 0.005, vol, 0.22);
  osc.connect(g).connect(dry);
  osc.start(t); osc.stop(t + 0.3);
}

function hit(t: number, dur: number, freq: number, vol: number) {
  if (!ctx || !dry || !noise) return;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = freq > 4000 ? 'highpass' : 'bandpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  env(g, t, 0.003, vol, dur);
  src.connect(f).connect(g).connect(dry);
  src.start(t, Math.random() * 0.3);
  src.stop(t + dur + 0.02);
}

export const music = {
  /** Start (or switch to) a song. Safe before audio is unlocked; it starts on the first tap. */
  play(s: Song, level = intensity) {
    intensity = level;
    clearTimeout(stopTimer);
    if (song === s && timer && !stopping) return;
    stopping = false;
    song = s;
    start();
  },
  /** 0..1: which layers play (see the header). */
  setIntensity(level: number) { intensity = Math.max(0, Math.min(1, level)); },
  get intensity() { return intensity; },
  /**
   * How far into the song `s` we are, in beats (quarter notes), by the audio clock, so the game can
   * move things in time with what you hear. Null when that song isn't playing (or audio is locked).
   */
  beat(s: Song) {
    if (!ctx || song !== s || !timer || stopping) return null;
    return (beatStep + (ctx.currentTime - beatTime) / (60 / s.bpm / 4)) / 4;
  },
  stop(fade = 0.6) {
    if (!song) return;
    stopping = true;
    if (ctx && out) out.gain.setTargetAtTime(0, ctx.currentTime, fade / 3);
    clearTimeout(stopTimer);
    stopTimer = window.setTimeout(() => { clearInterval(timer); timer = 0; song = null; stopping = false; }, fade * 1000);
  },
};
