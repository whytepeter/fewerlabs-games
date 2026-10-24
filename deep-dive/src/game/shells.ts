import { coins } from '../core/meta';
import { todayKey } from '../core/rng';
import { store } from '../core/settings';

/**
 * Sea Hearts: a rare, glowing heart gem kept between dives, the ocean's life. They're called
 * "shells" in the code and the save, from when they were Golden Shells, so old saves keep theirs.
 * One buys a "Save me" when a dive would end (1, then 2, then 4 in the same dive), and some divers
 * cost them. Found in treasure chests and, very rarely, floating in the trench. Every player
 * starts with one so they meet the idea early.
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
 * Sea Hearts for coins in the shop: a few a week, each dearer than the last, restocked every
 * Monday. Enough to save up for a diver or a "Save me", never enough to make shells common.
 */
export const SHELL_PRICES = [3000, 5000, 8000]; // about 5, 8 and 13 good dives
export const weekKey = () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return todayKey(d); };

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

/**
 * A free Sea Heart for creating an account (or signing in to one), once per account: the flag
 * is saved with the progress, so signing in on another device doesn't pay it again.
 */
export const SIGNUP_GIFT = 1;
export function claimSignupGift() {
  if (store.get('signupGift', false)) return false;
  store.set('signupGift', true);
  shells.add(SIGNUP_GIFT);
  return true;
}

/** Shells needed for the next "Save me" in a dive that has already used `saves`. */
export const saveCost = (saves: number) => 2 ** saves;
