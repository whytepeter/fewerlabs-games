import { coins, metaChanged } from '../core/meta';
import { store } from '../core/settings';
import { boosters, type BoosterId } from './boosters';
import { lifetime } from './lifetime';
import { todayKey as dayKey } from '../core/rng';
import { shells } from './shells';

/**
 * The 7-day login streak: a gift for opening the game each day, a little bigger every day, with
 * a Sea Heart on day 7. Missing a day starts it over at day 1; after day 7 it starts again.
 */
export type StreakGift = { kind: 'coins'; n: number } | { kind: 'booster'; id: BoosterId } | { kind: 'shell'; n: number };

export const STREAK: StreakGift[] = [
  { kind: 'coins', n: 50 },
  { kind: 'coins', n: 75 },
  { kind: 'booster', id: 'charged' },
  { kind: 'coins', n: 125 },
  { kind: 'booster', id: 'doubler' },
  { kind: 'coins', n: 200 },
  { kind: 'shell', n: 1 },
];

type Saved = { last: string; day: number }; // last claim date, and which day (0–6) it was
const yesterday = () => dayKey(new Date(Date.now() - 86400000));

export const streak = {
  /** Today's gift index (0–6), and whether it's still to claim. */
  get today(): { day: number; claimable: boolean } {
    const s = store.get<Saved>('streak', { last: '', day: -1 });
    if (s.last === dayKey()) return { day: s.day, claimable: false };
    return { day: s.last === yesterday() ? (s.day + 1) % STREAK.length : 0, claimable: true };
  },
  claim(): StreakGift | null {
    const t = this.today;
    if (!t.claimable) return null;
    const g = STREAK[t.day];
    if (g.kind === 'coins') coins.add(g.n);
    else if (g.kind === 'booster') boosters.add(g.id);
    else shells.add(g.n);
    store.set('streak', { last: dayKey(), day: t.day });
    lifetime.max('streak', t.day + 1); // the longest run of days (Royal is earned at 7)
    metaChanged();
    return g;
  },
};
