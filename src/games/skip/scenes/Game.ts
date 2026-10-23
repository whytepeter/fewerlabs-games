import Phaser from 'phaser';
import { fitCamera, view } from '../../../core/view';
import { TEX_SCALE } from '../../../core/tex';
import { sfx } from '../../../core/sfx';
import { buzz } from '../../../core/haptics';
import { store } from '../../../core/settings';
import { Sim, aimVelocity, previewThrow, RING_T, REST_Y, GOOD, type Obj, type SimEvent, type Grade } from '../game/sim';
import { paintAll, STRIPS, STRIP_RES, LOG_WIDTHS, LOG_M, PAD_W, DUCK, PIER, STONE_FRAMES, OUTLINE, OUTLINE_N, type StripKey } from '../game/art';
import { P, N, A, onTheme } from '../game/palette';
import { audio } from '../game/audio';
import { ui } from '../ui';

type Mode = 'title' | 'ready' | 'aiming' | 'flying' | 'sinking' | 'over';

interface View { img: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite; glow?: Phaser.GameObjects.Image; base: number }
interface Ripple { x: number; age: number; life: number; speed: number; k: number }

const PARALLAX: Record<StripKey, number> = { clouds: 0.03, hillFar: 0.06, hillMid: 0.15, trees: 0.32 };
const STRIP_DEPTH: Record<StripKey, number> = { clouds: 3, hillFar: 4, hillMid: 5, trees: 6 };
const FONT = 'Fredoka, ui-rounded, system-ui, sans-serif';
const TAU = Math.PI * 2;
/** The stone is drawn a little larger than its physics size so its face reads on a phone. */
const STONE_DRAW = TEX_SCALE * 1.3;

// Draw order
const D = { sky: 0, glow: 1, sun: 2, water: 7, refl: 8, glitter: 9, pier: 10, ripples: 11, objs: 12, shadow: 13, trail: 14, aura: 14.5, stone: 15, fx: 16, front: 17, text: 18 };

export class Game extends Phaser.Scene {
  private sim = new Sim();
  private mode: Mode = 'title';
  private worldScale = 1;
  private W = 430;
  private H = 560;
  private waterY = 400;
  private camX = 0;
  private shake = 0;
  private t = 0;

  private sky!: Phaser.GameObjects.Image;
  private water!: Phaser.GameObjects.Image;
  private sunGlow!: Phaser.GameObjects.Image;
  private sun!: Phaser.GameObjects.Image;
  private strips = {} as Record<StripKey, Phaser.GameObjects.Image[]>;
  private refl = {} as Record<StripKey, Phaser.GameObjects.Image[]>;
  private glitter!: Phaser.GameObjects.Graphics;
  private back!: Phaser.GameObjects.Graphics;
  private front!: Phaser.GameObjects.Graphics;
  private pier!: Phaser.GameObjects.Image;
  private stone!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Image;
  private fx!: Record<'splash' | 'chips' | 'sparkle' | 'feathers' | 'bubbles' | 'flame', Phaser.GameObjects.Particles.ParticleEmitter>;
  /** Warm glow behind the stone that grows with the Perfect streak. */
  private aura!: Phaser.GameObjects.Image;
  /** Squash and stretch multiplier, tweened on every bounce. */
  private squash = { x: 1, y: 1 };
  /** The stone squints happily for a moment after a Perfect. */
  private squintT = 0;
  /** Dev only: ignore visibility auto-pause while a test drives frames by hand. */
  private holdAutoPause = false;

  private views = new Map<number, View>();
  private ripples: Ripple[] = [];
  private trail: { x: number; y: number }[] = [];
  private texts: Phaser.GameObjects.Text[] = [];
  private lastSkipText: Phaser.GameObjects.Text[] | null = null;
  private aim: { id: number; sx: number; sy: number; cx: number; cy: number } | null = null;
  private preview: { x: number; y: number }[] = [];

  private best = store.get('best', 0);
  private bestStreak = store.get('bestStreak', 0);
  private thrownOnce = store.get('thrown', false);
  private timedOnce = store.get('timed', false);

  constructor() { super('Game'); }

  create() {
    fitCamera(this.cameras.main);
    this.cameras.main.setBackgroundColor(P['sky-bot']);

    this.sky = this.add.image(0, 0, 'sky').setOrigin(0, 0).setScrollFactor(0).setDepth(D.sky);
    this.sunGlow = this.add.image(0, 0, 'sunglow').setScrollFactor(0).setDepth(D.glow).setScale(TEX_SCALE * 2);
    this.sun = this.add.image(0, 0, 'sun').setScrollFactor(0).setDepth(D.sun).setScale(TEX_SCALE);
    this.water = this.add.image(0, 0, 'water').setOrigin(0, 0).setScrollFactor(0).setDepth(D.water);
    for (const k of Object.keys(STRIPS) as StripKey[]) { this.strips[k] = []; this.refl[k] = []; }
    this.glitter = this.add.graphics().setScrollFactor(0).setDepth(D.glitter);
    this.pier = this.add.image(PIER.x, 0, 'pier').setOrigin(0, 0).setScale(TEX_SCALE).setDepth(D.pier);
    this.back = this.add.graphics().setDepth(D.ripples);
    this.shadow = this.add.image(0, 0, 'shadow').setScale(TEX_SCALE).setDepth(D.shadow).setVisible(false);
    this.front = this.add.graphics().setDepth(D.front);
    this.aura = this.add.image(0, 0, 'glow').setDepth(D.aura).setVisible(false);
    this.stone = this.add.sprite(0, 0, 'stone', 0).setScale(TEX_SCALE).setDepth(D.stone);

    const base = { emitting: false, alpha: { start: 1, end: 0 } };
    this.fx = {
      splash: this.add.particles(0, 0, 'drop', { ...base, alpha: { start: 1, end: 0.2 }, lifespan: { min: 420, max: 720 }, speedX: { min: -70, max: 150 }, speedY: { min: -300, max: -120 }, gravityY: 950, scale: { min: 0.16, max: 0.3 } }),
      chips: this.add.particles(0, 0, 'chip', { ...base, lifespan: 650, speedX: { min: -90, max: 130 }, speedY: { min: -260, max: -90 }, gravityY: 900, scale: { min: 0.3, max: 0.42 }, rotate: { min: 0, max: 360 } }),
      sparkle: this.add.particles(0, 0, 'dot', { ...base, lifespan: 450, speedX: { min: -90, max: 90 }, speedY: { min: -120, max: 40 }, gravityY: 200, scale: { start: 0.3, end: 0.05 }, tint: N.glass }),
      feathers: this.add.particles(0, 0, 'dot', { ...base, lifespan: 800, speedX: { min: -70, max: 70 }, speedY: { min: -140, max: -40 }, gravityY: 120, scale: { min: 0.15, max: 0.3 }, tint: N.duck }),
      bubbles: this.add.particles(0, 0, 'dot', { ...base, lifespan: 600, speedY: -40, gravityY: -20, scale: { min: 0.15, max: 0.3 }, tint: N.ripple }),
      flame: this.add.particles(0, 0, 'dot', { ...base, lifespan: { min: 220, max: 340 }, speedX: { min: -90, max: -30 }, speedY: { min: -50, max: 10 }, gravityY: -80, scale: { start: 0.55, end: 0 }, tint: [N.perfect, N.flame] }),
    };
    Object.values(this.fx).forEach(e => e.setDepth(D.fx));

    this.layout();
    this.sim.reset();
    this.handle(this.sim.drain());
    this.snapCamera();

    this.setupInput();
    ui.bind({
      press: () => { sfx.unlock(); audio.click(); },
      play: () => this.toReady(),
      pause: () => this.pause(),
      resume: () => this.resume(),
      restart: () => { this.resume(); this.newThrow(); },
      menu: () => { this.resume(); this.toTitle(); },
      again: () => this.newThrow(),
    });
    this.toTitle();

    const onResize = () => {
      fitCamera(this.cameras.main);
      this.layout();
      if (this.mode === 'flying' || this.mode === 'sinking') this.pause();
      if (this.mode !== 'flying' && this.mode !== 'sinking' && this.mode !== 'over') this.snapCamera();
      this.render();
    };
    this.game.events.on('view-resize', onResize);
    const onVis = () => {
      if (document.hidden) {
        sfx.suspend();
        if (!this.holdAutoPause && (this.mode === 'flying' || this.mode === 'sinking' || this.mode === 'aiming')) this.pause();
      } else sfx.resume();
    };
    document.addEventListener('visibilitychange', onVis);
    this.events.once('shutdown', () => {
      this.game.events.off('view-resize', onResize);
      document.removeEventListener('visibilitychange', onVis);
    });
    onTheme(() => this.recolor());

    if (import.meta.env.DEV) {
      (window as unknown as { __skip: unknown }).__skip = {
        scene: this,
        sim: this.sim,
        /** Screenshot tools can flip the page hidden for a moment; this keeps it from auto-pausing. */
        holdAutoPause: (on = true) => { this.holdAutoPause = on; },
        /** Advance whole frames even when the tab is hidden and rAF is stopped. */
        // Tweens time themselves with Date.now(), so stepping also nudges a dev-only clock offset forward.
        step: (frames = 1, ms = 1000 / 60) => {
          const w = window as unknown as { __skipClock?: number };
          if (w.__skipClock === undefined) {
            w.__skipClock = 0;
            const realNow = Date.now.bind(Date);
            Date.now = () => realNow() + (w.__skipClock ?? 0);
          }
          for (let i = 0; i < frames; i++) { w.__skipClock += ms; this.game.step(performance.now(), ms); }
        },
      };
    }
  }

  // ---------------------------------------------------------------- layout

  private layout() {
    // 500 rather than the prototype's 560: on short landscape phones the lake reads ~12% larger
    this.worldScale = Math.min(view.h / 500, view.w / 430);
    this.cameras.main.setZoom(view.dpr * this.worldScale);
    this.W = view.w / this.worldScale;
    this.H = view.h / this.worldScale;
    this.waterY = this.H - Math.max(150, this.H * 0.36);
    const { W, H, waterY } = this;
    this.sim.viewW = W;

    this.sky.setPosition(-30, -30).setDisplaySize(W + 60, waterY + 31);
    this.water.setPosition(-30, waterY).setDisplaySize(W + 60, H - waterY + 30);
    const sunX = W * 0.72, sunY = waterY - Math.min(230, waterY * 0.5);
    this.sunGlow.setPosition(sunX, sunY);
    this.sun.setPosition(sunX, sunY);
    this.pier.setY(waterY + PIER.y);

    for (const k of Object.keys(STRIPS) as StripKey[]) {
      const need = Math.ceil((W + 60) / STRIPS[k].w) + 1;
      while (this.strips[k].length < need) {
        this.strips[k].push(this.add.image(0, 0, k).setOrigin(0, 1).setScale(1 / STRIP_RES).setScrollFactor(0).setDepth(STRIP_DEPTH[k]));
        if (k !== 'clouds') this.refl[k].push(this.add.image(0, 0, k).setOrigin(0, 0).setScale(1 / STRIP_RES).setFlipY(true).setAlpha(0.22).setScrollFactor(0).setDepth(D.refl));
      }
    }
  }

  /** Where the stone sits on screen: a bit further left on narrow portrait screens to see ahead. */
  private get anchor() { return Phaser.Math.Clamp(this.W * 0.22, 70, 160); }
  private snapCamera() { this.camX = this.sim.x - this.anchor; }

  // ---------------------------------------------------------------- flow

  private toTitle() {
    this.scene.resume();
    this.sim.reset();
    this.handle(this.sim.drain());
    this.clearFx();
    this.mode = 'title';
    this.snapCamera();
    ui.setBest(this.best);
    ui.hud(false);
    ui.hint(null);
    ui.screen('title');
  }

  private toReady() {
    this.mode = 'ready';
    this.aim = null;
    ui.screen(null);
    ui.hud(true);
    ui.setBest(this.best);
    ui.setDist(0);
    ui.setStreak(0);
    ui.hint(this.thrownOnce ? 'Pull back anywhere, then let go' : 'Pull back anywhere, then let go to throw');
  }

  private newThrow() {
    this.scene.resume();
    this.sim.reset();
    this.handle(this.sim.drain());
    this.clearFx();
    this.snapCamera();
    this.toReady();
  }

  private clearFx() {
    this.ripples.length = 0;
    this.trail.length = 0;
    this.shake = 0;
    for (const t of this.texts) { this.tweens.killTweensOf(t); t.setActive(false).setVisible(false); }
    this.lastSkipText = null;
    Object.values(this.fx).forEach(e => e.killAll());
  }

  private pause() {
    if (this.mode === 'title' || this.mode === 'over' || this.scene.isPaused()) return;
    if (this.mode === 'aiming') { this.aim = null; this.mode = 'ready'; }
    this.scene.pause();
    ui.screen('pause');
  }

  private resume() {
    if (!this.scene.isPaused()) return;
    ui.screen(null);
    this.scene.resume();
  }

  private gameOver() {
    this.mode = 'over';
    const m = this.sim.metres;
    const isBest = m > this.best;
    if (isBest) { this.best = m; store.set('best', m); }
    if (this.sim.bestStreak > this.bestStreak) { this.bestStreak = this.sim.bestStreak; store.set('bestStreak', this.bestStreak); }
    ui.setBest(this.best);
    ui.hud(false);
    ui.hint(null);
    ui.showOver({ metres: m, skips: this.sim.skips, bestStreak: this.sim.bestStreak, glass: this.sim.glass, best: this.best, isBest, plunked: this.sim.plunked });
  }

  // ---------------------------------------------------------------- input

  private logical(p: Phaser.Input.Pointer) {
    const k = view.dpr * this.worldScale;
    return { x: p.x / k, y: p.y / k };
  }

  private setupInput() {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      sfx.unlock();
      if (this.mode === 'ready' && !this.aim) {
        const q = this.logical(p);
        this.aim = { id: p.id, sx: q.x, sy: q.y, cx: q.x, cy: q.y };
        this.mode = 'aiming';
      } else if (this.mode === 'flying') {
        this.sim.tap();
      }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.mode !== 'aiming' || !this.aim || p.id !== this.aim.id) return;
      const q = this.logical(p);
      this.aim.cx = q.x;
      this.aim.cy = q.y;
    });
    const release = (p: Phaser.Input.Pointer) => {
      if (this.mode !== 'aiming' || !this.aim || p.id !== this.aim.id) return;
      const v = aimVelocity(this.aim.sx - this.aim.cx, this.aim.sy - this.aim.cy);
      this.aim = null;
      if (this.sim.throwStone(v)) {
        this.mode = 'flying';
        if (!this.thrownOnce) { this.thrownOnce = true; store.set('thrown', true); }
        ui.hint(this.timedOnce ? null : 'Tap as the stone touches the water');
      } else this.mode = 'ready';
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'Enter') {
        if (this.mode === 'flying') { sfx.unlock(); this.sim.tap(); e.preventDefault(); }
      } else if (e.code === 'Escape' || e.code === 'KeyP') this.pause();
    });
  }

  // ---------------------------------------------------------------- sim events

  private handle(events: SimEvent[]) {
    const wy = this.waterY;
    for (const e of events) {
      switch (e.type) {
        case 'spawn': this.addView(e.obj); break;
        case 'despawn': this.removeView(e.obj); break;
        case 'throw': audio.throw(); buzz(6); this.squish(0.75, 1.3); break;
        case 'queued': audio.queued(); break;
        case 'skip': {
          this.addRipple(e.x, 1);
          const big = e.grade === 'perfect';
          this.fx.splash.explode(big ? 10 + Math.min(e.streak, 10) : 6, e.x, wy - 2);
          this.squish(big ? 1.55 : 1.4, big ? 0.55 : 0.65);
          this.lastSkipText = this.skipFeedback(e.grade, e.x, e.skips, e.streak, false);
          break;
        }
        case 'upgrade': {
          for (const t of this.lastSkipText ?? []) { this.tweens.killTweensOf(t); t.setActive(false).setVisible(false); }
          this.fx.splash.explode(8, e.x, wy - 2);
          this.lastSkipText = this.skipFeedback(e.grade, e.x, e.skips, e.streak, true);
          break;
        }
        case 'pad': {
          this.popup(e.x, wy - 34, 'BOING!', P.good, 26, true);
          audio.boing();
          buzz([8, 50, 8]);
          this.addRipple(e.x, 1.2);
          this.squish(1.5, 0.6);
          const v = this.views.get(e.obj.id);
          if (v) {
            this.tweens.killTweensOf(v.img);
            this.tweens.add({ targets: v.img, scaleY: { from: v.base * 0.5, to: v.base }, scaleX: { from: v.base * 1.15, to: v.base }, duration: 450, ease: 'Back.Out' });
          }
          break;
        }
        case 'log':
          audio.thunk();
          buzz(30);
          this.shake = 8;
          this.squish(1.5, 0.6);
          this.fx.chips.explode(8, e.x, wy + e.y);
          this.popup(e.x, wy - 40, 'BONK!', P['log-hi'], 24, true);
          break;
        case 'duck': {
          audio.quack();
          buzz(12);
          this.fx.feathers.explode(8, e.obj.x, wy - 12);
          this.popup(e.obj.x, wy - 46, 'QUACK!', P.beak, 22, true);
          const v = this.views.get(e.obj.id);
          if (v) (v.img as Phaser.GameObjects.Sprite).setFlipX(true);
          break;
        }
        case 'glass':
          audio.glass();
          this.fx.sparkle.explode(7, e.obj.x, wy - e.obj.h);
          break;
        case 'early':
          audio.early();
          this.popup(e.x, wy + e.y - 30, 'EARLY!', P.bad, 22, true);
          break;
        case 'plunk':
          audio.plunk();
          buzz(40);
          this.shake = 6;
          this.fx.splash.explode(18, e.x, wy - 2);
          this.addRipple(e.x, 0.8); this.addRipple(e.x, 0.4);
          this.popup(e.x, wy - 40, 'PLUNK!', P.bad, 28, true);
          this.toSinking();
          break;
        case 'sink':
          audio.sink();
          buzz(25);
          this.fx.splash.explode(8, e.x, wy - 2);
          this.addRipple(e.x, 0.8); this.addRipple(e.x, 0.4);
          this.toSinking();
          break;
        case 'over':
          this.time.delayedCall(350, () => { if (this.mode === 'sinking') this.gameOver(); });
          break;
      }
    }
  }

  private toSinking() {
    this.mode = 'sinking';
    ui.hint(null);
  }

  /** Squash/stretch the stone, then spring back. */
  private squish(x: number, y: number) {
    this.tweens.killTweensOf(this.squash);
    this.squash.x = x;
    this.squash.y = y;
    this.tweens.add({ targets: this.squash, x: 1, y: 1, duration: 320, ease: 'Back.Out' });
  }

  private skipFeedback(grade: Grade, x: number, skips: number, streak: number, upgraded: boolean): Phaser.GameObjects.Text[] {
    const y = this.waterY - 44;
    if (grade === 'perfect') {
      audio.perfect(streak - 1);
      buzz(8);
      this.addRipple(x, 1.6);
      this.markTimed();
      this.squintT = 0.5;
      // the label grows with the streak
      const size = 26 + Math.min(streak, 15) * 1.6;
      const out = [this.popup(x, y, 'PERFECT!', P.perfect, size, true)];
      if (streak >= 2) out.push(this.popup(x, y + size * 0.85, `×${streak} STREAK`, '#ffffff', 16 + Math.min(streak, 15) * 0.6, true));
      return out;
    }
    if (grade === 'good') {
      audio.good(Math.max(0, streak - 1));
      this.addRipple(x, 1.3);
      this.markTimed();
      return [this.popup(x, y, 'GOOD!', P.good, 26, true)];
    }
    if (!upgraded) audio.plipMiss();
    return [this.popup(x, y + 6, String(skips), '#ffffff', skips % 10 === 0 ? 30 : 22)];
  }

  private markTimed() {
    if (this.timedOnce) return;
    this.timedOnce = true;
    store.set('timed', true);
    ui.hint(null);
  }

  // ---------------------------------------------------------------- views

  private addView(o: Obj) {
    let v: View;
    if (o.type === 'log') {
      const b = LOG_WIDTHS.reduce((a, w) => (Math.abs(w - o.w) < Math.abs(a - o.w) ? w : a), LOG_WIDTHS[0]);
      const img = this.add.image(o.x - LOG_M, 0, 'log' + b).setOrigin(0, 0).setDepth(D.objs);
      img.setScale(((o.w + LOG_M * 2) / (b + LOG_M * 2)) * TEX_SCALE, TEX_SCALE);
      v = { img, base: TEX_SCALE };
    } else if (o.type === 'pad') {
      const s = (o.w / PAD_W) * TEX_SCALE;
      v = { img: this.add.image(o.x, 0, o.flower ? 'padFlower' : 'pad').setScale(s).setDepth(D.objs), base: s };
    } else if (o.type === 'duck') {
      v = { img: this.add.sprite(o.x, 0, 'duck', 0).setOrigin(DUCK.ax / DUCK.w, DUCK.ay / DUCK.h).setScale(TEX_SCALE).setDepth(D.objs), base: TEX_SCALE };
    } else {
      const glow = this.add.image(o.x, 0, 'glow').setScale(TEX_SCALE * 0.55).setTint(N.glass).setAlpha(0.5).setDepth(D.objs);
      v = { img: this.add.image(o.x, 0, 'glass').setScale(TEX_SCALE).setDepth(D.objs), glow, base: TEX_SCALE };
    }
    this.views.set(o.id, v);
  }

  private removeView(o: Obj) {
    const v = this.views.get(o.id);
    if (!v) return;
    this.tweens.killTweensOf(v.img);
    v.img.destroy();
    v.glow?.destroy();
    this.views.delete(o.id);
  }

  /** Outlined cartoon label, in screen space: the camera races after the stone, so a world-space label would be gone in a blink. */
  private popup(x: number, y: number, s: string, color: string, size: number, pop = false) {
    let t = this.texts.find(q => !q.active);
    if (!t) {
      t = this.add.text(0, 0, '', {
        fontFamily: FONT, fontStyle: '700', stroke: OUTLINE, strokeThickness: 6, align: 'center',
        shadow: { offsetX: 0, offsetY: 3, color: OUTLINE, blur: 0, stroke: true, fill: true },
      }).setOrigin(0.5).setPadding(4, 4, 4, 8).setDepth(D.text).setScrollFactor(0);
      this.texts.push(t);
    }
    this.tweens.killTweensOf(t);
    t.setResolution(Math.min(4, Math.max(1, Math.ceil(view.dpr * this.worldScale))));
    const half = Math.min(this.W / 2 - 8, s.length * size * 0.33 + 10);
    const sx = Phaser.Math.Clamp(x - this.camX, half, this.W - half);
    t.setFontSize(size).setColor(color).setText(s).setPosition(sx, y).setAlpha(1).setScale(1).setAngle(0).setActive(true).setVisible(true);
    this.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 520, delay: 380, ease: 'Sine.In', onComplete: () => t!.setActive(false).setVisible(false) });
    if (pop) this.tweens.add({ targets: t, scale: { from: 0.4, to: 1 }, angle: { from: Phaser.Math.Between(-8, 8), to: 0 }, duration: 300, ease: 'Back.Out' });
    return t;
  }

  private addRipple(x: number, k: number) {
    this.ripples.push({ x, age: 0, life: 1.7, speed: 55 + 30 * k, k });
  }

  private recolor() {
    paintAll(this);
    this.cameras.main.setBackgroundColor(P['sky-bot']);
    this.fx.bubbles.setParticleTint(N.ripple);
    this.fx.sparkle.setParticleTint(N.glass);
    this.fx.feathers.setParticleTint(N.duck);
    this.fx.flame.setParticleTint([N.perfect, N.flame]);
    for (const v of this.views.values()) v.glow?.setTint(N.glass);
    if (this.scene.isPaused()) this.render();
  }

  // ---------------------------------------------------------------- frame

  update(_time: number, deltaMs: number) {
    const dt = Math.max(0, Math.min(0.033, deltaMs / 1000));
    this.t += dt;
    const sim = this.sim;
    // a pointer that went away without an up event (tab switch, OS gesture) must not leave a stuck aim
    if (this.mode === 'aiming' && this.aim) {
      const id = this.aim.id;
      if (!this.input.manager.pointers.some(p => p.id === id && p.isDown)) { this.aim = null; this.mode = 'ready'; }
    }
    sim.step(dt);
    this.handle(sim.drain());
    if (this.mode === 'flying') ui.setStreak(sim.streak);
    if (this.mode === 'sinking' && Math.random() < 0.3) this.fx.bubbles.explode(1, sim.x + Phaser.Math.Between(-4, 4), this.waterY + sim.y);
    // a streak catches fire
    if (this.mode === 'flying' && sim.streak >= 5 && Math.random() < 0.4 + sim.streak * 0.04) {
      this.fx.flame.explode(1, sim.x - 8 + Phaser.Math.Between(-3, 3), this.waterY + sim.y + Phaser.Math.Between(-3, 3));
    }
    this.squintT = Math.max(0, this.squintT - dt);

    if (this.mode === 'flying' || this.mode === 'sinking') {
      // follow with smoothing; the vx/10 lead cancels the smoothing lag so the stone holds its spot
      const lead = this.mode === 'flying' ? sim.vx / 10 : 0;
      const target = sim.x + lead - this.anchor;
      this.camX += (target - this.camX) * Math.min(1, dt * 10);
      ui.setDist(sim.metres);
    } else if (this.mode !== 'over') this.snapCamera();

    this.ripples = this.ripples.filter(r => (r.age += dt) < r.life);
    if (this.mode === 'flying') {
      this.trail.push({ x: sim.x, y: sim.y });
      if (this.trail.length > 12) this.trail.shift();
    } else if (this.trail.length) this.trail.shift();
    this.shake = Math.max(0, this.shake - dt * 30);

    this.render();
  }

  private render() {
    const { W, waterY, t, sim } = this;
    const cam = this.cameras.main;
    const sx = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    const sy = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    cam.setScroll(this.camX + sx, sy);
    const cx = this.camX;

    // parallax strips and their reflections; clouds also drift on their own
    for (const k of Object.keys(STRIPS) as StripKey[]) {
      const period = STRIPS[k].w;
      const off = cx * PARALLAX[k] + (k === 'clouds' ? t * 8 : 0);
      let start = -(((off % period) + period) % period);
      if (start > -30) start -= period;
      const y = k === 'clouds' ? waterY - Phaser.Math.Clamp(waterY * 0.45, 120, 300) : waterY + 0.5;
      this.strips[k].forEach((img, i) => img.setPosition(start + i * period, y));
      this.refl[k].forEach((img, i) => img.setPosition(start + i * period, waterY));
    }

    // sun glitter and the bright water line (screen space), shimmer streaks (world space, offset by the camera)
    const g = this.glitter;
    g.clear();
    const sunX = W * 0.72;
    for (let k = 0; k < 18; k++) {
      const y = waterY + 6 + k * k * 1.3;
      if (y > this.H) break;
      const w = 28 - k * 1.1 + Math.sin(t * 2 + k) * 6, j = Math.sin(t * 1.3 + k * 2) * 4;
      g.lineStyle(3, N.sun, Math.max(0, 0.7 - k * 0.035));
      g.lineBetween(sunX - w + j, y, sunX + w + j, y);
    }
    g.lineStyle(3, 0xffffff, 0.55);
    g.lineBetween(-30, waterY + 2, W + 30, waterY + 2);
    for (let i = Math.floor(cx / 70) - 1; i <= Math.floor((cx + W) / 70) + 1; i++) {
      const y = waterY + 12 + hash(i + 3) * (this.H - waterY - 18), x = i * 70 + hash(i) * 50 - cx, len = 10 + hash(i + 9) * 26;
      g.lineStyle(3, N.shimmer, A.shimmer * (0.25 + 0.6 * (0.5 + 0.5 * Math.sin(t * 1.5 + i))));
      g.lineBetween(x, y, x + len, y);
    }

    this.pier.setVisible(cx < 120);

    // ripples
    const b = this.back;
    b.clear();
    for (const r of this.ripples) {
      const rad = 6 + r.age * r.speed;
      b.lineStyle(2.5, N.ripple, A.ripple * (1 - r.age / r.life) * Math.min(1, r.k));
      b.strokeEllipse(r.x, waterY + 1, rad * 2, rad * 0.44);
    }

    // lake objects
    for (const o of sim.objs) {
      const v = this.views.get(o.id);
      if (!v) continue;
      const visible = o.x > cx - 240 && o.x < cx + W + 240;
      v.img.setVisible(visible);
      v.glow?.setVisible(visible);
      if (!visible) continue;
      if (o.type === 'log') v.img.setY(waterY - 14 - LOG_M + Math.sin(t * 1.5 + o.ph) * 1.2);
      else if (o.type === 'pad') v.img.setY(waterY);
      else if (o.type === 'duck') {
        const s = v.img as Phaser.GameObjects.Sprite;
        s.setPosition(o.x, waterY - 6 + Math.sin(t * 2 + o.ph) * 1.5 + o.yOff);
        s.setFrame(o.fly ? 1 + (Math.floor(t * 14) % 2) : 0);
        if (!o.fly) s.setRotation(Math.sin(t * 2.2 + o.ph) * 0.05);
      } else {
        const y = waterY - o.h + Math.sin(t * 2 + o.ph) * 3 - (o.got ? o.gt * 60 : 0);
        const a = o.got ? Math.max(0, 1 - o.gt * 2) : 1;
        const pop = o.got ? 1 + o.gt * 1.5 : 1;
        v.img.setPosition(o.x, y).setRotation(Math.sin(t * 1.4 + o.ph) * 0.3).setAlpha(a).setScale(TEX_SCALE * pop);
        v.glow!.setPosition(o.x, y).setAlpha(0.5 * a * (0.75 + 0.25 * Math.sin(t * 3 + o.ph)));
      }
    }

    // stone, shadow, trail, streak aura
    const f = this.front;
    f.clear();
    const stoneVisible = this.mode !== 'over';
    const resting = this.mode === 'title' || this.mode === 'ready' || this.mode === 'aiming';
    const stY = waterY + (resting ? REST_Y + Math.sin(t * 2) * 1.5 : sim.y);
    const spin = ((sim.rot % TAU) + TAU) % TAU;
    const frame = (Math.floor((spin / TAU) * STONE_FRAMES) % STONE_FRAMES) + (this.squintT > 0 ? STONE_FRAMES : 0);
    this.stone.setVisible(stoneVisible).setPosition(sim.x, stY)
      .setFrame(frame).setRotation(Math.sin(sim.rot) * 0.15)
      .setScale(STONE_DRAW * this.squash.x, STONE_DRAW * this.squash.y)
      .setAlpha(this.mode === 'sinking' ? Math.max(0, 1 - sim.sinkT) : 1);

    const heat = this.mode === 'flying' ? Phaser.Math.Clamp((sim.streak - 2) / 8, 0, 1) : 0;
    this.aura.setVisible(heat > 0);
    if (heat > 0) {
      this.aura.setPosition(sim.x - 2, stY).setTint(N.flame)
        .setScale(TEX_SCALE * (0.6 + heat * 0.5) * (1 + Math.sin(t * 22) * 0.06))
        .setAlpha(0.5 + heat * 0.5);
    }

    if (this.mode === 'flying') {
      const hgt = -sim.y, rx = Math.max(3, 12 - hgt * 0.04);
      this.shadow.setVisible(true).setPosition(sim.x, waterY + 2).setScale((rx / 13) * TEX_SCALE).setAlpha(0.25 * (1 - Math.min(1, hgt / 240)));
    } else this.shadow.setVisible(false);

    this.trail.forEach((p, i) => {
      f.fillStyle(heat > 0 ? N.perfect : 0xffffff, (i / this.trail.length) * 0.45);
      f.fillCircle(p.x, waterY + p.y, 1.5 + (i / this.trail.length) * 2);
    });

    if (this.mode === 'flying') this.drawRing(f);
    if (this.mode === 'aiming') this.drawAim(f, stY);
    if (this.mode === 'ready' && !this.thrownOnce) this.drawGhost(f, stY);
  }

  /** Outlined ellipse: a navy stroke under a coloured one. */
  private ring(f: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, lw: number, alpha: number) {
    f.lineStyle(lw + 3.5, OUTLINE_N, alpha);
    f.strokeEllipse(x, y, w, h);
    f.lineStyle(lw, color, alpha);
    f.strokeEllipse(x, y, w, h);
  }

  /** The timing ring: shrinks onto the landing spot and meets the inner ring at contact. The clearest thing on screen. */
  private drawRing(f: Phaser.GameObjects.Graphics) {
    const sim = this.sim;
    const ttw = sim.timeToWater();
    if (ttw > RING_T || sim.vy < -200) return;
    const landX = sim.x + sim.vx * ttw;
    if (sim.surfaceAt(landX)) return; // pads and logs bounce on their own
    // on narrow screens the landing spot can be ahead of the view: hold the ring at the edge until it scrolls in
    const lx = Math.min(landX, this.camX + this.W - 40);
    const k = ttw / RING_T;
    const color = sim.fumbled ? N.bad : sim.pendingTap !== null ? N.perfect : N.accent;
    const y = this.waterY + 1;
    const fade = Math.min(1, (1 - k) * 3);
    const rx = 15 + k * 46;
    // a faint navy disc under the shrinking ring lifts it off bright water
    f.fillStyle(OUTLINE_N, 0.14 * fade);
    f.fillEllipse(lx, y, rx * 2, rx * 0.6);
    if (sim.pendingTap !== null) {
      f.fillStyle(color, 0.55);
      f.fillEllipse(lx, y, 30, 9);
    }
    // "close enough" band once inside the window
    if (ttw <= GOOD && !sim.fumbled) this.ring(f, lx, y, 44, 14, color, 2.5, 0.7);
    this.ring(f, lx, y, 30, 9, color, 3.5, 0.9 * fade);
    this.ring(f, lx, y, rx * 2, rx * 0.6, color, 5, (0.5 + 0.5 * (1 - k)) * fade);
  }

  private drawAim(f: Phaser.GameObjects.Graphics, stY: number) {
    if (!this.aim) return;
    const v = aimVelocity(this.aim.sx - this.aim.cx, this.aim.sy - this.aim.cy);
    if (v.power < 0.08) return;
    const pv = previewThrow(v, this.preview);
    const color = pv.ok ? N.accent : N.bad;
    const x0 = this.sim.x, y0 = this.waterY;
    // pull band
    const bx = x0 - (v.vx / 1120) * 44, by = stY - (v.vy / 1120) * 44;
    f.lineStyle(6, OUTLINE_N, 0.8);
    f.lineBetween(x0, stY, bx, by);
    f.lineStyle(3, color, 1);
    f.lineBetween(x0, stY, bx, by);
    this.preview.forEach((p, i) => {
      const a = 1 - (i / this.preview.length) * 0.55;
      const px = x0 + p.x, py = y0 + p.y + (stY - (y0 + REST_Y));
      f.fillStyle(OUTLINE_N, a);
      f.fillCircle(px, py, 5);
      f.fillStyle(color, a);
      f.fillCircle(px, py, 3.3);
    });
    this.ring(f, x0 + pv.endX, y0 + 1, 30, 9, color, 3, 0.95);
  }

  /** First-run hint: a ghost fingertip pulling back from the stone. */
  private drawGhost(f: Phaser.GameObjects.Graphics, stY: number) {
    const ph = (this.t % 1.8) / 1.8, e = ph < 0.7 ? ph / 0.7 : 1;
    const sx = this.sim.x, fx = sx - 10 - e * 60, fy = stY + 20 + e * 34;
    const a = ph < 0.85 ? 0.9 : ((1 - ph) / 0.15) * 0.9;
    const len = Math.hypot(fx - sx, fy - stY), n = Math.floor(len / 10);
    for (const [lw, col] of [[6, OUTLINE_N], [3, 0xffffff]] as const) {
      f.lineStyle(lw, col, a);
      for (let i = 0; i < n; i++) {
        const a0 = (i * 10) / len, a1 = Math.min(1, (i * 10 + 5) / len);
        f.lineBetween(sx + (fx - sx) * a0, stY + (fy - stY) * a0, sx + (fx - sx) * a1, stY + (fy - stY) * a1);
      }
    }
    f.fillStyle(OUTLINE_N, a);
    f.fillCircle(fx, fy, 11);
    f.fillStyle(0xffffff, a);
    f.fillCircle(fx, fy, 8);
  }
}

function hash(n: number) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
