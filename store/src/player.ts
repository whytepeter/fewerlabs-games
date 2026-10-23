import { iconUrl, type Game } from './catalog';
import { profile } from './profile';
import { mountGame } from './embed';
import { icon } from './core/icons';

/**
 * The play screen. On phones the game fills the whole screen like a native app and the game's
 * own menus offer "All games" (through the embed SDK); the system back gesture works too.
 * On larger screens a slim bar above the game holds back, best score, restart and full screen.
 */
export function openPlayer(g: Game, exit: () => void): () => void {
  profile.opened(g.id);
  document.body.classList.add('playing');
  const fmt = (n: number) => (n > 0 ? `${n.toLocaleString()}${g.unit ? ` ${g.unit}` : ''}` : '—');

  const el = document.createElement('div');
  el.className = 'player';
  el.innerHTML = `
    <div class="player-bar">
      <button class="btn btn-ghost btn-sm" data-act="back">${icon('back')}Games</button>
      <div class="player-title">
        <img src="${iconUrl(g)}" alt="" width="32" height="32" />
        <b>${g.title}</b>
      </div>
      <span class="player-best" title="${g.scoreLabel}">${icon('trophy')}Best <b data-best>${fmt(profile.stats(g.id).best)}</b></span>
      <button class="btn btn-icon" data-act="reload" aria-label="Restart game" title="Restart">${icon('restart')}</button>
      <button class="btn btn-icon" data-act="fullscreen" aria-label="Full screen" title="Full screen">${icon('fullscreen')}</button>
    </div>
    <div class="player-stage"><div class="stage" id="stage"></div></div>
    <button class="player-float-back" data-act="back" aria-label="Back to all games" hidden>${icon('back')}</button>
    <div class="player-toast" aria-live="polite"></div>`;
  document.body.append(el);

  const stage = el.querySelector<HTMLElement>('#stage')!;
  const toast = el.querySelector<HTMLElement>('.player-toast')!;
  const floatBack = el.querySelector<HTMLElement>('.player-float-back')!;
  let toastTimer = 0;
  const say = (text: string) => {
    toast.innerHTML = `${icon('trophy')}${text}`;
    toast.classList.remove('show'); void toast.offsetWidth; toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2400);
  };

  const game = mountGame(stage, g, {
    onReady() { floatBack.hidden = true; },
    onScore(score, best) {
      const before = profile.stats(g.id).best;
      profile.finished(g.id, score, best);
      el.querySelector('[data-best]')!.textContent = fmt(profile.stats(g.id).best);
      if (score > before && before > 0) say(`New best: ${fmt(score)}`);
    },
    onExit: exit,
  });

  // Games that don't talk to the store still need a way out on phones.
  const fallback = window.setTimeout(() => { if (!game.talks) floatBack.hidden = false; }, 5000);

  el.addEventListener('click', e => {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'back') exit();
    else if (act === 'reload') game.reload();
    else if (act === 'fullscreen') {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void stage.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
    }
  });
  // Put the keyboard straight into the game so Space/arrows work without a click.
  window.setTimeout(() => game.frame?.focus(), 400);

  return () => {
    clearTimeout(fallback);
    clearTimeout(toastTimer);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    game.destroy();
    el.remove();
    document.body.classList.remove('playing');
  };
}
