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
    this.vx = v.vx; this.vy = v.vy; this.state = 'flying';
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

  step(dt: number) {
    if (this.state === 'flying') {
      const n = Math.max(1, Math.ceil(dt / STEP)), h = dt / n;
      for (let i = 0; i < n; i++) {
        this.t += h;
        this.flightTime += h;
        this.vy += GRAV * h;
        this.x += this.vx * h;
        this.y += this.vy * h;
        this.vx *= 1 - AIR_DRAG * h;
        this.rot += this.vx * h * 0.06;
        if (this.late && this.t - this.late.t > GOOD) this.late = null;
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
        if (!o.got && Math.abs(dx) < 12 && Math.abs(this.y + o.h) < 22) {
          o.got = true;
          this.vx = Math.min(MAX_VX, this.vx + HOOP_BOOST);
          this.hoops++;
          this.emit({ type: 'hoop', obj: o });
        }
      } else if (o.type === 'glass') {
        const reach = this.fever ? 1.6 : 1;
        if (!o.got && Math.abs(dx) < 22 * reach && Math.abs(this.y + o.h) < 24 * reach) {
          o.got = true;
          this.vx = Math.min(MAX_VX, this.vx + 8);
          this.glass++;
          this.emit({ type: 'glass', obj: o });
        }
      } else if (o.type === 'duck' && !o.fly && Math.abs(dx) < 18 && this.y > -30) {
        o.fly = true; o.vy = -90;
        this.vx *= 0.75;
        this.emit({ type: 'duck', obj: o });
      }
    }
  }

  private clearTiming() { this.pendingTap = null; this.fumbled = false; this.late = null; }

  /** Outgoing horizontal and upward speed for a plain water contact of a given grade. */
  private bounce(vxIn: number, vyIn: number, a: number, grade: Grade) {
    let vx: number, up: number;
    if (grade === 'perfect') {
      vx = Math.min(MAX_VX, vxIn);
      up = Math.max(HOP_V, vyIn * 0.55 + vx * 0.13);
    } else if (grade === 'good') {
      vx = Math.min(MAX_VX, vxIn * 0.97);
      up = Math.max(HOP_V * 0.8, vyIn * 0.55 + vx * 0.13);
    } else {
      vx = vxIn * (0.95 - Math.max(0, a - 12) * 0.006);
      up = Math.max(110, vyIn * 0.55 + vx * 0.13);
    }
    return { vx, up };
  }

  private contact(s: Obj | null) {
    if (s && s.type === 'log') {
      this.vx *= 0.62; this.vy = -260; this.y = LOG_TOP;
      this.clearTiming();
      this.emit({ type: 'log', obj: s, x: this.x, y: this.y });
      if (this.vx < SINK_V) this.startSink(false);
      return;
    }
    if (s && s.type === 'pad') {
      this.vx = Math.min(MAX_VX, this.vx + 70); this.vy = -HOP_V * 1.1; this.y = -4; s.sq = 1;
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
    if (!this.fumbled && this.pendingTap !== null) {
      const err = this.t - this.pendingTap;
      grade = err <= PERFECT ? 'perfect' : err <= GOOD ? 'good' : 'miss';
    }
    const fumbled = this.fumbled;
    const tapped = fumbled || this.pendingTap !== null;
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
    if (grade === 'perfect') { this.streak = before + 1; this.perfects++; }
    else if (grade === 'good') this.streak = before;
    else this.streak = 0;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
  }

  /** A tap just after a plain skip upgrades that same skip. */
  private upgradeLate(err: number) {
    const L = this.late!;
    this.late = null;
    const grade: Grade = err <= PERFECT ? 'perfect' : 'good';
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
