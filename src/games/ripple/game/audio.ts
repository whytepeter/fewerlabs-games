import { sfx } from '../../../core/sfx';

// Ripple's sound palette, ported from the prototype. Everything is synthesised.

const NOTES = [392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];

let lastBump = 0;

export const sounds = {
  drop() {
    const f = 700 + Math.random() * 200;
    sfx.tone(f, 0.18, { vol: 0.22, slideTo: f * 0.45 });
    sfx.noise(0.12, 0.05, 1800);
  },
  /** Rising chime: `n` climbs with the combo and with score. */
  dock(n: number) {
    const f = NOTES[Math.min(NOTES.length - 1, Math.max(0, n))];
    sfx.tone(f, 0.5, { vol: 0.22 });
    sfx.tone(f * 1.5, 0.6, { type: 'triangle', vol: 0.06, delay: 0.06 });
    sfx.tone(f * 2, 0.4, { vol: 0.04, delay: 0.12 });
  },
  nope() { sfx.tone(220, 0.15, { type: 'triangle', vol: 0.12, slideTo: 180 }); },
  bump() {
    const now = performance.now();
    if (now - lastBump < 70) return; // several boats hitting rocks in one frame shouldn't stack
    lastBump = now;
    sfx.tone(150, 0.08, { type: 'triangle', vol: 0.1, slideTo: 110 });
  },
  lost() { sfx.tone(330, 0.6, { vol: 0.16, slideTo: 160 }); sfx.noise(0.4, 0.06, 500); },
  unlock() { [0, 0.1, 0.2].forEach((d, i) => sfx.tone(NOTES[3 + i * 2], 0.35, { vol: 0.12, delay: d })); },
  over() { [0, 0.16, 0.32].forEach((d, i) => sfx.tone(NOTES[4 - i * 2], 0.5, { vol: 0.08, delay: d })); },
  click() { sfx.tone(660, 0.07, { vol: 0.05, slideTo: 520 }); },
};
