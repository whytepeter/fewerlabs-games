import '@fontsource/quicksand/500.css';
import '@fontsource/quicksand/600.css';
import '@fontsource/quicksand/700.css';
import './core/kit.css';
import './style.css';
import './paper.css';
import Phaser from 'phaser';
import { autoScaleUI, createGame } from './core/view';
import { sfx } from './core/sfx';
import { music } from './core/music';
import { hydrateIcons } from './core/icons';
import { mountCoins } from './core/metaui';
import { P, readPalette } from './game/palette';
import { applyPondTheme, currentPond } from './game/ponds';
import { Boot } from './scenes/Boot';
import { Game } from './scenes/Game';
import { initPWA } from './core/pwa';
import { initEmbed } from './core/embed';

// the chosen pond's colours, before any art is drawn
applyPondTheme(currentPond());
readPalette();

autoScaleUI();
hydrateIcons();
mountCoins();

// Mobile browsers: no page scroll, pinch, double-tap zoom or long-press menus. Cards may still
// scroll internally on very small screens.
const inCard = (t: EventTarget | null) => t instanceof Element && !!t.closest('.k-panel');
document.addEventListener('touchmove', e => { if (!inCard(e.target)) e.preventDefault(); }, { passive: false });
for (const ev of ['gesturestart', 'gesturechange', 'dblclick', 'contextmenu']) {
  document.addEventListener(ev, e => e.preventDefault(), { passive: false });
}
// Audio may only start inside a user gesture.
document.addEventListener('pointerdown', () => sfx.unlock(), { capture: true });
document.addEventListener('keydown', () => sfx.unlock(), { capture: true });

const game = createGame({
  type: Phaser.AUTO,
  backgroundColor: P.shore,
  banner: false,
  audio: { noAudio: true },
  input: { activePointers: 3 },
  render: { antialias: true, powerPreference: 'high-performance' },
  scene: [Boot, Game],
});

if (import.meta.env.DEV) {
  // Dev-only hook for automated checks: step frames while the tab is hidden, simulate taps.
  let clock = performance.now();
  const scene = () => game.scene.getScene('game') as Game;
  (window as unknown as { __ripple: unknown }).__ripple = {
    game,
    music,
    sfx,
    get scene() { return scene(); },
    get sim() { return scene().sim; },
    /** Run n full frames (logic, tweens, rendering) at a fixed step, independent of rAF. */
    frames(n = 1, dt = 1 / 60) {
      for (let i = 0; i < n; i++) { clock += dt * 1000; game.step(clock, dt * 1000); }
    },
    tap(x: number, y: number) { scene().sim.tap(x, y); },
    /** Freeze/unfreeze the simulation (rendering continues) for screenshots. */
    freeze(on = true) { scene().frozen = on; },
    /**
     * Playtest bot: every `interval` s, tap 48 px behind the most urgent boat (away from its dock).
     * With `useBot` false it just lets time run. Stops at game over.
     */
    bot(seconds: number, useBot = true, interval = 0.45) {
      const s = scene(), sim = s.sim, dt = 1 / 60;
      let tapT = 0, taps = 0, t = 0;
      const t0 = performance.now();
      while (t < seconds && s.mode !== 'over') {
        if (useBot && s.mode === 'play' && (tapT -= dt) <= 0) {
          tapT = interval;
          let best: { x: number; y: number } | null = null, bl = Infinity;
          const p = sim.pond;
          for (const b of sim.boats) {
            if (b.state !== 'in') continue;
            const d = sim.dockFor(b);
            if (!d || b.life - b.age >= bl) continue;
            const dx = d.x - b.x, dy = d.y - b.y, dl = Math.hypot(dx, dy) || 1;
            bl = b.life - b.age;
            best = {
              x: Math.max(p.x + 1, Math.min(p.x + p.w - 1, b.x - dx / dl * 48)),
              y: Math.max(p.y + 1, Math.min(p.y + p.h - 1, b.y - dy / dl * 48)),
            };
          }
          if (best && sim.tap(best.x, best.y)) taps++;
        }
        clock += dt * 1000;
        game.step(clock, dt * 1000);
        t += dt;
      }
      return { mode: s.mode, score: sim.score, lives: sim.lives, t: +t.toFixed(1), taps, colors: sim.colors, rocks: sim.rocks.length, ms: Math.round(performance.now() - t0) };
    },
  };
}

initPWA();
initEmbed('ripple');
