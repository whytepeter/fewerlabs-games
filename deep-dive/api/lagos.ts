/**
 * POST /api/lagos: Lagos Life (Vatar) purchases and saved progress for Deep Dive. The secret key
 * stays here (Vercel env VATAR_SECRET: vtr_test_… in their sandbox, vtr_live_… once approved).
 *
 *   { step: 'verify', session, purchaseId }  → { ok, productId }  the purchase is paid and this player's
 *   { step: 'deliver', session, purchaseId } → { ok }             mark it delivered (after the game granted it)
 *   { step: 'load', session }                → { ok, save }       this player's saved progress, or null
 *   { step: 'save', session, data, updatedAt } → { ok }           replace it (an older save never wins)
 *
 * Every call first verifies the player's session with Lagos Life. Purchases are then read from
 * Lagos Life and checked against that player, so nothing the game sends can grant anything.
 *
 * Saves: inside Lagos Life's frame the game is a third-party site, and many phones don't keep its
 * storage between visits, so progress lives in Firestore under the player's Lagos Life id
 * (lagos/{playerId}/saves/deep-dive; no browser can reach it, only this server). Needs Vercel env
 * FIREBASE_SERVICE_ACCOUNT: the JSON key of a service account of the Deep Dive Firebase project.
 * Docs: https://lagoslife.app/developers/docs
 */
import type { Firestore } from 'firebase-admin/firestore';

const API = 'https://lagoslife.app/api/games/v1';
const SECRET = process.env.VATAR_SECRET ?? '';
const SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT ?? '';
/** A save is a few KB; anything far bigger is not the game's. */
const SAVE_MAX = 200_000;

const json = (body: unknown, status = 200) => Response.json(body, { status });

let db: Firestore | null = null;
async function firestore() {
  if (db) return db;
  const [{ cert, getApps, initializeApp }, { getFirestore }] = await Promise.all([import('firebase-admin/app'), import('firebase-admin/firestore')]);
  const app = getApps()[0] ?? initializeApp({ credential: cert(JSON.parse(SERVICE_ACCOUNT)) });
  db = getFirestore(app);
  return db;
}

async function saves(playerId: string, body: { step: string; data?: unknown; updatedAt?: unknown }) {
  if (!SERVICE_ACCOUNT) return json({ error: 'not_configured' }, 503);
  const ref = (await firestore()).collection('lagos').doc(encodeURIComponent(playerId)).collection('saves').doc('deep-dive');
  if (body.step === 'load') {
    const snap = await ref.get();
    const s = snap.data() as { data: Record<string, unknown>; updatedAt: number } | undefined;
    return json({ ok: true, save: s ? { data: s.data, updatedAt: s.updatedAt } : null });
  }
  const { data, updatedAt } = body;
  if (!data || typeof data !== 'object' || Array.isArray(data) || typeof updatedAt !== 'number' || !Number.isFinite(updatedAt)
    || JSON.stringify(data).length > SAVE_MAX) return json({ error: 'bad_request' }, 400);
  const kept = await ref.firestore.runTransaction(async t => {
    const now = (await t.get(ref)).data() as { updatedAt?: number } | undefined;
    if (now?.updatedAt && now.updatedAt > updatedAt) return false; // another device saved something newer
    t.set(ref, { data, updatedAt, at: new Date() });
    return true;
  });
  return kept ? json({ ok: true }) : json({ error: 'stale' }, 409);
}

async function vatar<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(API + path, {
    method: init.method ?? 'GET',
    headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  return { ok: res.ok, status: res.status, data: (await res.json().catch(() => ({}))) as T };
}

export async function POST(req: Request) {
  if (!SECRET) return json({ error: 'not_configured' }, 503);
  const body = (await req.json().catch(() => ({}))) as { step?: string; session?: string; purchaseId?: string; data?: unknown; updatedAt?: unknown };
  const { step, session, purchaseId } = body;
  const isSave = step === 'load' || step === 'save';
  if ((step !== 'verify' && step !== 'deliver' && !isSave) || typeof session !== 'string'
    || (!isSave && (typeof purchaseId !== 'string' || !/^[\w-]{1,128}$/.test(purchaseId)))) {
    return json({ error: 'bad_request' }, 400);
  }

  // 1. who is asking
  const who = await vatar<{ playerId: string }>('/session/verify', { method: 'POST', body: { session } });
  if (!who.ok || typeof who.data.playerId !== 'string' || !who.data.playerId) return json({ error: 'bad_session' }, 401);
  if (isSave) {
    try { return await saves(who.data.playerId, { step, data: body.data, updatedAt: body.updatedAt }); } catch (e) {
      console.error('[lagos] save', e);
      return json({ error: 'save_failed' }, 502);
    }
  }
  if (typeof purchaseId !== 'string') return json({ error: 'bad_request' }, 400);

  // 2. the purchase, from Lagos Life itself: paid (or already delivered) and this player's
  const p = await vatar<{ productId: string; playerId: string; status: string }>(`/purchases/${encodeURIComponent(purchaseId)}`);
  if (!p.ok || p.data.playerId !== who.data.playerId) return json({ error: 'not_found' }, 404);
  if (p.data.status === 'refunded') return json({ error: 'refunded' }, 409);

  if (step === 'verify') return json({ ok: true, productId: p.data.productId, delivered: p.data.status === 'delivered' });

  // 3. the game has granted it: mark it delivered (safe to repeat)
  const d = await vatar<{ status: string }>(`/purchases/${encodeURIComponent(purchaseId)}/deliver`, { method: 'POST' });
  return d.ok ? json({ ok: true }) : json({ error: 'deliver_failed' }, 502);
}
