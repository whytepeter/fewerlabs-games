import { onStoreWrite, store } from './settings';

/**
 * Lagos Life (and Naija Life): Vatar's game player runs Deep Dive in a frame. Their listing points at
 * "/?lagoslife=1"; in that frame the game loads Vatar's SDK from their site (never a copy, as their
 * rules ask) and:
 *   - sends each dive's depth to their leaderboard, and shows that board in "Top divers";
 *   - pauses when the player's page says so, and resumes when it says so;
 *   - asks for no sign-in, age, name or other personal data, and runs no analytics, outside ads
 *     or cloud saves (their content rules), so cloud.ts, ads.ts and analytics.ts stay off;
 *   - sells Sea Heart packs, coin packs and the Coin Doubler only through their pay sheet (products
 *     made in their dashboard with the ids in PRODUCTS),
 *     each purchase checked by our server (api/lagos.ts) before it's given, and given once.
 * Played anywhere else, none of this runs. Docs: https://lagoslife.app/developers/docs
 */

const SDK = 'https://lagoslife.app/sdk/vatar-games-v1.js';
const HOSTS = /^https:\/\/(www\.)?(lagoslife|naijalife)\.app$|^https:\/\/lagoslife\.eliysites\.com$/;
/**
 * The Lagos Life products (ids exactly as made in their dashboard: lowercase, digits, _ and -) and
 * what each gives. The Coin Doubler is a one-off product there, switched on for good.
 */
export interface Product { id: string; name: string; note: string; hearts?: number; coins?: number; doubler?: boolean }
export const PRODUCTS: Product[] = [
  { id: 'hearts5', name: '5 Sea Hearts', note: 'For Save me and divers', hearts: 5 },
  { id: 'hearts12', name: '12 Sea Hearts', note: 'A bigger bag', hearts: 12 },
  { id: 'hearts30', name: '30 Sea Hearts', note: 'The best value', hearts: 30 },
  { id: 'coin_doubler', name: 'Coin Doubler', note: 'Double coins from every dive, for good', doubler: true },
  { id: 'coins5k', name: '5,000 coins', note: 'For divers, upgrades and gadgets', coins: 5000 },
  { id: 'coins20k', name: '20,000 coins', note: 'A big stack', coins: 20000 },
  { id: 'coins40k', name: '40,000 coins', note: 'The best value', coins: 40000 },
];
/** Saved once the Coin Doubler is bought (read by the dive's coin payout). */
export const DOUBLER = 'coinDoubler';
const DOUBLER_ID = 'coin_doubler';
/** Purchases already given on this device, so a retry or reload never gives one twice. */
const GRANTED = 'lagosGranted';
/** Their leaderboard takes one score per player every 20 s; a dive that ends sooner waits. */
const SCORE_GAP = 20_000;

export interface LagosRow { rank: number | string; name: string; score: number; me: boolean }

interface VatarSDK {
  init(): Promise<{ player: { id: string; name: string; avatar?: string }; session: string; mode: 'live' | 'test' }>;
  submitScore(n: number): Promise<{ best: number; accepted: boolean }>;
  leaderboard(): Promise<{ top: { rank: number; name: string; score: number }[]; me: { rank: number | null; label: string; score: number } | null }>;
  session(): Promise<{ session: string; exp: number }>;
  purchase(productId: string): Promise<{ purchaseId: string; productId: string }>;
  purchases(): Promise<{ purchaseId: string; productId: string }[]>;
  onPurchase(fn: (p: { purchaseId: string; productId: string }) => void): () => void;
  onPause(fn: () => void): () => void;
  onResume(fn: () => void): () => void;
}
declare global { interface Window { Vatar?: VatarSDK } }

/** Are we inside Lagos Life's game player? Decided once, at load. */
const inLagos = (() => {
  try {
    // The dev server also takes ?lagoslife=1 in a plain tab, to preview this mode (the SDK can't answer there).
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('lagoslife')) return true;
    if (window.parent === window) return false;
    if (new URLSearchParams(location.search).has('lagoslife')) return true;
    const a = location.ancestorOrigins;
    return !!a && a.length > 0 && HOSTS.test(a[0]);
  } catch { return false; }
})();

let sdk: Promise<VatarSDK | null> | null = null;
let give: (p: Product) => void = () => {};
let playerName = '';
let pending = 0;      // the best depth still to send
let lastSent = 0;     // when the last score went
let timer = 0;

function load(): Promise<VatarSDK | null> {
  sdk ??= new Promise(resolve => {
    const s = document.createElement('script');
    s.src = SDK;
    s.async = true;
    s.onload = () => resolve(window.Vatar ?? null);
    s.onerror = () => resolve(null);
    document.head.append(s);
  });
  return sdk;
}

async function flushScore() {
  timer = 0;
  const v = await load();
  if (!v || pending <= 0) return;
  const wait = lastSent + SCORE_GAP - Date.now();
  if (wait > 0) { timer = window.setTimeout(() => void flushScore(), wait + 50); return; }
  const n = pending;
  pending = 0;
  lastSent = Date.now();
  try { await v.submitScore(n); } catch (e) {
    // too soon or busy: keep it and try again after the gap
    if ((e as { code?: string }).code !== 'bad_request') { pending = Math.max(pending, n); timer = window.setTimeout(() => void flushScore(), SCORE_GAP); }
  }
}

const granted = () => new Set(store.get<string[]>(GRANTED, []));

/** The player's session token, reused until shortly before it expires (a save on leaving can't wait for a new one). */
let token: { session: string; until: number } | null = null;
async function session(v: VatarSDK) {
  if (token && Date.now() < token.until) return token.session;
  const s = await v.session();
  const exp = s.exp < 1e12 ? s.exp * 1000 : s.exp; // seconds or milliseconds
  token = { session: s.session, until: Math.min(exp - 60_000, Date.now() + 10 * 60_000) };
  return s.session;
}

/** Call our server (it checks the player's session with Lagos Life first). Null when unreachable. */
async function api<T>(body: Record<string, unknown>, keepalive = false): Promise<{ status: number; data: T | null } | null> {
  const v = await load();
  if (!v) return null;
  try {
    const res = await fetch('/api/lagos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive,
      body: JSON.stringify({ ...body, session: await session(v) }),
    });
    return { status: res.status, data: res.ok ? ((await res.json()) as T) : null };
  } catch { return null; }
}

/** Ask our server about a purchase (it checks the player and the purchase with Lagos Life). */
async function server(step: 'verify' | 'deliver', purchaseId: string) {
  return (await api<{ ok: boolean; productId?: string; delivered?: boolean }>({ step, purchaseId }))?.data ?? null;
}

/* ---------- Saved progress
 * Inside the frame the game is a third-party site, and many phones don't keep its storage between
 * visits (the daily gift came back on every open, and coins and purchases with it). So the server
 * keeps the save under the player's Lagos Life id, and the newer of server and device wins, as the
 * cloud backup does elsewhere (cloud.ts, which stays off here).
 */
const SAVED_AT = 'lagos:savedAt';
/** Keys that stay on this device: settings and bookkeeping. */
const LOCAL_ONLY = new Set(['sound', 'music', 'haptics', 'devMode', 'tuning', 'analyticsQueue', 'consent', 'cloud:savedAt', SAVED_AT]);
/** Records that only ever go up (best depths): a save never lowers them. */
const KEEP_HIGHEST = /^best/;
const PUSH_DELAY = 3000;
/** How long the opening screens wait for the save before going on without it. */
const LOAD_WAIT = 4000;

type Save = { data: Record<string, unknown>; updatedAt: number };
let merged = false;   // the server's save has been read, so pushing can't overwrite it with a blank one
let dirty = false;
let pushTimer = 0;
let pulling: Promise<void> | null = null;
const restoreListeners: (() => void)[] = [];
let loaded: () => void = () => {};
const ready = inLagos ? new Promise<void>(r => { loaded = r; }) : Promise.resolve();

function snapshot() {
  const data: Record<string, unknown> = {};
  for (const k of store.keys()) {
    if (LOCAL_ONLY.has(k)) continue;
    const v = store.get<unknown>(k, undefined);
    if (v !== undefined) data[k] = v;
  }
  return data;
}

/** Write the server's save here. True when this device had a higher record (push it back up). */
function apply(data: Record<string, unknown>) {
  let higher = false;
  for (const [k, v] of Object.entries(data)) {
    if (LOCAL_ONLY.has(k)) continue;
    if (KEEP_HIGHEST.test(k) && typeof v === 'number' && store.get(k, 0) > v) { higher = true; continue; }
    store.quiet(k, v);
  }
  return higher;
}

async function push(keepalive = false) {
  clearTimeout(pushTimer);
  if (!merged) return;
  dirty = false;
  const r = await api<{ ok: boolean }>({ step: 'save', data: snapshot(), updatedAt: store.get(SAVED_AT, Date.now()) }, keepalive);
  if (r?.data?.ok) return;
  dirty = true;
  if (r?.status === 409) { merged = false; pulling = null; void pull(); } // another device saved something newer
}

/** Read the server's save; the newer of server and device wins. Unreachable: tried again on return. */
function pull() {
  pulling ??= (async () => {
    const r = await api<{ ok: boolean; save: Save | null }>({ step: 'load' });
    if (!r?.data?.ok) { pulling = null; return; }
    const remote = r.data.save, localAt = store.get(SAVED_AT, 0);
    merged = true;
    if (remote && remote.updatedAt > localAt) {
      const higher = apply(remote.data);
      store.quiet(SAVED_AT, higher ? Date.now() : remote.updatedAt);
      dirty = false;
      restoreListeners.forEach(fn => fn());
      if (higher) await push();
    } else if (!remote || localAt > remote.updatedAt || dirty) {
      if (!localAt) store.quiet(SAVED_AT, Date.now());
      await push();
    }
  })();
  return pulling;
}

function syncSaves() {
  onStoreWrite(key => {
    if (LOCAL_ONLY.has(key)) return;
    dirty = true;
    if (!merged) return; // the server's save may still replace this; stamp it once it's read
    store.quiet(SAVED_AT, Date.now());
    clearTimeout(pushTimer);
    pushTimer = window.setTimeout(() => void push(), PUSH_DELAY);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (dirty) void push(true); } else if (!merged) void pull();
  });
  addEventListener('pagehide', () => { if (dirty) void push(true); });
}

/** A paid purchase: check it, give it once (remembered here), then have it marked delivered. */
async function settle(purchaseId: string) {
  await ready; // give it on top of the loaded save, never into a blank one the save then replaces
  if (!granted().has(purchaseId)) {
    const r = await server('verify', purchaseId);
    if (!r?.ok) return; // not ours, or not paid
    if (r.delivered) {
      // Given before; the Coin Doubler is for good, so a device that lost it gets it back.
      if (r.productId === DOUBLER_ID && !store.get(DOUBLER, false)) store.set(DOUBLER, true);
      return;
    }
    const product = PRODUCTS.find(p => p.id === r.productId);
    if (!product) return;
    store.set(GRANTED, [...granted(), purchaseId].slice(-200));
    give(product);
  }
  await server('deliver', purchaseId); // safe to repeat; undelivered ones come back via purchases() next start
}

export const lagos = {
  on: inLagos,
  /** Bought the Coin Doubler (inside Lagos Life only). */
  get doubler() { return inLagos && store.get(DOUBLER, false); },
  /** The player's Lagos Life name, once known. */
  get name() { return playerName; },

  /**
   * Call once at startup: loads the SDK, hooks pause/resume to the game, loads the player's saved
   * progress, then finishes any paid purchase.
   */
  init(h: { pause(): void; resume(): void; give(p: Product): void }) {
    if (!inLagos) return;
    give = h.give;
    document.documentElement.classList.add('in-lagos');
    window.setTimeout(loaded, LOAD_WAIT); // a slow or missing server never holds the game up
    void load().then(async v => {
      if (!v) return;
      v.onPause(h.pause);
      v.onResume(h.resume);
      v.onPurchase(p => void settle(p.purchaseId));
      try { playerName = (await v.init()).player.name; } catch { return; /* not framed by them after all */ }
      syncSaves();
      await pull();
      loaded();
      try { for (const p of await v.purchases()) await settle(p.purchaseId); } catch { /* next start */ }
    }).finally(loaded);
  },

  /** Resolves once the player's saved progress has loaded (or it gave up waiting); at once outside Lagos Life. */
  ready,
  /** Called after the server's save replaced this device's progress. */
  onRestore(fn: () => void) { restoreListeners.push(fn); },

  /** Buy a product on Lagos Life's own pay sheet; resolves once it's been given (or false). */
  async buy(productId: string): Promise<boolean> {
    const v = await load();
    if (!v) return false;
    try {
      const p = await v.purchase(productId);
      await settle(p.purchaseId);
      return true;
    } catch { return false; } // cancelled, failed or busy: nothing to do
  },

  /** A dive ended: send its depth (their board keeps each player's best). */
  score(depth: number) {
    if (!inLagos || depth <= 0) return;
    pending = Math.max(pending, Math.floor(depth));
    if (!timer) void flushScore();
  },

  /** Their leaderboard: the top players, then this player's own row if they're further down. Null if unreachable. */
  async board(): Promise<LagosRow[] | null> {
    const v = await load();
    if (!v) return null;
    try {
      const b = await v.leaderboard();
      const rows: LagosRow[] = b.top.map(t => ({ rank: t.rank, name: t.name, score: t.score, me: !!b.me && b.me.rank === t.rank }));
      if (b.me && !rows.some(r => r.me)) rows.push({ rank: b.me.label, name: playerName || 'You', score: b.me.score, me: true });
      return rows;
    } catch { return null; }
  },
};
