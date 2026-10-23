import { onSettings, setSetting, settings, type Settings } from '../../core/settings';
import { hydrateIcons, icon, wobbleLetters, STAR_SVG } from '../../core/icons';

// The DOM layer: HUD, hint, title / pause / game-over screens, built from the shared cartoon kit.
// The Game scene drives it.

/** Distance in metres for 1, 2 and 3 stars. From the bot: never tapping scores ~74 m (p90 106),
 *  a ±40 ms timer has a median of ~430 m and a p90 of ~750 m. */
export const STAR_METRES = [150, 400, 750] as const;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

hydrateIcons();
wobbleLetters($('logo'));
$('overStars').innerHTML = STAR_SVG.repeat(3);

const el = {
  hud: $('hud'), dist: $('dist'), streak: $('streak'), streakPill: $('streakPill'), hudBest: $('hudBest'), pauseBtn: $('pauseBtn'),
  hint: $('hint'), hintText: $('hintText'),
  title: $('title'), titleBest: $('titleBest'), playBtn: $('playBtn'),
  pause: $('pause'), resumeBtn: $('resumeBtn'), restartBtn: $('restartBtn'), menuBtn: $('menuBtn'),
  over: $('over'), overPanel: document.querySelector<HTMLElement>('.panel-over')!, overRibbon: $('overRibbon'),
  overStars: $('overStars'), overDist: $('overDist'), overTag: $('overTag'), overSkips: $('overSkips'),
  overStreak: $('overStreak'), overGlass: $('overGlass'), againBtn: $('againBtn'), overMenuBtn: $('overMenuBtn'),
};

export interface UiHandlers {
  play(): void; pause(): void; resume(): void; restart(): void; menu(): void; again(): void;
  /** Any UI button press, so the scene can unlock audio and click. */
  press(): void;
}

export interface OverStats { metres: number; skips: number; bestStreak: number; glass: number; best: number; isBest: boolean; plunked: boolean }

let shownDist = -1, shownStreak = -1;

const bump = (e: HTMLElement) => { e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); };

export const ui = {
  bind(h: UiHandlers) {
    const on = (b: HTMLElement, fn: () => void) => b.addEventListener('click', e => { e.preventDefault(); h.press(); fn(); });
    on(el.playBtn, h.play);
    on(el.pauseBtn, h.pause);
    on(el.resumeBtn, h.resume);
    on(el.restartBtn, h.restart);
    on(el.menuBtn, h.menu);
    on(el.againBtn, h.again);
    on(el.overMenuBtn, h.menu);
    document.querySelectorAll<HTMLButtonElement>('[data-setting]').forEach(b => {
      const key = b.dataset.setting as keyof Settings;
      b.addEventListener('click', e => { e.preventDefault(); setSetting(key, !settings[key]); h.press(); });
    });
    onSettings(s => {
      document.querySelectorAll<HTMLButtonElement>('[data-setting]').forEach(b => {
        const key = b.dataset.setting as keyof Settings;
        const v = s[key];
        b.setAttribute('aria-pressed', String(v));
        // round sound buttons swap between speaker and muted speaker
        if (key === 'sound' && b.classList.contains('k-icon-btn')) b.innerHTML = icon(v ? 'sound' : 'mute');
      });
    });
  },

  screen(which: 'title' | 'pause' | 'over' | null) {
    el.title.hidden = which !== 'title';
    el.pause.hidden = which !== 'pause';
    el.over.hidden = which !== 'over';
    const focus = which === 'title' ? el.playBtn : which === 'pause' ? el.resumeBtn : which === 'over' ? el.againBtn : null;
    if (focus && matchMedia('(pointer: fine)').matches) focus.focus({ preventScroll: true });
  },
  get open() { return !el.title.hidden || !el.pause.hidden || !el.over.hidden; },

  hud(show: boolean) { el.hud.hidden = !show; },
  setBest(m: number) {
    el.hudBest.textContent = String(m);
    el.titleBest.textContent = String(m);
  },
  setDist(m: number) {
    if (m === shownDist) return;
    shownDist = m;
    el.dist.textContent = String(m);
  },
  setStreak(n: number) {
    if (n === shownStreak) return;
    const up = n > shownStreak;
    shownStreak = n;
    el.streakPill.hidden = n < 2;
    el.streak.textContent = String(n);
    el.streakPill.classList.toggle('hot', n >= 8);
    if (up && n >= 2) bump(el.streakPill);
  },
  hint(text: string | null) {
    if (!text) { el.hint.hidden = true; return; }
    if (el.hintText.textContent !== text) el.hintText.textContent = text;
    el.hint.hidden = false;
  },
  showOver(s: OverStats) {
    const record = s.isBest && s.metres > 0;
    el.overPanel.classList.toggle('record', record);
    el.overRibbon.textContent = record ? 'New Record!' : s.plunked && s.skips === 0 ? 'Plunk!' : 'Splash!';
    el.overDist.textContent = String(s.metres);
    el.overTag.textContent = s.plunked && s.skips === 0 ? 'TOO STEEP! THROW FLATTER' : record ? 'NEW BEST!' : `BEST ${s.best} m`;
    el.overSkips.textContent = String(s.skips);
    el.overStreak.textContent = s.bestStreak > 0 ? `×${s.bestStreak}` : '–';
    el.overGlass.textContent = String(s.glass);
    // restart the star pop-in every time
    el.overStars.querySelectorAll('.k-star').forEach((st, i) => {
      st.classList.remove('on');
      void (st as HTMLElement).getBoundingClientRect();
      st.classList.toggle('on', s.metres >= STAR_METRES[i]);
    });
    ui.screen('over');
  },
};
