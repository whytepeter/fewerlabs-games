import { onSettings, setSetting, settings, type Settings } from './core/settings';
import { hydrateIcons, icon, wobbleLetters, STAR_SVG } from './core/icons';
import { mountCoins, renderMissions, renderEarned, coinIcon } from './core/metaui';
import type { Mission, MissionResult } from './core/meta';
import { STONE_ITEMS } from './game/progress';
import { portrait } from './game/skipper';

// The DOM layer: HUD, hint, title / pause / game-over screens, built from the shared cartoon kit.
// The Game scene drives it.

/** Distance in metres for 1, 2 and 3 stars. From the bot: never tapping scores ~74 m (p90 106),
 *  a ±40 ms timer has a median of ~430 m and a p90 of ~750 m. */
export const STAR_METRES = [150, 400, 750] as const;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

hydrateIcons();
wobbleLetters($('logo'));
$('overStars').innerHTML = STAR_SVG.repeat(3);

/** A character's portrait for the menus and HUD, drawn by the same code as the lake sprite. */
export function stoneSvg(id: string, face: 'eyes' | 'squint' = 'eyes') {
  return `<img class="sk-portrait" src="${portrait(id, face === 'squint')}" alt="">`;
}
const CLOVER_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><g><circle cx="12" cy="7" r="4.4" fill="#5ccf7d"/><circle cx="17" cy="12" r="4.4" fill="#5ccf7d"/><circle cx="12" cy="17" r="4.4" fill="#5ccf7d"/><circle cx="7" cy="12" r="4.4" fill="#5ccf7d"/></g><circle cx="12" cy="12" r="2.4" fill="#c4f5d1"/></svg>';

mountCoins();

const el = {
  hud: $('hud'), dist: $('dist'), streak: $('streak'), streakPill: $('streakPill'), hudBest: $('hudBest'), pauseBtn: $('pauseBtn'),
  hint: $('hint'), hintText: $('hintText'),
  title: $('title'), titleBest: $('titleBest'), playBtn: $('playBtn'),
  pause: $('pause'), resumeBtn: $('resumeBtn'), restartBtn: $('restartBtn'), menuBtn: $('menuBtn'),
  over: $('over'), overPanel: document.querySelector<HTMLElement>('.panel-over')!, overRibbon: $('overRibbon'),
  overStars: $('overStars'), overDist: $('overDist'), overTag: $('overTag'), overSkips: $('overSkips'),
  overStreak: $('overStreak'), overGlass: $('overGlass'), againBtn: $('againBtn'), overMenuBtn: $('overMenuBtn'), overHoops: $('overHoops'),
  banner: $('banner'), bannerSmall: $('bannerSmall'), bannerBig: $('bannerBig'), fever: $('fever'),
  luckyPip: $('luckyPip'), abilityBtn: $('abilityBtn'), abilityFill: $('abilityFill'), abilityFace: $('abilityFace'), abilityName: $('abilityName'),
  howto: $('howto'), titleMissionsBox: $('titleMissionsBox'), titleMissions: $('titleMissions'),
  picker: $('stonePicker'), caption: $('stoneCaption'),
  overClose: $('overClose'), overEarned: $('overEarned'), overMissions: $('overMissions'),
};
el.luckyPip.innerHTML = CLOVER_SVG;
let bannerTimer = 0;

export interface UiHandlers {
  play(): void; pause(): void; resume(): void; restart(): void; menu(): void; again(): void;
  /** Tap on a stone in the picker: equips an owned stone, otherwise previews it for buying. */
  stone(id: string): void;
  buy(id: string): void;
  /** The ability button (or E / Shift): fire the character's ability. */
  ability(): void;
  /** Any UI button press, so the scene can unlock audio and click. */
  press(): void;
}

export interface OverStats {
  metres: number; skips: number; bestStreak: number; glass: number; hoops: number; best: number; isBest: boolean; plunked: boolean;
  close: string; earned: { label: string; n: number }[]; missions: MissionResult[];
}
export interface PickerState { equipped: string; selected: string; owned: (id: string) => boolean; balance: number }

let shownDist = -1, shownStreak = -1, abilityShown = '';

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
    // the ability fires on press, not click, so it never misses a fast throw
    el.abilityBtn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); h.ability(); });
    el.picker.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-stone]');
      if (b) { e.preventDefault(); h.press(); h.stone(b.dataset.stone!); }
    });
    el.caption.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-buy]');
      if (b) { e.preventDefault(); h.press(); h.buy(b.dataset.buy!); }
    });
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
  /** Title extras: missions (or the how-to before the first throw). */
  setTitleMeta(list: Mission[], firstRun: boolean) {
    el.howto.hidden = !firstRun;
    el.titleMissionsBox.hidden = firstRun;
    if (!firstRun) renderMissions(el.titleMissions, list);
  },
  /** Stone row on the title, each drawn with its face; locked ones show a price. */
  renderPicker(p: PickerState) {
    el.picker.innerHTML = STONE_ITEMS.map(it => {
      const own = p.owned(it.id);
      return `<button class="stone-pick${it.id === p.equipped ? ' equipped' : ''}${it.id === p.selected ? ' selected' : ''}${own ? '' : ' locked'}"
        data-stone="${it.id}" role="radio" aria-checked="${it.id === p.equipped}" aria-label="${it.name}${own ? '' : `, ${it.price} coins`}">
        ${stoneSvg(it.id, it.id === p.equipped ? 'squint' : 'eyes')}<span>${own ? it.name : `${coinIcon()}${it.price}`}</span></button>`;
    }).join('');
    const sel = STONE_ITEMS.find(i => i.id === p.selected)!;
    const own = p.owned(sel.id);
    el.caption.innerHTML = own
      ? `<b>${sel.name}</b> · ${sel.blurb}`
      : `<b>${sel.name}</b> · ${sel.blurb} <button class="k-btn k-btn--sm k-btn--yellow buy-btn" data-buy="${sel.id}"${p.balance < sel.price ? ' disabled' : ''}>${coinIcon()}${sel.price}</button>`;
  },
  shakePicker(id: string) {
    const b = el.picker.querySelector<HTMLElement>(`[data-stone="${id}"]`);
    if (!b) return;
    b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
  },
  /** HUD pills show the equipped stone. */
  /**
   * The ability capsule: hidden (null) outside a throw; otherwise it fills with sunset light as
   * Perfects land, and glows once the move is ready.
   */
  setAbility(a: { id: string; name: string; charge: number; ready: boolean } | null) {
    el.abilityBtn.hidden = !a;
    if (!a) { abilityShown = ''; return; }
    if (abilityShown !== a.id) {
      abilityShown = a.id;
      el.abilityFace.innerHTML = stoneSvg(a.id, 'eyes');
      el.abilityName.textContent = a.name;
      el.abilityBtn.setAttribute('aria-label', `${a.name} (E)`);
    }
    el.abilityFill.style.transform = `scaleX(${a.charge})`;
    if (el.abilityBtn.classList.contains('ready') !== a.ready) el.abilityBtn.classList.toggle('ready', a.ready);
  },
  /** The meter just filled: a little pop. */
  abilityCharged() { bump(el.abilityBtn); },
  setHudStone(id: string) {
    document.querySelectorAll<HTMLElement>('.stone-ico').forEach(e => { e.innerHTML = stoneSvg(id, e.dataset.face === 'squint' ? 'squint' : 'eyes'); });
  },
  /** Lucky stone pip: 'ready' (green clover), 'used' (pops and greys out) or hidden. */
  lucky(state: 'hidden' | 'ready' | 'used') {
    el.luckyPip.hidden = state === 'hidden';
    el.luckyPip.classList.toggle('used', state === 'used');
    if (state === 'used') bump(el.luckyPip);
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
    el.overClose.textContent = s.close;
    el.overClose.hidden = !s.close;
    renderEarned(el.overEarned, s.earned);
    renderMissions(el.overMissions, s.missions.map(r => r.mission), s.missions);
    // restart the star pop-in every time
    el.overStars.querySelectorAll('.k-star').forEach((st, i) => {
      st.classList.remove('on');
      void (st as HTMLElement).getBoundingClientRect();
      st.classList.toggle('on', s.metres >= STAR_METRES[i]);
    });
    ui.screen('over');
  },
};
