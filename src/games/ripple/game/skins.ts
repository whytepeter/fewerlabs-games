import type { ShopItem } from '../../../core/meta';
import { OUTLINE, P } from './palette';

// Boat styles sold in the shop. Every style is drawn top-down, bow pointing +x, centred on
// (0, 0) inside a 46 x 30 box, with the lane colour as its lantern so docks stay readable.
// A golden bonus boat uses the same shape in gold.

export interface Skin extends ShopItem { blurb: string }

export const SKINS: Skin[] = [
  { id: 'classic', name: 'Paper boat', price: 0, blurb: 'The original.' },
  { id: 'crane', name: 'Origami crane', price: 150, blurb: 'Folded with care.' },
  { id: 'leaf', name: 'Lily leaf', price: 300, blurb: 'Fresh from the pond.' },
  { id: 'duck', name: 'Rubber duck', price: 600, blurb: 'Squeak squeak.' },
  { id: 'star', name: 'Starlight', price: 1200, blurb: 'Navy paper, gold folds.' },
];
export type SkinId = (typeof SKINS)[number]['id'];

type Ctx = CanvasRenderingContext2D;
export interface BoatLook { lamp: string; gold?: boolean }

const circle = (ctx: Ctx, x: number, y: number, r: number) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); };
function stroke(ctx: Ctx, w = 2.5) { ctx.lineWidth = w; ctx.strokeStyle = OUTLINE; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }

function eyes(ctx: Ctx, x: number, dy: number, r = 2.9) {
  for (const ey of [-dy, dy]) {
    circle(ctx, x, ey, r); ctx.fillStyle = '#fff'; ctx.fill(); stroke(ctx, 1.3);
    ctx.fillStyle = OUTLINE; circle(ctx, x + r * 0.35, ey, r * 0.53); ctx.fill();
    ctx.fillStyle = '#fff'; circle(ctx, x + r * 0.5, ey - r * 0.25, r * 0.2); ctx.fill();
  }
}
function lantern(ctx: Ctx, x: number, y: number, color: string, r = 5.3) {
  circle(ctx, x, y, r); ctx.fillStyle = color; ctx.fill(); stroke(ctx, 2);
  ctx.fillStyle = 'rgba(255,255,255,.75)'; circle(ctx, x - r * 0.27, y - r * 0.3, r * 0.34); ctx.fill();
}
function gloss(ctx: Ctx, path: () => void) {
  ctx.save(); path(); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(-22, -14, 44, 6);
  ctx.restore();
}
function shade(ctx: Ctx, path: () => void) {
  ctx.save(); path(); ctx.clip();
  ctx.fillStyle = 'rgba(22,35,59,.10)'; ctx.fillRect(-22, 1, 44, 14);
  ctx.restore();
}

const GOLD = { body: '#ffd23f', fold: '#e0a500', lamp: '#fff8d6' };

/* ---------- silhouettes (also used for the soft contact shadow) */
const hull = (ctx: Ctx) => {
  ctx.beginPath();
  ctx.moveTo(18, 0); ctx.lineTo(7, 9.5); ctx.lineTo(-12, 9.5); ctx.lineTo(-16.5, 0); ctx.lineTo(-12, -9.5); ctx.lineTo(7, -9.5); ctx.closePath();
};
const crane = (ctx: Ctx) => {
  ctx.beginPath();
  ctx.moveTo(20, -1.5); ctx.lineTo(13, 0.5); ctx.lineTo(8, 2.5); ctx.lineTo(5, 12); ctx.lineTo(-3, 3.5);
  ctx.lineTo(-17, 3); ctx.lineTo(-11, 0); ctx.lineTo(-17, -3); ctx.lineTo(-3, -3.5); ctx.lineTo(5, -12); ctx.lineTo(8, -2.5); ctx.closePath();
};
const leaf = (ctx: Ctx) => {
  ctx.beginPath();
  ctx.moveTo(19, 0);
  ctx.bezierCurveTo(14, -11, -8, -12, -16, -4);
  ctx.lineTo(-11, 0); ctx.lineTo(-16, 4);
  ctx.bezierCurveTo(-8, 12, 14, 11, 19, 0); ctx.closePath();
};
const duck = (ctx: Ctx) => {
  ctx.beginPath(); ctx.ellipse(-3, 0, 14, 10.5, 0, 0, Math.PI * 2);
  ctx.moveTo(17, 0); ctx.arc(10.5, 0, 6.8, 0, Math.PI * 2);
};

export function boatSilhouette(ctx: Ctx, skin: string) {
  if (skin === 'crane') crane(ctx);
  else if (skin === 'leaf') leaf(ctx);
  else if (skin === 'duck') duck(ctx);
  else hull(ctx);
}

/** Draw one boat of a style at (0, 0). */
export function drawBoat(ctx: Ctx, skin: string, look: BoatLook) {
  const g = !!look.gold;
  const lamp = g ? GOLD.lamp : look.lamp;
  if (skin === 'crane') {
    const body = g ? GOLD.body : P.boat, fold = g ? GOLD.fold : P['boat-fold'];
    crane(ctx); ctx.fillStyle = body; ctx.fill();
    shade(ctx, () => crane(ctx));
    if (g) gloss(ctx, () => crane(ctx));
    ctx.strokeStyle = fold; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-3, -3.5); ctx.lineTo(5, -12); ctx.moveTo(-3, 3.5); ctx.lineTo(5, 12);
    ctx.moveTo(-15, 0); ctx.lineTo(12, 0); ctx.stroke();
    crane(ctx); stroke(ctx);
    // a single eye on the little head, and the lantern on its back
    circle(ctx, 16.2, -1.2, 1.5); ctx.fillStyle = OUTLINE; ctx.fill();
    lantern(ctx, 0, 0, lamp, 4.8);
    return;
  }
  if (skin === 'leaf') {
    const body = g ? GOLD.body : '#5fcf5a', vein = g ? GOLD.fold : '#2f8f3a';
    leaf(ctx); ctx.fillStyle = body; ctx.fill();
    ctx.save(); leaf(ctx); ctx.clip();
    ctx.fillStyle = g ? 'rgba(255,255,255,.45)' : '#9be87f'; ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.ellipse(2, -5, 12, 4, -0.05, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = vein; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(17, 0);
    for (const x of [-4, 3, 10]) { ctx.moveTo(x, 0); ctx.lineTo(x - 4, -6); ctx.moveTo(x, 0); ctx.lineTo(x - 4, 6); }
    ctx.stroke();
    leaf(ctx); stroke(ctx);
    eyes(ctx, 10.8, 3.7, 2.7);
    lantern(ctx, -1, 0, lamp, 5);
    return;
  }
  if (skin === 'duck') {
    const body = g ? GOLD.body : '#ffd84a', wing = g ? GOLD.fold : '#f2b624';
    duck(ctx); ctx.fillStyle = body; ctx.fill('nonzero');
    ctx.strokeStyle = wing; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(-5, -5.5, 6, 2.6, 0.15, 0, Math.PI * 2); ctx.moveTo(1, 5.5); ctx.ellipse(-5, 5.5, 6, 2.6, -0.15, 0, Math.PI * 2); ctx.stroke();
    if (g) gloss(ctx, () => duck(ctx));
    ctx.beginPath(); ctx.ellipse(-3, 0, 14, 10.5, 0, 0, Math.PI * 2); stroke(ctx);
    circle(ctx, 10.5, 0, 6.8); ctx.fillStyle = body; ctx.fill(); stroke(ctx);
    // beak
    ctx.beginPath(); ctx.moveTo(15.5, -3); ctx.quadraticCurveTo(22, 0, 15.5, 3); ctx.closePath();
    ctx.fillStyle = '#ff8a2a'; ctx.fill(); stroke(ctx, 1.6);
    eyes(ctx, 11, 3.2, 2.2);
    lantern(ctx, -6, 0, lamp, 4.8);
    return;
  }
  // classic paper boat, and Starlight (navy paper with gold folds and stars)
  const star = skin === 'star';
  const body = g ? GOLD.body : star ? '#2b3a6b' : P.boat;
  const fold = g ? GOLD.fold : star ? '#ffd23f' : P['boat-fold'];
  hull(ctx); ctx.fillStyle = body; ctx.fill();
  shade(ctx, () => hull(ctx));
  if (g) gloss(ctx, () => hull(ctx));
  ctx.strokeStyle = fold; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(16, 0); ctx.moveTo(-6, -9); ctx.lineTo(-1.5, 0); ctx.lineTo(-6, 9); ctx.stroke();
  if (star && !g) {
    ctx.fillStyle = '#fff3b8';
    for (const [x, y] of [[-10, -5], [-12, 5], [5, 6], [6, -6], [-4, 4.5]]) { circle(ctx, x, y, 0.9); ctx.fill(); }
  }
  hull(ctx); stroke(ctx);
  eyes(ctx, 10.6, 3.9);
  lantern(ctx, 1, 0, lamp);
}

/** A data-URL preview of a style for the shop row (drawn at 3x for crisp edges). */
export function skinPreview(skin: string, lamp = P.c1) {
  const c = document.createElement('canvas');
  c.width = 46 * 3; c.height = 30 * 3;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  ctx.scale(3, 3); ctx.translate(23, 15);
  drawBoat(ctx, skin, { lamp });
  return c.toDataURL();
}
