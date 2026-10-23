import Phaser from 'phaser';
import { fitCamera, view } from '../core/view';
import { sfx } from '../core/sfx';
import { music } from '../core/music';
import { buzz } from '../core/haptics';
import { store } from '../core/settings';
import { mixNum, TEX_SCALE } from '../core/tex';
import { BIOMES, biomeIndex, palette, type Palette } from '../game/biomes';
import { cave } from '../game/cave';
import { Ambient } from '../game/ambient';
import { DEEP_SONG } from '../game/song';
import { rankLocked, SKINS, skinIndex, suits } from '../game/skins';
import { bubbleAir, lifelineChance, magnetTime, shieldTime, upgrades } from '../game/upgrades';
import { AIR_SAVER, CHARM_WINDOW, gadgets, HEAD_START, LUCKY_CLAM, PEARL_PULL_RANGE, type GadgetId } from '../game/gadgets';
import { deepMissions } from '../game/missions';
import { coins, metaChanged, soClose } from '../core/meta';
import { cloud } from '../core/cloud';
import { embed } from '../core/embed';
import { ui } from '../ui';
import { LIGHT_SPAN } from './BootScene';

type Sprite = Phaser.GameObjects.Sprite;
type Image = Phaser.GameObjects.Image;
type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;
type Point = { x: number; y: number };
type Kind = 'jelly' | 'mine' | 'angler' | 'eel';
type Perk = 'shield' | 'magnet' | 'lifeline';
type State = 'title' | 'play' | 'paused' | 'over';

interface Obstacle {
  kind: Kind; x: number; y: number; y0: number; r: number; ph: number; amp: number; vx: number; floor: number; dy: number;
  sprite: Sprite; glow: Image; dead?: boolean;
  /** angler: seconds left in its lunge wind-up / dash; eel: charge cycle offset */
  lunge?: number; dash?: number;
  /** counted for missions once it is behind the diver */
  passed?: boolean;
  /** closest clearance while it could hurt you (negative = it touched you) */
  gap?: number;
}
/** Anything you swim into to collect: air bubbles, pearls and power-ups. */
interface Pickup { type: 'air' | 'pearl' | Perk; x: number; y: number; ph: number; sprite: Image; glow: Image }

const TAU = Math.PI * 2;
const clamp = Phaser.Math.Clamp;
const lerp = Phaser.Math.Linear;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(a: T[]) => a[(Math.random() * a.length) | 0];
void pick;
const hash = (n: number) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };

const DIVER_R = 13;
const HEARTS = 3;
const HIT_INVULN = 1.6;        // seconds of blinking after losing a heart
const WALL_BONK_GAP = 0.35;    // plain walls only nudge you back (sound/shake at most this often)
const WALL_BOUNCE = 70;        // how hard a plain wall pushes you back
/** Sharp stretches of wall (coral spikes) appear below SPIKE_FROM metres and cost a life. */
const SPIKE_SEG = 520, SPIKE_H = 19, SPIKE_FROM = 160;
const STEER = 1300;            // steering acceleration
const MAGNET_RANGE = 170;
const CLOSE_CALL = 22;         // clearance (px) that still counts as a close call
const COMBO_WINDOW = 4;        // seconds to chain the next close call
const COMBO_MAX = 5;           // a chained close call pays up to this many coins
const LIFELINE_FROM = 120;     // metres before the rare lifeline pickup can appear
const SLOWMO_TIME = 0.6, SLOWMO_RATE = 0.3; // the lifeline's slow-motion save
const BASE_H = 440;            // logical trench height the world is designed for; phones (~375–430 px) see a little more, big screens a little less
const OUTLINE = 0x16233b;
const CORAL = [0xff7aa8, 0xff9f43, 0xb07cff, 0xffd23f];
const MOTES = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), z: rand(0.25, 1) }));
/** Portrait turns the dive 90° (see style.css): you sink down the screen and steer left/right. */
const portraitView = () => matchMedia('(orientation: portrait)').matches;
const REASONS: Record<Kind, string> = { jelly: 'Stung by a jellyfish', mine: 'Bumped a sea mine', angler: 'Swallowed by an anglerfish', eel: 'Zapped by an electric eel' };
/** Electric eels charge on a fixed beat: dangerous for EEL_ON of every EEL_CYCLE seconds. */
const EEL_CYCLE = 2.4, EEL_ON = 1.0, EEL_HALF = 40;
const PICKUP_TEX: Record<Pickup['type'], string> = { air: 'air', pearl: 'pearl', shield: 'pk-shield', magnet: 'pk-magnet', lifeline: 'pk-life' };
const PICKUP_GLOW: Record<Pickup['type'], number> = { air: 0x96e6ff, pearl: 0xffe7a8, shield: 0x5fb4ff, magnet: 0xff8fa8, lifeline: 0xffd23f };

export class GameScene extends Phaser.Scene {
  private state: State = 'title';
  private clock = 0;
  private dist = 0;
  private speed = 200;
  private oxy = 100;
  private hearts = HEARTS;
  private invuln = 0;
  private wallT = 0;
  private touches = new Map<number, { x: number; y: number }>(); // pointerId -> screen position, for steering
  private shieldT = 0;
  private magnetT = 0;
  /** Held until a hit (or empty tank) would end the dive, then saves you once. */
  private lifeline = false;
  /** Power-up strengths for this dive, from the shop upgrades. */
  private shieldTime = shieldTime(0);
  private magnetTime = magnetTime(0);
  private bubbleAir = bubbleAir(0);
  private lifelineChance = lifelineChance(0);
  /** Gadgets equipped for this dive. */
  private gear = new Set<GadgetId>();
  private coralGuard = false;
  private slowT = 0;
  private combo = 0;
  private comboT = 0;
  /** Best depth when this dive started: the marker you're chasing. */
  private runBest = 0;
  private bestWarned = false;
  private bestPassed = false;
  private runPearls = 0;
  private runClose = 0;
  private runBonus = 0; // coins from close calls
  private runAir = 0;
  private runPerks = 0;
  private runAnglers = 0;
  private runEels = 0;
  private cleanDepth = -1; // depth when the first life was lost (-1 = none lost yet)
  /** Course randomness (what spawns where); kept separate from visual randomness. */
  private rng: () => number = Math.random;
  private diverY = 0;
  private vy = 0;
  private runT = 0;
  private obs: Obstacle[] = [];
  private items: Pickup[] = [];
  private nextObs = 0;
  private nextAir = 0;
  private nextPearls = 0;
  private nextPerk = 0;
  private biome = 0;
  private beepT = 0;
  private exhaustT = 0;
  private heldFor = 0;
  private learned = store.get('learned', false);
  private best = store.get('best', 0);
  private bestZone = store.get('bestZone', 0);
  private skin = suits.equipped;
  private k = 1; // world zoom on top of the device pixel ratio
  private lastH = 0;
  private pal: Palette = { top: 0, bot: 0, rock: 0, dark: 0, vent: 0 };
  private cv: [number, number] = [0, 0];
  private topEdge: Point[] = [];
  private botEdge: Point[] = [];
  private topRim: Point[] = [];
  private spikeRuns: Point[][] = [];
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
  private shieldRing!: Image;
  private lifeRing!: Image;
  private exhaust!: Emitter;
  private pops!: Emitter;
  private sparks!: Emitter;
  private ambient = new Ambient();
  private keys!: Record<'space' | 'up' | 'down' | 'w' | 's' | 'left' | 'right' | 'a' | 'd', Phaser.Input.Keyboard.Key>;

  constructor() { super('game'); }

  /** Logical size of the visible world (after the big-screen zoom). */
  private get W() { return view.w / this.k; }
  private get H() { return view.h / this.k; }

  create() {
    this.applyCamera();
    this.lastH = this.H;
    this.game.events.on('view-resize', this.onResize, this);

    this.bg = this.add.graphics().setScrollFactor(0).setDepth(0);
    this.rays = this.add.graphics().setScrollFactor(0).setDepth(1).setBlendMode(Phaser.BlendModes.ADD);
    this.far = this.add.graphics().setScrollFactor(0).setDepth(1.5);
    this.snow = this.add.graphics().setScrollFactor(0).setDepth(2);
    this.rock = this.add.graphics().setDepth(3);
    this.vent = this.add.graphics().setScrollFactor(0).setDepth(4);
    this.diver = this.add.sprite(0, 0, `diver-${this.skin}`, 0).setOrigin(42 / 82, 0.5).setScale(TEX_SCALE).setDepth(6);
    this.shieldRing = this.add.image(0, 0, 'shield-ring').setScale(TEX_SCALE).setDepth(6.5).setVisible(false);
    this.lifeRing = this.add.image(0, 0, 'life-ring').setScale(TEX_SCALE).setDepth(6.4).setVisible(false);
    this.lightMask = this.add.image(0, 0, 'lightmask').setScrollFactor(0).setDepth(8);
    this.cone = this.add.image(0, 0, 'cone').setScrollFactor(0).setDepth(9).setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD);
    this.edges = this.add.graphics().setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
    this.setSkin(this.skin);

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
    this.keys = kb.addKeys({ space: 'SPACE', up: 'UP', down: 'DOWN', w: 'W', s: 'S', left: 'LEFT', right: 'RIGHT', a: 'A', d: 'D' }) as GameScene['keys'];
    kb.addCapture('SPACE,UP,DOWN,LEFT,RIGHT');
    // Track touches in screen space: the canvas is rotated in portrait, so Phaser's own pointer
    // coordinates don't say which half of the screen was touched.
    const track = (e: PointerEvent) => {
      if (e.type === 'pointerup' || e.type === 'pointercancel') { this.touches.delete(e.pointerId); return; }
      if (e.type === 'pointerdown' && (e.target as Element | null)?.closest?.('button, a')) return;
      if (e.type === 'pointerdown' || this.touches.has(e.pointerId)) this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    };
    for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const) window.addEventListener(t, track);
    addEventListener('blur', () => this.touches.clear());
    kb.on('keydown-ESC', () => this.togglePause());
    kb.on('keydown-P', () => this.togglePause());
    // Space / Enter dive from the menus, but never while typing a name or reading the leaderboard.
    const keyStart = () => {
      if (ui.typing() || ui.isOpen('board')) return;
      if (this.state === 'title' || this.state === 'over') this.startRun();
    };
    kb.on('keydown-SPACE', keyStart);
    kb.on('keydown-ENTER', keyStart);
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
      skin: id => this.setSkin(id),
      typing: on => {
        // Let the name field receive Space and the arrow keys.
        const kb = this.input.keyboard!;
        kb.enabled = !on;
        if (on) kb.disableGlobalCapture(); else kb.enableGlobalCapture();
      },
    });
    // Pearls used to unlock suits directly; they're coins now. Convert any saved pearls once.
    const legacy = store.get('pearls', 0);
    if (legacy > 0) { coins.add(legacy); store.set('pearls', 0); }
    music.play(DEEP_SONG, 0.3);
    cloud.onRestore(() => this.restored());
    this.toTitle();
  }

  /** A newer cloud save replaced this device's progress: reload what the scene keeps in memory. */
  private restored() {
    this.best = store.get('best', 0);
    this.bestZone = store.get('bestZone', 0);
    this.learned = store.get('learned', false);
    this.skin = suits.equipped;
    this.diver.setTexture(`diver-${this.skin}`, 0).play(`kick-${this.skin}`);
    metaChanged();
    if (this.state === 'title') { this.runBest = this.best; ui.showTitle(this.best, this.skin); }
  }

  private applyCamera() {
    // Bigger screens see the same trench, just larger, instead of a tiny diver in a huge cave.
    this.k = clamp(view.h / BASE_H, 0.8, 1.2); // phones ~0.85–0.9 (a wide view), desktop at most 1.2
    fitCamera(this.cameras.main);
    this.cameras.main.setZoom(view.dpr * this.k);
  }

  /** Course random number in [a, b). */
  private cr(a: number, b: number) { return a + this.rng() * (b - a); }
  private cpick<T>(a: T[]) { return a[(this.rng() * a.length) | 0]; }

  /** Wear a diver, buying it first if needed. False when it costs too much or needs a higher rank. */
  private setSkin(id: string) {
    const s = SKINS[skinIndex(id)];
    if (rankLocked(s, deepMissions.rank)) return false;
    const r = suits.buy(s.id);
    if (r === 'poor') return false;
    this.skin = suits.equipped;
    this.diver.setTexture(`diver-${this.skin}`, 0).play(`kick-${this.skin}`);
    return true;
  }

  // ---------- Flow

  private toTitle() {
    this.clearWorld();
    this.ambient.stop();
    sfx.resume();
    music.setIntensity(0.3);
    this.state = 'title';
    this.dist = 0;
    this.runBest = this.best;
    this.diverY = this.caveMid(0);
    // The title shows a big portrait of the diver instead.
    this.diver.setVisible(false).setAlpha(1).setRotation(0);
    this.shieldRing.setVisible(false);
    ui.showTitle(this.best, this.skin);
  }

  private startRun() {
    sfx.unlock();
    sfx.resume();
    this.clearWorld();
    this.dist = 0;
    this.speed = 200;
    this.oxy = 100;
    this.hearts = HEARTS;
    this.invuln = 0;
    this.shieldT = 0;
    this.magnetT = 0;
    this.shieldTime = shieldTime(upgrades.level('shield'));
    this.magnetTime = magnetTime(upgrades.level('magnet'));
    this.bubbleAir = bubbleAir(upgrades.level('bubbles'));
    this.lifelineChance = lifelineChance(upgrades.level('lifeline'));
    this.gear = new Set(gadgets.equipped(deepMissions.rank));
    this.coralGuard = this.gear.has('coralguard');
    if (this.gear.has('headstart')) this.shieldT = HEAD_START;
    this.lifeline = false;
    this.slowT = 0;
    this.combo = 0;
    this.comboT = 0;
    this.runBest = this.best;
    this.bestWarned = false;
    this.bestPassed = false;
    this.runPearls = 0;
    this.runClose = 0;
    this.runBonus = 0;
    this.runAir = 0;
    this.runPerks = 0;
    this.runAnglers = 0;
    this.runEels = 0;
    this.cleanDepth = -1;
    this.diverY = this.caveMid(0);
    this.vy = 0;
    this.runT = 0;
    this.biome = 0;
    this.nextObs = 520;
    this.nextAir = 320;
    this.nextPearls = 700;
    this.nextPerk = this.cr(1600, 2400);
    this.beepT = 0;
    this.diver.setVisible(true).setAlpha(1).setRotation(0);
    this.state = 'play';
    ui.screen(null);
    ui.hud(true);
    ui.setBest(this.best);
    ui.setDepth(0);
    ui.setHearts(this.hearts);
    ui.setPearls(0);
    ui.setPerk(null, 0);
    ui.setLifeline(false);
    ui.setRank(null);
    ui.banner(BIOMES[0].name);
    ui.hint(!this.learned);
    this.ambient.start();
    music.play(DEEP_SONG, 0.45);
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
    this.applyCamera();
    // Keep everything at the same relative height so the trench still lines up.
    if (this.lastH && this.lastH !== this.H) {
      const f = this.H / this.lastH;
      this.diverY *= f;
      for (const o of this.obs) { o.y *= f; o.y0 *= f; o.floor *= f; }
      for (const p of this.items) p.y *= f;
    }
    this.lastH = this.H;
    this.pause();
  }

  private clearWorld() {
    for (const o of this.obs) { o.sprite.destroy(); o.glow.destroy(); }
    for (const p of this.items) { p.sprite.destroy(); p.glow.destroy(); }
    this.obs = [];
    this.items = [];
    this.exhaust.killAll();
    this.pops.killAll();
    this.sparks.killAll();
  }

  // ---------- Simulation

  update(_time: number, deltaMs: number) {
    const raw = Math.min(0.033, deltaMs / 1000);
    // The lifeline save plays out in slow motion for a moment.
    if (this.state === 'play') this.slowT = Math.max(0, this.slowT - raw);
    const dt = this.slowT > 0 ? raw * SLOWMO_RATE : raw;
    this.clock += dt;

    if (this.state === 'play') this.step(dt);
    else if (this.state !== 'paused') this.idle(dt);
    this.draw();
  }

  /**
   * Steering: +1 swims up, -1 down, 0 drifts. Touch the side of the screen you want to move toward:
   * the top/bottom half in landscape, the right/left half in portrait (the world is turned 90° there,
   * so screen right is the world's "up"). Keys: →, ↑, D, W, Space up; ←, ↓, A, S down.
   */
  private steering() {
    const k = this.keys;
    let dir = (k.right.isDown || k.d.isDown || k.up.isDown || k.w.isDown || k.space.isDown ? 1 : 0)
      - (k.left.isDown || k.a.isDown || k.down.isDown || k.s.isDown ? 1 : 0);
    const portrait = portraitView();
    for (const t of this.touches.values()) {
      dir += (portrait ? t.x > innerWidth / 2 : t.y < innerHeight / 2) ? 1 : -1;
    }
    return Math.sign(dir);
  }

  private step(dt: number) {
    this.runT += dt;
    // No gravity: the diver drifts to a stop when you let go.
    const steer = this.steering();
    const hold = steer !== 0;
    this.vy = clamp(this.vy * Math.exp(-2.6 * dt) - steer * STEER * dt, -340, 340);
    this.diverY += this.vy * dt;
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
    this.chaseBest(depth);
    this.ambient.setDepth(depth);
    music.setIntensity(0.45 + Math.min(0.55, depth / 450));

    // Timers
    this.invuln = Math.max(0, this.invuln - dt);
    this.wallT = Math.max(0, this.wallT - dt);
    if (this.shieldT > 0) { this.shieldT = Math.max(0, this.shieldT - dt); if (!this.shieldT) this.perkEnded(); }
    if (this.magnetT > 0) { this.magnetT = Math.max(0, this.magnetT - dt); if (!this.magnetT) this.perkEnded(); }
    if (this.comboT > 0) { this.comboT = Math.max(0, this.comboT - dt); if (!this.comboT) this.combo = 0; }
    ui.setPerk(this.shieldT ? 'shield' : this.magnetT ? 'magnet' : null, this.shieldT ? this.shieldT / this.shieldTime : this.magnetT / this.magnetTime);

    // Oxygen drains a little faster the deeper you are.
    this.oxy -= (6.5 + depth * 0.003) * (this.gear.has('airsaver') ? AIR_SAVER : 1) * dt;
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

    this.spawning(depth, dt);

    const leftEdge = this.dist - this.diverX() - 140;
    const dark = palette(depth, this.pal).dark;
    for (const o of this.obs) {
      this.animate(o, dt);
      if (o.dead) continue;
      const ahead = o.x - this.dist;
      if (o.kind === 'jelly' && dark > 0.3 && ahead > 0 && ahead < 240) {
        // Jellies drift towards your headlamp in the dark.
        o.y0 += clamp(this.diverY - o.y0, -1, 1) * 26 * dark * dt;
      } else if (o.kind === 'angler') {
        o.x += o.vx * dt;
        o.y += clamp(this.diverY - o.y, -1, 1) * 22 * dt;
        // Wind up when close (its lure flares), then lunge.
        if (o.lunge === undefined && ahead > 0 && ahead < 190 && Math.abs(this.diverY - o.y) < 90) {
          o.lunge = 0.45;
          this.tweens.add({ targets: o.sprite, scaleX: TEX_SCALE * 1.15, scaleY: TEX_SCALE * 0.9, duration: 120, yoyo: true, repeat: 1 });
        }
        if (o.lunge !== undefined && o.lunge > 0) { o.lunge -= dt; if (o.lunge <= 0) { o.dash = 0.55; sfx.tone(200, 0.2, { type: 'square', vol: 0.04, slideTo: 120 }); } }
        if (o.dash && o.dash > 0) { o.dash -= dt; o.x -= 300 * dt; o.y += clamp(this.diverY - o.y, -1, 1) * 70 * dt; }
      }
      const gap = this.clearance(o);
      if (gap !== null) o.gap = Math.min(o.gap ?? Infinity, gap);
      if (gap !== null && gap < 0) {
        this.hitCreature(o);
        if (this.state !== 'play') return;
      }
      if (!o.passed && o.x < this.dist - 40) {
        o.passed = true;
        if (o.gap !== undefined && o.gap >= 0 && o.gap < CLOSE_CALL) this.closeCall();
        if (o.kind === 'angler') this.runAnglers++;
        if (o.kind === 'eel') this.runEels++;
      }
    }
    this.obs = this.obs.filter(o => {
      if (o.x > leftEdge && !o.dead) return true;
      o.sprite.destroy(); o.glow.destroy();
      return false;
    });

    this.collect(dt, leftEdge);

    // Plain walls just nudge you back; sharp stretches cost a life.
    const [top, bot] = cave(this.dist, this.H, this.cv);
    const spikeTop = this.spiky(this.dist, 0), spikeBot = this.spiky(this.dist, 1);
    const topEdge = top + (spikeTop ? SPIKE_H * 0.6 : 0), botEdge = bot - (spikeBot ? SPIKE_H * 0.6 : 0);
    if (this.diverY - DIVER_R < topEdge) this.hitWall(topEdge + DIVER_R, 1, spikeTop);
    else if (this.diverY + DIVER_R > botEdge) this.hitWall(botEdge - DIVER_R, -1, spikeBot);
    if (this.state !== 'play') return;
    if (this.oxy <= 0) {
      if (this.lifeline) this.rescue();
      else { this.oxy = 0; this.die('Ran out of air'); }
    }
  }

  /** Warn when your best depth is near, and celebrate passing it mid-dive. */
  private chaseBest(depth: number) {
    if (this.runBest <= 0) return;
    if (this.bestPassed) { ui.setBest(Math.floor(depth)); return; }
    if (!this.bestWarned && this.runBest >= 100 && depth >= this.runBest - 50) {
      this.bestWarned = true;
      ui.damage('50 m to your best!', true);
    }
    if (depth < this.runBest) return;
    this.bestPassed = true;
    ui.banner('New record!', 'Past your best');
    this.cameras.main.flash(260, 255, 214, 90);
    this.sparks.explode(24, this.dist + 20, this.diverY);
    sfx.tone(523, 0.2, { vol: 0.08 }); sfx.tone(659, 0.2, { vol: 0.08, delay: 0.09 }); sfx.tone(1046, 0.45, { vol: 0.08, delay: 0.18 });
    buzz([15, 30, 25]);
  }

  /** Slipping past a creature with very little room: pays coins, more for each one chained. */
  private closeCall() {
    const charm = this.gear.has('charm');
    this.combo = this.comboT > 0 ? Math.min(COMBO_MAX, this.combo + 1) : 1;
    this.comboT = charm ? CHARM_WINDOW : COMBO_WINDOW;
    this.runClose++;
    const pay = this.combo + (charm ? 1 : 0);
    this.runBonus += pay;
    ui.damage(this.combo > 1 ? `Close call ×${this.combo}! +${pay}` : `Close call! +${pay}`, true);
    sfx.tone(660 + this.combo * 110, 0.1, { type: 'triangle', vol: 0.07, slideTo: 990 + this.combo * 110 });
    buzz(10);
    this.sparks.explode(3 + this.combo * 2, this.dist + 6, this.diverY);
  }

  private spawning(depth: number, dt: number) {
    const step = this.speed * dt;
    if ((this.nextObs -= step) <= 0) {
      this.spawnObstacle(depth);
      this.nextObs = lerp(430, 200, clamp(depth / 1200, 0, 1)) * this.cr(0.75, 1.25);
    }
    if ((this.nextAir -= step) <= 0) {
      this.spawnRow('air', 3, 34);
      this.nextAir = this.cr(420, 620) + depth * 0.08;
    }
    if ((this.nextPearls -= step) <= 0) {
      this.spawnRow('pearl', 5 + ((this.rng() * 4) | 0), 26);
      this.nextPearls = this.cr(520, 900);
    }
    if ((this.nextPerk -= step) <= 0) {
      // The lifeline is rare and never offered while you still hold one.
      const r = this.rng();
      const lc = this.lifelineChance;
      this.spawnRow(r < lc && !this.lifeline && depth > LIFELINE_FROM ? 'lifeline' : r < lc + (1 - lc) / 2 ? 'shield' : 'magnet', 1, 0);
      this.nextPerk = this.cr(2200, 3400);
    }
  }

  private hitWall(y: number, dir: 1 | -1, sharp: boolean) {
    this.diverY = y;
    if (sharp && this.coralGuard && this.invuln <= 0 && this.shieldT <= 0) {
      // Coral Guard takes the first sharp-coral hit of the dive.
      this.coralGuard = false;
      this.vy = dir * 220;
      this.invuln = 0.8;
      this.pops.explode(12, this.dist, y - dir * DIVER_R);
      sfx.tone(700, 0.2, { vol: 0.08, slideTo: 400 });
      buzz(15);
      ui.damage('Coral Guard!', true);
      return;
    }
    if (sharp) {
      this.vy = dir * 220;
      this.sparks.explode(8, this.dist, y - dir * DIVER_R);
      this.loseLife('Spiked on sharp coral');
      return;
    }
    this.vy = dir * WALL_BOUNCE;
    if (this.wallT > 0) return;
    this.wallT = WALL_BONK_GAP;
    this.cameras.main.shake(80, 0.002);
    sfx.tone(150, 0.08, { type: 'triangle', vol: 0.07, slideTo: 110 });
    this.pops.explode(3, this.dist, y - dir * DIVER_R);
    buzz(8);
  }

  /**
   * Is the wall at world x sharp? Spiky stretches are decided per SPIKE_SEG-long segment from a
   * hash of its index (stable, no extra state), get more common with depth, never cover both
   * walls of the same stretch, and leave a little plain wall at each end as a lead-in.
   */
  private spiky(wx: number, side: 0 | 1) {
    const seg = Math.floor(wx / SPIKE_SEG), d = (seg * SPIKE_SEG) / 10;
    if (d < SPIKE_FROM) return false;
    const chance = 0.14 + Math.min(0.26, (d - SPIKE_FROM) / 2500);
    const topSharp = hash(seg * 13.7 + 5.1) < chance;
    const sharp = side === 0 ? topSharp : !topSharp && hash(seg * 13.7 + 91.3) < chance;
    if (!sharp) return false;
    const f = (wx - seg * SPIKE_SEG) / SPIKE_SEG;
    return f > 0.1 && f < 0.9;
  }

  private eelCharged(o: Obstacle) { return ((this.clock + o.ph) % EEL_CYCLE) < EEL_ON; }

  /** Room between the diver and a creature's hit zone (negative = touching), or null while it's harmless. */
  private clearance(o: Obstacle) {
    if (o.kind !== 'eel') return Math.hypot(o.x - this.dist, o.y + o.dy - this.diverY) - (o.r + DIVER_R * 0.8);
    // Eels are only dangerous while charged, along their whole body.
    if (!this.eelCharged(o)) return null;
    const dx = clamp(this.dist, o.x - EEL_HALF, o.x + EEL_HALF) - this.dist;
    return Math.hypot(dx, o.y - this.diverY) - (8 + DIVER_R * 0.8);
  }

  private hitCreature(o: Obstacle) {
    if (this.invuln > 0) return;
    if (o.kind === 'mine') { // mines go off either way
      o.dead = true;
      this.sparks.explode(18, o.x, o.y);
      sfx.noise(0.35, 0.16, 300);
    }
    this.vy = Math.sign(this.diverY - o.y || 1) * 320;
    this.loseLife(REASONS[o.kind]);
  }

  /** Take a hit: the shield absorbs it, otherwise lose a life (and the dive on the last one). */
  private loseLife(reason: string) {
    if (this.invuln > 0) return;
    if (this.shieldT > 0) { this.useShield(); this.invuln = 0.8; return; }
    if (this.cleanDepth < 0) this.cleanDepth = Math.floor(this.dist / 10);
    this.combo = 0; this.comboT = 0;
    if (this.hearts <= 1 && this.lifeline) { this.rescue(); return; }
    this.hearts--;
    this.invuln = HIT_INVULN;
    ui.setHearts(this.hearts);
    if (this.hearts <= 0) { this.die(reason); return; }
    this.cameras.main.shake(260, 0.01);
    this.cameras.main.flash(160, 255, 90, 120);
    buzz([30, 30, 50]);
    sfx.tone(240, 0.3, { type: 'sawtooth', vol: 0.07, slideTo: 120 });
    ui.damage('Ouch!');
  }

  private useShield() {
    this.shieldT = 0;
    this.pops.explode(16, this.dist, this.diverY);
    sfx.tone(900, 0.25, { vol: 0.1, slideTo: 300 });
    buzz(15);
    ui.damage('Shield!', true);
    this.perkEnded();
  }

  /** The lifeline spends itself instead of ending the dive. */
  private rescue() {
    this.lifeline = false;
    ui.setLifeline(false);
    this.invuln = 2.2;
    this.oxy = Math.max(this.oxy, 45);
    this.slowT = SLOWMO_TIME;
    this.vy = clamp(this.caveMid(this.dist) - this.diverY, -1, 1) * 260;
    this.pops.explode(22, this.dist, this.diverY);
    this.sparks.explode(16, this.dist, this.diverY);
    this.cameras.main.flash(300, 255, 214, 90);
    sfx.tone(523, 0.2, { vol: 0.09 }); sfx.tone(784, 0.25, { vol: 0.08, delay: 0.1 }); sfx.tone(1046, 0.5, { vol: 0.08, delay: 0.2 });
    buzz([20, 40, 60]);
    ui.damage('Saved by your lifeline!', true);
  }

  private perkEnded() { if (!this.shieldT && !this.magnetT) ui.setPerk(null, 0); }

  private collect(dt: number, leftEdge: number) {
    this.items = this.items.filter(p => {
      p.ph += dt;
      // The magnet pulls pearls and air bubbles towards the diver.
      // The magnet (and the Pearl Pull gadget, for pearls only) draws pickups towards the diver.
      const range = this.magnetT > 0 && (p.type === 'pearl' || p.type === 'air') ? MAGNET_RANGE
        : p.type === 'pearl' && this.gear.has('pearlpull') ? PEARL_PULL_RANGE : 0;
      if (range) {
        const dx = this.dist - p.x, dy = this.diverY - p.y, d = Math.hypot(dx, dy);
        if (d < range && d > 1) { const pull = (1 - d / range) * 520 * dt + 60 * dt; p.x += (dx / d) * pull; p.y += (dy / d) * pull; }
      }
      if (Math.hypot(p.x - this.dist, p.y - this.diverY) < DIVER_R + (p.type === 'pearl' ? 10 : 14)) {
        this.take(p);
        p.sprite.destroy(); p.glow.destroy();
        return false;
      }
      if (p.x > leftEdge + 100) return true;
      p.sprite.destroy(); p.glow.destroy();
      return false;
    });
  }

  private take(p: Pickup) {
    if (p.type === 'air') {
      this.runAir++;
      this.oxy = Math.min(100, this.oxy + this.bubbleAir);
      sfx.tone(rand(620, 820), 0.12, { vol: 0.12, slideTo: 1200 });
      buzz(8);
      this.pops.explode(7, p.x, p.y);
      this.tweens.add({ targets: this.diver, scaleX: TEX_SCALE * 1.18, scaleY: TEX_SCALE * 0.86, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
    } else if (p.type === 'pearl') {
      const lucky = this.gear.has('luckyclam') && Math.random() < LUCKY_CLAM;
      this.runPearls += lucky ? 2 : 1;
      if (lucky) this.sparks.explode(6, p.x, p.y);
      ui.setPearls(this.runPearls);
      sfx.tone(1180 + (this.runPearls % 5) * 120, 0.08, { type: 'triangle', vol: 0.06 });
      this.sparks.explode(3, p.x, p.y);
    } else {
      this.runPerks++;
      if (p.type === 'shield') this.shieldT = this.shieldTime;
      else if (p.type === 'magnet') this.magnetT = this.magnetTime;
      else { this.lifeline = true; ui.setLifeline(true); }
      ui.damage(p.type === 'shield' ? 'Shield up!' : p.type === 'magnet' ? 'Magnet!' : 'Lifeline!', true);
      sfx.tone(523, 0.18, { vol: 0.09 }); sfx.tone(784, 0.3, { vol: 0.08, delay: 0.08 });
      buzz(18);
      this.sparks.explode(14, p.x, p.y);
    }
  }

  private idle(dt: number) {
    for (const o of this.obs) this.animate(o, dt);
    for (const p of this.items) p.ph += dt;
    if (this.state === 'title') {
      this.diverY = this.caveMid(0) + Math.sin(this.clock * 1.4) * 8;
      this.diver.anims.timeScale = 0.5;
      this.exhaustT -= dt;
      if (this.exhaustT <= 0 && this.diver.visible) { this.exhaustT = rand(0.4, 1.1); this.exhaust.emitParticleAt(this.dist - 4, this.diverY - 10, 1); }
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
    const wx = this.dist - this.diverX() + this.W + 80;
    const [t, b] = cave(wx, this.H, this.cv);
    const kinds: Kind[] = ['jelly'];
    if (depth > 50) kinds.push('mine');
    if (depth > 200) kinds.push('angler');
    if (depth > 320) kinds.push('eel');
    if (depth > 450) kinds.push('jelly', 'angler', 'mine', 'eel');
    const kind = this.cpick(kinds), y = this.cr(t + 45, b - 45);
    const base = { kind, y, y0: y, ph: this.cr(0, TAU), amp: 0, vx: 0, floor: b, dy: 0 };
    let o: Obstacle;
    if (kind === 'jelly') {
      o = { ...base, x: wx, r: 15, amp: this.cr(18, 46), sprite: this.add.sprite(wx, y, 'jelly', 0).setOrigin(0.5, 20 / 60), glow: this.glow(0xff78d2) };
      o.sprite.play({ key: 'jelly', startFrame: (Math.random() * 6) | 0 });
    } else if (kind === 'mine') {
      o = { ...base, x: wx, r: 14, sprite: this.add.sprite(wx, y, 'mine'), glow: this.glow(0xff3c3c) };
    } else if (kind === 'eel') {
      o = { ...base, x: wx + EEL_HALF, r: 10, ph: this.cr(0, EEL_CYCLE), sprite: this.add.sprite(wx + EEL_HALF, y, 'eel', 0), glow: this.glow(0x8ff6ff) };
      o.sprite.play({ key: 'eel', startFrame: (Math.random() * 4) | 0 });
    } else {
      o = { ...base, x: wx + 140, r: 17, vx: -this.cr(70, 140), sprite: this.add.sprite(wx + 140, y, 'angler', 0).setOrigin(56 / 108, 38 / 72), glow: this.glow(0xbeff8c) };
      o.sprite.play('angler');
    }
    o.sprite.setScale(TEX_SCALE).setDepth(5);
    this.obs.push(o);
  }

  /** A short arc of pickups somewhere inside the trench just off-screen. */
  private spawnRow(type: Pickup['type'], n: number, gap: number) {
    const wx = this.dist - this.diverX() + this.W + 60;
    const [t, b] = cave(wx, this.H, this.cv);
    const y = this.cr(t + 40, b - 40), arc = n > 3 ? this.cr(-30, 30) : 0;
    for (let i = 0; i < n; i++) {
      const x = wx + i * gap, f = n > 1 ? i / (n - 1) : 0;
      const py = clamp(y + Math.sin(f * Math.PI) * arc + (type === 'air' ? Math.sin(i * 1.7) * 14 : 0), t + 30, b - 30);
      this.items.push({
        type, x, y: py, ph: rand(0, TAU),
        sprite: this.add.image(x, py, PICKUP_TEX[type]).setScale(TEX_SCALE).setDepth(11),
        glow: this.glow(PICKUP_GLOW[type]).setDepth(10.5),
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
    music.setIntensity(0.25);
    this.diver.setRotation(0.9);
    this.shieldRing.setVisible(false);
    this.lifeRing.setVisible(false);
    ui.setLifeline(false);

    const depth = Math.floor(this.dist / 10);
    const prevBest = this.runBest;
    // Read the saved best, not the in-memory one: a cloud restore may have raised it mid-dive.
    this.best = Math.max(this.best, store.get('best', 0));
    const isBest = depth > this.best;
    if (isBest) { this.best = depth; store.set('best', depth); }
    void this.postScore(depth, isBest);
    embed.score(depth, this.best);
    if (this.biome > this.bestZone) { this.bestZone = this.biome; store.set('bestZone', this.biome); }

    // Rewards: coins for the dive (raised by the mission-rank bonus) plus any missions completed.
    const bonus = deepMissions.bonus;
    const runCoins = Math.round((this.runPearls + Math.floor(depth / 40)) * bonus); // ~25–45 for a good dive at x1
    const closeCoins = Math.round(this.runBonus * bonus);
    coins.add(runCoins + closeCoins);
    const coinsBefore = coins.balance;
    const { results, rankUp } = deepMissions.report({
      depth, pearls: this.runPearls, air: this.runAir, perks: this.runPerks, closeCalls: this.runClose,
      cleanDepth: this.cleanDepth < 0 ? depth : this.cleanDepth,
      anglers: this.runAnglers, eels: this.runEels,
    });
    const missionCoins = coins.balance - coinsBefore;

    ui.lowO2(false);
    ui.hint(false);
    this.time.delayedCall(800, () => {
      if (this.state !== 'over') return;
      ui.showOver({
        depth, reason, zone: BIOMES[this.biome].name, best: this.best, isBest, pearls: this.runPearls,
        close: soClose(depth, prevBest, ' m'), results, rankUp,
        earned: [{ label: `Dive ×${bonus.toFixed(1)}`, n: runCoins }, { label: 'Close calls', n: closeCoins }, { label: 'Missions', n: missionCoins }],
      });
    });
  }

  /** Send a new best to the leaderboard, then show where this dive ranks worldwide. */
  private async postScore(depth: number, isBest: boolean) {
    if (!cloud.enabled) return;
    if (isBest) await cloud.submitBest(depth);
    const rank = await cloud.rank(depth);
    if (rank && this.state === 'over') ui.setRank(rank, isBest);
  }

  // ---------- Rendering

  private diverX() { return Math.min(this.W * 0.28, 260); }
  private caveMid(wx: number) { const [t, b] = cave(wx, this.H, this.cv); return (t + b) / 2; }

  private draw() {
    const W = this.W, H = this.H, T = this.clock, depth = this.dist / 10;
    const pal = palette(depth, this.pal);
    const px = this.diverX();
    const x0 = this.dist - px;
    this.cameras.main.scrollX = x0;

    this.bg.clear();
    this.bg.fillGradientStyle(pal.top, pal.top, pal.bot, pal.bot, 1);
    this.bg.fillRect(0, 0, W, H);

    // Sun rays fade out as the light disappears.
    this.rays.clear();
    const ray = portraitView() ? 0 : clamp(1 - depth / 180, 0, 1); // rays would fall sideways in portrait
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

    // Sharp coral along dangerous stretches of wall.
    this.spikeRuns.length = 0;
    for (let seg = Math.floor((x0 - 40) / SPIKE_SEG); seg * SPIKE_SEG < x0 + W + 40; seg++) {
      for (const side of [0, 1] as const) {
        const a = seg * SPIKE_SEG + SPIKE_SEG * 0.1, b = seg * SPIKE_SEG + SPIKE_SEG * 0.9;
        if (!this.spiky(a + 1, side)) continue;
        const dir = side === 0 ? 1 : -1, run: Point[] = [];
        for (let wx = a; wx <= b; wx += 15) {
          const base = cave(wx, H, this.cv)[side] - dir * 2;
          const tri = [{ x: wx - 7.5, y: base }, { x: wx, y: base + dir * SPIKE_H }, { x: wx + 7.5, y: base }];
          g.fillStyle(0xff6b8a, 1); g.fillPoints(tri, true);
          g.lineStyle(2.4, OUTLINE, 1); g.strokePoints(tri, true);
          g.fillStyle(0xffd0da, 1); g.fillTriangle(wx - 2, base + dir * 3, wx, base + dir * (SPIKE_H - 4), wx + 1, base + dir * 3);
          run.push({ x: wx, y: base + dir * SPIKE_H * 0.5 });
        }
        this.spikeRuns.push(run);
      }
    }

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
    // A flag on the trench floor at your best depth (its glowing line across the trench is drawn below).
    const bestX = this.runBest * 10, bestOn = this.runBest > 0 && bestX > x0 - 40 && bestX < x0 + W + 40;
    if (bestOn) {
      const fx = bestX, col = 0xffc43d;
      const [ceil, floor] = cave(fx, H, this.cv);
      const la = this.bestPassed ? 0.35 : 1;
      for (let y = ceil + 6; y < floor - 6; y += 16) {
        const y2 = Math.min(y + 9, floor - 6);
        g.lineStyle(6, OUTLINE, la); g.lineBetween(fx, y, fx, y2);
        g.lineStyle(3, col, la); g.lineBetween(fx, y, fx, y2);
      }
      g.lineStyle(5, OUTLINE, 1); g.lineBetween(fx, floor + 2, fx, floor - 46);
      g.lineStyle(2.4, 0xeef4f9, 1); g.lineBetween(fx, floor + 2, fx, floor - 46);
      const wave = Math.sin(T * 4) * 3;
      const flag = [{ x: fx, y: floor - 46 }, { x: fx + 26, y: floor - 40 + wave }, { x: fx, y: floor - 32 }];
      g.fillStyle(col, 1); g.fillPoints(flag, true);
      g.lineStyle(2.5, OUTLINE, 1); g.strokePoints(flag, true);
    }

    // Mine chains to the floor.
    for (const o of this.obs) {
      if (o.kind !== 'mine' || o.dead) continue;
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
      } else if (o.kind === 'eel') {
        // Charged: bright, crackling, a little jittery. Resting: dull. A brief flicker warns before it charges.
        const phase = (T + o.ph) % EEL_CYCLE, on = phase < EEL_ON, warn = !on && phase > EEL_CYCLE - 0.35;
        o.sprite.setTint(on ? 0xd9ffff : warn && Math.sin(T * 50) > 0 ? 0xbfefff : 0x9aa6b4);
        o.sprite.setPosition(o.x + (on ? (Math.random() - 0.5) * 2 : 0), o.y + (on ? (Math.random() - 0.5) * 2 : 0));
        o.glow.setPosition(o.x, o.y).setDisplaySize(EEL_HALF * 3, 46).setAlpha(on ? 0.75 + Math.random() * 0.25 : warn ? 0.25 : 0);
      } else {
        o.glow.setPosition(o.x - o.r * 2.2, o.y - o.r * 1.5).setDisplaySize(56, 56).setAlpha(0.6 + Math.sin(T * 4 + o.ph) * 0.2);
      }
    }
    for (const p of this.items) {
      const y = p.y + Math.sin(p.ph * 3) * 3;
      const big = p.type !== 'air' && p.type !== 'pearl';
      p.sprite.setPosition(p.x, y).setRotation(big ? Math.sin(p.ph * 2) * 0.15 : 0);
      p.glow.setPosition(p.x, y).setDisplaySize(big ? 70 : 44, big ? 70 : 44).setAlpha(big ? 0.55 + Math.sin(p.ph * 5) * 0.2 : 0.35);
    }

    const tilt = this.state === 'over' ? 0.9 : clamp(this.vy / 700, -0.45, 0.45);
    this.diver.setPosition(this.dist, this.diverY).setRotation(this.state === 'play' || this.state === 'paused' ? tilt : this.diver.rotation);
    if (this.state === 'play') this.diver.setAlpha(this.invuln > 0 && Math.sin(this.clock * 40) > 0 ? 0.35 : 1);
    this.shieldRing.setVisible(this.shieldT > 0 && this.state !== 'over')
      .setPosition(this.dist, this.diverY)
      .setScale(TEX_SCALE * (1 + Math.sin(T * 6) * 0.04))
      .setAlpha(this.shieldT < 2 && Math.sin(T * 20) > 0 ? 0.4 : 1);
    this.lifeRing.setVisible(this.lifeline && this.state !== 'over')
      .setPosition(this.dist, this.diverY)
      .setScale(TEX_SCALE * (1.18 + Math.sin(T * 3) * 0.03))
      .setAlpha(0.8);

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
      // Sharp coral glows red in the dark so it can always be seen coming.
      this.edges.lineStyle(9, 0xff4d6d, (0.55 + Math.sin(T * 4) * 0.15) * Math.max(0.5, dark));
      for (const run of this.spikeRuns) if (run.length > 1) this.edges.strokePoints(run);
    }
    // Your best depth: a dashed gold line across the trench, bright enough to see in the dark.
    if (bestOn) {
      const [t, b] = cave(bestX, H, this.cv), a = this.bestPassed ? 0.25 : 0.6 + Math.sin(T * 5) * 0.2;
      this.edges.lineStyle(10, 0xffb020, a * 0.35);
      this.edges.lineBetween(bestX, t, bestX, b);
      this.edges.lineStyle(3, 0xffe27a, a);
      for (let y = t + 6; y < b - 6; y += 16) this.edges.lineBetween(bestX, y, bestX, Math.min(y + 9, b - 6));
    }
  }
}
