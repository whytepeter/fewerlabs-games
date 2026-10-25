import { grant, json, player } from './_lib.js';

/**
 * POST /api/claim { checkout_id } with the player's Firebase ID token, called when Bachs sends the
 * buyer back to the game. Records the purchase if it's paid; the game then picks it up.
 */
export async function POST(req: Request) {
  const uid = await player(req);
  if (!uid) return json({ error: 'Sign-in needed' }, 401);
  const { checkout_id: id } = (await req.json().catch(() => ({}))) as { checkout_id?: string };
  try {
    const owner = await grant(id ?? '');
    if (!owner) return json({ ok: false }, 202); // not paid (yet): the webhook will record it once it is
    return json({ ok: owner === uid });
  } catch (e) {
    console.error(e);
    return json({ error: 'Could not check the payment' }, 502);
  }
}
