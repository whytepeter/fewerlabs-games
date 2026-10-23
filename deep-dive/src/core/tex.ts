import Phaser from 'phaser';

/**
 * Art is drawn procedurally with the 2D canvas API into Phaser textures at TEX_RES times
 * logical size, so sprites stay sharp on high-DPI screens. Sprites using these textures
 * should be scaled by `1 / TEX_RES` (see `TEX_SCALE`).
 */
export const TEX_RES = 3;
export const TEX_SCALE = 1 / TEX_RES;

type Draw = (ctx: CanvasRenderingContext2D) => void;

/** A single-frame texture of logical size w x h. */
export function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: Draw) {
  const tex = scene.textures.createCanvas(key, Math.ceil(w * TEX_RES), Math.ceil(h * TEX_RES))!;
  const ctx = tex.getContext();
  ctx.save();
  ctx.scale(TEX_RES, TEX_RES);
  draw(ctx);
  ctx.restore();
  tex.refresh();
  return tex;
}

/** A horizontal strip of `frames` frames, each of logical size fw x fh, named 0..frames-1. */
export function sheetTexture(
  scene: Phaser.Scene, key: string, fw: number, fh: number, frames: number,
  draw: (ctx: CanvasRenderingContext2D, frame: number) => void,
) {
  const FW = Math.ceil(fw * TEX_RES), FH = Math.ceil(fh * TEX_RES);
  const tex = scene.textures.createCanvas(key, FW * frames, FH)!;
  const ctx = tex.getContext();
  for (let i = 0; i < frames; i++) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(i * FW, 0, FW, FH);
    ctx.clip();
    ctx.translate(i * FW, 0);
    ctx.scale(TEX_RES, TEX_RES);
    draw(ctx, i);
    ctx.restore();
    tex.add(i, 0, i * FW, 0, FW, FH);
  }
  tex.refresh();
  return tex;
}

/** Soft white radial glow, tinted per use. */
export function glowTexture(scene: Phaser.Scene, key = 'glow', size = 64) {
  return canvasTexture(scene, key, size, size, ctx => {
    const r = size / 2;
    const g = ctx.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  });
}

export const hexToNum = (hex: string) => parseInt(hex.slice(1), 16);
export function mixNum(a: number, b: number, t: number) {
  const ar = a >> 16, ag = (a >> 8) & 255, ab = a & 255;
  const br = b >> 16, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}
