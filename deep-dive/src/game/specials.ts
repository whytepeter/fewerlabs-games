import { charOf, SKINS, skinIndex } from './skins';

/**
 * Every character's special move (Temple Run / Sonic Dash style): a meter that fills as you collect
 * pearls, then a double-tap (or the button in the corner) fires it. Ids are saved, so never rename one.
 */
export type SpecialId = 'wind' | 'dash' | 'bloom' | 'puff' | 'gold' | 'flash' | 'phase' | 'steady';

export interface Special { id: SpecialId; name: string; text: string; /** Seconds it lasts (0 = instant). */ time: number }

export const SPECIALS: Record<SpecialId, Special> = {
  wind:   { id: 'wind',   name: 'Second Wind', text: 'Fills your air and puts up a shield for a while.',   time: 5 },
  dash:   { id: 'dash',   name: 'Dash',        text: 'A quick burst of speed that bowls through anything.', time: 2.5 },
  bloom:  { id: 'bloom',  name: 'Pearl Bloom', text: 'A trail of pearls blooms ahead and drifts to you.',   time: 5 },
  puff:   { id: 'puff',   name: 'Puff Up',     text: 'Pops every creature close by.',                       time: 0 },
  gold:   { id: 'gold',   name: 'Gold Rush',   text: 'Every pearl counts double for a while.',              time: 8 },
  flash:  { id: 'flash',  name: 'Flash',       text: 'Lights up the dark and freezes the creatures around.', time: 6 },
  phase:  { id: 'phase',  name: 'Phase',       text: 'Drift right through creatures for a few seconds.',    time: 4 },
  steady: { id: 'steady', name: 'Steady Hands', text: 'Slows the whole trench down so you can thread it.',  time: 4 },
};

/** The special of whoever wears this outfit: specials belong to the character (see CHARACTERS). */
export const specialOf = (outfit: string) => SPECIALS[charOf(SKINS[skinIndex(outfit)]).special];

/** Pearls that fill the meter from empty, and how full it starts each dive. */
export const SPECIAL_PEARLS = 50, SPECIAL_START = 0.2;
/** Puff Up's reach (px), Steady Hands' world speed, and two taps closer than this (ms) are a double-tap. */
export const PUFF_RANGE = 200, STEADY_RATE = 0.6, DOUBLE_TAP = 280;
