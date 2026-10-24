import { coins } from '../core/meta';
import { todayKey } from '../core/rng';
import { store } from '../core/settings';

/**
 * Golden Shells: a rare treasure, kept between dives, that buys a "Save me" when a dive would end
 * (1 shell, then 2, then 4 in the same dive). Found in treasure chests and, very rarely, floating
 * in the trench. Every player starts with one so they meet the idea early.
 */
const KEY = 'shells';
const listeners = new Set<() => void>();

export const shells = {
  get count() { return store.get(KEY, 1); },
  add(n: number) { store.set(KEY, this.count + n); listeners.forEach(fn => fn()); },
  /** Returns false (and spends nothing) if there aren't enough. */
  spend(n: number) {
    if (this.count < n) return false;
    store.set(KEY, this.count - n);
    listeners.forEach(fn => fn());
    return true;
  },
  onChange(fn: () => void) { listeners.add(fn); },
};

/**
 * Golden Shells for coins in the shop: a few a week, each dearer than the last, restocked every
 * Monday. Enough to save up for a diver or a "Save me", never enough to make shells common.
 */
export const SHELL_PRICES = [1000, 3000, 5000];
const weekKey = () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return todayKey(d); };

export const shellShop = {
  /** Shells bought in the shop this week. */
  get bought() { const w = store.get<{ week: string; n: number }>('shellWeek', { week: '', n: 0 }); return w.week === weekKey() ? w.n : 0; },
  /** Coin price of the next shell, or null when this week's are sold out. */
  get price(): number | null { return SHELL_PRICES[this.bought] ?? null; },
  buy(): 'bought' | 'poor' | 'soldout' {
    const price = this.price;
    if (price === null) return 'soldout';
    if (!coins.spend(price)) return 'poor';
    store.set('shellWeek', { week: weekKey(), n: this.bought + 1 });
    shells.add(1);
    return 'bought';
  },
};

/** Shells needed for the next "Save me" in a dive that has already used `saves`. */
export const saveCost = (saves: number) => 2 ** saves;
