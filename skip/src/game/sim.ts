// The whole game rule set, with no Phaser or DOM in it, so it can run headless in a bot.
//
// Coordinates are logical units (the prototype's `scale = min(ch/560, cw/430)` world).
// x grows along the lake from the pier; y is measured from the water line (0), negative is up.

export const GRAV = 1300;
export const HOP_V = 640; // upward speed of a Perfect hop
export const SINK_V = 140; // below this horizontal speed the stone sinks
export const MAX_SKIP_ANGLE = 36; // a first contact steeper than this plunks
export const PX_PER_M = 40;
export const MAX_VX = 1300;
export const AIR_DRAG = 0.02; // fraction of horizontal speed lost per second in the air

// Tap timing windows, in seconds either side of the moment the stone touches the water.
export const PERFECT = 0.06;
export const GOOD = 0.12;
/** The timing ring appears this long before the stone reaches the water. */
export const RING_T = 0.55;
/** Perfect streak that starts Fever: lake glass is pulled in from further away. */
export const FEVER = 8;
/** Speed boost for flying through a glass hoop. */
export const HOOP_BOOST = 60;
export const HOOP_H = 118; // hoop centre height above the water

export const REST_Y = -64; // stone resting height on the pier
const WATER_TOP = -3;
const LOG_TOP = -14;
const STEP = 0.004;

export type Grade = 'perfect' | 'good' | 'miss';

/** How a stone handles. Pebble is the baseline; every other stone trades something away. */
export interface StoneDef {
  id: string;
  /** Throw speed multiplier. */
  power: number;
  perfect: number;
  good: number;
  /** Upward speed of a Perfect hop (a Good gets 80% of it). */
  hop: number;
  maxVx: number;
  drag: number;
  /** Added to the fraction of speed kept on a missed skip (0.95 for a Pebble). */
  missKeep: number;
  /** Fraction of speed kept after a log / a duck. */
  logKeep: number;
  duckKeep: number;
  /** Misses forgiven per throw (turned into a Good). */
  lucky: number;
  /** Multiplier on the hoop catch area. */
  hoopReach: number;
}

export const STONES: Record<string, StoneDef> = {
  pebble: { id: 'pebble', power: 1, perfect: PERFECT, good: GOOD, hop: HOP_V, maxVx: MAX_VX, drag: AIR_DRAG, missKeep: 0, logKeep: 0.62, duckKeep: 0.75, lucky: 0, hoopReach: 1 },
  // fast and far for precise players; a tighter window punishes sloppy ones
  flat: { id: 'flat', power: 1.15, perfect: 0.05, good: 0.1, hop: 600, maxVx: 1550, drag: 0.012, missKeep: -0.015, logKeep: 0.7, duckKeep: 0.72, lucky: 0, hoopReach: 1 },
  // forgiving and steady, but slow with a low ceiling
  heavy: { id: 'heavy', power: 0.85, perfect: 0.085, good: 0.15, hop: 600, maxVx: 1000, drag: 0.03, missKeep: 0.02, logKeep: 0.7, duckKeep: 0.82, lucky: 0, hoopReach: 1 },
  // big hops with a wide hoop reach (hoops pay coins), but a tight window
  bouncy: { id: 'bouncy', power: 1, perfect: 0.05, good: 0.1, hop: 720, maxVx: MAX_VX, drag: 0.02, missKeep: -0.01, logKeep: 0.62, duckKeep: 0.75, lucky: 0, hoopReach: 2.2 },
  // forgives one broken streak per throw, a touch slower
  lucky: { id: 'lucky', power: 0.95, perfect: PERFECT, good: GOOD, hop: HOP_V, maxVx: 1250, drag: 0.022, missKeep: 0, logKeep: 0.62, duckKeep: 0.75, lucky: 1, hoopReach: 1 },
};
/**
 * Each character's ability, one move each: a meter fills with Perfects, then a
 * tap on the ability button fires it mid-throw. Ids are the stone ids.
 */
export type AbilityId = 'pebble' | 'flat' | 'heavy' | 'bouncy' | 'lucky';
export const ABILITIES: Record<AbilityId, { name: string; text: string }> = {
  pebble: { name: 'Second Wind', text: 'Kicks off the water again, full speed, wherever you are.' },
  flat: { name: 'Zoom', text: 'A burst of speed that bowls through ducks.' },
  heavy: { name: 'Belly Flop', text: 'Slams down for a sure Perfect and clears logs and ducks ahead.' },
  bouncy: { name: 'Boing', text: 'A huge hop, right up to the hoops.' },
  lucky: { name: 'Glass Magnet', text: 'Pulls in every piece of lake glass nearby for a few seconds.' },
};
/** Perfects that fill the meter from empty, and how full it starts each throw. */
export const CHARGE_PERFECTS = 6, CHARGE_START = 0.5;
const ZOOM_V = 420, ZOOM_T = 1.2, MAGNET_T = 4, MAGNET_REACH = 4, FLOP_CLEAR = 650;

export type SimState = 'ready' | 'flying' | 'sinking' | 'over';

export interface Obj {
  id: number;
  type: 'log' | 'pad' | 'duck' | 'glass' | 'hoop';
  x: number;
  w: number;
  h: number; // glass: height above the water
  ph: number;
  flower: boolean;
  got: boolean; // glass collected
  gt: number; // time since collected
  fly: boolean; // duck flying away
  vy: number;
  yOff: number;
  sq: number; // pad squash 0..1
}

export type SimEvent =
  | { type: 'throw'; power: number }
  | { type: 'skip'; grade: Grade; x: number; skips: number; streak: number; fumbled: boolean }
  | { type: 'upgrade'; grade: Grade; x: number; skips: number; streak: number }
  | { type: 'pad'; obj: Obj; x: number; skips: number }
  | { type: 'log'; obj: Obj; x: number; y: number }
  | { type: 'duck'; obj: Obj }
  | { type: 'glass'; obj: Obj }
  | { type: 'hoop'; obj: Obj }
  | { type: 'lucky'; x: number }
  | { type: 'ability'; id: AbilityId; x: number; y: number }
  | { type: 'charged' }
  | { type: 'early'; x: number; y: number }
  | { type: 'queued' }
  | { type: 'plunk'; x: number }
  | { type: 'sink'; x: number }
  | { type: 'over' }
  | { type: 'spawn'; obj: Obj }
  | { type: 'despawn'; obj: Obj };

export interface Velocity { vx: number; vy: number; power: number }

/** Deterministic RNG so bot runs are repeatable. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Pull vector (start minus current, logical units) to launch velocity. Pull back to throw forward. */
export function aimVelocity(dx: number, dy: number): Velocity {
  const len = Math.hypot(dx, dy);
  const power = clamp(len / 150, 0, 1);
  const ang = clamp(Math.atan2(-dy, Math.max(dx, 1)), -0.1, 1.05);
  const sp = 260 + 860 * power;
  return { vx: Math.cos(ang) * sp, vy: -Math.sin(ang) * sp, power };
}

/** The throw's path up to its first touch of the water, for the dotted preview. */
export function previewThrow(v: Velocity, out: { x: number; y: number }[]) {
  out.length = 0;
  let x = 0, y = REST_Y, vx = v.vx, vy = v.vy;
  const h = 1 / 60;
  for (let i = 0; i < 160; i++) {
    vy += GRAV * h; x += vx * h; y += vy * h;
    if (i % 3 === 0) out.push({ x, y });
    if (y >= WATER_TOP) break;
  }
  const angle = (Math.atan2(vy, vx) * 180) / Math.PI;
  return { angle, endX: x, ok: angle <= MAX_SKIP_ANGLE };
}

interface LateWindow { t: number; vxIn: number; vyIn: number; a: number; streakBefore: number }

export class Sim {
  state: SimState = 'ready';
  t = 0;
  x = 0; y = REST_Y; vx = 0; vy = 0; rot = 0;
  sinkT = 0;
  skips = 0;
  streak = 0;
  bestStreak = 0;
  glass = 0;
  perfects = 0;
  hoops = 0;
  plunked = false;
  flightTime = 0;
  /** Sim time of an early tap waiting for the next contact. */
  pendingTap: number | null = null;
  /** A tap came too early: the next contact is a miss whatever happens. */
  fumbled = false;
  late: LateWindow | null = null;
  stone: StoneDef = STONES.pebble;
  luckyLeft = 0;
  luckySaves = 0;
  pads = 0;
  ducks = 0;
  fevers = 0;
  /** Ability meter, 0..1; full means the ability can fire. */
  charge = CHARGE_START;
  abilities = 0;
  /** Seconds left of Zoom (bowls through ducks) and Glass Magnet. */
  zoomT = 0;
  magnetT = 0;
  /** Belly Flop on its way down: the next water contact is a sure Perfect. */
  flop = false;
  objs: Obj[] = [];
  viewW = 430;
  private nextX = 560;
  private nextId = 1;
  private rand: () => number;
  private events: SimEvent[] = [];

  constructor(seed = (Math.random() * 2 ** 32) >>> 0) {
    this.rand = mulberry32(seed);
  }

  reset(seed = (Math.random() * 2 ** 32) >>> 0) {
    this.rand = mulberry32(seed);
    this.state = 'ready';
    this.t = 0; this.x = 0; this.y = REST_Y; this.vx = 0; this.vy = 0; this.rot = 0; this.sinkT = 0;
    this.skips = 0; this.streak = 0; this.bestStreak = 0; this.glass = 0; this.perfects = 0; this.hoops = 0;
    this.luckyLeft = this.stone.lucky; this.luckySaves = 0; this.pads = 0; this.ducks = 0; this.fevers = 0;
    this.charge = CHARGE_START; this.abilities = 0; this.zoomT = 0; this.magnetT = 0; this.flop = false;
    this.plunked = false; this.flightTime = 0;
    this.pendingTap = null; this.fumbled = false; this.late = null;
    for (const o of this.objs) this.emit({ type: 'despawn', obj: o });
    this.objs = [];
    this.nextX = 560;
    this.spawnAhead();
  }

  /** Drain the events produced since the last call. */
  drain(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
  private emit(e: SimEvent) { this.events.push(e); }
  private r(a: number, b: number) { return a + this.rand() * (b - a); }

  get fever() { return this.state === 'flying' && this.streak >= FEVER; }

  get metres() { return Math.floor(Math.max(0, this.x / PX_PER_M)); }

  throwStone(v: Velocity) {
    if (this.state !== 'ready' || v.power < 0.08) return false;
    this.vx = v.vx * this.stone.power; this.vy = v.vy * this.stone.power; this.state = 'flying';
    this.emit({ type: 'throw', power: v.power });
    return true;
  }

  /** Seconds until the stone reaches the water line, ignoring obstacles. */
  timeToWater() {
    const d = WATER_TOP - this.y;
    if (d <= 0) return 0;
    return (-this.vy + Math.sqrt(this.vy * this.vy + 2 * GRAV * d)) / GRAV;
  }

  /** The single in-flight input. Timing is everything: see the windows at the top. */
  tap() {
    if (this.state !== 'flying') return;
    if (this.pendingTap !== null || this.fumbled) return; // one tap per splash
    const ttw = this.timeToWater();
    const GOOD = this.stone.good;
    const lateErr = this.late && this.t - this.late.t <= GOOD ? this.t - this.late.t : Infinity;
    if (lateErr !== Infinity && (lateErr <= ttw || ttw > GOOD)) {
      this.upgradeLate(lateErr);
      return;
    }
    if (ttw <= GOOD) {
      this.pendingTap = this.t;
      this.emit({ type: 'queued' });
      return;
    }
    this.fumbled = true;
    this.late = null;
    this.emit({ type: 'early', x: this.x, y: this.y });
  }

  /** Can the ability fire right now? */
  get ready() { return this.state === 'flying' && this.charge >= 1; }

  /** Fire this character's ability; false if the meter isn't full or the stone isn't flying. */
  ability() {
    if (!this.ready) return false;
    this.charge = 0;
    this.abilities++;
    const id = this.stone.id as AbilityId;
    switch (id) {
      case 'pebble': // off the water again, as if from a fresh Perfect
        this.vx = Math.max(this.vx, Math.min(this.stone.maxVx, 620));
        this.vy = -this.stone.hop * 1.1;
        break;
      case 'flat':
        this.vx = Math.min(this.stone.maxVx * 1.3, this.vx + ZOOM_V);
        this.zoomT = ZOOM_T;
        break;
      case 'heavy': {
        this.vy = Math.max(this.vy, 900);
        this.flop = true;
        // the splash it's about to make clears the way ahead
        for (const o of this.objs) {
          if (o.x < this.x || o.x > this.x + FLOP_CLEAR) continue;
          if (o.type === 'log') { o.x = -1e6; }
          else if (o.type === 'duck' && !o.fly) { o.fly = true; o.vy = -90; this.ducks++; this.emit({ type: 'duck', obj: o }); }
        }
        break;
      }
      case 'bouncy':
        this.vy = -this.stone.hop * 1.85;
        break;
      case 'lucky':
        this.magnetT = MAGNET_T;
        break;
    }
    this.clearTiming();
    this.emit({ type: 'ability', id, x: this.x, y: this.y });
    return true;
  }

  step(dt: number) {
    if (this.zoomT > 0) this.zoomT = Math.max(0, this.zoomT - dt);
    if (this.magnetT > 0) this.magnetT = Math.max(0, this.magnetT - dt);
    if (this.state === 'flying') {
      const n = Math.max(1, Math.ceil(dt / STEP)), h = dt / n;
      for (let i = 0; i < n; i++) {
        this.t += h;
        this.flightTime += h;
        this.vy += GRAV * h;
        this.x += this.vx * h;
        this.y += this.vy * h;
        this.vx *= 1 - this.stone.drag * h;
        if (this.vx > this.stone.maxVx && this.zoomT <= 0) this.vx = Math.max(this.stone.maxVx, this.vx - 600 * h); // Zoom wears off
        this.rot += this.vx * h * 0.06;
        if (this.late && this.t - this.late.t > this.stone.good) {
          // no late tap came: a Lucky stone saves the streak instead
          if (this.luckyLeft > 0 && this.late.streakBefore >= 1) {
            this.luckyLeft--;
            this.luckySaves++;
            this.emit({ type: 'lucky', x: this.x });
            this.upgradeLate(this.stone.good, true);
          } else this.late = null;
        }
        this.collide();
        const s = this.surfaceAt(this.x);
        const top = s && s.type === 'log' ? LOG_TOP : WATER_TOP;
        if (this.vy > 0 && this.y >= top) {
          this.y = top;
          this.contact(s);
          if (this.state !== 'flying') break;
        }
      }
    } else if (this.state === 'sinking') {
      this.t += dt;
      this.sinkT += dt;
      this.x += this.vx * dt;
      this.vx *= 1 - 3 * dt;
      this.y += 34 * dt;
      if (this.sinkT > 1.1) {
        this.state = 'over';
        this.emit({ type: 'over' });
      }
    }
    this.updateObjs(dt);
    this.spawnAhead();
  }

  private spawnGlass(x: number, high: boolean) {
    const n = 3 + Math.floor(this.rand() * 3);
    for (let i = 0; i < n; i++) {
      const h = high ? 100 + Math.sin((i / Math.max(1, n - 1)) * Math.PI) * 36 : 36;
      this.add({ type: 'glass', x: x + i * 34, h, ph: this.rand() * 6 });
    }
  }

  private add(p: Partial<Obj> & { type: Obj['type']; x: number }) {
    const o: Obj = {
      id: this.nextId++, w: 30, h: 0, ph: 0, flower: false, got: false, gt: 0, fly: false, vy: 0, yOff: 0, sq: 0,
      ...p,
    };
    this.objs.push(o);
    this.emit({ type: 'spawn', obj: o });
  }

  private spawnAhead() {
    const camX = this.x - this.viewW * 0.22;
    let guard = 0;
    while (this.nextX < camX + this.viewW + 600 && guard++ < 60) {
      const nx = this.nextX;
      const ease = Math.min(1, nx / PX_PER_M / 500);
      const gap = Math.max(220, this.r(340, 680) - ease * 150);
      const r = this.rand();
      if (nx < 900) this.spawnGlass(nx, false);
      else if (r < 0.22 + ease * 0.08) this.add({ type: 'log', x: nx, w: this.r(80, 140), ph: this.rand() * 6 });
      else if (r < 0.45 + ease * 0.1) this.add({ type: 'duck', x: nx, ph: this.rand() * 6 });
      else if (r < 0.66) this.add({ type: 'pad', x: nx, w: this.r(62, 78), flower: this.rand() < 0.45 });
      else this.spawnGlass(nx, this.rand() < 0.55);
      if (nx > 900 && this.rand() < 0.3) this.spawnGlass(nx + gap * 0.5, this.rand() < 0.5);
      // glass hoops hang at Perfect-hop height: only a well-timed stone flies through
      else if (nx > 1600 && this.rand() < 0.14) this.add({ type: 'hoop', x: nx + gap * 0.5, h: HOOP_H, ph: this.rand() * 6 });
      this.nextX += gap;
    }
  }

  private updateObjs(dt: number) {
    const left = this.x - this.viewW * 0.22 - 200;
    let j = 0;
    for (const o of this.objs) {
      if (o.fly) { o.vy -= 320 * dt; o.yOff += o.vy * dt; o.x += 130 * dt; }
      if (o.got) o.gt += dt;
      if (o.sq > 0) o.sq = Math.max(0, o.sq - dt * 3);
      const gone = o.x + o.w < left || (o.type === 'glass' && o.gt > 0.5) || o.yOff < -600;
      if (gone) this.emit({ type: 'despawn', obj: o });
      else this.objs[j++] = o;
    }
    this.objs.length = j;
  }

  surfaceAt(x: number) {
    for (const o of this.objs) {
      if (o.type === 'log' && x >= o.x && x <= o.x + o.w) return o;
      if (o.type === 'pad' && Math.abs(x - o.x) < o.w / 2) return o;
    }
    return null;
  }

  private collide() {
    for (const o of this.objs) {
      const dx = this.x - o.x;
      if (dx < -60 || dx > 220) continue;
      if (o.type === 'hoop') {
        const hr = this.stone.hoopReach;
        if (!o.got && Math.abs(dx) < 12 * hr && Math.abs(this.y + o.h) < 22 * hr) {
          o.got = true;
          this.vx = Math.min(this.stone.maxVx, this.vx + HOOP_BOOST);
          this.hoops++;
          this.emit({ type: 'hoop', obj: o });
        }
      } else if (o.type === 'glass') {
        const reach = this.magnetT > 0 ? MAGNET_REACH : this.fever ? 1.6 : 1;
        if (!o.got && Math.abs(dx) < 22 * reach && Math.abs(this.y + o.h) < 24 * reach) {
          o.got = true;
          this.vx = Math.min(this.stone.maxVx, this.vx + 8);
          this.glass++;
          this.emit({ type: 'glass', obj: o });
        }
      } else if (o.type === 'duck' && !o.fly && Math.abs(dx) < 18 && this.y > -30) {
        o.fly = true; o.vy = -90;
        if (this.zoomT <= 0) this.vx *= this.stone.duckKeep; // Zoom bowls straight through
        this.ducks++;
        this.emit({ type: 'duck', obj: o });
      }
    }
  }

  private clearTiming() { this.pendingTap = null; this.fumbled = false; this.late = null; }

  /** Outgoing horizontal and upward speed for a plain water contact of a given grade. */
  private bounce(vxIn: number, vyIn: number, a: number, grade: Grade) {
    let vx: number, up: number;
    if (grade === 'perfect') {
      vx = Math.min(this.stone.maxVx, vxIn);
      up = Math.max(this.stone.hop, vyIn * 0.55 + vx * 0.13);
    } else if (grade === 'good') {
      vx = Math.min(this.stone.maxVx, vxIn * 0.97);
      up = Math.max(this.stone.hop * 0.8, vyIn * 0.55 + vx * 0.13);
    } else {
      vx = vxIn * (0.95 + this.stone.missKeep - Math.max(0, a - 12) * 0.006);
      up = Math.max(110, vyIn * 0.55 + vx * 0.13);
    }
    return { vx, up };
  }

  private contact(s: Obj | null) {
    if (s && s.type === 'log') {
      this.vx *= this.stone.logKeep; this.vy = -260; this.y = LOG_TOP;
      this.clearTiming();
      this.emit({ type: 'log', obj: s, x: this.x, y: this.y });
      if (this.vx < SINK_V) this.startSink(false);
      return;
    }
    if (s && s.type === 'pad') {
      this.vx = Math.min(this.stone.maxVx, this.vx + 70); this.vy = -this.stone.hop * 1.1; this.y = -4; s.sq = 1;
      this.pads++;
      this.clearTiming();
      this.skips++;
      this.emit({ type: 'pad', obj: s, x: this.x, skips: this.skips });
      return;
    }
    const angle = (Math.atan2(this.vy, this.vx) * 180) / Math.PI;
    // only the throw itself can plunk; later bounces always skip
    if (this.skips === 0 && angle > MAX_SKIP_ANGLE) {
      this.plunked = true;
      this.clearTiming();
      this.startSink(true);
      return;
    }
    const a = this.skips === 0 ? angle : Math.min(angle, 20);
    let grade: Grade = 'miss';
    if (this.flop) { this.flop = false; this.pendingTap = this.t; this.fumbled = false; } // Belly Flop: a sure Perfect
    if (!this.fumbled && this.pendingTap !== null) {
      const err = this.t - this.pendingTap;
      grade = err <= this.stone.perfect ? 'perfect' : err <= this.stone.good ? 'good' : 'miss';
    }
    const fumbled = this.fumbled;
    const tapped = fumbled || this.pendingTap !== null;
    // Lucky stone: a mistimed tap that would break a streak counts as a Good, once per throw
    if (grade === 'miss' && tapped && this.luckyLeft > 0 && this.streak >= 1) {
      grade = 'good';
      this.luckyLeft--;
      this.luckySaves++;
      this.emit({ type: 'lucky', x: this.x });
    }
    const vxIn = this.vx, vyIn = this.vy, streakBefore = this.streak;
    const res = this.bounce(vxIn, vyIn, a, grade);
    this.vx = res.vx;
    this.vy = -res.up;
    this.y = -4;
    this.skips++;
    this.setStreak(grade, streakBefore);
    this.clearTiming();
    this.emit({ type: 'skip', grade, x: this.x, skips: this.skips, streak: this.streak, fumbled });
    if (this.vx < SINK_V) {
      this.startSink(false); // a dying stone can't be rescued by a late tap
      return;
    }
    if (!tapped) this.late = { t: this.t, vxIn, vyIn, a, streakBefore };
  }

  private setStreak(grade: Grade, before: number) {
    if (grade === 'perfect') {
      this.streak = before + 1;
      this.perfects++;
      if (this.charge < 1) {
        this.charge = Math.min(1, this.charge + 1 / CHARGE_PERFECTS);
        if (this.charge >= 1) this.emit({ type: 'charged' });
      }
      if (this.streak === FEVER) this.fevers++;
    }
    else if (grade === 'good') this.streak = before;
    else this.streak = 0;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
  }

  /** A tap just after a plain skip upgrades that same skip. */
  private upgradeLate(err: number, lucky = false) {
    const L = this.late!;
    this.late = null;
    const grade: Grade = !lucky && err <= this.stone.perfect ? 'perfect' : 'good';
    const res = this.bounce(L.vxIn, L.vyIn, L.a, grade);
    this.vx = res.vx;
    this.vy = Math.min(this.vy, -res.up + GRAV * err * 0.5);
    this.setStreak(grade, L.streakBefore);
    this.emit({ type: 'upgrade', grade, x: this.x, skips: this.skips, streak: this.streak });
  }

  private startSink(plunk: boolean) {
    this.state = 'sinking';
    this.sinkT = 0;
    this.vy = 0;
    this.y = -3;
    if (plunk) {
      this.vx *= 0.2;
      this.emit({ type: 'plunk', x: this.x });
    } else this.emit({ type: 'sink', x: this.x });
  }
}
