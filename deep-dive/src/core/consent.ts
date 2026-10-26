import { store } from './settings';

/**
 * The player's privacy choices, asked once in the cookie banner and changeable in Settings. The
 * game's own storage (progress, settings, the sign-in that backs up the save) is essential and
 * always on; these two are optional:
 *   analytics  the anonymous play events (core/analytics.ts)
 *   ads        personalised ads; without it Google only shows non-personalised ones (core/ads.ts)
 * Kept on this device only (each browser asks for itself). Until the player answers, neither is on.
 */
export interface Consent { analytics: boolean; ads: boolean }

const KEY = 'consent';
const listeners = new Set<(c: Consent) => void>();

export const consent = {
  /** Has the player answered the banner on this device? */
  get asked() { return store.get<Consent | null>(KEY, null) !== null; },
  get now(): Consent { return store.get<Consent>(KEY, { analytics: false, ads: false }); },
  set(c: Consent) {
    store.set(KEY, { analytics: c.analytics, ads: c.ads });
    listeners.forEach(fn => fn(this.now));
  },
  onChange(fn: (c: Consent) => void) { listeners.add(fn); },
};
