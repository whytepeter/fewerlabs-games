import Phaser from 'phaser';

/**
 * Crisp rendering on high-DPI phones.
 *
 * Phaser 3 has no "resolution" setting, so the canvas is sized in device pixels and
 * shrunk back with CSS zoom. Scenes then work in CSS pixels ("logical" units) by giving
 * their cameras a zoom of `dpr` pinned to the top-left corner (see `fitCamera`).
 */
export const view = { w: 1, h: 1, dpr: 1 };

const MAX_DPR = 3; // full resolution on modern phones (these scenes are light enough)

function measure(parent: HTMLElement) {
  // Layout size, not the on-screen box: a game may rotate its container with CSS
  // (Deep Dive does in portrait) and still wants its unrotated width/height.
  view.w = Math.max(1, Math.round(parent.clientWidth));
  view.h = Math.max(1, Math.round(parent.clientHeight));
  view.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
}

export function createGame(config: Omit<Phaser.Types.Core.GameConfig, 'scale' | 'parent'>): Phaser.Game {
  const parent = document.getElementById('game')!;
  measure(parent);
  const game = new Phaser.Game({
    ...config,
    parent,
    scale: {
      mode: Phaser.Scale.NONE,
      width: Math.round(view.w * view.dpr),
      height: Math.round(view.h * view.dpr),
      zoom: 1 / view.dpr,
    },
  });

  let raf = 0;
  const onResize = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const before = `${view.w}x${view.h}@${view.dpr}`;
      measure(parent);
      if (before === `${view.w}x${view.h}@${view.dpr}`) return;
      game.scale.resize(Math.round(view.w * view.dpr), Math.round(view.h * view.dpr));
      game.scale.setZoom(1 / view.dpr);
      game.events.emit('view-resize');
    });
  };
  addEventListener('resize', onResize);
  addEventListener('orientationchange', onResize);
  window.visualViewport?.addEventListener('resize', onResize);
  // Phones can fire the events above before the rotated layout settles, leaving the canvas at
  // the old size (an unpainted strip). Watching the container itself always catches the final size.
  new ResizeObserver(onResize).observe(parent);
  return game;
}

/** Make a camera draw logical (CSS-pixel) coordinates at full device resolution. */
export function fitCamera(cam: Phaser.Cameras.Scene2D.Camera) {
  cam.setSize(Math.round(view.w * view.dpr), Math.round(view.h * view.dpr));
  cam.setOrigin(0, 0);
  cam.setZoom(view.dpr);
}

export const isTouch = () => matchMedia('(pointer: coarse)').matches;
export const isPortrait = () => view.h > view.w;

/**
 * Scale DOM menus and HUDs with the screen: sets --ui on <html> (1 = a ~390x844 phone, either
 * orientation, ~0.9 on phones, at most 1.15 on big screens). kit.css applies it with CSS zoom to .k-screen contents and .k-scale elements.
 */
export function autoScaleUI(min = 0.8, max = 1.15) {
  const apply = () => {
    const w = window.innerWidth, h = window.innerHeight;
    // ~0.9 on a typical phone so menus and HUDs leave more room for the game.
    // Phones held sideways are only ~390 px tall: shrink a little more there so menus aren't cramped.
    const s = Math.min(Math.min(w, h) / (w > h && h < 520 ? 470 : 430), Math.max(w, h) / 930);
    document.documentElement.style.setProperty('--ui', Math.max(min, Math.min(max, s)).toFixed(3));
  };
  apply();
  addEventListener('resize', apply);
  window.visualViewport?.addEventListener('resize', apply);
}
