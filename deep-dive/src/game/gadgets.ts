import { metaChanged, shop } from '../core/meta';
import { store } from '../core/settings';

/**
 * Gadgets (as in Jetpack Joyride): bought once, then equipped into a few slots. Each one bends a
 * rule of the dive a little. Ids are saved, so never rename one.
 */
export type GadgetId = 'airsaver' | 'pearlpull' | 'headstart' | 'coralguard' | 'luckyclam' | 'charm';

export interface Gadget { id: GadgetId; name: string; text: string; price: number }

export const GADGETS: Gadget[] = [
  { id: 'airsaver',   name: 'Air Saver',      text: 'Your air lasts 20% longer.',                       price: 1000 },
  { id: 'headstart',  name: 'Head Start',     text: 'Kick off every dive with a Turbo burst, then a short shield.', price: 1600 },
  { id: 'pearlpull',  name: 'Pearl Pull',     text: 'Pearls close by drift to you, no magnet needed.',  price: 1800 },
  { id: 'coralguard', name: 'Coral Guard',    text: 'The first sharp coral you hit each dive is free.', price: 2300 },
  { id: 'luckyclam',  name: 'Lucky Clam',     text: 'One pearl in four counts double.',                 price: 2900 },
  { id: 'charm',      name: 'Close-Call Charm', text: 'Close calls chain for longer and pay +1 more.',  price: 3500 },
];

export const AIR_SAVER = 0.8;          // oxygen drain multiplier
export const HEAD_START_TURBO = 6;     // seconds of Turbo at the start (about 250 m)
export const HEAD_START_SHIELD = 4;    // seconds of shield once the Turbo runs out
export const PEARL_PULL_RANGE = 85;
export const LUCKY_CLAM = 0.25;
export const CHARM_WINDOW = 6;         // seconds to chain close calls (normally 4)

/** Slots for equipped gadgets: two, and a third from this mission rank. */
export const SLOTS = 2, THIRD_SLOT_RANK = 5;

const owned = shop('deep-dive', 'gadget', GADGETS);

export const gadgets = {
  owns: (id: GadgetId) => owned.owns(id),
  slots: (rank: number) => SLOTS + (rank >= THIRD_SLOT_RANK ? 1 : 0),
  /** Equipped gadget ids (only ones the player owns). */
  equipped(rank: number): GadgetId[] {
    return store.get<GadgetId[]>('gadgets', []).filter(id => owned.owns(id)).slice(0, this.slots(rank));
  },
  has(id: GadgetId, rank: number) { return this.equipped(rank).includes(id); },
  /** Buy (equipping it if a slot is free). */
  buy(id: GadgetId, rank: number): 'bought' | 'poor' | 'owned' {
    if (owned.owns(id)) return 'owned';
    const before = owned.equipped; // shop() equips on buy; gadgets keep their own list instead
    const r = owned.buy(id);
    owned.equip(before);
    if (r !== 'bought') return 'poor';
    if (this.equipped(rank).length < this.slots(rank)) this.toggle(id, rank);
    return 'bought';
  },
  /** Equip or unequip. False when every slot is full. */
  toggle(id: GadgetId, rank: number) {
    const list = this.equipped(rank);
    if (list.includes(id)) store.set('gadgets', list.filter(g => g !== id));
    else if (list.length < this.slots(rank)) store.set('gadgets', [...list, id]);
    else return false;
    metaChanged();
    return true;
  },
};
