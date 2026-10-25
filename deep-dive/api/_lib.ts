import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { packById } from '../src/game/packs.js';

/**
 * Shared by the payment functions. Env (Vercel project settings):
 *   BACHS_SECRET_KEY           sk_sandbox_… while testing, sk_live_… for real payments
 *   FIREBASE_SERVICE_ACCOUNT   the Firebase service-account key, as one line of JSON
 *
 * A purchase is only ever granted after the checkout is read back from Bachs with the secret key
 * and says `completed`, so nothing the browser (or a forged webhook) sends can grant one. Each
 * checkout is recorded once, at players/{uid}/purchases/{checkout_id}; the game then applies it.
 */
export const GAME = 'deep-dive';
const KEY = process.env.BACHS_SECRET_KEY ?? '';
const BACHS = KEY.startsWith('sk_live_') ? 'https://api.bachs.io' : 'https://sandbox-api.bachs.io';

function admin() {
  if (!getApps().length) initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? '{}')) });
  return { auth: getAuth(), db: getFirestore() };
}

export const json = (body: unknown, status = 200) => Response.json(body, { status });

/** The signed-in player making this request (their Firebase ID token in the Authorization header), or null. */
export async function player(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token) return null;
  try { return (await admin().auth.verifyIdToken(token)).uid; } catch { return null; }
}

export async function bachs<T>(path: string, init: { method?: string; body?: unknown; idempotencyKey?: string } = {}): Promise<T> {
  const res = await fetch(BACHS + path, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      ...(init.idempotencyKey ? { 'Idempotency-Key': init.idempotencyKey } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Bachs ${res.status}: ${(data as { detail?: string }).detail ?? 'request failed'}`);
  return data as T;
}

interface Checkout { checkout_id: string; status: string; metadata?: Record<string, unknown> | null }

/** Has this player already bought a one-time pack? */
export async function ownsPack(uid: string, pack: string) {
  const q = await admin().db.collection(`players/${uid}/purchases`).where('pack', '==', pack).limit(1).get();
  return !q.empty;
}

/**
 * Read a checkout back from Bachs and, if it's paid, record the purchase for its player (once).
 * Returns the player's uid when the purchase is (now or already) recorded, else null.
 */
export async function grant(checkoutId: string): Promise<string | null> {
  if (!/^[\w-]{1,128}$/.test(checkoutId)) return null;
  const c = await bachs<Checkout>(`/v1/checkout-sessions/${encodeURIComponent(checkoutId)}`);
  const uid = String(c.metadata?.uid ?? ''), pack = packById(String(c.metadata?.pack ?? ''));
  if (c.status !== 'completed' || !uid || !pack || c.metadata?.game !== GAME) return null;
  const ref = admin().db.doc(`players/${uid}/purchases/${c.checkout_id}`);
  await admin().db.runTransaction(async t => {
    if ((await t.get(ref)).exists) return;
    t.set(ref, {
      pack: pack.id, hearts: pack.hearts, coins: pack.coins ?? 0, boosters: pack.boosters ?? 0,
      usd: pack.usd, applied: false, createdAt: FieldValue.serverTimestamp(),
    });
  });
  return uid;
}
