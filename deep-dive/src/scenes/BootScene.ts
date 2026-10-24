import Phaser from 'phaser';
import { canvasTexture, glowTexture, sheetTexture, TEX_RES } from '../core/tex';
import { portraits, SKINS, type Skin } from '../game/skins';

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

    for (const skin of SKINS) this.anims.create({ key: `kick-${skin.id}`, frames: this.frames(`diver-${skin.id}`, 6), frameRate: 10, repeat: -1 });
    this.anims.create({ key: 'jelly', frames: this.frames('jelly', 6), frameRate: 7, repeat: -1 });
    this.anims.create({ key: 'eel', frames: this.frames('eel', 4), frameRate: 8, repeat: -1 });
    this.anims.create({ key: 'angler', frames: this.frames('angler', 2), frameRate: 6, repeat: -1 });

    // Pictures for the HTML menus (diver select, shop).
    for (const skin of SKINS) this.portrait(`diver-${skin.id}`, 82, 46);
    for (const key of ['pk-shield', 'pk-magnet', 'pk-life', 'pk-turbo', 'gd-airsaver', 'gd-headstart', 'gd-pearlpull', 'gd-coralguard', 'gd-luckyclam', 'gd-charm']) this.portrait(key, 32, 32);
    this.portrait('air', 32, 32);
    this.portrait('shell', 30, 28);
    this.portrait('chest', 36, 32);

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
    // Body centred at (42, 23), facing right. One sheet per suit.
    sheetTexture(this, `diver-${skin.id}`, 82, 46, 6, (ctx, i) => {
      const k = Math.sin((i / 6) * TAU) * 0.45;
      setup(ctx);
      ctx.translate(42, 23);
      if (skin.extra === 'glow') {
        const g = ctx.createRadialGradient(4, 0, 4, 4, 0, 22);
        g.addColorStop(0, 'rgba(170,235,255,.55)'); g.addColorStop(1, 'rgba(170,235,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(4, 0, 22, 0, TAU); ctx.fill();
      }
      for (const s of [-1, 1]) {
        // Flippers: a tapered blade with a couple of ridges.
        ctx.save();
        ctx.translate(-16, s * 4);
        ctx.rotate(k * s);
        ctx.beginPath();
        ctx.moveTo(0, -3.4);
        ctx.quadraticCurveTo(-12, -7.5, -22, -4);
        ctx.quadraticCurveTo(-19, 0, -22, 4);
        ctx.quadraticCurveTo(-12, 7.5, 0, 3.4);
        ctx.closePath();
        fillOut(ctx, skin.fins);
        ctx.strokeStyle = 'rgba(22,35,59,.28)'; ctx.lineWidth = 1.1;
        for (const y of [-2.6, 0, 2.6]) { ctx.beginPath(); ctx.moveTo(-4, y * 0.4); ctx.lineTo(-18, y); ctx.stroke(); }
        ctx.restore();
      }
      // Air tank on the back, with a valve and a hose to the helmet.
      const metal = ctx.createLinearGradient(0, -17, 0, -8);
      metal.addColorStop(0, '#ffffff'); metal.addColorStop(0.5, '#d3dde6'); metal.addColorStop(1, '#9fb0c0');
      roundRect(ctx, -16, -17, 21, 9, 4.5); fillOut(ctx, metal);
      ctx.fillStyle = '#ff5a7a'; ctx.fillRect(-12.5, -16.2, 3, 7.4);
      roundRect(ctx, 4, -15.5, 3.4, 6, 1.4); fillOut(ctx, '#8796a8', 1.8);
      ctx.beginPath(); ctx.moveTo(7, -12.5); ctx.quadraticCurveTo(11, -13, 9.5, -8.5);
      ctx.lineWidth = 3.6; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.lineWidth = 1.6; ctx.strokeStyle = '#4a5a78'; ctx.stroke();
      if (skin.extra === 'spikes') {
        // Puffer spines poking out above and below the body (it covers their bases).
        for (const a of [-2.5, -2.0, -1.5, -1.0, 1.0, 1.5, 2.0, 2.5]) {
          const x = Math.cos(a) * 15, y = Math.sin(a) * 8.5, nx = Math.cos(a), ny = Math.sin(a);
          ctx.beginPath(); ctx.moveTo(x - ny * 3, y + nx * 3); ctx.lineTo(x + nx * 7, y + ny * 7); ctx.lineTo(x + ny * 3, y - nx * 3); ctx.closePath();
          fillOut(ctx, '#ffe08a', 2);
        }
      }
      // Body: base colour, belly, pattern, then light from above and shade below.
      ctx.beginPath(); ctx.ellipse(0, 0, 17, 10, 0, 0, TAU); fillOut(ctx, skin.body);
      ctx.save();
      ctx.beginPath(); ctx.ellipse(0, 0, 17, 10, 0, 0, TAU); ctx.clip();
      ctx.fillStyle = skin.belly; ctx.beginPath(); ctx.ellipse(0, 6, 15, 5, 0, 0, TAU); ctx.fill();
      if (skin.extra === 'spots') {
        ctx.fillStyle = 'rgba(255,255,255,.6)';
        for (const [x, y, r] of [[-9, -3, 2.4], [-1, -5.5, 1.8], [-5, 3, 1.7], [6, -4, 1.4]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
      } else if (skin.extra === 'stripes') {
        ctx.fillStyle = skin.belly;
        ctx.fillRect(-12, -10, 2.8, 20); ctx.fillRect(4, -10, 2.8, 20);
      }
      const hi = ctx.createRadialGradient(-5, -6, 1, -5, -6, 14);
      hi.addColorStop(0, 'rgba(255,255,255,.5)'); hi.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hi; ctx.fillRect(-17, -10, 34, 20);
      ctx.restore();
      // Harness strap in the fin colour, with a gold buckle.
      ctx.fillStyle = skin.fins; ctx.fillRect(-4.5, -9.4, 3.6, 18.8);
      roundRect(ctx, -5.6, -2, 5.8, 4, 1.2); fillOut(ctx, '#ffc43d', 1.6);
      ctx.beginPath(); ctx.ellipse(0, 0, 17, 10, 0, 0, TAU); ctx.lineWidth = LINE; ctx.strokeStyle = OUT; ctx.stroke();
      // Helmet: silver dome, brass porthole ring with bolts, glass with a face behind it.
      const dome = ctx.createRadialGradient(13, -6, 1, 16, -1.5, 11);
      dome.addColorStop(0, '#ffffff'); dome.addColorStop(1, '#c9d5e0');
      ctx.beginPath(); ctx.arc(16, -1.5, 10.5, 0, TAU); fillOut(ctx, dome);
      ctx.beginPath(); ctx.arc(17.5, -1.5, 8.2, 0, TAU); fillOut(ctx, '#ffc43d', 1.8);
      ctx.fillStyle = OUT;
      for (const a of [0.6, 2.1, 3.7, 5.2]) { ctx.beginPath(); ctx.arc(17.5 + Math.cos(a) * 8.2, -1.5 + Math.sin(a) * 8.2, 0.8, 0, TAU); ctx.fill(); }
      const glass = ctx.createLinearGradient(12, -8, 22, 5);
      glass.addColorStop(0, '#c4f1ff'); glass.addColorStop(1, '#4fb8ee');
      ctx.beginPath(); ctx.arc(17.5, -1.5, 6.6, 0, TAU); fillOut(ctx, glass, 2);
      eye(ctx, 15.6, -2.8, 1.8); eye(ctx, 20, -2.8, 1.8);
      ctx.fillStyle = 'rgba(255,110,150,.55)';
      ctx.beginPath(); ctx.ellipse(14.2, 0.6, 1.5, 0.9, 0, 0, TAU); ctx.ellipse(21.4, 0.6, 1.5, 0.9, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = OUT; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(17.8, 0.2, 2.3, 0.3, Math.PI - 0.3); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(17.5, -1.5, 5, 3.6, 4.5); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.arc(21.2, -5.2, 0.9, 0, TAU); ctx.fill();
      this.drawHeadgear(ctx, skin);
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
  }

  /** Crown, captain's cap or angler lure on top of the helmet. */
  private drawHeadgear(ctx: Ctx, skin: Skin) {
    if (skin.extra === 'crown') {
      ctx.beginPath();
      ctx.moveTo(9.5, -10); ctx.lineTo(10, -17); ctx.lineTo(13.2, -13.4); ctx.lineTo(16, -18.5);
      ctx.lineTo(18.8, -13.4); ctx.lineTo(22, -17); ctx.lineTo(22.5, -10); ctx.closePath();
      fillOut(ctx, '#ffd23f', 2);
      ctx.fillStyle = '#ff5a7a'; ctx.beginPath(); ctx.arc(16, -12.6, 1.4, 0, TAU); ctx.fill();
    } else if (skin.extra === 'cap') {
      roundRect(ctx, 9, -18, 14, 6.5, 3); fillOut(ctx, '#ffffff', 2);
      ctx.beginPath(); ctx.ellipse(17, -11.2, 9.5, 2.6, 0, 0, TAU); fillOut(ctx, '#1d2c6b', 2);
      ctx.fillStyle = '#ffc43d'; ctx.beginPath(); ctx.arc(16, -15, 1.6, 0, TAU); ctx.fill();
    } else if (skin.extra === 'lure') {
      ctx.beginPath(); ctx.moveTo(18, -11.5); ctx.quadraticCurveTo(20, -21, 28, -18.5);
      ctx.lineWidth = 3.6; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.lineWidth = 1.6; ctx.strokeStyle = skin.fins; ctx.stroke();
      const g = ctx.createRadialGradient(29, -18, 0, 29, -18, 7);
      g.addColorStop(0, 'rgba(255,250,170,.9)'); g.addColorStop(1, 'rgba(255,250,170,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(29, -18, 7, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(29, -18, 2.8, 0, TAU); fillOut(ctx, '#fff59d', 1.8);
    }
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
    canvasTexture(this, 'shell', 30, 28, ctx => {
      setup(ctx); ctx.translate(15, 15);
      // A golden scallop: fan, ridges, hinge.
      ctx.beginPath(); ctx.moveTo(0, 9); ctx.lineTo(-11, -2); ctx.quadraticCurveTo(-9, -11, 0, -11); ctx.quadraticCurveTo(9, -11, 11, -2); ctx.closePath();
      const g = ctx.createLinearGradient(0, -11, 0, 9); g.addColorStop(0, '#fff2a8'); g.addColorStop(0.5, '#ffd23f'); g.addColorStop(1, '#f0a500');
      fillOut(ctx, g, 2.4);
      ctx.strokeStyle = 'rgba(160,90,0,.55)'; ctx.lineWidth = 1.4;
      for (const a of [-0.9, -0.45, 0, 0.45, 0.9]) { ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(Math.sin(a) * 10, -Math.cos(a) * 10 + 1); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(-4, 8); ctx.lineTo(4, 8); ctx.lineTo(3, 11); ctx.lineTo(-3, 11); ctx.closePath(); fillOut(ctx, '#f0a500', 2);
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(-4, -6, 2.6, 1.3, -0.5, 0, TAU); ctx.fill();
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
}

function setup(ctx: Ctx) { ctx.lineJoin = 'round'; ctx.lineCap = 'round'; }

function fillOut(ctx: Ctx, fill: string | CanvasGradient, width = LINE) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = width;
  ctx.stroke();
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
