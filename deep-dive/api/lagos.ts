/**
 * POST /api/lagos: checks and delivers Lagos Life (Vatar) purchases for Deep Dive. The secret key
 * stays here (Vercel env VATAR_SECRET: vtr_test_… in their sandbox, vtr_live_… once approved).
 *
 *   { step: 'verify', session, purchaseId }  → { ok, productId }  the purchase is paid and this player's
 *   { step: 'deliver', session, purchaseId } → { ok }             mark it delivered (after the game granted it)
 *
 * Every call first verifies the player's session with Lagos Life, then reads the purchase from
 * Lagos Life and checks it belongs to that player, so nothing the game sends can grant anything.
 * Docs: https://lagoslife.app/developers/docs
 */
const API = 'https://lagoslife.app/api/games/v1';
const SECRET = process.env.VATAR_SECRET ?? '';

const json = (body: unknown, status = 200) => Response.json(body, { status });

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
  const { step, session, purchaseId } = (await req.json().catch(() => ({}))) as { step?: string; session?: string; purchaseId?: string };
  if ((step !== 'verify' && step !== 'deliver') || typeof session !== 'string' || typeof purchaseId !== 'string' || !/^[\w-]{1,128}$/.test(purchaseId)) {
    return json({ error: 'bad_request' }, 400);
  }

  // 1. who is asking
  const who = await vatar<{ playerId: string }>('/session/verify', { method: 'POST', body: { session } });
  if (!who.ok) return json({ error: 'bad_session' }, 401);

  // 2. the purchase, from Lagos Life itself: paid (or already delivered) and this player's
  const p = await vatar<{ productId: string; playerId: string; status: string }>(`/purchases/${encodeURIComponent(purchaseId)}`);
  if (!p.ok || p.data.playerId !== who.data.playerId) return json({ error: 'not_found' }, 404);
  if (p.data.status === 'refunded') return json({ error: 'refunded' }, 409);

  if (step === 'verify') return json({ ok: true, productId: p.data.productId, delivered: p.data.status === 'delivered' });

  // 3. the game has granted it: mark it delivered (safe to repeat)
  const d = await vatar<{ status: string }>(`/purchases/${encodeURIComponent(purchaseId)}/deliver`, { method: 'POST' });
  return d.ok ? json({ ok: true }) : json({ error: 'deliver_failed' }, 502);
}
