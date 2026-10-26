import Phaser from 'phaser';
import { TEX_RES, canvasTexture, glowTexture } from '../core/tex';
import { OUTLINE, P, laneKey } from './palette';
import type { Rect } from './sim';
import { boatSilhouette, drawBoat } from './skins';

/** The equipped boat style (shop); set before building themed textures. */
let boatSkin = 'classic';
export function setBoatSkin(id: string) { boatSkin = id; }

// Cartoon art, drawn once into textures with the canvas API and rendered as Phaser images.
// Every sprite gets the kit's bold navy outline. "Neutral" textures are white (tinted per use);
// "themed" textures bake in the day/night palette and are rebuilt when the colour scheme changes.

export const DOT_R = 4;        // 'dot' radius
export const DROP_R = 4;       // 'drop' radius (outlined dot)
export const RING_R = 12;      // 'ring' radius (wake)
export const SHOCK_R = 20;     // 'shock' radius (outlined ring)
export const DISC_R = 26;      // 'target' radius (= dock capture radius)
export const DOCK_TEX_R = 35;  // outer radius of the life-ring dock art (DOCK_R is 32)
export const GLOW_SIZE = 64;
export const PAD_R = 20;
export const ROCK_R = 24;
export const ROCK_VARIANTS = 4;
export const SHIMMER_LEN = 24;
export const REED_H = 28;
export const ROCK_ORIGIN = 30 / 64;
export const DOCK_TEX = DOCK_TEX_R * 2 + 12;
const KOI_W = 40, KOI_H = 22, KOI_VARIANTS = 3;
export const FLOE_R = 30, FLOE_VARIANTS = 3;

const OW = 2.5; // outline width in logical px

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
}

export function hash(n: number) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

/**
 * Soft blurred silhouette of `path` (a contact shadow). Uses the off-canvas shadow trick so it
 * works in every browser (canvas `filter` isn't available in older Safari). Shadow blur and
 * offset are in device pixels, so they're scaled by TEX_RES.
 */
function softShadow(ctx: CanvasRenderingContext2D, path: () => void, blur: number, color = 'rgba(12,24,48,1)') {
  ctx.save();
  ctx.translate(-4000, 0);
  ctx.shadowColor = color;
  ctx.shadowBlur = blur * TEX_RES;
  ctx.shadowOffsetX = 4000 * TEX_RES;
  ctx.fillStyle = '#000';
  path();
  ctx.fill();
  ctx.restore();
}

function outline(ctx: CanvasRenderingContext2D, w = OW) {
  ctx.lineWidth = w; ctx.strokeStyle = OUTLINE; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.stroke();
}

/** White textures, independent of theme. Built once in Boot. */
export function buildNeutralTextures(scene: Phaser.Scene) {
  glowTexture(scene, 'glow', GLOW_SIZE);
  canvasTexture(scene, 'dot', DOT_R * 2, DOT_R * 2, ctx => {
    ctx.fillStyle = '#fff'; circle(ctx, DOT_R, DOT_R, DOT_R); ctx.fill();
  });
  // outlined droplet: tinting keeps the navy outline dark and colours the fill
  canvasTexture(scene, 'drop', DROP_R * 2 + 2, DROP_R * 2 + 2, ctx => {
    circle(ctx, DROP_R + 1, DROP_R + 1, DROP_R - 0.4); ctx.fillStyle = '#fff'; ctx.fill(); outline(ctx, 1.5);
  });
  canvasTexture(scene, 'ring', RING_R * 2 + 4, RING_R * 2 + 4, ctx => {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.8; circle(ctx, RING_R + 2, RING_R + 2, RING_R); ctx.stroke();
  });
  canvasTexture(scene, 'shock', SHOCK_R * 2 + 8, SHOCK_R * 2 + 8, ctx => {
    circle(ctx, SHOCK_R + 4, SHOCK_R + 4, SHOCK_R); outline(ctx, 5.5);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.8; ctx.stroke();
  });
  canvasTexture(scene, 'confetti', 9, 13, ctx => {
    ctx.beginPath(); ctx.roundRect(2, 2, 5, 9, 1.6); ctx.fillStyle = '#fff'; ctx.fill(); outline(ctx, 1.3);
  });
  canvasTexture(scene, 'star', 18, 18, ctx => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3.2 : 7.2;
      ctx.lineTo(9 + Math.cos(a) * r, 9.5 + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); outline(ctx, 1.5);
  });
  // inner target of a dock: a thin ring and an outlined centre dot (tinted with the lane colour)
  canvasTexture(scene, 'target', DISC_R * 2, DISC_R * 2, ctx => {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.6; circle(ctx, DISC_R, DISC_R, 16); ctx.stroke();
    circle(ctx, DISC_R, DISC_R, 5); ctx.fillStyle = '#fff'; ctx.fill(); outline(ctx, 1.8);
  });
  canvasTexture(scene, 'shimmer', SHIMMER_LEN + 2, 4, ctx => {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(1, 2); ctx.lineTo(SHIMMER_LEN + 1, 2); ctx.stroke();
  });
  // power-up bubbles: snowflake = freeze timers, heart = extra life
  const bubble = (key: string, icon: (ctx: CanvasRenderingContext2D) => void, tint: string) => canvasTexture(scene, key, 40, 40, ctx => {
    circle(ctx, 20, 20, 16); ctx.fillStyle = tint; ctx.fill(); outline(ctx, 2.6);
    ctx.save(); circle(ctx, 20, 20, 16); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,.55)'; circle(ctx, 14, 13, 8); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.translate(20, 20.5); icon(ctx); ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(20, 20, 12, 3.6, 4.4); ctx.stroke();
  });
  bubble('pu_freeze', ctx => {
    for (const pass of [0, 1]) {
      ctx.strokeStyle = pass ? '#ffffff' : OUTLINE; ctx.lineWidth = pass ? 2 : 4.4; ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        const a = k * Math.PI / 3;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * -8, Math.sin(a) * -8); ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8); ctx.stroke();
      }
    }
  }, '#5cc8ff');
  bubble('pu_life', ctx => {
    ctx.beginPath();
    ctx.moveTo(0, 7); ctx.bezierCurveTo(-10, 0, -7, -9, 0, -4); ctx.bezierCurveTo(7, -9, 10, 0, 0, 7); ctx.closePath();
    ctx.fillStyle = '#ff4f7b'; ctx.fill(); outline(ctx, 2);
  }, '#ffd1dc');

  // contact shadows (white, tinted dark at runtime so both themes can share them)
  // a drifting leaf for the Wind twist
  canvasTexture(scene, 'windleaf', 16, 10, ctx => {
    ctx.beginPath(); ctx.moveTo(1.5, 5); ctx.quadraticCurveTo(8, -1, 14.5, 5); ctx.quadraticCurveTo(8, 11, 1.5, 5); ctx.closePath();
    ctx.fillStyle = '#7fd36a'; ctx.fill(); outline(ctx, 1.3);
    ctx.strokeStyle = '#3f9a44'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(3, 5); ctx.lineTo(13, 5); ctx.stroke();
  });
  // a slanted rain streak (falls down and a little left)
  canvasTexture(scene, 'raindrop', 6, 22, ctx => {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(4.5, 1.5); ctx.lineTo(1.5, 20.5); ctx.stroke();
  });

  // koi seen from above, nose to +x: white body with orange, red or gold patches, fins and a tail
  const KOI = [['#fffaf2', '#ff8a2a'], ['#fffaf2', '#e8413a'], ['#ffd23f', '#ff9a1f']];
  for (let v = 0; v < KOI_VARIANTS; v++) {
    canvasTexture(scene, 'koi' + v, KOI_W, KOI_H, ctx => {
      const [body, spot] = KOI[v];
      ctx.translate(KOI_W / 2 + 2, KOI_H / 2);
      const fin = (y: number) => { ctx.beginPath(); ctx.ellipse(3, y, 4.5, 2.6, y > 0 ? 0.6 : -0.6, 0, Math.PI * 2); };
      for (const y of [-6.5, 6.5]) { fin(y); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill(); outline(ctx, 1.4); }
      const tail = () => { ctx.beginPath(); ctx.moveTo(-9, 0); ctx.quadraticCurveTo(-15, -6, -19, -6.5); ctx.quadraticCurveTo(-15, 0, -19, 6.5); ctx.quadraticCurveTo(-15, 6, -9, 0); ctx.closePath(); };
      tail(); ctx.fillStyle = spot; ctx.fill(); outline(ctx, 1.6);
      const shape = () => { ctx.beginPath(); ctx.ellipse(1, 0, 12, 5.6, 0, 0, Math.PI * 2); };
      shape(); ctx.fillStyle = body; ctx.fill();
      ctx.save(); shape(); ctx.clip();
      ctx.fillStyle = spot;
      circle(ctx, 7, -2, 4.2); ctx.fill(); circle(ctx, -2, 2.5, 3.6); ctx.fill(); circle(ctx, -7, -2, 2.4); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(2, -2.8, 7, 1.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      shape(); outline(ctx, 1.8);
      for (const y of [-2.6, 2.6]) { circle(ctx, 10, y, 1.1); ctx.fillStyle = OUTLINE; ctx.fill(); }
    });
  }

  // ice floes: chunky pale slabs with a bright top face and a few cracks
  for (let v = 0; v < FLOE_VARIANTS; v++) {
    const S = FLOE_R * 2 + 12;
    canvasTexture(scene, 'floe' + v, S, S, ctx => {
      const c = S / 2, n = 7 + v, seed = 1.7 + v * 2.3;
      const shape = (ox = 0, oy = 0, k = 1) => {
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const a = i / n * Math.PI * 2 + seed, rr = FLOE_R * k * (0.82 + 0.18 * hash(i * 3.3 + seed));
          ctx.lineTo(c + ox + Math.cos(a) * rr, c + oy + Math.sin(a) * rr);
        }
        ctx.closePath();
      };
      ctx.globalAlpha = 0.35; softShadow(ctx, () => shape(2, 4), 3); ctx.globalAlpha = 1;
      shape(); ctx.fillStyle = '#bfe6f7'; ctx.fill();
      shape(-1.5, -2.5, 0.84); ctx.fillStyle = '#f4fcff'; ctx.fill();
      ctx.strokeStyle = 'rgba(95,160,200,.6)'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(c - 10, c - 4); ctx.lineTo(c - 2, c + 1); ctx.lineTo(c + 3, c + 9); ctx.moveTo(c - 2, c + 1); ctx.lineTo(c + 9, c - 3); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.ellipse(c - 9, c - 11, 6, 2.2, -0.4, 0, Math.PI * 2); ctx.fill();
      shape(); outline(ctx);
    });
  }

  canvasTexture(scene, 'docksh', DOCK_TEX, DOCK_TEX, ctx => {
    const c = DOCK_TEX / 2;
    softShadow(ctx, () => { ctx.beginPath(); ctx.arc(c, c, DOCK_TEX_R, 0, Math.PI * 2); ctx.arc(c, c, DISC_R, 0, Math.PI * 2, true); }, 3, '#fff');
  });
}

const THEMED = ['boat0', 'boat1', 'boat2', 'boatG', 'boatsh', 'barge0', 'barge1', 'barge2', 'bargesh', 'dock0', 'dock1', 'dock2', 'pad', 'flower', 'reed', 'cattail',
  ...Array.from({ length: ROCK_VARIANTS }, (_, i) => 'rock' + i)];

/** Palette-dependent textures. Callers must destroy images using them before rebuilding. */
export function buildThemedTextures(scene: Phaser.Scene) {
  for (const k of THEMED) if (scene.textures.exists(k)) scene.textures.remove(k);

  // boats in the equipped style (see skins.ts), one per lantern colour plus the golden bonus boat
  for (let ci = 0; ci < 3; ci++) canvasTexture(scene, 'boat' + ci, 46, 30, ctx => { ctx.translate(23, 15); drawBoat(ctx, boatSkin, { lamp: P[laneKey(ci)] }); });
  canvasTexture(scene, 'boatG', 46, 30, ctx => { ctx.translate(23, 15); drawBoat(ctx, boatSkin, { lamp: P.c1, gold: true }); });
  // soft contact shadow in the style's silhouette (white, tinted dark at runtime)
  canvasTexture(scene, 'boatsh', 50, 36, ctx => softShadow(ctx, () => { ctx.save(); ctx.translate(25, 18); boatSilhouette(ctx, boatSkin); ctx.restore(); }, 2.5, '#fff'));

  // barges: a wooden raft stacked with crates, the same whatever boat style is equipped
  for (let ci = 0; ci < 3; ci++) canvasTexture(scene, 'barge' + ci, 46, 30, ctx => { ctx.translate(23, 15); drawBarge(ctx, P[laneKey(ci)]); });
  canvasTexture(scene, 'bargesh', 50, 36, ctx => softShadow(ctx, () => { ctx.save(); ctx.translate(25, 18); bargeHull(ctx); ctx.restore(); }, 2.5, '#fff'));

  // life-ring docks: lane colour with four white bands; the inner edge is the capture radius
  for (let ci = 0; ci < 3; ci++) {
    canvasTexture(scene, 'dock' + ci, DOCK_TEX, DOCK_TEX, ctx => {
      const c = DOCK_TEX / 2, ro = DOCK_TEX_R, ri = DISC_R;
      ctx.beginPath(); ctx.arc(c, c, ro, 0, Math.PI * 2); ctx.arc(c, c, ri, 0, Math.PI * 2, true);
      ctx.fillStyle = P[laneKey(ci)]; ctx.fill();
      ctx.fillStyle = '#fff';
      for (let k = 0; k < 4; k++) {
        const a0 = k * Math.PI / 2 + Math.PI / 4 - 0.3, a1 = a0 + 0.6;
        ctx.beginPath(); ctx.arc(c, c, ro, a0, a1); ctx.arc(c, c, ri, a1, a0, true); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.4; ctx.stroke();
      }
      // inner bevel so the ring reads as chunky
      ctx.strokeStyle = 'rgba(22,35,59,.18)'; ctx.lineWidth = 2.5; circle(ctx, c, c, ri + 2); ctx.stroke();
      circle(ctx, c, c, ro); outline(ctx);
      circle(ctx, c, c, ri); outline(ctx);
    });
  }

  // lily pad with a notch and veins (rotated per pad)
  canvasTexture(scene, 'pad', PAD_R * 2 + 6, PAD_R * 2 + 6, ctx => {
    const c = PAD_R + 3, R = PAD_R;
    const shape = () => { ctx.beginPath(); ctx.moveTo(c, c); ctx.arc(c, c, R, 0.35, Math.PI * 2 - 0.05); ctx.closePath(); };
    shape(); ctx.fillStyle = P.pad; ctx.fill();
    ctx.save(); shape(); ctx.clip();
    ctx.globalAlpha = 0.6; ctx.fillStyle = P['pad-hi']; circle(ctx, c - R * 0.28, c - R * 0.28, R * 0.58); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(22,35,59,.2)'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    for (const a of [1.2, 2.3, 3.4, 4.5, 5.6]) { ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(c + Math.cos(a) * R * 0.8, c + Math.sin(a) * R * 0.8); ctx.stroke(); }
    ctx.restore();
    shape(); outline(ctx, 2.3);
  });
  canvasTexture(scene, 'flower', 24, 24, ctx => {
    const c = 12;
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * Math.PI * 2 - Math.PI / 2;
      ctx.save(); ctx.translate(c + Math.cos(a) * 4.2, c + Math.sin(a) * 4.2); ctx.rotate(a);
      ctx.beginPath(); ctx.ellipse(0, 0, 3.6, 2.8, 0, 0, Math.PI * 2);
      ctx.fillStyle = P.c2; ctx.fill(); outline(ctx, 1.4);
      ctx.restore();
    }
    circle(ctx, c, c, 2.7); ctx.fillStyle = P.c1; ctx.fill(); outline(ctx, 1.3);
  });

  // reed tufts (outlined blades), growing up from the bottom centre; cattail variant has a seed head
  const blades = (ctx: CanvasRenderingContext2D) => {
    for (const pass of [0, 1]) {
      ctx.strokeStyle = pass ? P.reed : OUTLINE; ctx.lineWidth = pass ? 2.3 : 4.6; ctx.lineCap = 'round';
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath(); ctx.moveTo(9 + k * 2.5, REED_H - 2);
        ctx.quadraticCurveTo(9 + k * 3, 14, 9 + k * 5.5, 4 + Math.abs(k) * 4); ctx.stroke();
      }
    }
  };
  canvasTexture(scene, 'reed', 18, REED_H, ctx => blades(ctx));
  canvasTexture(scene, 'cattail', 18, REED_H, ctx => {
    blades(ctx);
    ctx.beginPath(); ctx.roundRect(6.8, 1.5, 4.4, 10, 2.2); ctx.fillStyle = '#9a5b34'; ctx.fill(); outline(ctx, 1.6);
  });

  // chunky cel-shaded rocks with a baked contact shadow
  const seeds = [1.3, 3.7, 6.1, 8.9];
  for (let v = 0; v < ROCK_VARIANTS; v++) {
    canvasTexture(scene, 'rock' + v, 64, 64, ctx => {
      const R = ROCK_R, c = 30, seed = seeds[v];
      const shape = (ox = 0, oy = 0) => {
        const pts: [number, number][] = [];
        for (let i = 0; i < 12; i++) {
          const a = i / 12 * Math.PI * 2, rr = R * (0.86 + 0.14 * Math.sin(a * 3 + seed));
          pts.push([c + ox + Math.cos(a) * rr, c + oy + Math.sin(a) * rr * 0.92]);
        }
        ctx.beginPath();
        const mid = (i: number) => [(pts[i][0] + pts[(i + 1) % 12][0]) / 2, (pts[i][1] + pts[(i + 1) % 12][1]) / 2];
        const m0 = mid(11); ctx.moveTo(m0[0], m0[1]);
        for (let i = 0; i < 12; i++) { const m = mid(i); ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
        ctx.closePath();
      };
      ctx.globalAlpha = 0.4; softShadow(ctx, () => shape(2, 4), 3); ctx.globalAlpha = 1;
      shape(); ctx.fillStyle = P.rock; ctx.fill();
      ctx.save(); shape(); ctx.clip();
      ctx.fillStyle = 'rgba(22,35,59,.22)'; circle(ctx, c + R * 0.3, c + R * 0.45, R * 1.0); ctx.fill();
      ctx.fillStyle = P.rock; circle(ctx, c - R * 0.16, c - R * 0.2, R * 0.78); ctx.fill();
      ctx.fillStyle = P['rock-hi'];
      ctx.beginPath(); ctx.ellipse(c - R * 0.36, c - R * 0.4, R * 0.3, R * 0.17, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      shape(); outline(ctx);
    });
  }
}

function bargeHull(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(20, -6); ctx.quadraticCurveTo(22, 0, 20, 6); ctx.lineTo(16, 11); ctx.lineTo(-18, 11); ctx.lineTo(-19.5, 0); ctx.lineTo(-18, -11); ctx.lineTo(16, -11); ctx.closePath();
}

/** A barge at (0, 0), bow to +x: planks, two crates and the lane lantern. */
function drawBarge(ctx: CanvasRenderingContext2D, lamp: string) {
  bargeHull(ctx); ctx.fillStyle = '#c98a4b'; ctx.fill();
  ctx.save(); bargeHull(ctx); ctx.clip();
  ctx.strokeStyle = '#8f5a2c'; ctx.lineWidth = 1.3;
  for (const y of [-5.5, 0, 5.5]) { ctx.beginPath(); ctx.moveTo(-20, y); ctx.lineTo(22, y); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-20, -11, 42, 3);
  ctx.restore();
  bargeHull(ctx); outline(ctx);
  const crate = (x: number, y: number, s: number) => {
    ctx.beginPath(); ctx.roundRect(x - s, y - s, s * 2, s * 2, 1.5); ctx.fillStyle = '#e8b56a'; ctx.fill(); outline(ctx, 1.8);
    ctx.strokeStyle = '#a8713a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - s + 1.5, y - s + 1.5); ctx.lineTo(x + s - 1.5, y + s - 1.5); ctx.stroke();
  };
  crate(-11, -4, 4.6); crate(-10.5, 5, 4); crate(-3, -5.5, 3.4);
  // lantern on a little post near the bow
  circle(ctx, 9, 0, 5.4); ctx.fillStyle = lamp; ctx.fill(); outline(ctx, 2);
  ctx.fillStyle = 'rgba(255,255,255,.75)'; circle(ctx, 7.6, -1.6, 1.8); ctx.fill();
}

function pondPath(ctx: CanvasRenderingContext2D, p: Rect, grow = 0) {
  ctx.beginPath();
  const x = p.x - grow, y = p.y - grow, w = p.w + grow * 2, h = p.h + grow * 2, r = Math.max(0, p.r + grow);
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/**
 * Static backdrop (grass, bank, water, rim) for the current view size, at device resolution
 * capped to ~4.5 MP. Returns the resolution used, so the image can be scaled by 1/res.
 */
export function buildBackground(scene: Phaser.Scene, w: number, h: number, dpr: number, pond: Rect) {
  if (scene.textures.exists('bg')) scene.textures.remove('bg');
  const res = Math.max(0.5, Math.min(dpr, Math.sqrt(4.5e6 / (w * h))));
  const tex = scene.textures.createCanvas('bg', Math.ceil(w * res), Math.ceil(h * res))!;
  const ctx = tex.getContext();
  ctx.save();
  ctx.scale(res, res);
  ctx.fillStyle = P.shore; ctx.fillRect(0, 0, w, h);

  // grass tufts and tiny flowers on the shore
  const n = Math.round(90 * Math.max(1, (w * h) / (400 * 800)));
  ctx.strokeStyle = P['shore-dark']; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = hash(i) * w, y = hash(i + 50) * h, s = 3 + hash(i + 9) * 3;
    ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x, y); ctx.lineTo(x + s * 0.8, y - s * 1.2); ctx.stroke();
  }
  for (let i = 0; i < n / 6; i++) {
    const x = hash(i + 300) * w, y = hash(i + 400) * h;
    ctx.fillStyle = hash(i + 500) < 0.5 ? '#fff6d6' : P.c1;
    circle(ctx, x, y, 2.2); ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = OUTLINE; ctx.stroke();
  }

  // muddy bank around the water
  pondPath(ctx, pond, 9); ctx.fillStyle = P['shore-dark']; ctx.fill(); outline(ctx, 3);

  // water
  ctx.save();
  pondPath(ctx, pond); ctx.clip();
  const cx = pond.x + pond.w / 2;
  const g = ctx.createRadialGradient(cx, pond.y + pond.h * 0.42, 20, cx, pond.y + pond.h / 2, Math.max(pond.w, pond.h) * 0.75);
  g.addColorStop(0, P['water-in']); g.addColorStop(1, P['water-out']);
  ctx.fillStyle = g; ctx.fillRect(pond.x, pond.y, pond.w, pond.h);
  // depth shadow under the top bank, then a foam line just inside the rim
  ctx.save(); ctx.translate(0, 7); pondPath(ctx, pond, 4); ctx.lineWidth = 14; ctx.strokeStyle = 'rgba(22,35,59,.2)'; ctx.stroke(); ctx.restore();
  pondPath(ctx, pond, -6); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.stroke();
  ctx.restore();
  pondPath(ctx, pond); outline(ctx, 3);
  ctx.restore();
  tex.refresh();
  return res;
}

/** True if (x, y) lies inside the pond's rounded rectangle, with an extra inset. */
export function inPond(p: Rect, x: number, y: number, inset = 0) {
  const l = p.x + inset, r = p.x + p.w - inset, t = p.y + inset, b = p.y + p.h - inset;
  if (x < l || x > r || y < t || y > b) return false;
  const rr = Math.max(0, p.r - inset);
  const cx = Math.min(Math.max(x, l + rr), r - rr), cy = Math.min(Math.max(y, t + rr), b - rr);
  return Math.hypot(x - cx, y - cy) <= rr;
}
