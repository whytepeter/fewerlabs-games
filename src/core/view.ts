import Phaser from 'phaser';

/**
 * Crisp rendering on high-DPI phones.
 *
 * Phaser 3 has no "resolution" setting, so the canvas is sized in device pixels and
 * shrunk back with CSS zoom. Scenes then work in CSS pixels ("logical" units) by giving
 * their cameras a zoom of `dpr` pinned to the top-left corner (see `fitCamera`).
 */
export const view = { w: 1, h: 1, dpr: 1 };

const MAX_DPR = 2; // 3x canvases cost a lot of fill-rate for little visible gain

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
