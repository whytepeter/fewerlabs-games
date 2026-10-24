import Phaser from 'phaser';
import { canvasTexture, glowTexture, sheetTexture, TEX_RES } from '../core/tex';
import { portraits, SKINS, type CharId, type Extra, type Skin } from '../game/skins';
import { TREASURES } from '../game/treasures';

const TAU = Math.PI * 2;
const OUT = '#16233b'; // cartoon outline, matches --k-outline
const LINE = 2.6;
/** Radius of the headlamp's light pool and the darkness texture's on-screen width (logical px). */
export const LIGHT_R = 300;
export const LIGHT_SPAN = 2 * (LIGHT_R + 2600);

type Ctx = CanvasRenderingContext2D;

/** Draws every sprite once into textures (cartoon style: bold outlines, faces), then starts the game. */
export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  create() {
    glowTexture(this);
    for (const skin of SKINS) this.makeDiver(skin);
    this.makePickups();
    this.makeJelly();
    this.makeMine();
    this.makeAngler();
    this.makeEel();
    this.makeAir();
    this.makeLight();
    this.makeParticles();
    this.makeTreasures();

    for (const skin of SKINS) this.anims.create({ key: `kick-${skin.id}`, frames: this.frames(`diver-${skin.id}`, 6), frameRate: 10, repeat: -1 });
    this.anims.create({ key: 'jelly', frames: this.frames('jelly', 6), frameRate: 7, repeat: -1 });
    this.anims.create({ key: 'eel', frames: this.frames('eel', 4), frameRate: 8, repeat: -1 });
    this.anims.create({ key: 'angler', frames: this.frames('angler', 2), frameRate: 6, repeat: -1 });

    // Pictures for the HTML menus (diver select, shop).
    for (const skin of SKINS) this.portrait(`diver-${skin.id}`, 82, 46);
    for (const key of ['pk-shield', 'pk-magnet', 'pk-life', 'pk-turbo', 'gd-airsaver', 'gd-headstart', 'gd-pearlpull', 'gd-coralguard', 'gd-luckyclam', 'gd-charm', 'bs-doubler', 'bs-charged']) this.portrait(key, 32, 32);
    this.portrait('air', 32, 32);
    this.portrait('shell', 30, 28);
    this.portrait('chest', 36, 32);
    for (const t of TREASURES) this.portrait(`tr-${t.id}`, 36, 36);

    this.scene.start('game');
  }

  /** Frame 0 of a texture (logical size w x h) as a data URL. */
  private portrait(key: string, w: number, h: number) {
    const src = this.textures.get(key).getSourceImage() as HTMLCanvasElement;
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * TEX_RES); c.height = Math.ceil(h * TEX_RES);
    c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height, 0, 0, c.width, c.height);
    portraits[key] = c.toDataURL();
  }

  private frames(key: string, n: number) {
    return Array.from({ length: n }, (_, i) => ({ key, frame: i }));
  }

  private makeDiver(skin: Skin) {
    // Drawn straight into the 82 x 46 frame, facing right, body around (42, 23). One sheet per
    // outfit; each character has its own drawing (see the draw* functions below the class).
    const draw = DRAW[skin.char ?? 'brass'];
    sheetTexture(this, `diver-${skin.id}`, 82, 46, 6, (ctx, i) => {
      setup(ctx);
      draw(ctx, Math.sin((i / 6) * TAU), i / 6, skin);
    });
  }

  /** Shop icons for the gadgets, one 32x32 badge each. */
  private makeGadgets() {
    const badge = (key: string, bg: string, draw: (ctx: Ctx) => void) => canvasTexture(this, key, 32, 32, ctx => {
      setup(ctx); ctx.translate(16, 16);
      ctx.beginPath(); ctx.arc(0, 0, 13.5, 0, TAU); fillOut(ctx, bg, 2.4);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-4, -7, 6, 3, -0.4, 0, TAU); ctx.fill();
      draw(ctx);
    });
    badge('gd-airsaver', '#33dcb8', ctx => {
      roundRect(ctx, -4.5, -7, 9, 15, 4); fillOut(ctx, '#eef4f9', 2);
      ctx.beginPath(); ctx.arc(0, 1, 2.6, 0, TAU); fillOut(ctx, '#ffd23f', 1.6);
      roundRect(ctx, -1.6, -10, 3.2, 3.4, 1); fillOut(ctx, '#8796a8', 1.6);
    });
    badge('gd-headstart', '#3aa8ff', ctx => {
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(7, -5); ctx.quadraticCurveTo(7, 4, 0, 8.5); ctx.quadraticCurveTo(-7, 4, -7, -5); ctx.closePath();
      fillOut(ctx, '#eef4f9', 2);
      ctx.beginPath(); ctx.moveTo(1.5, -5); ctx.lineTo(-2.5, 1); ctx.lineTo(0.5, 1); ctx.lineTo(-1.5, 6); ctx.lineTo(3, -0.5); ctx.lineTo(0, -0.5); ctx.closePath();
      fillOut(ctx, '#ffd23f', 1.4);
    });
    badge('gd-pearlpull', '#9b6bff', ctx => {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      for (const r of [8.5, 5.8]) { ctx.beginPath(); ctx.arc(0, 0, r, -2.4, -0.7); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r, 0.7, 2.4); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(0, 0, 3.6, 0, TAU); fillOut(ctx, '#fbeaff', 1.8);
    });
    badge('gd-coralguard', '#ff7aa8', ctx => {
      ctx.lineWidth = 4.6; ctx.strokeStyle = OUT;
      const branch = () => { ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, -2); ctx.moveTo(0, 2); ctx.lineTo(-5, -4); ctx.moveTo(0, 0); ctx.lineTo(5, -6); ctx.moveTo(0, -2); ctx.lineTo(0, -8); ctx.stroke(); };
      branch(); ctx.lineWidth = 2.4; ctx.strokeStyle = '#ffd0da'; branch();
    });
    badge('gd-luckyclam', '#ffc43d', ctx => {
      ctx.beginPath(); ctx.moveTo(-8, 2); ctx.quadraticCurveTo(0, -11, 8, 2); ctx.closePath(); fillOut(ctx, '#ffe8f0', 2);
      ctx.beginPath(); ctx.moveTo(-8, 2); ctx.quadraticCurveTo(0, 9, 8, 2); ctx.closePath(); fillOut(ctx, '#ffb3c8', 2);
      ctx.beginPath(); ctx.arc(0, 1.5, 2.6, 0, TAU); fillOut(ctx, '#ffffff', 1.4);
    });
    badge('gd-charm', '#ff9f43', ctx => {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 3.6 : 8.4, a = -Math.PI / 2 + (i * Math.PI) / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); fillOut(ctx, '#fff59d', 2);
    });
    // Boosters: two stacked coins with "x2", and a full battery-style charge bolt.
    badge('bs-doubler', '#3ad06b', ctx => {
      for (const [x, y] of [[-2.5, 2.5], [2.5, -2.5]]) { ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); fillOut(ctx, '#ffd23f', 2); }
      ctx.fillStyle = OUT; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('x2', 2.5, -2.2);
    });
    badge('bs-charged', '#9b6bff', ctx => {
      ctx.beginPath(); ctx.moveTo(2, -9); ctx.lineTo(-5, 1.5); ctx.lineTo(-0.5, 1.5); ctx.lineTo(-2.5, 9); ctx.lineTo(5, -2); ctx.lineTo(0.5, -2); ctx.closePath();
      fillOut(ctx, '#ffe27a', 2);
    });
  }

  private makePickups() {
    const bubble = (ctx: Ctx) => {
      ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); fillOut(ctx, 'rgba(210,248,255,.6)', 2.4);
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.ellipse(-6, -7, 3.4, 2, -0.6, 0, TAU); ctx.fill();
    };
    canvasTexture(this, 'pearl', 22, 22, ctx => {
      setup(ctx); ctx.translate(11, 11);
      // A real pearl: creamy pink with a blue-green sheen on one side.
      const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, 8.5);
      g.addColorStop(0, '#fffaf2'); g.addColorStop(0.45, '#ffd9ec'); g.addColorStop(0.8, '#f59ccb'); g.addColorStop(1, '#c86fb0');
      ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, TAU); fillOut(ctx, g, 2.4);
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 6.3, 0, TAU); ctx.clip();
      const sheen = ctx.createLinearGradient(2, 6, 6, -2);
      sheen.addColorStop(0, 'rgba(120,230,255,.75)'); sheen.addColorStop(1, 'rgba(120,230,255,0)');
      ctx.fillStyle = sheen; ctx.beginPath(); ctx.arc(3.5, 3.5, 5, 0, TAU); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-2.6, -2.8, 2.4, 1.5, -0.6, 0, TAU); ctx.fill();
    });
    canvasTexture(this, 'pk-shield', 32, 32, ctx => {
      setup(ctx); ctx.translate(16, 16); bubble(ctx);
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(7, -5); ctx.quadraticCurveTo(7, 4, 0, 8.5); ctx.quadraticCurveTo(-7, 4, -7, -5); ctx.closePath();
      fillOut(ctx, '#3aa8ff', 2.2);
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.6, -4); ctx.quadraticCurveTo(4.6, 2, 0, 5.6); ctx.closePath(); ctx.fill();
    });
    canvasTexture(this, 'pk-magnet', 32, 32, ctx => {
      setup(ctx); ctx.translate(16, 16); bubble(ctx);
      ctx.beginPath(); ctx.arc(0, -1, 6.5, Math.PI, 0, true); ctx.lineWidth = 9; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.lineWidth = 5; ctx.strokeStyle = '#ff4d6d'; ctx.stroke();
      ctx.fillStyle = '#dfe6ee'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
      for (const x of [-6.5, 6.5]) { ctx.beginPath(); ctx.rect(x - 2.6, -6, 5.2, 4.5); ctx.fill(); ctx.stroke(); }
    });
    canvasTexture(this, 'pk-life', 32, 32, ctx => {
      setup(ctx); ctx.translate(16, 16); bubble(ctx);
      ctx.beginPath(); ctx.moveTo(0, 7.5);
      ctx.bezierCurveTo(-9, 1, -7.5, -8, 0, -3.5);
      ctx.bezierCurveTo(7.5, -8, 9, 1, 0, 7.5);
      fillOut(ctx, '#ffd23f', 2.2);
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(-3.4, -3, 1.8, 1.1, -0.6, 0, TAU); ctx.fill();
    });
    canvasTexture(this, 'pk-turbo', 32, 32, ctx => {
      setup(ctx); ctx.translate(16, 16); bubble(ctx);
      // Two speed chevrons pointing forward.
      for (const x of [-4.5, 2]) {
        ctx.beginPath(); ctx.moveTo(x - 2.5, -7); ctx.lineTo(x + 4.5, 0); ctx.lineTo(x - 2.5, 7);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.lineWidth = 6.5; ctx.strokeStyle = OUT; ctx.stroke();
        ctx.lineWidth = 3.4; ctx.strokeStyle = x < 0 ? '#ffd23f' : '#ff7a2f'; ctx.stroke();
      }
    });
    // The Sea Heart (texture key 'shell', from when it was a Golden Shell): a faceted aqua heart gem.
    canvasTexture(this, 'shell', 30, 28, ctx => {
      setup(ctx); ctx.translate(15, 14.5);
      const heart = () => {
        ctx.beginPath(); ctx.moveTo(0, 10.5);
        ctx.bezierCurveTo(-6, 5.5, -12, 1, -11.5, -4.5);
        ctx.bezierCurveTo(-11, -10, -4, -11.5, 0, -6);
        ctx.bezierCurveTo(4, -11.5, 11, -10, 11.5, -4.5);
        ctx.bezierCurveTo(12, 1, 6, 5.5, 0, 10.5);
        ctx.closePath();
      };
      ctx.save(); ctx.shadowColor = 'rgba(95,240,255,.9)'; ctx.shadowBlur = 5; heart();
      const g = ctx.createLinearGradient(-8, -10, 8, 10); g.addColorStop(0, '#c9fbff'); g.addColorStop(0.45, '#3fd8f0'); g.addColorStop(1, '#0a7fb0');
      ctx.fillStyle = g; ctx.fill(); ctx.restore();
      heart(); ctx.lineWidth = 2.4; ctx.strokeStyle = OUT; ctx.stroke();
      // Facets: a centre line and two soft cuts, lighter on the lit side.
      ctx.save(); heart(); ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(-12, -4); ctx.lineTo(0, 10.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,60,110,.22)'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(12, -4); ctx.lineTo(0, 10.5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 10.5); ctx.moveTo(-11, -4.5); ctx.lineTo(11, -4.5); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.ellipse(-5.5, -6, 2.6, 1.4, -0.6, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(6.5, -6.5, 0.9, 0, TAU); ctx.fill();
    });
    canvasTexture(this, 'chest', 36, 32, ctx => {
      setup(ctx); ctx.translate(18, 17);
      // Lid, box, gold bands and lock.
      ctx.beginPath(); ctx.moveTo(-13, -2); ctx.lineTo(-13, -6); ctx.quadraticCurveTo(-13, -13, 0, -13); ctx.quadraticCurveTo(13, -13, 13, -6); ctx.lineTo(13, -2); ctx.closePath();
      fillOut(ctx, '#c9772f', 2.4);
      ctx.beginPath(); ctx.rect(-13, -2, 26, 14); fillOut(ctx, '#a95d22', 2.4);
      ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.8;
      for (const x of [-9, 6]) { ctx.beginPath(); ctx.rect(x, -12.5, 3, 24.5); ctx.fill(); ctx.stroke(); }
      ctx.beginPath(); ctx.rect(-3.5, -5, 7, 7); fillOut(ctx, '#ffd23f', 1.8);
      ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(0, -1.8, 1.2, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(-6, -9, 3, 1.4, -0.3, 0, TAU); ctx.fill();
    });
    canvasTexture(this, 'life-ring', 70, 70, ctx => {
      setup(ctx); ctx.translate(35, 35);
      ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU);
      ctx.setLineDash([7, 6]);
      ctx.lineWidth = 4.5; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#ffd23f'; ctx.stroke();
      ctx.setLineDash([]);
    });
    this.makeGadgets();
    canvasTexture(this, 'shield-ring', 70, 70, ctx => {
      setup(ctx); ctx.translate(35, 35);
      ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU);
      ctx.fillStyle = 'rgba(95,190,255,.18)'; ctx.fill();
      ctx.lineWidth = 4.5; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#8fd6ff'; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(-14, -18, 7, 3.5, -0.7, 0, TAU); ctx.fill();
    });
  }

  private makeJelly() {
    // Dome centred at (24, 20); tentacles hang below.
    sheetTexture(this, 'jelly', 48, 60, 6, (ctx, i) => {
      const t = (i / 6) * TAU, r = 15.5, pulse = 1 + Math.sin(t) * 0.08;
      setup(ctx);
      ctx.translate(24, 20);
      for (let j = -2; j <= 2; j++) {
        ctx.beginPath(); ctx.moveTo(j * r * 0.32, 0);
        for (let k = 1; k <= 5; k++) ctx.lineTo(j * r * 0.32 + Math.sin(t + k + j) * 3, k * r * 0.42 * (1.05 - Math.sin(t) * 0.05));
        ctx.strokeStyle = OUT; ctx.lineWidth = 5.2; ctx.stroke();
        ctx.strokeStyle = '#ff9fd6'; ctx.lineWidth = 2.4; ctx.stroke();
      }
      const g = ctx.createLinearGradient(0, -r, 0, 2);
      g.addColorStop(0, '#ffb0e0'); g.addColorStop(1, '#ff5fb3');
      ctx.beginPath(); ctx.ellipse(0, 0, r * pulse, (r * 0.9) / pulse, 0, Math.PI, TAU);
      for (let k = 0; k <= 6; k++) ctx.lineTo(r * pulse - (k / 6) * 2 * r * pulse, k % 2 ? 3.5 : 0);
      ctx.closePath(); fillOut(ctx, g);
      eye(ctx, -5, -6, 2.4); eye(ctx, 5, -6, 2.4);
      ctx.fillStyle = 'rgba(255,90,140,.55)';
      ctx.beginPath(); ctx.ellipse(-9, -2.5, 2.6, 1.6, 0, 0, TAU); ctx.ellipse(9, -2.5, 2.6, 1.6, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, -3.5, 2.4, 0.2, Math.PI - 0.2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(-7, -11, 4, 2, -0.5, 0, TAU); ctx.fill();
    });
  }

  private makeMine() {
    canvasTexture(this, 'mine', 54, 54, ctx => {
      const r = 14;
      setup(ctx);
      ctx.translate(27, 27);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + 0.2, tx = Math.cos(a) * r * 1.45, ty = Math.sin(a) * r * 1.45;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8); ctx.lineTo(tx, ty);
        ctx.strokeStyle = OUT; ctx.lineWidth = 6; ctx.stroke();
        ctx.strokeStyle = '#8a98a8'; ctx.lineWidth = 2.6; ctx.stroke();
        ctx.beginPath(); ctx.arc(tx, ty, 3.2, 0, TAU); fillOut(ctx, '#ffcf3f', 2);
      }
      const g = ctx.createRadialGradient(-5, -6, 2, 0, 0, r);
      g.addColorStop(0, '#7d8ea0'); g.addColorStop(1, '#3a4756');
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); fillOut(ctx, g);
      // grumpy face
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(-4.8, 1, 3.2, 3.6, 0, 0, TAU); ctx.ellipse(4.8, 1, 3.2, 3.6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = OUT;
      ctx.beginPath(); ctx.arc(-4.2, 2, 1.6, 0, TAU); ctx.arc(5.4, 2, 1.6, 0, TAU); ctx.fill();
      ctx.strokeStyle = OUT; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(-8.5, -4.5); ctx.lineTo(-2, -2.2); ctx.moveTo(8.5, -4.5); ctx.lineTo(2, -2.2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-6, -8, 4, 2.2, -0.5, 0, TAU); ctx.fill();
    });
  }

  private makeAngler() {
    // Faces left. Body centred at (56, 38); lure tip at (56 - 2.2r, 38 - 1.5r).
    sheetTexture(this, 'angler', 108, 72, 2, (ctx, i) => {
      const r = 17, w = i ? 0.3 : -0.3;
      setup(ctx);
      ctx.translate(56, 38);
      ctx.beginPath(); ctx.moveTo(r * 0.9, 0); ctx.lineTo(r * 1.9, -r * 0.75 + w * 6); ctx.lineTo(r * 1.75, w * 3); ctx.lineTo(r * 1.9, r * 0.75 + w * 6); ctx.closePath();
      fillOut(ctx, '#6b4a9b');
      ctx.beginPath(); ctx.moveTo(-r * 0.1, -r * 0.82); ctx.quadraticCurveTo(r * 0.5, -r * 1.35, r * 0.9, -r * 0.55); ctx.closePath(); fillOut(ctx, '#8a66c2', 2);
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.18, r * 0.95, 0, 0, TAU); fillOut(ctx, '#7c58b3');
      ctx.fillStyle = '#a98ad8'; ctx.beginPath(); ctx.ellipse(r * 0.15, r * 0.45, r * 0.75, r * 0.32, 0, 0, TAU); ctx.fill();
      // mouth and teeth
      ctx.beginPath(); ctx.moveTo(-r * 1.15, -r * 0.1); ctx.quadraticCurveTo(-r * 0.6, r * 0.75, -r * 0.1, r * 0.25); ctx.quadraticCurveTo(-r * 0.6, r * 0.2, -r * 1.15, -r * 0.1);
      fillOut(ctx, '#2a1630', 2);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
      for (let k = 0; k < 4; k++) {
        const x = -r * 1.0 + k * 5;
        ctx.beginPath(); ctx.moveTo(x, -r * 0.02 + k * 1.2); ctx.lineTo(x + 2.4, r * 0.32 + k); ctx.lineTo(x + 4.6, r * 0.05 + k * 1.4); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      // big angry eye
      ctx.beginPath(); ctx.arc(-r * 0.32, -r * 0.38, 5.6, 0, TAU); fillOut(ctx, '#fff', 2);
      ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(-r * 0.42, -r * 0.34, 2.6, 0, TAU); ctx.fill();
      ctx.strokeStyle = OUT; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(-r * 0.75, -r * 0.82); ctx.lineTo(-r * 0.05, -r * 0.62); ctx.stroke();
      // lure
      ctx.beginPath(); ctx.moveTo(-r * 0.1, -r * 0.85); ctx.quadraticCurveTo(-r * 0.9, -r * 2.25, -r * 2.2, -r * 1.5);
      ctx.strokeStyle = OUT; ctx.lineWidth = 4.4; ctx.stroke(); ctx.strokeStyle = '#8a66c2'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(-r * 2.2, -r * 1.5, 4.4, 0, TAU); fillOut(ctx, '#f4ffb0', 2);
    });
  }

  private makeEel() {
    // Faces left, body centred at (52, 18), about 90 px long. Frames wiggle; colours stay neutral
    // so the scene can tint it bright when charged.
    sheetTexture(this, 'eel', 104, 36, 4, (ctx, i) => {
      const ph = (i / 4) * TAU;
      setup(ctx);
      ctx.translate(52, 18);
      const pts: [number, number][] = [];
      for (let k = 0; k <= 12; k++) { const x = -44 + k * 7.3; pts.push([x, Math.sin(k * 0.7 + ph) * 3.5 * (k / 12)]); }
      const body = () => { ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); };
      body(); ctx.strokeStyle = OUT; ctx.lineWidth = 15; ctx.stroke();
      body(); ctx.strokeStyle = '#4bbf7a'; ctx.lineWidth = 10; ctx.stroke();
      body(); ctx.strokeStyle = '#ffe36b'; ctx.lineWidth = 3; ctx.setLineDash([4, 6]); ctx.stroke(); ctx.setLineDash([]);
      // head
      ctx.beginPath(); ctx.ellipse(-44, 0, 9, 7.5, 0, 0, TAU); fillOut(ctx, '#4bbf7a');
      ctx.beginPath(); ctx.arc(-46, -2.5, 3, 0, TAU); fillOut(ctx, '#fff', 1.6);
      ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(-46.8, -2.5, 1.5, 0, TAU); ctx.fill();
      ctx.strokeStyle = OUT; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-52, 3); ctx.lineTo(-45, 4); ctx.stroke();
      // tail fin
      const [tx, ty] = pts[pts.length - 1];
      ctx.beginPath(); ctx.moveTo(tx - 2, ty); ctx.lineTo(tx + 8, ty - 6); ctx.lineTo(tx + 8, ty + 6); ctx.closePath(); fillOut(ctx, '#3aa86a', 2);
    });
  }

  private makeAir() {
    canvasTexture(this, 'air', 26, 26, ctx => {
      setup(ctx);
      ctx.translate(13, 13);
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); fillOut(ctx, 'rgba(210,248,255,.55)', 2.2);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-3.2, -3.4, 2.8, 1.8, -0.6, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(3.6, 3.4, 1.1, 0, TAU); ctx.fill();
    });
  }

  private makeLight() {
    // Darkness with a clear pool of light in the middle. One texture big enough to cover any
    // screen from wherever the diver is (LIGHT_SPAN wide), so there are no seams to hide.
    const size = 1024, px = size / LIGHT_SPAN;
    const mask = this.textures.createCanvas('lightmask', size, size)!;
    const m = mask.getContext();
    const g = m.createRadialGradient(size / 2, size / 2, 40 * px, size / 2, size / 2, LIGHT_R * px);
    g.addColorStop(0, 'rgba(2,6,24,0)');
    g.addColorStop(0.55, 'rgba(2,6,24,.55)');
    g.addColorStop(1, 'rgba(2,6,24,1)');
    m.fillStyle = g; m.fillRect(0, 0, size, size);
    mask.refresh();

    // Headlamp beam: warm wedge fading out with distance. Origin is its left middle.
    const cone = this.textures.createCanvas('cone', 270, 190)!;
    const c = cone.getContext();
    const lg = c.createLinearGradient(0, 0, 270, 0);
    lg.addColorStop(0, 'rgba(255,240,190,1)'); lg.addColorStop(1, 'rgba(255,240,190,0)');
    c.fillStyle = lg;
    c.beginPath(); c.moveTo(0, 92); c.lineTo(270, 0); c.lineTo(270, 190); c.lineTo(0, 98); c.closePath(); c.fill();
    cone.refresh();
  }

  private makeParticles() {
    canvasTexture(this, 'dot', 10, 10, ctx => {
      setup(ctx);
      ctx.beginPath(); ctx.arc(5, 5, 3.4, 0, TAU); fillOut(ctx, '#fff', 1.6);
    });
    canvasTexture(this, 'ring', 14, 14, ctx => {
      setup(ctx);
      ctx.beginPath(); ctx.arc(7, 7, 4.8, 0, TAU); fillOut(ctx, 'rgba(255,255,255,.4)', 1.6);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(5.6, 5.6, 1.2, 0, TAU); ctx.fill();
    });
    canvasTexture(this, 'star', 16, 16, ctx => {
      setup(ctx);
      ctx.translate(8, 8);
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (k / 10) * TAU, rr = k % 2 ? 2.8 : 6.4;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath(); fillOut(ctx, '#fff', 1.6);
    });
  }

  /** The rare treasures (see treasures.ts), one texture each, `tr-<id>`. */
  private makeTreasures() {
    canvasTexture(this, 'tr-blackpearl', 36, 36, ctx => {
      setup(ctx); ctx.translate(18, 19);
      // A black pearl with a green-purple sheen, in an oyster shell whose lid is tipped open behind it.
      ctx.save(); ctx.translate(-3, -3); ctx.rotate(-0.55);
      ctx.beginPath(); ctx.moveTo(0, 7); ctx.lineTo(-11, -1); ctx.quadraticCurveTo(-9, -11, 0, -11); ctx.quadraticCurveTo(9, -11, 11, -1); ctx.closePath(); fillOut(ctx, '#cdb8a8', 2);
      ctx.strokeStyle = 'rgba(22,35,59,.35)'; ctx.lineWidth = 1;
      for (const k of [-0.8, -0.3, 0.3, 0.8]) { ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(Math.sin(k) * 10, -Math.cos(k) * 10 + 0.5); ctx.stroke(); }
      ctx.restore();
      ctx.beginPath(); ctx.moveTo(-14, 5); ctx.quadraticCurveTo(-12, 15, 0, 15); ctx.quadraticCurveTo(12, 15, 14, 5); ctx.quadraticCurveTo(0, 9, -14, 5); fillOut(ctx, '#e3d3c4', 2);
      const g = ctx.createRadialGradient(-0.5, 1, 0.5, 2, 4, 8);
      g.addColorStop(0, '#b9a6ff'); g.addColorStop(0.35, '#4a3a6e'); g.addColorStop(0.8, '#1a1630'); g.addColorStop(1, '#2f6b5a');
      ctx.beginPath(); ctx.arc(2, 4, 7.5, 0, TAU); fillOut(ctx, g, 2.2);
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(-0.6, 1.4, 2.2, 1.3, -0.6, 0, TAU); ctx.fill();
    });
    canvasTexture(this, 'tr-bottle', 36, 36, ctx => {
      setup(ctx); ctx.translate(18, 18); ctx.rotate(-0.6);
      // A green glass bottle with a cork and a rolled-up note inside.
      ctx.beginPath(); ctx.moveTo(-4, -15); ctx.lineTo(4, -15); ctx.lineTo(4, -9); ctx.quadraticCurveTo(9, -7, 9, -1); ctx.lineTo(9, 12); ctx.quadraticCurveTo(9, 15, 6, 15);
      ctx.lineTo(-6, 15); ctx.quadraticCurveTo(-9, 15, -9, 12); ctx.lineTo(-9, -1); ctx.quadraticCurveTo(-9, -7, -4, -9); ctx.closePath();
      fillOut(ctx, 'rgba(110,220,160,.75)', 2.4);
      ctx.save(); ctx.translate(0, 4); ctx.rotate(0.15);
      roundRect(ctx, -4.5, -7, 9, 14, 2); fillOut(ctx, '#f6ecd0', 1.6);
      ctx.strokeStyle = 'rgba(160,110,60,.7)'; ctx.lineWidth = 1;
      for (const y of [-3, 0, 3]) { ctx.beginPath(); ctx.moveTo(-2.5, y); ctx.lineTo(2.5, y); ctx.stroke(); }
      ctx.restore();
      roundRect(ctx, -3.6, -19, 7.2, 6, 1.5); fillOut(ctx, '#c08a4e', 2);
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(-6, 2, 1.3, 5, 0, 0, TAU); ctx.fill();
    });
    canvasTexture(this, 'tr-fossil', 36, 36, ctx => {
      setup(ctx); ctx.translate(18, 18);
      // An ammonite spiral inside a chunk of blue ice.
      ctx.beginPath(); ctx.moveTo(-13, -8); ctx.lineTo(-4, -15); ctx.lineTo(11, -12); ctx.lineTo(15, 2); ctx.lineTo(8, 14); ctx.lineTo(-9, 13); ctx.lineTo(-15, 3); ctx.closePath();
      fillOut(ctx, 'rgba(175,230,255,.85)', 2.4);
      ctx.beginPath();
      for (let a = 0; a < TAU * 2.4; a += 0.15) { const r = 0.8 + a * 0.62; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.lineWidth = 4.2; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 2.2; ctx.strokeStyle = '#d9b48a'; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-10, -7); ctx.lineTo(-4, -12); ctx.moveTo(10, -8); ctx.lineTo(12, 0); ctx.stroke();
    });
    canvasTexture(this, 'tr-doubloon', 36, 36, ctx => {
      setup(ctx); ctx.translate(18, 18);
      // A thick gold coin stamped with a cross.
      ctx.beginPath(); ctx.ellipse(0, 2, 13, 12, 0, 0, TAU); fillOut(ctx, '#c8890f', 2.4);
      const g = ctx.createLinearGradient(-10, -10, 10, 10);
      g.addColorStop(0, '#fff3a8'); g.addColorStop(0.5, '#ffd23f'); g.addColorStop(1, '#e09a12');
      ctx.beginPath(); ctx.ellipse(0, 0, 13, 12, 0, 0, TAU); fillOut(ctx, g, 2.4);
      ctx.beginPath(); ctx.ellipse(0, 0, 9.5, 8.6, 0, 0, TAU); ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(150,90,0,.6)'; ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = '#b8780c';
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke();
      for (const [x, y] of [[-3.4, -3.4], [3.4, -3.4], [-3.4, 3.4], [3.4, 3.4]]) { ctx.fillStyle = '#b8780c'; ctx.beginPath(); ctx.arc(x, y, 1, 0, TAU); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(-6, -6, 2.6, 1.3, -0.7, 0, TAU); ctx.fill();
    });
    canvasTexture(this, 'tr-watch', 36, 36, ctx => {
      setup(ctx); ctx.translate(18, 19);
      // A silver pocket watch on a short chain, its hands at twenty past two.
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.quadraticCurveTo(8, -18, 14, -14); ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.lineWidth = 1.4; ctx.strokeStyle = '#e6eef5'; ctx.setLineDash([2, 1.6]); ctx.stroke(); ctx.setLineDash([]);
      roundRect(ctx, -2.6, -15, 5.2, 4, 1.2); fillOut(ctx, '#c9d3dc', 1.8);
      const g = ctx.createLinearGradient(-12, -12, 12, 12);
      g.addColorStop(0, '#f4f8fb'); g.addColorStop(0.5, '#b7c3cf'); g.addColorStop(1, '#7d8b99');
      ctx.beginPath(); ctx.arc(0, 1, 12, 0, TAU); fillOut(ctx, g, 2.4);
      ctx.beginPath(); ctx.arc(0, 1, 9, 0, TAU); fillOut(ctx, '#fbf6e8', 1.6);
      ctx.fillStyle = OUT;
      for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; ctx.beginPath(); ctx.arc(Math.sin(a) * 7.4, 1 - Math.cos(a) * 7.4, k % 3 ? 0.5 : 0.9, 0, TAU); ctx.fill(); }
      ctx.lineCap = 'round'; ctx.strokeStyle = OUT;
      const hand = (a: number, r: number, w: number) => { ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(Math.sin(a) * r, 1 - Math.cos(a) * r); ctx.stroke(); };
      hand(((2 + 20 / 60) / 12) * TAU, 4.6, 1.8);
      hand((20 / 60) * TAU, 6.6, 1.2);
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(-5, -4, 2.4, 1.2, -0.7, 0, TAU); ctx.fill();
    });
    canvasTexture(this, 'tr-compass', 36, 36, ctx => {
      setup(ctx); ctx.translate(18, 18);
      // A brass compass: case, glass face, a red-and-white needle, and the ring on top.
      ctx.beginPath(); ctx.arc(0, -13.5, 3.2, 0, TAU); ctx.lineWidth = 4.4; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = '#ffd23f'; ctx.stroke();
      const brass = ctx.createLinearGradient(-12, -12, 12, 12);
      brass.addColorStop(0, '#fff0a0'); brass.addColorStop(0.5, '#f0b81e'); brass.addColorStop(1, '#b07a12');
      ctx.beginPath(); ctx.arc(0, 1, 12, 0, TAU); fillOut(ctx, brass, 2.4);
      ctx.beginPath(); ctx.arc(0, 1, 8.6, 0, TAU); fillOut(ctx, '#f6efd9', 1.8);
      ctx.strokeStyle = 'rgba(22,35,59,.45)'; ctx.lineWidth = 1.2;
      for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 6.6, 1 + Math.sin(a) * 6.6); ctx.lineTo(Math.cos(a) * 8, 1 + Math.sin(a) * 8); ctx.stroke(); }
      ctx.save(); ctx.translate(0, 1); ctx.rotate(0.5);
      ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(2.4, 0); ctx.lineTo(-2.4, 0); ctx.closePath(); fillOut(ctx, '#ff4d6d', 1.4);
      ctx.beginPath(); ctx.moveTo(0, 7); ctx.lineTo(2.4, 0); ctx.lineTo(-2.4, 0); ctx.closePath(); fillOut(ctx, '#ffffff', 1.4);
      ctx.restore();
      ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(0, 1, 1.3, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(-4.5, -3, 2.6, 1.3, -0.6, 0, TAU); ctx.fill();
    });
    canvasTexture(this, 'tr-heart', 36, 36, ctx => {
      setup(ctx); ctx.translate(18, 19);
      // A deep-blue heart-shaped diamond in a thin silver setting, hanging from a beaded chain.
      for (const sx of [-1, 1]) {
        ctx.lineWidth = 3; ctx.strokeStyle = OUT;
        ctx.beginPath(); ctx.moveTo(sx * 3, -7); ctx.quadraticCurveTo(sx * 10, -12, sx * 15, -18); ctx.stroke();
        ctx.fillStyle = '#e6eef5';
        for (let k = 0; k < 5; k++) { const t = k / 4; ctx.beginPath(); ctx.arc(sx * (3 + t * 12), -7 - t * 11 + Math.sin(t * Math.PI) * -1.5, 1.3, 0, TAU); ctx.fill(); }
      }
      const heart = () => {
        ctx.beginPath(); ctx.moveTo(0, 12);
        ctx.bezierCurveTo(-17, 2, -12, -13, 0, -5);
        ctx.bezierCurveTo(12, -13, 17, 2, 0, 12);
        ctx.closePath();
      };
      heart(); ctx.lineWidth = 5.5; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 2.2; ctx.strokeStyle = '#eef4fa'; ctx.stroke();
      const g = ctx.createLinearGradient(-8, -8, 8, 10);
      g.addColorStop(0, '#9fe0ff'); g.addColorStop(0.45, '#2f7bff'); g.addColorStop(1, '#16308f');
      heart(); ctx.fillStyle = g; ctx.fill();
      // Facets.
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, 11); ctx.moveTo(-8, -4); ctx.lineTo(0, 3); ctx.lineTo(8, -4); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(-5, -3, 2.6, 1.4, -0.7, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -9.5); ctx.lineTo(2.6, -6.5); ctx.lineTo(0, -3.5); ctx.lineTo(-2.6, -6.5); ctx.closePath(); fillOut(ctx, '#ffffff', 1.2);
    });
  }
}

// ---------- Characters. Each draws one kick frame of an outfit into the 82 x 46 frame: `k` is the
// kick (-1..1), `p` the frame's place in the loop (0..1). Light comes from the top left.

type DrawDiver = (ctx: Ctx, k: number, p: number, s: Skin) => void;

const METAL = { brass: ['#fff1a6', '#ffc43d', '#c9820f'], silver: ['#ffffff', '#d9e2eb', '#8a9bb0'], copper: ['#ffd9bd', '#ee9256', '#a24e22'] };
const HATS: Extra[] = ['crown', 'cap', 'lure'];

/** Little Brass: a chubby suited kid whose head is a big round diving helmet. */
const drawBrass: DrawDiver = (ctx, k, _p, s) => {
  const M = METAL[s.metal ?? 'brass'];
  if (s.extra === 'glow') {
    const g = ctx.createRadialGradient(44, 23, 4, 44, 23, 23);
    g.addColorStop(0, 'rgba(170,235,255,.55)'); g.addColorStop(1, 'rgba(170,235,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(44, 23, 23, 0, TAU); ctx.fill();
  }
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(25, 27.5 + side * 1.8); ctx.rotate(0.1 * side + k * 0.3 * side);
    limb(ctx, [0, 0, -8.5, 0.5], side < 0 ? s.belly : s.body);
    const fin = new Path2D();
    fin.moveTo(-8, -2.6); fin.quadraticCurveTo(-14, -6.5, -20, -4.6); fin.quadraticCurveTo(-17.5, 0.4, -20, 5.4); fin.quadraticCurveTo(-14, 5.4, -8, 2.8); fin.closePath();
    shaded(ctx, fin, s.fins, () => finShade(ctx, side < 0, s.fins, -21, -7));
    ctx.restore();
  }
  const tank = new Path2D(); tank.roundRect(20, 11.5, 17, 7.5, 3.75);
  shaded(ctx, tank, '#dfe7ee', () => cylinder(ctx, 20, 11.5, 17, 7.5, '#ff5a7a'));
  if (s.extra === 'spikes') spikes(ctx, 33, 25.5, 13, 10.5);
  const body = new Path2D(); body.ellipse(33, 25.5, 13, 10.5, 0, 0, TAU);
  shaded(ctx, body, s.body, () => {
    ctx.fillStyle = s.belly; ctx.beginPath(); ctx.ellipse(33, 32.5, 12, 4.4, 0, 0, TAU); ctx.fill();
    if (s.extra === 'spots') {
      ctx.fillStyle = 'rgba(255,255,255,.6)';
      for (const [x, y, r] of [[24, 22, 2.2], [33, 18, 1.8], [36, 27, 1.6], [24, 30, 1.4]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
    } else if (s.extra === 'stripes') {
      ctx.fillStyle = s.belly;
      for (const x of [22.5, 34]) band(ctx, x, 2.6, 14, 37);
    }
    ctx.fillStyle = '#4a5a78'; band(ctx, 27.5, 3.1, 14, 37);
    vol(ctx, 33, 25.5, 13, 10.5, s.belly);
  });
  const gold = ctx.createLinearGradient(0, 23, 0, 27); gold.addColorStop(0, '#ffe58a'); gold.addColorStop(1, '#e09a12');
  roundRect(ctx, 26.6, 23.2, 5.4, 4, 1.2); fillOut(ctx, gold, 1.6);
  limb(ctx, [41, 28, 44 + k * 1.2, 33.5, 47.5 + k * 2, 34.5 - k], s.body, 3.8);
  ctx.beginPath(); ctx.arc(48 + k * 2, 34.6 - k, 2.7, 0, TAU); fillOut(ctx, s.fins, 2);
  const hat = s.extra && HATS.includes(s.extra);
  if (!hat) { roundRect(ctx, 52.5, 7.2, 6, 4.4, 1.6); fillOut(ctx, metal(ctx, 52, 7, 59, 12, M), 2); }
  ctx.beginPath(); ctx.ellipse(45, 24.5, 3.6, 9.2, 0, 0, TAU); fillOut(ctx, metal(ctx, 41, 15, 49, 34, M), 2.2);
  const helm = new Path2D(); helm.arc(56, 22.5, 13, 0, TAU);
  shaded(ctx, helm, M[1], () => {
    const g = ctx.createRadialGradient(50.5, 15, 0.5, 56, 22.5, 13.6);
    g.addColorStop(0, M[0]); g.addColorStop(0.5, M[1]); g.addColorStop(1, M[2]);
    ctx.fillStyle = g; ctx.fillRect(42, 9, 28, 28);
    ctx.fillStyle = 'rgba(255,255,255,.65)'; ctx.beginPath(); ctx.ellipse(50.5, 14.5, 4.2, 1.7, -0.6, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(190,240,255,.55)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(56, 22.5, 11.4, 0.5, 2.5); ctx.stroke();
    // A riveted seam round the dome.
    ctx.strokeStyle = 'rgba(22,35,59,.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(51, 22.5, 3.4, 12.6, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    ctx.fillStyle = 'rgba(22,35,59,.45)';
    for (const a of [-1, -0.5, 0, 0.5, 1]) { ctx.beginPath(); ctx.arc(51 + Math.cos(a) * 3.4 - 1.1, 22.5 + Math.sin(a) * 12.6, 0.6, 0, TAU); ctx.fill(); }
  });
  porthole(ctx, 61.5, 22.5, 8.4, 6.8, M);
  headgear(ctx, s, 55.5, 10.6);
};

/** Scuba Kid: lying flat in a wetsuit, big mask, slim tank, long fins in a scissor kick. */
const drawScuba: DrawDiver = (ctx, k, _p, s) => {
  const tone = s.tone ?? '#f6c9a0', toneDeep = mix(tone, '#5a2a14', 0.3), mask = s.mask ?? s.fins;
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(29, 25.5 + side * 1.4); ctx.rotate(0.04 * side + k * 0.26 * side);
    limb(ctx, [0, 0, -12.5, 0], side < 0 ? s.belly : s.body, 4);
    const fin = new Path2D();
    fin.moveTo(-11.5, -2.4); fin.quadraticCurveTo(-19, -5.6, -26.5, -4.2); fin.quadraticCurveTo(-24, 0.2, -26.5, 4.6); fin.quadraticCurveTo(-19, 4.6, -11.5, 2.4); fin.closePath();
    shaded(ctx, fin, s.fins, () => finShade(ctx, side < 0, s.fins, -27, -11));
    ctx.restore();
  }
  const tank = new Path2D(); tank.roundRect(27, 12, 22, 6.6, 3.3);
  shaded(ctx, tank, '#ffe27a', () => cylinder(ctx, 27, 12, 22, 6.6));
  roundRect(ctx, 48, 13, 3, 4.6, 1); fillOut(ctx, '#8796a8', 1.6);
  const body = new Path2D(); body.ellipse(41, 24.5, 14.5, 7.8, 0, 0, TAU);
  shaded(ctx, body, s.body, () => {
    ctx.fillStyle = s.fins; ctx.beginPath(); ctx.ellipse(41, 27.6, 13.5, 1.5, 0.02, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a4863'; ctx.fillRect(33, 16, 2.8, 17);
    vol(ctx, 41, 24.5, 14.5, 7.8, s.belly);
  });
  limb(ctx, [51, 26.5, 55 + k, 31, 59.5 + k * 1.6, 31.5 - k * 0.6], s.body, 3.4);
  ctx.beginPath(); ctx.arc(60 + k * 1.6, 31.4 - k * 0.6, 2.2, 0, TAU); fillOut(ctx, tone, 1.8);
  if (!(s.extra && HATS.includes(s.extra))) {
    // Snorkel (it comes off when a hat goes on).
    ctx.beginPath(); ctx.moveTo(57.5, 15); ctx.lineTo(57.5, 5.5);
    ctx.strokeStyle = OUT; ctx.lineWidth = 4.6; ctx.stroke(); ctx.strokeStyle = mask; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.beginPath(); ctx.arc(57.5, 5.2, 1.9, 0, TAU); fillOut(ctx, '#ff5a7a', 1.6);
  }
  const head = new Path2D(); head.arc(63, 20, 9, 0, TAU);
  shaded(ctx, head, tone, () => {
    ctx.fillStyle = s.hair ?? '#5a3a22'; ctx.beginPath(); ctx.ellipse(59, 13, 9.5, 6, -0.35, 0, TAU); ctx.fill();
    vol(ctx, 63, 20, 9, 9, toneDeep, false);
    ctx.fillStyle = 'rgba(255,110,150,.5)'; ctx.beginPath(); ctx.ellipse(63.6, 25, 1.6, 0.9, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(68, 24.3, 1.7, 0.4, Math.PI - 0.4); ctx.stroke();
  });
  ctx.beginPath(); ctx.moveTo(54.6, 17.6); ctx.lineTo(62, 17.6);
  ctx.strokeStyle = OUT; ctx.lineWidth = 3.6; ctx.stroke(); ctx.strokeStyle = mask; ctx.lineWidth = 1.6; ctx.stroke();
  roundRect(ctx, 61, 13, 12, 9.4, 4.2); fillOut(ctx, mask, 2.2);
  const glass = ctx.createLinearGradient(62, 14, 72, 21); glass.addColorStop(0, '#dcf7ff'); glass.addColorStop(1, '#4fb8ee');
  const lens = new Path2D(); lens.roundRect(62.6, 14.6, 8.8, 6.2, 3);
  shaded(ctx, lens, glass, () => {
    eye(ctx, 65, 17.8, 1.45); eye(ctx, 69.1, 17.8, 1.45);
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(63.6, 19.6); ctx.lineTo(65.8, 15.4); ctx.stroke();
  }, 1.6);
  headgear(ctx, s, 62.5, 11.6);
};

/** Otter: a sea otter in a glass bubble helmet with a backpack tank; the tail does the kicking. */
const drawOtter: DrawDiver = (ctx, k, _p, s) => {
  const cream = s.cream ?? '#ffe3c2';
  ctx.save(); ctx.translate(23, 27); ctx.rotate(k * 0.26);
  const tail = new Path2D();
  tail.moveTo(2, -5); tail.quadraticCurveTo(-8, -5.6, -17, -1.6); tail.quadraticCurveTo(-19.6, 0.4, -17, 2.3); tail.quadraticCurveTo(-8, 4.8, 2, 4.6); tail.closePath();
  shaded(ctx, tail, s.body, () => {
    const g = ctx.createLinearGradient(0, -6, 0, 5);
    g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, rgba(s.belly, 0.9));
    ctx.fillStyle = g; ctx.fillRect(-20, -7, 23, 13);
  });
  ctx.restore();
  const paddle = (x: number, y: number, a: number, col: string) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(1, -1.6); ctx.quadraticCurveTo(-6, -4, -7.5, 0); ctx.quadraticCurveTo(-6, 4, 1, 1.6); ctx.closePath();
    fillOut(ctx, col, 2); ctx.restore();
  };
  paddle(27, 33, 0.5 - k * 0.45, s.belly);
  const pack = new Path2D(); pack.roundRect(22, 11.2, 15, 8, 4);
  shaded(ctx, pack, s.fins, () => cylinder(ctx, 22, 11.2, 15, 8));
  if (s.extra === 'spikes') spikes(ctx, 35, 26, 14, 10);
  const body = new Path2D(); body.ellipse(35, 26, 14, 10, 0, 0, TAU);
  shaded(ctx, body, s.body, () => {
    ctx.fillStyle = cream; ctx.beginPath(); ctx.ellipse(37.5, 32.5, 11, 4.6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = s.fins; band(ctx, 29.5, 3.1, 14, 37);
    vol(ctx, 35, 26, 14, 10, s.belly);
  });
  paddle(30, 34.5, 0.35 + k * 0.45, s.body);
  ctx.beginPath(); ctx.ellipse(48.5 + k * 1.5, 34 - k * 0.8, 2.8, 2.2, 0.3, 0, TAU); fillOut(ctx, s.body, 2);
  ctx.beginPath(); ctx.ellipse(46.5, 24.5, 3.4, 9, 0, 0, TAU); fillOut(ctx, metal(ctx, 43, 15, 50, 34, METAL.brass), 2.2);
  for (const [x, y] of [[53, 14.4], [61.6, 13.4]]) {
    ctx.beginPath(); ctx.arc(x, y, 2.4, 0, TAU); fillOut(ctx, s.body, 1.8);
    ctx.fillStyle = cream; ctx.beginPath(); ctx.arc(x, y + 0.3, 1, 0, TAU); ctx.fill();
  }
  const head = new Path2D(); head.arc(58, 21.5, 8, 0, TAU);
  shaded(ctx, head, s.body, () => vol(ctx, 58, 21.5, 8, 8, s.belly, false), 2.2);
  ctx.beginPath(); ctx.ellipse(62.3, 24.6, 4.6, 3.3, 0, 0, TAU); fillOut(ctx, cream, 1.6);
  ctx.fillStyle = 'rgba(255,110,150,.5)'; ctx.beginPath(); ctx.ellipse(55, 24, 1.5, 0.9, 0, 0, TAU); ctx.fill();
  eye(ctx, 56.6, 19.6, 1.6); eye(ctx, 62.2, 19.2, 1.6);
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.ellipse(64.8, 22.8, 1.6, 1.1, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(62.9, 25, 1, 0.2, Math.PI - 0.2); ctx.arc(64.9, 25, 1, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.strokeStyle = 'rgba(22,35,59,.55)'; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(65.5, 24.4); ctx.lineTo(68.8, 23.4); ctx.moveTo(65.5, 25.4); ctx.lineTo(68.8, 26.2); ctx.stroke();
  // The bubble: faint tint, thicker glass at the rim, reflections, then its outline.
  const bub = new Path2D(); bub.arc(57.5, 21.2, 12.2, 0, TAU);
  ctx.save(); ctx.clip(bub);
  ctx.fillStyle = 'rgba(190,235,255,.2)'; ctx.fillRect(44, 8, 28, 28);
  const edge = ctx.createRadialGradient(57.5, 21.2, 8.5, 57.5, 21.2, 12.4);
  edge.addColorStop(0, 'rgba(130,210,255,0)'); edge.addColorStop(1, 'rgba(130,210,255,.6)');
  ctx.fillStyle = edge; ctx.fillRect(44, 8, 28, 28);
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(57.5, 21.2, 9.6, 3.55, 4.6); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(60.5, 11.8, 0.9, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(225,250,255,.6)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(57.5, 21.2, 10, 0.2, 1.35); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = OUT; ctx.lineWidth = LINE; ctx.stroke(bub);
  headgear(ctx, s, 57.5, 9.8);
};

/** Pod: a tiny round submarine with a face in the porthole and a spinning three-blade prop. */
const drawPod: DrawDiver = (ctx, k, p, s) => {
  const th = (p * TAU) / 3; // a third of a turn per loop: the three blades line up again
  ctx.beginPath(); ctx.moveTo(20, 24.5); ctx.lineTo(11, 24.5);
  ctx.strokeStyle = OUT; ctx.lineWidth = 4.4; ctx.stroke(); ctx.strokeStyle = '#8796a8'; ctx.lineWidth = 2.2; ctx.stroke();
  const blades = [0, 1, 2].map(i => th + (i * TAU) / 3).sort((a, b) => Math.sin(a) - Math.sin(b));
  for (const a of blades) {
    const ext = 7.6 * Math.cos(a);
    ctx.beginPath(); ctx.ellipse(10.5, 24.5 - ext / 2, 2.3, Math.abs(ext) / 2 + 0.9, 0, 0, TAU);
    fillOut(ctx, Math.sin(a) < 0 ? '#9fb0c0' : '#e3eaf1', 1.8);
  }
  ctx.beginPath(); ctx.arc(10.5, 24.5, 2.2, 0, TAU); fillOut(ctx, '#ffc43d', 1.6);
  for (const side of [-1, 1]) {
    const fin = new Path2D(), y = 24.5;
    fin.moveTo(26, y + side * 7); fin.lineTo(18, y + side * 13); fin.quadraticCurveTo(16.5, y + side * 9, 19, y + side * 4); fin.closePath();
    shaded(ctx, fin, s.fins, () => { ctx.fillStyle = side < 0 ? 'rgba(255,255,255,.3)' : 'rgba(22,35,59,.25)'; ctx.fillRect(15, y - 14, 12, 28); }, 2.2);
  }
  const sail = new Path2D(); sail.roundRect(35, 8.6, 13, 9.4, 3.6);
  shaded(ctx, sail, s.body, () => {
    const g = ctx.createLinearGradient(35, 0, 48, 0); g.addColorStop(0, 'rgba(255,255,255,.4)'); g.addColorStop(1, rgba(s.belly, 0.9));
    ctx.fillStyle = g; ctx.fillRect(35, 8, 13, 10);
  });
  ctx.beginPath(); ctx.arc(48.6, 12.8, 1.9, 0, TAU); fillOut(ctx, '#fff59d', 1.6);
  if (s.extra === 'spikes') spikes(ctx, 41, 25, 23, 13);
  const hull = new Path2D(); hull.ellipse(41, 25, 23, 13, 0, 0, TAU);
  shaded(ctx, hull, s.body, () => {
    ctx.fillStyle = s.fins; ctx.fillRect(17, 28.6, 48, 3.8);
    ctx.strokeStyle = 'rgba(22,35,59,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(29, 25, 3.2, 12.6, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    ctx.fillStyle = 'rgba(22,35,59,.45)';
    for (const a of [-1.1, -0.55, 0, 0.55, 1.1]) { ctx.beginPath(); ctx.arc(29 + Math.cos(a) * 3.2 - 1.2, 25 + Math.sin(a) * 12.6, 0.6, 0, TAU); ctx.fill(); }
    vol(ctx, 41, 25, 23, 13, s.belly);
  });
  ctx.save(); ctx.translate(38, 34); ctx.rotate(0.15 + k * 0.25);
  const wing = new Path2D(); wing.moveTo(3, -1.5); wing.quadraticCurveTo(-4, 1, -8, 5); wing.quadraticCurveTo(-1, 5.5, 4, 1.8); wing.closePath();
  shaded(ctx, wing, s.fins, () => { ctx.fillStyle = 'rgba(22,35,59,.2)'; ctx.fillRect(-9, 2, 14, 5); }, 2);
  ctx.restore();
  porthole(ctx, 59.5, 23.5, 9, 7.2, METAL.brass);
  headgear(ctx, s, 41.5, 9.4);
};

const DRAW: Record<CharId, DrawDiver> = { brass: drawBrass, scuba: drawScuba, otter: drawOtter, pod: drawPod };

/** Crown, captain's cap or angler lure, anchored at the middle of the hat's base. */
function headgear(ctx: Ctx, s: Skin, x: number, y: number) {
  if (s.extra === 'crown') {
    ctx.beginPath();
    ctx.moveTo(x - 6.5, y + 0.5); ctx.lineTo(x - 6, y - 6.5); ctx.lineTo(x - 2.8, y - 2.9); ctx.lineTo(x, y - 8);
    ctx.lineTo(x + 2.8, y - 2.9); ctx.lineTo(x + 6, y - 6.5); ctx.lineTo(x + 6.5, y + 0.5); ctx.closePath();
    const g = ctx.createLinearGradient(x - 6, y - 8, x + 6, y + 0.5);
    g.addColorStop(0, '#fff3a0'); g.addColorStop(0.5, '#ffd23f'); g.addColorStop(1, '#e09a12');
    fillOut(ctx, g, 2);
    ctx.fillStyle = '#ff5a7a'; ctx.beginPath(); ctx.arc(x, y - 2.4, 1.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x - 0.4, y - 2.8, 0.45, 0, TAU); ctx.fill();
  } else if (s.extra === 'cap') {
    const top = ctx.createLinearGradient(x - 7, y - 7, x + 4, y);
    top.addColorStop(0, '#ffffff'); top.addColorStop(1, '#c3cfdd');
    roundRect(ctx, x - 7, y - 6.8, 14, 6.5, 3); fillOut(ctx, top, 2);
    const brim = ctx.createLinearGradient(0, y - 3.2, 0, y + 2);
    brim.addColorStop(0, '#3d58b0'); brim.addColorStop(1, '#111b45');
    ctx.beginPath(); ctx.ellipse(x + 1.5, y - 0.4, 9.5, 2.6, 0, 0, TAU); fillOut(ctx, brim, 2);
    ctx.fillStyle = '#ffc43d'; ctx.beginPath(); ctx.arc(x, y - 4, 1.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x - 0.5, y - 4.5, 0.5, 0, TAU); ctx.fill();
  } else if (s.extra === 'lure') {
    const bx = x + 10.5, by = y - 5.8;
    ctx.beginPath(); ctx.moveTo(x + 0.5, y + 0.5); ctx.quadraticCurveTo(x + 2.5, y - 8.5, bx - 1.5, by - 0.4);
    ctx.lineWidth = 3.6; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.lineWidth = 1.6; ctx.strokeStyle = s.fins; ctx.stroke();
    // Glow kept small so it fades out before the top of the frame.
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, 4.2);
    g.addColorStop(0, 'rgba(255,250,170,.95)'); g.addColorStop(1, 'rgba(255,250,170,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, 4.2, 0, TAU); ctx.fill();
    const b = ctx.createRadialGradient(bx - 1, by - 1, 0.2, bx, by, 3);
    b.addColorStop(0, '#ffffff'); b.addColorStop(0.5, '#fff59d'); b.addColorStop(1, '#f2cf3a');
    ctx.beginPath(); ctx.arc(bx, by, 2.5, 0, TAU); fillOut(ctx, b, 1.8);
  }
}

/** Puffer spines round an ellipse (drawn before the body, which covers their bases). */
function spikes(ctx: Ctx, cx: number, cy: number, rx: number, ry: number) {
  for (const a of [-2.5, -2.0, -1.5, -1.0, 1.0, 1.5, 2.0, 2.5]) {
    const nx = Math.cos(a), ny = Math.sin(a), x = cx + nx * (rx - 2), y = cy + ny * (ry - 1.5);
    ctx.beginPath(); ctx.moveTo(x - ny * 3, y + nx * 3); ctx.lineTo(x + nx * 7, y + ny * 7); ctx.lineTo(x + ny * 3, y - nx * 3); ctx.closePath();
    // Cone shading: the half facing the top-left light is pale, the other half darker.
    const cone = ctx.createLinearGradient(x - ny * 3, y + nx * 3, x + ny * 3, y - nx * 3);
    const [a0, a1] = 0.6 * ny - 0.8 * nx > 0 ? ['#fff3c2', '#f0b445'] : ['#f0b445', '#fff3c2'];
    cone.addColorStop(0, a0); cone.addColorStop(0.5, a0); cone.addColorStop(0.5, a1); cone.addColorStop(1, a1);
    fillOut(ctx, cone, 2);
  }
}

/** Round-form shading for an ellipse, drawn inside its clip: the deep colour on the far side, dark edges, top-left light, then gloss and a rim of bounced light. */
function vol(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, deep: string, gloss = true) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(rx, ry);
  ctx.globalCompositeOperation = 'multiply';
  let g = ctx.createRadialGradient(-0.35, -0.55, 0, -0.35, -0.55, 1.6);
  g.addColorStop(0, rgba(deep, 0)); g.addColorStop(0.4, rgba(deep, 0)); g.addColorStop(1, rgba(deep, 0.75));
  ctx.fillStyle = g; ctx.fillRect(-1.3, -1.3, 2.6, 2.6);
  ctx.globalCompositeOperation = 'source-over';
  g = ctx.createRadialGradient(0, 0, 0.6, 0, 0, 1.02);
  g.addColorStop(0, 'rgba(22,35,59,0)'); g.addColorStop(1, 'rgba(22,35,59,.28)');
  ctx.fillStyle = g; ctx.fillRect(-1.3, -1.3, 2.6, 2.6);
  g = ctx.createRadialGradient(-0.3, -0.45, 0, -0.3, -0.45, 0.8);
  g.addColorStop(0, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(-1.3, -1.3, 2.6, 2.6);
  ctx.restore();
  if (gloss) {
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.ellipse(cx - rx * 0.36, cy - ry * 0.58, rx * 0.3, Math.max(1, ry * 0.15), -0.15, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx - rx * 0.72, cy - ry * 0.4, Math.min(rx, ry) * 0.08 + 0.4, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(190,240,255,.6)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(1, rx - 1.6), Math.max(1, ry - 1.6), 0, 0.45, 2.6); ctx.stroke();
}

/** Fin shading in the fin's own space: lit top, dark underside, ridges; the far fin deepened in its own colour. */
function finShade(ctx: Ctx, far: boolean, col: string, x0: number, x1: number) {
  const g = ctx.createLinearGradient(0, -7, 0, 7);
  g.addColorStop(0, 'rgba(255,255,255,.45)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(22,35,59,.32)');
  ctx.fillStyle = g; ctx.fillRect(x0, -9, x1 - x0, 18);
  ctx.strokeStyle = 'rgba(22,35,59,.25)'; ctx.lineWidth = 1;
  for (const y of [-2.2, 0.4, 3]) { ctx.beginPath(); ctx.moveTo(x1 - 1.5, y * 0.4); ctx.lineTo(x0 + 3, y); ctx.stroke(); }
  if (far) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = rgba(col, 0.7); ctx.fillRect(x0, -9, x1 - x0, 18);
    ctx.globalCompositeOperation = 'source-over';
  }
}

/** Metal-cylinder lighting across a horizontal tank (inside its clip), with an optional coloured band. */
function cylinder(ctx: Ctx, x: number, y: number, w: number, h: number, band?: string) {
  if (band) { ctx.fillStyle = band; ctx.fillRect(x + w * 0.18, y, w * 0.16, h); }
  const c = ctx.createLinearGradient(0, y, 0, y + h);
  c.addColorStop(0, 'rgba(22,35,59,.1)'); c.addColorStop(0.28, 'rgba(255,255,255,.8)'); c.addColorStop(0.5, 'rgba(255,255,255,0)'); c.addColorStop(1, 'rgba(22,35,59,.45)');
  ctx.fillStyle = c; ctx.fillRect(x, y, w, h);
  const e = ctx.createLinearGradient(x, 0, x + w, 0);
  e.addColorStop(0, 'rgba(22,35,59,.15)'); e.addColorStop(0.18, 'rgba(22,35,59,0)'); e.addColorStop(0.75, 'rgba(22,35,59,0)'); e.addColorStop(1, 'rgba(22,35,59,.3)');
  ctx.fillStyle = e; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.ellipse(x + w * 0.55, y + h * 0.26, w * 0.26, 0.8, 0, 0, TAU); ctx.fill();
}

function metal(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, M: string[]) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, M[0]); g.addColorStop(0.45, M[1]); g.addColorStop(1, M[2]);
  return g;
}

/** A face window: metal ring with bolts, glass sunk into it, the face behind, glossy reflections. */
function porthole(ctx: Ctx, cx: number, cy: number, ring: number, r: number, M: string[]) {
  ctx.beginPath(); ctx.arc(cx, cy, ring, 0, TAU); fillOut(ctx, metal(ctx, cx - ring, cy - ring, cx + ring, cy + ring, M), 1.8);
  for (const a of [0.6, 2.1, 3.7, 5.2]) {
    const bx = cx + Math.cos(a) * ring, by = cy + Math.sin(a) * ring;
    ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(bx, by, 0.8, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(bx - 0.25, by - 0.25, 0.3, 0, TAU); ctx.fill();
  }
  const glass = ctx.createRadialGradient(cx - r * 0.38, cy - r * 0.45, 0.5, cx, cy, r * 1.06);
  glass.addColorStop(0, '#dcf7ff'); glass.addColorStop(0.6, '#6cc6f2'); glass.addColorStop(1, '#3a9be0');
  const lens = new Path2D(); lens.arc(cx, cy, r, 0, TAU);
  shaded(ctx, lens, glass, () => {
    const fx = cx + 0.15, fy = cy + 0.2;
    eye(ctx, fx - 0.3 * r, fy - 0.2 * r, 0.27 * r); eye(ctx, fx + 0.37 * r, fy - 0.2 * r, 0.27 * r);
    ctx.fillStyle = 'rgba(255,110,150,.55)'; ctx.beginPath();
    ctx.ellipse(fx - 0.5 * r, fy + 0.32 * r, 0.23 * r, 0.14 * r, 0, 0, TAU); ctx.ellipse(fx + 0.6 * r, fy + 0.32 * r, 0.23 * r, 0.14 * r, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 0.2 * r; ctx.beginPath(); ctx.arc(fx + 0.05 * r, fy + 0.26 * r, 0.35 * r, 0.3, Math.PI - 0.3); ctx.stroke();
    // The glass sits sunk in the ring, so its edge falls into shade, most on the top left.
    const sunk = ctx.createRadialGradient(cx + 0.9, cy + 0.9, 0, cx + 0.9, cy + 0.9, r * 1.18);
    sunk.addColorStop(0.7, 'rgba(22,35,59,0)'); sunk.addColorStop(1, 'rgba(22,35,59,.42)');
    ctx.fillStyle = sunk; ctx.fillRect(cx - r - 2, cy - r - 2, r * 2 + 4, r * 2 + 4);
    ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(cx, cy, r * 0.76, 3.5, 4.55); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx + r * 0.2, cy - r * 0.73, 0.8, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(225,250,255,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, r * 0.79, 0.25, 1.35); ctx.stroke();
  }, 2);
}

/** An arm or leg: a thick outlined stroke, straight or (with six numbers) curved. */
function limb(ctx: Ctx, pts: number[], col: string, w = 4.4) {
  ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
  if (pts.length === 6) ctx.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]); else ctx.lineTo(pts[2], pts[3]);
  ctx.strokeStyle = OUT; ctx.lineWidth = w + 3; ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
}

/** Blend two '#rrggbb' colours. */
function mix(a: string, b: string, t: number) {
  const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((p >> sh) & 255) * (1 - t) + ((q >> sh) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

function setup(ctx: Ctx) { ctx.lineJoin = 'round'; ctx.lineCap = 'round'; }

function fillOut(ctx: Ctx, fill: string | CanvasGradient, width = LINE) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Fill a path, paint shading clipped inside it, then outline it on top so the outline stays crisp. */
function shaded(ctx: Ctx, path: Path2D, fill: string | CanvasGradient, shade: () => void, width = LINE) {
  ctx.fillStyle = fill;
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  shade();
  ctx.restore();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = width;
  ctx.stroke(path);
}

/** A band around the diver's body, bowed a little so it reads as wrapping round it. */
function band(ctx: Ctx, x: number, w: number, y0: number, y1: number) {
  const ym = (y0 + y1) / 2;
  ctx.beginPath();
  ctx.moveTo(x, y0); ctx.quadraticCurveTo(x + 1.6, ym, x, y1);
  ctx.lineTo(x + w, y1); ctx.quadraticCurveTo(x + w + 1.6, ym, x + w, y0);
  ctx.closePath();
  ctx.fill();
}

/** '#rrggbb' with an alpha. */
function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

function eye(ctx: Ctx, x: number, y: number, r: number) {
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.4, r * 0.42, 0, TAU); ctx.fill();
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
