/**
 * Real-money packs, sold through Bachs (bachs.io) hosted checkout. The server functions in ../../api
 * read this same list, so a price or contents can't be changed from the browser. Ids are saved
 * with every purchase, so never rename one; retire a pack by removing it instead.
 */
export type PackId = 'hearts5' | 'hearts12' | 'hearts30' | 'starter';

export interface Pack {
  id: PackId;
  name: string;
  /** Price in US dollars, as Bachs wants it (a decimal string). Bachs shows it in the buyer's own currency. */
  usd: string;
  hearts: number;
  coins?: number;
  /** One of each booster, this many times. */
  boosters?: number;
  /** Bought once per account. */
  once?: boolean;
  /** A short line for the shop. */
  note?: string;
}

export const PACKS: Pack[] = [
  { id: 'starter',  name: 'Starter Pack',    usd: '0.99', hearts: 5, coins: 2000, boosters: 1, once: true, note: 'One time only' },
  { id: 'hearts5',  name: '5 Sea Hearts',    usd: '0.99', hearts: 5 },
  { id: 'hearts12', name: '12 Sea Hearts',   usd: '1.99', hearts: 12, note: 'Best seller' },
  { id: 'hearts30', name: '30 Sea Hearts',   usd: '4.99', hearts: 30, note: 'Best value' },
];

export const packById = (id: string) => PACKS.find(p => p.id === id) ?? null;
