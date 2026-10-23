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

/** The in-game stone (outlined, with its face) for HUD pills, so the UI matches the lake art. */
function stoneSvg(face: 'eyes' | 'squint') {
  const eyes = face === 'eyes'
    ? '<ellipse cx="21" cy="12.2" rx="2.4" ry="2.8" fill="#fff" stroke="#16233b" stroke-width="1.2"/><ellipse cx="21.7" cy="12.5" rx="1.35" ry="1.7" fill="#16233b"/>' +
      '<ellipse cx="26.6" cy="12.2" rx="2.4" ry="2.8" fill="#fff" stroke="#16233b" stroke-width="1.2"/><ellipse cx="27.3" cy="12.5" rx="1.35" ry="1.7" fill="#16233b"/>'
    : '<path d="M18.8 13l2.2-2.2 2.2 2.2M24.4 13l2.2-2.2 2.2 2.2" fill="none" stroke="#16233b" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<ellipse cx="19.5" cy="15" rx="1.8" ry="1" fill="rgba(255,110,150,.6)"/><ellipse cx="28.5" cy="15" rx="1.8" ry="1" fill="rgba(255,110,150,.6)"/>';
  return `<svg viewBox="0 0 36 24" aria-hidden="true"><ellipse cx="18" cy="12" rx="13" ry="7.4" fill="var(--stone)" stroke="#16233b" stroke-width="2.6"/>` +
    `<ellipse cx="13" cy="8.2" rx="5.5" ry="2" fill="var(--stone-hi)"/>${eyes}</svg>`;
}
document.querySelectorAll<HTMLElement>('.stone-ico').forEach(e => { e.innerHTML = stoneSvg(e.dataset.face === 'squint' ? 'squint' : 'eyes'); });

const el = {
  hud: $('hud'), dist: $('dist'), streak: $('streak'), streakPill: $('streakPill'), hudBest: $('hudBest'), pauseBtn: $('pauseBtn'),
  hint: $('hint'), hintText: $('hintText'),
  title: $('title'), titleBest: $('titleBest'), playBtn: $('playBtn'),
  pause: $('pause'), resumeBtn: $('resumeBtn'), restartBtn: $('restartBtn'), menuBtn: $('menuBtn'),
  over: $('over'), overPanel: document.querySelector<HTMLElement>('.panel-over')!, overRibbon: $('overRibbon'),
  overStars: $('overStars'), overDist: $('overDist'), overTag: $('overTag'), overSkips: $('overSkips'),
  overStreak: $('overStreak'), overGlass: $('overGlass'), againBtn: $('againBtn'), overMenuBtn: $('overMenuBtn'), overHoops: $('overHoops'),
  banner: $('banner'), bannerSmall: $('bannerSmall'), bannerBig: $('bannerBig'), fever: $('fever'),
};
let bannerTimer = 0;

export interface UiHandlers {
  play(): void; pause(): void; resume(): void; restart(): void; menu(): void; again(): void;
  /** Any UI button press, so the scene can unlock audio and click. */
  press(): void;
}

export interface OverStats { metres: number; skips: number; bestStreak: number; glass: number; hoops: number; best: number; isBest: boolean; plunked: boolean }

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
        if (key === 'music' && b.classList.contains('k-icon-btn')) b.innerHTML = icon(v ? 'music' : 'music-off');
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
  /** Big celebratory banner across the sky (milestones, new lake zones, Fever). */
  banner(small: string, big: string, kind: 'milestone' | 'zone' | 'fever' = 'milestone') {
    el.bannerSmall.textContent = small;
    el.bannerBig.textContent = big;
    el.banner.className = `banner k-scale banner--${kind}`;
    el.banner.hidden = true;
    void el.banner.offsetWidth; // restart the animation if one is already showing
    el.banner.hidden = false;
    clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(() => { el.banner.hidden = true; }, 1300);
  },
  hideBanner() { clearTimeout(bannerTimer); el.banner.hidden = true; },
  fever(on: boolean) { el.fever.classList.toggle('on', on); },
  showOver(s: OverStats) {
    const record = s.isBest && s.metres > 0;
    el.overPanel.classList.toggle('record', record);
    el.overRibbon.textContent = record ? 'New Record!' : s.plunked && s.skips === 0 ? 'Plunk!' : 'Splash!';
    el.overDist.textContent = String(s.metres);
    el.overTag.textContent = s.plunked && s.skips === 0 ? 'TOO STEEP! THROW FLATTER' : record ? 'NEW BEST!' : `BEST ${s.best} m`;
    el.overSkips.textContent = String(s.skips);
    el.overStreak.textContent = s.bestStreak > 0 ? `×${s.bestStreak}` : '–';
    el.overGlass.textContent = String(s.glass);
    el.overHoops.textContent = String(s.hoops);
    // restart the star pop-in every time
    el.overStars.querySelectorAll('.k-star').forEach((st, i) => {
      st.classList.remove('on');
      void (st as HTMLElement).getBoundingClientRect();
      st.classList.toggle('on', s.metres >= STAR_METRES[i]);
    });
    ui.screen('over');
  },
};
