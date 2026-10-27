import { store } from './settings';

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

/** Ask our server about a purchase (it checks the player and the purchase with Lagos Life). */
async function server(step: 'verify' | 'deliver', purchaseId: string) {
  const v = await load();
  if (!v) return null;
  try {
    const { session } = await v.session();
    const res = await fetch('/api/lagos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ step, session, purchaseId }) });
    return res.ok ? ((await res.json()) as { ok: boolean; productId?: string; delivered?: boolean }) : null;
  } catch { return null; }
}

/** A paid purchase: check it, give it once (remembered here), then have it marked delivered. */
async function settle(purchaseId: string) {
  if (!granted().has(purchaseId)) {
    const r = await server('verify', purchaseId);
    if (!r?.ok || r.delivered) return; // not ours, not paid, or already given
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

  /** Call once at startup: loads the SDK, hooks pause/resume to the game, and finishes any paid purchase. */
  init(h: { pause(): void; resume(): void; give(p: Product): void }) {
    if (!inLagos) return;
    give = h.give;
    document.documentElement.classList.add('in-lagos');
    void load().then(async v => {
      if (!v) return;
      v.onPause(h.pause);
      v.onResume(h.resume);
      v.onPurchase(p => void settle(p.purchaseId));
      try { playerName = (await v.init()).player.name; } catch { return; /* not framed by them after all */ }
      try { for (const p of await v.purchases()) await settle(p.purchaseId); } catch { /* next start */ }
    });
  },

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
