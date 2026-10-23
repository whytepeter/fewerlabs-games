import { onSettings, setSetting, settings, type Settings } from '../../core/settings';
import { STAR_SVG } from '../../core/icons';
import { sounds } from './game/audio';

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
}

export interface OverInfo { score: number; best: number; isNew: boolean; stars: number; wave: number; bestCombo: number }

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
    $('overRibbon').textContent = o.isNew ? 'New Record!' : 'Game Over';
    $('overRibbon').classList.toggle('record', o.isNew);
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
