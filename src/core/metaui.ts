import { coins, onMeta, streak, type Mission, type MissionResult } from './meta';
import { icon } from './icons';

/**
 * DOM pieces for the arcade meta (coins, missions, daily), styled by kit.css (.k-coins,
 * .k-missions, .k-earned). Games put empty containers in their markup and call these.
 */

const COIN_SVG = '<svg class="k-coin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M12 7v10M9.5 9.2c.6-1 1.5-1.4 2.6-1.4 1.5 0 2.5.8 2.5 1.9 0 2.7-5.2 1.7-5.2 4.5 0 1.1 1 2 2.6 2 1.2 0 2.1-.5 2.7-1.4" class="k-coin-mark"/></svg>';
export const coinIcon = () => COIN_SVG;

/** A live coin counter: <div class="k-coins" data-coins></div>, kept up to date automatically. */
export function mountCoins(root: ParentNode = document) {
  const els = [...root.querySelectorAll<HTMLElement>('[data-coins]')];
  const draw = () => els.forEach(el => { el.innerHTML = `${COIN_SVG}<b>${coins.balance.toLocaleString()}</b>`; });
  draw();
  onMeta(draw);
}

/** A live streak badge: <span data-streak></span>; hidden until there is a streak. */
export function mountStreak(root: ParentNode = document) {
  const els = [...root.querySelectorAll<HTMLElement>('[data-streak]')];
  const draw = () => els.forEach(el => {
    const n = streak.count;
    el.hidden = n < 1;
    el.innerHTML = `${icon('star')}<b>${n}</b><small>day${n === 1 ? '' : 's'}</small>`;
    el.title = `${n}-day play streak`;
  });
  draw();
  onMeta(draw);
}

/** Missions list. Pass `results` after a run to show what moved and what got completed. */
export function renderMissions(el: HTMLElement, list: Mission[], results?: MissionResult[]) {
  const rows = results ?? list.map(m => ({ mission: m, done: false, gained: 0 }));
  el.innerHTML = rows.map(({ mission: m, done, gained }) => {
    const frac = Math.min(1, m.progress / m.target);
    const prog = `<small>${m.kind === 'run' && !done ? 'Best ' : ''}${Math.min(m.progress, m.target).toLocaleString()} / ${m.target.toLocaleString()}</small>`;
    return `<li class="k-mission${done ? ' done' : ''}${gained > 0 && !done ? ' moved' : ''}">
      <span class="k-mission-check">${done ? icon('star') : ''}</span>
      <span class="k-mission-body"><span class="k-mission-text">${m.text}</span>
        <span class="k-mission-bar"><i style="transform:scaleX(${done ? 1 : frac})"></i></span>${prog}</span>
      <span class="k-mission-reward">${COIN_SVG}${m.reward}</span>
    </li>`;
  }).join('');
}

/** "+N coins" summary for a game-over card, with the reasons. */
export function renderEarned(el: HTMLElement, parts: { label: string; n: number }[]) {
  const items = parts.filter(p => p.n > 0);
  const total = items.reduce((s, p) => s + p.n, 0);
  el.hidden = total <= 0;
  el.innerHTML = `<span class="k-earned-total">${COIN_SVG}+${total.toLocaleString()}</span>
    <span class="k-earned-parts">${items.map(p => `${p.label} +${p.n}`).join(' · ')}</span>`;
}
