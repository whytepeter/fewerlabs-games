// Pure game simulation for Ripple: no Phaser, no DOM, no relative imports, so it can also be
// run headless (e.g. `node` with type stripping) for bot playtests.
// Units are logical CSS pixels and seconds.

/* tuning (from the original prototype) */
export const RIP_SPEED = 165, RIP_LIFE = 1.7, RIP_BAND = 24, RIP_PUSH = 420;
export const DRAG = 0.75, MAX_V = 150, BOAT_R = 13, DOCK_R = 32;
export const LIVES = 3;
/** Pause between losing the last boat and the game-over screen. */
export const END_DELAY = 0.9;
/** Hard cap on live ripples so finger-mashing can't grow per-frame work without bound. */
const MAX_RIPPLES = 16;
/** Boats docked per wave. */
export const WAVE_SIZE = 6;
/** Points for a golden boat (it may use any dock). */
export const GOLD_POINTS = 3;
/** Seconds that a freeze power-up stops every boat's timer. */
export const FREEZE_TIME = 5;
export const PICKUP_R = 15;
const PICKUP_LIFE = 9;
/** Boat timer: BOAT_LIFE seconds, shrinking 0.35 s per boat docked down to BOAT_LIFE_MIN. */
const BOAT_LIFE = 30, BOAT_LIFE_MIN = 20;

/* ---------- pond twists: one per wave from wave 2, announced in the wave banner */
export type Twist = 'none' | 'calm' | 'wind' | 'whirl' | 'lilies';
/** Wind: constant push (px/s^2). With DRAG 0.75 boats drift at most ~WIND_F / 0.75 = 9 px/s. */
export const WIND_F = 7;
/** Whirlpool: radius, tangential pull at the centre (px/s^2, fading to 0 at the rim), and a slight inward tug. */
export const WHIRL_R = 125, WHIRL_SPIN = 34, WHIRL_PULL = 7;
/** Lily wall pad radius and spacing (pads touch, so boats can't slip between until rippled apart). */
export const WALL_R = 17;
const WALL_STEP = 31, WALL_DRAG = 1.3, WALL_PUSH = 0.75;

export interface Rect { x: number; y: number; w: number; h: number; r: number }
export type BoatState = 'in' | 'dock' | 'sink';
export interface Boat {
  id: number; x: number; y: number; vx: number; vy: number; ang: number;
  ci: number; life: number; age: number; state: BoatState; k: number; wake: number; noped: number;
  dock: Dock | null;
  /** Magnitude of this frame's ripple push (visual feedback only). */
  push: number;
  /** Golden boats are worth GOLD_POINTS, dock anywhere, and have shorter timers. */
  gold: boolean;
}
export type PickupKind = 'freeze' | 'life';
/** A floating power-up bubble; tap it to collect. */
export interface Pickup { id: number; x: number; y: number; kind: PickupKind; age: number; life: number; ph: number }
export interface Dock {
  id: number; x: number; y: number; r: number; ci: number; got: number;
  moving: boolean; fade: number; moved: boolean; isNew: boolean;
}
export interface Rock { id: number; x: number; y: number; r: number; variant: number; isNew: boolean }
export interface Pad { x: number; y: number; r: number; a: number; flower: boolean }
export interface Ripple { x: number; y: number; age: number }
export interface Mote { x: number; y: number; ph: number; sp: number }
/** A floating lily pad from a Lily wall twist: boats bounce off it, ripples push it. */
export interface WallPad { id: number; x: number; y: number; vx: number; vy: number; r: number; a: number; age: number; sinking: number }

export type SimEvent =
  | { type: 'drop'; x: number; y: number }
  | { type: 'dock'; boat: Boat; dock: Dock; note: number }
  | { type: 'nope'; x: number; y: number }
  | { type: 'bump' }
  | { type: 'lost'; boat: Boat }
  | { type: 'unlock'; ci: number }
  | { type: 'dockMove'; dock: Dock }
  | { type: 'wake'; x: number; y: number }
  | { type: 'over'; score: number }
  | { type: 'wave'; wave: number; twist: Twist; perfect: boolean }
  | { type: 'pickup'; pickup: Pickup }
  | { type: 'pickupSpawn'; pickup: Pickup }
  | { type: 'hud' };

/** idle = title backdrop, play = running, ending = last life lost (no scoring), over = finished. */
export type Phase = 'idle' | 'play' | 'ending' | 'over';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
type Circle = { x: number; y: number; r?: number };

export class Sim {
  pond: Rect = { x: 0, y: 0, w: 400, h: 600, r: 40 };
  phase: Phase = 'idle';
  score = 0;
  /** Boats docked this run. Difficulty and unlocks follow this, so golden bonuses don't speed up the ramp. */
  docked = 0;
  wave = 1;
  /** Seconds left on a freeze power-up. */
  freezeT = 0;
  pickups: Pickup[] = [];
  private pickupT = 20;
  private nextRockAt = 12;
  lives = LIVES;
  t = 0;
  nextSpawn = 0.8;
  colors = 1;
  combo = 0;
  lastDock = -9;
  endT = 0;
  /** The player has tapped at least once in this run (drives the onboarding hint). */
  tapped = false;
  /** Longest chain of quick docks this run (1 = a single dock). */
  bestCombo = 0;
  /** Run stats reported to missions. */
  goldDocked = 0;
  freezes = 0;
  hearts = 0;
  perfectWaves = 0;
  private lostThisWave = false;
  /** Current pond twist and its parameters. */
  twist: Twist = 'none';
  wind = { x: 0, y: 0 };
  whirl = { x: 0, y: 0, dir: 1 };
  wall: WallPad[] = [];
  /** Title-screen backdrop: a few timer-less boats drift about while idle. */
  demo = false;
  private demoT = 0;
  boats: Boat[] = [];
  docks: Dock[] = [];
  rocks: Rock[] = [];
  pads: Pad[] = [];
  ripples: Ripple[] = [];
  motes: Mote[] = [];
  events: SimEvent[] = [];

  private rng: () => number;
  private nextId = 1;
  private laidOut = false;

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
  }

  /** Swap the random source (Daily mode seeds it so every player gets the same run). */
  setRng(rng: () => number) { this.rng = rng; }

  private rand(a: number, b: number) { return a + this.rng() * (b - a); }

  /* ---------- layout */

  /** Set the pond rect. If a world exists, existing positions are rescaled into the new pond. */
  setPond(p: Rect) {
    const old = this.pond;
    this.pond = { ...p };
    if (this.laidOut && (Math.abs(old.w - p.w) > 0.5 || Math.abs(old.h - p.h) > 0.5 || old.x !== p.x || old.y !== p.y)) {
      this.refit(old);
    }
  }

  /** Keep everything where it was relative to the pond rather than re-rolling rocks and pads. */
  private refit(old: Rect) {
    if (!(old.w > 0 && old.h > 0)) return;
    const p = this.pond;
    const fit = (o: { x: number; y: number }) => {
      o.x = p.x + (o.x - old.x) / old.w * p.w;
      o.y = p.y + (o.y - old.y) / old.h * p.h;
    };
    for (const list of [this.rocks, this.pads, this.docks, this.motes, this.boats, this.ripples, this.pickups, this.wall] as { x: number; y: number }[][]) list.forEach(fit);
    this.relax();
    for (const b of this.boats) {
      b.x = clamp(b.x, p.x + BOAT_R, p.x + p.w - BOAT_R);
      b.y = clamp(b.y, p.y + BOAT_R, p.y + p.h - BOAT_R);
    }
  }

  /**
   * A drastic aspect change (portrait -> landscape) squashes distances, so gently push
   * docks and rocks apart again, then clamp them inside the pond.
   */
  private relax() {
    const p = this.pond;
    const push = (a: Circle, b: Circle, min: number, moveA: number, moveB: number) => {
      let dx = b.x - a.x, dy = b.y - a.y;
      let d = Math.hypot(dx, dy);
      if (d >= min) return;
      if (d < 0.001) { dx = 1; dy = 0; d = 1; }
      const over = min - d, nx = dx / d, ny = dy / d;
      a.x -= nx * over * moveA; a.y -= ny * over * moveA;
      b.x += nx * over * moveB; b.y += ny * over * moveB;
    };
    for (let it = 0; it < 8; it++) {
      for (let i = 0; i < this.docks.length; i++)
        for (let j = i + 1; j < this.docks.length; j++) push(this.docks[i], this.docks[j], 110, 0.5, 0.5);
      for (const d of this.docks) for (const k of this.rocks) push(d, k, d.r + k.r + 18, 0, 1);
      for (let i = 0; i < this.rocks.length; i++)
        for (let j = i + 1; j < this.rocks.length; j++) push(this.rocks[i], this.rocks[j], this.rocks[i].r + this.rocks[j].r + 24, 0.5, 0.5);
      for (const d of this.docks) {
        d.x = clamp(d.x, p.x + d.r + 20, p.x + p.w - d.r - 20);
        d.y = clamp(d.y, p.y + d.r + 20, p.y + p.h - d.r - 20);
      }
      for (const k of this.rocks) {
        k.x = clamp(k.x, p.x + k.r + 10, p.x + p.w - k.r - 10);
        k.y = clamp(k.y, p.y + k.r + 10, p.y + p.h - k.r - 10);
      }
    }
  }

  private clearance(x: number, y: number, avoid: Circle[]) {
    let c = Infinity;
    for (const o of avoid) c = Math.min(c, Math.hypot(o.x - x, o.y - y) - (o.r ?? 0));
    return c;
  }
  private farFrom(x: number, y: number, list: Circle[], minD: number) {
    return this.clearance(x, y, list) > minD;
  }
  /** Random spot that keeps `minD` clear of `avoid`; falls back to the roomiest spot tried. */
  private placeInPond(margin: number, avoid: Circle[], minD: number) {
    const p = this.pond;
    let best = { x: p.x + p.w / 2, y: p.y + p.h / 2 }, bestC = -Infinity;
    for (let i = 0; i < 80; i++) {
      const x = this.rand(p.x + margin, p.x + p.w - margin), y = this.rand(p.y + margin, p.y + p.h - margin);
      const c = this.clearance(x, y, avoid);
      if (c > minD) return { x, y };
      if (c > bestC) { bestC = c; best = { x, y }; }
    }
    return best;
  }

  private addDock(ci: number) {
    const pt = this.placeInPond(DOCK_R + 26, [...this.docks, ...this.rocks], 130);
    this.docks.push({ id: this.nextId++, x: pt.x, y: pt.y, r: DOCK_R, ci, got: 0, moving: false, fade: 0, moved: false, isNew: true });
  }

  private layout() {
    this.boats = []; this.docks = []; this.rocks = []; this.ripples = []; this.pads = []; this.motes = [];
    this.addDock(0);
    const p = this.pond;
    const nRocks = clamp(Math.round(p.w * p.h / 90000), 2, 5);
    for (let i = 0; i < nRocks; i++) {
      const pt = this.placeInPond(50, [...this.rocks, ...this.docks], 90);
      this.rocks.push({ id: this.nextId++, x: pt.x, y: pt.y, r: this.rand(14, 24), variant: Math.floor(this.rng() * 4), isNew: false });
    }
    for (let i = 0; i < 7; i++) {
      const pt = this.placeInPond(30, [...this.rocks, ...this.docks, ...this.pads], 40);
      this.pads.push({ x: pt.x, y: pt.y, r: this.rand(12, 20), a: this.rng() * 6, flower: this.rng() < 0.3 });
    }
    for (let i = 0; i < 18; i++) {
      this.motes.push({ x: this.rand(p.x, p.x + p.w), y: this.rand(p.y, p.y + p.h), ph: this.rng() * 6, sp: this.rand(4, 10) });
    }
    this.laidOut = true;
  }

  private resetCounters() {
    this.score = 0; this.lives = LIVES; this.t = 0; this.nextSpawn = 0.8; this.colors = 1;
    this.docked = 0; this.wave = 1; this.freezeT = 0; this.pickups = []; this.pickupT = 20; this.nextRockAt = 12;
    this.combo = 0; this.lastDock = -9; this.endT = 0; this.tapped = false; this.bestCombo = 0;
    this.goldDocked = 0; this.freezes = 0; this.hearts = 0; this.perfectWaves = 0; this.lostThisWave = false;
    this.twist = 'none'; this.wall = [];
    this.events.length = 0;
  }

  /** Lay out a fresh pond with no boats, used as the title-screen backdrop. */
  prepare() {
    this.layout();
    this.resetCounters();
    this.phase = 'idle';
    this.demo = true;
    this.demoT = 0.4;
  }

  /** Begin a run. `keepLayout` reuses an untouched title layout instead of re-rolling it. */
  start(keepLayout = false) {
    if (!keepLayout || !this.laidOut) this.layout();
    else { this.boats = []; this.ripples = []; }
    this.pickups = [];
    this.resetCounters();
    this.demo = false;
    this.phase = 'play';
    this.events.push({ type: 'hud' });
  }

  /* ---------- play */

  get maxBoats() { return Math.min(6, 2 + Math.floor(this.docked / 4)); }

  private spawnBoat(ci = Math.floor(this.rng() * this.colors)) {
    const p = this.pond, m = 6;
    for (let attempt = 0; attempt < 12; attempt++) {
      const side = Math.floor(this.rng() * 4);
      const sp = this.rand(22, 32);
      let x: number, y: number, vx: number, vy: number;
      if (side === 0) { x = this.rand(p.x + 60, p.x + p.w - 60); y = p.y + m + BOAT_R; vx = this.rand(-8, 8); vy = sp; }
      else if (side === 1) { x = p.x + p.w - m - BOAT_R; y = this.rand(p.y + 60, p.y + p.h - 60); vx = -sp; vy = this.rand(-8, 8); }
      else if (side === 2) { x = this.rand(p.x + 60, p.x + p.w - 60); y = p.y + p.h - m - BOAT_R; vx = this.rand(-8, 8); vy = -sp; }
      else { x = p.x + m + BOAT_R; y = this.rand(p.y + 60, p.y + p.h - 60); vx = sp; vy = this.rand(-8, 8); }
      if (!this.farFrom(x, y, this.docks, 50) && attempt < 11) continue;
      // one boat in 7 is golden once the player has the hang of it (never two at once, not in the title demo)
      const gold = this.phase === 'play' && this.docked >= 4 && !this.boats.some(o => o.gold && o.state === 'in') && this.rng() < 1 / 7;
      // Bigger ponds (tablets, desktop) mean longer trips, so timers stretch with the pond's size.
      const size = Math.min(1.6, Math.max(1, Math.hypot(p.w, p.h) / 800));
      const life = Math.max(BOAT_LIFE_MIN, BOAT_LIFE - this.docked * 0.35) * size * (gold ? 0.8 : 1);
      this.boats.push({ id: this.nextId++, x, y, vx, vy, ang: Math.atan2(vy, vx), ci, life, age: 0, state: 'in', k: 0, wake: 0, noped: -9, dock: null, push: 0, gold });
      return;
    }
  }

  /** A tap on the water. Returns false when ignored (not playing, or outside the pond). */
  tap(x: number, y: number) {
    const p = this.pond;
    if (this.phase !== 'play') return false;
    if (x < p.x || x > p.x + p.w || y < p.y || y > p.y + p.h) return false;
    // tapping a power-up collects it instead of making a ripple (generous touch radius)
    const pk = this.pickups.find(o => Math.hypot(o.x - x, o.y - y) < PICKUP_R + 16);
    if (pk) { this.collect(pk); this.tapped = true; return true; }
    if (this.ripples.length >= MAX_RIPPLES) this.ripples.shift();
    this.ripples.push({ x, y, age: 0 });
    this.tapped = true;
    this.events.push({ type: 'drop', x, y });
    return true;
  }

  /** A decorative ripple for the title backdrop (no sound event, no hint bookkeeping). */
  splash(x: number, y: number) {
    const p = this.pond;
    if (this.phase !== 'idle' || x < p.x || x > p.x + p.w || y < p.y || y > p.y + p.h) return;
    if (this.ripples.length >= MAX_RIPPLES) this.ripples.shift();
    this.ripples.push({ x, y, age: 0 });
  }

  private dockBoat(b: Boat, d: Dock) {
    b.state = 'dock'; b.k = 0; b.dock = d;
    this.combo = this.t - this.lastDock < 4 ? this.combo + 1 : 0;
    this.lastDock = this.t;
    this.bestCombo = Math.max(this.bestCombo, this.combo + 1);
    this.score += b.gold ? GOLD_POINTS : 1; this.docked++; d.got++;
    if (b.gold) this.goldDocked++;
    this.events.push({ type: 'dock', boat: b, dock: d, note: this.combo + Math.min(4, Math.floor(this.docked / 10)) + (b.gold ? 2 : 0) });
    this.events.push({ type: 'hud' });
    // progression: more colours, more rocks, docks that move, waves
    if (this.docked >= 8 && this.colors < 2) { this.colors = 2; this.addDock(1); this.events.push({ type: 'unlock', ci: 1 }); }
    else if (this.docked >= 20 && this.colors < 3) { this.colors = 3; this.addDock(2); this.events.push({ type: 'unlock', ci: 2 }); }
    const wave = 1 + Math.floor(this.docked / WAVE_SIZE);
    if (wave > this.wave) {
      const perfect = !this.lostThisWave;
      if (perfect) this.perfectWaves++;
      this.lostThisWave = false;
      this.wave = wave;
      this.nextSpawn = Math.max(this.nextSpawn, 2.5); // a short breather between waves
      this.setTwist(this.pickTwist());
      this.events.push({ type: 'wave', wave, twist: this.twist, perfect });
    }
    if (this.docked >= this.nextRockAt) {
      this.nextRockAt += 12;
      if (this.rocks.length < 7) {
        const pt = this.placeInPond(50, [...this.rocks, ...this.docks, ...this.boats.map(o => ({ x: o.x, y: o.y, r: 30 }))], 80);
        this.rocks.push({ id: this.nextId++, x: pt.x, y: pt.y, r: this.rand(14, 22), variant: Math.floor(this.rng() * 4), isNew: true });
      }
    }
    if (d.got >= 4 && !d.moving) { d.moving = true; this.events.push({ type: 'dockMove', dock: d }); }
  }

  /** Wave 2 gets a gentle twist (never the wall); later waves any of four, never the same twice running. */
  private pickTwist(): Twist {
    const opts: Twist[] = this.wave <= 2 ? ['wind', 'whirl', 'calm'] : ['wind', 'whirl', 'lilies', 'calm'];
    const choices = opts.filter(t => t !== this.twist);
    return choices[Math.floor(this.rng() * choices.length)];
  }

  setTwist(t: Twist) {
    // last wave's lily wall sinks away
    for (const w of this.wall) w.sinking = Math.max(w.sinking, 0.001);
    this.twist = t;
    const p = this.pond;
    if (t === 'wind') {
      const a = this.rng() * Math.PI * 2;
      this.wind = { x: Math.cos(a) * WIND_F, y: Math.sin(a) * WIND_F };
    } else if (t === 'whirl') {
      const pt = this.placeInPond(WHIRL_R * 0.6, this.docks.map(d => ({ x: d.x, y: d.y, r: d.r + 40 })), WHIRL_R * 0.5);
      this.whirl = { x: pt.x, y: pt.y, dir: this.rng() < 0.5 ? -1 : 1 };
    } else if (t === 'lilies') {
      // a row of touching pads across the pond's short way, skipping docks and rocks
      const across = p.w >= p.h; // landscape: a vertical wall
      const len = across ? p.h : p.w;
      const at = (across ? p.x + p.w * this.rand(0.35, 0.65) : p.y + p.h * this.rand(0.35, 0.65));
      const n = Math.floor((len - 8) / WALL_STEP);
      const start = (len - (n - 1) * WALL_STEP) / 2;
      for (let i = 0; i < n; i++) {
        const x = across ? at : p.x + start + i * WALL_STEP, y = across ? p.y + start + i * WALL_STEP : at;
        if (this.docks.some(d => Math.hypot(d.x - x, d.y - y) < d.r + WALL_R + 6)) continue;
        if (this.rocks.some(k => Math.hypot(k.x - x, k.y - y) < k.r + WALL_R)) continue;
        this.wall.push({ id: this.nextId++, x, y, vx: 0, vy: 0, r: WALL_R, a: this.rng() * 6, age: 0, sinking: 0 });
      }
    }
  }

  private loseBoat(b: Boat) {
    this.lostThisWave = true;
    b.state = 'sink'; b.k = 0;
    this.lives = Math.max(0, this.lives - 1);
    this.combo = 0;
    this.events.push({ type: 'lost', boat: b });
    this.events.push({ type: 'hud' });
    if (this.lives <= 0) { this.phase = 'ending'; this.endT = END_DELAY; }
  }

  /** The boat the onboarding hint should point at, with its dock. */
  hintTarget(): { boat: Boat; dock: Dock } | null {
    if (this.phase !== 'play' || this.tapped) return null;
    let best: { boat: Boat; dock: Dock } | null = null, bestLeft = Infinity;
    for (const b of this.boats) {
      if (b.state !== 'in') continue;
      const d = this.dockFor(b);
      if (!d) continue;
      const left = b.life - b.age;
      if (left < bestLeft) { bestLeft = left; best = { boat: b, dock: d }; }
    }
    return best;
  }

  /** The dock a boat should head for: its colour's, or the nearest one for a golden boat. */
  dockFor(b: Boat): Dock | undefined {
    if (!b.gold) return this.docks.find(o => o.ci === b.ci);
    let best: Dock | undefined, bd = Infinity;
    for (const d of this.docks) { const dd = Math.hypot(d.x - b.x, d.y - b.y); if (dd < bd) { bd = dd; best = d; } }
    return best;
  }

  private collect(pk: Pickup) {
    this.pickups = this.pickups.filter(o => o !== pk);
    if (pk.kind === 'freeze') { this.freezeT = FREEZE_TIME; this.freezes++; }
    else { this.lives = Math.min(LIVES, this.lives + 1); this.hearts++; this.events.push({ type: 'hud' }); }
    this.events.push({ type: 'pickup', pickup: pk });
  }

  private spawnPickup() {
    const kind: PickupKind = this.lives < LIVES && this.rng() < 0.45 ? 'life' : 'freeze';
    const pt = this.placeInPond(40, [...this.docks, ...this.rocks, ...this.boats.map(o => ({ x: o.x, y: o.y, r: 20 }))], 30);
    const pk: Pickup = { id: this.nextId++, x: pt.x, y: pt.y, kind, age: 0, life: PICKUP_LIFE, ph: this.rng() * 6 };
    this.pickups.push(pk);
    this.events.push({ type: 'pickupSpawn', pickup: pk });
  }

  /** Decorative motion that runs in every phase, including pause. */
  ambient(dt: number) {
    for (const m of this.motes) {
      m.ph += dt;
      m.x += Math.cos(m.ph * 0.5) * m.sp * dt;
      m.y += Math.sin(m.ph * 0.37) * m.sp * dt;
    }
  }

  /** Extra force from the current twist at a point (wind everywhere, whirlpool near its centre). */
  twistForce(x: number, y: number) {
    if (this.twist === 'wind') return this.wind;
    if (this.twist === 'whirl') {
      const dx = x - this.whirl.x, dy = y - this.whirl.y, d = Math.hypot(dx, dy) || 0.001;
      if (d > WHIRL_R) return { x: 0, y: 0 };
      const k = 1 - d / WHIRL_R, nx = dx / d, ny = dy / d, s = this.whirl.dir;
      return { x: (-ny * s * WHIRL_SPIN - nx * WHIRL_PULL) * k, y: (nx * s * WHIRL_SPIN - ny * WHIRL_PULL) * k };
    }
    return { x: 0, y: 0 };
  }

  private updateWall(dt: number) {
    if (!this.wall.length) return;
    const p = this.pond, damp = Math.exp(-WALL_DRAG * dt);
    for (const w of this.wall) {
      w.age += dt;
      if (w.sinking) { w.sinking += dt * 1.4; continue; }
      let fx = 0, fy = 0;
      for (const r of this.ripples) {
        const dx = w.x - r.x, dy = w.y - r.y, d = Math.hypot(dx, dy) || 0.001;
        const off = Math.abs(d - r.age * RIP_SPEED);
        if (off < RIP_BAND) {
          const fade = Math.pow(1 - r.age / RIP_LIFE, 1.4) * (1 - off / RIP_BAND) * (d < 26 ? 1.6 : 1);
          fx += dx / d * RIP_PUSH * WALL_PUSH * fade; fy += dy / d * RIP_PUSH * WALL_PUSH * fade;
        }
      }
      w.vx = (w.vx + fx * dt) * damp; w.vy = (w.vy + fy * dt) * damp;
      w.x += w.vx * dt; w.y += w.vy * dt;
      w.x = clamp(w.x, p.x + w.r, p.x + p.w - w.r); w.y = clamp(w.y, p.y + w.r, p.y + p.h - w.r);
      // keep clear of docks and rocks
      for (const o of [...this.docks, ...this.rocks]) {
        const dx = w.x - o.x, dy = w.y - o.y, d = Math.hypot(dx, dy) || 0.001, md = o.r + w.r;
        if (d < md) { w.x = o.x + dx / d * md; w.y = o.y + dy / d * md; }
      }
    }
    // pads don't overlap each other
    for (let i = 0; i < this.wall.length; i++) for (let j = i + 1; j < this.wall.length; j++) {
      const a = this.wall[i], b = this.wall[j];
      if (a.sinking || b.sinking) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.001, md = a.r + b.r - 3;
      if (d < md) { const o = (md - d) / 2, nx = dx / d, ny = dy / d; a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o; }
    }
    if (this.wall.some(w => w.sinking >= 1)) this.wall = this.wall.filter(w => w.sinking < 1);
  }

  update(dt: number) {
    const playing = this.phase === 'play';
    if (playing || this.phase === 'ending') this.t += dt;

    if (playing) {
      const active = this.boats.reduce((n, b) => n + (b.state === 'in' ? 1 : 0), 0);
      this.nextSpawn -= dt;
      if (this.nextSpawn <= 0 && active < this.maxBoats) {
        this.spawnBoat();
        this.nextSpawn = Math.max(2.6, 6.5 - this.docked * 0.13);
      }
      if (active === 0 && this.nextSpawn > 1.2) this.nextSpawn = 1.2;
      // power-ups: one every 20-28 s once a couple of boats are home
      if (this.freezeT > 0) this.freezeT = Math.max(0, this.freezeT - dt);
      if (this.docked >= 2 && this.pickups.length === 0 && (this.pickupT -= dt) <= 0) {
        this.pickupT = this.rand(20, 28);
        this.spawnPickup();
      }
      for (const pk of this.pickups) {
        pk.age += dt; pk.ph += dt;
        pk.x += Math.cos(pk.ph * 0.7) * 6 * dt; pk.y += Math.sin(pk.ph * 0.9) * 6 * dt;
      }
      if (this.pickups.some(o => o.age >= o.life)) this.pickups = this.pickups.filter(o => o.age < o.life);
    } else if (this.phase === 'idle' && this.demo) {
      this.demoT -= dt;
      if (this.demoT <= 0) { this.demoT = 2.2; if (this.boats.length < 3) this.spawnBoat(Math.floor(this.rng() * 3)); }
    } else if (this.phase === 'ending') {
      this.endT -= dt;
      if (this.endT <= 0) { this.phase = 'over'; this.events.push({ type: 'over', score: this.score }); }
    }

    for (const r of this.ripples) r.age += dt;
    if (this.ripples.length && this.ripples[0].age >= RIP_LIFE) this.ripples = this.ripples.filter(r => r.age < RIP_LIFE);

    const p = this.pond;
    for (const b of this.boats) {
      if (b.state === 'in') {
        // ripple forces: each expanding ring pushes boats outward as its front passes; rings simply add
        let fx = 0, fy = 0;
        for (const r of this.ripples) {
          const dx = b.x - r.x, dy = b.y - r.y, d = Math.hypot(dx, dy) || 0.001;
          const front = r.age * RIP_SPEED, off = Math.abs(d - front);
          if (off < RIP_BAND) {
            const fade = Math.pow(1 - r.age / RIP_LIFE, 1.4) * (1 - off / RIP_BAND);
            const near = d < 26 ? 1.6 : 1;
            fx += dx / d * RIP_PUSH * fade * near; fy += dy / d * RIP_PUSH * fade * near;
          }
        }
        b.push = Math.hypot(fx, fy);
        // gentle swirling current so the pond feels alive
        fx += Math.sin(b.y * 0.012 + this.t * 0.3) * 3; fy += Math.cos(b.x * 0.012 + this.t * 0.25) * 3;
        const tw = this.twistForce(b.x, b.y);
        fx += tw.x; fy += tw.y;
        b.vx += fx * dt; b.vy += fy * dt;
        const damp = Math.exp(-DRAG * dt); b.vx *= damp; b.vy *= damp;
        const sp = Math.hypot(b.vx, b.vy);
        if (sp > MAX_V) { b.vx *= MAX_V / sp; b.vy *= MAX_V / sp; }
        b.x += b.vx * dt; b.y += b.vy * dt;
        // pond walls
        const l = p.x + BOAT_R, rgt = p.x + p.w - BOAT_R, t = p.y + BOAT_R, bot = p.y + p.h - BOAT_R;
        if (b.x < l) { b.x = l; b.vx = Math.abs(b.vx) * 0.55; }
        if (b.x > rgt) { b.x = rgt; b.vx = -Math.abs(b.vx) * 0.55; }
        if (b.y < t) { b.y = t; b.vy = Math.abs(b.vy) * 0.55; }
        if (b.y > bot) { b.y = bot; b.vy = -Math.abs(b.vy) * 0.55; }
        // rocks
        for (const k of this.rocks) {
          const dx = b.x - k.x, dy = b.y - k.y, d = Math.hypot(dx, dy), md = k.r + BOAT_R - 2;
          if (d < md && d > 0) {
            const nx = dx / d, ny = dy / d; b.x = k.x + nx * md; b.y = k.y + ny * md;
            const vn = b.vx * nx + b.vy * ny;
            if (vn < 0) { b.vx -= 1.6 * vn * nx; b.vy -= 1.6 * vn * ny; if (-vn > 30) this.events.push({ type: 'bump' }); }
          }
        }
        // lily wall pads: boats bounce off and shove them a little
        for (const w of this.wall) {
          if (w.sinking) continue;
          const dx = b.x - w.x, dy = b.y - w.y, d = Math.hypot(dx, dy), md = w.r + BOAT_R - 2;
          if (d < md && d > 0) {
            const nx = dx / d, ny = dy / d; b.x = w.x + nx * md; b.y = w.y + ny * md;
            const vn = b.vx * nx + b.vy * ny;
            if (vn < 0) { b.vx -= 1.5 * vn * nx; b.vy -= 1.5 * vn * ny; w.vx += vn * nx * 0.35; w.vy += vn * ny * 0.35; }
          }
        }
        // other boats
        for (const o of this.boats) {
          if (o === b || o.state !== 'in') continue;
          const dx = b.x - o.x, dy = b.y - o.y, d = Math.hypot(dx, dy), md = BOAT_R * 2;
          if (d < md && d > 0) { const push = (md - d) / 2, nx = dx / d, ny = dy / d; b.x += nx * push; b.y += ny * push; b.vx += nx * 20; b.vy += ny * 20; }
        }
        // docks: matching colour takes the boat (only while playing), others push it away
        for (const d of this.docks) {
          if (d.moving && d.fade > 0.5) continue;
          const dd = Math.hypot(b.x - d.x, b.y - d.y);
          if (dd < d.r - 6) {
            if (d.ci === b.ci || b.gold) { if (playing) { this.dockBoat(b, d); break; } }
            else if (this.t - b.noped > 0.6) { b.noped = this.t; if (playing) this.events.push({ type: 'nope', x: b.x, y: b.y }); }
          }
          if (d.ci !== b.ci && !b.gold && dd < d.r + BOAT_R && dd > 0) {
            const nx = (b.x - d.x) / dd, ny = (b.y - d.y) / dd; b.vx += nx * 160 * dt * 6; b.vy += ny * 160 * dt * 6;
          }
        }
        if (b.state === 'in') {
          if (sp > 4) b.ang += ((Math.atan2(b.vy, b.vx) - b.ang + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 4);
          if (playing && this.freezeT <= 0) b.age += dt;
          b.wake += dt * sp;
          if (b.wake > 26) { b.wake = 0; this.events.push({ type: 'wake', x: b.x - Math.cos(b.ang) * 12, y: b.y - Math.sin(b.ang) * 12 }); }
          if (playing && b.age >= b.life) this.loseBoat(b);
        }
      } else if (b.state === 'dock' && b.dock) {
        b.k += dt * 2.2;
        b.x += (b.dock.x - b.x) * Math.min(1, dt * 6); b.y += (b.dock.y - b.y) * Math.min(1, dt * 6);
      } else if (b.state === 'sink') {
        b.k += dt * 0.9; b.vx *= 0.95; b.vy *= 0.95; b.x += b.vx * dt; b.y += b.vy * dt;
      }
    }
    if (this.boats.some(b => b.state !== 'in' && b.k >= 1)) this.boats = this.boats.filter(b => !(b.state !== 'in' && b.k >= 1));

    this.updateWall(dt);

    for (const d of this.docks) {
      if (!d.moving) continue;
      d.fade += dt * 1.2;
      if (d.fade >= 1 && !d.moved) {
        const pt = this.placeInPond(d.r + 26, [...this.docks.filter(o => o !== d), ...this.rocks], 130);
        d.x = pt.x; d.y = pt.y; d.moved = true; d.got = 0;
      }
      if (d.fade >= 2) { d.moving = false; d.moved = false; d.fade = 0; }
    }
  }
}
