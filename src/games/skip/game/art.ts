import Phaser from 'phaser';
import { canvasTexture, sheetTexture, glowTexture, TEX_RES } from '../../../core/tex';
import { P, N, isDark } from './palette';

// Cartoon art: chunky shapes, saturated palette colours and bold navy outlines.
// Every texture is painted from the current palette. Painting again (after a theme change)
// redraws into the same canvas, so sprites that use it update without being touched.

type Draw = (ctx: CanvasRenderingContext2D) => void;

export const OUTLINE = '#16233b';
export const OUTLINE_N = 0x16233b;
const LW = 2.6; // outline width in logical px

/** Parallax strips are wide, so they use a lower resolution to stay under 4096 px. */
export const STRIP_RES = 2;
export const STRIPS = {
  clouds: { w: 1400, h: 130 },
  hillFar: { w: 1400, h: 188 },
  hillMid: { w: 1400, h: 108 },
  trees: { w: 1408, h: 92 },
} as const;
export type StripKey = keyof typeof STRIPS;
export const LOG_WIDTHS = [80, 100, 120, 140];
/** Margin around log art so the outline isn't clipped. */
export const LOG_M = 3;
export const PAD_W = 70;
/** Duck texture size and the point that sits on the water. */
export const DUCK = { w: 58, h: 52, ax: 29, ay: 43 };
/** Pier texture origin in world units relative to (x 0, water line). */
export const PIER = { x: -434, y: -46 };
export const STONE_FRAMES = 8; // spin frames; the same 8 again with squinting eyes follow

function repaint(scene: Phaser.Scene, key: string, res: number, draw: Draw) {
  const t = scene.textures.get(key) as Phaser.Textures.CanvasTexture;
  const ctx = t.getContext();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, t.width, t.height);
  ctx.save();
  ctx.scale(res, res);
  draw(ctx);
  ctx.restore();
  t.refresh();
}

function single(scene: Phaser.Scene, key: string, w: number, h: number, draw: Draw) {
  if (scene.textures.exists(key)) repaint(scene, key, TEX_RES, draw);
  else canvasTexture(scene, key, w, h, draw);
}

function sheet(scene: Phaser.Scene, key: string, fw: number, fh: number, frames: number, draw: (ctx: CanvasRenderingContext2D, f: number) => void) {
  if (!scene.textures.exists(key)) {
    sheetTexture(scene, key, fw, fh, frames, draw);
    return;
  }
  const t = scene.textures.get(key) as Phaser.Textures.CanvasTexture;
  const ctx = t.getContext();
  const FW = Math.ceil(fw * TEX_RES);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, t.width, t.height);
  for (let i = 0; i < frames; i++) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(i * FW, 0, FW, t.height);
    ctx.clip();
    ctx.translate(i * FW, 0);
    ctx.scale(TEX_RES, TEX_RES);
    draw(ctx, i);
    ctx.restore();
  }
  t.refresh();
}

function strip(scene: Phaser.Scene, key: StripKey, draw: Draw) {
  const { w, h } = STRIPS[key];
  if (!scene.textures.exists(key)) scene.textures.createCanvas(key, w * STRIP_RES, h * STRIP_RES);
  repaint(scene, key, STRIP_RES, draw);
}

// ---------- helpers

function ell(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
}
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}
/** Fill the current path, then outline it in navy. */
function ink(ctx: CanvasRenderingContext2D, fill: string, lw = LW) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}
function hash(n: number) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
const mod = (a: number, n: number) => ((a % n) + n) % n;
/** Value noise that repeats every `period` units, so strips tile seamlessly. */
function pnoise(x: number, period: number, seed: number) {
  const i = Math.floor(x), f = x - i;
  const a = hash(mod(i, period) + seed * 13.7), b = hash(mod(i + 1, period) + seed * 13.7);
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}
const rgba = (n: number, a: number) => `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;

function hills(ctx: CanvasRenderingContext2D, key: 'hillFar' | 'hillMid', base: number, amp: number, n: number, seed: number, color: string, outlineAlpha: number) {
  const { w, h } = STRIPS[key];
  const pts: [number, number][] = [];
  for (let sx = -10; sx <= w + 10; sx += 5) {
    const y = base + pnoise((sx / w) * n, n, seed) * amp + pnoise((sx / w) * n * 3, n * 3, seed * 2) * amp * 0.3;
    pts.push([sx, h - y]);
  }
  ctx.beginPath();
  ctx.moveTo(-10, h);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.lineTo(w + 10, h);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  // soft light band under the ridge, then the ridge outline
  const ridge = (dy: number) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y + dy) : ctx.moveTo(x, y + dy))); };
  ridge(5);
  ctx.strokeStyle = 'rgba(255,255,255,.22)';
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ridge(0);
  ctx.strokeStyle = OUTLINE;
  ctx.globalAlpha = outlineAlpha;
  ctx.lineWidth = LW;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function trees(ctx: CanvasRenderingContext2D) {
  const { w, h } = STRIPS.trees;
  const sp = 22, count = w / sp, ground = h - 6;
  for (let i = -3; i < count + 3; i++) {
    const k = mod(i, count);
    if (hash(k * 1.3) < 0.3) continue;
    const sx = i * sp + hash(k) * 10;
    const hh = (22 + hash(k + 5) * 34) * (0.6 + pnoise((k / count) * 5, 5, 3) * 0.9);
    const hw = hh * 0.34;
    ctx.fillStyle = P['pier-dark'];
    ctx.fillRect(sx - 2.5, ground - 6, 5, 8);
    // two rounded tiers
    const tier = (top: number, bot: number, half: number) => {
      ctx.beginPath();
      ctx.moveTo(sx, top);
      ctx.quadraticCurveTo(sx + half * 0.5, top + (bot - top) * 0.45, sx + half, bot);
      ctx.quadraticCurveTo(sx, bot + 4, sx - half, bot);
      ctx.quadraticCurveTo(sx - half * 0.5, top + (bot - top) * 0.45, sx, top);
      ctx.closePath();
      ink(ctx, P.trees, 2.2);
    };
    tier(ground - hh * 0.62, ground - 3, hw);
    tier(ground - hh, ground - hh * 0.36, hw * 0.74);
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.beginPath();
    ctx.moveTo(sx - 1, ground - hh + 5);
    ctx.lineTo(sx - hw * 0.45, ground - hh * 0.42);
    ctx.lineTo(sx - 2, ground - hh * 0.46);
    ctx.fill();
  }
  ctx.fillStyle = P.trees;
  ctx.fillRect(0, ground, w, h - ground);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = LW;
  ctx.beginPath(); ctx.moveTo(0, ground); ctx.lineTo(w, ground); ctx.stroke();
}

function clouds(ctx: CanvasRenderingContext2D) {
  const { w } = STRIPS.clouds;
  const list = [
    { x: 130, y: 70, s: 1 }, { x: 470, y: 40, s: 0.75 }, { x: 760, y: 82, s: 1.15 }, { x: 1110, y: 52, s: 0.85 },
  ];
  for (const c of list) {
    for (const dx of [0, -w, w]) {
      const x = c.x + dx, y = c.y, s = c.s;
      if (x < -150 || x > w + 150) continue;
      const shape = () => {
        ctx.beginPath();
        ctx.arc(x - 34 * s, y, 18 * s, 0, Math.PI * 2);
        ctx.moveTo(x + 36 * s, y);
        ctx.arc(x + 20 * s, y, 20 * s, 0, Math.PI * 2);
        ctx.moveTo(x + 22 * s, y - 14 * s);
        ctx.arc(x - 4 * s, y - 14 * s, 26 * s, 0, Math.PI * 2);
        if (ctx.roundRect) ctx.roundRect(x - 50 * s, y - 2 * s, 92 * s, 22 * s, 11 * s);
        else ctx.rect(x - 50 * s, y - 2 * s, 92 * s, 22 * s);
      };
      // outline the union: thick stroke first, fill on top
      shape();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = LW * 2;
      ctx.stroke();
      shape();
      ctx.fillStyle = P.cloud;
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.45)';
      ell(ctx, x - 10 * s, y - 26 * s, 10 * s, 5 * s);
      ctx.fill();
    }
  }
}

// ---------- all textures

export function paintAll(scene: Phaser.Scene) {
  single(scene, 'sky', 2, 128, ctx => {
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, P['sky-top']);
    g.addColorStop(1, P['sky-bot']);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 2, 128);
  });
  single(scene, 'water', 2, 128, ctx => {
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, P['water-top']);
    g.addColorStop(1, P['water-deep']);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 2, 128);
  });
  single(scene, 'sunglow', 140, 140, ctx => {
    const g = ctx.createRadialGradient(70, 70, 5, 70, 70, 65);
    // fade to the same hue at zero alpha: fading to transparent black leaves a dark halo on the GPU
    g.addColorStop(0, P['sun-glow']);
    g.addColorStop(1, rgba(N['sun-glow'], 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 140, 140);
  });
  single(scene, 'sun', 76, 76, ctx => {
    ell(ctx, 38, 38, 32, 32);
    ink(ctx, P.sun, 3);
    if (isDark()) {
      ctx.fillStyle = 'rgba(22,35,59,.1)';
      for (const [x, y, r] of [[28, 30, 6], [48, 44, 8], [34, 52, 4]]) { ell(ctx, x, y, r, r); ctx.fill(); }
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ell(ctx, 28, 26, 9, 5);
      ctx.fill();
    }
  });

  strip(scene, 'clouds', clouds);
  strip(scene, 'hillFar', ctx => hills(ctx, 'hillFar', 60, 90, 6, 10, P['hill-far'], 0.45));
  strip(scene, 'hillMid', ctx => hills(ctx, 'hillMid', 25, 55, 10, 40, P['hill-mid'], 0.8));
  strip(scene, 'trees', trees);

  // stone: 8 frames of the highlight sliding round as it spins, then the same 8 squinting happily
  sheet(scene, 'stone', 36, 24, STONE_FRAMES * 2, (ctx, f) => {
    const ph = ((f % STONE_FRAMES) / STONE_FRAMES) * Math.PI * 2;
    const squint = f >= STONE_FRAMES;
    const cx = 18, cy = 12;
    ell(ctx, cx, cy, 13, 7.4);
    ink(ctx, P.stone);
    ctx.save();
    ell(ctx, cx, cy, 13, 7.4);
    ctx.clip();
    ctx.fillStyle = 'rgba(22,35,59,.16)';
    ell(ctx, cx, cy + 5, 14, 5);
    ctx.fill();
    ctx.fillStyle = P['stone-hi'];
    ell(ctx, cx - 3 + Math.cos(ph) * 5, cy - 3.8, 5.5, 2);
    ctx.fill();
    ctx.restore();
    // face looks the way it flies
    const ex = [cx + 3.5, cx + 8.5], ey = cy + 0.4;
    for (const x of ex) {
      if (squint) {
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - 1.8, ey + 0.6); ctx.lineTo(x, ey - 1.2); ctx.lineTo(x + 1.8, ey + 0.6); ctx.stroke();
      } else {
        ell(ctx, x, ey, 1.9, 2.3);
        ink(ctx, '#ffffff', 1.1);
        ctx.fillStyle = OUTLINE;
        ell(ctx, x + 0.6, ey + 0.3, 1.1, 1.4);
        ctx.fill();
      }
    }
    if (squint) {
      ctx.fillStyle = 'rgba(255,110,150,.55)';
      ell(ctx, cx + 1.5, cy + 3, 1.8, 1);
      ctx.fill();
      ell(ctx, cx + 10.5, cy + 3, 1.8, 1);
      ctx.fill();
    }
  });
  single(scene, 'shadow', 28, 10, ctx => {
    ctx.fillStyle = 'rgb(22,35,59)';
    ell(ctx, 14, 5, 13, 4);
    ctx.fill();
  });
  single(scene, 'dot', 8, 8, ctx => {
    ctx.fillStyle = '#fff';
    ell(ctx, 4, 4, 4, 4);
    ctx.fill();
  });
  // splash droplet: white with a navy rim so it reads on bright water
  single(scene, 'drop', 12, 12, ctx => {
    ell(ctx, 6, 6, 4.2, 4.2);
    ink(ctx, '#ffffff', 1.8);
  });
  single(scene, 'chip', 9, 7, ctx => {
    rrect(ctx, 1.2, 1.2, 6.6, 4.6, 1.5);
    ink(ctx, P['log-hi'], 1.4);
  });
  if (!scene.textures.exists('glow')) glowTexture(scene, 'glow', 64);

  // duck: 0 swimming, 1 wings up, 2 wings down
  sheet(scene, 'duck', DUCK.w, DUCK.h, 3, (ctx, f) => {
    const s = 1.15;
    ctx.translate(DUCK.ax, DUCK.ay);
    ctx.scale(s, s);
    const lw = LW / s;
    ctx.beginPath(); ctx.moveTo(8, -10); ctx.lineTo(20, -18); ctx.lineTo(15, -4); ctx.closePath();
    ink(ctx, P.duck, lw);
    ell(ctx, 0, -6, 15, 9.5);
    ink(ctx, P.duck, lw);
    ctx.fillStyle = 'rgba(22,35,59,.1)';
    ell(ctx, 1, -1.5, 12, 3.5);
    ctx.fill();
    if (f === 0) {
      ctx.beginPath(); ctx.moveTo(-3, -8); ctx.quadraticCurveTo(5, -12, 10, -5); ctx.quadraticCurveTo(3, -3, -3, -8);
      ink(ctx, P.duck, lw * 0.7);
    } else {
      const tip = f === 1 ? -30 : -15;
      ctx.beginPath(); ctx.moveTo(-4, -9); ctx.quadraticCurveTo(0, tip + 4, 3, tip); ctx.quadraticCurveTo(8, tip + 8, 10, -9); ctx.closePath();
      ink(ctx, P.duck, lw);
    }
    ell(ctx, -11, -18, 7.2, 7.2);
    ink(ctx, P['duck-head'], lw);
    ctx.beginPath(); ctx.moveTo(-17, -20); ctx.quadraticCurveTo(-27, -19, -26, -16); ctx.quadraticCurveTo(-22, -14, -17, -15); ctx.closePath();
    ink(ctx, P.beak, lw * 0.8);
    ell(ctx, -12, -20.5, 2.5, 2.6);
    ink(ctx, '#ffffff', 1);
    ctx.fillStyle = OUTLINE;
    ell(ctx, -12.8, -20.3, 1.3, 1.5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,120,150,.45)';
    ell(ctx, -8.5, -15.5, 2, 1.2);
    ctx.fill();
  });

  for (const w of LOG_WIDTHS) {
    single(scene, 'log' + w, w + LOG_M * 2, 16 + LOG_M * 2, ctx => {
      ctx.translate(LOG_M, LOG_M);
      rrect(ctx, 0, 0, w, 16, 8);
      ink(ctx, P.log);
      ctx.save();
      rrect(ctx, 0, 0, w, 16, 8);
      ctx.clip();
      ctx.fillStyle = 'rgba(22,35,59,.18)';
      ctx.fillRect(0, 10.5, w, 6);
      ctx.fillStyle = P['log-hi'];
      rrect(ctx, 8, 3, w - 22, 3.2, 1.6);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(22,35,59,.35)';
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      for (let k = 0; k < w / 26; k++) {
        const bx = 12 + k * 26 + hash(w + k) * 8;
        ctx.beginPath(); ctx.moveTo(bx, 8.5); ctx.lineTo(bx + 10, 9); ctx.stroke();
      }
      ell(ctx, w - 5, 8, 5, 8);
      ink(ctx, P['log-hi']);
      ctx.strokeStyle = 'rgba(22,35,59,.55)';
      ctx.lineWidth = 1.3;
      ell(ctx, w - 5, 8, 2.4, 4.2);
      ctx.stroke();
    });
  }

  const padDraw = (flower: boolean) => (ctx: CanvasRenderingContext2D) => {
    const x = 44, y = 17, rx = PAD_W / 2, ry = PAD_W * 0.17;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.ellipse(x, y, rx, ry, 0, 0.55, Math.PI * 2 + 0.02);
    ctx.closePath();
    ink(ctx, P.pad);
    ctx.fillStyle = P['pad-hi'];
    ell(ctx, x - 4, y - 1.5, rx * 0.66, ry * 0.5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(22,35,59,.22)';
    ctx.lineWidth = 1.2;
    for (const a of [2.3, 3.1, 3.9, 4.7]) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * rx * 0.8, y + Math.sin(a) * ry * 0.8); ctx.stroke();
    }
    if (flower) {
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
        ell(ctx, x - 9 + Math.cos(a) * 4.6, y - 7 + Math.sin(a) * 3, 3.6, 2.8);
        ink(ctx, P.flower, 1.4);
      }
      ell(ctx, x - 9, y - 7, 2.3, 1.9);
      ink(ctx, '#ffd23f', 1.2);
    }
  };
  single(scene, 'pad', 88, 34, padDraw(false));
  single(scene, 'padFlower', 88, 34, padDraw(true));

  single(scene, 'glass', 22, 26, ctx => {
    ctx.translate(11, 13);
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(7.5, -2); ctx.lineTo(0, 10); ctx.lineTo(-7.5, -2); ctx.closePath();
    ink(ctx, P.glass, 2.2);
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(7.5, -2); ctx.lineTo(-7.5, -2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(22,35,59,.4)';
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(-7.5, -2); ctx.lineTo(7.5, -2); ctx.moveTo(-2.5, -2); ctx.lineTo(0, 10); ctx.lineTo(2.5, -2); ctx.stroke();
    ctx.fillStyle = P['glass-hi'];
    ell(ctx, -2.5, -5, 1.6, 1.1);
    ctx.fill();
  });

  // pier: deck from x -430 to 20, posts every 70 down into the water
  single(scene, 'pier', 460, 68, ctx => {
    ctx.translate(4, 4);
    for (let px = -400; px <= 0; px += 70) {
      rrect(ctx, px + 430 - 1, 8, 9, 52, 2);
      ink(ctx, P['pier-dark']);
    }
    rrect(ctx, 0, 0, 450, 11, 3);
    ink(ctx, P.pier);
    ctx.strokeStyle = 'rgba(22,35,59,.4)';
    ctx.lineWidth = 1.3;
    for (let px = 30; px < 450; px += 30) { ctx.beginPath(); ctx.moveTo(px, 1.5); ctx.lineTo(px, 9.5); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,.3)';
    ctx.fillRect(3, 2, 444, 2);
  });
}
