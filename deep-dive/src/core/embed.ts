import { icon } from './icons';

/**
 * Embed SDK: lets the game run inside the Fewer Labs Games store (store/src/embed.ts).
 * The store loads the game at "/?embed=1" in a frame. When embedded, the game:
 *   - tells the store it is ready, so the store can drop its loading screen;
 *   - reports each finished run (score and best) so the store can show records;
 *   - adds an "All games" button to the title and pause menus that returns to the store.
 * Played on its own site, none of this runs.
 */

type Message = { type: 'ready' } | { type: 'exit' } | { type: 'score'; score: number; best?: number };

export const embedded = (() => {
  try {
    return window.parent !== window && new URLSearchParams(location.search).has('embed');
  } catch { return false; }
})();

let gameId = '';
// Answer only the page that embedded us; fall back to any origin when the browser hides it.
const target = (() => {
  try { return document.referrer ? new URL(document.referrer).origin : '*'; } catch { return '*'; }
})();

function post(msg: Message) {
  if (!embedded) return;
  try { window.parent.postMessage({ fewerlabs: 1, game: gameId, ...msg }, target); } catch { /* store gone */ }
}

export const embed = {
  /** A run finished. */
  score(score: number, best?: number) { post({ type: 'score', score: Math.round(score), best }); },
  /** Back to the store. */
  exit() { post({ type: 'exit' }); },
};

/** Call once at startup. `after` lists the menu buttons the "All games" button goes beside. */
export function initEmbed(id: string, after: string[] = ['playBtn', 'menuBtn']) {
  gameId = id;
  if (!embedded) return;
  document.documentElement.classList.add('is-embedded');
  for (const ref of after) {
    const anchor = document.getElementById(ref);
    if (!anchor) continue;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `k-btn k-btn--white k-btn--sm embed-exit${anchor.classList.contains('k-btn--block') ? ' k-btn--block' : ''}`;
    btn.innerHTML = `${icon('home')}All games`;
    btn.addEventListener('click', e => { e.stopPropagation(); embed.exit(); });
    anchor.after(btn);
  }
  post({ type: 'ready' });
}
