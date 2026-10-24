import { store } from '../core/settings';

/**
 * Lifetime totals kept across every dive (eels slipped past, anglerfish dodged…) and records that
 * only go up (the longest login streak). Divers you earn rather than buy read their goals here.
 */
const KEY = 'lifetime';
const all = () => store.get<Record<string, number>>(KEY, {});

export const lifetime = {
  get: (stat: string) => all()[stat] ?? 0,
  /** Add a dive's stats to the totals. */
  add(stats: Record<string, number>) {
    const a = all();
    for (const [k, v] of Object.entries(stats)) if (v > 0) a[k] = (a[k] ?? 0) + v;
    store.set(KEY, a);
  },
  /** Raise a record (it never goes down). */
  max(stat: string, v: number) {
    const a = all();
    if (v <= (a[stat] ?? 0)) return;
    a[stat] = v;
    store.set(KEY, a);
  },
};
