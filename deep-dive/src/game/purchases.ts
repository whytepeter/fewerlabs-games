import { cloud } from '../core/cloud';
import { coins } from '../core/meta';
import { store } from '../core/settings';
import { BOOSTERS, boosters } from './boosters';
import { packById, type Pack, type Perk } from './packs';
import { shells } from './shells';

/**
 * Buying packs with real money (Bachs hosted checkout; the server side is ../../api). The flow:
 * buy() asks /api/checkout for a checkout page and goes there; after paying, Bachs sends the player
 * back with ?checkout_id=…, which claim() hands to /api/claim; the server records the paid purchase
 * in Firestore, and sync() applies whatever is recorded and not yet applied. The webhook records it
 * too, so a player who closes the tab still gets it the next time the game opens.
 */
const BOUGHT = 'packsBought';

export type BuyResult = 'leaving' | { error: string };

export const purchases = {
  /** Purchases need the cloud (an account to attach them to). */
  get available() { return cloud.enabled; },
  /** A one-time pack this account already bought. */
  owns: (id: string) => store.get<string[]>(BOUGHT, []).includes(id),
  /** A lasting perk this account bought (saved, so it follows the cloud save). */
  has: (perk: Perk) => store.get(perk, false),

  async buy(pack: Pack): Promise<BuyResult> {
    const token = await cloud.idToken();
    if (!token) return { error: 'You’re offline. Connect to the internet to buy.' };
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack: pack.id }),
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) return { error: body.error ?? 'Checkout is unavailable right now.' };
      // Inside the store's frame, the checkout opens in its own tab; otherwise the game hands over to it.
      if (window.top !== window.self) window.open(body.url, '_blank', 'noopener');
      else window.location.assign(body.url);
      return 'leaving';
    } catch {
      return { error: 'Checkout is unavailable right now.' };
    }
  },

  /** Back from a checkout: the id Bachs added to the address, sent to the server to record the purchase. */
  async claim() {
    const url = new URL(window.location.href), id = url.searchParams.get('checkout_id');
    if (!url.searchParams.has('checkout_id') && !url.searchParams.has('paid')) return;
    url.searchParams.delete('checkout_id');
    url.searchParams.delete('paid');
    history.replaceState(null, '', url);
    const token = id && (await cloud.idToken());
    if (!token) return;
    await fetch('/api/claim', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkout_id: id }),
    }).catch(() => undefined);
  },

  /** Apply every recorded, unapplied purchase; returns what was given. Each is marked applied first, so it's never given twice. */
  async sync(): Promise<Pack[]> {
    const given: Pack[] = [];
    for (const { id, data } of await cloud.unappliedPurchases()) {
      const pack = packById(String(data.pack));
      if (!pack || !(await cloud.markApplied(id))) continue;
      shells.add(Number(data.hearts) || 0);
      if (Number(data.coins) > 0) coins.add(Number(data.coins));
      const b = Number(data.boosters) || 0;
      if (b > 0) BOOSTERS.forEach(x => boosters.add(x.id, b));
      if (pack.perk && data.perk === pack.perk) store.set(pack.perk, true);
      if (pack.once) store.set(BOUGHT, [...store.get<string[]>(BOUGHT, []), pack.id]);
      given.push(pack);
    }
    return given;
  },
};
