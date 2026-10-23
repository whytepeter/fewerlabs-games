import Phaser from 'phaser';
import { fitCamera, view } from '../../../core/view';
import { sfx } from '../../../core/sfx';
import { buzz } from '../../../core/haptics';
import { store } from '../../../core/settings';
import { mixNum, TEX_SCALE } from '../../../core/tex';
import { BIOMES, biomeIndex, palette, type Palette } from '../game/biomes';
import { cave } from '../game/cave';
import { Ambient } from '../game/ambient';
import { ui } from '../ui';
import { LIGHT_SPAN } from './BootScene';

type Sprite = Phaser.GameObjects.Sprite;
type Image = Phaser.GameObjects.Image;
type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;
type Point = { x: number; y: number };
type Kind = 'jelly' | 'mine' | 'angler';
type State = 'title' | 'play' | 'paused' | 'over';

interface Obstacle { kind: Kind; x: number; y: number; y0: number; r: number; ph: number; amp: number; vx: number; floor: number; dy: number; sprite: Sprite; glow: Image }
interface Air { x: number; y: number; ph: number; sprite: Image; glow: Image }

const TAU = Math.PI * 2;
const clamp = Phaser.Math.Clamp;
const lerp = Phaser.Math.Linear;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(a: T[]) => a[(Math.random() * a.length) | 0];
const hash = (n: number) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };

const DIVER_R = 13;
const OUTLINE = 0x16233b;
const CORAL = [0xff7aa8, 0xff9f43, 0xb07cff, 0xffd23f];
const MOTES = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), z: rand(0.25, 1) }));
const REASONS: Record<Kind, string> = { jelly: 'Stung by a jellyfish', mine: 'Bumped a sea mine', angler: 'Swallowed by an anglerfish' };

export class GameScene extends Phaser.Scene {
  private state: State = 'title';
  private clock = 0;
  private dist = 0;
  private speed = 200;
  private oxy = 100;
  private diverY = 0;
  private vy = 0;
  private runT = 0;
  private swim = 0;
  private obs: Obstacle[] = [];
  private air: Air[] = [];
  private nextObs = 0;
  private nextAir = 0;
  private biome = 0;
  private beepT = 0;
  private exhaustT = 0;
  private heldFor = 0;
  private learned = store.get('learned', false);
  private best = store.get('best', 0);
  private bestZone = store.get('bestZone', 0);
  private lastH = 0;
  private pal: Palette = { top: 0, bot: 0, rock: 0, dark: 0, vent: 0 };
  private cv: [number, number] = [0, 0];
  private topEdge: Point[] = [];
  private botEdge: Point[] = [];
  private topRim: Point[] = [];
  private botRim: Point[] = [];

  private bg!: Phaser.GameObjects.Graphics;
  private rays!: Phaser.GameObjects.Graphics;
  private snow!: Phaser.GameObjects.Graphics;
  private far!: Phaser.GameObjects.Graphics;
  private rock!: Phaser.GameObjects.Graphics;
  private vent!: Phaser.GameObjects.Graphics;
  private edges!: Phaser.GameObjects.Graphics;
  private lightMask!: Image;
  private cone!: Image;
  private diver!: Sprite;
  private exhaust!: Emitter;
  private pops!: Emitter;
  private sparks!: Emitter;
  private ambient = new Ambient();
  private keys!: Record<'space' | 'up' | 'w', Phaser.Input.Keyboard.Key>;

  constructor() { super('game'); }

  create() {
    fitCamera(this.cameras.main);
    this.lastH = view.h;
    this.game.events.on('view-resize', this.onResize, this);

    this.bg = this.add.graphics().setScrollFactor(0).setDepth(0);
    this.rays = this.add.graphics().setScrollFactor(0).setDepth(1).setBlendMode(Phaser.BlendModes.ADD);
    this.far = this.add.graphics().setScrollFactor(0).setDepth(1.5);
    this.snow = this.add.graphics().setScrollFactor(0).setDepth(2);
    this.rock = this.add.graphics().setDepth(3);
    this.vent = this.add.graphics().setScrollFactor(0).setDepth(4);
    this.diver = this.add.sprite(0, 0, 'diver', 0).setOrigin(42 / 82, 0.5).setScale(TEX_SCALE).setDepth(6);
    this.diver.play('kick');
    this.lightMask = this.add.image(0, 0, 'lightmask').setScrollFactor(0).setDepth(8);
    this.cone = this.add.image(0, 0, 'cone').setScrollFactor(0).setDepth(9).setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD);
    this.edges = this.add.graphics().setDepth(9).setBlendMode(Phaser.BlendModes.ADD);

    this.exhaust = this.add.particles(0, 0, 'ring', {
      lifespan: { min: 700, max: 1200 }, speedX: { min: -40, max: 0 }, speedY: { min: -60, max: -20 }, accelerationY: -70,
      scale: { start: TEX_SCALE * 0.9, end: TEX_SCALE * 0.4 }, alpha: { start: 0.8, end: 0 }, emitting: false,
    }).setDepth(12);
    this.pops = this.add.particles(0, 0, 'ring', {
      lifespan: { min: 350, max: 600 }, speed: { min: 40, max: 110 }, scale: { start: TEX_SCALE * 1.1, end: TEX_SCALE * 0.3 },
      alpha: { start: 1, end: 0 }, emitting: false,
    }).setDepth(12);
    this.sparks = this.add.particles(0, 0, 'star', {
      lifespan: { min: 500, max: 900 }, speed: { min: 60, max: 230 }, scale: { start: TEX_SCALE * 1.3, end: 0 },
      rotate: { min: 0, max: 360 }, alpha: { start: 1, end: 0 }, tint: [0xffd23f, 0xff7a2f, 0xffffff], emitting: false,
    }).setDepth(12);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys({ space: 'SPACE', up: 'UP', w: 'W' }) as GameScene['keys'];
    kb.addCapture('SPACE,UP');
    kb.on('keydown-ESC', () => this.togglePause());
    kb.on('keydown-P', () => this.togglePause());
    kb.on('keydown-SPACE', () => { if (this.state === 'title' || this.state === 'over') this.startRun(); });
    kb.on('keydown-ENTER', () => { if (this.state === 'title' || this.state === 'over') this.startRun(); });
    this.input.on('pointerdown', () => sfx.unlock());
    kb.on('keydown', () => sfx.unlock());

    document.addEventListener('visibilitychange', this.onVisibility);
    this.events.once('shutdown', () => {
      document.removeEventListener('visibilitychange', this.onVisibility);
      this.game.events.off('view-resize', this.onResize, this);
    });

    ui.init({
      play: () => this.startRun(),
      pause: () => this.pause(),
      resume: () => this.resume(),
      restart: () => this.startRun(),
      menu: () => this.toTitle(),
    });
    this.toTitle();
  }

  // ---------- Flow

  private toTitle() {
    this.clearWorld();
    this.ambient.stop();
    sfx.resume();
    this.state = 'title';
    this.dist = 0;
    this.diverY = this.caveMid(0);
    this.diver.setVisible(true).setAlpha(1).setRotation(0);
    ui.showTitle(this.best);
  }

  private startRun() {
    sfx.unlock();
    sfx.resume();
    this.clearWorld();
    this.dist = 0;
    this.speed = 200;
    this.oxy = 100;
    this.diverY = this.caveMid(0);
    this.vy = 0;
    this.runT = 0;
    this.biome = 0;
    this.nextObs = 520;
    this.nextAir = 320;
    this.beepT = 0;
    this.diver.setVisible(true).setAlpha(1).setRotation(0);
    this.state = 'play';
    ui.screen(null);
    ui.hud(true);
    ui.setBest(this.best);
    ui.setDepth(0);
    ui.banner(BIOMES[0].name);
    ui.hint(!this.learned);
    this.ambient.start();
    sfx.tone(330, 0.25, { vol: 0.08, slideTo: 520 });
  }

  private pause() {
    if (this.state !== 'play') return;
    this.state = 'paused';
    sfx.suspend();
    ui.screen('pause');
  }

  private resume() {
    if (this.state !== 'paused') return;
    this.state = 'play';
    sfx.resume();
    ui.screen(null);
  }

  private togglePause() {
    if (this.state === 'play') this.pause();
    else if (this.state === 'paused') this.resume();
  }

  private onVisibility = () => {
    if (document.hidden) { this.pause(); sfx.suspend(); }
    else if (this.state !== 'paused') sfx.resume();
  };

  private onResize() {
    fitCamera(this.cameras.main);
    // Keep everything at the same relative height so the trench still lines up.
    if (this.lastH && this.lastH !== view.h) {
      const k = view.h / this.lastH;
      this.diverY *= k;
      for (const o of this.obs) { o.y *= k; o.y0 *= k; o.floor *= k; }
      for (const a of this.air) a.y *= k;
    }
    this.lastH = view.h;
    this.pause();
  }

  private clearWorld() {
    for (const o of this.obs) { o.sprite.destroy(); o.glow.destroy(); }
    for (const a of this.air) { a.sprite.destroy(); a.glow.destroy(); }
    this.obs = [];
    this.air = [];
    this.exhaust.killAll();
    this.pops.killAll();
    this.sparks.killAll();
  }

  // ---------- Simulation

  update(_time: number, deltaMs: number) {
    const dt = Math.min(0.033, deltaMs / 1000);
    this.clock += dt;

    if (this.state === 'play') this.step(dt);
    else if (this.state !== 'paused') this.idle(dt);
    this.draw();
  }

  private holding() {
    if (this.keys.space.isDown || this.keys.up.isDown || this.keys.w.isDown) return true;
    return this.input.manager.pointers.some(p => p.isDown);
  }

  private step(dt: number) {
    const hold = this.holding();
    this.runT += dt;
    // Sinking eases in so the first second isn't a surprise death.
    const sink = 680 * Math.min(1, 0.25 + this.runT / 2);
    this.vy = clamp(this.vy + (hold ? -1150 : sink) * dt, -360, 400);
    this.diverY += this.vy * dt;
    this.swim += dt;
    this.diver.anims.timeScale = hold ? 1.8 : 0.6;

    if (hold) {
      this.heldFor += dt;
      if (!this.learned && this.heldFor > 1.2) { this.learned = true; store.set('learned', true); ui.hint(false); }
      this.exhaustT -= dt;
      if (this.exhaustT <= 0) {
        this.exhaustT = 0.05;
        this.exhaust.emitParticleAt(this.dist - 4, this.diverY - 10, 1);
        if (Math.random() < 0.12) sfx.tone(rand(280, 420), 0.07, { vol: 0.025, slideTo: 640 });
      }
    }

    const depth = this.dist / 10;
    this.speed = 200 + Math.min(200, depth * 0.14);
    this.dist += this.speed * dt;
    ui.setDepth(Math.floor(depth));
    this.ambient.setDepth(depth);

    // Oxygen drains a little faster the deeper you are.
    this.oxy -= (6.5 + depth * 0.003) * dt;
    const low = this.oxy < 25;
    ui.setOxygen(this.oxy / 100, low);
    ui.lowO2(low);
    if (low) {
      this.beepT -= dt;
      if (this.beepT <= 0) { this.beepT = 0.55; sfx.tone(880, 0.07, { type: 'square', vol: 0.025 }); }
    }

    const bi = biomeIndex(depth);
    if (bi !== this.biome) {
      this.biome = bi;
      ui.banner(BIOMES[bi].name);
      this.cameras.main.flash(260, 180, 230, 255);
      sfx.tone(392, 0.7, { vol: 0.08 });
      sfx.tone(587, 0.9, { vol: 0.06, delay: 0.08 });
      buzz(20);
    }

    this.nextObs -= this.speed * dt;
    if (this.nextObs <= 0) {
      this.spawnObstacle(depth);
      this.nextObs = lerp(430, 200, clamp(depth / 1200, 0, 1)) * rand(0.75, 1.25);
    }
    this.nextAir -= this.speed * dt;
    if (this.nextAir <= 0) {
      this.spawnAir();
      this.nextAir = rand(420, 620) + depth * 0.08;
    }

    const leftEdge = this.dist - this.diverX() - 140;
    for (const o of this.obs) {
      this.animate(o, dt);
      if (o.kind === 'angler') { o.x += o.vx * dt; o.y += clamp(this.diverY - o.y, -1, 1) * 22 * dt; }
      if (Math.hypot(o.x - this.dist, o.y + o.dy - this.diverY) < o.r + DIVER_R * 0.8) return this.die(REASONS[o.kind]);
    }
    this.obs = this.obs.filter(o => {
      if (o.x > leftEdge) return true;
      o.sprite.destroy(); o.glow.destroy();
      return false;
    });

    this.air = this.air.filter(a => {
      a.ph += dt;
      if (Math.hypot(a.x - this.dist, a.y - this.diverY) < 8 + DIVER_R + 6) {
        this.oxy = Math.min(100, this.oxy + 11);
        sfx.tone(rand(620, 820), 0.12, { vol: 0.12, slideTo: 1200 });
        buzz(8);
        this.pops.explode(7, a.x, a.y);
        this.tweens.add({ targets: this.diver, scaleX: TEX_SCALE * 1.18, scaleY: TEX_SCALE * 0.86, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
        a.sprite.destroy(); a.glow.destroy();
        return false;
      }
      if (a.x > leftEdge + 100) return true;
      a.sprite.destroy(); a.glow.destroy();
      return false;
    });

    const [top, bot] = cave(this.dist, view.h, this.cv);
    if (this.diverY - DIVER_R < top || this.diverY + DIVER_R > bot) return this.die('Scraped the trench wall');
    if (this.oxy <= 0) { this.oxy = 0; return this.die('Ran out of air'); }
  }

  private idle(dt: number) {
    for (const o of this.obs) this.animate(o, dt);
    for (const a of this.air) a.ph += dt;
    if (this.state === 'title') {
      this.diverY = this.caveMid(0) + Math.sin(this.clock * 1.4) * 8;
      this.diver.anims.timeScale = 0.5;
      this.exhaustT -= dt;
      if (this.exhaustT <= 0) { this.exhaustT = rand(0.4, 1.1); this.exhaust.emitParticleAt(this.dist - 4, this.diverY - 10, 1); }
    } else if (this.state === 'over') {
      this.diverY += 40 * dt;
      this.diver.setAlpha(Math.max(0, this.diver.alpha - dt * 0.6));
    }
  }

  private animate(o: Obstacle, dt: number) {
    o.ph += dt;
    if (o.kind === 'jelly') o.y = o.y0 + Math.sin(o.ph * 1.4) * o.amp;
    if (o.kind === 'mine') o.dy = Math.sin(o.ph * 2) * 5;
  }

  private spawnObstacle(depth: number) {
    const wx = this.dist - this.diverX() + view.w + 80;
    const [t, b] = cave(wx, view.h, this.cv);
    const kinds: Kind[] = ['jelly'];
    if (depth > 50) kinds.push('mine');
    if (depth > 200) kinds.push('angler');
    if (depth > 450) kinds.push('jelly', 'angler', 'mine');
    const kind = pick(kinds), y = rand(t + 45, b - 45);
    const base = { kind, y, y0: y, ph: rand(0, TAU), amp: 0, vx: 0, floor: b, dy: 0 };
    let o: Obstacle;
    if (kind === 'jelly') {
      o = { ...base, x: wx, r: 15, amp: rand(18, 46), sprite: this.add.sprite(wx, y, 'jelly', 0).setOrigin(0.5, 20 / 60), glow: this.glow(0xff78d2) };
      o.sprite.play({ key: 'jelly', startFrame: (Math.random() * 6) | 0 });
    } else if (kind === 'mine') {
      o = { ...base, x: wx, r: 14, sprite: this.add.sprite(wx, y, 'mine'), glow: this.glow(0xff3c3c) };
    } else {
      o = { ...base, x: wx + 140, r: 17, vx: -rand(70, 140), sprite: this.add.sprite(wx + 140, y, 'angler', 0).setOrigin(56 / 108, 38 / 72), glow: this.glow(0xbeff8c) };
      o.sprite.play('angler');
    }
    o.sprite.setScale(TEX_SCALE).setDepth(5);
    this.obs.push(o);
  }

  private spawnAir() {
    const wx = this.dist - this.diverX() + view.w + 60;
    const [t, b] = cave(wx, view.h, this.cv);
    const y = rand(t + 40, b - 40);
    for (let i = 0; i < 3; i++) {
      const x = wx + i * 34, ay = y + Math.sin(i * 1.7) * 14;
      this.air.push({
        x, y: ay, ph: rand(0, TAU),
        sprite: this.add.image(x, ay, 'air').setScale(TEX_SCALE).setDepth(11),
        glow: this.glow(0x96e6ff).setDepth(10.5),
      });
    }
  }

  private glow(tint: number) {
    return this.add.image(0, 0, 'glow').setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setDepth(10).setAlpha(0);
  }

  private die(reason: string) {
    this.state = 'over';
    this.sparks.explode(26, this.dist, this.diverY);
    this.pops.explode(14, this.dist, this.diverY);
    this.cameras.main.shake(380, 0.012);
    buzz([40, 30, 90]);
    sfx.tone(180, 0.5, { type: 'sawtooth', vol: 0.08, slideTo: 60 });
    sfx.noise(0.4, 0.1, 500);
    this.ambient.stop();
    this.diver.setRotation(0.9);

    const depth = Math.floor(this.dist / 10);
    const isBest = depth > this.best;
    if (isBest) { this.best = depth; store.set('best', depth); }
    if (this.biome > this.bestZone) { this.bestZone = this.biome; store.set('bestZone', this.biome); }
    ui.lowO2(false);
    ui.hint(false);
    this.time.delayedCall(800, () => {
      if (this.state === 'over') ui.showOver({ depth, reason, zone: BIOMES[this.biome].name, best: this.best, isBest });
    });
  }

  // ---------- Rendering

  private diverX() { return Math.min(view.w * 0.28, 260); }
  private caveMid(wx: number) { const [t, b] = cave(wx, view.h, this.cv); return (t + b) / 2; }

  private draw() {
    const W = view.w, H = view.h, T = this.clock, depth = this.dist / 10;
    const pal = palette(depth, this.pal);
    const px = this.diverX();
    const x0 = this.dist - px;
    this.cameras.main.scrollX = x0;

    this.bg.clear();
    this.bg.fillGradientStyle(pal.top, pal.top, pal.bot, pal.bot, 1);
    this.bg.fillRect(0, 0, W, H);

    // Sun rays fade out as the light disappears.
    this.rays.clear();
    const ray = clamp(1 - depth / 180, 0, 1);
    if (ray > 0) {
      this.rays.fillStyle(0xb4f0ff, 0.05 * ray);
      for (let i = 0; i < 5; i++) {
        const span = W + 400, x = (((i * W * 0.27 - this.dist * 0.08) % span) + span) % span - 100;
        this.rays.fillPoints([{ x, y: -10 }, { x: x + 60, y: -10 }, { x: x - 60, y: H }, { x: x - 200, y: H }], true);
      }
    }

    // Marine snow drifting past at different depths.
    this.snow.clear();
    for (const m of MOTES) {
      const x = (((m.x * W - this.dist * m.z * 0.6) % W) + W) % W, y = (m.y * H + T * 10 * m.z) % H, s = 1.6 * m.z + 0.6;
      this.snow.fillStyle(0xdcf0ff, 0.28 * m.z);
      this.snow.fillRect(x, y, s, s);
    }

    // Far rock silhouettes for depth (slower parallax, no outline).
    this.far.clear();
    this.far.fillStyle(mixNum(pal.top, pal.rock, 0.55), 0.55);
    for (const side of [0, 1]) {
      const pts: Point[] = [{ x: -20, y: side ? H + 20 : -20 }];
      for (let sx = -20; sx <= W + 20; sx += 24) {
        const wx = sx + this.dist * 0.45;
        const bump = (Math.sin(wx * 0.006 + side * 2) * 0.5 + Math.sin(wx * 0.017 + side) * 0.3 + 0.8) * H * 0.14;
        pts.push({ x: sx, y: side ? H - bump : bump });
      }
      pts.push({ x: W + 20, y: side ? H + 20 : -20 });
      this.far.fillPoints(pts, true);
    }

    // Trench walls, in world coordinates: fill, bold outline, then a lighter rim just inside.
    const n = Math.ceil((W + 40) / 12) + 1;
    this.topEdge.length = this.botEdge.length = this.topRim.length = this.botRim.length = n;
    for (let i = 0; i < n; i++) {
      const wx = x0 - 20 + i * 12;
      cave(wx, H, this.cv);
      (this.topEdge[i] ??= { x: 0, y: 0 }).x = wx; this.topEdge[i].y = this.cv[0];
      (this.botEdge[i] ??= { x: 0, y: 0 }).x = wx; this.botEdge[i].y = this.cv[1];
      (this.topRim[i] ??= { x: 0, y: 0 }).x = wx; this.topRim[i].y = this.cv[0] - 6;
      (this.botRim[i] ??= { x: 0, y: 0 }).x = wx; this.botRim[i].y = this.cv[1] + 6;
    }
    const left = x0 - 20, right = left + (n - 1) * 12;
    const g = this.rock;
    g.clear();
    g.fillStyle(pal.rock, 1);
    g.fillPoints([{ x: left, y: -20 }, ...this.topEdge, { x: right, y: -20 }], true);
    g.fillPoints([{ x: left, y: H + 20 }, ...this.botEdge, { x: right, y: H + 20 }], true);
    g.lineStyle(4, mixNum(pal.rock, 0xffffff, 0.22), 1);
    g.strokePoints(this.topRim);
    g.strokePoints(this.botRim);
    g.lineStyle(4.5, OUTLINE, 1);
    g.strokePoints(this.topEdge);
    g.strokePoints(this.botEdge);

    // Kelp and coral on the reef floor.
    const reef = clamp(1 - depth / 220, 0, 1);
    if (reef > 0) {
      for (let k = Math.floor(x0 / 70); k < (x0 + W) / 70 + 1; k++) {
        const wx = k * 70 + hash(k + 9) * 40, base = cave(wx, H, this.cv)[1] + 4;
        if (hash(k) < 0.4) {
          const c = CORAL[(hash(k + 5) * CORAL.length) | 0];
          for (let j = 0; j < 3; j++) {
            const cx = wx + (j - 1) * 7, cy = base - 4 - hash(k + j) * 10, r = 4.5 + hash(k + j + 2) * 3.5;
            g.fillStyle(c, reef); g.fillCircle(cx, cy, r);
            g.lineStyle(2.5, OUTLINE, reef); g.strokeCircle(cx, cy, r);
          }
          continue;
        }
        const h = 24 + hash(k + 3) * 46;
        const pts: Point[] = [];
        for (let j = 0; j <= 6; j++) pts.push({ x: wx + Math.sin(T * 1.5 + k + j * 0.6) * j * 1.6, y: base - (h * j) / 6 });
        g.lineStyle(8, OUTLINE, reef); g.strokePoints(pts);
        g.lineStyle(4.5, 0x3ad06b, reef); g.strokePoints(pts);
      }
    }
    // Mine chains to the floor.
    for (const o of this.obs) {
      if (o.kind !== 'mine') continue;
      g.lineStyle(5, OUTLINE, 1); g.lineBetween(o.x, o.y + o.dy + o.r, o.x, o.floor + 10);
      g.lineStyle(2.2, 0x9aa8b8, 1); g.lineBetween(o.x, o.y + o.dy + o.r, o.x, o.floor + 10);
    }

    this.vent.clear();
    if (pal.vent > 0) {
      const a = 0.28 * pal.vent;
      this.vent.fillGradientStyle(0xff5a1e, 0xff5a1e, 0xff5a1e, 0xff5a1e, 0, 0, a, a);
      this.vent.fillRect(0, H * 0.55, W, H * 0.45);
    }

    // Obstacles and their glows (glows sit above the darkness, like bioluminescence).
    for (const o of this.obs) {
      o.sprite.setPosition(o.x, o.y + o.dy);
      if (o.kind === 'jelly') {
        o.glow.setPosition(o.x, o.y).setDisplaySize(72, 72).setAlpha(0.14 + pal.dark * 0.24);
      } else if (o.kind === 'mine') {
        o.glow.setPosition(o.x, o.y + o.dy - 3).setDisplaySize(34, 34).setAlpha(Math.sin(T * 6 + o.ph) > 0 ? 0.9 : 0);
      } else {
        o.glow.setPosition(o.x - o.r * 2.2, o.y - o.r * 1.5).setDisplaySize(56, 56).setAlpha(0.6 + Math.sin(T * 4 + o.ph) * 0.2);
      }
    }
    for (const a of this.air) {
      const y = a.y + Math.sin(a.ph * 3) * 3;
      a.sprite.setPosition(a.x, y);
      a.glow.setPosition(a.x, y).setDisplaySize(44, 44).setAlpha(0.35);
    }

    const tilt = this.state === 'over' ? 0.9 : clamp(this.vy / 700, -0.45, 0.45);
    this.diver.setPosition(this.dist, this.diverY).setRotation(this.state === 'play' || this.state === 'paused' ? tilt : this.diver.rotation);

    // Darkness with a pool of headlamp light around the diver.
    const dark = pal.dark;
    const lx = px + 30, ly = this.diverY;
    if (dark > 0.01) {
      this.lightMask.setVisible(true).setPosition(lx, ly).setDisplaySize(LIGHT_SPAN, LIGHT_SPAN).setAlpha(dark);
      this.cone.setVisible(this.state !== 'over').setPosition(px + 14, ly).setAlpha(0.14 * dark);
    } else {
      this.lightMask.setVisible(false);
      this.cone.setVisible(false);
    }

    this.edges.clear();
    if (dark > 0.01) {
      this.edges.lineStyle(2, 0x6ebeff, 0.16 * dark);
      this.edges.strokePoints(this.topEdge);
      this.edges.strokePoints(this.botEdge);
    }
  }
}
