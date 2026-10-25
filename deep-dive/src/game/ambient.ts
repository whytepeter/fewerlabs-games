import { sfx } from '../core/sfx';

/**
 * Each cave's soundscape, under the music: a low drone that gets darker (lower filter cutoff) with
 * depth, a soft wash of moving water, and one-shot sounds that drift past now and then, panned left
 * or right: bubbles on the reef, creaking ice, ship's timbers and a far-off bell, a liner's groaning
 * hull. All generated, like the rest of the audio.
 */

export type AmbientSound =
  | 'bubbles'  // a few rising blips
  | 'shrimp'   // a crackle of tiny clicks, like snapping shrimp on a reef
  | 'sway'     // a slow swell of water moving through leaves
  | 'creak'    // ice settling: a low grainy groan
  | 'crack'    // ice splitting: a snap and a falling "pew"
  | 'timber'   // an old ship's planks creaking
  | 'rope'     // a rope pulling tight on a mast
  | 'bell'     // a ship's bell, far away: two strikes
  | 'groan'    // a huge steel hull flexing: deep and slow
  | 'ping'     // a lone metallic ping that echoes away
  | 'clank'    // something loose knocking in the dark
  | 'surge'    // a rush of fast water going past
  | 'gong';    // a big temple gong, far off

export interface Soundscape {
  /** Two oscillators through a lowpass that sways, closing from `bright` to `dark` Hz as you go deeper. */
  drone: { wave: OscillatorType; hz: number; hz2: number; level: number; bright: number; dark: number; sway: number };
  /** Level of the soft noise under the drone (moving water). */
  wash: number;
  /** Echo on the one-shot sounds: delay (s), how much repeats, and how loud the echo is. */
  echo?: { time: number; feedback: number; wet: number };
  /** One-shot sounds, each roughly every `every` seconds. */
  events: { sound: AmbientSound; every: [number, number]; vol: number }[];
}

/** Bright and bubbly: a warm hum, bubbles and the crackle of reef life. */
export const REEF_AMBIENCE: Soundscape = {
  drone: { wave: 'triangle', hz: 65.4, hz2: 98, level: 0.04, bright: 900, dark: 260, sway: 0.09 },
  wash: 0.012,
  events: [
    { sound: 'bubbles', every: [3, 7], vol: 0.05 },
    { sound: 'shrimp', every: [2, 5], vol: 0.035 },
  ],
};

/** Soft and swaying: rounder, slower, with water swelling through the fronds. */
export const KELP_AMBIENCE: Soundscape = {
  drone: { wave: 'sine', hz: 55, hz2: 82.4, level: 0.05, bright: 650, dark: 240, sway: 0.05 },
  wash: 0.022,
  events: [
    { sound: 'sway', every: [4, 9], vol: 0.06 },
    { sound: 'bubbles', every: [7, 13], vol: 0.035 },
  ],
};

/** Cold and airy: a thin high drone, ice creaking and cracking all around. */
export const FROST_AMBIENCE: Soundscape = {
  drone: { wave: 'triangle', hz: 82.4, hz2: 123.5, level: 0.032, bright: 1500, dark: 420, sway: 0.13 },
  wash: 0.014,
  echo: { time: 0.32, feedback: 0.3, wet: 0.25 },
  events: [
    { sound: 'creak', every: [5, 11], vol: 0.05 },
    { sound: 'crack', every: [8, 16], vol: 0.045 },
    { sound: 'bubbles', every: [10, 20], vol: 0.025 },
  ],
};

/** Creaking timber, ropes pulling tight and a ship's bell tolling somewhere far off. */
export const PIRATE_AMBIENCE: Soundscape = {
  drone: { wave: 'sawtooth', hz: 49, hz2: 73.4, level: 0.042, bright: 620, dark: 230, sway: 0.08 },
  wash: 0.018,
  echo: { time: 0.26, feedback: 0.22, wet: 0.18 },
  events: [
    { sound: 'timber', every: [4, 9], vol: 0.06 },
    { sound: 'rope', every: [7, 14], vol: 0.04 },
    { sound: 'bell', every: [15, 26], vol: 0.05 },
    { sound: 'bubbles', every: [8, 15], vol: 0.03 },
  ],
};

/** Rushing water: a strong wash, surges sweeping past, bubbles and the crackle of life on warm rock. */
export const RIPTIDE_AMBIENCE: Soundscape = {
  drone: { wave: 'triangle', hz: 73.4, hz2: 110, level: 0.035, bright: 1100, dark: 320, sway: 0.15 },
  wash: 0.032,
  events: [
    { sound: 'surge', every: [3, 7], vol: 0.06 },
    { sound: 'bubbles', every: [4, 8], vol: 0.04 },
    { sound: 'shrimp', every: [5, 10], vol: 0.025 },
  ],
};

/** A drowned temple: a warm low hum, far-off gongs and bells in a big echoing hall. */
export const SUNKEN_AMBIENCE: Soundscape = {
  drone: { wave: 'sine', hz: 55, hz2: 82.4, level: 0.045, bright: 800, dark: 260, sway: 0.07 },
  wash: 0.014,
  echo: { time: 0.48, feedback: 0.45, wet: 0.4 },
  events: [
    { sound: 'gong', every: [10, 18], vol: 0.06 },
    { sound: 'bell', every: [12, 22], vol: 0.035 },
    { sound: 'bubbles', every: [6, 12], vol: 0.03 },
  ],
};

/** Cold, dark steel: a slow beating rumble, the hull groaning, pings that echo down long corridors. */
export const LINER_AMBIENCE: Soundscape = {
  drone: { wave: 'sawtooth', hz: 36.7, hz2: 38.9, level: 0.055, bright: 420, dark: 150, sway: 0.05 },
  wash: 0.012,
  echo: { time: 0.55, feedback: 0.5, wet: 0.45 },
  events: [
    { sound: 'groan', every: [7, 14], vol: 0.08 },
    { sound: 'ping', every: [9, 17], vol: 0.04 },
    { sound: 'clank', every: [6, 12], vol: 0.04 },
  ],
};

export class Ambient {
  private nodes: { srcs: AudioScheduledSourceNode[]; filter: BiquadFilterNode; gain: GainNode; bus: GainNode } | null = null;
  private scape: Soundscape = REEF_AMBIENCE;
  private next: number[] = [];
  private timer = 0;
  private lastDepth = -999;

  start(scape: Soundscape = REEF_AMBIENCE) {
    const ac = sfx.context, out = sfx.output;
    if (!ac || !out || this.nodes) return;
    this.scape = scape;
    const d = scape.drone;
    const gain = ac.createGain();
    gain.gain.value = 0;
    gain.connect(out);
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = d.bright;
    filter.Q.value = 0.8;
    const level = ac.createGain();
    level.gain.value = d.level / 0.05; // drones were tuned at 0.05 of the master
    const hum = ac.createOscillator();
    hum.type = d.wave;
    hum.frequency.value = d.hz;
    const pad = ac.createOscillator();
    pad.frequency.value = d.hz2;
    pad.detune.value = 7;
    const lfo = ac.createOscillator();
    lfo.frequency.value = d.sway;
    const lfoDepth = ac.createGain();
    lfoDepth.gain.value = d.bright * 0.23;
    lfo.connect(lfoDepth).connect(filter.frequency);
    hum.connect(filter);
    pad.connect(filter);
    filter.connect(level).connect(gain);
    // Moving water: looped noise, lowpassed and gently swelling.
    const wash = ac.createBufferSource();
    wash.buffer = noiseLoop(ac);
    wash.loop = true;
    const washTone = ac.createBiquadFilter();
    washTone.type = 'lowpass';
    washTone.frequency.value = 380;
    const washGain = ac.createGain();
    washGain.gain.value = scape.wash / 0.05;
    const washLfo = ac.createOscillator(), washDepth = ac.createGain();
    washLfo.frequency.value = 0.13;
    washDepth.gain.value = (scape.wash / 0.05) * 0.4;
    washLfo.connect(washDepth).connect(washGain.gain);
    wash.connect(washTone).connect(washGain).connect(gain);
    // One-shots go through their own bus, with an optional echo.
    const bus = ac.createGain();
    bus.gain.value = 1 / 0.05;
    bus.connect(gain);
    if (scape.echo) {
      const dl = ac.createDelay(2), fb = ac.createGain(), tone = ac.createBiquadFilter(), wet = ac.createGain();
      dl.delayTime.value = scape.echo.time;
      fb.gain.value = scape.echo.feedback;
      tone.type = 'lowpass'; tone.frequency.value = 1800;
      wet.gain.value = scape.echo.wet;
      bus.connect(dl);
      dl.connect(tone).connect(fb).connect(dl);
      tone.connect(wet).connect(gain);
    }
    const srcs = [hum, pad, lfo, wash, washLfo];
    for (const o of srcs) o.start();
    gain.gain.setTargetAtTime(0.05, ac.currentTime, 1.2);
    this.nodes = { srcs, filter, gain, bus };
    this.lastDepth = -999;
    // The first of each sound comes a little sooner than usual.
    this.next = scape.events.map(e => ac.currentTime + 1.5 + Math.random() * e.every[0]);
    clearInterval(this.timer);
    this.timer = window.setInterval(() => this.tick(), 200);
  }

  setDepth(depth: number) {
    const ac = sfx.context;
    if (!ac || !this.nodes || Math.abs(depth - this.lastDepth) < 5) return;
    this.lastDepth = depth;
    const d = this.scape.drone;
    const cutoff = d.bright + (d.dark - d.bright) * Math.min(1, depth / 1200);
    this.nodes.filter.frequency.setTargetAtTime(cutoff, ac.currentTime, 0.6);
  }

  stop() {
    const ac = sfx.context, n = this.nodes;
    clearInterval(this.timer);
    if (!ac || !n) return;
    this.nodes = null;
    n.gain.gain.setTargetAtTime(0, ac.currentTime, 0.3);
    for (const o of n.srcs) o.stop(ac.currentTime + 1.5);
    window.setTimeout(() => n.gain.disconnect(), 2500);
  }

  /** Play whichever one-shots are due. The context's clock stands still while the game is paused. */
  private tick() {
    const ac = sfx.context, n = this.nodes;
    if (!ac || !n || ac.state !== 'running') return;
    this.scape.events.forEach((e, i) => {
      if (ac.currentTime < this.next[i]) return;
      this.next[i] = ac.currentTime + e.every[0] + Math.random() * (e.every[1] - e.every[0]);
      play(ac, n.bus, e.sound, ac.currentTime + 0.05, e.vol);
    });
  }
}

let loop: AudioBuffer | null = null;
function noiseLoop(ac: AudioContext) {
  if (loop) return loop;
  loop = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = loop.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return loop;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** One sound, somewhere to the left or right. */
function play(ac: AudioContext, bus: AudioNode, sound: AmbientSound, t: number, vol: number) {
  let out: AudioNode = bus;
  if (ac.createStereoPanner) {
    const p = ac.createStereoPanner();
    p.pan.value = rnd(-0.8, 0.8);
    p.connect(bus);
    out = p;
  }
  const s = new Shot(ac, out);
  switch (sound) {
    case 'bubbles': {
      const n = 3 + ((Math.random() * 4) | 0);
      for (let i = 0, at = t; i < n; i++, at += rnd(0.05, 0.16)) {
        const f = rnd(260, 520);
        s.tone('sine', f, f * rnd(1.8, 2.6), at, 0.07, vol * rnd(0.5, 1));
      }
      return;
    }
    case 'shrimp': {
      const n = 8 + ((Math.random() * 14) | 0);
      for (let i = 0; i < n; i++) s.noise(t + Math.random() * 0.7, 0.006, 'highpass', rnd(3500, 6000), 0.7, vol * rnd(0.4, 1));
      return;
    }
    case 'sway':
      s.swell(t, 2.6, 'bandpass', [280, 720, 300], 1.2, vol);
      return;
    case 'creak':
      s.grain('triangle', rnd(170, 210), rnd(105, 125), t, rnd(0.9, 1.4), rnd(22, 30), 900, vol);
      return;
    case 'crack':
      s.noise(t, 0.05, 'highpass', 2200, 0.8, vol * 1.4);
      s.tone('sine', rnd(2200, 2800), rnd(280, 380), t + 0.02, 0.3, vol * 0.8);
      return;
    case 'timber':
      s.grain('sawtooth', rnd(88, 104), rnd(68, 80), t, rnd(1.1, 1.7), rnd(11, 16), 700, vol);
      return;
    case 'rope':
      s.grain('triangle', rnd(380, 430), rnd(500, 560), t, 0.45, rnd(28, 36), 1300, vol);
      s.grain('triangle', rnd(420, 470), rnd(540, 600), t + 0.55, 0.35, rnd(28, 36), 1300, vol * 0.7);
      return;
    case 'bell': {
      const f = rnd(480, 560);
      s.bell(f, t, vol);
      s.bell(f, t + 0.95, vol * 0.75);
      return;
    }
    case 'groan':
      s.groan(t, rnd(3, 4.2), vol);
      return;
    case 'ping': {
      const f = rnd(600, 760);
      for (const [m, v] of [[1, 1], [2.76, 0.45], [5.4, 0.2]] as const) s.tone('sine', f * m, f * m, t, 2.2, vol * v);
      return;
    }
    case 'clank':
      s.noise(t, 0.08, 'bandpass', rnd(1500, 2200), 7, vol * 1.5);
      s.tone('sine', rnd(200, 260), rnd(170, 210), t, 0.45, vol * 0.9);
      return;
    case 'surge':
      s.swell(t, rnd(1.2, 1.8), 'highpass', [600, 1800, 900], 0.7, vol);
      return;
    case 'gong': {
      const f = rnd(98, 118);
      s.bell(f, t, vol * 1.3);
      s.tone('sine', f, f * 0.98, t, 3.5, vol * 0.8);
      s.tone('sine', f * 2.02, f * 2, t, 2.5, vol * 0.3);
      return;
    }
  }
}

/** Building blocks for the one-shots, all into `out`. */
class Shot {
  constructor(private ac: AudioContext, private out: AudioNode) {}

  private env(t: number, attack: number, dur: number, vol: number) {
    const g = this.ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
    g.connect(this.out);
    return g;
  }

  tone(type: OscillatorType, from: number, to: number, t: number, dur: number, vol: number) {
    const o = this.ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    if (to !== from) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    o.connect(this.env(t, 0.005, dur, vol));
    o.start(t); o.stop(t + dur + 0.05);
  }

  noise(t: number, dur: number, type: BiquadFilterType, freq: number, q: number, vol: number) {
    const src = this.ac.createBufferSource(), f = this.ac.createBiquadFilter();
    src.buffer = noiseLoop(this.ac);
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    src.connect(f).connect(this.env(t, 0.002, dur, vol));
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }

  /** Filtered noise that swells in and out while its filter sweeps through `sweep`. */
  swell(t: number, dur: number, type: BiquadFilterType, sweep: number[], q: number, vol: number) {
    const src = this.ac.createBufferSource(), f = this.ac.createBiquadFilter(), g = this.ac.createGain();
    src.buffer = noiseLoop(this.ac);
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(sweep[0], t);
    sweep.slice(1).forEach((hz, i) => f.frequency.linearRampToValueAtTime(hz, t + (dur * (i + 1)) / (sweep.length - 1)));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.out);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  /** A creak: a sliding tone chopped into grains by a fast square tremolo, through a bandpass. */
  grain(type: OscillatorType, from: number, to: number, t: number, dur: number, rate: number, band: number, vol: number) {
    const o = this.ac.createOscillator(), f = this.ac.createBiquadFilter(), chop = this.ac.createGain();
    const lfo = this.ac.createOscillator(), depth = this.ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.linearRampToValueAtTime(to, t + dur);
    f.type = 'bandpass'; f.frequency.value = band; f.Q.value = 3;
    lfo.type = 'square'; lfo.frequency.setValueAtTime(rate, t); lfo.frequency.linearRampToValueAtTime(rate * 0.6, t + dur);
    chop.gain.value = 0.5; depth.gain.value = 0.5;
    lfo.connect(depth).connect(chop.gain);
    const g = this.ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(chop).connect(g).connect(this.out);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  }

  /** A struck bell, muffled by distance. */
  bell(freq: number, t: number, vol: number) {
    const car = this.ac.createOscillator(), mod = this.ac.createOscillator(), mg = this.ac.createGain(), f = this.ac.createBiquadFilter();
    car.frequency.value = freq; mod.frequency.value = freq * 2.4;
    mg.gain.setValueAtTime(freq * 1.6, t);
    mg.gain.exponentialRampToValueAtTime(freq * 0.05, t + 2);
    mod.connect(mg).connect(car.frequency);
    f.type = 'lowpass'; f.frequency.value = 1400;
    car.connect(f).connect(this.env(t, 0.004, 2.6, vol));
    car.start(t); mod.start(t); car.stop(t + 2.7); mod.stop(t + 2.7);
  }

  /** A steel hull flexing: two slightly apart low saws bending down through a slow resonant sweep. */
  groan(t: number, dur: number, vol: number) {
    const f = this.ac.createBiquadFilter(), g = this.ac.createGain();
    f.type = 'bandpass'; f.Q.value = 6;
    f.frequency.setValueAtTime(rnd(180, 230), t);
    f.frequency.linearRampToValueAtTime(rnd(340, 420), t + dur * 0.5);
    f.frequency.linearRampToValueAtTime(rnd(160, 200), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const base = rnd(40, 48);
    for (const k of [1, 1.06]) {
      const o = this.ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(base * k, t);
      o.frequency.linearRampToValueAtTime(base * k * 0.82, t + dur);
      o.connect(f);
      o.start(t); o.stop(t + dur + 0.05);
    }
    f.connect(g).connect(this.out);
  }
}

/**
 * A treasure chime: bell-like notes rising through `notes` (Hz), then a sparkle on top. `big` adds a
 * low swell and a longer shimmer, for a legendary find.
 */
export function chime(notes: number[], big = false) {
  const ac = sfx.context, out = sfx.output;
  if (!ac || !out) return;
  const s = new Shot(ac, out), t = ac.currentTime + 0.02, gap = big ? 0.11 : 0.08;
  notes.forEach((f, i) => {
    s.bell(f, t + i * gap, 0.07);
    s.tone('triangle', f, f, t + i * gap, 0.5, 0.05);
  });
  const end = t + notes.length * gap, top = notes[notes.length - 1];
  for (let i = 0; i < (big ? 10 : 4); i++) s.tone('sine', top * rnd(1.9, 3.1), top * rnd(2, 3.2), end + i * 0.06, 0.35, 0.025);
  if (big) {
    s.tone('triangle', notes[0] / 2, notes[0] / 2, t, 2.2, 0.06);
    s.swell(t, 2.4, 'bandpass', [1800, 5200, 2600], 2, 0.05);
  }
}
