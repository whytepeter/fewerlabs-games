import { packById } from '../src/game/packs.js';
import { bachs, GAME, json, ownsPack, player } from './_lib.js';

/**
 * POST /api/checkout { pack } with the player's Firebase ID token: opens a Bachs hosted checkout for
 * that pack and returns { url }. After paying, Bachs sends the buyer back to the game with
 * ?checkout_id=…, and the game calls /api/claim.
 */
export async function POST(req: Request) {
  const uid = await player(req);
  if (!uid) return json({ error: 'Sign-in needed' }, 401);
  const { pack: id } = (await req.json().catch(() => ({}))) as { pack?: string };
  const pack = packById(id ?? '');
  if (!pack) return json({ error: 'Unknown pack' }, 400);
  if (pack.once && (await ownsPack(uid, pack.id))) return json({ error: 'Already bought' }, 409);

  const site = new URL(req.url).origin;
  try {
    const c = await bachs<{ checkout_url: string }>('/v1/checkout-sessions', {
      method: 'POST',
      idempotencyKey: `${uid}-${pack.id}-${Date.now()}`,
      body: {
        pricing: { currency: 'USD', amount: pack.usd },
        metadata: { game: GAME, uid, pack: pack.id },
        reference: `${GAME}-${pack.id}`,
        success_url: `${site}/`, // Bachs adds ?checkout_id=…
        cancel_url: `${site}/?paid=0`,
      },
    });
    return json({ url: c.checkout_url });
  } catch (e) {
    console.error(e);
    return json({ error: 'Checkout is unavailable right now' }, 502);
  }
}
