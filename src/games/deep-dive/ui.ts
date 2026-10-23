import { onSettings, setSetting, settings, type Settings } from '../../core/settings';
import { sfx } from '../../core/sfx';
import { buzz } from '../../core/haptics';
import { isTouch } from '../../core/view';
import { hydrateIcons, icon, STAR_SVG, wobbleLetters } from '../../core/icons';
import { SKINS } from './game/skins';

const $ = (id: string) => document.getElementById(id) as HTMLElement;

export interface Handlers {
  play(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  menu(): void;
  skin(id: string): void;
}

/** Depths that earn 1, 2 and 3 stars: reaching the Twilight Zone, Midnight Zone and the Abyss. */
export const STAR_DEPTHS = [150, 400, 750];

type Screen = 'title' | 'pause' | 'over' | null;
const LABELS: Record<keyof Settings, string> = { sound: 'Sound', music: 'Music', haptics: 'Vibration' };
const portrait = () => matchMedia('(orientation: portrait)').matches;

let shownDepth = -1;
let o2Low = false;
let lowShown = false;
let shownPerk: string | null = null;
let toastTimer = 0;
let hintTimer = 0;
let onSkin: (id: string) => void = () => {};

export const ui = {
  init(h: Handlers) {
    hydrateIcons();
    wobbleLetters($('logo'));
    onSkin = h.skin;
    const on = (id: string, fn: () => void) =>
      $(id).addEventListener('click', () => { sfx.unlock(); buzz(6); fn(); });
    on('playBtn', () => { enterFullscreen(); h.play(); });
    on('againBtn', h.play);
    on('pauseBtn', h.pause);
    on('resumeBtn', h.resume);
    on('restartBtn', h.restart);
    on('menuBtn', h.menu);
    on('overMenuBtn', h.menu);

    const toggles = document.querySelectorAll<HTMLButtonElement>('[data-setting]');
    toggles.forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.setting as keyof Settings;
      setSetting(k, !settings[k]);
      sfx.unlock();
      buzz(10);
    }));
    onSettings(s => toggles.forEach(b => {
      const k = b.dataset.setting as keyof Settings;
      b.setAttribute('aria-pressed', String(s[k]));
      b.setAttribute('aria-label', `${LABELS[k]} ${s[k] ? 'on' : 'off'}`);
      if (k === 'sound') b.innerHTML = icon(s.sound ? 'sound' : 'mute');
      if (k === 'music') b.innerHTML = icon(s.music ? 'music' : 'music-off');
    }));

    const fs = $('fsBtn');
    if (document.fullscreenEnabled && isTouch()) {
      fs.hidden = false;
      fs.addEventListener('click', () => {
        buzz(6);
        if (document.fullscreenElement) void document.exitFullscreen();
        else enterFullscreen();
      });
    }

    const syncOrientation = () => {
      // Portrait dives straight down the screen and steers with the left/right halves.
      $('howHold').textContent = portrait() ? 'Touch' : 'Hold';
      $('howHoldText').textContent = portrait() ? 'left / right to steer' : 'to swim up';
      $('hintText').textContent = portrait() ? 'Touch left or right to steer' : 'Hold anywhere to swim up';
    };
    syncOrientation();
    matchMedia('(orientation: portrait)').addEventListener('change', syncOrientation);
  },

  screen(name: Screen) {
    for (const id of ['title', 'pause', 'over'] as const) $(id).hidden = id !== name;
    if (name) { $('banner').classList.remove('show'); $('toast').classList.remove('show'); }
  },

  hud(visible: boolean) {
    $('hud').hidden = !visible;
    if (!visible) { this.lowO2(false); this.hint(false); }
  },

  showTitle(best: number, pearls: number, skin: string) {
    $('titleBest').textContent = best.toLocaleString();
    this.setSkins(pearls, skin);
    this.hud(false);
    this.screen('title');
  },

  /** Suit picker: unlocked suits are selectable, locked ones show how many pearls they need. */
  setSkins(pearls: number, current: string) {
    $('titlePearls').textContent = pearls.toLocaleString();
    const box = $('suits');
    box.innerHTML = SKINS.map(s => {
      const locked = s.cost > pearls;
      return `<button class="suit${s.id === current ? ' on' : ''}${locked ? ' locked' : ''}" role="radio" aria-checked="${s.id === current}"
        data-skin="${s.id}" ${locked ? 'disabled' : ''} aria-label="${s.name}${locked ? `, needs ${s.cost} pearls` : ''}"
        style="--suit:${s.body};--fins:${s.fins}">${locked ? `${icon('lock')}<small>${s.cost}</small>` : ''}</button>`;
    }).join('');
    box.querySelectorAll<HTMLButtonElement>('[data-skin]').forEach(b => b.addEventListener('click', () => {
      sfx.unlock(); buzz(8);
      sfx.tone(660, 0.1, { vol: 0.08, slideTo: 990 });
      onSkin(b.dataset.skin!);
    }));
  },

  showOver(o: { depth: number; reason: string; zone: string; best: number; isBest: boolean; pearls: number; total: number; unlocked?: string }) {
    const stars = STAR_DEPTHS.filter(d => o.depth >= d).length;
    $('stars').innerHTML = STAR_DEPTHS.map((_, i) => STAR_SVG.replace('class="k-star"', `class="k-star${i < stars ? ' on' : ''}"`)).join('');
    $('overDepth').textContent = o.depth.toLocaleString();
    $('overReason').textContent = o.reason;
    $('overRibbon').textContent = o.isBest ? 'New Record!' : 'Game Over';
    $('overBest').hidden = !o.isBest;
    $('overUnlock').hidden = !o.unlocked;
    $('overUnlock').textContent = o.unlocked ? `NEW SUIT: ${o.unlocked.toUpperCase()}!` : '';
    $('overZone').textContent = o.zone;
    $('overPearls').textContent = `+${o.pearls} (${o.total.toLocaleString()})`;
    $('overBestVal').textContent = `${o.best.toLocaleString()} m`;
    this.hud(false);
    this.screen('over');
  },

  setDepth(m: number) {
    if (m === shownDepth) return;
    shownDepth = m;
    $('depth').textContent = m.toLocaleString();
    if (m > 0 && m % 100 === 0) bump($('depthPill'));
  },

  setBest(m: number) { $('hudBest').textContent = m.toLocaleString(); },

  setPearls(n: number) {
    $('runPearls').textContent = String(n);
    if (n > 0) bump($('pearlPill'));
  },

  setHearts(n: number) {
    const hearts = $('hearts');
    hearts.setAttribute('aria-label', `${n} li${n === 1 ? 'fe' : 'ves'} left`);
    hearts.querySelectorAll('svg').forEach((el, i) => {
      const was = !el.classList.contains('lost');
      el.classList.toggle('lost', i >= n);
      if (was && i >= n) { el.classList.remove('shake'); void (el as unknown as HTMLElement).offsetWidth; el.classList.add('shake'); }
    });
  },

  /** Active power-up with its remaining time (0..1). */
  setPerk(kind: 'shield' | 'magnet' | null, frac: number) {
    const el = $('perk');
    if (kind !== shownPerk) {
      shownPerk = kind;
      el.hidden = !kind;
      el.dataset.kind = kind ?? '';
      $('perkIcon').textContent = kind === 'shield' ? 'Shield' : kind === 'magnet' ? 'Magnet' : '';
    }
    if (kind) $('perkFill').style.transform = `scaleX(${Math.max(0, Math.min(1, frac))})`;
  },

  setOxygen(frac: number, low: boolean) {
    $('o2').style.transform = `scaleX(${Math.max(0, Math.min(1, frac))})`;
    if (low !== o2Low) {
      o2Low = low;
      $('o2bar').classList.toggle('low', low);
      ($('o2bar').parentElement as HTMLElement).classList.toggle('low', low);
    }
  },

  lowO2(on: boolean) {
    if (on === lowShown) return;
    lowShown = on;
    $('lowO2').classList.toggle('on', on);
  },

  /** Short pop-up message near the diver's lane; `good` for power-ups, otherwise a red hit flash too. */
  damage(text: string, good = false) {
    const t = $('toast');
    t.textContent = text;
    t.classList.toggle('good', good);
    t.classList.remove('show');
    void t.offsetWidth;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => t.classList.remove('show'), 900);
    if (!good) {
      const f = $('lowO2');
      f.classList.remove('hit');
      void f.offsetWidth;
      f.classList.add('hit');
    }
  },

  banner(text: string) {
    const el = $('banner');
    $('bannerText').textContent = text;
    el.classList.remove('show');
    void el.offsetWidth; // restart the CSS animation
    el.classList.add('show');
  },

  hint(on: boolean) {
    $('hint').hidden = !on;
    clearTimeout(hintTimer);
    if (on) hintTimer = window.setTimeout(() => { $('hint').hidden = true; }, 6000); // don't linger over play
  },
};

function bump(el: HTMLElement) {
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

/** Full screen where the browser allows it (Android Chrome); silently ignored elsewhere. */
function enterFullscreen() {
  if (!isTouch() || !document.fullscreenEnabled || document.fullscreenElement) return;
  document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
}
