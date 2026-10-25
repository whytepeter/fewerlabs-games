import { grant, json } from './_lib.js';

/**
 * POST /api/bachs-webhook: Bachs calls this when a checkout completes (subscribe the endpoint to
 * `checkout.completed`). It covers buyers who close the tab before coming back to the game. The
 * body isn't trusted: only the checkout id is taken from it, and grant() reads that checkout back
 * from Bachs before recording anything.
 */
export async function POST(req: Request) {
  const event = await req.json().catch(() => null);
  const id = checkoutId(event);
  if (!id) return json({ ok: true }); // not about a checkout: nothing to do
  try {
    await grant(id);
    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: 'retry' }, 500); // Bachs retries failed deliveries
  }
}

/** The checkout this event is about: a `checkout_id` field, or a `chk_…` id, anywhere in the payload. */
function checkoutId(v: unknown, depth = 0): string | null {
  if (!v || typeof v !== 'object' || depth > 4) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.checkout_id === 'string') return o.checkout_id;
  for (const x of Object.values(o)) {
    if (typeof x === 'string' && x.startsWith('chk_')) return x;
    const found = checkoutId(x, depth + 1);
    if (found) return found;
  }
  return null;
}
