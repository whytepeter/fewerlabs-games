import { sfx } from '../core/sfx';

/** A low underwater drone that gets darker (lower filter cutoff) with depth. */
export class Ambient {
  private nodes: { oscs: OscillatorNode[]; filter: BiquadFilterNode; gain: GainNode } | null = null;
  private lastDepth = -999;

  start() {
    const ac = sfx.context, out = sfx.output;
    if (!ac || !out || this.nodes) return;
    const gain = ac.createGain();
    gain.gain.value = 0;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    filter.Q.value = 0.8;
    const hum = ac.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.value = 55;
    const pad = ac.createOscillator();
    pad.frequency.value = 82.4;
    pad.detune.value = 7;
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoDepth = ac.createGain();
    lfoDepth.gain.value = 160;
    lfo.connect(lfoDepth).connect(filter.frequency);
    hum.connect(filter);
    pad.connect(filter);
    filter.connect(gain).connect(out);
    for (const o of [hum, pad, lfo]) o.start();
    gain.gain.setTargetAtTime(0.05, ac.currentTime, 1.2);
    this.nodes = { oscs: [hum, pad, lfo], filter, gain };
    this.lastDepth = -999;
  }

  setDepth(depth: number) {
    const ac = sfx.context;
    if (!ac || !this.nodes || Math.abs(depth - this.lastDepth) < 5) return;
    this.lastDepth = depth;
    const cutoff = 700 + (220 - 700) * Math.min(1, depth / 1200);
    this.nodes.filter.frequency.setTargetAtTime(cutoff, ac.currentTime, 0.6);
  }

  stop() {
    const ac = sfx.context, n = this.nodes;
    if (!ac || !n) return;
    this.nodes = null;
    n.gain.gain.setTargetAtTime(0, ac.currentTime, 0.3);
    for (const o of n.oscs) o.stop(ac.currentTime + 1.5);
  }
}
