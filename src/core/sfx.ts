import { onSettings } from './settings';

// A tiny synth: every sound is generated, so there are no audio files to load.
// The AudioContext is created on the first user gesture, which mobile browsers require.

const VOLUME = 0.55;
let ac: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let enabled = true;
const unlockListeners: ((ac: AudioContext) => void)[] = [];

onSettings(s => {
  enabled = s.sound;
  if (ac && master) master.gain.setTargetAtTime(enabled ? VOLUME : 0, ac.currentTime, 0.03);
});

export interface ToneOpts { type?: OscillatorType; vol?: number; slideTo?: number; delay?: number }

export const sfx = {
  /** Call from a pointer/key handler. Safe to call repeatedly. */
  unlock() {
    try {
      if (!ac) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ac = new Ctx();
        master = ac.createGain();
        master.gain.value = enabled ? VOLUME : 0;
        master.connect(ac.destination);
        noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        const ctx = ac;
        unlockListeners.forEach(fn => fn(ctx));
      }
      if (ac.state === 'suspended') void ac.resume();
    } catch {
      ac = null;
    }
  },
  /** Run once the AudioContext exists (immediately if it already does). */
  onUnlock(fn: (ac: AudioContext) => void) {
    if (ac) fn(ac); else unlockListeners.push(fn);
  },
  suspend() { if (ac && ac.state === 'running') void ac.suspend(); },
  resume() { if (ac && ac.state === 'suspended') void ac.resume(); },
  get context() { return ac; },
  get output() { return master; },

  tone(freq: number, dur: number, o: ToneOpts = {}) {
    if (!ac || !master || !enabled) return;
    const t = ac.currentTime + (o.delay ?? 0);
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol ?? 0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  },

  noise(dur: number, vol: number, freq: number, q = 1) {
    if (!ac || !master || !noiseBuf || !enabled) return;
    const t = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    const f = ac.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.03);
  },
};
