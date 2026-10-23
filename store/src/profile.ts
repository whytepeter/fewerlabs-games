import type { GameId } from './catalog';

/**
 * What the store remembers on this device: each game's best score (reported by the game
 * through the embed bridge), how many runs were finished, and when it was last played.
 */

export interface GameStats { best: number; plays: number; last: number }

const KEY = 'store:profile';
type Profile = Partial<Record<GameId, GameStats>>;

function load(): Profile {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Profile; } catch { return {}; }
}
function save(p: Profile) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage unavailable */ }
}

export const profile = {
  stats(id: GameId): GameStats { return load()[id] ?? { best: 0, plays: 0, last: 0 }; },
  /** Opening a game counts as "played recently". */
  opened(id: GameId) {
    const p = load();
    p[id] = { ...this.stats(id), last: Date.now() };
    save(p);
  },
  /** A finished run reported by the game. Its own best (if sent) wins over ours. */
  finished(id: GameId, score: number, best?: number) {
    const p = load(), s = this.stats(id);
    p[id] = { best: Math.max(s.best, score, best ?? 0), plays: s.plays + 1, last: Date.now() };
    save(p);
  },
  /** Games played before, most recent first. */
  recent(): GameId[] {
    const p = load();
    return (Object.keys(p) as GameId[]).filter(id => (p[id]?.last ?? 0) > 0).sort((a, b) => (p[b]!.last) - (p[a]!.last));
  },
};
