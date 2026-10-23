import { onSettings, setSetting, settings, type Settings } from '../../core/settings';
import { STAR_SVG, icon } from '../../core/icons';
import { coins, daily, onMeta, type MissionResult } from '../../core/meta';
import { renderEarned, renderMissions } from '../../core/metaui';
import { sounds } from './game/audio';
import { GAME, boatShop, mode, rippleMissions, type Mode } from './game/meta';
import { SKINS, skinPreview } from './game/skins';

// DOM overlay built from the shared cartoon kit: HUD pills, pop-up text, toast, hint,
// and the title / pause / game-over screens.

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export type ScreenName = 'title' | 'pause' | 'over' | null;

export interface UIHandlers {
  play(): void;
  resume(): void;
  restart(): void;
  menu(): void;
  pause(): void;
  /** The equipped boat style changed (bought or picked). */
  skin(id: string): void;
}

export interface OverInfo {
  score: number; best: number; isNew: boolean; stars: number; wave: number; bestCombo: number;
  daily: boolean; earned: { label: string; n: number }[]; missions: MissionResult[]; close: string;
}

const screens = { title: $('title'), pause: $('pause'), over: $('over') };
const hud = $('hud');
const scorePill = $('scorePill');
const scoreEl = $('score');
const livesEl = $('lives');
const hintEl = $('hint');
const toastEl = $('toast');
const popsEl = $('pops');
const flashEl = $('flash');

let current: ScreenName = 'title';
let hintShown = false;
let hintTop = false;
let hintDismissed = false;
let hintSince = 0;
const HINT_MS = 5000;
let lastScore = 0;
let lastLives = 3;

function restartAnim(el: HTMLElement, cls: string) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

function on(id: string, fn: () => void) {
  $(id).addEventListener('click', () => { sounds.click(); fn(); });
}

export const ui = {
  init(h: UIHandlers) {
    on('playBtn', h.play);
    on('resumeBtn', h.resume);
    on('restartBtn', h.restart);
    on('menuBtn', h.menu);
    on('againBtn', h.play);
    on('overMenuBtn', h.menu);
    $('pauseBtn').addEventListener('click', () => { sounds.click(); h.pause(); });

    const toggles = document.querySelectorAll<HTMLButtonElement>('[data-setting]');
    toggles.forEach(btn => btn.addEventListener('click', () => {
      const key = btn.dataset.setting as keyof Settings;
      setSetting(key, !settings[key]);
      sounds.click();
    }));
    onSettings(s => toggles.forEach(btn => {
      btn.setAttribute('aria-pressed', String(s[btn.dataset.setting as keyof Settings]));
    }));

    // keyboard: Space/Enter starts, Escape or P toggles pause
    addEventListener('keydown', e => {
      if (e.repeat) return;
      const k = e.key;
      if ((k === ' ' || k === 'Enter') && (current === 'title' || current === 'over')) {
        if (document.activeElement instanceof HTMLButtonElement || document.activeElement instanceof HTMLAnchorElement) return;
        e.preventDefault(); h.play();
      } else if (k === 'Escape' || k === 'p' || k === 'P') {
        if (current === null) h.pause();
        else if (current === 'pause') h.resume();
      }
    });
  },

  /** Title extras: info tabs, Classic/Daily switch, boat style row, missions. */
  initMeta(h: UIHandlers) {
    const tabs = [...document.querySelectorAll<HTMLButtonElement>('.info-tabs [data-tab]')];
    const showTab = (t: string) => {
      tabs.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tab === t)));
      $('titleMissions').hidden = t !== 'missions';
      $('howto').hidden = t !== 'howto';
    };
    tabs.forEach(b => b.addEventListener('click', () => { sounds.click(); showTab(b.dataset.tab!); }));
    this.showTab = showTab;

    document.querySelectorAll<HTMLButtonElement>('#modeSwitch [data-mode]').forEach(b => b.addEventListener('click', () => {
      sounds.click(); mode.set(b.dataset.mode as Mode); this.refreshTitle();
    }));

    $('skins').addEventListener('click', e => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-skin]');
      if (!btn) return;
      const id = btn.dataset.skin!;
      const res = boatShop.buy(id);
      if (res === 'poor') {
        sounds.nope();
        restartAnim(btn, 'shake');
        const item = SKINS.find(s => s.id === id)!;
        this.toast('Need more coins', `${(item.price - coins.balance).toLocaleString()} to go`);
        return;
      }
      if (res === 'bought') { sounds.unlock(); this.toast('New boat!', SKINS.find(s => s.id === id)!.name, '#ffd23f'); }
      else sounds.click();
      h.skin(id);
      this.refreshTitle();
    });
    onMeta(() => { if (current === 'title') this.refreshTitle(); });
  },

  showTab: (_t: string) => {},

  /** Re-render the parts of the title that depend on meta state. */
  refreshTitle() {
    const m = mode.current, d = daily.info(GAME);
    document.querySelectorAll<HTMLButtonElement>('#modeSwitch [data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
    $('dailyDone').textContent = d.playedToday ? `✓ ${d.best}` : '';
    renderMissions($('titleMissions'), rippleMissions.active);
    const eq = boatShop.equipped, bal = coins.balance;
    $('skins').innerHTML = SKINS.map(s => {
      const owned = boatShop.owns(s.id), on = s.id === eq;
      const cls = `skin${on ? ' on' : ''}${owned ? '' : ' locked'}${!owned && bal >= s.price ? ' afford' : ''}`;
      const label = owned ? s.name : `${s.name}, ${s.price} coins`;
      return `<button class="${cls}" data-skin="${s.id}" role="radio" aria-checked="${on}" aria-label="${label}" title="${label}">
        <img src="${skinPreview(s.id)}" alt="">${owned ? '' : `<small>${icon('lock')}${s.price}</small>`}</button>`;
    }).join('');
  },

  get screen() { return current; },

  show(name: ScreenName) {
    current = name;
    (Object.keys(screens) as Exclude<ScreenName, null>[]).forEach(k => { screens[k].hidden = k !== name; });
    hud.hidden = name === 'title' || name === 'over';
    if (name !== null) this.hint(false);
    (document.activeElement as HTMLElement | null)?.blur?.();
  },

  setBest(best: number) {
    $('titleBest').textContent = String(best);
  },

  setScore(n: number) {
    scoreEl.textContent = String(n);
    if (n > lastScore) restartAnim(scorePill, 'bump');
    lastScore = n;
  },

  setLives(n: number) {
    [...livesEl.children].forEach((el, i) => {
      el.classList.toggle('lost', i >= n);
      if (i === n && n < lastLives) restartAnim(el as HTMLElement, 'hit');
    });
    livesEl.setAttribute('aria-label', `${n} ${n === 1 ? 'boat' : 'boats'} left`);
    lastLives = n;
  },

  /** New run: the onboarding pill may show again. */
  resetHint() { hintDismissed = false; hintSince = 0; },

  /**
   * Onboarding pill; `top` moves it above the pond so it never covers the boat it describes.
   * It hides itself after HINT_MS of showing in a run (the ghost finger keeps going until the first tap).
   */
  hint(show: boolean, top = false) {
    const now = performance.now();
    if (show && !hintDismissed) {
      if (!hintSince) hintSince = now;
      else if (now - hintSince > HINT_MS) hintDismissed = true;
    }
    show = show && !hintDismissed;
    if (show !== hintShown) { hintShown = show; hintEl.hidden = !show; }
    if (show && top !== hintTop) { hintTop = top; hintEl.classList.toggle('top', top); }
  },

  toast(small: string, text: string, color?: string) {
    $('toastSmall').textContent = small;
    const t = $('toastText');
    t.textContent = text;
    t.style.color = color ?? '';
    restartAnim(toastEl, 'show');
  },
  clearToast() { toastEl.classList.remove('show'); },

  /** Outlined text that pops up from a point on the pond (game coords are CSS pixels). */
  pop(x: number, y: number, text: string, color: string, big = false) {
    if (popsEl.childElementCount > 12) popsEl.firstElementChild?.remove();
    const el = document.createElement('div');
    el.className = big ? 'pop k-outline pop--big' : 'pop k-outline';
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.color = color;
    el.addEventListener('animationend', () => el.remove(), { once: true });
    popsEl.appendChild(el);
  },

  /** Icy edge glow while a freeze power-up holds the timers. */
  frost(on: boolean) { $('frost').classList.toggle('on', on); },

  /** Red edge flash when a boat sinks. */
  flash() { restartAnim(flashEl, 'on'); },

  showOver(o: OverInfo) {
    popsEl.replaceChildren();
    $('overRibbon').textContent = o.isNew ? (o.daily ? 'New Daily Best!' : 'New Record!') : (o.daily ? 'Daily Challenge' : 'Game Over');
    $('overRibbon').classList.toggle('record', o.isNew);
    $('statBestLabel').textContent = o.daily ? 'Daily best' : 'Best';
    const close = $('soClose');
    close.textContent = o.close; close.hidden = !o.close || o.isNew;
    renderEarned($('earned'), o.earned);
    renderMissions($('overMissions'), [], o.missions);
    $('overScore').textContent = String(o.score);
    $('overLine').textContent = o.score === 1 ? 'boat home' : 'boats home';
    $('overNew').hidden = !o.isNew;
    $('statBest').textContent = String(o.best);
    $('statWave').textContent = String(o.wave);
    $('statCombo').textContent = o.bestCombo > 0 ? `x${o.bestCombo}` : '–';
    const stars = $('stars');
    stars.innerHTML = STAR_SVG + STAR_SVG + STAR_SVG; // fresh nodes so the pop-in replays
    [...stars.children].forEach((s, i) => s.classList.toggle('on', i < o.stars));
    stars.setAttribute('aria-label', `${o.stars} of 3 stars`);
    this.show('over');
  },
};
