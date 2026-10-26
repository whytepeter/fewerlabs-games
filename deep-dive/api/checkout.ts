import { packById } from '../src/game/packs.js';
import { bachs, GAME, json, ownsPack, player } from './_lib.js';

/**
 * POST /api/checkout { pack } with the player's Firebase ID token: opens a Bachs hosted checkout for
 * that pack and returns { url, checkout_id }. The game remembers the id and, once the buyer is back
 * (Bachs adds ?checkout_id=… too), calls /api/claim with it.
 */
export async function POST(req: Request) {
  const uid = await player(req);
  if (!uid) return json({ error: 'Sign-in needed' }, 401);
  const { pack: id } = (await req.json().catch(() => ({}))) as { pack?: string };
  const pack = packById(id ?? '');
  if (!pack) return json({ error: 'Unknown pack' }, 400);
  if (pack.once && (await ownsPack(uid, pack.id))) return json({ error: 'Already bought' }, 409);

  const site = new URL(req.url).origin;
  // Bachs wants a reference no other checkout has used, so the same pack can be bought again.
  const ref = `${GAME}-${pack.id}-${uid}-${Date.now()}`;
  try {
    const c = await bachs<{ checkout_id: string; checkout_url: string }>('/v1/checkout-sessions', {
      method: 'POST',
      idempotencyKey: ref,
      body: {
        pricing: { currency: 'USD', amount: pack.usd },
        metadata: { game: GAME, uid, pack: pack.id },
        reference: ref,
        success_url: `${site}/`, // Bachs adds ?checkout_id=…
        cancel_url: `${site}/?paid=0`,
      },
    });
    return json({ url: c.checkout_url, checkout_id: c.checkout_id });
  } catch (e) {
    console.error(e);
    return json({ error: 'Checkout is unavailable right now' }, 502);
  }
}
