import { coins, metaChanged } from '../core/meta';
import { store } from '../core/settings';

/**
 * Boosters (as in Subway Surfers): one-use items you keep in a stack and tap at the start of a
 * dive, before the first few seconds are up. Bought in the shop, found in chests and won in the
 * weekly hunt. Ids are saved, so never rename one.
 */
export type BoosterId = 'megaturbo' | 'doubler' | 'charged';

export interface Booster { id: BoosterId; name: string; text: string; price: number; icon: string }

export const BOOSTERS: Booster[] = [
  { id: 'megaturbo', name: 'Mega Turbo',  text: 'Blast off in a 10-second Turbo (about 500 m).', price: 250, icon: 'pk-turbo' },
  { id: 'doubler',   name: 'Coin Doubler', text: 'Double the coins from this dive.',              price: 300, icon: 'bs-doubler' },
  { id: 'charged',   name: 'Full Charge', text: 'Start with your special move ready to go.',     price: 150, icon: 'bs-charged' },
];

export const MEGA_TURBO = 10;   // seconds
/** How long the booster chips stay up at the start of a dive (seconds, and metres at most). */
export const BOOSTER_WINDOW = 5, BOOSTER_UNTIL = 120;

const KEY = 'boosters';
const all = () => store.get<Partial<Record<BoosterId, number>>>(KEY, {});

export const boosters = {
  count: (id: BoosterId) => all()[id] ?? 0,
  /** Boosters you hold, in shop order. */
  held: () => BOOSTERS.filter(b => (all()[b.id] ?? 0) > 0),
  add(id: BoosterId, n = 1) { const a = all(); a[id] = (a[id] ?? 0) + n; store.set(KEY, a); metaChanged(); },
  /** Use one; false when there's none left. */
  use(id: BoosterId) {
    const a = all();
    if (!a[id]) return false;
    a[id]!--;
    store.set(KEY, a);
    metaChanged();
    return true;
  },
  buy(id: BoosterId): 'bought' | 'poor' {
    const b = BOOSTERS.find(x => x.id === id)!;
    if (!coins.spend(b.price)) return 'poor';
    this.add(id);
    return 'bought';
  },
};

export const boosterById = (id: BoosterId) => BOOSTERS.find(b => b.id === id)!;
