/**
 * Real-money packs, sold through Bachs (bachs.io) hosted checkout. The server functions in ../../api
 * read this same list, so a price or contents can't be changed from the browser. Ids are saved
 * with every purchase, so never rename one; retire a pack by removing it instead.
 */
export type PackId = 'hearts5' | 'hearts12' | 'hearts30' | 'starter' | 'coins5k' | 'coins20k' | 'coins40k' | 'coinDoubler';

/** A lasting effect a pack switches on; sync() saves it as a store flag of the same name. */
export type Perk = 'coinDoubler';

export interface Pack {
  id: PackId;
  name: string;
  /** Price in US dollars, as Bachs wants it (a decimal string, at least 1.00). Bachs shows it in the buyer's own currency. */
  usd: string;
  hearts: number;
  coins?: number;
  /** One of each booster, this many times. */
  boosters?: number;
  /** Switched on for good (bought once). */
  perk?: Perk;
  /** Bought once per account. */
  once?: boolean;
  /** A short line for the shop. */
  note?: string;
}

export const PACKS: Pack[] = [
  { id: 'starter',  name: 'Starter Pack',    usd: '1.00', hearts: 5, coins: 2000, boosters: 1, once: true, note: 'One time only' },
  { id: 'hearts5',  name: '5 Sea Hearts',    usd: '1.00', hearts: 5 },
  { id: 'hearts12', name: '12 Sea Hearts',   usd: '1.99', hearts: 12, note: 'Best seller' },
  { id: 'hearts30', name: '30 Sea Hearts',   usd: '4.99', hearts: 30, note: 'Best value' },
  { id: 'coinDoubler', name: 'Coin Doubler', usd: '2.99', hearts: 0, perk: 'coinDoubler', once: true, note: 'Yours for good' },
  { id: 'coins5k',  name: '5,000 coins',     usd: '1.00', hearts: 0, coins: 5000 },
  { id: 'coins20k', name: '20,000 coins',    usd: '2.99', hearts: 0, coins: 20000, note: 'Best seller' },
  { id: 'coins40k', name: '40,000 coins',    usd: '4.99', hearts: 0, coins: 40000, note: 'Best value' },
];

/** Packs that are coins or a coin perk (the shop's Coins tab); the rest go under Sea Hearts. */
export const isCoinPack = (p: Pack) => !p.hearts && !!(p.coins || p.perk);

export const packById = (id: string) => PACKS.find(p => p.id === id) ?? null;
