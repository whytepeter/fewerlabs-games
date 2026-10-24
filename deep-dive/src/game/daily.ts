import { coins, metaChanged } from '../core/meta';
import { hashString, mulberry32, todayKey } from '../core/rng';
import { store } from '../core/settings';
import { BOOSTERS, boosters, type BoosterId } from './boosters';
import { CAVES, type CaveDef } from './caves';

/**
 * The Daily Dive: one trench a day, the same for everyone in the world (the day is the UTC date),
 * in a cave picked for the day, even one you haven't unlocked yet. It has its own leaderboard and
 * doesn't count towards your cave bests. Plus three daily missions, picked by the same date.
 */
export const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
const dayNumber = () => Math.floor(Date.now() / 86400000);

/** Coins for your first Daily Dive of the day. */
export const DAILY_BONUS = 50;

type Saved = { day: string; best: number; tries: number };
const saved = (): Saved => { const s = store.get<Saved>('daily', { day: '', best: 0, tries: 0 }); return s.day === dayKey() ? s : { day: dayKey(), best: 0, tries: 0 }; };

export const daily = {
  get day() { return dayKey(); },
  /** The day's seed for one random stream of the course (creatures, pearls, power-ups…). */
  seed: (stream: string) => hashString(`deep-dive:daily:${dayKey()}:${stream}`),
  get cave(): CaveDef { return CAVES[dayNumber() % CAVES.length]; },
  get best() { return saved().best; },
  get tries() { return saved().tries; },
  /** Count a finished Daily Dive. Returns whether it beat today's best, and the first-dive bonus paid. */
  finish(depth: number): { isBest: boolean; bonus: number } {
    const s = saved(), bonus = s.tries === 0 ? DAILY_BONUS : 0;
    const isBest = depth > s.best;
    store.set('daily', { day: s.day, best: Math.max(s.best, depth), tries: s.tries + 1 });
    if (bonus) coins.add(bonus);
    return { isBest, bonus };
  },
  /** Hours until a new Daily Dive (rounded up). */
  get hoursLeft() { return Math.ceil((86400000 - (Date.now() % 86400000)) / 3600000); },
};

// ---------- Daily missions: three a day, from all dives that day, with a booster for clearing all three.

interface DailyDef { id: string; text: string; stat: string; kind: 'run' | 'day'; n: [number, number]; reward: number }
const POOL: DailyDef[] = [
  { id: 'deep',     text: 'Dive {n} m in one dive',           stat: 'depth',      kind: 'run', n: [250, 600], reward: 40 },
  { id: 'pearls',   text: 'Collect {n} pearls today',         stat: 'pearls',     kind: 'day', n: [40, 90],   reward: 40 },
  { id: 'perks',    text: 'Pick up {n} power-ups today',      stat: 'perks',      kind: 'day', n: [3, 6],     reward: 35 },
  { id: 'close',    text: 'Have {n} close calls today',       stat: 'closeCalls', kind: 'day', n: [5, 12],    reward: 40 },
  { id: 'specials', text: 'Use your special {n} times today', stat: 'specials',   kind: 'day', n: [2, 4],     reward: 40 },
  { id: 'air',      text: 'Grab {n} air bubbles today',       stat: 'air',        kind: 'day', n: [25, 50],   reward: 30 },
  { id: 'dives',    text: 'Dive {n} times today',             stat: 'dives',      kind: 'day', n: [3, 5],     reward: 35 },
  { id: 'dailyrun', text: 'Do today’s Daily Dive',         stat: 'daily',      kind: 'day', n: [1, 1],     reward: 30 },
  { id: 'clean',    text: 'Reach {n} m without losing a life', stat: 'cleanDepth', kind: 'run', n: [150, 350], reward: 45 },
];

export interface DailyMission { id: string; text: string; stat: string; kind: 'run' | 'day'; target: number; reward: number; progress: number; done: boolean }
export interface DailyResult { mission: DailyMission; justDone: boolean }

// Daily missions turn over at the player's own midnight (only the Daily Dive needs one world-wide day).
type DailySaved = { day: string; progress: Record<string, number>; bonus: boolean };
const loadDay = (): DailySaved => { const s = store.get<DailySaved>('dailyMissions', { day: '', progress: {}, bonus: false }); return s.day === todayKey() ? s : { day: todayKey(), progress: {}, bonus: false }; };

/** Today's three. Targets round to a tidy number. */
function todays(): Omit<DailyMission, 'progress' | 'done'>[] {
  const r = mulberry32(hashString(`deep-dive:missions:${todayKey()}`)), pool = [...POOL], out = [];
  for (let i = 0; i < 3; i++) {
    const def = pool.splice((r() * pool.length) | 0, 1)[0];
    const raw = def.n[0] + r() * (def.n[1] - def.n[0]), step = raw >= 100 ? 50 : raw >= 20 ? 5 : 1;
    const target = Math.max(1, Math.round(raw / step) * step);
    out.push({ id: def.id, text: def.text.replace('{n}', target.toLocaleString()), stat: def.stat, kind: def.kind, target, reward: def.reward });
  }
  return out;
}

export const dailyMissions = {
  get list(): DailyMission[] {
    const s = loadDay();
    return todays().map(m => { const p = s.progress[m.id] ?? 0; return { ...m, progress: p, done: p >= m.target }; });
  },
  get allDone() { return this.list.every(m => m.done); },
  /** The booster for clearing all three (the same one all day). */
  get bonusBooster(): BoosterId { return BOOSTERS[hashString(todayKey()) % BOOSTERS.length].id; },
  get bonusPaid() { return loadDay().bonus; },
  /** Report a finished dive's stats; pays missions as they complete. */
  report(stats: Record<string, number>): { results: DailyResult[]; bonus: BoosterId | null } {
    const s = loadDay(), before = this.list;
    const results = before.map(m => {
      const v = stats[m.stat] ?? 0;
      const p = m.kind === 'run' ? Math.max(m.progress, v) : m.progress + v;
      s.progress[m.id] = p;
      const justDone = !m.done && p >= m.target;
      if (justDone) coins.add(m.reward);
      return { mission: { ...m, progress: p, done: p >= m.target }, justDone };
    });
    let bonus: BoosterId | null = null;
    if (!s.bonus && results.every(r => r.mission.done)) { s.bonus = true; bonus = this.bonusBooster; boosters.add(bonus); }
    store.set('dailyMissions', s);
    metaChanged();
    return { results, bonus };
  },
};
