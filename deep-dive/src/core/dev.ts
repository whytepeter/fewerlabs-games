import { cloud } from './cloud';
import { store } from './settings';

/**
 * Dev mode, for play-testing: you can't lose a life or run out of air, and nothing goes to the
 * leaderboards. The switch only shows on the local dev server or for the accounts below (a
 * convenience for testing, not a security boundary). Kept on this device only.
 */
const DEV_EMAILS = ['peteremmanuelwhyte@gmail.com'];

export const dev = {
  /** May this player see the switch? */
  get allowed() { return import.meta.env.DEV || DEV_EMAILS.includes((cloud.account.email ?? '').toLowerCase()); },
  get on() { return this.allowed && store.get('devMode', false); },
  set(on: boolean) { store.set('devMode', on); },
};
