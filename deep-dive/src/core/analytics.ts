import { cloud } from './cloud';
import { dev } from './dev';
import { store } from './settings';

/**
 * Basic play analytics: a handful of events (how dives end, Save me choices, ads, spending,
 * treasure) so balance decisions can be made from what players actually do. Each event carries the
 * player's anonymous id and the day, never a name, email or age. Events queue on the device and go
 * to Firestore (analytics/{game}/events) in batches, every half minute and when the tab is hidden.
 * Nothing is sent from the dev server or in dev mode, and nothing at all without the cloud.
 * Read them with scripts/analytics-report.mjs.
 */
export type EventName = 'app_open' | 'dive_end' | 'save_me' | 'ad' | 'spend' | 'treasure';

type Event = { name: EventName; day: string; data: Record<string, string | number | boolean> };

const QUEUE = 'analyticsQueue', MAX = 300, EVERY = 30_000, BATCH = 100;
const off = () => !cloud.enabled || import.meta.env.DEV || dev.on;
const utcDay = () => new Date().toISOString().slice(0, 10);

let sending = false;

/** Record an event (at most 12 small fields; strings are cut to 40 characters). */
export function track(name: EventName, data: Event['data'] = {}) {
  if (off()) { if (import.meta.env.DEV) console.debug('[analytics]', name, data); return; }
  const clean: Event['data'] = {};
  Object.entries(data).slice(0, 12).forEach(([k, v]) => { clean[k] = typeof v === 'string' ? v.slice(0, 40) : v; });
  const q = store.get<Event[]>(QUEUE, []);
  q.push({ name, day: utcDay(), data: clean });
  store.set(QUEUE, q.slice(-MAX));
}

async function flush() {
  if (sending || off()) return;
  const q = store.get<Event[]>(QUEUE, []);
  if (!q.length) return;
  sending = true;
  const batch = q.slice(0, BATCH);
  if (await cloud.sendEvents(batch)) store.set(QUEUE, store.get<Event[]>(QUEUE, []).slice(batch.length));
  sending = false;
}

/** Start sending queued events (call once). */
export function initAnalytics() {
  if (!cloud.enabled) return;
  window.setInterval(() => void flush(), EVERY);
  document.addEventListener('visibilitychange', () => { if (document.hidden) void flush(); });
  void cloud.start().then(flush);
}
