import { coins, metaChanged } from '../core/meta';
import { store } from '../core/settings';
import { boosters, type BoosterId } from './boosters';
import { shells, weekKey } from './shells';

/**
 * The weekly Pearl Hunt (like Subway Surfers' hunts): every pearl from every dive counts towards
 * three prizes, paid the moment you pass each one. Starts over every Monday.
 */
export type HuntPrize = { kind: 'coins'; n: number } | { kind: 'booster'; id: BoosterId; n: number } | { kind: 'shell'; n: number };

export const HUNT: { at: number; prize: HuntPrize }[] = [
  { at: 200,  prize: { kind: 'coins', n: 250 } },
  { at: 600,  prize: { kind: 'booster', id: 'megaturbo', n: 2 } },
  { at: 1200, prize: { kind: 'shell', n: 1 } },
];

type Saved = { week: string; pearls: number };
const KEY = 'hunt';
const saved = (): Saved => { const h = store.get<Saved>(KEY, { week: '', pearls: 0 }); return h.week === weekKey() ? h : { week: weekKey(), pearls: 0 }; };

function pay(p: HuntPrize) {
  if (p.kind === 'coins') coins.add(p.n);
  else if (p.kind === 'booster') boosters.add(p.id, p.n);
  else shells.add(p.n);
}

export const hunt = {
  /** Pearls counted this week. */
  get pearls() { return saved().pearls; },
  /** The next prize, or null once all three are won this week. */
  get next() { return HUNT.find(t => this.pearls < t.at) ?? null; },
  /** Days until it starts over (1–7). */
  get daysLeft() { return 7 - ((new Date().getDay() + 6) % 7); },
  /** Count a dive's pearls; returns the prizes it just won (already paid). */
  add(n: number): HuntPrize[] {
    if (n <= 0) return [];
    const before = saved().pearls, after = before + n;
    store.set(KEY, { week: weekKey(), pearls: after });
    const won = HUNT.filter(t => before < t.at && after >= t.at).map(t => t.prize);
    won.forEach(pay);
    if (won.length) metaChanged();
    return won;
  },
};
