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
    sheetTexture(this, `diver-${skin.id}`, 82, 46, 6, (ctx, i) => paintDiver(ctx, skin, i));
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

// Every character is a "doodle head" (Angry Birds style: big eyes, a heavy brow that carries the
// mood, one signature prop) on a small chubby body. The head is about half the character and sits
// at the front; the body, tank and kicking legs trail behind.

/** Little Brass: a suited kid with a brass diving-helmet cap on a round doodle head. */
const drawBrass: DrawDiver = (ctx, k, _p, s) => {
  const [x, y, r] = [57, 22.5, 13], M = METAL[s.metal ?? 'brass'];
  if (s.extra === 'glow') {
    const g = ctx.createRadialGradient(46, 24, 4, 46, 24, 24);
    g.addColorStop(0, 'rgba(170,235,255,.55)'); g.addColorStop(1, 'rgba(170,235,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(46, 24, 24, 0, TAU); ctx.fill();
  }
  suitBody(ctx, k, s, 12, '#dfe7ee', '#ff5a7a', s.fins);
  const hat = s.extra && HATS.includes(s.extra);
  squash(ctx, x, y, k, () => {
    if (!hat) { roundRect(ctx, x - 3.2, y - r - 4.2, 6.4, 6, 1.8); fillOut(ctx, metal(ctx, x - 3, y - r - 4, x + 3, y - r + 2, M), 2); }
    shaded(ctx, circle(x, y, r), s.body, () => {
      patch(ctx, x, y, r, s.body);
      vol(ctx, x, y, r, r, s.belly);
      // The helmet cap over the top of the head, with a riveted rim.
      const capY = y - 0.4 * r;
      const g = ctx.createRadialGradient(x - 0.45 * r, y - 0.9 * r, 0.5, x, y - 0.5 * r, r * 1.1);
      g.addColorStop(0, M[0]); g.addColorStop(0.5, M[1]); g.addColorStop(1, M[2]);
      ctx.fillStyle = g; ctx.fillRect(x - r - 2, y - r - 2, 2 * r + 4, capY - (y - r - 2));
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(x - 0.42 * r, y - 0.78 * r, 0.26 * r, 0.09 * r, -0.4, 0, TAU); ctx.fill();
      ctx.fillStyle = metal(ctx, x, capY, x, capY + 3.4, [M[1], M[1], M[2]]); ctx.fillRect(x - r - 2, capY, 2 * r + 4, 3.2);
      ctx.strokeStyle = OUT; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x - r - 2, capY); ctx.lineTo(x + r + 2, capY); ctx.moveTo(x - r - 2, capY + 3.2); ctx.lineTo(x + r + 2, capY + 3.2); ctx.stroke();
      ctx.fillStyle = 'rgba(22,35,59,.55)';
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.arc(x + i * r * 0.27, capY + 1.6, 0.65, 0, TAU); ctx.fill(); }
    });
    face(ctx, x, y, r, s.body, { drop: 0.12, lift: -0.06 });
  });
  headgear(ctx, s, x, y - r + 0.6);
};

/** Scuba Kid: a wetsuit hood with the face showing, a big dive mask, snorkel and long fins. */
const drawScuba: DrawDiver = (ctx, k, _p, s) => {
  const [x, y, r] = [57.5, 22.5, 12.5], tone = s.tone ?? '#f6c9a0', mask = s.mask ?? s.fins;
  suitBody(ctx, k, s, 16, '#ffe27a', null, tone);
  const hat = s.extra && HATS.includes(s.extra);
  squash(ctx, x, y, k, () => {
    if (!hat) {
      // Snorkel (it comes off when a hat goes on).
      const sx = x - 0.5 * r;
      ctx.beginPath(); ctx.moveTo(sx, y - 0.4 * r); ctx.lineTo(sx, y - r - 5.5);
      ctx.strokeStyle = OUT; ctx.lineWidth = 4.6; ctx.stroke(); ctx.strokeStyle = mask; ctx.lineWidth = 2.4; ctx.stroke();
      ctx.beginPath(); ctx.arc(sx, y - r - 5.6, 1.9, 0, TAU); fillOut(ctx, '#ff5a7a', 1.6);
    }
    shaded(ctx, circle(x, y, r), s.body, () => {
      ctx.fillStyle = s.fins; ctx.fillRect(x - r - 2, y + 0.5 * r, 2 * r + 4, 0.16 * r);
      // The hood's face opening, with a fringe of hair.
      ctx.fillStyle = tone; ctx.beginPath(); ctx.ellipse(x + 0.32 * r, y + 0.02 * r, 0.62 * r, 0.68 * r, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = s.hair ?? '#5a3a22'; ctx.beginPath(); ctx.ellipse(x + 0.2 * r, y - 0.62 * r, 0.5 * r, 0.2 * r, -0.2, 0, TAU); ctx.fill();
      ctx.strokeStyle = OUT; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(x + 0.32 * r, y + 0.02 * r, 0.62 * r, 0.68 * r, 0, 0, TAU); ctx.stroke();
      vol(ctx, x, y, r, r, s.belly);
    });
    // Mask strap, the mask, eyes behind its glass, brows on the skin above it, mouth below.
    ctx.beginPath(); ctx.moveTo(x - 0.15 * r, y - 0.08 * r); ctx.lineTo(x - 0.95 * r, y - 0.2 * r);
    ctx.strokeStyle = OUT; ctx.lineWidth = 3.6; ctx.stroke(); ctx.strokeStyle = mask; ctx.lineWidth = 1.8; ctx.stroke();
    roundRect(ctx, x - 0.18 * r, y - 0.38 * r, 1.05 * r, 0.62 * r, 0.26 * r); fillOut(ctx, mask, 2.2);
    const lens = new Path2D(); lens.roundRect(x - 0.08 * r, y - 0.29 * r, 0.86 * r, 0.44 * r, 0.18 * r);
    const glass = ctx.createLinearGradient(x, y - 0.3 * r, x + 0.8 * r, y + 0.2 * r); glass.addColorStop(0, '#dcf7ff'); glass.addColorStop(1, '#4fb8ee');
    shaded(ctx, lens, glass, () => {
      face(ctx, x, y + 0.02 * r, r * 0.9, '#ffffff', { mouth: false, brow: false, lift: 0.3 });
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x + 0.02 * r, y + 0.08 * r); ctx.lineTo(x + 0.16 * r, y - 0.22 * r); ctx.stroke();
    }, 1.6);
    face(ctx, x, y + 0.02 * r, r * 0.9, '#ffffff', { mouth: false, eyes: false, lift: 0.3 });
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(x + 0.44 * r, y + 0.36 * r, 0.16 * r, 0.35, Math.PI - 0.5); ctx.stroke();
  });
  headgear(ctx, s, x + 0.1 * r, y - r + 0.6);
};

/** Otter: a furry body with a tail and paws, a backpack, and a round head with ears, muzzle and scarf. */
const drawOtter: DrawDiver = (ctx, k, _p, s) => {
  const [x, y, r] = [57, 23, 12.5], cream = s.cream ?? '#ffe3c2';
  otterTail(ctx, k, s, 27, 28.5);
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(29, 32 + side * 1.5); ctx.rotate(0.5 + side * 0.1 - k * 0.4 * side);
    ctx.beginPath(); ctx.moveTo(1, -1.6); ctx.quadraticCurveTo(-6, -4, -7.5, 0); ctx.quadraticCurveTo(-6, 4, 1, 1.6); ctx.closePath();
    fillOut(ctx, side < 0 ? s.belly : s.body, 2); ctx.restore();
  }
  const pack = new Path2D(); pack.roundRect(27, 15.5, 14, 7, 3.5);
  shaded(ctx, pack, s.fins, () => cylinder(ctx, 27, 15.5, 14, 7));
  torso(ctx, s, cream, s.fins);
  paw(ctx, k, s.body, s.body);
  squash(ctx, x, y, k, () => {
    for (const [ex, ey] of [[x - 0.32 * r, y - 0.86 * r], [x + 0.4 * r, y - 0.92 * r]]) {
      ctx.beginPath(); ctx.arc(ex, ey, 0.27 * r, 0, TAU); fillOut(ctx, s.body, 2);
      ctx.fillStyle = cream; ctx.beginPath(); ctx.arc(ex + 0.03 * r, ey + 0.04 * r, 0.12 * r, 0, TAU); ctx.fill();
    }
    shaded(ctx, circle(x, y, r), s.body, () => {
      ctx.fillStyle = cream; ctx.beginPath(); ctx.ellipse(x + 0.15 * r, y + 0.8 * r, 0.75 * r, 0.42 * r, 0, 0, TAU); ctx.fill();
      vol(ctx, x, y, r, r, s.belly);
      // A scarf in the outfit's accent colour round the neck.
      ctx.strokeStyle = s.fins; ctx.lineWidth = 0.26 * r;
      ctx.beginPath(); ctx.arc(x - 0.08 * r, y - 0.05 * r, r * 1.02, 1.75, 2.85); ctx.stroke();
      ctx.strokeStyle = 'rgba(22,35,59,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x - 0.08 * r, y - 0.05 * r, r * 0.89, 1.75, 2.85); ctx.stroke();
    });
    // Muzzle, then the eyes and brow, nose, mouth and whiskers.
    ctx.beginPath(); ctx.ellipse(x + 0.5 * r, y + 0.36 * r, 0.44 * r, 0.3 * r, 0, 0, TAU); fillOut(ctx, cream, 1.6);
    face(ctx, x, y - 0.06 * r, r, s.body, { mouth: false, browCol: lum(s.body) > 0.75 ? '#5b3a2a' : BROW });
    ctx.fillStyle = OUT; ctx.beginPath(); ctx.ellipse(x + 0.86 * r, y + 0.22 * r, 0.14 * r, 0.1 * r, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.arc(x + 0.62 * r, y + 0.42 * r, 0.09 * r, 0.2, Math.PI - 0.2); ctx.arc(x + 0.8 * r, y + 0.42 * r, 0.09 * r, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.strokeStyle = 'rgba(22,35,59,.6)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(x + 0.9 * r, y + 0.34 * r); ctx.lineTo(x + 1.15 * r, y + 0.28 * r); ctx.moveTo(x + 0.9 * r, y + 0.42 * r); ctx.lineTo(x + 1.15 * r, y + 0.47 * r); ctx.stroke();
  });
  headgear(ctx, s, x + 0.05 * r, y - r + 0.8);
};

/** Pod: a short hull with a spinning prop behind a round cockpit head with a periscope and lamp. */
const drawPod: DrawDiver = (ctx, k, p, s) => {
  const [x, y, r] = [57, 23.5, 12.5], th = (p * TAU) / 3; // a third of a turn per loop: the three blades line up again
  ctx.beginPath(); ctx.moveTo(24, 25); ctx.lineTo(16, 25);
  ctx.strokeStyle = OUT; ctx.lineWidth = 4.4; ctx.stroke(); ctx.strokeStyle = '#8796a8'; ctx.lineWidth = 2.2; ctx.stroke();
  for (const a of [0, 1, 2].map(i => th + (i * TAU) / 3).sort((m, n) => Math.sin(m) - Math.sin(n))) {
    const ext = 7.4 * Math.cos(a);
    ctx.beginPath(); ctx.ellipse(15.5, 25 - ext / 2, 2.3, Math.abs(ext) / 2 + 0.9, 0, 0, TAU);
    fillOut(ctx, Math.sin(a) < 0 ? '#9fb0c0' : '#e3eaf1', 1.8);
  }
  ctx.beginPath(); ctx.arc(15.5, 25, 2.1, 0, TAU); fillOut(ctx, '#ffc43d', 1.6);
  for (const side of [-1, 1]) {
    const fin = new Path2D();
    fin.moveTo(30, 25 + side * 5.2); fin.lineTo(22, 25 + side * 9); fin.quadraticCurveTo(20.5, 25 + side * 5.7, 23, 25 + side * 3); fin.closePath();
    shaded(ctx, fin, s.fins, () => { ctx.fillStyle = side < 0 ? 'rgba(255,255,255,.3)' : 'rgba(22,35,59,.25)'; ctx.fillRect(19, 9, 14, 32); }, 2.2);
  }
  shaded(ctx, oval(36, 25, 16, 9.5), s.body, () => {
    ctx.fillStyle = s.fins; ctx.fillRect(18, 28.5, 36, 3);
    ctx.fillStyle = 'rgba(22,35,59,.45)';
    for (const dx of [-9, -4, 1]) { ctx.beginPath(); ctx.arc(36 + dx, 20.5, 0.65, 0, TAU); ctx.fill(); }
    vol(ctx, 36, 25, 16, 9.5, s.belly);
  });
  ctx.save(); ctx.translate(38, 33.5); ctx.rotate(0.15 + k * 0.25);
  const wing = new Path2D(); wing.moveTo(3, -1.5); wing.quadraticCurveTo(-4, 1, -8, 5); wing.quadraticCurveTo(-1, 5.5, 4, 1.8); wing.closePath();
  shaded(ctx, wing, s.fins, () => { ctx.fillStyle = 'rgba(22,35,59,.2)'; ctx.fillRect(-9, 2, 14, 5); }, 2);
  ctx.restore();
  squash(ctx, x, y, k, () => {
    // Periscope up top, then the cockpit head with a stripe, rivets, lamp and face.
    const px = x - 0.42 * r;
    ctx.beginPath(); ctx.moveTo(px, y - r + 3); ctx.lineTo(px, 4.5); ctx.lineTo(px + 4.5, 4.5);
    ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = '#9fb0c0'; ctx.lineWidth = 2.8; ctx.stroke();
    roundRect(ctx, px + 3.5, 2.4, 3.2, 4.2, 1); fillOut(ctx, '#5fe8ff', 1.4);
    shaded(ctx, circle(x, y, r), s.body, () => {
      ctx.fillStyle = s.fins; ctx.fillRect(x - r - 2, y + 0.42 * r, 2 * r + 4, 0.26 * r);
      ctx.strokeStyle = 'rgba(22,35,59,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x - 0.55 * r, y, 3, r - 0.5, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke();
      ctx.fillStyle = 'rgba(22,35,59,.45)';
      for (const a of [-1.1, -0.55, 0, 0.55, 1.1]) { ctx.beginPath(); ctx.arc(x - 0.55 * r + Math.cos(a) * 3 - 1.2, y + Math.sin(a) * (r - 0.5), 0.6, 0, TAU); ctx.fill(); }
      patch(ctx, x, y, r, s.body);
      vol(ctx, x, y, r, r, s.belly);
    });
    ctx.beginPath(); ctx.arc(x + 0.95 * r, y - 0.55 * r, 1.8, 0, TAU); fillOut(ctx, '#fff59d', 1.5);
    face(ctx, x, y, r, s.body);
  });
  headgear(ctx, s, x + 0.2 * r, y - r + 0.8);
};

const DRAW: Record<CharId, DrawDiver> = { brass: drawBrass, scuba: drawScuba, otter: drawOtter, pod: drawPod };

/**
 * One of an outfit's 6 kick frames, in the 82 x 46 frame at whatever scale `ctx` is set to. Used for
 * the sprite sheets, and live (at screen resolution) for the title screen's showcase.
 */
export function paintDiver(ctx: Ctx, skin: Skin, frame: number) {
  setup(ctx);
  DRAW[skin.char ?? 'brass'](ctx, Math.sin((frame / 6) * TAU), frame / 6, skin);
}

const BROW = '#1b1410';

/**
 * The doodle-head face: two big eyes looking forward and a heavy slab of brow across both, dipping
 * in the middle so they look determined, plus a grin. `under` is the colour the brow sits on (a dark
 * one gets a light rim so the brow still shows).
 */
function face(ctx: Ctx, x: number, y: number, r: number, under: string,
  o: { drop?: number; lift?: number; eyes?: boolean; brow?: boolean; mouth?: boolean; browCol?: string } = {}) {
  const ey = y + (o.drop ?? 0) * r;
  if (o.eyes !== false) {
    for (const [ex, eyy, rx, ry] of [[x + 0.08 * r, ey - 0.04 * r, 0.2 * r, 0.25 * r], [x + 0.55 * r, ey - 0.08 * r, 0.23 * r, 0.28 * r]]) {
      ctx.beginPath(); ctx.ellipse(ex, eyy, rx, ry, 0, 0, TAU); fillOut(ctx, '#ffffff', Math.max(1.3, r * 0.085));
      const px = ex + rx * 0.3, py = eyy + ry * 0.14;
      ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(px, py, rx * 0.52, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(px - rx * 0.18, py - rx * 0.2, rx * 0.17, 0, TAU); ctx.fill();
    }
  }
  if (o.brow !== false) {
    const by = ey - (0.4 + (o.lift ?? 0)) * r;
    const brow = () => {
      ctx.beginPath(); ctx.moveTo(x - 0.16 * r, by - 0.05 * r); ctx.lineTo(x + 0.33 * r, by + 0.07 * r); ctx.lineTo(x + 0.86 * r, by - 0.07 * r); ctx.stroke();
    };
    if (lum(under) < 0.4) { ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 0.2 * r + 2; brow(); }
    ctx.strokeStyle = o.browCol ?? BROW; ctx.lineWidth = 0.2 * r; brow();
  }
  if (o.mouth === false) return;
  ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1.2, 0.09 * r);
  ctx.beginPath(); ctx.arc(x + 0.42 * r, y + 0.32 * r, 0.2 * r, 0.35, Math.PI - 0.55); ctx.stroke();
}

/** The head squashes and stretches a touch with the kick. */
function squash(ctx: Ctx, x: number, y: number, k: number, draw: () => void) {
  ctx.save(); ctx.translate(x, y); ctx.scale(1 + 0.03 * k, 1 - 0.03 * k); ctx.translate(-x, -y);
  draw();
  ctx.restore();
}

/** A light patch toward the front-bottom of a head (inside its clip). */
function patch(ctx: Ctx, x: number, y: number, r: number, body: string) {
  ctx.fillStyle = mix(body, '#ffffff', 0.55);
  ctx.beginPath(); ctx.ellipse(x + 0.3 * r, y + 0.55 * r, 0.66 * r, 0.42 * r, -0.15, 0, TAU); ctx.fill();
}

/** Little Brass's and the Scuba Kid's body: kicking legs with flippers, a tank on the back, the torso and one arm. */
function suitBody(ctx: Ctx, k: number, s: Skin, finLen: number, tankBase: string, tankBand: string | null, hand: string) {
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(28, 28.5 + side * 2); ctx.rotate(0.06 * side + k * 0.32 * side);
    limb(ctx, [0, 0, -8, 0.4], side < 0 ? s.belly : s.body);
    ctx.translate(-7, 0.3);
    const fin = new Path2D();
    fin.moveTo(0, -2.7); fin.quadraticCurveTo(-finLen * 0.55, -6.6, -finLen, -4.3);
    fin.quadraticCurveTo(-finLen * 0.84, 0, -finLen, 4.3); fin.quadraticCurveTo(-finLen * 0.55, 6.6, 0, 2.7); fin.closePath();
    shaded(ctx, fin, s.fins, () => finShade(ctx, side < 0, s.fins, -finLen - 1, 1), 2.2);
    ctx.restore();
  }
  const tank = new Path2D(); tank.roundRect(26, 15, 17, 6.6, 3.3);
  shaded(ctx, tank, tankBase, () => cylinder(ctx, 26, 15, 17, 6.6, tankBand ?? undefined));
  if (s.extra === 'spikes') spikes(ctx, 36, 26.5, 12, 8.5);
  const scuba = s.char === 'scuba';
  torso(ctx, s, mix(s.body, '#ffffff', 0.5), scuba ? null : '#4a5a78', scuba ? s.fins : null);
  paw(ctx, k, s.body, hand);
}

/** The chubby torso behind the head, with the outfit's pattern, a light belly, and a strap or stripe. */
function torso(ctx: Ctx, s: Skin, belly: string, strap: string | null, stripe: string | null = null) {
  const [bx, by, rx, ry] = [36, 26.5, 12, 8.5];
  shaded(ctx, oval(bx, by, rx, ry), s.body, () => {
    if (s.extra === 'spots') {
      ctx.fillStyle = 'rgba(255,255,255,.65)';
      for (const [dx, dy, rr] of [[-6, -2, 1.8], [-1, -4.5, 1.4], [-4, 3, 1.3]]) { ctx.beginPath(); ctx.arc(bx + dx, by + dy, rr, 0, TAU); ctx.fill(); }
    } else if (s.extra === 'stripes') {
      ctx.fillStyle = s.belly;
      for (const dx of [-8, -2]) band(ctx, bx + dx, 2.4, by - ry, by + ry);
    }
    ctx.fillStyle = belly; ctx.beginPath(); ctx.ellipse(bx + 2, by + ry - 1.5, rx * 0.8, 3.6, 0, 0, TAU); ctx.fill();
    if (stripe) { ctx.fillStyle = stripe; ctx.fillRect(bx - rx, by + 1.2, 2 * rx, 1.8); }
    if (strap) { ctx.fillStyle = strap; band(ctx, bx - 4, 2.6, by - ry, by + ry); }
    vol(ctx, bx, by, rx, ry, s.belly);
  });
}

/** One arm paddling under the head. */
function paw(ctx: Ctx, k: number, arm: string, hand: string) {
  const hx = 51.5 + k * 1.6, hy = 34.5 - k * 0.6;
  limb(ctx, [44, 29.5, 47.5 + k, 34, hx, hy], arm, 3.4);
  ctx.beginPath(); ctx.arc(hx + 0.4, hy, 2.4, 0, TAU); fillOut(ctx, hand, 1.8);
}

/** The otter's thick tail, flapping with the kick. */
function otterTail(ctx: Ctx, k: number, s: Skin, x: number, y: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(k * 0.3);
  const tail = new Path2D();
  tail.moveTo(2, -4.6); tail.quadraticCurveTo(-7, -5, -15, -1.4); tail.quadraticCurveTo(-17.5, 0.4, -15, 2.1); tail.quadraticCurveTo(-7, 4.4, 2, 4.2); tail.closePath();
  shaded(ctx, tail, s.body, () => {
    const g = ctx.createLinearGradient(0, -5, 0, 5);
    g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, rgba(s.belly, 0.9));
    ctx.fillStyle = g; ctx.fillRect(-18, -6, 21, 12);
  });
  ctx.restore();
}

const circle = (x: number, y: number, r: number) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
const oval = (x: number, y: number, rx: number, ry: number) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, 0, 0, TAU); return p; };

/** Rough brightness of a '#rrggbb' colour, 0..1. */
function lum(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

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
