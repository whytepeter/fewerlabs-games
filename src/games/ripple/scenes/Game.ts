import Phaser from 'phaser';
import { fitCamera, view } from '../../../core/view';
import { TEX_SCALE } from '../../../core/tex';
import { sfx } from '../../../core/sfx';
import { buzz } from '../../../core/haptics';
import { store } from '../../../core/settings';
import { music } from '../../../core/music';
import { Sim, RIP_LIFE, RIP_SPEED, GOLD_POINTS, PICKUP_R, type Boat, type Dock, type Rock, type Pad, type Mote, type Pickup, type Rect } from '../game/sim';
import { MUSIC, RIPPLE_SONG } from '../game/song';
import { C, P, LANE_NAMES, OUTLINE_N, isDark, laneKey, onTheme } from '../game/palette';
import {
  DOCK_TEX_R, DOT_R, DROP_R, GLOW_SIZE, PAD_R, REED_H, RING_R, ROCK_ORIGIN, ROCK_R, SHIMMER_LEN, SHOCK_R,
  buildBackground, buildThemedTextures, hash, inPond,
} from '../game/art';
import { sounds } from '../game/audio';
import { computePond, hudHeight, readInsets, uiScale, worldScale } from '../game/layout';
import { ui } from '../ui';

type Mode = 'title' | 'play' | 'paused' | 'over';
type Img = Phaser.GameObjects.Image;
type Squash = { x: number; y: number };

interface BoatView { shadow: Img; glow: Img; body: Img; born: number; sq: Squash; pushed: boolean; sparkT: number }
interface PickupView { img: Img; born: number }
interface DockView { shadow: Img; fill: Img; glow: Img; ring: Img; born: number; pulse: number }
interface RockView { img: Img; born: number }
interface PadView { pad: Img; flower: Img | null }
interface Shimmer { img: Img; x: number; y: number; i: number }
interface Reed { img: Img; i: number; base: number }

/**
 * Points for 1, 2 and 3 stars. Bot playtests (30 runs each, portrait): a simple bot averages ~9
 * (mostly 1 star), a skilled bot that grabs power-ups ~29 (2 stars, 3 about half the time).
 */
export const STAR_THRESHOLDS = [5, 15, 30];
const GOLD = 0xffd23f;
const ICE = 0x9be7ff;

const D = {
  bg: 0, shimmer: 1, pad: 2, flower: 2.1, dockShadow: 2.5, dockFill: 2.6, dockGlow: 2.7, dockRing: 3,
  ripples: 4, wake: 4.5, splash: 5, rock: 6, pickup: 6.2, boatShadow: 6.5, boatGlow: 7, boat: 7.1, arcs: 7.5,
  burst: 8, shock: 8.1, mote: 9, hint: 10, reed: 11,
};

export class Game extends Phaser.Scene {
  sim!: Sim;
  mode: Mode = 'title';
  /** Dev hook only: hold the simulation still while still rendering (for screenshots). */
  frozen = false;
  private best = 0;
  private clock = 0;
  private demoT = 1;
  private movedToastShown = false;
  /** Set for one frame after a theme rebuild so recreated views don't replay their fade-in. */
  private skipFadeIn = false;

  private bg!: Img;
  private rippleG!: Phaser.GameObjects.Graphics;
  private arcG!: Phaser.GameObjects.Graphics;
  private hintG!: Phaser.GameObjects.Graphics;
  /** Rounded-rect stencil so ripple rings stay on the water. */
  private pondMask?: Phaser.GameObjects.Graphics;
  private splash!: Phaser.GameObjects.Particles.ParticleEmitter;
  private wake!: Phaser.GameObjects.Particles.ParticleEmitter;
  private confetti!: Phaser.GameObjects.Particles.ParticleEmitter;
  private stars!: Phaser.GameObjects.Particles.ParticleEmitter;
  private confettiColors = [0xffffff];

  private boatViews = new Map<Boat, BoatView>();
  private dockViews = new Map<Dock, DockView>();
  private rockViews = new Map<Rock, RockView>();
  private padViews = new Map<Pad, PadView>();
  private moteViews = new Map<Mote, Img>();
  private pickupViews = new Map<Pickup, PickupView>();
  /** World zoom (see layout.worldScale): world units x ws = CSS px. */
  private ws = 1;
  private frosty = false;
  private shimmers: Shimmer[] = [];
  private reeds: Reed[] = [];

  constructor() { super('game'); }

  private fitWorldCamera() {
    this.ws = worldScale(view.w, view.h);
    const cam = this.cameras.main;
    fitCamera(cam);
    cam.setZoom(view.dpr * this.ws);
  }

  /** Outlined pop-up text at a world position (the DOM overlay works in CSS px). */
  private popAt(x: number, y: number, text: string, color: string, big = false) {
    ui.pop(x * this.ws, y * this.ws, text, color, big);
  }

  create() {
    this.fitWorldCamera();
    this.cameras.main.setBackgroundColor(P.shore);
    this.best = store.get('best', 0) || 0;
    ui.setBest(this.best);

    this.sim = new Sim();
    this.sim.setPond(this.measurePond());
    this.sim.prepare();

    this.rippleG = this.add.graphics().setDepth(D.ripples);
    this.arcG = this.add.graphics().setDepth(D.arcs);
    this.hintG = this.add.graphics().setDepth(D.hint);
    this.createEmitters();
    this.buildScenery();

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      sfx.unlock();
      if (this.mode === 'play') this.sim.tap(p.worldX, p.worldY);
    });

    this.game.events.on('view-resize', this.onResize, this);
    const offTheme = onTheme(() => this.onTheme());
    const onVis = () => {
      if (document.hidden) { this.pause(); sfx.suspend(); }
      else sfx.resume();
    };
    document.addEventListener('visibilitychange', onVis);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('view-resize', this.onResize, this);
      document.removeEventListener('visibilitychange', onVis);
      offTheme();
    });

    ui.init({
      play: () => this.startRun(),
      resume: () => this.resume(),
      restart: () => this.startRun(),
      menu: () => this.toTitle(),
      pause: () => this.pause(),
    });
    this.toTitle(true);
  }

  /* ---------- flow */

  private toTitle(keepWorld = false) {
    if (!keepWorld) { this.clearWorldViews(); this.sim.prepare(); }
    this.mode = 'title';
    music.play(RIPPLE_SONG, MUSIC.title);
    music.setIntensity(MUSIC.title);
    this.setFrost(false);
    ui.setBest(this.best);
    ui.clearToast();
    ui.show('title');
  }

  startRun() {
    const fresh = this.mode === 'title' && this.sim.phase === 'idle';
    if (!fresh) this.clearWorldViews();
    this.killParticles();
    this.sim.start(fresh);
    this.mode = 'play';
    music.play(RIPPLE_SONG, MUSIC.forRun(0));
    music.setIntensity(MUSIC.forRun(0));
    this.movedToastShown = false;
    ui.setScore(0);
    ui.resetHint();
    ui.setLives(this.sim.lives);
    ui.setBest(this.best);
    ui.clearToast();
    ui.show(null);
  }

  pause() {
    if (this.mode !== 'play') return;
    this.mode = 'paused';
    ui.show('pause');
  }

  resume() {
    if (this.mode !== 'paused') return;
    this.mode = 'play';
    ui.show(null);
  }

  private gameOver(score: number) {
    this.mode = 'over';
    const isNew = score > this.best && score > 0;
    if (isNew) { this.best = score; store.set('best', score); }
    ui.hint(false);
    ui.clearToast();
    this.setFrost(false);
    music.setIntensity(MUSIC.over);
    buzz([30, 60, 50]);
    sounds.over();
    ui.showOver({
      score, best: this.best, isNew,
      stars: STAR_THRESHOLDS.filter(t => score >= t).length,
      wave: this.sim.wave, bestCombo: this.sim.bestCombo,
    });
  }

  /* ---------- layout */

  private measurePond(): Rect {
    const k = this.ws, i = readInsets(view.w, view.h);
    const ins = { t: i.t / k, r: i.r / k, b: i.b / k, l: i.l / k };
    return computePond(view.w / k, view.h / k, ins, hudHeight(view.w, view.h) * uiScale() / k);
  }

  private onResize() {
    this.fitWorldCamera();
    this.pause();
    this.sim.setPond(this.measurePond());
    this.killParticles();
    this.buildScenery();
  }

  private onTheme() {
    this.cameras.main.setBackgroundColor(P.shore);
    // themed textures are about to be replaced: drop every image that uses them first
    this.clearWorldViews();
    this.destroyScenery();
    buildThemedTextures(this);
    this.buildScenery();
    this.splash.setParticleTint(C.ripple.n);
    this.wake.setParticleTint(C.ripple.n);
    this.skipFadeIn = true;
  }

  private killParticles() {
    this.splash.killAll(); this.wake.killAll(); this.confetti.killAll(); this.stars.killAll();
  }

  /** Background, shimmer lines and reeds: everything that depends only on the pond rect. */
  private buildScenery() {
    this.destroyScenery();
    const pond = this.sim.pond;
    const res = buildBackground(this, view.w / this.ws, view.h / this.ws, view.dpr * this.ws, pond);
    this.bg = this.add.image(0, 0, 'bg').setOrigin(0, 0).setScale(1 / res).setDepth(D.bg);
    if (!this.pondMask) {
      this.pondMask = this.make.graphics({}, false);
      this.rippleG.setMask(this.pondMask.createGeometryMask());
    }
    this.pondMask.clear().fillStyle(0xffffff, 1).fillRoundedRect(pond.x, pond.y, pond.w, pond.h, pond.r);

    // shimmer streaks: deterministic positions inside the rounded pond
    for (let i = 0; i < 40; i++) {
      const len = 6 + hash(i + 11) * 18;
      const x = pond.x + hash(i + 3) * pond.w, y = pond.y + hash(i + 7) * pond.h;
      if (!inPond(pond, x - 4, y, 8) || !inPond(pond, x + len + 4, y, 8)) continue;
      const img = this.add.image(x, y, 'shimmer').setOrigin(0, 0.5).setDepth(D.shimmer)
        .setTint(C.shimmer.n).setScale(TEX_SCALE * len / SHIMMER_LEN, TEX_SCALE);
      this.shimmers.push({ img, x, y, i });
    }

    // reed tufts and cattails around the bank, pointing outward
    const per = 2 * (pond.w + pond.h), n = Math.floor(per / 24);
    for (let i = 0; i < n; i++) {
      if (hash(i * 3.1) < 0.45) continue;
      let s = i / n * per, x: number, y: number, nx: number, ny: number;
      if (s < pond.w) { x = pond.x + s; y = pond.y; nx = 0; ny = -1; }
      else if ((s -= pond.w) < pond.h) { x = pond.x + pond.w; y = pond.y + s; nx = 1; ny = 0; }
      else if ((s -= pond.h) < pond.w) { x = pond.x + pond.w - s; y = pond.y + pond.h; nx = 0; ny = 1; }
      else { s -= pond.w; x = pond.x; y = pond.y + pond.h - s; nx = -1; ny = 0; }
      const cr = pond.r * 0.7;
      if (x < pond.x + cr && (y < pond.y + cr || y > pond.y + pond.h - cr)) continue;
      if (x > pond.x + pond.w - cr && (y < pond.y + cr || y > pond.y + pond.h - cr)) continue;
      const len = 0.65 + hash(i) * 0.45;
      const base = Math.atan2(ny, nx) + Math.PI / 2;
      const img = this.add.image(x + nx * 2, y + ny * 2, hash(i + 77) < 0.3 ? 'cattail' : 'reed')
        .setOrigin(0.5, (REED_H - 2) / REED_H).setRotation(base).setScale(TEX_SCALE, TEX_SCALE * len).setDepth(D.reed);
      this.reeds.push({ img, i, base });
    }
  }

  private destroyScenery() {
    this.bg?.destroy();
    this.shimmers.forEach(s => s.img.destroy());
    this.reeds.forEach(r => r.img.destroy());
    this.shimmers = [];
    this.reeds = [];
  }

  private destroyBoat(v: BoatView) { this.tweens.killTweensOf(v); this.tweens.killTweensOf(v.sq); v.shadow.destroy(); v.glow.destroy(); v.body.destroy(); }
  private destroyDock(v: DockView) { this.tweens.killTweensOf(v); v.shadow.destroy(); v.fill.destroy(); v.glow.destroy(); v.ring.destroy(); }

  private clearWorldViews() {
    for (const v of this.boatViews.values()) this.destroyBoat(v);
    for (const v of this.dockViews.values()) this.destroyDock(v);
    for (const v of this.rockViews.values()) { this.tweens.killTweensOf(v); v.img.destroy(); }
    for (const v of this.padViews.values()) { v.pad.destroy(); v.flower?.destroy(); }
    for (const v of this.moteViews.values()) v.destroy();
    for (const v of this.pickupViews.values()) { this.tweens.killTweensOf(v); v.img.destroy(); }
    this.pickupViews.clear();
    this.boatViews.clear(); this.dockViews.clear(); this.rockViews.clear(); this.padViews.clear(); this.moteViews.clear();
  }

  private createEmitters() {
    const drop = TEX_SCALE / DROP_R;
    this.splash = this.add.particles(0, 0, 'drop', {
      emitting: false, lifespan: 420, speed: { min: 25, max: 75 },
      scale: { start: drop * 2.4, end: drop * 0.8 }, alpha: { start: 1, end: 0 }, tint: C.ripple.n,
    }).setDepth(D.splash);
    this.wake = this.add.particles(0, 0, 'ring', {
      emitting: false, lifespan: 1100, speed: 0,
      scale: { start: TEX_SCALE * 3 / RING_R, end: TEX_SCALE * 18.4 / RING_R },
      alpha: { start: 0.45, end: 0 }, tint: C.ripple.n,
    }).setDepth(D.wake);
    this.confetti = this.add.particles(0, 0, 'confetti', {
      emitting: false, lifespan: { min: 650, max: 1000 }, speed: { min: 70, max: 170 },
      scale: { min: TEX_SCALE * 0.9, max: TEX_SCALE * 1.25 }, rotate: { start: 0, end: 540 },
      alpha: { start: 1, end: 0, ease: 'Quad.In' },
      tint: { onEmit: () => this.confettiColors[Math.floor(Math.random() * this.confettiColors.length)] },
    }).setDepth(D.burst);
    this.stars = this.add.particles(0, 0, 'star', {
      emitting: false, lifespan: 700, speed: { min: 40, max: 95 },
      scale: { start: TEX_SCALE * 1.3, end: TEX_SCALE * 0.4 }, rotate: { start: 0, end: 180 },
      alpha: { start: 1, end: 0, ease: 'Quad.In' }, tint: 0xffd23f,
    }).setDepth(D.burst);
  }

  /** A one-shot outlined ring that bursts out from a point. */
  private shockwave(x: number, y: number, tint: number, size = 2.6) {
    const img = this.add.image(x, y, 'shock').setTint(tint).setDepth(D.shock).setScale(TEX_SCALE * 0.6);
    this.tweens.add({
      targets: img, scale: TEX_SCALE * size * DOCK_TEX_R / SHOCK_R, alpha: 0, duration: 520, ease: 'Cubic.Out',
      onComplete: () => img.destroy(),
    });
  }

  private squash(v: BoatView | undefined, x: number, y: number) {
    if (!v) return;
    this.tweens.killTweensOf(v.sq);
    v.sq.x = x; v.sq.y = y;
    this.tweens.add({ targets: v.sq, x: 1, y: 1, duration: 520, ease: 'Elastic.Out', easeParams: [1.1, 0.45] });
  }

  private setFrost(on: boolean) {
    if (on === this.frosty) return;
    this.frosty = on;
    ui.frost(on);
  }

  /* ---------- frame */

  update(_time: number, delta: number) {
    this.tick(Math.min(0.033, Math.max(0, delta / 1000)));
  }

  /** One frame of game logic + view sync. Public so the dev hook can drive frames manually. */
  tick(dt: number) {
    if (this.frozen) { this.draw(); return; }
    this.clock += dt;
    this.sim.ambient(dt);
    if (this.mode !== 'paused') {
      if (this.mode === 'title') this.demoRipples(dt);
      this.sim.update(dt);
      this.handleEvents();
    }
    this.draw();
  }

  /** Title backdrop: every so often a ripple nudges one of the demo boats. */
  private demoRipples(dt: number) {
    if ((this.demoT -= dt) > 0) return;
    this.demoT = 1.3 + Math.random();
    const boats = this.sim.boats.filter(b => b.state === 'in');
    if (!boats.length) return;
    const b = boats[Math.floor(Math.random() * boats.length)];
    const p = this.sim.pond, cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    // tap on the side away from the pond centre, so boats get pushed back into open water
    const dx = b.x - cx, dy = b.y - cy, dl = Math.hypot(dx, dy) || 1;
    this.sim.splash(b.x + dx / dl * 40, b.y + dy / dl * 40);
  }

  private handleEvents() {
    const sim = this.sim;
    for (const ev of sim.events) {
      switch (ev.type) {
        case 'drop':
          sounds.drop();
          this.splash.explode(7, ev.x, ev.y);
          break;
        case 'dock': {
          sounds.dock(ev.note);
          if (ev.boat.gold) sounds.gold();
          buzz(ev.boat.gold ? [10, 30, 10] : 8);
          const c = C[laneKey(ev.dock.ci)].n;
          this.confettiColors = [c, c, 0xffffff, 0xffd23f];
          this.confetti.explode(18, ev.dock.x, ev.dock.y);
          this.stars.explode(sim.combo >= 2 ? 7 : 4, ev.dock.x, ev.dock.y);
          this.shockwave(ev.dock.x, ev.dock.y, c);
          this.squash(this.boatViews.get(ev.boat), 1.4, 0.7);
          const v = this.dockViews.get(ev.dock);
          if (v) {
            this.tweens.killTweensOf(v);
            v.born = Math.max(1, v.born); v.pulse = 1;
            this.tweens.add({ targets: v, pulse: 0, duration: 800, ease: 'Elastic.Out', easeParams: [1.2, 0.35] });
          }
          if (ev.boat.gold) {
            this.stars.explode(10, ev.dock.x, ev.dock.y);
            this.popAt(ev.dock.x, ev.dock.y - 18, `+${GOLD_POINTS}`, '#ffd23f', true);
          } else this.popAt(ev.dock.x, ev.dock.y - 18, '+1', P[laneKey(ev.dock.ci)]);
          if (sim.combo >= 2) this.popAt(ev.dock.x, ev.dock.y - 52, `Combo x${sim.combo + 1}!`, '#ffd23f', true);
          break;
        }
        case 'nope': sounds.nope(); break;
        case 'bump': sounds.bump(); break;
        case 'lost':
          sounds.lost();
          buzz(sim.lives <= 0 ? 70 : 40);
          this.cameras.main.shake(280, 0.007);
          ui.flash();
          this.splash.explode(14, ev.boat.x, ev.boat.y);
          this.shockwave(ev.boat.x, ev.boat.y, 0xff5a7a, 1.6);
          this.popAt(ev.boat.x, ev.boat.y - 20, 'Sunk!', '#ff5a7a');
          break;
        case 'unlock':
          sounds.unlock();
          buzz([8, 50, 8]);
          ui.toast('New colour!', `${LANE_NAMES[ev.ci]} boats`, P[laneKey(ev.ci)]);
          break;
        case 'dockMove':
          if (!this.movedToastShown) { this.movedToastShown = true; ui.toast('Watch out!', 'Busy docks drift'); }
          break;
        case 'wake': this.wake.explode(1, ev.x, ev.y); break;
        case 'wave':
          sounds.wave();
          buzz([10, 40, 10]);
          ui.toast('Get ready!', `Wave ${ev.wave}!`, '#ffd23f');
          break;
        case 'pickupSpawn': sounds.pickupSpawn(); break;
        case 'pickup': {
          const pk = ev.pickup, freeze = pk.kind === 'freeze';
          if (freeze) sounds.freeze(); else sounds.life();
          buzz(12);
          this.stars.explode(8, pk.x, pk.y);
          this.shockwave(pk.x, pk.y, freeze ? ICE : 0xff4f7b, 2);
          this.popAt(pk.x, pk.y - 20, freeze ? 'Freeze!' : '+1 Life!', freeze ? '#9be7ff' : '#ff8fab', true);
          break;
        }
        case 'over': this.gameOver(ev.score); break;
        case 'hud':
          ui.setScore(sim.score);
          ui.setLives(sim.lives);
          if (sim.phase === 'play') music.setIntensity(MUSIC.forRun(sim.docked));
          break;
      }
    }
    sim.events.length = 0;
  }

  private draw() {
    const t = this.clock, sim = this.sim, dark = isDark();
    const glowBlend = dark ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL;
    const shadowA = dark ? 0.5 : 0.28;

    // shimmer + reeds
    for (const s of this.shimmers) {
      s.img.x = s.x + Math.sin(t * 0.6 + s.i) * 4;
      s.img.alpha = C.shimmer.a * (0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * 1.2 + s.i * 1.7)));
    }
    for (const r of this.reeds) r.img.rotation = r.base + Math.sin(t * 1.5 + r.i) * 0.12;

    // lily pads (static per run, gentle bob)
    if (this.padViews.size !== sim.pads.length) {
      for (const v of this.padViews.values()) { v.pad.destroy(); v.flower?.destroy(); }
      this.padViews.clear();
    }
    for (const p of sim.pads) {
      let v = this.padViews.get(p);
      if (!v) {
        v = {
          pad: this.add.image(0, 0, 'pad').setDepth(D.pad),
          flower: p.flower ? this.add.image(0, 0, 'flower').setDepth(D.flower) : null,
        };
        this.padViews.set(p, v);
      }
      const bob = 1 + Math.sin(t * 1.3 + p.a * 3) * 0.025;
      v.pad.setPosition(p.x, p.y).setRotation(p.a + Math.sin(t * 0.5 + p.a) * 0.05).setScale(TEX_SCALE * p.r / PAD_R * bob);
      v.flower?.setPosition(p.x, p.y).setScale(TEX_SCALE * bob);
    }

    // docks: soft shadow, glow, inner target, rotating life ring
    this.sweep(sim.docks, this.dockViews, v => this.destroyDock(v));
    for (const d of sim.docks) {
      let v = this.dockViews.get(d);
      const c = C[laneKey(d.ci)].n;
      if (!v) {
        v = {
          shadow: this.add.image(d.x, d.y, 'docksh').setTint(OUTLINE_N).setDepth(D.dockShadow),
          fill: this.add.image(d.x, d.y, 'target').setTint(c).setDepth(D.dockFill),
          glow: this.add.image(d.x, d.y, 'glow').setTint(c).setDepth(D.dockGlow).setBlendMode(glowBlend),
          ring: this.add.image(d.x, d.y, 'dock' + d.ci).setDepth(D.dockRing),
          born: d.isNew ? 0 : 1, pulse: 0,
        };
        if (d.isNew) {
          d.isNew = false;
          this.tweens.add({ targets: v, born: 1, duration: 700, ease: 'Back.Out', easeParams: [2.2] });
        }
        this.dockViews.set(d, v);
      }
      let a = Math.min(1, Math.max(0, v.born));
      if (d.moving) a *= d.fade < 1 ? 1 - d.fade : d.fade - 1;
      const pop = Math.max(0, v.born) * (1 + v.pulse * 0.22);
      const k = d.r / 32; // art is drawn for the default dock radius
      v.shadow.setPosition(d.x + 2, d.y + 4).setScale(TEX_SCALE * k * pop).setAlpha(a * shadowA);
      v.fill.setPosition(d.x, d.y).setRotation(-t * 0.6).setScale(TEX_SCALE * k * pop * (1 + 0.06 * Math.sin(t * 3))).setAlpha(a * 0.9);
      v.glow.setPosition(d.x, d.y).setScale(TEX_SCALE * (d.r * 1.8 * 2) / GLOW_SIZE * pop)
        .setAlpha(a * Math.max(0, 0.22 + 0.12 * Math.sin(t * 2) + Math.max(0, v.pulse) * 0.45));
      v.ring.setPosition(d.x, d.y).setRotation(t * 0.4).setScale(TEX_SCALE * k * pop).setAlpha(a);
    }

    // ripples: thick white ring with a navy outline, plus two fading inner rings
    const rg = this.rippleG, rc = C.ripple, oa = dark ? 0.6 : 0.5;
    rg.clear();
    for (const r of sim.ripples) {
      const rad = Math.max(1, r.age * RIP_SPEED), fade = 1 - r.age / RIP_LIFE;
      rg.lineStyle(7.5, OUTLINE_N, oa * fade).strokeCircle(r.x, r.y, rad);
      rg.lineStyle(3.8, rc.n, rc.a * fade).strokeCircle(r.x, r.y, rad);
      if (rad > 14) rg.lineStyle(2, rc.n, rc.a * fade * 0.45).strokeCircle(r.x, r.y, rad - 13);
      if (rad > 30) rg.lineStyle(1.6, rc.n, rc.a * fade * 0.22).strokeCircle(r.x, r.y, rad - 27);
    }

    // rocks
    this.sweep(sim.rocks, this.rockViews, v => { this.tweens.killTweensOf(v); v.img.destroy(); });
    for (const k of sim.rocks) {
      let v = this.rockViews.get(k);
      if (!v) {
        v = { img: this.add.image(k.x, k.y, 'rock' + k.variant).setOrigin(ROCK_ORIGIN).setDepth(D.rock), born: k.isNew ? 0 : 1 };
        if (k.isNew) { k.isNew = false; this.tweens.add({ targets: v, born: 1, duration: 650, ease: 'Back.Out', easeParams: [2.4] }); }
        this.rockViews.set(k, v);
      }
      v.img.setPosition(k.x, k.y).setScale(TEX_SCALE * k.r / ROCK_R * Math.max(0, v.born));
    }

    // boats + timer arcs
    this.sweep(sim.boats, this.boatViews, v => this.destroyBoat(v));
    const ag = this.arcG;
    ag.clear();
    const showArcs = sim.phase !== 'idle';
    for (const b of sim.boats) {
      let v = this.boatViews.get(b);
      const col = b.gold ? { n: GOLD, a: 1 } : C[laneKey(b.ci)];
      if (!v) {
        v = {
          shadow: this.add.image(b.x, b.y, 'boatsh').setTint(OUTLINE_N).setDepth(D.boatShadow),
          glow: this.add.image(b.x, b.y, 'glow').setTint(col.n).setDepth(D.boatGlow).setBlendMode(glowBlend),
          body: this.add.image(b.x, b.y, b.gold ? 'boatG' : 'boat' + b.ci).setDepth(D.boat),
          born: this.skipFadeIn ? 1 : 0, sq: { x: 1, y: 1 }, pushed: false, sparkT: 0,
        };
        if (!this.skipFadeIn) this.tweens.add({ targets: v, born: 1, duration: 500, ease: 'Back.Out' });
        this.boatViews.set(b, v);
      }
      // squash when a ripple front first hits the boat
      if (b.state === 'in') {
        if (!v.pushed && b.push > 150) { v.pushed = true; this.squash(v, 0.74, 1.24); }
        else if (v.pushed && b.push < 40) v.pushed = false;
      }
      let alpha = 1, sc = 1;
      if (b.state === 'dock') { sc = 1 - b.k * 0.45; alpha = 1 - Math.max(0, b.k - 0.5) * 2; }
      if (b.state === 'sink') { sc = 1 - b.k * 0.5; alpha = 1 - b.k; }
      const born = Math.max(0, v.born);
      alpha = Math.max(0, alpha) * Math.min(1, born);
      sc *= born;
      const rot = b.ang + Math.sin(t * 2.2 + b.x * 0.01) * 0.06 + (b.state === 'sink' ? b.k * 2.5 : 0);
      v.body.setPosition(b.x, b.y).setRotation(rot).setScale(TEX_SCALE * sc * v.sq.x, TEX_SCALE * sc * v.sq.y).setAlpha(alpha);
      v.shadow.setPosition(b.x + 2.5, b.y + 4).setRotation(rot).setScale(TEX_SCALE * sc * v.sq.x, TEX_SCALE * sc * v.sq.y).setAlpha(alpha * shadowA);
      v.glow.setPosition(b.x, b.y).setScale(TEX_SCALE * (b.gold ? 78 : 60) / GLOW_SIZE * sc).setAlpha(alpha * (b.gold ? 0.55 + 0.15 * Math.sin(t * 6) : dark ? 0.5 : 0.3));
      if (b.gold && b.state === 'in' && this.mode === 'play' && (v.sparkT -= 1 / 60) <= 0) {
        v.sparkT = 0.35;
        this.stars.emitParticleAt(b.x + (Math.random() - 0.5) * 20, b.y + (Math.random() - 0.5) * 14, 1);
      }
      if (b.state === 'in' && showArcs) {
        const left = Math.max(0, 1 - b.age / b.life);
        const frozen = sim.freezeT > 0;
        const warn = left < 0.25 && !frozen;
        const a0 = -Math.PI / 2, a1 = a0 + Math.PI * 2 * left;
        const blink = warn ? 0.55 + 0.45 * Math.sin(t * 12) : 1;
        ag.lineStyle(7, OUTLINE_N, 0.85 * alpha);
        ag.beginPath(); ag.arc(b.x, b.y, 23, a0, a1); ag.strokePath();
        ag.lineStyle(3.6, frozen ? ICE : warn ? 0xff5a7a : col.n, blink * alpha);
        ag.beginPath(); ag.arc(b.x, b.y, 23, a0, a1); ag.strokePath();
      }
    }

    // power-up bubbles: bob, pulse, and blink in their last two seconds
    this.sweep(sim.pickups, this.pickupViews, v => { this.tweens.killTweensOf(v); v.img.destroy(); });
    for (const pk of sim.pickups) {
      let v = this.pickupViews.get(pk);
      if (!v) {
        v = { img: this.add.image(pk.x, pk.y, pk.kind === 'freeze' ? 'pu_freeze' : 'pu_life').setDepth(D.pickup), born: 0 };
        this.tweens.add({ targets: v, born: 1, duration: 600, ease: 'Back.Out', easeParams: [2.5] });
        this.pickupViews.set(pk, v);
      }
      const left = pk.life - pk.age;
      const blink = left < 2 ? (Math.sin(t * 18) > 0 ? 1 : 0.35) : 1;
      v.img.setPosition(pk.x, pk.y + Math.sin(t * 2.4 + pk.id) * 2)
        .setScale(TEX_SCALE * (PICKUP_R + 1) / 16 * Math.max(0, v.born) * (1 + 0.07 * Math.sin(t * 5)))
        .setRotation(Math.sin(t * 1.6 + pk.id) * 0.15).setAlpha(blink);
    }
    this.setFrost(this.mode === 'play' && sim.freezeT > 0);

    // fireflies by night, sparkles by day
    if (this.moteViews.size !== sim.motes.length) { for (const m of this.moteViews.values()) m.destroy(); this.moteViews.clear(); }
    for (const m of sim.motes) {
      let img = this.moteViews.get(m);
      if (!img) {
        img = this.add.image(m.x, m.y, 'dot').setTint(C.mote.n).setScale(TEX_SCALE * 1.7 / DOT_R).setDepth(D.mote).setBlendMode(glowBlend);
        this.moteViews.set(m, img);
      }
      img.setPosition(m.x, m.y).setAlpha(C.mote.a * (0.3 + 0.5 * (0.5 + 0.5 * Math.sin(m.ph * 2))));
    }

    // onboarding: a ghost finger tapping behind the most urgent boat, every run until the first tap
    const hg = this.hintG;
    hg.clear();
    const target = this.mode === 'play' ? sim.hintTarget() : null;
    if (target) {
      const { boat: b, dock: d } = target;
      ui.hint(true, b.y > sim.pond.y + sim.pond.h * 0.5);
      const dx = d.x - b.x, dy = d.y - b.y, dl = Math.hypot(dx, dy) || 1;
      const p = sim.pond;
      const hx = Phaser.Math.Clamp(b.x - dx / dl * 48, p.x + 12, p.x + p.w - 12);
      const hy = Phaser.Math.Clamp(b.y - dy / dl * 48, p.y + 12, p.y + p.h - 12);
      const ph = (t % 1.4) / 1.4;
      // small dotted guide from the boat toward its dock, then a ghost fingertip tapping behind it
      for (let k = 26; k < Math.min(dl - 30, 90); k += 16) {
        const gx = b.x + dx / dl * k, gy = b.y + dy / dl * k;
        hg.fillStyle(OUTLINE_N, 0.6).fillCircle(gx, gy, 2.8);
        hg.fillStyle(0xffffff, 0.9).fillCircle(gx, gy, 1.6);
      }
      hg.lineStyle(4.5, OUTLINE_N, (1 - ph) * 0.4).strokeCircle(hx, hy, 7 + ph * 20);
      hg.lineStyle(2.2, 0xffffff, (1 - ph) * 0.85).strokeCircle(hx, hy, 7 + ph * 20);
      const press = 1 - 0.18 * Math.sin(Math.min(1, ph * 3) * Math.PI);
      hg.fillStyle(0xffffff, 0.85).fillCircle(hx, hy, 7 * press);
      hg.lineStyle(2, OUTLINE_N, 0.9).strokeCircle(hx, hy, 7 * press);
    } else ui.hint(false);
    this.skipFadeIn = false;
  }

  /** Destroy views whose sim objects are gone. */
  private sweep<T, V>(list: T[], map: Map<T, V>, destroy: (v: V) => void) {
    if (map.size === 0) return;
    let stale = map.size > list.length;
    if (!stale) for (const k of map.keys()) if (!list.includes(k)) { stale = true; break; }
    if (!stale) return;
    const live = new Set(list);
    for (const [k, v] of map) if (!live.has(k)) { destroy(v); map.delete(k); }
  }
}
