import { store } from './settings';

/**
 * The cookie notice: shown once per device after the age and name, with one "Got it". There are no
 * switches: the anonymous play events (core/analytics.ts) are always on, and ads are personalised
 * except for under-13s (core/ads.ts; in Europe and the UK, Google's own consent message decides).
 * `asked` says the notice has been seen; analytics are held back until it has.
 */
export interface Consent { analytics: boolean }

const KEY = 'consent';
const listeners = new Set<(c: Consent) => void>();

export const consent = {
  /** Has the player answered the banner on this device? */
  get asked() { return store.get<Consent | null>(KEY, null) !== null; },
  get now(): Consent { return { analytics: this.asked }; },
  set(c: Consent) {
    store.set(KEY, { analytics: c.analytics }); // kept in this shape so older saves still read as seen
    listeners.forEach(fn => fn(this.now));
  },
  onChange(fn: (c: Consent) => void) { listeners.add(fn); },
};
