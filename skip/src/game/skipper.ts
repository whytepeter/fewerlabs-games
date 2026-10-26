import { P } from './palette';
import { STONE_LOOKS, type StoneLook } from './progress';

/**
 * The characters: painted river stones. A smooth, speckled skipping stone with a simple face painted
 * on (solid ink-dot eyes with a shine, rosy cheeks, a little mouth), a painted pattern on its side,
 * and one lakeside accessory: a bobble hat, swim goggles, a moss moustache, a lily-pad cap, a lucky
 * ladybug. Thick navy outlines so they read at thumb size. Plain canvas, no Phaser: the lake's
 * sprite sheets (art.ts) and the menus' portraits (ui.ts) both draw from here, so they always match.
 *
 * Frames: 0..7 are the spin (the shine slides round), 8..15 the same with happy closed eyes.
 */
export const SK_W = 48, SK_H = 44, SK_FRAMES = 8;
/** Where the stone's centre sits in the frame (the sprite's origin). */
export const SK_CX = 24, SK_CY = 27;

const OUT = '#16233b';
const LW = 2.4;

function ell(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}
function ink(ctx: CanvasRenderingContext2D, fill: string, lw = LW) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.stroke();
}
function line(ctx: CanvasRenderingContext2D, pts: number[], lw: number, color = OUT) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.stroke();
}
/** The same few speckles every frame (they're part of the stone, not the spin). */
const SPECKS = [[-8, 3, 0.9], [-4, 6, 0.7], [-10, -1, 0.6], [2, 7, 0.8], [-6, -5, 0.5], [6, 5, 0.6]];

/** The painted design on the stone's back half (clipped to the stone). */
function pattern(ctx: CanvasRenderingContext2D, L: StoneLook, cx: number, cy: number) {
  const { rx, ry } = L;
  ctx.globalAlpha = 0.9;
  switch (L.pattern) {
    case 'waves':
      for (const dy of [-0.15, 0.25]) {
        const y = cy + ry * dy;
        line(ctx, [cx - rx + 1, y, cx - rx + 5, y - 2, cx - rx + 9, y, cx - rx + 13, y - 2, cx - rx + 17, y], 1.6, L.paint);
      }
      break;
    case 'dots':
      for (const [dx, dy] of [[-10, -4], [-6, 1], [-11, 4], [-3, -6]]) { ell(ctx, cx + dx, cy + dy, 1.5, 1.5); ctx.fillStyle = L.paint; ctx.fill(); }
      break;
    case 'zigzag':
      line(ctx, [cx - rx, cy + 3, cx - rx + 4, cy - 1, cx - rx + 8, cy + 3, cx - rx + 12, cy - 1, cx - rx + 16, cy + 3, cx - rx + 20, cy - 1, cx + rx, cy + 3], 1.8, L.paint);
      break;
    case 'clover':
      for (const [dx, dy] of [[0, -1.8], [1.8, 0], [0, 1.8], [-1.8, 0]]) { ell(ctx, cx - 7 + dx, cy + 1 + dy, 1.7, 1.7); ctx.fillStyle = L.paint; ctx.fill(); }
      break;
  }
  ctx.globalAlpha = 1;
}

/** The accessory, drawn over the stone (some sit on top, the goggles and moustache on the face). */
function accessory(ctx: CanvasRenderingContext2D, L: StoneLook, cx: number, cy: number, ex: number[], ey: number) {
  const top = cy - L.ry;
  switch (L.extra) {
    case 'hat': {
      // a snug teal beanie with a knitted rib and a little yellow bobble on top
      ctx.beginPath();
      ctx.moveTo(cx - 10, top + 4.5);
      ctx.quadraticCurveTo(cx - 9, top - 6, cx - 1, top - 6.5);
      ctx.quadraticCurveTo(cx + 8, top - 6, cx + 9, top + 4);
      ctx.closePath();
      ink(ctx, '#3fb8a9', 2);
      for (const dx of [-5, 0, 5]) line(ctx, [cx + dx - 1, top - 4, cx + dx, top + 1], 1, 'rgba(22,35,59,.35)');
      ctx.beginPath(); ctx.moveTo(cx - 10.5, top + 2); ctx.lineTo(cx + 9.5, top + 1.5); ctx.lineTo(cx + 9.5, top + 5); ctx.lineTo(cx - 10.5, top + 5.5); ctx.closePath();
      ink(ctx, '#2a8f84', 1.8);
      ell(ctx, cx - 1, top - 7.5, 2.6, 2.6);
      ink(ctx, '#ffd23f', 1.6);
      break;
    }
    case 'goggles':
      line(ctx, [cx - L.rx + 2, ey - 1, ex[0] - 3.5, ey - 1], 2.2, '#16233b');
      for (const x of ex) { ell(ctx, x, ey, 4.3, 3.6); ink(ctx, 'rgba(120,220,200,.55)', 1.8); }
      line(ctx, [ex[0] + 3.6, ey, ex[1] - 3.6, ey], 1.8);
      break;
    case 'moss':
      // a soft moss moustache under the eyes
      for (const [dx, r] of [[-1.5, 2.2], [1.5, 2.6], [4.5, 2.6], [7.5, 2.2]]) { ell(ctx, cx + 3 + dx, ey + 3.4, r, 1.6); ctx.fillStyle = '#5aa04a'; ctx.fill(); }
      line(ctx, [cx + 1, ey + 4.6, cx + 6.5, ey + 5.6, cx + 12, ey + 4.6], 1.2, '#2f6e2a');
      for (const dx of [-12, -8]) line(ctx, [cx + dx, top + 2, cx + dx - 1, top - 2], 2.2, '#5aa04a');
      break;
    case 'lilypad': {
      // a lily-pad cap with a little pink flower
      ell(ctx, cx - 2, top + 1, 11, 4, -0.08);
      ink(ctx, '#5ccf7d', 2);
      line(ctx, [cx - 2, top + 1, cx + 7, top - 1], 1.4);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ell(ctx, cx - 4 + Math.cos(a) * 2.6, top - 2.5 + Math.sin(a) * 2.6, 2.2, 2.2);
        ink(ctx, '#ff9ec4', 1.2);
      }
      ell(ctx, cx - 4, top - 2.5, 1.4, 1.4);
      ctx.fillStyle = '#ffd23f'; ctx.fill();
      break;
    }
    case 'ladybug': {
      // a lucky ladybug riding on top
      const bx = cx - 3, by = top - 1.5;
      ell(ctx, bx + 4.6, by + 0.3, 2.4, 2.2);
      ink(ctx, OUT, 1);
      ell(ctx, bx, by, 5, 4);
      ink(ctx, '#ff4d4d', 1.8);
      line(ctx, [bx, by - 4, bx, by + 4], 1.2);
      for (const [dx, dy] of [[-2.5, -1], [2.2, -1.5], [-2, 2], [2.5, 1.8]]) { ell(ctx, bx + dx, by + dy, 0.9, 0.9); ctx.fillStyle = OUT; ctx.fill(); }
      break;
    }
  }
}

/** One character frame into a SK_W × SK_H box. */
export function drawSkipper(ctx: CanvasRenderingContext2D, L: StoneLook, f: number) {
  const ph = ((f % SK_FRAMES) / SK_FRAMES) * Math.PI * 2;
  const happy = f >= SK_FRAMES;
  const cx = SK_CX, cy = SK_CY, rx = L.rx, ry = L.ry;
  const body = L.body ?? P.stone ?? '#a9b3c2', hi = L.hi ?? P['stone-hi'] ?? '#e6ebf2';

  // the stone: smooth, a little flatter on the bottom, speckled, with a soft shine
  ell(ctx, cx, cy, rx, ry);
  ink(ctx, body, LW + 0.4);
  ctx.save();
  ell(ctx, cx, cy, rx, ry);
  ctx.clip();
  ctx.fillStyle = 'rgba(22,35,59,.16)';
  ell(ctx, cx - 1, cy + ry * 0.9, rx * 1.1, ry * 0.55);
  ctx.fill();
  ctx.fillStyle = 'rgba(22,35,59,.22)';
  for (const [dx, dy, r] of SPECKS) { ell(ctx, cx + dx * (rx / 14), cy + dy * (ry / 11), r, r); ctx.fill(); }
  pattern(ctx, L, cx, cy);
  ctx.fillStyle = hi;
  ell(ctx, cx - 4 + Math.cos(ph) * 5, cy - ry * 0.58, 5.5, 2);
  ctx.fill();
  ctx.restore();

  // the painted face, at the front (it faces the way it flies)
  const s = Math.min(1, ry / 11);
  const ex = [cx + 3, cx + 10], ey = cy - ry * 0.12;
  if (happy) {
    for (const x of ex) line(ctx, [x - 2.2, ey + 0.8, x, ey - 1.6, x + 2.2, ey + 0.8], 2);
  } else if (L.eyes === 'sleepy') {
    for (const x of ex) {
      ell(ctx, x, ey + 0.6, 2.2, 1.6); ctx.fillStyle = OUT; ctx.fill();
      line(ctx, [x - 2.8, ey - 0.6, x + 2.8, ey - 0.6], 1.6); // heavy lids
    }
  } else {
    const r = L.eyes === 'wide' ? 2.4 : 1.9;
    for (const x of ex) {
      ell(ctx, x, ey, r, r * 1.25 * s); ctx.fillStyle = OUT; ctx.fill();
      ell(ctx, x - 0.6, ey - 0.9 * s, 0.75, 0.75); ctx.fillStyle = '#ffffff'; ctx.fill();
    }
  }
  // rosy painted cheeks
  ctx.fillStyle = 'rgba(255,110,150,.5)';
  ell(ctx, ex[0] - 2.6, ey + 3.6, 2, 1.2); ctx.fill();
  ell(ctx, ex[1] + 2.8, ey + 3.6, 2, 1.2); ctx.fill();
  // mouth
  const mx = cx + 6.5, my = ey + 4.6;
  switch (happy ? 'grin' : L.mouth) {
    case 'smile': line(ctx, [mx - 2.4, my - 0.4, mx, my + 1.4, mx + 2.4, my - 0.4], 1.6); break;
    case 'flat': line(ctx, [mx - 2.2, my + 0.6, mx + 2.2, my + 0.6], 1.6); break;
    case 'o': ell(ctx, mx, my + 0.6, 1.5, 1.8); ink(ctx, '#ff6b8a', 1.2); break;
    case 'grin':
      ctx.beginPath(); ctx.moveTo(mx - 3, my - 0.6); ctx.quadraticCurveTo(mx, my + 3.8, mx + 3, my - 0.6); ctx.closePath();
      ink(ctx, '#ff6b8a', 1.4);
      break;
  }

  accessory(ctx, L, cx, cy, ex, ey);
}

/** A character portrait for the menus, as an image URL (drawn at 3× for crisp screens). */
export function portrait(id: string, happy = false, scale = 3) {
  const c = document.createElement('canvas');
  c.width = SK_W * scale; c.height = SK_H * scale;
  const ctx = c.getContext('2d')!;
  ctx.scale(scale, scale);
  drawSkipper(ctx, STONE_LOOKS[id] ?? STONE_LOOKS.pebble, happy ? SK_FRAMES : 0);
  return c.toDataURL();
}
