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

/** Shells needed for the next "Save me" in a dive that has already used `saves`. */
export const saveCost = (saves: number) => 2 ** saves;
