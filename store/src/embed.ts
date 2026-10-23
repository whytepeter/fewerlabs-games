import type { Game } from './catalog';
import { icon } from './core/icons';

/**
 * The embed engine: loads a game (hosted on its own site) into a sandboxed frame and listens
 * for messages from it. Games include the matching src/core/embed.ts, which sends:
 *
 *   { fewerlabs: 1, game, type: 'ready' }                  the game has started
 *   { fewerlabs: 1, game, type: 'score', score, best? }    a run finished
 *   { fewerlabs: 1, game, type: 'exit' }                   the player tapped "exit to store"
 *
 * Messages are only accepted from the exact origin the game was loaded from.
 */

export interface EmbedHandlers {
  onReady?(): void;
  onScore?(score: number, best?: number): void;
  onExit?(): void;
}

export interface Embedded {
  frame: HTMLIFrameElement | null;
  reload(): void;
  destroy(): void;
  /** True once the game said hello (it supports the store's exit button and score reports). */
  readonly talks: boolean;
}

const LOAD_TIMEOUT = 15000;

export function mountGame(host: HTMLElement, game: Game, h: EmbedHandlers = {}): Embedded {
  host.classList.add('embed');
  host.style.setProperty('--game-bg', game.bg);
  const loader = document.createElement('div');
  loader.className = 'embed-loader';
  loader.innerHTML = `
    <img class="embed-icon" src="/games/${game.id}/icon.svg" alt="" />
    <div class="embed-title">${game.title}</div>
    <div class="embed-bar"><i></i></div>
    <div class="embed-tip">${game.howTo[0][0]}: ${game.howTo[0][1]}</div>`;
  host.append(loader);

  if (!game.url) {
    showError(`${game.title} isn't connected yet. Set VITE_GAME_${game.id.replace('-', '_').toUpperCase()}_URL to where it is hosted.`, false);
    return { frame: null, reload() {}, destroy() { loader.remove(); }, get talks() { return false; } };
  }

  const origin = new URL(game.url).origin;
  let frame: HTMLIFrameElement;
  let talks = false, timer = 0;

  const create = () => {
    frame = document.createElement('iframe');
    frame.className = 'embed-frame';
    frame.title = game.title;
    frame.src = `${game.url}/?embed=1`;
    frame.allow = 'fullscreen; autoplay; gamepad; screen-wake-lock; accelerometer; gyroscope';
    frame.setAttribute('allowfullscreen', '');
    frame.addEventListener('load', () => {
      // A game without the embed SDK never says hello: reveal it shortly after it loads anyway.
      window.setTimeout(() => reveal(), talks ? 0 : 1200);
    });
    host.prepend(frame);
    loader.hidden = false;
    loader.classList.remove('error', 'done');
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (!loader.classList.contains('done')) showError(`${game.title} is taking a while to load. Check your connection and try again.`, true);
    }, LOAD_TIMEOUT);
  };

  function reveal() {
    clearTimeout(timer);
    loader.classList.add('done');
    window.setTimeout(() => { if (loader.classList.contains('done')) loader.hidden = true; }, 350);
  }

  function showError(text: string, canRetry: boolean) {
    loader.hidden = false;
    loader.classList.add('error');
    loader.querySelector('.embed-tip')!.innerHTML = `${text}
      <span class="embed-actions">${canRetry ? `<button class="btn btn-sm btn-primary" data-retry>${icon('refresh')}Retry</button>` : ''}
      ${game.url ? `<a class="btn btn-sm" href="${game.url}" target="_blank" rel="noopener">${icon('external')}Open in a new tab</a>` : ''}</span>`;
    loader.querySelector('[data-retry]')?.addEventListener('click', () => api.reload());
  }

  const onMessage = (e: MessageEvent) => {
    if (e.origin !== origin || e.source !== frame?.contentWindow) return;
    const d = e.data as { fewerlabs?: number; type?: string; score?: number; best?: number } | null;
    if (!d || d.fewerlabs !== 1) return;
    if (d.type === 'ready') { talks = true; reveal(); h.onReady?.(); }
    else if (d.type === 'score' && typeof d.score === 'number' && Number.isFinite(d.score)) h.onScore?.(Math.max(0, Math.round(d.score)), typeof d.best === 'number' ? Math.round(d.best) : undefined);
    else if (d.type === 'exit') h.onExit?.();
  };
  addEventListener('message', onMessage);
  create();

  const api: Embedded = {
    get frame() { return frame; },
    get talks() { return talks; },
    reload() { frame.remove(); talks = false; create(); },
    destroy() {
      clearTimeout(timer);
      removeEventListener('message', onMessage);
      frame.remove();
      loader.remove();
      host.classList.remove('embed');
    },
  };
  return api;
}
