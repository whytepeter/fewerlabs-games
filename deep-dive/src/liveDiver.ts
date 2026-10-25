import type { Skin } from './game/skins';
import { paintDiver } from './scenes/BootScene';

/**
 * Draws a diver live on a canvas, sharp at the screen's pixel density and kicking like in the dive
 * (6 frames at 10 fps). The menu portraits are small stills; this is for the big title showcase.
 */
export function liveDiver(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  let skin: Skin | null = null, drawn = '';

  const tick = (now: number) => {
    requestAnimationFrame(tick);
    if (!skin || !canvas.offsetParent || document.hidden) return; // hidden screen: nothing to draw
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round((w * 46) / 82);
    const frame = still.matches ? 0 : Math.floor(now / 100) % 6;
    const key = `${skin.id}/${w}/${frame}`;
    if (key === drawn || !w) return;
    drawn = key;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.setTransform(w / 82, 0, 0, h / 46, 0, 0);
    paintDiver(ctx, skin, frame);
  };
  requestAnimationFrame(tick);

  return {
    /** Show this outfit. */
    set(s: Skin) { skin = s; drawn = ''; },
  };
}
