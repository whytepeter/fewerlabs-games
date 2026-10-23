// Headless playtest: `npm run bot` (or `node src/tools/bot.mjs 300`). Needs Node 22.18+, which
// strips the types from sim.ts on import. Not part of the app bundle.
// Same strong throw every time, four tapping styles, 60 fps frames like a phone.
import { Sim, STONES, aimVelocity, previewThrow, mulberry32, PX_PER_M } from '../game/sim.ts';
import { coinsForRun } from '../game/progress.ts';

// `npm run bot:skip -- 300` for the default Pebble, `STONE=flat npm run bot:skip`, or
// `STONES=1 npm run bot:skip -- 200` for a compact table of every stone.
let stoneId = process.env.STONE ?? 'pebble';

const FPS = 60, DT = 1 / FPS, RUNS = Number(process.argv[2] ?? 300);

// strongest pull at the flattest angle that reaches far: pick the best no-tap angle once
function bestThrow() {
  let best = { dx: 150, dy: 0, d: 0 };
  for (let deg = 0; deg <= 45; deg += 1) {
    const a = (deg * Math.PI) / 180;
    const dx = Math.cos(a) * 160, dy = Math.sin(a) * 160; // pull down-left = throw up-right
    const v = aimVelocity(dx, dy);
    if (!previewThrow(v, []).ok) continue;
    let tot = 0;
    for (let s = 1; s <= 40; s++) tot += play({ name: '', mode: 'none' }, s, { dx, dy }).m;
    if (tot > best.d) best = { dx, dy, d: tot };
  }
  return best;
}

const grades = { perfect: 0, good: 0, miss: 0 }, hits = { log: 0, duck: 0, pad: 0 };
function play(style, seed, pull) {
  const sim = new Sim(seed);
  sim.stone = STONES[stoneId];
  sim.viewW = 430;
  sim.reset(seed);
  const rng = mulberry32(seed * 7 + 1);
  const v = aimVelocity(pull.dx, pull.dy);
  sim.throwStone(v);
  let contacts = 0, lastContactT = -1;
  let plan = null;
  const sample = () => {
    if (!style.err) return 0;
    if (style.gauss) {
      const u = 1 - rng(), w = rng();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * w) * style.err;
    }
    return (rng() * 2 - 1) * style.err;
  };
  let frames = 0;
  while (sim.state === 'flying' || sim.state === 'sinking') {
    if (sim.state === 'flying') {
      if (style.mode === 'spam') sim.tap();
      else if (style.mode === 'timed') {
        if (!plan || (plan.done && contacts >= plan.k) || (!plan.done && contacts > plan.k)) plan = { k: contacts + 1, e: sample(), done: false };
        if (!plan.done) {
          // a frame only exists every 16.7 ms, so an intended tap lands on the first frame at or after it
          const early = plan.e < 0 && contacts === plan.k - 1 && sim.timeToWater() <= -plan.e;
          const late = contacts === plan.k && sim.t - lastContactT >= Math.max(0, plan.e);
          if (early || late) { sim.tap(); plan.done = true; }
        }
      }
    }
    sim.step(DT);
    for (const e of sim.drain()) {
      if (e.type === 'skip' || e.type === 'pad' || e.type === 'log') { contacts++; lastContactT = sim.t; }
      if (e.type === 'skip') grades[e.grade]++;
      if (e.type === 'log') hits.log++;
      if (e.type === 'duck') hits.duck++;
      if (e.type === 'pad') hits.pad++;
      if (e.type === 'upgrade') { grades.miss--; grades[e.grade]++; }
    }
    if (++frames > FPS * 600) break;
  }
  return { m: sim.x / PX_PER_M, s: sim.flightTime, skips: sim.skips, streak: sim.bestStreak, glass: sim.glass, perfects: sim.perfects, hoops: sim.hoops, coins: coinsForRun(sim.metres, sim.perfects, sim.hoops).total };
}

stoneId = 'pebble';
const pull = bestThrow();
if (process.env.STONES) {
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const pick = [
    { name: 'never', mode: 'none' }, { name: 'spam', mode: 'spam' }, { name: 'u25', mode: 'timed', err: 0.025 },
    { name: 'u40', mode: 'timed', err: 0.04 }, { name: 'g40', mode: 'timed', err: 0.04, gauss: true }, { name: 'g70', mode: 'timed', err: 0.07, gauss: true },
  ];
  console.log(`median m / median s / coins per throw, ${RUNS} seeds\n` + 'stone   '.padEnd(9) + pick.map(p => p.name.padStart(20)).join(''));
  for (const id of Object.keys(STONES)) {
    stoneId = id;
    const cells = pick.map(st => {
      const rs = Array.from({ length: RUNS }, (_, i) => play(st, i + 1, pull));
      const med = (k) => rs.map(r => r[k]).sort((x, y) => x - y)[Math.floor(RUNS / 2)];
      return `${med('m').toFixed(0)}m ${med('s').toFixed(0)}s ${avg(rs.map(r => r.coins)).toFixed(0)}c h${avg(rs.map(r => r.hoops)).toFixed(1)}`.padStart(20);
    });
    console.log(id.padEnd(9) + cells.join(''));
  }
  process.exit(0);
}
stoneId = process.env.STONE ?? 'pebble';
const deg = Math.round((Math.atan2(pull.dy, pull.dx) * 180) / Math.PI);
console.log(`throw: full power, pull angle ${deg} deg, ${RUNS} seeds each\n`);
const styles = [
  { name: '(a) never tap', mode: 'none' },
  { name: '(b) spam every frame', mode: 'spam' },
  { name: '(c) timed, uniform +-40 ms', mode: 'timed', err: 0.04 },
  { name: '(d) timed, uniform +-70 ms', mode: 'timed', err: 0.07 },
  { name: '(c2) timed, gaussian sd 40 ms', mode: 'timed', err: 0.04, gauss: true },
  { name: '(d2) timed, gaussian sd 70 ms', mode: 'timed', err: 0.07, gauss: true },
];
const pct = (a, p) => a.slice().sort((x, y) => x - y)[Math.floor((a.length - 1) * p)];
for (const st of styles) {
  Object.assign(grades, { perfect: 0, good: 0, miss: 0 }); Object.assign(hits, { log: 0, duck: 0, pad: 0 });
  const rs = Array.from({ length: RUNS }, (_, i) => play(st, i + 1, pull));
  const m = rs.map(r => r.m), s = rs.map(r => r.s);
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  console.log(
    `${st.name.padEnd(32)} dist m: med ${pct(m, 0.5).toFixed(0).padStart(5)} p10 ${pct(m, 0.1).toFixed(0).padStart(5)} p90 ${pct(m, 0.9).toFixed(0).padStart(5)} | ` +
    `time s: med ${pct(s, 0.5).toFixed(1).padStart(5)} p10 ${pct(s, 0.1).toFixed(1).padStart(5)} p90 ${pct(s, 0.9).toFixed(1).padStart(5)} | ` +
    `skips ${avg(rs.map(r => r.skips)).toFixed(0).padStart(3)} perf ${avg(rs.map(r => r.perfects)).toFixed(0).padStart(3)} bestStreak ${avg(rs.map(r => r.streak)).toFixed(0).padStart(3)} glass ${avg(rs.map(r => r.glass)).toFixed(1)} hoops ${avg(rs.map(r => r.hoops)).toFixed(1)} coins ${avg(rs.map(r => r.coins)).toFixed(0)}`,
  );
  if (process.env.V) console.log('   per throw: perfect/good/miss', [grades.perfect, grades.good, grades.miss].map(x => (x / RUNS).toFixed(1)).join('/'), ' log/duck/pad', [hits.log, hits.duck, hits.pad].map(x => (x / RUNS).toFixed(1)).join('/'),
  );
}
