import { onSettings, setSetting, settings, type Settings } from '../../core/settings';
import { sfx } from '../../core/sfx';
import { buzz } from '../../core/haptics';
import { isTouch } from '../../core/view';
import { hydrateIcons, icon, STAR_SVG, wobbleLetters } from '../../core/icons';

const $ = (id: string) => document.getElementById(id) as HTMLElement;

export interface Handlers {
  play(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  menu(): void;
}

/** Depths that earn 1, 2 and 3 stars: reaching the Twilight Zone, Midnight Zone and the Abyss. */
export const STAR_DEPTHS = [150, 400, 750];

type Screen = 'title' | 'pause' | 'over' | null;
const portrait = () => matchMedia('(orientation: portrait)').matches;

let shownDepth = -1;
let o2Low = false;
let lowShown = false;

export const ui = {
  init(h: Handlers) {
    hydrateIcons();
    wobbleLetters($('logo'));
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
      b.setAttribute('aria-label', `${k === 'sound' ? 'Sound' : 'Vibration'} ${s[k] ? 'on' : 'off'}`);
      if (k === 'sound') b.innerHTML = icon(s.sound ? 'sound' : 'mute');
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
      // In portrait the dive is turned 90°, so "up" is to the right of the screen.
      $('howHoldText').textContent = portrait() ? 'to swim right' : 'to swim up';
      $('hintText').textContent = portrait() ? 'Hold anywhere to swim right' : 'Hold anywhere to swim up';
    };
    syncOrientation();
    matchMedia('(orientation: portrait)').addEventListener('change', syncOrientation);
  },

  screen(name: Screen) {
    for (const id of ['title', 'pause', 'over'] as const) $(id).hidden = id !== name;
    if (name) $('banner').classList.remove('show'); // don't let a fading banner show through a menu
  },

  hud(visible: boolean) {
    $('hud').hidden = !visible;
    if (!visible) { this.lowO2(false); this.hint(false); }
  },

  showTitle(best: number) {
    $('titleBest').textContent = best.toLocaleString();
    this.hud(false);
    this.screen('title');
  },

  showOver(o: { depth: number; reason: string; zone: string; best: number; isBest: boolean }) {
    const stars = STAR_DEPTHS.filter(d => o.depth >= d).length;
    $('stars').innerHTML = STAR_DEPTHS.map((_, i) => STAR_SVG.replace('class="k-star"', `class="k-star${i < stars ? ' on' : ''}"`)).join('');
    $('overDepth').textContent = o.depth.toLocaleString();
    $('overReason').textContent = o.reason;
    $('overRibbon').textContent = o.isBest ? 'New Record!' : 'Game Over';
    $('overBest').hidden = !o.isBest;
    $('overZone').textContent = o.zone;
    $('overBestVal').textContent = `${o.best.toLocaleString()} m`;
    const next = STAR_DEPTHS.find(d => o.depth < d);
    $('overNext').textContent = next ? `${next} m` : 'All stars!';
    this.hud(false);
    this.screen('over');
  },

  setDepth(m: number) {
    if (m === shownDepth) return;
    shownDepth = m;
    $('depth').textContent = m.toLocaleString();
    if (m > 0 && m % 100 === 0) {
      const pill = $('depthPill');
      pill.classList.remove('bump');
      void pill.offsetWidth;
      pill.classList.add('bump');
    }
  },

  setBest(m: number) { $('hudBest').textContent = m.toLocaleString(); },

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

  banner(text: string) {
    const el = $('banner');
    $('bannerText').textContent = text;
    el.classList.remove('show');
    void el.offsetWidth; // restart the CSS animation
    el.classList.add('show');
  },

  hint(on: boolean) { $('hint').hidden = !on; },
};

/** Full screen where the browser allows it (Android Chrome); silently ignored elsewhere. */
function enterFullscreen() {
  if (!isTouch() || !document.fullscreenEnabled || document.fullscreenElement) return;
  document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
}
