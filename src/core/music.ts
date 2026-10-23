import { onSettings } from './settings';
import { sfx } from './sfx';

/**
 * Generated background music: a small step sequencer on the shared AudioContext, so there are
 * no audio files. Each game defines a Song (key, tempo, chord loop, patterns) and calls
 * music.play(song). Layers fade in with intensity (0..1):
 *   pad always · bass ≥ 0.2 · arp ≥ 0.35 · drums ≥ 0.55 · lead ≥ 0.7
 * The Music setting mutes it; pausing the game (sfx.suspend) pauses it with the rest of the audio.
 */

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
  sounds?: {
    pad?: OscillatorType;
    arp?: OscillatorType;
    lead?: OscillatorType;
    /** Lowpass cutoff for the arp, Hz. */
    arpTone?: number;
  };
  /** 0..0.5, delays every other 16th for a swung feel. */
  swing?: number;
  /** Overall level, default 1. */
  gain?: number;
}

const BUS_VOLUME = 0.32;
const LOOKAHEAD = 0.15;

let ctx: AudioContext | null = null;
let bus: GainNode | null = null;
let noise: AudioBuffer | null = null;
let enabled = true;
let song: Song | null = null;
let intensity = 0.4;
let step = 0;
let nextTime = 0;
let timer = 0;
let leadNote = 0;
let stopTimer = 0;
let stopping = false;

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

onSettings(s => {
  enabled = s.music;
  if (ctx && bus) bus.gain.setTargetAtTime(enabled ? BUS_VOLUME * (song?.gain ?? 1) : 0, ctx.currentTime, 0.4);
});

sfx.onUnlock(ac => {
  ctx = ac;
  bus = ac.createGain();
  bus.gain.value = 0;
  // A little warmth: gentle lowpass on everything.
  const tone = ac.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 5200;
  bus.connect(tone).connect(ac.destination);
  noise = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  if (song) start();
});

function start() {
  if (!ctx || !bus || !song) return;
  bus.gain.cancelScheduledValues(ctx.currentTime);
  bus.gain.setTargetAtTime(enabled ? BUS_VOLUME * (song.gain ?? 1) : 0, ctx.currentTime, 0.8);
  step = 0;
  leadNote = 0;
  nextTime = ctx.currentTime + 0.1;
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
    nextTime += s16;
    step++;
  }
}

function playStep(sg: Song, n: number, t: number, s16: number) {
  const i = n % 16, bar = Math.floor(n / 16);
  const chord = sg.progression[bar % sg.progression.length];
  const root = sg.root;
  const sounds = sg.sounds ?? {};

  if (i === 0) {
    for (const c of chord) note(midiHz(root + c), t, s16 * 16, { type: sounds.pad ?? 'triangle', vol: 0.045, attack: 0.5, release: 0.8 });
  }
  if (intensity >= 0.2 && sg.bass[i]) note(midiHz(root - 12 + chord[0]), t, s16 * 1.8, { type: 'sine', vol: 0.16, attack: 0.01 });
  if (intensity >= 0.35 && sg.arp[i]) {
    const c = chord[(n >> 1) % chord.length] + (((n >> 3) & 1) ? 12 : 0);
    note(midiHz(root + 12 + c), t, s16 * 1.4, { type: sounds.arp ?? 'square', vol: 0.035, attack: 0.005, cutoff: sounds.arpTone ?? 1800 });
  }
  if (intensity >= 0.55) {
    if (sg.kick[i]) kick(t);
    if (sg.hat[i]) hit(t, 0.03, 8000, 0.05);
    if (sg.snare[i]) hit(t, 0.12, 1800, 0.09);
  }
  if (intensity >= 0.7 && sg.lead[i]) {
    // Seeded walk that repeats every 4 bars so the tune is hummable, then varies.
    const seed = ((bar % 4) * 16 + i) * 9301 + Math.floor(bar / 8) * 49297;
    const r = ((seed % 233280) + 233280) % 233280 / 233280;
    leadNote = Math.max(0, Math.min(sg.scale.length * 2 - 1, leadNote + (r < 0.4 ? -1 : r < 0.75 ? 1 : r < 0.88 ? 2 : -2)));
    const deg = sg.scale[leadNote % sg.scale.length] + 12 * Math.floor(leadNote / sg.scale.length);
    note(midiHz(root + 12 + deg), t, s16 * 1.9, { type: sounds.lead ?? 'triangle', vol: 0.06, attack: 0.01, release: 0.25 });
  }
}

interface NoteOpts { type: OscillatorType; vol: number; attack: number; release?: number; cutoff?: number }

function note(freq: number, t: number, dur: number, o: NoteOpts) {
  if (!ctx || !bus) return;
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = o.type;
  osc.frequency.value = freq;
  const end = t + dur + (o.release ?? 0.08);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.vol, t + o.attack);
  g.gain.setValueAtTime(o.vol, Math.max(t + o.attack, t + dur * 0.6));
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  let node: AudioNode = osc;
  if (o.cutoff) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.cutoff;
    osc.connect(f);
    node = f;
  }
  node.connect(g).connect(bus);
  osc.start(t);
  osc.stop(end + 0.02);
}

function kick(t: number) {
  if (!ctx || !bus) return;
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.frequency.setValueAtTime(130, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.14);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.32, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  osc.connect(g).connect(bus);
  osc.start(t);
  osc.stop(t + 0.25);
}

function hit(t: number, dur: number, freq: number, vol: number) {
  if (!ctx || !bus || !noise) return;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = freq > 4000 ? 'highpass' : 'bandpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(bus);
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
  stop(fade = 0.6) {
    if (!song) return;
    stopping = true;
    if (ctx && bus) bus.gain.setTargetAtTime(0, ctx.currentTime, fade / 3);
    clearTimeout(stopTimer);
    stopTimer = window.setTimeout(() => { clearInterval(timer); timer = 0; song = null; stopping = false; }, fade * 1000);
  },
};
