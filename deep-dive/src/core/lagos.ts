/**
 * Lagos Life (and Naija Life): Vatar's game player runs Deep Dive in a frame. Their listing points at
 * "/?lagoslife=1"; in that frame the game loads Vatar's SDK from their site (never a copy, as their
 * rules ask) and:
 *   - sends each dive's depth to their leaderboard, and shows that board in "Top divers";
 *   - pauses when the player's page says so, and resumes when it says so;
 *   - asks for no sign-in, age, name or other personal data, and runs no analytics, outside ads
 *     or cloud saves (their content rules), so cloud.ts, ads.ts and analytics.ts stay off.
 * Played anywhere else, none of this runs. Docs: https://lagoslife.app/developers/docs
 */

const SDK = 'https://lagoslife.app/sdk/vatar-games-v1.js';
const HOSTS = /^https:\/\/(www\.)?(lagoslife|naijalife)\.app$|^https:\/\/lagoslife\.eliysites\.com$/;
/** Their leaderboard takes one score per player every 20 s; a dive that ends sooner waits. */
const SCORE_GAP = 20_000;

export interface LagosRow { rank: number | string; name: string; score: number; me: boolean }

interface VatarSDK {
  init(): Promise<{ player: { id: string; name: string; avatar?: string }; session: string; mode: 'live' | 'test' }>;
  submitScore(n: number): Promise<{ best: number; accepted: boolean }>;
  leaderboard(): Promise<{ top: { rank: number; name: string; score: number }[]; me: { rank: number | null; label: string; score: number } | null }>;
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

export const lagos = {
  on: inLagos,
  /** The player's Lagos Life name, once known. */
  get name() { return playerName; },

  /** Call once at startup: loads the SDK and hooks pause/resume to the game. */
  init(h: { pause(): void; resume(): void }) {
    if (!inLagos) return;
    document.documentElement.classList.add('in-lagos');
    void load().then(async v => {
      if (!v) return;
      v.onPause(h.pause);
      v.onResume(h.resume);
      try { playerName = (await v.init()).player.name; } catch { /* not framed by them after all */ }
    });
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
