import { P } from './palette';
import { STONE_LOOKS, type StoneLook } from './progress';

/**
 * The characters, in Skip's Golden Hour style: smooth flat stones with no outline, a soft shade
 * underneath, a tiny dot face and one lakeside accessory each (a beanie, swim goggles, a moss
 * moustache, a lily-pad cap, a ladybug). Plain canvas, no Phaser: the lake's sprite sheets (art.ts)
 * and the menus' portraits (ui.ts) both draw from here, so they always match.
 *
 * Frames: 0..7 are the spin (a soft shine slides round), 8..15 the same with happy closed eyes.
 */
export const SK_W = 48, SK_H = 44, SK_FRAMES = 8;
/** Where the stone's centre sits in the frame (the sprite's origin). */
export const SK_CX = 24, SK_CY = 27;

/** The deep plum of the faces and small details. */
const FACE = '#3d2e5c';

function ell(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}
function fill(ctx: CanvasRenderingContext2D, color: string) { ctx.fillStyle = color; ctx.fill(); }
function line(ctx: CanvasRenderingContext2D, pts: number[], lw: number, color = FACE) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.stroke();
}

/** The accessory, flat colour only (some sit on top, the goggles and moustache on the face). */
function accessory(ctx: CanvasRenderingContext2D, L: StoneLook, cx: number, cy: number, ex: number[], ey: number) {
  const top = cy - L.ry;
  switch (L.extra) {
    case 'hat': // a snug teal beanie with a soft yellow bobble
      ctx.beginPath();
      ctx.moveTo(cx - 10, top + 4.5);
      ctx.quadraticCurveTo(cx - 9, top - 7, cx - 1, top - 7);
      ctx.quadraticCurveTo(cx + 8, top - 7, cx + 9, top + 4);
      ctx.closePath();
      fill(ctx, '#46b6a6');
      ctx.beginPath(); ctx.rect(cx - 10.5, top + 1.5, 20, 3.4); fill(ctx, '#379a8c');
      ell(ctx, cx - 1, top - 8.5, 3, 3); fill(ctx, '#ffd27a');
      break;
    case 'goggles':
      line(ctx, [cx - L.rx + 3, ey - 0.5, ex[0] - 3, ey - 0.5], 2, '#4fa89a');
      ctx.beginPath(); ctx.roundRect(ex[0] - 3.8, ey - 3, ex[1] - ex[0] + 7.6, 6, 3); fill(ctx, 'rgba(95,214,192,.75)');
      break;
    case 'moss':
      line(ctx, [cx + 2.5, ey + 4.2, cx + 6.5, ey + 5.4, cx + 10.5, ey + 4.2], 3.4, '#6aa85a');
      for (const dx of [-12, -8]) line(ctx, [cx + dx, top + 2.5, cx + dx - 1, top - 2], 2.2, '#6aa85a');
      break;
    case 'lilypad':
      ell(ctx, cx - 2, top + 0.5, 11, 3.6, -0.06); fill(ctx, '#6fd08f');
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ell(ctx, cx - 4 + Math.cos(a) * 2.4, top - 2.6 + Math.sin(a) * 2.4, 2, 2); fill(ctx, '#ff9ec4');
      }
      ell(ctx, cx - 4, top - 2.6, 1.3, 1.3); fill(ctx, '#ffd27a');
      break;
    case 'ladybug': {
      const bx = cx - 3, by = top - 1.5;
      ell(ctx, bx + 4.4, by + 0.4, 2.2, 2); fill(ctx, FACE);
      ell(ctx, bx, by, 4.8, 3.9); fill(ctx, '#ff5a5a');
      for (const [dx, dy] of [[-2.4, -0.8], [2, -1.4], [-1.6, 1.8], [2.4, 1.6]]) { ell(ctx, bx + dx, by + dy, 0.9, 0.9); fill(ctx, FACE); }
      break;
    }
  }
}

/** One character frame into a SK_W × SK_H box. */
export function drawSkipper(ctx: CanvasRenderingContext2D, L: StoneLook, f: number) {
  const ph = ((f % SK_FRAMES) / SK_FRAMES) * Math.PI * 2;
  const happy = f >= SK_FRAMES;
  const cx = SK_CX, cy = SK_CY, rx = L.rx, ry = L.ry;
  const body = L.body ?? P.stone ?? '#d8d3e0';

  // the stone: one flat colour, a soft shade underneath and a gentle shine sliding round as it spins
  ell(ctx, cx, cy, rx, ry);
  fill(ctx, body);
  ctx.save();
  ell(ctx, cx, cy, rx, ry);
  ctx.clip();
  ell(ctx, cx - 3, cy + ry * 0.5, rx * 0.88, ry * 0.52);
  fill(ctx, L.shade ?? 'rgba(61,46,92,.16)');
  ell(ctx, cx - 3 + Math.cos(ph) * 5, cy - ry * 0.55, 5.5, 1.8);
  fill(ctx, 'rgba(255,255,255,.4)');
  ctx.restore();

  // a tiny dot face, at the front (it faces the way it flies)
  const ex = [cx + 4, cx + 10.5], ey = cy - ry * 0.12;
  if (happy) {
    for (const x of ex) line(ctx, [x - 1.8, ey + 0.6, x, ey - 1.2, x + 1.8, ey + 0.6], 1.6);
  } else if (L.eyes === 'sleepy') {
    for (const x of ex) line(ctx, [x - 2, ey, x + 2, ey], 2);
  } else {
    for (const x of ex) { ell(ctx, x, ey, 1.9, 2.1); fill(ctx, FACE); }
  }
  ctx.fillStyle = 'rgba(255,120,150,.35)';
  ell(ctx, ex[0] - 2.4, ey + 3.2, 1.8, 1); ctx.fill();
  ell(ctx, ex[1] + 2.6, ey + 3.2, 1.8, 1); ctx.fill();
  const mx = cx + 7.2, my = ey + 3.8;
  switch (happy ? 'grin' : L.mouth) {
    case 'smile': line(ctx, [mx - 2, my - 0.3, mx, my + 1.1, mx + 2, my - 0.3], 1.4); break;
    case 'flat': if (L.extra !== 'moss') line(ctx, [mx - 2, my, mx + 2, my], 1.4); break;
    case 'o': ell(ctx, mx, my + 0.4, 1.3, 1.5); fill(ctx, FACE); break;
    case 'grin': ctx.beginPath(); ctx.moveTo(mx - 2.4, my - 0.4); ctx.quadraticCurveTo(mx, my + 3, mx + 2.4, my - 0.4); ctx.closePath(); fill(ctx, FACE); break;
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
