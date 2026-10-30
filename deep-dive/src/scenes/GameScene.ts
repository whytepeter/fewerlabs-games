import Phaser from 'phaser';
import { fitCamera, view } from '../core/view';
import { sfx } from '../core/sfx';
import { music } from '../core/music';
import { buzz } from '../core/haptics';
import { store } from '../core/settings';
import { mixNum, TEX_SCALE } from '../core/tex';
import { biomeIndex, palette, type Palette } from '../game/biomes';
import { cave } from '../game/cave';
import { Ambient, chime } from '../game/ambient';
import { rollTreasure, treasureLog, type Treasure } from '../game/treasures';
import { bestKey, CAVES, currentCave, isUnlocked, selectCave, type CaveDef, type CaveId, type Kind, type SpikeLook } from '../game/caves';
import { DIVER_PERK, getDiver, grantEarned, migrateDivers, rankLocked, SKINS, skinIndex, suits, type DiverPerk } from '../game/skins';
import { lifetime } from '../game/lifetime';
import { bubbleAir, lifelineChance, magnetTime, shieldTime, upgrades } from '../game/upgrades';
import { AIR_SAVER, CHARM_WINDOW, gadgets, HEAD_START_SHIELD, HEAD_START_TURBO, LUCKY_CLAM, PEARL_PULL_RANGE, type GadgetId } from '../game/gadgets';
import { deepMissions } from '../game/missions';
import { openChests } from '../game/chests';
import { saveCost, shells } from '../game/shells';
import { DOUBLE_TAP, PUFF_RANGE, SPECIAL_PEARLS, SPECIAL_START, specialOf, STEADY_RATE } from '../game/specials';
import { BOOSTER_UNTIL, BOOSTER_WINDOW, boosterById, boosters, MEGA_TURBO, type BoosterId } from '../game/boosters';
import { hunt } from '../game/hunt';
import { daily as dailyRun, dailyMissions } from '../game/daily';
import { mulberry32 } from '../core/rng';
import { dev } from '../core/dev';
import { coins, metaChanged, soClose } from '../core/meta';
import { cloud, topBest } from '../core/cloud';
import { DOUBLER, lagos } from '../core/lagos';
import { ads } from '../core/ads';
import { track } from '../core/analytics';
import { tuning, type Tuning } from '../game/tuning';
import { embed } from '../core/embed';
import { ui } from '../ui';
import { LIGHT_SPAN } from './BootScene';

type Sprite = Phaser.GameObjects.Sprite;
type Image = Phaser.GameObjects.Image;
type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;
type Point = { x: number; y: number };
type Perk = 'shield' | 'magnet' | 'lifeline' | 'turbo';
type State = 'title' | 'play' | 'paused' | 'saveme' | 'over';

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
/** A clump of kelp growing from the floor (side 1) or ceiling (side 0): slows you down, never hurts. */
interface Kelp { x: number; side: 0 | 1; len: number; w: number; ph: number; strands: number }
/**
 * An icicle on the ceiling. Most shake loose in time to land `lead` seconds before you reach it and
 * stick in the floor as a stub you swim over. A `late` one is timed by your speed to still be falling
 * as you pass and land `lead` seconds after you're clear: swim low and you slip under it.
 */
interface Icicle { x: number; len: number; w: number; lead: number; late: boolean; shake: number; drop: number; vy: number; falling: boolean; stuck?: boolean; gap?: number; passed?: boolean; gone?: boolean }
/** Anything you swim into to collect: air bubbles, pearls and power-ups. */
interface Pickup { type: 'air' | 'pearl' | 'chest' | 'shell' | Perk; x: number; y: number; ph: number; sprite: Image; glow: Image }

const TAU = Math.PI * 2;
const clamp = Phaser.Math.Clamp;
const lerp = Phaser.Math.Linear;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const hash = (n: number) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };

const DIVER_R = 13;
const HEARTS = 3;
const HIT_INVULN = 1.6;        // seconds of blinking after losing a heart
const WALL_BONK_GAP = 0.35;    // plain walls only nudge you back (sound/shake at most this often)
const WALL_BOUNCE = 70;        // how hard a plain wall pushes you back
/** Sharp stretches of wall (coral spikes) appear below SPIKE_FROM metres and cost a life. */
const SPIKE_SEG = 520, SPIKE_H = 19;
const STEER = 1300;            // steering acceleration
const MAGNET_RANGE = 170;
const CLOSE_CALL = 22;         // clearance (px) that still counts as a close call
const COMBO_WINDOW = 4;        // seconds to chain the next close call before the combo banks
const COMBO_MAX = 10;          // a chained close call pays up to this many coins (×10 chain = 55 in the pot)
const LIFELINE_FROM = 120;     // metres before the rare lifeline pickup can appear
const SLOWMO_TIME = 0.6, SLOWMO_RATE = 0.3; // the lifeline's slow-motion save
const TURBO_TIME = 4, TURBO_SPEED = 2.2, TURBO_FROM = 40; // Turbo: a few seconds of untouchable top speed, in every cave
const ICICLE_LATE = 0.45;     // share of icicles still falling as you pass under them
/**
 * Spacing (m) of power-ups and treasure, as [at least, then on average this much more, at most] (see
 * `gap`): sometimes two arrive close together, sometimes there's a long wait, so no dive feels like
 * the last. Treasure stays rare: a chest every ~1.3 km, a floating Sea Heart every ~3.5 km.
 */
type Gap = [number, number, number];
/** The course's random streams, one per spawner. */
const STREAMS = ['obs', 'air', 'pearl', 'perk', 'shell', 'chest', 'kelp', 'ice', 'wreck', 'current'] as const;
type Stream = (typeof STREAMS)[number];
const PERK_FIRST: Gap = [80, 40, 160], PERK_GAP: Gap = [150, 130, 520];
const CHEST_FIRST: Gap = [250, 500, 1300], CHEST_GAP: Gap = [450, 950, 2600];
const SHELL_FIRST: Gap = [1700, 700, 3000], SHELL_GAP: Gap = [2000, 1700, 6000];
const CALM = 70;               // metres of fewer creatures after each new zone (a breather before the next climb)
const KELP_SLOW = 0.55, KELP_HOLD = 0.35;   // tangled in kelp: forward speed, and how long it lingers after you're out
const ICICLE_SHAKE = 0.35, ICICLE_G = 1100, ICICLE_SINK = 0.3;  // seconds an icicle shakes before it drops, how fast it falls, and how much of it buries in the floor
const BASE_H = 440;            // logical trench height the world is designed for; phones (~375–430 px) see a little more, big screens a little less
const OUTLINE = 0x16233b;
const CORAL = [0xff7aa8, 0xff9f43, 0xb07cff, 0xffd23f];
const MOTES = Array.from({ length: 110 }, () => ({ x: Math.random(), y: Math.random(), z: rand(0.25, 1), glow: Math.random() < 0.3 }));
/** A rare sight in the far background (no gameplay): a whale in lit water, a glowing school in the dark. */
interface Sight { kind: 'whale' | 'school'; born: number; y: number; size: number }
const SIGHT_GAP: [number, number] = [35, 75]; // seconds between sights
/** Portrait turns the dive 90° (see style.css): you sink down the screen and steer left/right. */
const portraitView = () => matchMedia('(orientation: portrait)').matches;
const REASONS: Record<Kind, string> = {
  jelly: 'Stung by a jellyfish', mine: 'Bumped a sea mine', angler: 'Swallowed by an anglerfish', eel: 'Zapped by an electric eel',
  puffer: 'Pricked by a pufferfish', crab: 'Pinched by a crab', squid: 'Grabbed by an ice squid', octopus: 'Hugged by an octopus',
  shark: 'Chomped by a shark', swordfish: 'Skewered by a swordfish', snake: 'Bitten by a sea snake',
};
/** Pufferfish: hit radius deflated and fully puffed, and how near (px ahead) it starts to puff. */
const PUFF_R: [number, number] = [11, 21], PUFF_AT = 210;
/** Squid and octopus swim in bursts: seconds per burst cycle, how long the jet lasts, and its speed. */
const JET = { squid: { cycle: 1.5, on: 0.35, speed: 170 }, octopus: { cycle: 2.2, on: 0.5, speed: 110 } };
/** Swordfish: hangs still until you're this near, glints for SWORD_WARN seconds, then darts. */
const SWORD_AT = 360, SWORD_WARN = 0.5, SWORD_SPEED = 460;
/** Electric eels charge on a fixed beat: dangerous for EEL_ON of every EEL_CYCLE seconds. */
const EEL_CYCLE = 2.4, EEL_ON = 1.0, EEL_HALF = 40;
const PICKUP_TEX: Record<Pickup['type'], string> = { air: 'air', pearl: 'pearl', chest: 'chest', shell: 'shell', shield: 'pk-shield', magnet: 'pk-magnet', lifeline: 'pk-life', turbo: 'pk-turbo' };
const PICKUP_GLOW: Record<Pickup['type'], number> = { air: 0x96e6ff, pearl: 0xffc2e6, chest: 0xffd23f, shell: 0x5ff0ff, shield: 0x5fb4ff, magnet: 0xff8fa8, lifeline: 0xffd23f, turbo: 0xff9f43 };

export class GameScene extends Phaser.Scene {
  private state: State = 'title';
  private clock = 0;
  private dist = 0;
  private speed = 200;
  private oxy = 100;
  private hearts = HEARTS;
  private invuln = 0;
  private wallT = 0;
  private touches = new Map<number, { x: number; y: number; sx: number; sy: number; anchor: number; dragging: boolean }>();
  private shieldT = 0;
  private magnetT = 0;
  /** Held until the next hit (or an empty tank), which it takes for you instead. */
  private lifeline = false;
  private turboT = 0;
  private turboMax = TURBO_TIME;
  /** The Head Start gadget's opening Turbo: its shield follows when the burst runs out. */
  private kickoff = false;
  private calmUntil = 0;   // depth (m) until which creatures are spaced out after a new zone
  private perkCount = 0;   // power-ups offered this dive (the first is always a Turbo)
  private nextChest = 0;
  private nextShell = 0;
  private runChests = 0;   // treasure chests picked up this dive, opened on the game-over screen
  private saves = 0;       // times "Save me" was used this dive
  private adSaves = 0;     // rewarded-ad saves used this dive (tuning.adSaves allowed)
  /** This dive's balance numbers (remote tuning, fixed when the dive starts). */
  private tune: Tuning = tuning.dive(false);
  /** Power-up strengths for this dive, from the shop upgrades. */
  private shieldTime = shieldTime(0);
  private magnetTime = magnetTime(0);
  private bubbleAir = bubbleAir(0);
  private lifelineChance = lifelineChance(0);
  /** Gadgets equipped for this dive. */
  private gear = new Set<GadgetId>();
  private coralGuard = false;
  /** The worn diver's perk, and Puff's one free eel zap. */
  private perk?: DiverPerk;
  private eelGuard = false;
  private slowT = 0;
  private slowRate = SLOWMO_RATE;
  /** The worn diver's special move: its meter (0..1, filled by pearls) and how long it still runs. */
  private special = specialOf('classic');
  private charge = 0;
  private specialT = 0;
  private runSpecials = 0;
  private runTreasures = 0;
  private lastTap = 0;
  /** Boosters: the chips are up for the first few seconds; each kind can be fired once a dive. */
  private boosterOpen = false;
  private usedBoosters = new Set<BoosterId>();
  private doubler = false;
  private combo = 0;
  private comboT = 0;
  private comboWin = COMBO_WINDOW;
  /** Coins riding on the combo: banked when its window runs out, lost if a hit lands first. */
  private comboPot = 0;
  private sight: Sight | null = null;
  private nextSight = 0;
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
  /**
   * Course randomness (what spawns where), kept apart from visual randomness. `rng` is whichever
   * stream is rolling right now: each spawner has its own (`streams`), and the exact height of a
   * pickup comes from `place` (it dodges creatures that move with you). Seeded for a Daily Dive,
   * so the trench is the same for everyone whatever they do in it.
   */
  private rng: () => number = Math.random;
  private streams = Object.fromEntries(STREAMS.map(k => [k, Math.random])) as Record<Stream, () => number>;
  private place: () => number = Math.random;
  /** Diving today's Daily Dive (seeded; spawn timers then count distance, not time). */
  private daily = false;
  private moved = 0;
  /** How far past its timer this frame went when a creature or kelp spawns (Daily Dive only). */
  private lag = 0;
  private diverY = 0;
  private vy = 0;
  private runT = 0;
  private obs: Obstacle[] = [];
  private items: Pickup[] = [];
  private nextObs = 0;
  private nextAir = 0;
  private nextPearls = 0;
  private nextPerk = 0;
  private nextKelp = 0;
  private kelps: Kelp[] = [];
  private tangle = 0;            // seconds left of the kelp slow-down
  private tangles = 0;           // times caught this dive (the message only shows the first few)
  private nextIcicle = 0;
  private icicles: Icicle[] = [];
  private biome = 0;
  private beepT = 0;
  private exhaustT = 0;
  private learned = store.get('learned', false);
  private rookie = false;       // this dive is the player's first: gentler pacing for the whole run
  /** The cave being dived (picked on the title screen). */
  private def: CaveDef = currentCave();
  private best = store.get(bestKey(this.def.id), 0);
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
      if (e.type === 'pointerdown' && this.state === 'play') {
        if (e.timeStamp - this.lastTap < DOUBLE_TAP) { this.lastTap = 0; this.fireSpecial(); } else this.lastTap = e.timeStamp;
      }
      if (e.type === 'pointerdown') {
        const portrait = portraitView();
        const frac = portrait ? e.clientX / innerWidth : e.clientY / innerHeight;
        const diverFrac = this.diverY * this.k / view.h;
        this.touches.set(e.pointerId, {
          x: e.clientX, y: e.clientY,
          sx: e.clientX, sy: e.clientY,
          anchor: diverFrac - frac,
          dragging: false,
        });
      } else if (this.touches.has(e.pointerId)) {
        const t = this.touches.get(e.pointerId)!;
        t.x = e.clientX; t.y = e.clientY;
        if (!t.dragging) {
          const dx = t.x - t.sx, dy = t.y - t.sy;
          if (dx * dx + dy * dy > 100) t.dragging = true; // 10px threshold
        }
      }
    };
    for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const) window.addEventListener(t, track);
    addEventListener('blur', () => this.touches.clear());
    kb.on('keydown-ESC', () => this.togglePause());
    kb.on('keydown-P', () => this.togglePause());
    kb.on('keydown-E', () => this.fireSpecial());
    kb.on('keydown-SHIFT', () => this.fireSpecial());
    // Space / Enter dive from the menus, but never while typing a name or reading the leaderboard.
    const keyStart = () => {
      if (ui.typing() || ui.isOpen('board') || ui.askingAge()) return;
      if (this.state === 'title' || this.state === 'over') this.startRun(this.state === 'over' && this.daily);
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

    // Inside Lagos Life their page can pause the dive (a call, switching apps); the player picks it
    // back up from the pause menu, so their resume needs nothing here.
    lagos.init({
      pause: () => this.pause(),
      resume: () => {},
      give: p => {
        if (p.hearts) shells.add(p.hearts);
        if (p.coins) coins.add(p.coins);
        if (p.doubler) store.set(DOUBLER, true);
        ui.damage(`${p.name}: thank you!`, true);
        sfx.tone(880, 0.15, { vol: 0.08 }); sfx.tone(1318, 0.3, { vol: 0.08, delay: 0.1 });
      },
    });
    ui.init({
      play: () => this.startRun(),
      daily: () => this.startRun(true),
      again: () => this.startRun(this.daily),
      pause: () => this.pause(),
      resume: () => this.resume(),
      restart: () => this.startRun(this.daily),
      menu: () => this.toTitle(),
      skin: id => this.setSkin(id),
      cave: id => this.setCave(id),
      special: () => this.fireSpecial(),
      booster: id => this.useBooster(id),
      typing: on => {
        // Let the name field receive Space and the arrow keys.
        const kb = this.input.keyboard!;
        kb.enabled = !on;
        if (on) kb.disableGlobalCapture(); else kb.enableGlobalCapture();
      },
    });
    // Pearls used to unlock suits directly; they're coins now. Convert any saved pearls once.
    migrateDivers();
    const legacy = store.get('pearls', 0);
    if (legacy > 0) { coins.add(legacy); store.set('pearls', 0); }
    music.play(this.def.song, 0.3);
    cloud.onRestore(() => this.restored());
    this.toTitle();
  }

  /** A newer cloud save replaced this device's progress: reload what the scene keeps in memory. */
  private restored() {
    migrateDivers();
    this.def = currentCave();
    this.best = store.get(bestKey(this.def.id), 0);
    this.bestZone = store.get('bestZone', 0);
    this.learned = store.get('learned', false);
    this.skin = suits.equipped;
    this.diver.setTexture(`diver-${this.skin}`, 0).play(`kick-${this.skin}`);
    metaChanged();
    if (this.state === 'title') { this.runBest = this.best; ui.showTitle(this.skin); }
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
  /** Distance (px) to the next spawn of a `Gap`: a minimum plus a random wait that's usually short, now and then long, capped. */
  /** A spacing from `g`, every part scaled by `k` (the tuning's spacing for that spawner). */
  private gap([min, mean, max]: Gap, k = 1) { return Math.min(max * k, min * k - Math.log(1 - this.rng()) * mean * k) * 10; }
  /** Run `fn` with `this.rng` swapped for another stream. */
  private withRng<T>(r: () => number, fn: () => T) { const keep = this.rng; this.rng = r; try { return fn(); } finally { this.rng = keep; } }

  /** Wear a diver, buying it first if needed. False when it costs too much or needs a higher rank. */
  private setSkin(id: string) {
    const s = SKINS[skinIndex(id)];
    if (rankLocked(s, deepMissions.rank)) return false;
    if (getDiver(s) === 'poor') return false;
    this.skin = suits.equipped;
    this.diver.setTexture(`diver-${this.skin}`, 0).play(`kick-${this.skin}`);
    return true;
  }

  /** Pick the cave to dive in from the title screen. False while it's still locked. */
  private setCave(id: CaveId) {
    if (!selectCave(id)) return false;
    this.def = currentCave();
    this.best = store.get(bestKey(this.def.id), 0);
    this.runBest = this.best;
    this.diverY = this.caveMid(0);
    music.play(this.def.song, 0.3);
    return true;
  }

  // ---------- Flow

  private toTitle() {
    this.clearWorld();
    // Back from a Daily Dive: the title is about your own cave again.
    if (this.daily) { this.daily = false; this.def = currentCave(); this.best = store.get(bestKey(this.def.id), 0); }
    this.ambient.stop();
    sfx.resume();
    music.play(this.def.song, 0.3);
    this.state = 'title';
    this.dist = 0;
    this.runBest = this.best;
    this.diverY = this.caveMid(0);
    // The title shows a big portrait of the diver instead.
    this.diver.setVisible(false).setAlpha(1).setRotation(0);
    this.shieldRing.setVisible(false);
    ui.showTitle(this.skin);
  }

  /** Start a dive: in the selected cave, or today's Daily Dive (`daily`: seeded, in the day's cave). */
  private startRun(daily = false) {
    sfx.unlock();
    sfx.resume();
    this.clearWorld();
    this.daily = daily;
    this.tune = tuning.dive(daily);
    ads.setDailyLimit(this.tune.adsPerDay);
    for (const k of STREAMS) this.streams[k] = daily ? mulberry32(dailyRun.seed(k)) : Math.random;
    this.place = daily ? mulberry32(dailyRun.seed('place')) : Math.random;
    this.rng = Math.random;
    if (daily) {
      this.def = dailyRun.cave;
      this.best = dailyRun.best;
    } else {
      this.def = currentCave();
      this.best = store.get(bestKey(this.def.id), 0);
    }
    this.moved = 0;
    this.dist = 0;
    this.speed = 200;
    this.oxy = 100;
    this.rookie = !this.learned;
    this.hearts = this.rookie ? HEARTS + 2 : HEARTS; // first-timers get 5 lives
    this.invuln = 0;
    this.shieldT = 0;
    this.magnetT = 0;
    this.shieldTime = shieldTime(upgrades.level('shield'));
    this.magnetTime = magnetTime(upgrades.level('magnet'));
    this.bubbleAir = bubbleAir(upgrades.level('bubbles'));
    this.lifelineChance = lifelineChance(upgrades.level('lifeline'));
    this.gear = new Set(gadgets.equipped(deepMissions.rank));
    this.coralGuard = this.gear.has('coralguard');
    this.perk = SKINS[skinIndex(this.skin)].perk;
    this.eelGuard = this.perk === 'eelguard';
    this.lifeline = false;
    this.slowT = 0;
    this.slowRate = SLOWMO_RATE;
    this.special = specialOf(this.skin);
    this.charge = SPECIAL_START;
    this.specialT = 0;
    this.runSpecials = 0;
    this.runTreasures = 0;
    this.lastTap = 0;
    this.usedBoosters.clear();
    this.doubler = false;
    this.boosterOpen = boosters.held().length > 0;
    this.combo = 0;
    this.comboT = 0;
    this.comboPot = 0;
    ui.combo(null);
    this.runBest = this.best;
    this.bestWarned = false;
    this.bestPassed = false;
    this.runPearls = 0;
    this.runClose = 0;
    this.sight = null;
    this.nextSight = rand(12, 30);
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
    this.nextObs = this.rookie ? 700 : 520; // first-timers: later first obstacle, more breathing room
    this.nextAir = this.rookie ? 240 : 320; // first-timers: air bubbles come sooner
    this.nextPearls = 700;
    const s = this.streams;
    this.nextPerk = this.withRng(s.perk, () => this.gap(PERK_FIRST, this.tune.perkGap));
    this.perkCount = 0;
    this.calmUntil = 0;
    this.nextChest = this.withRng(s.chest, () => this.gap(CHEST_FIRST, this.tune.chestGap));
    this.nextShell = this.withRng(s.shell, () => this.gap(SHELL_FIRST, this.tune.heartGap));
    this.turboT = 0;
    this.turboMax = TURBO_TIME;
    this.kickoff = false;
    this.runChests = 0;
    this.saves = 0;
    this.adSaves = 0;
    this.nextKelp = this.def.kelp ? this.def.kelp.from * 10 + this.withRng(s.kelp, () => this.cr(200, 500)) : Infinity;
    this.tangle = 0;
    this.tangles = 0;
    this.nextIcicle = this.def.icicles ? this.def.icicles.from * 10 + this.withRng(s.ice, () => this.cr(200, 500)) : Infinity;
    this.beepT = 0;
    this.diver.setVisible(true).setAlpha(1).setRotation(0);
    this.state = 'play';
    ui.screen(null);
    ui.hud(true);
    ui.setBest(this.best);
    ui.setDepth(0);
    ui.setHearts(this.hearts, this.hearts);
    ui.setPearls(0);
    ui.setPerk(null, 0);
    ui.setLifeline(false);
    ui.setRank(null);
    ui.setSpecial(this.skin, this.special, this.charge, false);
    ui.setBoosters(this.boosterOpen ? boosters.held() : null);
    ui.banner(this.def.biomes[0].name);
    ui.guide(!this.learned);
    if (this.rookie && this.boosterOpen) ui.coach({ id: 'boosters', target: 'boosterBar', text: 'Tap a booster for a power-up' });
    // Head Start: blast through the shallows in a Turbo, then a short shield to land safely.
    if (this.gear.has('headstart')) {
      this.kickoff = true;
      this.turboT = this.turboMax = HEAD_START_TURBO;
      this.nextPerk += PERK_GAP[0] * this.tune.perkGap * 10; // you've had your Turbo; the next power-up comes later (no extra roll, see `streams`)
      this.perkCount = 1;
      this.cameras.main.flash(180, 255, 190, 110);
      this.time.delayedCall(300, () => { if (this.state === 'play') ui.damage('Head Start!', true); });
    }
    // A cave's own tip, on the first dive there.
    if (this.def.tip && this.learned && !store.get(`tip:${this.def.id}`, false)) {
      store.set(`tip:${this.def.id}`, true);
      this.time.delayedCall(1200, () => { if (this.state === 'play') ui.hint(this.def.tip!, 4500); });
    }
    this.ambient.start(this.def.ambience);
    this.resetWreck();
    music.play(this.def.song, 0.45);
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
    this.kelps = [];
    this.icicles = [];
    this.clearWreck();
    this.exhaust.killAll();
    this.pops.killAll();
    this.sparks.killAll();
  }

  // ---------- Simulation

  update(_time: number, deltaMs: number) {
    const raw = Math.min(0.033, deltaMs / 1000);
    // The lifeline save plays out in slow motion for a moment.
    if (this.state === 'play') this.slowT = Math.max(0, this.slowT - raw);
    const dt = this.slowT > 0 ? raw * this.slowRate : raw;
    this.clock += dt;

    if (this.state === 'play') this.step(dt);
    else if (this.state !== 'paused' && this.state !== 'saveme') this.idle(dt);
    this.draw();
  }

  /**
   * Steering: positive swims up, negative down, 0 drifts. Returns a value in [-1, 1].
   * Keys: ↑/W/Space up, ↓/S down (binary ±1). Side arrows follow the screen orientation.
   *
   * Touch steering is handled separately in step() via touchTargetY() — the diver's velocity
   * is set directly to chase the finger, bypassing the acceleration model for instant response.
   */
  private steering() {
    const k = this.keys, portrait = portraitView();
    const left = k.left.isDown || k.a.isDown, right = k.right.isDown || k.d.isDown;
    let dir = (k.up.isDown || k.w.isDown || k.space.isDown || (portrait ? left : right) ? 1 : 0)
      - (k.down.isDown || k.s.isDown || (portrait ? right : left) ? 1 : 0);
    // Tap/hold (not dragging): top half = up, bottom half = down.
    for (const t of this.touches.values()) {
      if (t.dragging) continue;
      const frac = portrait ? t.x / innerWidth : t.y / innerHeight;
      dir += frac < 0.5 ? 1 : -1;
    }
    return clamp(dir, -1, 1);
  }

  /** Anchor-based drag target, or null when the touch is a tap/hold (binary steering). */
  private touchTargetY(): number | null {
    if (this.touches.size !== 1) return null;
    const t = this.touches.values().next().value!;
    if (!t.dragging) return null;
    const portrait = portraitView();
    const frac = portrait ? t.x / innerWidth : t.y / innerHeight;
    return (frac + t.anchor) * view.h / this.k;
  }

  private step(dt: number) {
    this.runT += dt;
    this.tangle = Math.max(0, this.tangle - dt);
    const grip = this.perk === 'ice' ? DIVER_PERK.iceGrip : 0, glide = this.def.glide;
    const drag = this.tangle > 0 ? 5 : glide ? lerp(glide.drag, 2.6, grip) : 2.6;
    const push = (this.tangle > 0 ? 0.7 : glide ? lerp(glide.steer, 1, grip) : 1) * (this.perk === 'steer' ? DIVER_PERK.steer : 1);

    // Touch: the diver's velocity tracks the finger directly — swift and steady.
    // Keyboard: the original acceleration model (binary ±1 through STEER).
    const target = this.touchTargetY();
    const steer = target !== null ? Math.sign(this.diverY - target) || 0 : this.steering();
    const hold = steer !== 0 || target !== null;

    if (target !== null) {
      const err = target - this.diverY;
      // Seek speed scales with distance: fast when far, gentle when close, zero at target.
      const seekRate = 6 * push;
      this.vy = clamp(err * seekRate, -380, 380);
    } else {
      this.vy = clamp(this.vy * Math.exp(-drag * dt) - steer * STEER * push * dt, -340, 340);
    }
    this.vy += this.currentPush() * dt; // Riptide Canyon's currents
    if (this.turboT > 0) this.vy += clamp(this.caveMid(this.dist + 160) - this.diverY, -80, 80) * 10 * dt;
    this.diverY += this.vy * dt;
    this.diver.anims.timeScale = hold ? 1.8 : 0.6;

    if (!this.learned) ui.guideAt(this.diverX() * this.k, this.diverY * this.k);
    if (!this.learned && (ui.guidePress(steer, dt) || this.runT > 25)) {
      this.learned = true;
      store.set('learned', true);
      ui.guideDone();
    }
    if (hold) {
      this.exhaustT -= dt;
      if (this.exhaustT <= 0) {
        this.exhaustT = 0.05;
        this.exhaust.emitParticleAt(this.dist - 4, this.diverY - 10, 1);
        if (Math.random() < 0.12) sfx.tone(rand(280, 420), 0.07, { vol: 0.025, slideTo: 640 });
      }
    }

    const depth = this.dist / 10;
    this.speed = 200 + Math.min(200, depth * (this.rookie ? 0.09 : 0.14));
    this.moved = this.speed * (this.turboT > 0 ? TURBO_SPEED : this.tangle > 0 ? (this.perk === 'kelp' ? DIVER_PERK.kelpSlow : KELP_SLOW) : 1) * dt;
    this.dist += this.moved;
    ui.setDepth(Math.floor(depth));
    this.chaseBest(depth);
    this.ambient.setDepth(depth);
    music.setIntensity(0.45 + Math.min(0.55, depth / 450));

    // Timers
    this.invuln = Math.max(0, this.invuln - dt);
    this.wallT = Math.max(0, this.wallT - dt);
    if (this.shieldT > 0) { this.shieldT = Math.max(0, this.shieldT - dt); if (!this.shieldT) this.perkEnded(); }
    if (this.magnetT > 0) { this.magnetT = Math.max(0, this.magnetT - dt); if (!this.magnetT) this.perkEnded(); }
    if (this.turboT > 0) {
      this.turboT = Math.max(0, this.turboT - dt);
      this.exhaust.emitParticleAt(this.dist - 14, this.diverY + rand(-6, 6), 2);
      if (!this.turboT) {
        this.invuln = Math.max(this.invuln, 1);
        if (this.kickoff) { this.kickoff = false; this.shieldT = Math.max(this.shieldT, HEAD_START_SHIELD); ui.damage('Shield up!', true); }
        else ui.damage('Turbo over', true);
        this.perkEnded();
      }
    }
    if (!this.sight && this.runT > this.nextSight) {
      const dark = palette(this.def.biomes, this.dist / 10, this.pal).dark;
      this.sight = { kind: dark > 0.3 ? 'school' : 'whale', born: this.dist, y: rand(0.22, 0.55), size: rand(0.8, 1.15) };
      this.nextSight = this.runT + rand(...SIGHT_GAP);
    }
    if (this.comboT > 0) {
      this.comboT = Math.max(0, this.comboT - dt);
      if (this.comboT) ui.comboTime(this.comboT / this.comboWin); else this.bankCombo();
    }
    if (this.specialT > 0) { this.specialT = Math.max(0, this.specialT - dt); if (!this.specialT) ui.setSpecial(this.skin, this.special, this.charge, false); }
    if (this.boosterOpen && (this.runT > BOOSTER_WINDOW || depth > BOOSTER_UNTIL)) { this.boosterOpen = false; ui.setBoosters(null); }
    ui.setPerk(this.turboT ? 'turbo' : this.shieldT ? 'shield' : this.magnetT ? 'magnet' : null,
      this.turboT ? this.turboT / this.turboMax : this.shieldT ? this.shieldT / this.shieldTime : this.magnetT / this.magnetTime);

    // Oxygen drains a little faster the deeper you are (and in colder caves); not during Turbo.
    if (!this.turboT) this.oxy -= (6.5 + depth * 0.003) * (this.def.airDrain ?? 1) * (this.gear.has('airsaver') ? AIR_SAVER : 1) * (this.perk === 'ice' ? DIVER_PERK.air : 1) * (this.rookie ? 0.7 : 1) * dt;
    const low = this.oxy < 25;
    ui.setOxygen(this.oxy / 100, low);
    ui.lowO2(low);
    if (low) {
      this.beepT -= dt;
      if (this.beepT <= 0) { this.beepT = 0.55; sfx.tone(880, 0.07, { type: 'square', vol: 0.025 }); }
    }

    const bi = biomeIndex(this.def.biomes, depth);
    if (bi !== this.biome) {
      this.biome = bi;
      ui.banner(this.def.biomes[bi].name);
      // Every new zone opens with a breather and a row of pearls before the climb starts again.
      this.calmUntil = depth + CALM;
      this.nextPearls = Math.min(this.nextPearls, 120);
      this.cameras.main.flash(260, 180, 230, 255);
      sfx.tone(392, 0.7, { vol: 0.08 });
      sfx.tone(587, 0.9, { vol: 0.06, delay: 0.08 });
      buzz(20);
    }

    this.spawning(depth, dt);

    const leftEdge = this.dist - this.diverX() - 140;
    const dark = palette(this.def.biomes, depth, this.pal).dark;
    for (const o of this.obs) {
      this.animate(o, dt);
      if (o.dead) continue;
      const ahead = o.x - this.dist;
      if (this.frozen(o)) { /* Lumi's Flash: stunned where they are */ }
      else if (o.kind === 'jelly' && dark > 0.3 && ahead > 0 && ahead < 240) {
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
      } else this.moveStar(o, ahead, dt);
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
    this.kelpCheck(leftEdge);
    this.icicleCheck(leftEdge, dt);
    if (this.state === 'play') this.wreckCheck(dt, leftEdge);
    if (this.state !== 'play') return;

    // Plain walls just nudge you back; sharp stretches cost a life.
    const [top, bot] = cave(this.dist, this.H, this.cv, this.def.shape);
    const spikeTop = this.spiky(this.dist, 0), spikeBot = this.spiky(this.dist, 1);
    const topEdge = top + (spikeTop ? SPIKE_H * 0.6 : 0), botEdge = bot - (spikeBot ? SPIKE_H * 0.6 : 0);
    if (this.diverY - DIVER_R < topEdge) this.hitWall(topEdge + DIVER_R, 1, spikeTop);
    else if (this.diverY + DIVER_R > botEdge) this.hitWall(botEdge - DIVER_R, -1, spikeBot);
    if (this.state !== 'play') return;
    if (this.oxy <= 0) {
      if (dev.on) this.oxy = 100; // dev mode: the tank never runs dry
      else if (this.lifeline) this.rescue();
      else { this.oxy = 0; this.die('Ran out of air'); }
    }
  }

  /** Warn when your best depth is near, and celebrate passing it mid-dive. */
  private chaseBest(depth: number) {
    if (this.runBest <= 0) return;
    if (this.bestPassed) { ui.setBest(Math.floor(depth), true); return; }
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

  /**
   * Slipping past a creature or wall with very little room. Each one chained inside the window adds
   * more coins to the combo pot; the pot banks when the window runs out, and a hit before then loses it.
   */
  private closeCall() {
    const charm = this.gear.has('charm');
    this.combo = this.comboT > 0 ? Math.min(COMBO_MAX, this.combo + 1) : 1;
    this.comboWin = charm ? CHARM_WINDOW : COMBO_WINDOW;
    this.comboT = this.comboWin;
    this.runClose++;
    this.comboPot += this.combo + (charm ? 1 : 0);
    ui.combo(this.combo, this.comboPot);
    sfx.tone(660 + this.combo * 80, 0.1, { type: 'triangle', vol: 0.07, slideTo: 990 + this.combo * 80 });
    buzz(this.combo >= 5 ? 18 : 10);
    this.sparks.explode(3 + this.combo * 2, this.dist + 6, this.diverY);
    if (this.combo === 5 || this.combo === COMBO_MAX) {
      this.cameras.main.flash(140, 255, 220, 120);
      sfx.tone(1046, 0.15, { type: 'triangle', vol: 0.07, delay: 0.08 });
    }
  }
  /** Where a sight is on screen: it drifts in from the right on the far layer's slow parallax. */
  private sightX(W: number) {
    const sg = this.sight!;
    const x = W + 260 - (this.dist - sg.born) * 0.32;
    if (x < -320) this.sight = null;
    return x;
  }
  /** A whale passing far off in lit water: a soft silhouette in the far rocks' colour, tail slowly beating. */
  private drawSight(W: number, H: number, T: number, pal: Palette) {
    if (this.sight?.kind !== 'whale') return;
    const x = this.sightX(W), sg = this.sight;
    if (!sg) return;
    const y = sg.y * H, k = sg.size, g = this.far;
    g.fillStyle(mixNum(pal.top, pal.rock, 0.8), 0.6);
    g.fillEllipse(x, y, 230 * k, 64 * k);
    g.fillEllipse(x - 70 * k, y - 6 * k, 90 * k, 52 * k); // head
    const sway = Math.sin(T * 1.6) * 10 * k, tx = x + 112 * k;
    g.fillTriangle(tx - 10 * k, y, tx + 46 * k, y - 26 * k + sway, tx + 40 * k, y + 22 * k + sway);
    g.fillTriangle(x - 20 * k, y + 18 * k, x + 20 * k, y + 20 * k, x - 4 * k, y + 52 * k); // flipper
  }
  /** A school of glowing fish crossing far off in the dark, drawn above the darkness. */
  private drawSchool(x0: number, W: number, H: number, T: number, dark: number) {
    const x = this.sightX(W), sg = this.sight;
    if (!sg) return;
    for (let i = 0; i < 26; i++) {
      const a = i * 2.39996, r = 10 + (i % 7) * 9;
      const fx = x + Math.cos(a + T * 0.6) * r * 1.8, fy = sg.y * H + Math.sin(a + T * 0.6) * r * 0.7 + Math.sin(T * 2 + i) * 3;
      this.edges.fillStyle(0x5cffd6, 0.6 * dark * (0.6 + 0.4 * Math.sin(T * 3 + i)));
      this.edges.fillEllipse(x0 + fx, fy, 9, 4);
    }
  }
  /** The combo's window ran out: its pot is safe. */
  private bankCombo() {
    if (this.comboPot) {
      this.runBonus += this.comboPot;
      ui.comboEnd('banked', this.comboPot);
      sfx.tone(880, 0.08, { vol: 0.06 }); sfx.tone(1320, 0.14, { vol: 0.06, delay: 0.06 });
    } else ui.combo(null);
    this.combo = 0; this.comboPot = 0;
  }
  /** A hit (or the end of the dive) before the combo banked: its pot is gone. */
  private dropCombo() {
    if (this.comboPot) ui.comboEnd('lost', this.comboPot);
    this.combo = 0; this.comboT = 0; this.comboPot = 0;
  }

  private spawning(depth: number, dt: number) {
    // Daily Dive: timers count the distance actually swum, so a Turbo can't shift the trench.
    const step = this.daily ? this.moved : this.speed * dt;
    // Each spawner rolls from its own stream (see `streams`), so their order in a frame never matters.
    // `lag` is how far past its timer this frame went: a Daily Dive spawns at the exact spot and starts the next timer from there.
    const using = (k: Stream, timer: number, fn: () => void) => { this.lag = this.daily ? -timer : 0; this.withRng(this.streams[k], fn); };
    if ((this.nextObs -= step) <= 0) using('obs', this.nextObs, () => {
      this.spawnObstacle(depth);
      if (this.rookie) ui.coach({ id: 'lives', target: 'hearts', text: 'Hitting a critter costs a life' });
      // Sawtooth pacing: the cave closes in with depth, breathes in and out every ~450 m, and eases off after a new zone.
      const { gap, over } = this.def.pace;
      const wave = 1 + 0.2 * Math.sin((depth / 450) * TAU);
      const calm = depth < this.calmUntil ? 1.7 : 1;
      const rookie = this.rookie ? 1.6 : 1; // first game: obstacles are spaced 60% further apart
      this.nextObs = lerp(gap[0], gap[1], clamp(depth / over, 0, 1)) * wave * calm * rookie * this.cr(0.75, 1.25) - this.lag;
    });
    if ((this.nextAir -= step) <= 0) using('air', this.nextAir, () => {
      this.spawnRow('air', 3, 34);
      if (this.rookie) ui.coach({ id: 'air', target: 'o2bar', text: 'Grab bubbles to refill air' });
      this.nextAir = this.cr(420, 620) + depth * 0.08 - this.lag;
    });
    if ((this.nextPearls -= step) <= 0) using('pearl', this.nextPearls, () => {
      this.spawnRow('pearl', 5 + ((this.rng() * 4) | 0), 26);
      this.nextPearls = this.cr(...this.def.pearlGap) - this.lag;
    });
    if ((this.nextPerk -= step) <= 0) using('perk', this.nextPerk, () => {
      // The first power-up of every dive, in every cave, is a Turbo. After that the lifeline is
      // rare and never offered while you still hold one (the others are then picked evenly).
      const rest: Perk[] = depth > TURBO_FROM ? ['shield', 'magnet', 'turbo'] : ['shield', 'magnet'];
      // Both rolls are always made, so what you hold never shifts the power-ups that come after.
      const canLife = !this.lifeline && depth > LIFELINE_FROM, r = this.rng(), alt = this.cpick(rest);
      const perk = this.perkCount++ === 0 && depth > TURBO_FROM ? 'turbo' : canLife && r < this.lifelineChance ? 'lifeline' : alt;
      this.spawnRow(perk, 1, 0);
      this.nextPerk = this.gap(PERK_GAP, this.tune.perkGap) - this.lag;
    });
    if ((this.nextShell -= step) <= 0) using('shell', this.nextShell, () => {
      this.spawnRow('shell', 1, 0, true);
      this.nextShell = this.gap(SHELL_GAP, this.tune.heartGap) - this.lag;
    });
    if ((this.nextChest -= step) <= 0) using('chest', this.nextChest, () => {
      this.spawnRow('chest', 1, 0, true);
      this.nextChest = this.gap(CHEST_GAP, this.tune.chestGap) - this.lag;
    });
    if (this.def.kelp && (this.nextKelp -= step) <= 0) using('kelp', this.nextKelp, () => {
      this.spawnKelp();
      this.nextKelp = this.cr(...this.def.kelp!.gap) - this.lag;
    });
    if (this.def.icicles && (this.nextIcicle -= step) <= 0) using('ice', this.nextIcicle, () => {
      this.spawnIcicles(depth);
      this.nextIcicle = this.cr(...this.def.icicles!.gap) - this.lag;
    });
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
      this.loseLife(this.spikeLook().hit);
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
    const from = this.def.spikeFrom;
    if (d < from) return false;
    const chance = (0.14 + Math.min(0.26, (d - from) / 2500)) * this.def.spikes;
    const topSharp = hash(seg * 13.7 + 5.1) < chance;
    const sharp = side === 0 ? topSharp : !topSharp && hash(seg * 13.7 + 91.3) < chance;
    if (!sharp) return false;
    const f = (wx - seg * SPIKE_SEG) / SPIKE_SEG;
    return f > 0.1 && f < 0.9;
  }

  private eelCharged(o: Obstacle) { return ((this.clock + o.ph) % EEL_CYCLE) < EEL_ON; }

  /** Room between the diver and a creature's hit zone (negative = touching), or null while it's harmless. */
  private clearance(o: Obstacle) {
    // Long bodies (a shark, a swordfish's bill) hurt along their length, not just round the middle.
    const long = o.kind === 'shark' ? [-34, 34, 12] : o.kind === 'swordfish' ? [-60, 22, 8] : null;
    if (long) {
      const dx = clamp(this.dist, o.x + long[0], o.x + long[1]) - this.dist;
      return Math.hypot(dx, o.y - this.diverY) - (long[2] + DIVER_R * 0.8);
    }
    if (o.kind !== 'eel') return Math.hypot(o.x - this.dist, o.y + o.dy - this.diverY) - (o.r + DIVER_R * 0.8);
    // Eels are only dangerous while charged, along their whole body.
    if (!this.eelCharged(o)) return null;
    const dx = clamp(this.dist, o.x - EEL_HALF, o.x + EEL_HALF) - this.dist;
    return Math.hypot(dx, o.y - this.diverY) - (8 + DIVER_R * 0.8);
  }

  private hitCreature(o: Obstacle) {
    if (this.using('phase')) return; // Ghost drifts straight through
    if (this.turboT > 0) { // Turbo bowls straight through
      o.dead = true;
      this.sparks.explode(12, o.x, o.y);
      sfx.noise(0.2, 0.08, 1200);
      buzz(10);
      return;
    }
    if (this.invuln > 0) return;
    if (o.kind === 'eel' && this.eelGuard && this.shieldT <= 0) {
      // Puff puffs up and takes the first eel zap of the dive.
      this.eelGuard = false;
      this.invuln = 0.8;
      this.vy = Math.sign(this.diverY - o.y || 1) * 220;
      this.sparks.explode(10, this.dist, this.diverY);
      sfx.tone(700, 0.2, { vol: 0.08, slideTo: 400 });
      buzz(15);
      ui.damage('Spiky Puff!', true);
      return;
    }
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
    if (this.invuln > 0 || this.turboT > 0) return;
    if (dev.on) { this.invuln = HIT_INVULN; ui.damage('Dev mode: no damage', true); return; }
    if (this.shieldT > 0) { this.useShield(); this.invuln = 0.8; return; }
    if (this.lifeline) { this.rescue(); return; }
    if (this.cleanDepth < 0) this.cleanDepth = Math.floor(this.dist / 10);
    this.dropCombo();
    this.hearts--;
    this.invuln = this.perk === 'blink' ? DIVER_PERK.blink : HIT_INVULN;
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
    this.slowRate = SLOWMO_RATE;
    this.vy = clamp(this.caveMid(this.dist) - this.diverY, -1, 1) * 260;
    this.pops.explode(22, this.dist, this.diverY);
    this.sparks.explode(16, this.dist, this.diverY);
    this.cameras.main.flash(300, 255, 214, 90);
    sfx.tone(523, 0.2, { vol: 0.09 }); sfx.tone(784, 0.25, { vol: 0.08, delay: 0.1 }); sfx.tone(1046, 0.5, { vol: 0.08, delay: 0.2 });
    buzz([20, 40, 60]);
    ui.damage('Lifeline saved you!', true);
  }

  // ---------- Diver specials and boosters

  /** Is the worn diver's special `id` running right now? */
  private using(id: string) { return this.specialT > 0 && this.special.id === id; }

  /** Lumi's Flash: creatures on screen are stunned (they stay put, and still sting). */
  private frozen(o: Obstacle) { return this.using('flash') && o.x - this.dist < this.W; }

  private addCharge(n: number) {
    const was = this.charge;
    this.charge = Math.min(1, this.charge + n);
    if (this.charge === was) return;
    ui.setSpecial(this.skin, this.special, this.charge, this.specialT > 0);
    if (this.charge >= 1 && was < 1) {
      sfx.tone(784, 0.12, { type: 'triangle', vol: 0.06 }); sfx.tone(1175, 0.2, { type: 'triangle', vol: 0.06, delay: 0.08 });
      buzz(12);
      // The first time ever, say how to use it.
      if (!store.get('specialTip', false)) { store.set('specialTip', true); ui.coach({ id: 'special', target: 'specialBtn', text: 'Ready! Double-tap to use it' }); }
    }
  }

  /** Double-tap (or the button, or E): fire the diver's special when the meter is full. */
  private fireSpecial() {
    if (this.state !== 'play' || this.charge < 1 || this.specialT > 0) return;
    const s = this.special;
    this.charge = 0;
    this.specialT = s.time;
    this.runSpecials++;
    if (s.id === 'wind') { this.oxy = 100; this.shieldT = Math.max(this.shieldT, s.time); }
    else if (s.id === 'dash') { this.turboT = this.turboMax = Math.max(this.turboT, s.time); }
    else if (s.id === 'bloom') { this.withRng(Math.random, () => this.spawnRowAt('pearl', 14, 26)); this.magnetT = Math.max(this.magnetT, s.time); }
    else if (s.id === 'puff') {
      for (const o of this.obs) {
        if (o.dead || Math.hypot(o.x - this.dist, o.y - this.diverY) > PUFF_RANGE) continue;
        o.dead = true;
        this.sparks.explode(10, o.x, o.y);
      }
      this.invuln = Math.max(this.invuln, 0.6);
      sfx.noise(0.25, 0.1, 900);
    } else if (s.id === 'steady') { this.slowT = s.time; this.slowRate = STEADY_RATE; }
    this.pops.explode(18, this.dist, this.diverY);
    this.cameras.main.flash(200, 190, 240, 255);
    sfx.tone(523, 0.12, { vol: 0.08 }); sfx.tone(784, 0.14, { vol: 0.08, delay: 0.06 }); sfx.tone(1046, 0.3, { vol: 0.07, delay: 0.12 });
    buzz([12, 20, 12]);
    ui.damage(`${s.name}!`, true);
    ui.setSpecial(this.skin, s, 0, s.time > 0);
  }

  /** Tap a booster chip in the first seconds of a dive: spends one from your stack. */
  private useBooster(id: BoosterId) {
    if (this.state !== 'play' || !this.boosterOpen || this.usedBoosters.has(id) || !boosters.use(id)) return false;
    this.usedBoosters.add(id);
    if (id === 'megaturbo') {
      this.kickoff = true; // a short shield to land safely, as with the Head Start gadget
      this.turboT = this.turboMax = Math.max(this.turboT, MEGA_TURBO);
      this.perkCount = Math.max(this.perkCount, 1);
      this.cameras.main.flash(180, 255, 190, 110);
    } else if (id === 'doubler') this.doubler = true;
    else this.addCharge(1);
    sfx.tone(660, 0.1, { vol: 0.08, slideTo: 990 });
    buzz(12);
    ui.damage(`${boosterById(id).name}!`, true);
    ui.setBoosters(boosters.held().filter(b => !this.usedBoosters.has(b.id)));
    return true;
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
      const n = (lucky ? 2 : 1) * (this.using('gold') ? 2 : 1); // Royal's Gold Rush doubles them
      this.runPearls += n;
      if (n > 1) this.sparks.explode(6, p.x, p.y);
      ui.setPearls(this.runPearls);
      this.addCharge(n / SPECIAL_PEARLS);
      sfx.tone(1180 + (this.runPearls % 5) * 120, 0.08, { type: 'triangle', vol: 0.06 });
      this.sparks.explode(3, p.x, p.y);
    } else if (p.type === 'chest') {
      this.takeChest(p);
    } else if (p.type === 'shell') {
      this.findShell(p.x, p.y, 'Sea Heart!');
    } else {
      this.runPerks++;
      this.givePerk(p.type);
      ui.damage(p.type === 'shield' ? 'Shield up!' : p.type === 'magnet' ? 'Magnet!' : p.type === 'turbo' ? 'Turbo!' : 'Lifeline!', true);
      sfx.tone(523, 0.18, { vol: 0.09 }); sfx.tone(784, 0.3, { vol: 0.08, delay: 0.08 });
      buzz(18);
      this.sparks.explode(14, p.x, p.y);
    }
  }

  private givePerk(type: Perk) {
    if (type === 'shield') this.shieldT = this.shieldTime;
    else if (type === 'magnet') this.magnetT = this.magnetTime;
    else if (type === 'turbo') { this.turboT = this.turboMax = TURBO_TIME; this.cameras.main.flash(140, 255, 190, 110); }
    else { this.lifeline = true; ui.setLifeline(true); }
  }

  /** A Sea Heart for the collection: spent on "Save me" or on divers. */
  private findShell(x: number, y: number, text: string) {
    shells.add(1);
    ui.damage(`${text} (${shells.count})`, true);
    this.sparks.explode(22, x, y);
    sfx.tone(784, 0.15, { vol: 0.08 }); sfx.tone(1175, 0.2, { vol: 0.08, delay: 0.09 }); sfx.tone(1568, 0.45, { vol: 0.07, delay: 0.18 });
    buzz([10, 20, 10]);
  }

  /** A treasure chest: kept shut until the dive ends, then opened on the game-over screen. */
  private takeChest(p: Pickup) {
    this.runChests++;
    ui.damage(this.runChests > 1 ? `Treasure chest ×${this.runChests}!` : 'Treasure chest! Open it after the dive', true);
    this.sparks.explode(26, p.x, p.y);
    this.pops.explode(10, p.x, p.y);
    this.cameras.main.flash(180, 255, 214, 90);
    sfx.tone(659, 0.15, { vol: 0.08 }); sfx.tone(880, 0.15, { vol: 0.08, delay: 0.08 }); sfx.tone(1318, 0.4, { vol: 0.08, delay: 0.16 });
    buzz([15, 25, 15]);
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

  /** How each cave's own creature moves (see caves.ts `star`). */
  private moveStar(o: Obstacle, ahead: number, dt: number) {
    if (o.kind === 'puffer') {
      // Swims at you, drifting towards your height, and puffs up into a spiky ball as you come near.
      o.x += o.vx * dt;
      if (ahead > 0) o.y += clamp(this.diverY - o.y, -1, 1) * 30 * dt;
      const [t, b] = cave(o.x, this.H, this.cv, this.def.shape);
      o.y = clamp(o.y, t + o.r + 6, b - o.r - 6);
      const want = ahead < PUFF_AT ? PUFF_R[1] : PUFF_R[0];
      o.r += clamp(want - o.r, -40 * dt, 40 * dt);
      o.sprite.setScale(TEX_SCALE * (o.r / 20));
    } else if (o.kind === 'crab') {
      o.x += o.vx * dt;
      const [t, b] = cave(o.x, this.H, this.cv, this.def.shape);
      o.y = o.y0 ? t + 12 : b - 12;
      o.sprite.setRotation(Math.sin(o.ph * 14) * 0.08);
    } else if (o.kind === 'squid' || o.kind === 'octopus') {
      // Bursts towards your line, then drifts.
      const j = JET[o.kind], p = o.ph % j.cycle, on = p < j.on && ahead > 0;
      o.x += o.vx * dt - (on ? j.speed * 0.4 * dt : 0);
      if (on) o.y += clamp(this.diverY - o.y, -1, 1) * j.speed * (1 - p / j.on) * dt;
      const [t, b] = cave(o.x, this.H, this.cv, this.def.shape);
      o.y = clamp(o.y, t + o.r + 4, b - o.r - 4);
      o.sprite.setScale(TEX_SCALE * (on ? 1.12 : 1), TEX_SCALE * (on ? 0.9 : 1));
    } else if (o.kind === 'shark') {
      o.x += o.vx * dt;
      if (ahead > 40) o.y += clamp(this.diverY - o.y, -1, 1) * 38 * dt;
      o.sprite.setRotation(clamp((this.diverY - o.y) / 300, -0.15, 0.15));
    } else if (o.kind === 'swordfish') {
      // Hangs still, glints a warning, then darts straight across.
      if (o.lunge === undefined && ahead > 0 && ahead < SWORD_AT) { o.lunge = SWORD_WARN; sfx.tone(1400, 0.08, { type: 'triangle', vol: 0.04 }); }
      if (o.lunge !== undefined && o.lunge > 0) { o.lunge -= dt; if (o.lunge <= 0) { o.dash = 1; sfx.noise(0.15, 0.05, 2400); } }
      if (o.dash) o.x -= SWORD_SPEED * dt;
    } else if (o.kind === 'snake') {
      o.x += o.vx * dt;
    }
  }

  private animate(o: Obstacle, dt: number) {
    o.ph += dt;
    if (o.kind === 'jelly') o.y = o.y0 + Math.sin(o.ph * 1.4) * o.amp;
    if (o.kind === 'mine') o.dy = Math.sin(o.ph * 2) * 5;
    if (o.kind === 'puffer') o.dy = Math.sin(o.ph * 1.6) * o.amp;
    if (o.kind === 'snake') {
      const k = o.ph * 2.4;
      o.y = o.y0 + Math.sin(k) * o.amp;
      o.sprite.setRotation(-Math.atan2(Math.cos(k) * o.amp * 2.4, -o.vx) * 0.6);
    }
  }

  private spawnObstacle(depth: number) {
    const wx = this.dist - this.diverX() + this.W + 80 - this.lag;
    const [t, b] = cave(wx, this.H, this.cv, this.def.shape);
    // Each cave lets creatures in at its own depths; deep down every kind is doubled up.
    const kinds: Kind[] = [];
    for (const [k, from] of Object.entries(this.def.creatures) as [Kind, number][]) {
      if (depth >= from) kinds.push(k);
      if (depth >= from && k === this.def.star) kinds.push(k); // the cave's own creature is the common one
      if (depth >= Math.max(from, this.def.crowdFrom)) kinds.push(k);
    }
    if (!kinds.length) kinds.push('jelly');
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
    } else if (kind === 'puffer') {
      o = { ...base, x: wx + 80, r: PUFF_R[0], amp: this.cr(6, 14), vx: -this.cr(55, 95), sprite: this.add.sprite(wx + 80, y, 'puffer'), glow: this.glow(0xffd36b) };
    } else if (kind === 'crab') {
      // Walks along the floor, or upside down along the ceiling, towards you.
      const top = this.rng() < 0.35;
      o = { ...base, x: wx, r: 13, vx: -this.cr(45, 85), y: top ? t + 12 : b - 12, y0: top ? 1 : 0, sprite: this.add.sprite(wx, y, 'crab').setFlipY(top), glow: this.glow(0xff8a6b) };
    } else if (kind === 'squid' || kind === 'octopus') {
      const big = kind === 'octopus';
      o = { ...base, x: wx, r: big ? 18 : 13, vx: -this.cr(10, 30), sprite: this.add.sprite(wx, y, kind).setFlipX(!big), glow: this.glow(big ? 0xff8fa0 : 0x9fe2ff) }; // squid jet fins-first
    } else if (kind === 'shark') {
      o = { ...base, x: wx + 160, r: 19, vx: -this.cr(150, 210), sprite: this.add.sprite(wx + 160, y, 'shark').setOrigin(58 / 120, 32 / 60), glow: this.glow(0xbfd8ee) };
    } else if (kind === 'swordfish') {
      o = { ...base, x: wx + 60, r: 13, sprite: this.add.sprite(wx + 60, y, 'swordfish').setOrigin(66 / 124, 0.5), glow: this.glow(0xe8f4ff) };
    } else if (kind === 'snake') {
      o = { ...base, x: wx + 60, r: 11, vx: -this.cr(55, 85), amp: this.cr(28, 52), sprite: this.add.sprite(wx + 60, y, 'snake'), glow: this.glow(0xffe36b) };
    } else {
      o = { ...base, x: wx + 140, r: 17, vx: -this.cr(70, 140), sprite: this.add.sprite(wx + 140, y, 'angler', 0).setOrigin(56 / 108, 38 / 72), glow: this.glow(0xbeff8c) };
      o.sprite.play('angler');
    }
    o.sprite.setScale(TEX_SCALE).setDepth(5);
    this.obs.push(o);
  }

  /** A clump of kelp just off-screen, from the floor or the ceiling, always leaving a way past. */
  private spawnKelp() {
    const wx = this.dist - this.diverX() + this.W + 80 - this.lag;
    const [t, b] = cave(wx, this.H, this.cv, this.def.shape);
    this.kelps.push({
      x: wx, side: this.rng() < 0.6 ? 1 : 0, len: (b - t) * this.cr(0.38, 0.56),
      w: this.cr(44, 72), ph: this.cr(0, TAU), strands: 3 + ((this.rng() * 2) | 0),
    });
  }

  /** Swimming through kelp slows you down for a moment; drop clumps once they're behind. */
  private kelpCheck(leftEdge: number) {
    this.kelps = this.kelps.filter(k => k.x + k.w > leftEdge);
    for (const k of this.kelps) {
      if (Math.abs(this.dist - k.x) > k.w / 2 + DIVER_R * 0.5) continue;
      const [t, b] = cave(k.x, this.H, this.cv, this.def.shape);
      const inside = k.side === 1 ? this.diverY + DIVER_R * 0.5 > b - k.len : this.diverY - DIVER_R * 0.5 < t + k.len;
      if (!inside || this.turboT > 0) continue;
      if (this.tangle <= 0) {
        sfx.noise(0.25, 0.05, 900);
        buzz(10);
        if (this.tangles++ < 2) ui.damage('Tangled in kelp!');
      }
      this.tangle = KELP_HOLD;
    }
  }

  /** One to three icicles just off-screen, each shaking loose at its own distance so they fall in a ragged line. */
  private spawnIcicles(depth: number) {
    // Far enough ahead that even at top speed it has time to shake, fall and land before you get there.
    let wx = this.dist + Math.max(this.W + 80 - this.diverX(), this.speed * (this.turboT > 0 ? TURBO_SPEED : 1) * 1.8);
    const n = 1 + (this.rng() < 0.35 ? 1 : 0) + (depth > 300 && this.rng() < 0.3 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      this.icicles.push({
        x: wx, len: this.cr(30, 52), w: this.cr(16, 24), late: this.rng() < ICICLE_LATE,
        lead: 0, shake: 0, drop: 0, vy: 0, falling: false,
      });
      const c = this.icicles[this.icicles.length - 1];
      c.lead = c.late ? this.cr(0.12, 0.25) : this.cr(0.25, 0.5);
      wx += this.cr(40, 70);
    }
  }

  /** Where an icicle is: its base on (or below) the ceiling, and its tip. Once it lands, its tip is buried in the floor. */
  private icicleAt(c: Icicle): [number, number] {
    if (c.stuck) {
      const tip = cave(c.x, this.H, this.cv, this.def.shape)[1] + c.len * ICICLE_SINK;
      return [tip - c.len, tip];
    }
    const base = cave(c.x, this.H, this.cv, this.def.shape)[0] - 2 + c.drop;
    return [base, base + c.len];
  }

  /** Icicles shake loose as you come near, fall, and shatter on the floor; one hitting you costs a life. */
  private icicleCheck(leftEdge: number, dt: number) {
    this.icicles = this.icicles.filter(c => !c.gone && c.x + c.w > leftEdge);
    for (const c of this.icicles) {
      const ahead = c.x - this.dist;
      if (!c.falling && c.shake <= 0) {
        // Shake loose once the time until you reach it is down to shake + fall + lead, or for a late
        // one, shake + fall - (time to swim past it) - lead.
        const [, tip0] = this.icicleAt(c), floor = cave(c.x, this.H, this.cv, this.def.shape)[1];
        const fall = Math.sqrt((2 * Math.max(0, floor - tip0)) / ICICLE_G);
        const speed = this.speed * (this.turboT > 0 ? TURBO_SPEED : 1);
        const reach = (ahead - c.w / 2 - DIVER_R) / speed, cross = (c.w + DIVER_R * 2) / speed;
        if (reach < ICICLE_SHAKE + fall + (c.late ? -cross - c.lead : c.lead)) {
          c.shake = ICICLE_SHAKE;
          if (ahead < this.W) sfx.tone(rand(1500, 1900), 0.12, { type: 'triangle', vol: 0.03, slideTo: 1200 });
        }
      }
      if (c.shake > 0) { c.shake -= dt; if (c.shake <= 0) c.falling = true; }
      if (c.falling && !c.stuck) {
        c.vy += ICICLE_G * dt; c.drop += c.vy * dt;
        const floor = cave(c.x, this.H, this.cv, this.def.shape)[1];
        if (this.icicleAt(c)[1] >= floor) {
          c.stuck = true;
          if (Math.abs(ahead) < this.W) {
            this.pops.explode(8, c.x, floor);
            sfx.noise(0.18, 0.05, 3000);
          }
        }
      }
      const [base, tip] = this.icicleAt(c);
      // Room between the diver and the icicle (a narrowing spike from base to tip).
      const dx = Math.abs(this.dist - c.x), y = this.diverY, r = DIVER_R * 0.8;
      const gap = y > tip ? Math.hypot(dx, y - tip) - r
        : y < base ? Math.hypot(Math.max(0, dx - c.w / 2), base - y) - r
        : dx - (c.w / 2) * ((tip - y) / c.len) - r;
      if (Math.abs(ahead) < 60) c.gap = Math.min(c.gap ?? Infinity, gap);
      if (gap < 0 && this.invuln <= 0) {
        c.gone = true;
        this.pops.explode(10, c.x, Math.min(tip, y));
        sfx.noise(0.2, 0.08, 2500);
        this.vy = Math.min(this.vy, 0) - 160;
        this.loseLife(c.stuck ? 'Spiked on an icicle' : 'Hit by a falling icicle');
        if (this.state !== 'play') return;
        continue;
      }
      if (!c.passed && c.x < this.dist - 40) {
        c.passed = true;
        if (c.gap !== undefined && c.gap >= 0 && c.gap < CLOSE_CALL) this.closeCall();
      }
    }
  }

  // ---------- Wreck caves: cannons and anchors (Pirate Shipwreck), steam vents and falling decks (Titanic Wreck); rare treasures in every cave

  private nextCannon = Infinity;
  private cannons: Cannon[] = [];
  private balls: Ball[] = [];
  private nextAnchor = Infinity;
  private anchors: Anchor[] = [];
  private nextVent = Infinity;
  private vents: Vent[] = [];
  private nextDeck = Infinity;
  /** World x of the last wreck hazard placed (see `wreckSpot`). */
  private lastWreckX = -Infinity;
  private decks: Deck[] = [];
  private treasureAt = Infinity;           // world x where this dive's treasure turns up (Infinity: not this dive)
  private treasureDef: Treasure | null = null;
  private treasure: TreasureItem | null = null;

  /** A new dive: the first of each hazard comes a little after its starting depth, and the treasure is rolled for. */
  private resetWreck() {
    const d = this.def, first = (h?: { from: number }) => (h ? h.from * 10 + this.withRng(this.streams.wreck, () => this.cr(200, 500)) : Infinity);
    this.nextCannon = first(d.cannons);
    this.nextAnchor = first(d.anchors);
    this.nextVent = first(d.vents);
    this.nextDeck = first(d.decks);
    this.lastWreckX = -Infinity;
    // Plain Math.random, not the course's random streams: treasure isn't part of the course.
    const roll = rollTreasure(d.id, Math.random, this.tune.treasureOdds);
    this.treasureDef = roll?.t ?? null;
    this.treasureAt = roll ? roll.depth * 10 : Infinity;
    this.resetSetPieces();
  }

  private clearWreck() {
    this.cannons = []; this.balls = []; this.anchors = []; this.vents = []; this.decks = [];
    this.clearSetPieces();
    if (this.treasure) { this.treasure.sprite.destroy(); this.treasure.glow.destroy(); this.treasure = null; }
  }

  /** Spawn and run this cave's wreck hazards and this dive's treasure; any hazard can end the dive. */
  private wreckCheck(dt: number, leftEdge: number) {
    // Wreck hazards roll from their own course stream and, in a Daily Dive, count distance (see `spawning`).
    const d = this.def, step = this.daily ? this.moved : this.speed * dt;
    const at = (timer: number) => { this.lag = this.daily ? -timer : 0; return true; }; // spawn where the timer ran out
    // Hazards due in the same frame go in the order they came due, so the frame rate never decides which gets the spot.
    const due: { timer: number; run: () => void }[] = [];
    if (d.cannons && (this.nextCannon -= step) <= 0) due.push({ timer: this.nextCannon, run: () => { this.nextCannon = (this.spawnCannon() ? this.cr(...d.cannons!.gap) : 200) - this.lag; } });
    if (d.anchors && (this.nextAnchor -= step) <= 0) due.push({ timer: this.nextAnchor, run: () => { this.nextAnchor = (this.spawnAnchor() ? this.cr(...d.anchors!.gap) : 200) - this.lag; } });
    if (d.vents && (this.nextVent -= step) <= 0) due.push({ timer: this.nextVent, run: () => { this.nextVent = (this.spawnVent() ? this.cr(...d.vents!.gap) : 200) - this.lag; } });
    if (d.decks && (this.nextDeck -= step) <= 0) due.push({ timer: this.nextDeck, run: () => { this.nextDeck = (this.spawnDeck() ? this.cr(...d.decks!.gap) : 200) - this.lag; } });
    this.setPieceDue(due, step);
    this.withRng(this.streams.wreck, () => due.sort((a, b) => a.timer - b.timer).forEach(h => { at(h.timer); h.run(); }));
    if (this.dist - this.diverX() + this.W > this.treasureAt) this.spawnTreasure();
    this.cannonCheck(dt, leftEdge);
    if (this.state === 'play') this.anchorCheck(leftEdge);
    if (this.state === 'play') this.ventCheck(leftEdge);
    if (this.state === 'play') this.deckCheck(dt, leftEdge);
    if (this.state === 'play') this.setPieceCheck(dt, leftEdge, step);
    if (this.state === 'play') this.treasureCheck(dt, leftEdge);
  }

  /** Where the next wreck hazard goes (just off-screen), or null if the last one is still too close. */
  private wreckSpot() {
    // Measured from where the last hazard was placed (not the live ones, which can vanish on a timer),
    // so the spacing is the same however fast you go: a Daily Dive stays the same for everyone.
    const wx = this.dist - this.diverX() + this.W + 80 - this.lag;
    if (this.ghost || Math.abs(wx - this.lastWreckX) < WRECK_SPACING) return null; // nothing new while the ghost ship fires
    this.lastWreckX = wx;
    return wx;
  }

  /** A side of the trench that isn't sharp at x (the floor more often). */
  private plainSide(wx: number, floorChance: number): 0 | 1 {
    const side: 0 | 1 = this.rng() < floorChance ? 1 : 0;
    return this.spiky(wx, side) ? (side ? 0 : 1) : side;
  }

  /** Clearance from the diver to a thick segment (negative = touching). */
  private segGap(ax: number, ay: number, bx: number, by: number, half: number) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? clamp(((this.dist - ax) * dx + (this.diverY - ay) * dy) / l2, 0, 1) : 0;
    return Math.hypot(this.dist - ax - t * dx, this.diverY - ay - t * dy) - half - DIVER_R * 0.8;
  }

  /** A hazard was dodged with very little room: count it as a close call. */
  private dodged(h: { x: number; gap?: number; passed?: boolean }) {
    if (h.passed || h.x > this.dist - 40) return;
    h.passed = true;
    if (h.gap !== undefined && h.gap >= 0 && h.gap < CLOSE_CALL) this.closeCall();
  }

  private spawnCannon() {
    const wx = this.wreckSpot();
    if (wx === null) return false;
    const side = this.plainSide(wx, 0.6);
    this.cannons.push({ x: wx, side, aim: side ? -Math.PI * 0.8 : Math.PI * 0.8, fuse: 0, fired: false, kick: 0 });
    return true;
  }

  /** The cannon's pivot, sitting on its carriage just off the wall. */
  private cannonPivot(c: Cannon): [number, number] {
    return [c.x, cave(c.x, this.H, this.cv, this.def.shape)[c.side] + (c.side ? -12 : 12)];
  }

  /** Cannons swing round to follow you, fizz their fuse as you come near, then fire one ball straight at you. */
  private cannonCheck(dt: number, leftEdge: number) {
    this.cannons = this.cannons.filter(c => c.x > leftEdge - 40);
    for (const c of this.cannons) {
      c.kick = Math.max(0, c.kick - dt * 3);
      if (c.fired) continue;
      const [px, py] = this.cannonPivot(c), ahead = c.x - this.dist;
      const want = Math.atan2(this.diverY - py, this.dist - px);
      const aim = c.side ? clamp(want, -Math.PI + 0.15, -0.35) : clamp(want, 0.35, Math.PI - 0.15);
      c.aim += clamp(aim - c.aim, -2.5 * dt, 2.5 * dt);
      if (!c.fuse && ahead < CANNON_FUSE_AT) {
        c.fuse = CANNON_FUSE;
        sfx.noise(CANNON_FUSE, 0.035, 5200, 0.7);
      } else if (c.fuse > 0 && (c.fuse -= dt) <= 0) {
        c.fired = true;
        c.kick = 1;
        // The ball flies straight at where you are now (on screen), so keep moving.
        const mx = px + Math.cos(c.aim) * 26, my = py + Math.sin(c.aim) * 26;
        const dx = this.dist - mx, dy = this.diverY - my, len = Math.hypot(dx, dy) || 1;
        this.balls.push({ x: mx, y: my, vx: (dx / len) * BALL_CLOSE, vy: (dy / len) * BALL_CLOSE });
        this.pops.explode(10, mx, my);
        this.cameras.main.shake(90, 0.003);
        sfx.noise(0.45, 0.16, 220, 0.8);
        sfx.tone(110, 0.35, { type: 'sawtooth', vol: 0.07, slideTo: 42 });
        buzz(12);
      }
    }
    // Balls move relative to you (the view follows you), so on screen they fly straight along their aim.
    const fwd = this.speed * (this.turboT > 0 ? TURBO_SPEED : 1);
    this.balls = this.balls.filter(b => {
      if (b.gone || b.x < leftEdge) return false;
      b.x += (fwd + b.vx) * dt; b.y += b.vy * dt;
      const [t, bot] = cave(b.x, this.H, this.cv, this.def.shape);
      if (b.y < t + BALL_R * 0.5 || b.y > bot - BALL_R * 0.5) {
        this.pops.explode(6, b.x, clamp(b.y, t, bot));
        if (Math.abs(b.x - this.dist) < this.W) sfx.noise(0.15, 0.05, 400);
        return false;
      }
      return true;
    });
    for (const b of this.balls) {
      const gap = Math.hypot(b.x - this.dist, b.y - this.diverY) - BALL_R - DIVER_R * 0.8;
      if (Math.abs(b.x - this.dist) < 60) b.gap = Math.min(b.gap ?? Infinity, gap);
      if (gap < 0 && this.turboT > 0) { b.gone = true; this.sparks.explode(10, b.x, b.y); sfx.noise(0.2, 0.08, 900); continue; }
      if (gap < 0 && this.invuln <= 0) {
        b.gone = true;
        this.sparks.explode(10, b.x, b.y);
        sfx.noise(0.25, 0.1, 500);
        this.vy = Math.sign(this.diverY - b.y || 1) * 260;
        this.loseLife(b.ghost ? 'Hit by a ghostly cannonball' : 'Hit by a cannonball');
        if (this.state !== 'play') return;
        continue;
      }
      this.dodged(b);
    }
  }

  private spawnAnchor() {
    const wx = this.wreckSpot();
    if (wx === null) return false;
    const [t, b] = cave(wx, this.H, this.cv, this.def.shape);
    this.anchors.push({ x: wx, len: (b - t) * this.cr(0.46, 0.58), amp: this.cr(0.4, 0.62), period: this.cr(2.4, 3.2), ph: this.cr(0, TAU) });
    return true;
  }

  /** An anchor's swing angle (0 = hanging straight down), its pivot on the ceiling, and the centre of its crown. */
  private anchorAt(a: Anchor): { ang: number; px: number; py: number; cx: number; cy: number } {
    const ang = a.amp * Math.sin((this.clock / a.period) * TAU + a.ph);
    const px = a.x, py = cave(a.x, this.H, this.cv, this.def.shape)[0] - 4;
    const r = a.len - ANCHOR_R * 0.6;
    return { ang, px, py, cx: px + Math.sin(ang) * r, cy: py + Math.cos(ang) * r };
  }

  /** Anchors swing on their chains: the chain is harmless, the iron anchor isn't. Pass under it, or slip by when it swings away. */
  private anchorCheck(leftEdge: number) {
    this.anchors = this.anchors.filter(a => a.x + a.len > leftEdge);
    for (const a of this.anchors) {
      const { ang, px, py, cx, cy } = this.anchorAt(a);
      // The crown and flukes, plus the shank up to the ring.
      const sx = px + Math.sin(ang) * (a.len - 46), sy = py + Math.cos(ang) * (a.len - 46);
      const gap = Math.min(Math.hypot(this.dist - cx, this.diverY - cy) - ANCHOR_R - DIVER_R * 0.8, this.segGap(sx, sy, cx, cy, 5));
      if (Math.abs(a.x - this.dist) < a.len * 0.7 + 30) a.gap = Math.min(a.gap ?? Infinity, gap);
      if (gap < 0 && this.invuln <= 0 && this.turboT <= 0) {
        this.sparks.explode(8, this.dist, this.diverY);
        sfx.tone(160, 0.25, { type: 'square', vol: 0.05, slideTo: 90 });
        this.vy = Math.sign(this.diverY - cy || 1) * 280;
        this.loseLife('Clonked by an anchor');
        if (this.state !== 'play') return;
      }
      this.dodged(a);
    }
  }

  private spawnVent() {
    const wx = this.wreckSpot();
    if (wx === null) return false;
    const [t, b] = cave(wx, this.H, this.cv, this.def.shape);
    this.vents.push({ x: wx, side: this.plainSide(wx, 0.65), reach: (b - t) * this.cr(0.5, 0.62), ph: this.cr(0, VENT_CYCLE) });
    return true;
  }

  /** How far a vent's steam reaches right now (0 between bursts), and whether it's about to burst. */
  private ventAt(v: Vent): { reach: number; warn: boolean; base: number } {
    const p = (this.clock + v.ph) % VENT_CYCLE, base = cave(v.x, this.H, this.cv, this.def.shape)[v.side];
    const on = p < VENT_ON ? Math.min(1, p / 0.15, (VENT_ON - p) / 0.15) : 0;
    return { reach: v.reach * on, warn: p > VENT_CYCLE - VENT_WARN, base };
  }

  /** Broken boiler pipes gurgle, then blast steam across most of the trench; get to the far side or arrive between bursts. */
  private ventCheck(leftEdge: number) {
    this.vents = this.vents.filter(v => v.x + VENT_W > leftEdge);
    for (const v of this.vents) {
      const { reach, base } = this.ventAt(v), p = (this.clock + v.ph) % VENT_CYCLE;
      const near = Math.abs(v.x - this.dist) < this.W;
      if (p < VENT_ON && !v.hissed) {
        v.hissed = true;
        if (near) sfx.noise(VENT_ON, 0.05, 4200, 0.5);
      } else if (p >= VENT_ON) v.hissed = false;
      const dx = Math.abs(this.dist - v.x) - VENT_W / 2;
      const dy = v.side ? base - reach - this.diverY : this.diverY - (base + reach);
      const gap = reach > 4 ? Math.max(dx, dy) - DIVER_R * 0.7 : Infinity;
      if (Math.abs(v.x - this.dist) < 60 && reach > 4) v.gap = Math.min(v.gap ?? Infinity, gap);
      if (gap < 0 && this.invuln <= 0 && this.turboT <= 0) {
        this.pops.explode(10, this.dist, this.diverY);
        this.vy = (v.side ? -1 : 1) * 260;
        this.loseLife('Scalded by boiler steam');
        if (this.state !== 'play') return;
      }
      this.dodged(v);
    }
  }

  private spawnDeck() {
    const wx = this.wreckSpot();
    if (wx === null) return false;
    const [t, b] = cave(wx, this.H, this.cv, this.def.shape), dir: 1 | -1 = this.rng() < 0.6 ? -1 : 1, len = (b - t) * this.cr(0.5, 0.6);
    // Lying just under the ceiling to start with.
    const drop = cave(wx + dir * len, this.H, this.cv, this.def.shape)[0] - t;
    this.decks.push({ x: wx, len, dir, ang: Math.max(0.04, Math.atan2(drop + 5, len)), vang: 0, shake: 0, falling: false });
    return true;
  }

  /** A deck section's hinge on the ceiling and its free end. */
  private deckAt(k: Deck): [number, number, number, number] {
    const hy = cave(k.x, this.H, this.cv, this.def.shape)[0] - 2;
    return [k.x, hy, k.x + k.dir * Math.cos(k.ang) * k.len, hy + Math.sin(k.ang) * k.len];
  }

  /** Deck sections creak, tear loose as you come near and swing down on their hinge, ending up hanging across the top of the trench. */
  private deckCheck(dt: number, leftEdge: number) {
    this.decks = this.decks.filter(k => k.x + k.len > leftEdge);
    for (const k of this.decks) {
      if (!k.falling && k.shake <= 0) {
        const speed = this.speed * (this.turboT > 0 ? TURBO_SPEED : 1);
        // Timed so it's down (still swaying) by the time you reach the nearest point of its swing.
        if ((k.x - (k.dir < 0 ? k.len : 0) - this.dist) / speed < DECK_LEAD) {
          k.shake = DECK_SHAKE;
          sfx.tone(75, 0.7, { type: 'sawtooth', vol: 0.05, slideTo: 48 });
          sfx.noise(0.3, 0.05, 700, 2);
        }
      }
      if (k.shake > 0 && (k.shake -= dt) <= 0) { k.falling = true; sfx.noise(0.25, 0.08, 1500); }
      if (k.falling) {
        // A heavy pendulum in water: gravity pulls it down past straight, then it settles.
        k.vang += ((DECK_G / k.len) * Math.cos(k.ang) - 2.4 * k.vang) * dt;
        k.ang = Math.min(Math.PI / 2 + 0.55, k.ang + k.vang * dt);
      }
      const [hx, hy, ex, ey] = this.deckAt(k);
      const gap = this.segGap(hx, hy, ex, ey, 6);
      if (Math.abs(k.x - this.dist) < k.len + 30) k.gap = Math.min(k.gap ?? Infinity, gap);
      if (gap < 0 && this.invuln <= 0 && this.turboT <= 0) {
        this.sparks.explode(8, this.dist, this.diverY);
        sfx.noise(0.3, 0.1, 350);
        this.vy = 300;
        this.loseLife('Crushed by a falling deck');
        if (this.state !== 'play') return;
      }
      this.dodged(k);
    }
  }

  /** This dive's treasure, just off-screen and tucked against a plain wall, announced with a glint and a banner. */
  private spawnTreasure() {
    const r = this.treasureDef!;
    this.treasureAt = Infinity;
    const wx = this.dist - this.diverX() + this.W + 60, [t, b] = cave(wx, this.H, this.cv, this.def.shape);
    const y = this.wallY(wx, t, b);
    this.treasure = {
      x: wx, y, ph: 0,
      sprite: this.add.image(wx, y, `tr-${r.id}`).setScale(TEX_SCALE).setDepth(11),
      glow: this.glow(r.glow).setDepth(10.5),
    };
    ui.banner('Rare treasure ahead!', 'Something glints');
    chime([1319, 1760, 2093]);
  }

  private treasureCheck(dt: number, leftEdge: number) {
    const it = this.treasure;
    if (!it) return;
    it.ph += dt;
    const hit = Math.hypot(it.x - this.dist, it.y - this.diverY) < DIVER_R + 16;
    if (hit) this.findTreasure(it);
    if (hit || it.x < leftEdge) { it.sprite.destroy(); it.glow.destroy(); this.treasure = null; }
  }

  /** The big moment: slow motion, a flash and burst in the treasure's colour, its own chime and a banner. */
  private findTreasure(it: TreasureItem) {
    const r = this.treasureDef!, first = treasureLog.add(r.id), n = first ? r.first : r.again, big = !!r.legendary;
    track('treasure', { id: r.id, first, depth: Math.floor(this.dist / 10) });
    this.runTreasures++;
    shells.add(n);
    ui.banner(r.name, big && first ? 'Legendary find!' : first ? 'New treasure!' : 'Found it again!');
    ui.damage(`+${n} Sea Heart${n > 1 ? 's' : ''}! (${shells.count})`, true);
    this.slowT = SLOWMO_TIME * (big ? 1.8 : 1.2);
    this.invuln = Math.max(this.invuln, 1.2);
    this.cameras.main.flash(big ? 700 : 450, r.glow >> 16, (r.glow >> 8) & 255, r.glow & 255);
    const burst = this.add.particles(0, 0, 'star', {
      lifespan: { min: 700, max: 1400 }, speed: { min: 50, max: big ? 300 : 220 }, scale: { start: TEX_SCALE * 1.6, end: 0 },
      rotate: { min: 0, max: 360 }, alpha: { start: 1, end: 0 }, tint: [r.glow, 0xffffff, mixNum(r.glow, 0xffffff, 0.5)], emitting: false,
    }).setDepth(12);
    burst.explode(big ? 56 : first ? 34 : 20, it.x, it.y);
    const ring = this.add.image(it.x, it.y, 'glow').setTint(r.glow).setBlendMode(Phaser.BlendModes.ADD).setDepth(12).setDisplaySize(40, 40);
    this.tweens.add({ targets: ring, displayWidth: big ? 640 : 380, displayHeight: big ? 640 : 380, alpha: 0, duration: big ? 1300 : 900, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    this.time.delayedCall(1600, () => burst.destroy());
    chime(big ? [659, 831, 988, 1245, 1319] : [587, 740, 880, 1175], big || first);
    buzz(big ? [20, 40, 20, 40, 80] : [15, 30, 15]);
  }

  /** Wreckage along the walls: scenery only, muted towards the rock colour so it never reads as a hazard. */
  private drawDecor(g: Phaser.GameObjects.Graphics, x0: number, W: number, H: number, T: number, rock: number) {
    const kind = this.def.decor;
    if (!kind) return;
    const mute = (c: number) => mixNum(c, rock, 0.3), line = (w: number, c: number, pts: Point[]) => {
      g.lineStyle(w + 3.5, OUTLINE, 1); g.strokePoints(pts); g.lineStyle(w, c, 1); g.strokePoints(pts);
    };
    // The walls themselves: planked hull for the pirate ships, riveted steel plates for the liner.
    const seam = mixNum(rock, OUTLINE, 0.4);
    if (kind === 'ship') {
      for (const off of [12, 24]) {
        g.lineStyle(2, seam, 1);
        g.strokePoints(this.topEdge.map(p => ({ x: p.x, y: p.y - off })));
        g.strokePoints(this.botEdge.map(p => ({ x: p.x, y: p.y + off })));
      }
    } else if (kind !== 'liner') {
      this.newWalls(g, rock);
    } else {
      g.fillStyle(mixNum(rock, 0xffffff, 0.28), 1);
      this.topEdge.forEach(p => { if ((Math.round(p.x / 12) & 1) === 0) g.fillCircle(p.x, p.y - 9, 1.6); });
      this.botEdge.forEach(p => { if ((Math.round(p.x / 12) & 1) === 0) g.fillCircle(p.x, p.y + 9, 1.6); });
      g.lineStyle(2, seam, 1);
      for (let sx = Math.ceil((x0 - 20) / 96) * 96; sx < x0 + W + 20; sx += 96) {
        const [t, b] = cave(sx, H, this.cv, this.def.shape);
        g.lineBetween(sx, t - 4, sx, t - 40); g.lineBetween(sx, b + 4, sx, b + 40);
      }
    }
    const SEG = 210;
    for (let k = Math.floor((x0 - 160) / SEG); k * SEG < x0 + W + 160; k++) {
      if (hash(k * 1.7 + 11) < 0.3) continue;
      const side: 0 | 1 = hash(k * 3.1 + 7) < 0.66 ? 1 : 0, wx = k * SEG + hash(k + 2.3) * 80;
      if (this.spiky(wx, side)) continue;
      const base = cave(wx, H, this.cv, this.def.shape)[side], up = side ? -1 : 1, pick = hash(k * 5.3 + 1);
      if (kind === 'ship') this.shipDecor(g, wx, base, up, pick, T, mute, line);
      else if (kind === 'liner') this.linerDecor(g, wx, base, up, pick, mute, line);
      else this.newDecor(g, wx, base, up, pick, T, mute, line);
    }
  }

  private shipDecor(g: Phaser.GameObjects.Graphics, wx: number, base: number, up: number, pick: number, T: number, mute: (c: number) => number, line: (w: number, c: number, pts: Point[]) => void) {
    const wood = mute(0x9a6235), dark = mute(0x6e4224);
    if (up > 0) {
      // Overhead: broken planks hanging from a hull above, or a frayed rope.
      if (pick < 0.55) {
        for (let i = 0; i < 3; i++) {
          const x = wx + i * 13, len = 30 + hash(wx + i) * 26, lean = (hash(wx * 2 + i) - 0.5) * 0.5;
          g.save(); g.translateCanvas(x, base - 4); g.rotateCanvas(lean);
          g.fillStyle(i % 2 ? dark : wood, 1); g.fillRect(-5, 0, 10, len);
          g.lineStyle(2.4, OUTLINE, 1); g.strokeRect(-5, 0, 10, len);
          g.fillStyle(OUTLINE, 1); g.fillTriangle(-5, len, 0, len - 6, 5, len); // splintered end
          g.restore();
        }
      } else {
        const pts: Point[] = [];
        for (let j = 0; j <= 6; j++) pts.push({ x: wx + Math.sin(T * 1.2 + j * 0.7 + wx) * j * 1.2, y: base - 2 + j * 9 });
        line(2.6, mute(0xd8b878), pts);
      }
      return;
    }
    if (pick < 0.3) {
      // Hull ribs poking out of the sand.
      for (let i = 0; i < 4; i++) {
        const x = wx + i * 13, h = 30 + i * 4;
        line(4.5, wood, [{ x, y: base + 4 }, { x: x - 4, y: base - h * 0.6 }, { x: x - 11, y: base - h }]);
      }
    } else if (pick < 0.55) {
      // A broken mast, leaning, with a tattered sail.
      const top = { x: wx + 24, y: base - 78 };
      line(6, wood, [{ x: wx, y: base + 4 }, top]);
      line(3.5, wood, [{ x: wx + 8, y: base - 48 }, { x: wx + 38, y: base - 44 }]);
      const sail = [{ x: wx + 11, y: base - 46 }, { x: wx + 36, y: base - 43 }, { x: wx + 34, y: base - 22 }, { x: wx + 28, y: base - 26 }, { x: wx + 24, y: base - 18 }, { x: wx + 18, y: base - 24 }, { x: wx + 12, y: base - 20 }];
      g.fillStyle(mute(0xefe1c0), 0.9); g.fillPoints(sail, true);
      g.lineStyle(2, OUTLINE, 1); g.strokePoints(sail, true);
    } else if (pick < 0.78) {
      // Barrels, one tipped over.
      for (const [dx, w, h] of [[0, 18, 24], [22, 24, 17]] as const) {
        g.fillStyle(wood, 1); g.fillRoundedRect(wx + dx - w / 2, base - h + 3, w, h, 6);
        g.lineStyle(2.4, OUTLINE, 1); g.strokeRoundedRect(wx + dx - w / 2, base - h + 3, w, h, 6);
        g.lineStyle(2, mute(0x5d6670), 1);
        if (w < h) { g.lineBetween(wx + dx - w / 2 + 1, base - h + 9, wx + dx + w / 2 - 1, base - h + 9); g.lineBetween(wx + dx - w / 2 + 1, base - 3, wx + dx + w / 2 - 1, base - 3); }
        else { g.lineBetween(wx + dx - w / 2 + 6, base - h + 4, wx + dx - w / 2 + 6, base + 2); g.lineBetween(wx + dx + w / 2 - 6, base - h + 4, wx + dx + w / 2 - 6, base + 2); }
      }
    } else {
      // A spill of gold coins.
      const coins = [[0, 0], [9, 1], [18, 0], [5, -6], [14, -6], [10, -12], [24, 2], [-7, 2]];
      for (const [dx, dy] of coins) {
        g.fillStyle(0xf0b81e, 1); g.fillEllipse(wx + dx, base - 4 + dy, 9, 7);
        g.lineStyle(1.8, OUTLINE, 1); g.strokeEllipse(wx + dx, base - 4 + dy, 9, 7);
      }
      g.fillStyle(0xfff3b0, 1); g.fillCircle(wx + 8, base - 17, 1.4 + Math.max(0, Math.sin(T * 3 + wx)) * 1.2);
    }
  }

  private linerDecor(g: Phaser.GameObjects.Graphics, wx: number, base: number, up: number, pick: number, mute: (c: number) => number, line: (w: number, c: number, pts: Point[]) => void) {
    const steel = mute(0x2e3a4a), white = mute(0xc9d3dc);
    if (up > 0 || pick < 0.3) {
      // Deck railing (hanging upside down overhead).
      const y = base + up * 18;
      for (let i = 0; i <= 6; i++) line(2, white, [{ x: wx + i * 12, y: base + up * 2 }, { x: wx + i * 12, y }]);
      line(2.6, white, [{ x: wx - 2, y }, { x: wx + 74, y }]);
      line(2, white, [{ x: wx, y: base + up * 10 }, { x: wx + 72, y: base + up * 10 }]);
      return;
    }
    if (pick < 0.55) {
      // A slab of hull with a row of portholes.
      g.fillStyle(steel, 1); g.fillRoundedRect(wx - 6, base - 26, 92, 32, 5);
      g.lineStyle(2.4, OUTLINE, 1); g.strokeRoundedRect(wx - 6, base - 26, 92, 32, 5);
      for (let i = 0; i < 3; i++) {
        const cx = wx + 10 + i * 28;
        g.fillStyle(mute(0xc9a24d), 1); g.fillCircle(cx, base - 11, 7.5);
        g.fillStyle(0x7fc8e8, 0.55); g.fillCircle(cx, base - 11, 5);
        g.lineStyle(1.8, OUTLINE, 1); g.strokeCircle(cx, base - 11, 7.5);
      }
    } else if (pick < 0.8) {
      // A piece of the grand staircase, with its curled banister.
      const steps: Point[] = [{ x: wx, y: base + 4 }];
      for (let i = 0; i < 5; i++) { steps.push({ x: wx + i * 11, y: base - i * 8 }); steps.push({ x: wx + (i + 1) * 11, y: base - i * 8 }); }
      steps.push({ x: wx + 55, y: base + 4 });
      g.fillStyle(mute(0x7a4e2e), 1); g.fillPoints(steps, true);
      g.lineStyle(2.4, OUTLINE, 1); g.strokePoints(steps, true);
      for (let i = 0; i < 5; i++) line(1.6, white, [{ x: wx + i * 11 + 5, y: base - i * 8 }, { x: wx + i * 11 + 5, y: base - i * 8 - 18 }]);
      line(3.2, mute(0x8a5a32), [{ x: wx - 4, y: base - 16 }, { x: wx + 5, y: base - 19 }, { x: wx + 50, y: base - 54 }]);
      g.lineStyle(2.4, OUTLINE, 1); g.strokeCircle(wx - 5, base - 12, 4);
    } else {
      // A fallen funnel: buff with a black top.
      g.save(); g.translateCanvas(wx + 20, base - 8); g.rotateCanvas(-0.35);
      g.fillStyle(mute(0xd9a04a), 1); g.fillRect(-34, -13, 58, 26);
      g.fillStyle(mute(0x1d1f26), 1); g.fillRect(24, -13, 14, 26);
      g.lineStyle(2.4, OUTLINE, 1); g.strokeRect(-34, -13, 72, 26);
      g.lineStyle(2, OUTLINE, 0.6); g.lineBetween(-10, -13, -10, 13);
      g.restore();
    }
  }

  /** Cannons, cannonballs, anchors, steam and decks, plus their glow in the dark (so they can be seen coming). */
  private drawWreck(g: Phaser.GameObjects.Graphics, x0: number, W: number, T: number, dark: number) {
    const on = (x: number, m = 120) => x > x0 - m && x < x0 + W + m, glow = this.edges, ga = Math.max(0.35, dark);
    for (const c of this.cannons) {
      if (!on(c.x)) continue;
      const [px, py] = this.cannonPivot(c), wall = c.side ? 1 : -1;
      // Carriage on the wall, then the barrel turned towards its aim.
      g.fillStyle(0x7a4a26, 1); g.fillRect(px - 15, c.side ? py - 2 : py - 12, 30, 14);
      g.lineStyle(2.4, OUTLINE, 1); g.strokeRect(px - 15, c.side ? py - 2 : py - 12, 30, 14);
      for (const wxo of [-9, 9]) { g.fillStyle(0x5a3a22, 1); g.fillCircle(px + wxo, py + wall * 10, 5); g.lineStyle(2, OUTLINE, 1); g.strokeCircle(px + wxo, py + wall * 10, 5); }
      const back = -c.kick * 7;
      g.save(); g.translateCanvas(px, py); g.rotateCanvas(c.aim);
      g.fillStyle(0x3b4252, 1); g.fillPoints([{ x: back - 9, y: -8 }, { x: back + 26, y: -5.5 }, { x: back + 26, y: 5.5 }, { x: back - 9, y: 8 }], true);
      g.lineStyle(2.6, OUTLINE, 1); g.strokePoints([{ x: back - 9, y: -8 }, { x: back + 26, y: -5.5 }, { x: back + 26, y: 5.5 }, { x: back - 9, y: 8 }], true);
      g.fillStyle(0x4c5568, 1); g.fillRect(back + 22, -7.5, 6, 15); g.lineStyle(2, OUTLINE, 1); g.strokeRect(back + 22, -7.5, 6, 15);
      g.fillStyle(0x3b4252, 1); g.fillCircle(back - 11, 0, 4); g.lineStyle(2, OUTLINE, 1); g.strokeCircle(back - 11, 0, 4);
      g.fillStyle(0x8a95a8, 1); g.fillRect(back - 4, -6, 22, 2.4);
      g.restore();
      if (c.fuse > 0) {
        const fx = px + Math.cos(c.aim) * -13, fy = py + Math.sin(c.aim) * -13, f = 2 + Math.random() * 2.5;
        g.fillStyle(0xffd23f, 1); g.fillCircle(fx, fy, f); g.fillStyle(0xffffff, 1); g.fillCircle(fx, fy, f * 0.45);
        glow.fillStyle(0xff9f43, 0.6 * ga); glow.fillCircle(fx, fy, 9 + Math.random() * 4);
      }
    }
    for (const b of this.balls) {
      if (!on(b.x)) continue;
      const len = Math.hypot(b.vx, b.vy) || 1;
      for (let i = 3; i >= 1; i--) { g.fillStyle(0xc9d2dc, 0.18 * (4 - i)); g.fillCircle(b.x - (b.vx / len) * i * 10, b.y - (b.vy / len) * i * 10, 5 + i); }
      if (b.ghost) {
        // A ghostly ball: pale green light with a dark core.
        glow.fillStyle(0x8fffc8, 0.35); glow.fillCircle(b.x, b.y, BALL_R + 6);
        g.fillStyle(0x1f4a3c, 1); g.fillCircle(b.x, b.y, BALL_R);
        g.lineStyle(2.6, 0x8fffc8, 1); g.strokeCircle(b.x, b.y, BALL_R);
        continue;
      }
      g.fillStyle(0x2b2f38, 1); g.fillCircle(b.x, b.y, BALL_R);
      g.lineStyle(2.6, OUTLINE, 1); g.strokeCircle(b.x, b.y, BALL_R);
      g.fillStyle(0x8a95a8, 1); g.fillCircle(b.x - 3, b.y - 3, 2.4);
      glow.lineStyle(5, 0xffa64d, 0.45 * ga); glow.strokeCircle(b.x, b.y, BALL_R + 3);
    }
    for (const a of this.anchors) {
      if (!on(a.x, a.len)) continue;
      const { ang, px, py, cx, cy } = this.anchorAt(a), L = a.len;
      // A beam stuck in the ceiling to hang from.
      g.fillStyle(0x6e4224, 1); g.fillRect(px - 20, py - 6, 40, 9); g.lineStyle(2.4, OUTLINE, 1); g.strokeRect(px - 20, py - 6, 40, 9);
      g.save(); g.translateCanvas(px, py); g.rotateCanvas(-ang);
      for (let y = 4; y < L - 50; y += 9) {
        g.lineStyle(2, OUTLINE, 1); g.fillStyle(0x9aa8b8, 1);
        if ((y / 9) & 1) { g.fillRect(-1.5, y - 4, 3, 9); g.strokeRect(-1.5, y - 4, 3, 9); }
        else { g.fillEllipse(0, y, 6, 10); g.strokeEllipse(0, y, 6, 10); }
      }
      const iron = 0x5d6b7a, ring = L - 50;
      g.lineStyle(7, OUTLINE, 1); g.strokeCircle(0, ring, 5.5); g.lineStyle(3.5, iron, 1); g.strokeCircle(0, ring, 5.5);
      g.lineStyle(11, OUTLINE, 1); g.lineBetween(0, ring + 5, 0, L); g.lineStyle(6.5, iron, 1); g.lineBetween(0, ring + 5, 0, L);
      g.fillStyle(iron, 1); g.fillRect(-15, ring + 9, 30, 6); g.lineStyle(2.4, OUTLINE, 1); g.strokeRect(-15, ring + 9, 30, 6);
      g.lineStyle(11, OUTLINE, 1); g.beginPath(); g.arc(0, L - 20, 19, 0.2, Math.PI - 0.2); g.strokePath();
      g.lineStyle(6.5, iron, 1); g.beginPath(); g.arc(0, L - 20, 19, 0.2, Math.PI - 0.2); g.strokePath();
      for (const s of [-1, 1]) {
        const fx = s * 19 * Math.cos(0.2), fy = L - 20 + 19 * Math.sin(0.2), fl = [{ x: fx - s * 6, y: fy + 2 }, { x: fx + s * 4, y: fy - 11 }, { x: fx + s * 5, y: fy + 4 }];
        g.fillStyle(iron, 1); g.fillPoints(fl, true); g.lineStyle(2.4, OUTLINE, 1); g.strokePoints(fl, true);
      }
      g.lineStyle(2, 0xb7c3cf, 1); g.lineBetween(-2, ring + 18, -2, L - 6);
      g.restore();
      glow.lineStyle(6, 0x9fd0ff, 0.28 * dark); glow.strokeCircle(cx, cy, ANCHOR_R + 2);
    }
    for (const v of this.vents) {
      if (!on(v.x)) continue;
      const { reach, warn, base } = this.ventAt(v), d = v.side ? -1 : 1;
      // The broken pipe: a stub with a flange.
      g.fillStyle(0x6b5d55, 1); g.fillRect(v.x - 9, d > 0 ? base - 6 : base - 10, 18, 16);
      g.lineStyle(2.4, OUTLINE, 1); g.strokeRect(v.x - 9, d > 0 ? base - 6 : base - 10, 18, 16);
      g.fillStyle(0x8a7a70, 1); g.fillRect(v.x - 13, base + d * 9 - 3, 26, 6); g.lineStyle(2.2, OUTLINE, 1); g.strokeRect(v.x - 13, base + d * 9 - 3, 26, 6);
      const mouth = base + d * 12;
      if (warn) {
        glow.fillStyle(0xff7a3c, 0.5 * ga * (0.6 + Math.sin(T * 30) * 0.4)); glow.fillCircle(v.x, mouth, 9);
        for (let i = 0; i < 3; i++) {
          const k = (T * 2.2 + i / 3) % 1;
          g.fillStyle(0xe8eef5, 0.6 * (1 - k)); g.fillCircle(v.x + Math.sin(T * 7 + i) * 4, mouth + d * k * 26, 3 + k * 3);
        }
      }
      if (reach > 4) {
        const n = Math.max(2, Math.ceil(reach / 14));
        for (const pass of [0, 1]) {
          for (let i = 0; i <= n; i++) {
            const f = i / n, y = mouth + d * (reach - 12) * f, r = 11 + f * 7 + Math.sin(T * 13 + i * 1.7) * 2;
            const x = v.x + Math.sin(T * 9 + i) * 3;
            if (pass) { g.fillStyle(i % 2 ? 0xf6f9ff : 0xe3ebf4, 0.95); g.fillCircle(x, y, r); }
            else { g.fillStyle(OUTLINE, 0.7); g.fillCircle(x, y, r + 2.2); }
          }
        }
        glow.lineStyle(VENT_W, 0xe6f2ff, 0.18 * ga); glow.lineBetween(v.x, mouth, v.x, mouth + d * reach);
      }
    }
    for (const k of this.decks) {
      if (!on(k.x, k.len)) continue;
      const [hx, hy, ex, ey] = this.deckAt(k), jit = k.shake > 0 ? Math.sin(T * 60) * 1.5 : 0;
      g.save(); g.translateCanvas(hx, hy + jit); g.rotateCanvas(Math.atan2(ey - hy, ex - hx));
      const L = k.len;
      g.fillStyle(0x6f8496, 1); g.fillRect(0, -6, L, 12);
      g.lineStyle(2.6, OUTLINE, 1); g.strokeRect(0, -6, L, 12);
      g.fillStyle(0x8c6a4a, 1); g.fillRect(2, -6, L - 4, 4); // the wooden deck boards on top
      g.fillStyle(0x2e3a4a, 1);
      for (let x = 8; x < L - 4; x += 14) g.fillCircle(x, 2.5, 1.5);
      g.lineStyle(1.8, 0xc9d3dc, 1);
      for (let x = 6; x < L; x += 16) g.lineBetween(x, -6, x, -16);
      g.lineStyle(2.4, 0xc9d3dc, 1); g.lineBetween(2, -16, L - 2, -16);
      g.fillStyle(0x2e3a4a, 1); g.fillCircle(0, 0, 5); g.lineStyle(2, OUTLINE, 1); g.strokeCircle(0, 0, 5);
      g.restore();
      glow.lineStyle(7, 0xffd2a0, 0.24 * dark); glow.lineBetween(hx, hy, ex, ey);
    }
    // The treasure: a big glow above the darkness, pulsing, so it can be spotted from far away.
    const it = this.treasure;
    if (it) {
      const y = it.y + Math.sin(it.ph * 2.5) * 4;
      it.sprite.setPosition(it.x, y).setRotation(Math.sin(it.ph * 1.8) * 0.12).setScale(TEX_SCALE * (1 + Math.sin(it.ph * 4) * 0.06));
      it.glow.setPosition(it.x, y).setDisplaySize(130, 130).setAlpha(0.6 + Math.sin(it.ph * 4) * 0.25);
    }
  }

  // ---------- Riptide Canyon currents, Sunken City gates and spears, the Pirate Shipwreck's ghost-ship broadside

  private nextCurrent = Infinity;
  private currents: Current[] = [];
  private inCurrent: Current | null = null;  // the current you're in (for its whoosh)
  private nextGate = Infinity;
  private gates: Gate[] = [];
  private nextSpear = Infinity;
  private spears: Spear[] = [];
  private broadsideAt = Infinity;            // world x where this dive's ghost ship turns up (Infinity: not this dive)
  private ghost: Ghost | null = null;

  /** A new dive: first currents, gates and spears, and where the ghost ship comes (all from the course's streams). */
  private resetSetPieces() {
    const d = this.def, s = this.streams, first = (h: { from: number } | undefined, r: () => number) => (h ? h.from * 10 + this.withRng(r, () => this.cr(200, 500)) : Infinity);
    this.nextCurrent = first(d.currents, s.current);
    this.nextGate = first(d.gates, s.wreck);
    this.nextSpear = first(d.spears, s.wreck);
    const b = d.broadside;
    this.broadsideAt = b ? this.withRng(s.wreck, () => this.cr(b.from, b.to)) * 10 : Infinity;
  }

  private clearSetPieces() {
    this.currents = []; this.gates = []; this.spears = []; this.ghost = null; this.inCurrent = null;
  }

  /** Gates and spears share the wreck hazards' spacing and stream (see `wreckCheck`). */
  private setPieceDue(due: { timer: number; run: () => void }[], step: number) {
    const d = this.def;
    if (d.gates && (this.nextGate -= step) <= 0) due.push({ timer: this.nextGate, run: () => { this.nextGate = (this.spawnGate() ? this.cr(...d.gates!.gap) : 200) - this.lag; } });
    if (d.spears && (this.nextSpear -= step) <= 0) due.push({ timer: this.nextSpear, run: () => { this.nextSpear = (this.spawnSpear() ? this.cr(...d.spears!.gap) : 200) - this.lag; } });
  }

  /** Currents (their own stream), gates, spears and the ghost ship; any of them but the currents can end the dive. */
  private setPieceCheck(dt: number, leftEdge: number, step: number) {
    const c = this.def.currents;
    if (c && (this.nextCurrent -= step) <= 0) {
      this.lag = this.daily ? -this.nextCurrent : 0;
      this.withRng(this.streams.current, () => { this.spawnCurrent(c); this.nextCurrent = this.cr(...c.gap) - this.lag; });
    }
    this.currents = this.currents.filter(k => k.x1 > leftEdge);
    const now = this.currents.find(k => this.dist > k.x0 && this.dist < k.x1) ?? null;
    if (now && now !== this.inCurrent && this.turboT <= 0) sfx.noise(0.7, 0.05, 1300, 0.6);
    this.inCurrent = now;
    if (this.dist > this.broadsideAt) this.startBroadside();
    if (this.ghost) this.broadside(dt);
    if (this.state === 'play') this.gateCheck(leftEdge);
    if (this.state === 'play') this.spearCheck(leftEdge);
  }

  // Currents

  /** A stretch of current just off-screen, with a row of pearls along the path it carries you if you let go. */
  private spawnCurrent(c: NonNullable<CaveDef['currents']>) {
    const x0 = this.dist - this.diverX() + this.W + 80 - this.lag, len = this.cr(...c.len), dir: 1 | -1 = this.rng() < 0.5 ? 1 : -1;
    const push = c.push * (0.8 + 0.4 * Math.min(1, this.dist / 9000));
    const k: Current = { x0, x1: x0 + len, dir, push };
    this.currents.push(k);
    // Drifting from rest under a steady push with the water's drag (2.6): y = (a/k)t - (a/k²)(1 - e^-kt).
    const a = dir * STEER * push, drag = 2.6, speed = this.speed;
    const [t0, b0] = cave(x0, this.H, this.cv, this.def.shape), y0 = (t0 + b0) / 2 - dir * (b0 - t0) * 0.22;
    for (let i = 0; i < 7; i++) {
      const x = x0 + 60 + (i * (len - 80)) / 6, t = (x - x0) / speed;
      const [tt, bb] = cave(x, this.H, this.cv, this.def.shape);
      const y = clamp(y0 + (a / drag) * t - (a / (drag * drag)) * (1 - Math.exp(-drag * t)), tt + 34, bb - 34);
      this.items.push({
        type: 'pearl', x, y, ph: rand(0, TAU),
        sprite: this.add.image(x, y, PICKUP_TEX.pearl).setScale(TEX_SCALE).setDepth(11),
        glow: this.glow(PICKUP_GLOW.pearl).setDepth(10.5),
      });
    }
  }

  /** How hard the water pushes you at world x (px/s², + is down), easing in and out at each end of a current. */
  private currentAt(x: number) {
    for (const k of this.currents) {
      if (x <= k.x0 || x >= k.x1) continue;
      return k.dir * k.push * STEER * Math.min(1, (x - k.x0) / CURRENT_EASE, (k.x1 - x) / CURRENT_EASE);
    }
    return 0;
  }

  /** The push on the diver this frame: Turbo cuts straight through, and it fades near the wall it pushes towards, so it never pins you. */
  private currentPush() {
    if (this.turboT > 0 || !this.currents.length) return 0;
    const a = this.currentAt(this.dist);
    if (!a) return 0;
    const [t, b] = cave(this.dist, this.H, this.cv, this.def.shape), room = a > 0 ? b - this.diverY : this.diverY - t;
    return a * clamp((room - DIVER_R - 18) / 60, 0, 1);
  }

  // Gates

  private spawnGate() {
    const wx = this.wreckSpot();
    if (wx === null) return false;
    const depth = this.dist / 10;
    const options = depth < 250 ? GATE_PATTERNS.slice(0, 1) : depth < 600 ? GATE_PATTERNS.slice(0, 3) : GATE_PATTERNS;
    const p = this.cpick(options);
    this.gates.push({ x: wx, pat: p.pat, per: p.per, ph: Math.floor(this.rng() * 4), slot: -1 });
    return true;
  }

  /** Beats into the cave's song, by the music's own clock when it's playing (so what you see matches what you hear). */
  private beatNow() {
    return music.beat(this.def.song) ?? (this.clock * this.def.song.bpm) / 60;
  }

  /** A gate's doorway right now: its top and bottom, which slot it's in, and the slot it moves to next. */
  private gateAt(g: Gate, beat: number) {
    const [t, b] = cave(g.x, this.H, this.cv, this.def.shape), n = g.pat.length;
    const pos = (beat + g.ph) / g.per, i = Math.floor(pos), f = (pos - i) * g.per; // beats into this slot
    const from = g.pat[(((i - 1) % n) + n) % n], to = g.pat[((i % n) + n) % n];
    const slide = Math.min(1, f / GATE_SLIDE), e = slide * slide * (3 - 2 * slide);
    const h = clamp((b - t) * 0.34, 96, 128), cy = t + (b - t) * lerp(from, to, e);
    return { top: cy - h / 2, bot: cy + h / 2, slot: i, next: g.pat[(((i + 1) % n) + n) % n], t, b };
  }

  /** Walk through the doorway: it jumps to its next height on the beat, so line up with where it will be. */
  private gateCheck(leftEdge: number) {
    this.gates = this.gates.filter(g => g.x + GATE_W > leftEdge);
    const beat = this.beatNow();
    for (const g of this.gates) {
      const d = this.gateAt(g, beat);
      if (d.slot !== g.slot) {
        if (g.slot !== -1 && g.x - this.dist > -60 && g.x - this.dist < this.W) sfx.noise(0.16, 0.05, 240, 1.5);
        g.slot = d.slot;
      }
      if (Math.abs(this.dist - g.x) > GATE_W / 2 + DIVER_R * 0.8) { this.dodged(g); continue; }
      const r = DIVER_R * 0.8, room = Math.min(this.diverY - r - d.top, d.bot - (this.diverY + r));
      g.gap = Math.min(g.gap ?? Infinity, room);
      if (room < 0 && this.invuln <= 0 && this.turboT <= 0) {
        this.sparks.explode(8, this.dist, this.diverY);
        sfx.noise(0.3, 0.1, 300);
        this.vy = Math.sign((d.top + d.bot) / 2 - this.diverY || 1) * 280;
        this.loseLife('Crushed by a temple gate');
        if (this.state !== 'play') return;
      }
    }
  }

  // Spears

  private spawnSpear() {
    const wx = this.wreckSpot();
    if (wx === null) return false;
    const [t, b] = cave(wx, this.H, this.cv, this.def.shape);
    this.spears.push({ x: wx, side: this.plainSide(wx, 0.5), reach: (b - t) * this.cr(0.46, 0.58), ph: Math.floor(this.rng() * 4) });
    return true;
  }

  /** A spear's reach right now (0 when it's drawn back), whether its statue's eyes are glowing (the beat before), and its base. */
  private spearAt(sp: Spear, beat: number) {
    const p = (((beat + sp.ph) % 4) + 4) % 4; // thrusts on the 4th beat of every bar
    const out = p >= 3 ? Math.min(1, (p - 3) / 0.12, (3.7 - p) / 0.2) : 0;
    const base = cave(sp.x, this.H, this.cv, this.def.shape)[sp.side] + (sp.side ? -30 : 30);
    return { reach: sp.reach * Math.max(0, out), warn: p >= 2 && p < 3, base };
  }

  private spearCheck(leftEdge: number) {
    this.spears = this.spears.filter(sp => sp.x + 40 > leftEdge);
    const beat = this.beatNow();
    for (const sp of this.spears) {
      const { reach, base } = this.spearAt(sp, beat), d = sp.side ? -1 : 1;
      if (reach > 4 && !sp.thrust) { sp.thrust = true; if (Math.abs(sp.x - this.dist) < this.W) sfx.noise(0.18, 0.05, 2600, 0.8); }
      else if (reach <= 4) sp.thrust = false;
      const gap = reach > 4 ? this.segGap(sp.x, base, sp.x, base + d * reach, 6) : Infinity;
      if (Math.abs(sp.x - this.dist) < 60 && reach > 4) sp.gap = Math.min(sp.gap ?? Infinity, gap);
      if (gap < 0 && this.invuln <= 0 && this.turboT <= 0) {
        this.sparks.explode(8, this.dist, this.diverY);
        sfx.tone(300, 0.2, { type: 'square', vol: 0.05, slideTo: 140 });
        this.vy = (sp.side ? -1 : 1) * 260; // away from the statue
        this.loseLife("Poked by a statue's spear");
        if (this.state !== 'play') return;
      }
      this.dodged(sp);
    }
  }

  // The ghost ship

  private startBroadside() {
    this.broadsideAt = Infinity;
    this.ghost = { t: 0, shots: 0 };
    this.calmUntil = Math.max(this.calmUntil, this.dist / 10 + 90); // fewer creatures while it fires
    ui.banner('Ghost ship!', 'Broadside');
    for (const [f, d] of [[110, 0], [138.6, 0.05], [164.8, 0.1]] as const) sfx.tone(f, 1.8, { type: 'sawtooth', vol: 0.035, slideTo: f * 0.94, delay: d });
    buzz([20, 40, 20]);
  }

  /** The ghost ship's keel, sailing just under the ceiling a little ahead of you. */
  private ghostAt(): [number, number] {
    const cx = this.dist + GHOST_AHEAD;
    let top = -Infinity;
    for (let x = cx - 120; x <= cx + 120; x += 40) top = Math.max(top, cave(x, this.H, this.cv, this.def.shape)[0]);
    // Low enough that its masts stay on screen; it's a ghost, so it can sail through rock and water alike.
    return [cx, Math.max(top + 46, GHOST_MAST + 14) + Math.sin(this.clock * 1.3) * 4];
  }

  /** Fade in, fire six shots from the bow back to the stern, fade out, and leave its hold of pearls behind. */
  private broadside(dt: number) {
    const gh = this.ghost!;
    gh.t += dt;
    const fire = GHOST_FIRST + gh.shots * GHOST_EVERY;
    if (gh.shots < GHOST_SHOTS && gh.t >= fire) {
      const [cx, keel] = this.ghostAt(), px = cx + 84 - gh.shots * 34, py = keel + 4;
      const dx = this.dist - px, dy = this.diverY - py, len = Math.hypot(dx, dy) || 1;
      this.balls.push({ x: px, y: py, vx: (dx / len) * GHOST_CLOSE, vy: (dy / len) * GHOST_CLOSE, ghost: true });
      this.pops.explode(6, px, py);
      sfx.noise(0.35, 0.1, 260, 0.8);
      sfx.tone(220, 0.4, { type: 'triangle', vol: 0.04, slideTo: 150 });
      gh.shots++;
    }
    if (gh.t > GHOST_FIRST + GHOST_SHOTS * GHOST_EVERY + 1.6) {
      this.ghost = null;
      this.spawnRow('pearl', 10, 26);
      ui.damage('The ghost ship spills its hold!', true);
      sfx.tone(523, 0.18, { vol: 0.06 }); sfx.tone(659, 0.3, { vol: 0.06, delay: 0.1 });
    }
  }

  // Drawing

  /** Currents, gates, spears and the ghost ship, with glows so they read in the dark. */
  private drawSetPieces(g: Phaser.GameObjects.Graphics, x0: number, W: number, T: number, dark: number) {
    const H = this.H, glow = this.edges, ga = Math.max(0.35, dark), on = (a: number, b: number) => b > x0 - 60 && a < x0 + W + 60;
    for (const k of this.currents) {
      if (!on(k.x0, k.x1)) continue;
      // A faint wash of lighter water over the whole current, streaks of sand racing along it, and chevrons pointing the way it pushes.
      for (let x = Math.max(k.x0, x0 - 40); x < Math.min(k.x1, x0 + W + 40); x += 24) {
        const [t, b] = cave(x, H, this.cv, this.def.shape), ease = Math.min(1, (x - k.x0) / CURRENT_EASE, (k.x1 - x) / CURRENT_EASE);
        g.fillStyle(0xdffbff, 0.1 * ease); g.fillRect(x, t, 24, b - t);
      }
      for (let i = 0; i < (k.x1 - k.x0) / 18; i++) {
        const x = k.x0 + hash(i * 3.7 + k.x0) * (k.x1 - k.x0), [t, b] = cave(x, H, this.cv, this.def.shape);
        const ease = Math.min(1, (x - k.x0) / CURRENT_EASE, (k.x1 - x) / CURRENT_EASE);
        const f = (((hash(i * 9.1 + k.x0) + (T * 0.9 * k.dir) * (0.6 + hash(i) * 0.5)) % 1) + 1) % 1, y = t + 14 + f * (b - t - 28);
        g.lineStyle(2.6, 0xffffff, 0.55 * ease); g.lineBetween(x, y, x - 4, y - k.dir * 24);
        g.fillStyle(0xf6dfb0, 0.7 * ease); g.fillCircle(x + 4, y - k.dir * 8, 1.4);
        if (dark > 0.25) { glow.lineStyle(3, 0x9fefff, 0.22 * dark * ease); glow.lineBetween(x, y, x - 3, y - k.dir * 18); }
      }
      for (let x = k.x0 + 70; x < k.x1 - 50; x += 120) {
        const [t, b] = cave(x, H, this.cv, this.def.shape), y = (t + b) / 2 + Math.sin(T * 3 + x) * 6 + k.dir * ((T * 40) % 30);
        const v = [{ x: x - 12, y: y - k.dir * 8 }, { x, y: y + k.dir * 6 }, { x: x + 12, y: y - k.dir * 8 }];
        g.lineStyle(7, OUTLINE, 0.4); g.strokePoints(v);
        g.lineStyle(4, 0xffffff, 0.85); g.strokePoints(v);
      }
    }
    const beat = this.beatNow();
    for (const gt of this.gates) {
      if (!on(gt.x - GATE_W, gt.x + GATE_W)) continue;
      const d = this.gateAt(gt, beat), pulse = 1 - ((beat % 1) + 1) % 1;
      // Two stone slabs with a carved band, leaving the doorway between them.
      for (const [a, b] of [[d.t - 30, d.top], [d.bot, d.b + 30]]) {
        if (b - a < 2) continue;
        g.fillStyle(0xd9cfb4, 1); g.fillRect(gt.x - GATE_W / 2, a, GATE_W, b - a);
        g.lineStyle(2.6, OUTLINE, 1); g.strokeRect(gt.x - GATE_W / 2, a, GATE_W, b - a);
        g.lineStyle(2, 0xa8977a, 1);
        for (let y = a + 16; y < b - 6; y += 22) g.lineBetween(gt.x - GATE_W / 2 + 4, y, gt.x + GATE_W / 2 - 4, y);
      }
      // The doorway's edges glow sea-green, brightest on the beat; small marks show where it goes next.
      g.fillStyle(0x7fffd4, 0.14 + pulse * 0.1); g.fillRect(gt.x - GATE_W / 2 - 6, d.top, GATE_W + 12, d.bot - d.top);
      g.fillStyle(0x7fffd4, 0.5 + pulse * 0.4); g.fillRect(gt.x - GATE_W / 2, d.top - 5, GATE_W, 5); g.fillRect(gt.x - GATE_W / 2, d.bot, GATE_W, 5);
      const ny = d.t + (d.b - d.t) * d.next;
      g.fillStyle(0x7fffd4, 0.35); g.fillTriangle(gt.x - GATE_W / 2 - 12, ny - 6, gt.x - GATE_W / 2 - 4, ny, gt.x - GATE_W / 2 - 12, ny + 6);
      glow.lineStyle(6, 0x7fffd4, (0.25 + pulse * 0.35) * ga);
      glow.lineBetween(gt.x - GATE_W / 2, d.top - 2, gt.x + GATE_W / 2, d.top - 2); glow.lineBetween(gt.x - GATE_W / 2, d.bot + 2, gt.x + GATE_W / 2, d.bot + 2);
      if (dark > 0.25) { glow.lineStyle(3, 0xe8dcc0, 0.25 * dark); glow.strokeRect(gt.x - GATE_W / 2, d.t, GATE_W, d.top - d.t); glow.strokeRect(gt.x - GATE_W / 2, d.bot, GATE_W, d.b - d.bot); }
    }
    for (const sp of this.spears) {
      if (!on(sp.x - 30, sp.x + 30)) continue;
      const { reach, warn, base } = this.spearAt(sp, beat), d = sp.side ? -1 : 1, wall = base - d * 30;
      // The spear first (behind the statue), then a little statue head and shoulders on the wall.
      if (reach > 4) {
        const tip = base + d * reach;
        g.lineStyle(9, OUTLINE, 1); g.lineBetween(sp.x, base, sp.x, tip);
        g.lineStyle(5, 0xc9a36a, 1); g.lineBetween(sp.x, base, sp.x, tip);
        const prong = [{ x: sp.x - 10, y: tip - d * 14 }, { x: sp.x - 10, y: tip - d * 3 }, { x: sp.x, y: tip + d * 10 }, { x: sp.x + 10, y: tip - d * 3 }, { x: sp.x + 10, y: tip - d * 14 }];
        g.lineStyle(8, OUTLINE, 1); g.strokePoints(prong); g.lineStyle(4, 0xffd23f, 1); g.strokePoints(prong);
        g.lineStyle(8, OUTLINE, 1); g.lineBetween(sp.x, tip - d * 4, sp.x, tip + d * 10); g.lineStyle(4, 0xffd23f, 1); g.lineBetween(sp.x, tip - d * 4, sp.x, tip + d * 10);
        glow.lineStyle(5, 0xffe27a, 0.3 * ga); glow.lineBetween(sp.x, base, sp.x, tip);
      }
      // A stone bust on a plinth: shoulders, a helmeted head, eyes that glow the beat before it strikes.
      const plinth = [{ x: sp.x - 20, y: wall + d * 2 }, { x: sp.x - 20, y: wall - d * 6 }, { x: sp.x + 20, y: wall - d * 6 }, { x: sp.x + 20, y: wall + d * 2 }];
      const body = [{ x: sp.x - 18, y: wall }, { x: sp.x - 13, y: wall + d * 14 }, { x: sp.x + 13, y: wall + d * 14 }, { x: sp.x + 18, y: wall }];
      g.fillStyle(0xbfb08f, 1); g.fillPoints(plinth, true); g.lineStyle(2.4, OUTLINE, 1); g.strokePoints(plinth, true);
      g.fillStyle(0xd9cfb4, 1); g.fillPoints(body, true); g.lineStyle(2.6, OUTLINE, 1); g.strokePoints(body, true);
      const hy = wall + d * 25;
      g.fillStyle(0xd9cfb4, 1); g.fillCircle(sp.x, hy, 11); g.lineStyle(2.6, OUTLINE, 1); g.strokeCircle(sp.x, hy, 11);
      g.lineStyle(4, OUTLINE, 1); g.lineBetween(sp.x - 11, hy + d * 3, sp.x + 11, hy + d * 3);
      g.lineStyle(2, 0xa8977a, 1); g.lineBetween(sp.x - 10, hy + d * 3, sp.x + 10, hy + d * 3);
      const eye = warn ? 0x7fffd4 : 0x6e6250;
      g.fillStyle(eye, 1); g.fillCircle(sp.x - 4, hy - d * 1, 2.2); g.fillCircle(sp.x + 4, hy - d * 1, 2.2);
      if (warn) { glow.fillStyle(0x7fffd4, 0.55 * ga); glow.fillCircle(sp.x - 4, hy - d, 7); glow.fillCircle(sp.x + 4, hy - d, 7); }
      else if (dark > 0.25) { glow.lineStyle(3, 0xe8dcc0, 0.25 * dark); glow.strokeCircle(sp.x, hy, 12); }
    }
    const gh = this.ghost;
    if (gh) {
      // A see-through galleon, drawn in light (additive) so it glows even in the dark.
      const end = GHOST_FIRST + GHOST_SHOTS * GHOST_EVERY + 1.6, a = Math.min(1, gh.t / 1, (end - gh.t) / 1) * (0.75 + Math.sin(T * 5) * 0.08);
      const [cx, keel] = this.ghostAt(), col = 0x8fffc8;
      const hull = [{ x: cx - 128, y: keel - 36 }, { x: cx + 136, y: keel - 42 }, { x: cx + 108, y: keel - 6 }, { x: cx + 60, y: keel + 4 }, { x: cx - 100, y: keel }, { x: cx - 126, y: keel - 16 }];
      glow.fillStyle(col, 0.16 * a); glow.fillPoints(hull, true);
      glow.lineStyle(3, col, 0.7 * a); glow.strokePoints(hull, true);
      glow.lineStyle(2, col, 0.4 * a); glow.lineBetween(cx - 122, keel - 24, cx + 122, keel - 28);
      for (const mx of [-60, 30]) {
        glow.lineStyle(3, col, 0.55 * a); glow.lineBetween(cx + mx, keel - 38, cx + mx, keel - GHOST_MAST);
        const sail = [{ x: cx + mx - 30, y: keel - GHOST_MAST + 8 }, { x: cx + mx + 30, y: keel - GHOST_MAST + 8 }, { x: cx + mx + 26, y: keel - 48 }, { x: cx + mx + 10, y: keel - 56 }, { x: cx + mx, y: keel - 46 }, { x: cx + mx - 12, y: keel - 55 }, { x: cx + mx - 26, y: keel - 48 }];
        glow.fillStyle(col, 0.1 * a); glow.fillPoints(sail, true);
        glow.lineStyle(2, col, 0.45 * a); glow.strokePoints(sail, true);
      }
      for (let i = 0; i < GHOST_SHOTS; i++) {
        const px = cx + 84 - i * 34, lit = i === gh.shots && gh.t > GHOST_FIRST + i * GHOST_EVERY - 0.45;
        glow.fillStyle(lit ? 0xffffff : col, (lit ? 0.9 : 0.45) * a); glow.fillCircle(px, keel - 12, lit ? 6 + Math.random() * 2 : 4);
      }
    }
  }

  /** Scenery for the new caves: banded sandstone, sea fans and starfish; mosaics, columns, statues and arches. */
  private newDecor(g: Phaser.GameObjects.Graphics, wx: number, base: number, up: number, pick: number, T: number, mute: (c: number) => number, line: (w: number, c: number, pts: Point[]) => void) {
    if (this.def.decor === 'canyon') {
      if (up > 0) {
        if (pick < 0.5) for (let i = 0; i < 3; i++) line(3, mute(0xd08a52), [{ x: wx + i * 10, y: base - 2 }, { x: wx + i * 10 + 2, y: base + 12 + hash(wx + i) * 14 }]);
        return;
      }
      if (pick < 0.35) {
        // A purple sea fan.
        const fan = [{ x: wx, y: base + 3 }];
        for (let i = 0; i <= 6; i++) { const a = -Math.PI * (0.15 + 0.7 * (i / 6)); fan.push({ x: wx + Math.cos(a) * 26, y: base - 4 + Math.sin(a) * 30 + Math.sin(T * 1.5 + i) }); }
        g.fillStyle(mute(0xb07cff), 0.9); g.fillPoints(fan, true); g.lineStyle(2.2, OUTLINE, 1); g.strokePoints(fan, true);
        g.lineStyle(1.2, mute(0x7a4ccf), 1);
        for (let i = 1; i < fan.length; i += 2) g.lineBetween(wx, base + 2, fan[i].x, fan[i].y);
      } else if (pick < 0.65) {
        // A starfish.
        const pts: Point[] = [];
        for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 4 : 10; pts.push({ x: wx + Math.cos(a) * r, y: base - 7 + Math.sin(a) * r }); }
        g.fillStyle(0xff8a5c, 1); g.fillPoints(pts, true); g.lineStyle(2, OUTLINE, 1); g.strokePoints(pts, true);
      } else {
        // Spiral shells.
        for (const [dx, r] of [[0, 7], [16, 5]] as const) {
          g.fillStyle(mute(0xf3d3b0), 1); g.fillCircle(wx + dx, base - r + 2, r); g.lineStyle(2, OUTLINE, 1); g.strokeCircle(wx + dx, base - r + 2, r);
          g.lineStyle(1.4, mute(0xb07a52), 1); g.beginPath(); g.arc(wx + dx, base - r + 2, r * 0.55, 0, Math.PI * 1.5); g.strokePath();
        }
      }
      return;
    }
    const stone = mute(0xe2d7bd), dark = mute(0xa89470);
    if (up > 0) {
      // A broken arch overhead.
      g.lineStyle(14, OUTLINE, 1); g.beginPath(); g.arc(wx + 30, base - 6, 30, 0.1, Math.PI - 0.1); g.strokePath();
      g.lineStyle(10, stone, 1); g.beginPath(); g.arc(wx + 30, base - 6, 30, 0.1, Math.PI - 0.1); g.strokePath();
      return;
    }
    if (pick < 0.4) {
      // A standing column with a capital.
      const h = 46 + pick * 40;
      g.fillStyle(stone, 1); g.fillRect(wx - 8, base - h, 16, h + 4); g.lineStyle(2.4, OUTLINE, 1); g.strokeRect(wx - 8, base - h, 16, h + 4);
      g.lineStyle(1.4, dark, 1); for (const dx of [-3, 3]) g.lineBetween(wx + dx, base - h + 6, wx + dx, base);
      g.fillStyle(stone, 1); g.fillRect(wx - 13, base - h - 7, 26, 8); g.lineStyle(2.4, OUTLINE, 1); g.strokeRect(wx - 13, base - h - 7, 26, 8);
    } else if (pick < 0.65) {
      // A fallen column in pieces.
      g.save(); g.translateCanvas(wx + 10, base - 8); g.rotateCanvas(-0.12);
      for (const [x, w] of [[-30, 26], [0, 22]] as const) { g.fillStyle(stone, 1); g.fillRect(x, -8, w, 16); g.lineStyle(2.4, OUTLINE, 1); g.strokeRect(x, -8, w, 16); }
      g.restore();
    } else if (pick < 0.85) {
      // A statue's head, half buried.
      g.fillStyle(stone, 1); g.fillCircle(wx, base - 12, 14); g.lineStyle(2.6, OUTLINE, 1); g.strokeCircle(wx, base - 12, 14);
      g.lineStyle(2, dark, 1); g.lineBetween(wx - 6, base - 15, wx - 2, base - 15); g.lineBetween(wx + 3, base - 15, wx + 7, base - 15); g.lineBetween(wx - 2, base - 7, wx + 4, base - 7);
      for (let i = -2; i <= 2; i++) { g.fillStyle(mute(0x3ad06b), 1); g.fillCircle(wx + i * 6, base - 26 + Math.abs(i) * 2, 3.5); }
    } else {
      // Temple steps.
      const poly = [{ x: wx - 4, y: base + 4 }, { x: wx - 4, y: base - 6 }, { x: wx + 4, y: base - 6 }, { x: wx + 4, y: base - 13 }, { x: wx + 12, y: base - 13 }, { x: wx + 12, y: base - 20 }, { x: wx + 44, y: base - 20 }, { x: wx + 44, y: base - 13 }, { x: wx + 52, y: base - 13 }, { x: wx + 52, y: base - 6 }, { x: wx + 60, y: base - 6 }, { x: wx + 60, y: base + 4 }];
      g.fillStyle(stone, 1); g.fillPoints(poly, true); g.lineStyle(2.4, OUTLINE, 1); g.strokePoints(poly, true);
    }
  }

  /** The new caves' walls: sandstone strata for the canyon, a mosaic band for the city. */
  private newWalls(g: Phaser.GameObjects.Graphics, rock: number) {
    if (this.def.decor === 'canyon') {
      for (const [off, c] of [[10, mixNum(rock, 0xffffff, 0.22)], [20, mixNum(rock, OUTLINE, 0.25)], [32, mixNum(rock, 0xffe0b0, 0.3)]] as const) {
        g.lineStyle(4, c, 1);
        g.strokePoints(this.topEdge.map(p => ({ x: p.x, y: p.y - off + Math.sin(p.x * 0.01 + off) * 3 })));
        g.strokePoints(this.botEdge.map(p => ({ x: p.x, y: p.y + off + Math.sin(p.x * 0.01 + off) * 3 })));
      }
      return;
    }
    // Mosaic: little square tiles along the walls, alternating sea-green and gold.
    for (const [edge, d] of [[this.topEdge, -1], [this.botEdge, 1]] as const) {
      edge.forEach(p => {
        const k = Math.round(p.x / 12);
        g.fillStyle(k % 3 === 0 ? 0xd9b45a : mixNum(rock, 0x3fc9b0, 0.45), 1);
        g.fillRect(p.x - 4, p.y + d * 13 - 4, 8, 8);
      });
    }
  }

  /** How sharp walls look in this cave: coral, ice, or the cave's own (splintered wood, torn steel). */
  private spikeLook(): SpikeLook {
    return this.def.spikeLook ?? (this.def.iceSpikes ? ICE_SPIKES : CORAL_SPIKES);
  }

  /**
   * A short arc of pickups somewhere inside the trench just off-screen, at a random height clear of
   * creatures. `daring` (treasure) tucks it close to a plain wall, so grabbing it takes a bit of nerve.
   */
  private spawnRow(type: Pickup['type'], n: number, gap: number, daring = false) {
    this.withRng(this.place, () => this.spawnRowAt(type, n, gap, daring));
  }
  /** spawnRow with whatever `this.rng` is now (Pearl Bloom's pearls use visual randomness: they're not part of the course). */
  private spawnRowAt(type: Pickup['type'], n: number, gap: number, daring = false) {
    const wx = this.dist - this.diverX() + this.W + 60 + (daring ? this.cr(0, 160) : 0);
    const [t, b] = cave(wx, this.H, this.cv, this.def.shape);
    const y = daring ? this.wallY(wx, t, b) : this.openY(wx, t + 40, b - 40, n * gap), arc = n > 3 ? this.cr(-30, 30) : 0;
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

  /** A random height between `lo` and `hi` that keeps a row of length `len` clear of nearby creatures (best of a few tries). */
  private openY(wx: number, lo: number, hi: number, len: number) {
    let best = this.cr(lo, hi), room = -Infinity;
    for (let i = 0; i < 6 && room < 40; i++) {
      const y = i ? this.cr(lo, hi) : best;
      let r = Infinity;
      for (const o of this.obs) if (o.x > wx - 80 && o.x < wx + len + 80) r = Math.min(r, Math.abs(o.y - y) - o.r);
      if (r > room) { room = r; best = y; }
    }
    return best;
  }

  /** Just off a wall that isn't sharp here (the floor or the ceiling, at random). */
  private wallY(wx: number, t: number, b: number) {
    let side: 0 | 1 = this.rng() < 0.5 ? 0 : 1;
    if (this.spiky(wx, side)) side = side ? 0 : 1;
    const off = this.cr(34, 48);
    return side ? b - off : t + off;
  }

  private glow(tint: number) {
    return this.add.image(0, 0, 'glow').setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setDepth(10).setAlpha(0);
  }

  /** Out of lives (or air): offer a "Save me" for Sea Hearts or a rewarded ad (tuning.adSaves a dive), Subway Surfers style, before ending the dive. */
  private die(reason: string) {
    this.dropCombo();
    const cost = saveCost(this.saves);
    // Ad revives: a few a dive, not on a dive that's barely started, and within the day's ad allowance.
    const adsLeft = Math.min(this.tune.adSaves - this.adSaves, ads.leftToday());
    const adOk = adsLeft > 0 && ads.enabled && this.dist / 10 >= this.tune.adMinDepth;
    if (shells.count < cost && !adOk) { this.endDive(reason); return; }
    this.state = 'saveme';
    this.sparks.explode(14, this.dist, this.diverY);
    this.cameras.main.shake(200, 0.008);
    buzz([30, 30, 50]);
    sfx.tone(240, 0.3, { type: 'sawtooth', vol: 0.07, slideTo: 120 });
    sfx.suspend();
    void ui.saveMe(reason, cost, shells.count, adOk ? ads.rewarded('save-me') : null, adsLeft).then(choice => {
      if (this.state !== 'saveme') return;
      sfx.resume();
      track('save_me', { choice: choice ?? 'none', cost, ad: adOk, cave: this.def.id });
      if (choice === 'ad') this.adSaves++;
      else if (choice !== 'shell' || !shells.spend(cost)) { this.endDive(reason); return; }
      this.saves++;
      this.state = 'play';
      this.hearts = this.rookie ? HEARTS + 2 : HEARTS;
      ui.setHearts(this.hearts, this.hearts);
      this.oxy = Math.max(this.oxy, 60);
      this.invuln = 2.5;
      this.slowT = SLOWMO_TIME;
      this.slowRate = SLOWMO_RATE;
      this.diverY = this.caveMid(this.dist);
      this.vy = 0;
      this.pops.explode(22, this.dist, this.diverY);
      this.cameras.main.flash(260, 120, 230, 255);
      sfx.tone(523, 0.2, { vol: 0.09 }); sfx.tone(784, 0.25, { vol: 0.08, delay: 0.1 }); sfx.tone(1046, 0.5, { vol: 0.08, delay: 0.2 });
      ui.damage('Back in the dive!', true);
    });
  }

  private endDive(reason: string) {
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
    this.specialT = 0;
    this.boosterOpen = false;
    ui.setBoosters(null);

    const depth = Math.floor(this.dist / 10);
    const prevBest = this.runBest, boardBest = topBest();
    let isBest = false, opened: CaveDef | null = null, dailyBonus = 0;
    if (dev.on) {
      // Dev mode: a test dive records no best (it would reach the boards on the next sync).
    } else if (this.daily) {
      // The Daily Dive has its own best and board, and doesn't count towards cave bests or unlocks.
      const d = dailyRun.finish(depth);
      isBest = d.isBest; dailyBonus = d.bonus;
      this.best = dailyRun.best;
      if (!dev.on) void this.postDaily(depth); // dev-mode dives stay off the boards
    } else {
      const key = bestKey(this.def.id), locked = CAVES.filter(c => !isUnlocked(c));
      // Read the saved best, not the in-memory one: a cloud restore may have raised it mid-dive.
      this.best = Math.max(this.best, store.get(key, 0));
      isBest = depth > this.best;
      if (isBest) { this.best = depth; store.set(key, depth); }
      opened = locked.find(isUnlocked) ?? null;
    }
    if (!dev.on) lagos.score(depth); // inside Lagos Life: their leaderboard (it keeps each player's best)
    // The leaderboard takes your deepest dive in any cave.
    if (!dev.on && !this.daily) {
      void this.postScore(depth, depth > boardBest);
      embed.score(depth, Math.max(boardBest, depth));
      if (this.def.id === 'reef' && this.biome > this.bestZone) { this.bestZone = this.biome; store.set('bestZone', this.biome); }
    }

    // Rewards: coins for the dive (raised by the mission-rank bonus) plus any missions completed.
    const bonus = deepMissions.bonus * this.def.pay * (this.perk === 'coins' ? DIVER_PERK.coins : 1); // harder caves (and Royal) pay more
    // The Coin Doubler booster and the bought Coin Doubler (Lagos Life) each add ×1, so both make ×3; then the tuning's coin rate.
    const twice = (1 + (this.doubler ? 1 : 0) + (lagos.doubler ? 1 : 0)) * this.tune.coinRate;
    const runCoins = Math.round((this.runPearls + Math.floor(depth / 40)) * bonus) * twice; // ~25–45 for a good dive at x1
    const closeCoins = Math.round(this.runBonus * bonus) * twice;
    coins.add(runCoins + closeCoins);
    const coinsBefore = coins.balance;
    const stats = {
      depth, pearls: this.runPearls, air: this.runAir, perks: this.runPerks, closeCalls: this.runClose,
      cleanDepth: this.cleanDepth < 0 ? depth : this.cleanDepth,
      anglers: this.runAnglers, eels: this.runEels, specials: this.runSpecials, treasures: this.runTreasures,
      dives: 1, daily: this.daily ? 1 : 0,
    };
    const { results, rankUp } = deepMissions.report(stats);
    const today = dailyMissions.report(stats);
    lifetime.add({ eels: this.runEels, anglers: this.runAnglers, pearls: this.runPearls, dives: 1, metres: depth, closeCalls: this.runClose, specials: this.runSpecials });
    const newDivers = grantEarned().map(s => s.name);
    const missionCoins = coins.balance - coinsBefore;
    const chests = openChests(this.runChests);
    const huntBefore = hunt.pearls, huntWon = hunt.add(this.runPearls);
    track('dive_end', {
      cave: this.def.id, depth, cause: reason, daily: this.daily, secs: Math.round(this.runT), best: isBest,
      saves: this.saves, adSaves: this.adSaves, pearls: this.runPearls, coins: runCoins + closeCoins, chests: this.runChests, diver: this.skin,
    });

    ui.lowO2(false);
    ui.hint(null);
    ui.guide(false);
    this.time.delayedCall(450, () => {
      if (this.state !== 'over') return;
      ui.showOver({
        depth, reason, zone: this.def.biomes[this.biome].name, best: this.best, isBest, pearls: this.runPearls,
        close: soClose(depth, prevBest, ' m'), results, rankUp, opened: opened?.name ?? null, chests,
        hunt: { before: huntBefore, won: huntWon }, daily: this.daily, today, newDivers,
        adCoins: dev.on || !this.tune.adDoubleCoins ? 0 : runCoins + closeCoins,
        earned: [{ label: `Dive ×${(bonus * twice).toFixed(1)}`, n: runCoins }, { label: 'Close calls', n: closeCoins }, { label: 'Missions', n: missionCoins }, { label: 'Daily Dive', n: dailyBonus }],
      });
    });
  }

  /** Post a Daily Dive to the day's board, then show where it ranks today. */
  private async postDaily(depth: number) {
    if (!cloud.enabled) return;
    const day = dailyRun.day;
    await cloud.submitDay(day, dailyRun.best);
    const rank = await cloud.rank(depth, day);
    if (rank && this.state === 'over') ui.setRank(rank, false, true);
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
  /** Points along one swaying kelp strand growing from a wall (dir -1 = up from the floor, 1 = down from the ceiling). */
  private kelpPts(x: number, base: number, dir: number, len: number, t: number): Point[] {
    const pts: Point[] = [];
    for (let i = 0; i <= 8; i++) pts.push({ x: x + Math.sin(t + i * 0.5) * i * 1.4, y: base + (dir * len * i) / 8 });
    return pts;
  }
  private caveMid(wx: number) { const [t, b] = cave(wx, this.H, this.cv, this.def.shape); return (t + b) / 2; }

  private draw() {
    const W = this.W, H = this.H, T = this.clock, depth = this.dist / 10;
    const pal = palette(this.def.biomes, depth, this.pal);
    const px = this.diverX();
    const x0 = this.dist - px;
    this.cameras.main.scrollX = x0;

    this.bg.clear();
    this.bg.fillGradientStyle(pal.top, pal.top, pal.bot, pal.bot, 1);
    this.bg.fillRect(0, 0, W, H);

    // Sun rays fade out as the light disappears.
    this.rays.clear();
    const ray = portraitView() ? 0 : clamp(1 - depth / this.def.raysUntil, 0, 1); // rays would fall sideways in portrait
    if (ray > 0) {
      this.rays.fillStyle(0xb4f0ff, 0.05 * ray);
      for (let i = 0; i < 5; i++) {
        const span = W + 400, x = (((i * W * 0.27 - this.dist * 0.08) % span) + span) % span - 100;
        this.rays.fillPoints([{ x, y: -10 }, { x: x + 60, y: -10 }, { x: x - 60, y: H }, { x: x - 200, y: H }], true);
      }
    }

    // Marine snow drifting past at different depths: sparse in the sunlit shallows, thicker the deeper you go.
    this.snow.clear();
    const flake = this.def.glide ? 1.6 : 1; // icy caves get real snowflakes
    const shown = Math.round(MOTES.length * (0.45 + 0.55 * pal.dark));
    for (let i = 0; i < shown; i++) {
      const m = MOTES[i];
      const x = (((m.x * W - this.dist * m.z * 0.6) % W) + W) % W, y = (m.y * H + T * 10 * m.z * flake) % H, s = (1.6 * m.z + 0.6) * flake;
      this.snow.fillStyle(0xdcf0ff, (0.24 + 0.14 * pal.dark) * m.z * flake);
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
    this.drawSight(W, H, T, pal);

    // Trench walls, in world coordinates: fill, bold outline, then a lighter rim just inside.
    const n = Math.ceil((W + 40) / 12) + 1;
    this.topEdge.length = this.botEdge.length = this.topRim.length = this.botRim.length = n;
    for (let i = 0; i < n; i++) {
      const wx = x0 - 20 + i * 12;
      cave(wx, H, this.cv, this.def.shape);
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

    // Sharp coral (or ice) along dangerous stretches of wall.
    const look = this.spikeLook();
    this.spikeRuns.length = 0;
    for (let seg = Math.floor((x0 - 40) / SPIKE_SEG); seg * SPIKE_SEG < x0 + W + 40; seg++) {
      for (const side of [0, 1] as const) {
        const a = seg * SPIKE_SEG + SPIKE_SEG * 0.1, b = seg * SPIKE_SEG + SPIKE_SEG * 0.9;
        if (!this.spiky(a + 1, side)) continue;
        const dir = side === 0 ? 1 : -1, run: Point[] = [];
        for (let wx = a; wx <= b; wx += 15) {
          const base = cave(wx, H, this.cv, this.def.shape)[side] - dir * 2;
          const tri = [{ x: wx - 7.5, y: base }, { x: wx, y: base + dir * SPIKE_H }, { x: wx + 7.5, y: base }];
          g.fillStyle(look.fill, 1); g.fillPoints(tri, true);
          g.lineStyle(2.4, OUTLINE, 1); g.strokePoints(tri, true);
          g.fillStyle(look.shine, 1); g.fillTriangle(wx - 2, base + dir * 3, wx, base + dir * (SPIKE_H - 4), wx + 1, base + dir * 3);
          run.push({ x: wx, y: base + dir * SPIKE_H * 0.5 });
        }
        this.spikeRuns.push(run);
      }
    }

    // Kelp and coral on the floor (the Kelp Forest keeps its plants all the way down).
    const reef = clamp(1 - depth / this.def.plantsUntil, 0, 1);
    if (reef > 0) {
      for (let k = Math.floor(x0 / 70); k < (x0 + W) / 70 + 1; k++) {
        const wx = k * 70 + hash(k + 9) * 40, base = cave(wx, H, this.cv, this.def.shape)[1] + 4;
        if (hash(k) < this.def.coral) {
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
    this.drawDecor(g, x0, W, H, T, pal.rock);
    // A flag on the trench floor at your best depth (its glowing line across the trench is drawn below).
    const bestX = this.runBest * 10, bestOn = this.runBest > 0 && bestX > x0 - 40 && bestX < x0 + W + 40;
    if (bestOn) {
      const fx = bestX, col = 0xffc43d;
      const [ceil, floor] = cave(fx, H, this.cv, this.def.shape);
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

    // Kelp clumps you can get tangled in: tall swaying strands with leaves.
    for (const k of this.kelps) {
      if (k.x < x0 - 80 || k.x > x0 + W + 80) continue;
      const dir = k.side === 1 ? -1 : 1;
      for (let j = 0; j < k.strands; j++) {
        const sx = k.x - k.w / 2 + (k.w * (j + 0.5)) / k.strands, base = cave(sx, H, this.cv, this.def.shape)[k.side] - dir * 3;
        const len = k.len * (0.82 + hash(j * 7 + k.ph) * 0.18), pts = this.kelpPts(sx, base, dir, len, T * 1.4 + k.ph + j * 0.9);
        g.lineStyle(10, OUTLINE, 1); g.strokePoints(pts);
        g.lineStyle(6, j % 2 ? 0x2fb35c : 0x48d16f, 1); g.strokePoints(pts);
        for (let i = 2; i < pts.length; i += 2) {
          const p = pts[i], side = i % 4 ? 1 : -1;
          g.fillStyle(0x7fe08f, 1); g.fillEllipse(p.x + side * 6, p.y, 10, 5);
          g.lineStyle(2, OUTLINE, 1); g.strokeEllipse(p.x + side * 6, p.y, 10, 5);
        }
      }
    }

    // Icicles: pale blue spikes hanging from the ceiling, shaking just before they drop.
    for (const c of this.icicles) {
      if (c.x < x0 - 60 || c.x > x0 + W + 60) continue;
      const [base, tip] = this.icicleAt(c), sx = c.x + (c.shake > 0 ? Math.sin(T * 70) * 1.8 : 0);
      const tri = [{ x: sx - c.w / 2, y: base }, { x: sx, y: tip }, { x: sx + c.w / 2, y: base }];
      g.fillStyle(0xcff3ff, 1); g.fillPoints(tri, true);
      g.lineStyle(2.6, OUTLINE, 1); g.strokePoints(tri, true);
      g.lineStyle(2, 0xffffff, 0.9); g.lineBetween(sx - c.w * 0.18, base + 4, sx - 1, tip - c.len * 0.3);
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
      } else if (o.kind === 'angler') {
        o.glow.setPosition(o.x - o.r * 2.2, o.y - o.r * 1.5).setDisplaySize(56, 56).setAlpha(0.6 + Math.sin(T * 4 + o.ph) * 0.2);
      } else if (o.kind === 'swordfish') {
        // The bill glints before it darts.
        const warn = o.lunge !== undefined && o.lunge > 0 && !o.dash;
        o.glow.setPosition(o.x - 40, o.y).setDisplaySize(warn ? 70 : 40, warn ? 70 : 40).setAlpha(warn ? (Math.sin(T * 40) > 0 ? 0.95 : 0.4) : 0.1 + pal.dark * 0.2);
      } else {
        o.glow.setPosition(o.x, o.y + o.dy).setDisplaySize(o.r * 4, o.r * 4).setAlpha(0.08 + pal.dark * 0.22);
      }
    }
    for (const p of this.items) {
      const y = p.y + Math.sin(p.ph * 3) * 3;
      const big = p.type !== 'air' && p.type !== 'pearl';
      if (p.type === 'chest') p.sprite.setScale(TEX_SCALE * (1 + Math.sin(p.ph * 4) * 0.05));
      p.sprite.setPosition(p.x, y).setRotation(big ? Math.sin(p.ph * 2) * 0.15 : 0);
      p.glow.setPosition(p.x, y).setDisplaySize(big ? 70 : 44, big ? 70 : 44).setAlpha(big ? 0.55 + Math.sin(p.ph * 5) * 0.2 : 0.35);
    }

    const tilt = this.state === 'over' ? 0.9 : clamp(this.vy / 700, -0.45, 0.45);
    this.diver.setPosition(this.dist, this.diverY).setRotation(this.state === 'play' || this.state === 'paused' ? tilt : this.diver.rotation);
    if (this.state === 'play') this.diver.setAlpha(this.using('phase') ? 0.45 + Math.sin(this.clock * 8) * 0.1 : this.invuln > 0 && Math.sin(this.clock * 40) > 0 ? 0.35 : 1);
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
      const span = LIGHT_SPAN * (this.perk === 'light' && this.state !== 'title' ? DIVER_PERK.light : 1); // Lumi's light reaches further
      this.lightMask.setVisible(true).setPosition(lx, ly).setDisplaySize(span, span).setAlpha(dark * (this.using('flash') ? 0.15 : 1)); // Lumi's Flash lights the whole trench
      this.cone.setVisible(this.state !== 'over').setPosition(px + 14, ly).setAlpha(0.14 * dark);
    } else {
      this.lightMask.setVisible(false);
      this.cone.setVisible(false);
    }

    this.edges.clear();
    // In the dark, some of the snow glows (bioluminescent plankton), twinkling above the darkness.
    if (dark > 0.3) {
      const shown = Math.round(MOTES.length * (0.45 + 0.55 * dark));
      for (let i = 0; i < shown; i++) {
        const m = MOTES[i];
        if (!m.glow) continue;
        const x = (((m.x * W - this.dist * m.z * 0.6) % W) + W) % W, y = (m.y * H + T * 10 * m.z) % H;
        const tw = 0.5 + 0.5 * Math.sin(T * (1.5 + m.z * 2) + m.x * 40);
        this.edges.fillStyle(0x7dffe0, (dark - 0.3) * 0.5 * tw * m.z);
        this.edges.fillCircle(x0 + x, y, 1.2 + m.z * 1.3);
      }
    }
    if (this.sight?.kind === 'school') this.drawSchool(x0, W, H, T, dark);
    if (dark > 0.01) {
      this.edges.lineStyle(2, 0x6ebeff, 0.16 * dark);
      this.edges.strokePoints(this.topEdge);
      this.edges.strokePoints(this.botEdge);
      // Sharp coral glows red in the dark so it can always be seen coming.
      this.edges.lineStyle(9, look.glow, (0.55 + Math.sin(T * 4) * 0.15) * Math.max(0.5, dark));
      for (const run of this.spikeRuns) if (run.length > 1) this.edges.strokePoints(run);
    }
    // Kelp glows faintly green in the dark so it can be seen coming.
    if (dark > 0.25) {
      this.edges.lineStyle(7, 0x6dffa4, 0.16 * dark);
      for (const k of this.kelps) {
        const dir = k.side === 1 ? -1 : 1;
        for (let j = 0; j < k.strands; j++) {
          const sx = k.x - k.w / 2 + (k.w * (j + 0.5)) / k.strands, base = cave(sx, H, this.cv, this.def.shape)[k.side] - dir * 3;
          this.edges.strokePoints(this.kelpPts(sx, base, dir, k.len * (0.82 + hash(j * 7 + k.ph) * 0.18), T * 1.4 + k.ph + j * 0.9));
        }
      }
    }
    // Icicles glow faintly so they can be seen coming in the dark.
    if (dark > 0.25) {
      this.edges.lineStyle(6, 0x9fe8ff, 0.3 * dark);
      for (const c of this.icicles) {
        const [base, tip] = this.icicleAt(c);
        this.edges.strokePoints([{ x: c.x - c.w / 2, y: base }, { x: c.x, y: tip }, { x: c.x + c.w / 2, y: base }], true);
      }
    }
    this.drawWreck(g, x0, W, T, dark);
    this.drawSetPieces(g, x0, W, T, dark);
    // Your best depth: a dashed gold line across the trench, bright enough to see in the dark.
    if (bestOn) {
      const [t, b] = cave(bestX, H, this.cv, this.def.shape), a = this.bestPassed ? 0.25 : 0.6 + Math.sin(T * 5) * 0.2;
      this.edges.lineStyle(10, 0xffb020, a * 0.35);
      this.edges.lineBetween(bestX, t, bestX, b);
      this.edges.lineStyle(3, 0xffe27a, a);
      for (let y = t + 6; y < b - 6; y += 16) this.edges.lineBetween(bestX, y, bestX, Math.min(y + 9, b - 6));
    }
  }
}

// ---------- Wreck caves

const CORAL_SPIKES: SpikeLook = { fill: 0xff6b8a, shine: 0xffd0da, glow: 0xff4d6d, hit: 'Spiked on sharp coral' };
const ICE_SPIKES: SpikeLook = { fill: 0xa8e6ff, shine: 0xf2fdff, glow: 0x7fe3ff, hit: 'Spiked on sharp ice' };
/** Room kept between one wreck hazard and the next (world px). */
const WRECK_SPACING = 300;
/** Cannons light their fuse this far ahead of you (world px), fire after CANNON_FUSE seconds, and the ball closes on you at BALL_CLOSE px/s. */
const CANNON_FUSE_AT = 560, CANNON_FUSE = 0.6, BALL_CLOSE = 560, BALL_R = 9;
const ANCHOR_R = 17;
/** Steam vents: a burst lasts VENT_ON of every VENT_CYCLE seconds, with VENT_WARN seconds of gurgling first. */
const VENT_CYCLE = 2.8, VENT_ON = 1.0, VENT_WARN = 0.6, VENT_W = 30;
/** Decks start shaking DECK_LEAD seconds before you reach them, drop DECK_SHAKE seconds later, and swing down this hard. */
const DECK_LEAD = 1.4, DECK_SHAKE = 0.35, DECK_G = 1600;

/** A cannon on a broken hull, on the floor (side 1) or the ceiling (side 0). It tracks you, then fires once. */
interface Cannon { x: number; side: 0 | 1; aim: number; fuse: number; fired: boolean; kick: number }
/** A cannonball; its velocity is relative to you, so on screen it flies straight at where you were. */
interface Ball { x: number; y: number; vx: number; vy: number; gap?: number; passed?: boolean; gone?: boolean; ghost?: boolean }
/** An anchor swinging on a chain from the ceiling. */
interface Anchor { x: number; len: number; amp: number; period: number; ph: number; gap?: number; passed?: boolean }
/** A broken boiler pipe on a wall, bursting steam on a fixed beat. */
interface Vent { x: number; side: 0 | 1; reach: number; ph: number; hissed?: boolean; gap?: number; passed?: boolean }
/** A section of deck hinged to the ceiling; `ang` is 0 lying flat along it, PI/2 hanging straight down. */
interface Deck { x: number; len: number; dir: 1 | -1; ang: number; vang: number; shake: number; falling: boolean; gap?: number; passed?: boolean }
/** This dive's treasure, floating near a wall. */
interface TreasureItem { x: number; y: number; ph: number; sprite: Image; glow: Image }

// ---------- Riptide Canyon, Sunken City, the ghost ship

/** Currents ease in and out over this much of each end (world px). */
const CURRENT_EASE = 70;
/** A temple gate's wall thickness (world px), and how long its doorway takes to slide to its next height (beats). */
const GATE_W = 28, GATE_SLIDE = 0.3;
/** Doorway patterns: heights (share of the trench, top to bottom) visited in turn, each held for `per` beats. Easiest first. */
const GATE_PATTERNS: { pat: number[]; per: number }[] = [
  { pat: [0.3, 0.7], per: 2 },
  { pat: [0.28, 0.5, 0.72, 0.5], per: 2 },
  { pat: [0.7, 0.3], per: 2 },
  { pat: [0.3, 0.7], per: 1 },
  { pat: [0.26, 0.5, 0.74], per: 1 },
];
/** The ghost ship sails this far ahead of you (world px), fires GHOST_SHOTS shots GHOST_EVERY s apart from GHOST_FIRST s, closing at GHOST_CLOSE px/s. */
const GHOST_AHEAD = 360, GHOST_MAST = 104, GHOST_FIRST = 1.4, GHOST_EVERY = 0.65, GHOST_SHOTS = 6, GHOST_CLOSE = 470;

/** A stretch of trench where the water pushes up (dir -1) or down (dir 1), `push` compared with your steering. */
interface Current { x0: number; x1: number; dir: 1 | -1; push: number }
/** A temple gate: its doorway visits the heights in `pat`, `per` beats each, offset by `ph` beats. */
interface Gate { x: number; pat: number[]; per: number; ph: number; slot: number; gap?: number; passed?: boolean }
/** A statue on a wall that thrusts its spear across the trench on the 4th beat of every bar (shifted by `ph`). */
interface Spear { x: number; side: 0 | 1; reach: number; ph: number; thrust?: boolean; gap?: number; passed?: boolean }
/** The ghost ship: seconds since it appeared, and shots fired. */
interface Ghost { t: number; shots: number }
