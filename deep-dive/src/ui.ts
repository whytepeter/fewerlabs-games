import { onSettings, setSetting, settings, store, type Settings } from './core/settings';
import { coins, onMeta, SKIP_COST, type MissionResult, type RankUp } from './core/meta';
import { coinIcon, mountCoins, renderEarned, renderMissions } from './core/metaui';
import { deepMissions } from './game/missions';
import { sfx } from './core/sfx';
import { buzz } from './core/haptics';
import { isTouch } from './core/view';
import { hydrateIcons, icon, STAR_SVG, wobbleLetters } from './core/icons';
import { portraits, rankLocked, SKINS, skinIndex, suits, type Skin } from './game/skins';
import { MAX_LEVEL, UPGRADES, upgrades } from './game/upgrades';
import { GADGETS, gadgets, THIRD_SLOT_RANK, type GadgetId } from './game/gadgets';
import { cloud, type LinkResult } from './core/cloud';
import { holdUpdates, install, installMode, onInstallChange } from './core/pwa';
import { shells } from './game/shells';
import type { ChestPrize } from './game/chests';
import { CAVES, caveBest, currentCave, isUnlocked, markCavesSeen, newCaves, type CaveDef, type CaveId } from './game/caves';

const $ = (id: string) => document.getElementById(id) as HTMLElement;

export interface Handlers {
  play(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  menu(): void;
  /** Equip (buying if needed); false when the player can't afford it. */
  skin(id: string): boolean;
  /** A text field has focus: game keys must not steal typing. */
  typing(on: boolean): void;
  /** Pick the cave to dive in; false while it's locked. */
  cave(id: CaveId): boolean;
}

/** Depths that earn 1, 2 and 3 stars: reaching the Twilight Zone, Midnight Zone and the Abyss. */
export const STAR_DEPTHS = [150, 400, 750];

const SCREENS = ['title', 'pause', 'saveme', 'over', 'board', 'divers', 'missions', 'shop', 'settings', 'caves'] as const;
type Screen = (typeof SCREENS)[number] | null;
/** Menus reached from the title; Back (or Escape) returns to it. */
const SUB = new Set<Screen>(['board', 'divers', 'missions', 'shop', 'settings', 'caves']);
const LABELS: Record<keyof Settings, string> = { sound: 'Sound', music: 'Music', haptics: 'Vibration' };
const portrait = () => matchMedia('(orientation: portrait)').matches;

let shownDepth = -1;
let o2Low = false;
let lowShown = false;
let shownPerk: string | null = null;
let toastTimer = 0;
let hintTimer = 0, tipTimer = 0;
let guidePressed = 0;
const SAVE_ME_SECONDS = 5;
let diveEnded = false; // the next title screen comes straight after a dive
const INSTALL_AFTER_DIVES = 3, INSTALL_GAP = 3 * 24 * 60 * 60 * 1000;
let onSkin: (id: string) => boolean = () => false;
let onCave: (id: CaveId) => boolean = () => false;
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const INK = '#16233b';
/**
 * A cave's postcard: a little painted scene in its colours (water, rock walls, and what lives
 * there), used on its card and on the title chip.
 */
let artIds = 0;
function caveArt(c: CaveDef) {
  const [z0, z1] = c.biomes, id = `ca-${c.id}-${++artIds}`; // unique: a gradient inside a hidden screen won't paint for the others
  const rock = hex(z0.rock), rim = hex(z1.top);
  const ceil = 'M0 0H120V11Q104 19 86 12T50 13T18 11T0 13Z';
  const floor = 'M0 80V63Q16 55 36 61T74 60T104 57T120 59V80Z';
  const stroke = (d: string, w: number, col: string) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 3}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
  let scene = '';
  if (c.id === 'reef') {
    const coral = (x: number, y: number, col: string) => [0, 1, 2].map(i => `<circle cx="${x + (i - 1) * 6}" cy="${y - (i % 2) * 6}" r="${4.5 - (i % 2)}" fill="${col}" stroke="${INK}" stroke-width="2"/>`).join('');
    scene = coral(22, 60, '#ff7aa8') + coral(64, 59, '#ffd23f') + coral(98, 56, '#b07cff')
      + stroke('M44 61Q41 50 45 40', 3.5, '#3ad06b') + stroke('M84 60Q88 50 84 42', 3.5, '#3ad06b')
      + `<g transform="translate(70 33)"><path d="M-12 0L-19 -6V6Z" fill="#ff9f43" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><ellipse rx="11" ry="7" fill="#ff9f43" stroke="${INK}" stroke-width="2"/><circle cx="5" cy="-1.5" r="1.8" fill="${INK}"/></g>`
      + `<g transform="translate(34 26) scale(.7)"><path d="M-12 0L-19 -6V6Z" fill="#ffd23f" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><ellipse rx="11" ry="7" fill="#ffd23f" stroke="${INK}" stroke-width="2.6"/><circle cx="5" cy="-1.5" r="2" fill="${INK}"/></g>`;
  } else if (c.id === 'kelp') {
    const strand = (x: number, h: number, bend: number) => {
      const d = `M${x} 64Q${x + bend} ${64 - h / 2} ${x} ${64 - h}`;
      const leaves = [0.35, 0.6, 0.85].map((f, i) => `<ellipse cx="${x + bend * 0.5 + (i % 2 ? 5 : -5)}" cy="${64 - h * f}" rx="5" ry="2.6" fill="#7fe08f" stroke="${INK}" stroke-width="1.6"/>`).join('');
      return stroke(d, 4.5, '#48d16f') + leaves;
    };
    scene = strand(14, 46, 10) + strand(30, 34, -8) + strand(88, 50, -10) + strand(106, 38, 8)
      + `<g transform="translate(60 34)"><path d="M-10 0L-16 -5V5Z" fill="#ffd23f" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><ellipse rx="9" ry="6" fill="#ffd23f" stroke="${INK}" stroke-width="2"/><circle cx="4" cy="-1.5" r="1.6" fill="${INK}"/></g>`;
  } else {
    const ice = (x: number, y: number, w: number, h: number) => `<path d="M${x - w / 2} ${y}L${x} ${y + h}L${x + w / 2} ${y}Z" fill="#cff3ff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M${x - w * 0.15} ${y + 3}L${x - 1} ${y + h * 0.65}" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`;
    const spike = (x: number, y: number) => `<path d="M${x - 6} ${y}L${x} ${y - 11}L${x + 6} ${y}Z" fill="#a8e6ff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
    const flakes = [[20, 34], [46, 24], [76, 40], [100, 28], [58, 50], [32, 48], [90, 50]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 1.4 : 2}" fill="#fff" opacity=".9"/>`).join('');
    scene = ice(26, 11, 10, 18) + ice(40, 12, 7, 11) + ice(70, 11, 11, 20) + ice(98, 11, 8, 14) + ice(56, 30, 8, 13)
      + spike(80, 61) + spike(92, 59) + spike(16, 62) + flakes;
  }
  return `<svg viewBox="0 0 120 80" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hex(z0.top)}"/><stop offset=".55" stop-color="${hex(z1.top)}"/><stop offset="1" stop-color="${hex(z1.bot)}"/></linearGradient></defs>
    <rect width="120" height="80" fill="url(#${id})"/>
    <path d="M18 0H34L16 80H-6ZM62 0H74L56 80H40ZM100 0H110L92 80H80Z" fill="#fff" opacity=".1"/>
    <path d="M0 80V52Q22 42 46 50T92 46T120 48V80Z" fill="${rim}" opacity=".45"/>
    ${scene}
    <path d="${ceil}" fill="${rock}" stroke="${INK}" stroke-width="2.5"/>
    <path d="${floor}" fill="${rock}" stroke="${INK}" stroke-width="2.5"/>
  </svg>`;
}
let viewed = 0;      // index of the diver shown on the Divers screen
let wearing = 'classic';
let shopTab: 'upgrades' | 'gadgets' = 'upgrades';
/** Divers and upgrades the player had already seen as affordable/unlocked (for the "New" dots). */
const seen = new Set<string>(store.get<string[]>('seen', []));

/** Click handler with the usual tap sound and buzz. */
const onTap = (id: string, fn: () => void) =>
  $(id).addEventListener('click', () => { sfx.unlock(); buzz(6); fn(); });
const coinTag = (n: number) => `${coinIcon()}${n.toLocaleString()}`;
const shellTag = (n: number) => `<img class="shell-ico" src="${portraits.shell ?? ''}" alt="">${n.toLocaleString()}`;
/** Shut treasure chests on the game-over screen; tapping one shakes it open to show its prize. */
function renderChests(el: HTMLElement, prizes: ChestPrize[]) {
  el.hidden = !prizes.length;
  el.innerHTML = `<p class="over-chests-hint">${prizes.length > 1 ? 'Tap your chests to open them' : 'Tap your chest to open it'}</p>`;
  prizes.forEach((prize, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'over-chest';
    b.style.animationDelay = `${i * 0.15}s`;
    b.setAttribute('aria-label', 'Open treasure chest');
    b.innerHTML = `<img src="${portraits.chest ?? ''}" alt="">`;
    b.addEventListener('click', () => {
      if (b.classList.contains('opening') || b.classList.contains('open')) return;
      sfx.unlock(); buzz(10);
      b.classList.add('opening');
      sfx.tone(330, 0.08, { type: 'triangle', vol: 0.05 }); sfx.tone(392, 0.08, { type: 'triangle', vol: 0.05, delay: 0.12 });
      window.setTimeout(() => {
        b.classList.replace('opening', 'open');
        b.removeAttribute('aria-label');
        b.innerHTML = prize.kind === 'shell'
          ? `<span class="over-chest-prize"><img class="shell-ico" src="${portraits.shell ?? ''}" alt="">Golden Shell!</span>`
          : `<span class="over-chest-prize">${coinIcon()}+${prize.n}</span>`;
        sfx.tone(659, 0.15, { vol: 0.08 }); sfx.tone(880, 0.15, { vol: 0.08, delay: 0.08 }); sfx.tone(1318, 0.4, { vol: 0.08, delay: 0.16 });
        buzz([15, 25, 15]);
      }, 380);
    });
    el.append(b);
  });
}
const drawShells = () => { const el = document.getElementById('shellCount'); if (el) el.innerHTML = shellTag(shells.count); };
function nope(el: HTMLElement) {
  buzz(30);
  sfx.tone(200, 0.15, { type: 'triangle', vol: 0.06 });
  el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope');
}
function cheer(big: boolean) {
  buzz(big ? [10, 40, 20] : 8);
  sfx.tone(660, 0.1, { vol: 0.08, slideTo: 990 });
  if (big) sfx.tone(880, 0.25, { vol: 0.07, delay: 0.1 });
}

export const ui = {
  init(h: Handlers) {
    shells.onChange(drawShells);
    hydrateIcons();
    wobbleLetters($('logo'));
    mountCoins();
    onSkin = h.skin;
    onCave = h.cave;
    const on = (id: string, fn: () => void) =>
      $(id).addEventListener('click', () => { sfx.unlock(); buzz(6); fn(); });
    on('playBtn', () => { enterFullscreen(); h.play(); });
    on('againBtn', h.play);
    on('pauseBtn', h.pause);
    on('resumeBtn', h.resume);
    on('restartBtn', h.restart);
    on('menuBtn', h.menu);
    on('overMenuBtn', h.menu);
    on('boardBtn', () => void openBoard());
    on('boardBack', () => this.back());
    on('showcase', () => this.openDivers());
    on('diversBtn', () => this.openDivers());
    on('caveChip', () => this.openCaves());
    $('caveList').addEventListener('click', e => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('[data-cave]');
      if (card) this.pickCave(card.dataset.cave as CaveId, card);
    });
    on('missionsBtn', () => this.openMissions());
    on('rankBadge', () => this.openMissions());
    on('shopBtn', () => this.openShop());
    on('titleQuests', () => this.openMissions());
    document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b => b.addEventListener('click', () => {
      buzz(6);
      shopTab = b.dataset.tab as typeof shopTab;
      this.renderShop();
    }));
    this.rotateHint();
    on('settingsBtn', () => { this.screen('settings'); renderAccount(); });
    on('saveNudge', () => { this.screen('settings'); renderAccount(); });
    this.initAccount();
    on('diverPrev', () => this.showDiver(viewed - 1));
    on('diverNext', () => this.showDiver(viewed + 1));
    on('diverAction', () => this.diverAction());
    document.querySelectorAll<HTMLElement>('[data-back]').forEach(b => b.addEventListener('click', () => { buzz(6); this.back(); }));
    addEventListener('keydown', e => {
      if (e.key !== 'Escape' || this.typing()) return;
      if (SCREENS.some(id => SUB.has(id) && this.isOpen(id))) this.back();
    });
    onMeta(() => { if (this.isOpen('title')) this.refreshTitle(); });
    const input = $('nameInput') as HTMLInputElement;
    // Any text field (name, email, password): game keys must not steal typing.
    document.addEventListener('focusin', e => { if (e.target instanceof HTMLInputElement) h.typing(true); });
    document.addEventListener('focusout', e => { if (e.target instanceof HTMLInputElement) h.typing(false); });
    $('nameForm').addEventListener('submit', e => {
      e.preventDefault();
      input.blur();
      void cloud.rename(input.value).then(n => {
        input.value = n ?? cloud.name;
        if (n) { buzz(8); this.damage('Name saved', true); void openBoard(); }
      });
    });

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

    const syncInstall = () => {
      const mode = installMode();
      $('install').hidden = !mode;
      $('installBtn').hidden = mode !== 'prompt';
      $('installHint').hidden = mode !== 'ios';
    };
    syncInstall();
    onInstallChange(syncInstall);
    on('installBtn', () => { void install(); });
    const closeOffer = () => { $('installOffer').hidden = true; };
    on('installOfferBtn', () => { closeOffer(); void install(); });
    on('installOfferLater', closeOffer);
    onInstallChange(() => { if (!installMode()) closeOffer(); });

    const syncOrientation = () => {
      // Touch the side you want to move toward: left/right in portrait (the dive runs down the screen), top/bottom in landscape.
      $('howHold').textContent = 'Touch';
      $('howHoldText').textContent = portrait() ? 'left / right to steer' : 'top / bottom to steer';
      // First-dive guide: in portrait the "up" half is on the right (the world is turned 90°).
      $('guideUp').textContent = portrait() ? 'Tap here to steer right' : 'Tap here to swim up';
      $('guideDown').textContent = portrait() ? 'Tap here to steer left' : 'Tap here to go down';
    };
    syncOrientation();
    matchMedia('(orientation: portrait)').addEventListener('change', syncOrientation);
  },

  isOpen(name: Exclude<Screen, null>) { return !$(name).hidden; },

  /** A text field has focus. */
  typing() { return document.activeElement instanceof HTMLInputElement; },

  screen(name: Screen) {
    for (const id of SCREENS) $(id).hidden = id !== name;
    // The update banner only shows on the title hub: never mid-dive, and never over a menu card.
    holdUpdates(name !== 'title');
    if (name) { $('banner').classList.remove('show'); $('toast').classList.remove('show'); }
  },

  hud(visible: boolean) {
    $('hud').hidden = !visible;
    if (!visible) { this.lowO2(false); this.hint(null); this.guide(false); clearTimeout(tipTimer); }
  },

  /** The title hub; the best shown is the selected cave's. */
  showTitle(skin: string) {
    wearing = skin;
    drawShells();
    // First-timers see how to play above the Dive button.
    $('howto').hidden = store.get('learned', false);
    $('boardBtn').hidden = !cloud.enabled;
    this.refreshTitle();
    this.hud(false);
    this.screen('title');
    if (diveEnded) { diveEnded = false; window.setTimeout(() => this.offerInstall(), 700); }
  },

  back() {
    this.refreshTitle();
    this.screen('title');
  },

  /** Title hub: rank, diver showcase, best depth and the badges on the menu tiles. */
  refreshTitle() {
    const s = SKINS[skinIndex(wearing)];
    ($('showcaseImg') as HTMLImageElement).src = portraits[`diver-${s.id}`] ?? '';
    $('showcaseName').textContent = s.name;
    const cv = currentCave();
    $('titleBest').textContent = caveBest(cv.id).toLocaleString();
    $('caveName').textContent = cv.name;
    $('caveSwatch').innerHTML = caveArt(cv);
    $('caveDot').hidden = !newCaves().length;
    const rank = deepMissions.rank, set = deepMissions.active, done = set.filter(m => m.done).length;
    $('rankNum').textContent = String(rank);
    $('rankPips').innerHTML = set.map(m => `<i class="${m.done ? 'on' : ''}"></i>`).join('');
    $('missionsCount').textContent = `${done}/${set.length}`;
    $('diversDot').hidden = !SKINS.some(d => isNewDiver(d, rank));
    $('shopDot').hidden = !UPGRADES.some(u => isNewUpgrade(u.id)) && !GADGETS.some(g => isNewGadget(g.id));

    // The current mission set, right on the hub (as Jetpack Joyride and Subway Surfers do).
    $('titleQuests').hidden = !store.get('learned', false);
    $('tqSet').textContent = `${done} of ${set.length} done`;
    $('tqReward').innerHTML = `Finish all three to reach <b>rank ${rank + 1}</b> ${coinTag(deepMissions.rankReward)}`;
    $('tqList').innerHTML = set.map(m => {
      const frac = m.done ? 1 : Math.min(1, m.progress / m.target);
      return `<span class="tq-row${m.done ? ' done' : ''}"><i class="tq-check">${m.done ? icon('star') : ''}</i>
        <span class="tq-body"><span class="tq-text">${m.text}</span>
          <span class="tq-bar"><b style="transform:scaleX(${frac})"></b></span>
          <em>${Math.min(m.progress, m.target).toLocaleString()} / ${m.target.toLocaleString()}</em></span>
        <span class="tq-coin">${m.done ? 'Done' : coinTag(m.reward)}</span></span>`;
    }).join('');
  },

  /** Settings > Your progress: link the guest to Google, switch accounts, sign out. */
  initAccount() {
    const run = async (fn: () => Promise<LinkResult>, btn: HTMLElement) => {
      setBusy(true, btn);
      const r = await fn();
      setBusy(false);
      if (r === 'linked') { cheer(true); renderAccount('Saved! Your progress now follows your account.'); }
      else if (r === 'exists') showConflict(true);
      else if (r !== 'redirect') accountError(r.error);
    };
    onTap('googleBtn', () => void run(() => cloud.linkGoogle(), $('googleBtn')));
    onTap('useAccountBtn', () => void (async () => {
      setBusy(true, $('useAccountBtn'));
      const r = await cloud.useExisting();
      setBusy(false);
      if (r === true) { showConflict(false); cheer(true); renderAccount('Welcome back! Your saved progress is loaded.'); }
      else accountError(r.error);
    })());
    onTap('keepGuestBtn', () => { cloud.cancelPending(); showConflict(false); renderAccount(); });
    let confirmOut = 0;
    onTap('signOutBtn', () => {
      const b = $('signOutBtn');
      if (Date.now() - confirmOut > 4000) {
        confirmOut = Date.now();
        b.textContent = 'Tap again to sign out (this device starts over)';
        return;
      }
      void cloud.signOut();
    });
    cloud.onAccount(() => { if (this.isOpen('settings')) renderAccount(); });
    // Back from a Google redirect whose account already had progress: ask what to keep.
    void cloud.start().then(() => {
      if (!cloud.hasPending) return;
      this.screen('settings');
      renderAccount();
      showConflict(true);
    });
  },

  /**
   * After a few dives, back on the title screen: offer to install the game (or explain Add to Home
   * Screen on iPhone). Asked at most three times, a few days apart; never once it's installed.
   */
  offerInstall() {
    const mode = installMode(), asked = store.get('installAsked', { n: 0, at: 0 });
    if (!mode || store.get('divesDone', 0) < INSTALL_AFTER_DIVES || asked.n >= 3 || Date.now() - asked.at < INSTALL_GAP) return;
    if (!$('rotateHint').hidden || !this.isOpen('title')) return;
    store.set('installAsked', { n: asked.n + 1, at: Date.now() });
    $('installOfferPrompt').hidden = mode !== 'prompt';
    $('installOfferIOS').hidden = mode !== 'ios';
    $('installOffer').hidden = false;
  },

  /** Once ever, on a phone held upright: suggest turning it sideways. */
  rotateHint() {
    const el = $('rotateHint');
    const close = () => { el.hidden = true; };
    $('rotateOk').addEventListener('click', () => { buzz(6); close(); });
    matchMedia('(orientation: portrait)').addEventListener('change', e => { if (!e.matches) close(); });
    if (!isTouch() || !portrait() || store.get('rotateHint', false)) return;
    store.set('rotateHint', true);
    el.hidden = false;
  },

  // ---------- Caves

  openCaves() {
    this.screen('caves');
    this.renderCaves();
    markCavesSeen();
  },

  renderCaves() {
    const current = currentCave().id, fresh = new Set(newCaves().map(c => c.id));
    $('caveList').innerHTML = CAVES.map(c => {
      const open = isUnlocked(c), best = caveBest(c.id);
      let status: string;
      if (open) status = `<small>${best ? `Best <b>${best.toLocaleString()} m</b>` : 'Not dived yet'}</small>`;
      else {
        const from = CAVES.find(x => x.id === c.unlock!.cave)!, have = caveBest(from.id), need = c.unlock!.depth;
        status = `<small class="cave-goal">${icon('lock')}<span>Reach <b>${need} m</b> in the ${from.name}</span></small>
          <span class="cave-progress"><span class="cave-bar"><b style="transform:scaleX(${Math.min(1, have / need)})"></b></span><em>${Math.min(have, need)} / ${need} m</em></span>`;
      }
      return `<li><button class="cave-card${c.id === current ? ' on' : ''}${open ? '' : ' locked'}" type="button" data-cave="${c.id}">
        <span class="cave-art">${caveArt(c)}</span>
        <span class="cave-body"><b>${c.name}</b><span>${c.blurb}</span>${status}</span>
        ${c.id === current ? '<em class="cave-tag">Diving here</em>' : fresh.has(c.id) ? '<em class="cave-tag cave-tag--new">New</em>' : ''}
      </button></li>`;
    }).join('');
  },

  pickCave(id: CaveId, card: HTMLElement) {
    if (!onCave(id)) { nope(card); return; }
    cheer(false);
    this.renderCaves();
    this.refreshTitle();
  },

  // ---------- Divers (character select)

  openDivers() {
    this.screen('divers');
    this.showDiver(skinIndex(wearing));
  },

  showDiver(i: number) {
    viewed = (i + SKINS.length) % SKINS.length;
    const s = SKINS[viewed], rank = deepMissions.rank;
    markSeen(`diver:${s.id}`, isNewDiver(s, rank));
    const img = $('diverImg') as HTMLImageElement;
    img.src = portraits[`diver-${s.id}`] ?? '';
    // Divers you can buy show in full colour (so you want them); rank rewards stay a mystery.
    img.classList.toggle('locked', rankLocked(s, rank));
    img.classList.toggle('for-sale', !suits.owns(s.id));
    img.classList.remove('pop'); void img.offsetWidth; img.classList.add('pop');
    $('diverName').textContent = s.name;
    $('diverBio').textContent = s.bio;
    const btn = $('diverAction'), need = $('diverNeed');
    btn.className = 'k-btn k-btn--block';
    need.hidden = true;
    if (rankLocked(s, rank)) {
      btn.innerHTML = `${icon('lock')}Unlocks at rank ${s.rank}`; btn.classList.add('k-btn--white');
      need.hidden = false; need.textContent = 'Finish mission sets to rank up.';
    } else if (s.id === wearing) { btn.innerHTML = 'Wearing'; btn.classList.add('k-btn--white'); }
    else if (suits.owns(s.id)) btn.textContent = 'Wear';
    else {
      const short = s.price - coins.balance;
      btn.innerHTML = `<span>Buy</span><span class="price-chip">${coinTag(s.price)}</span>`;
      btn.classList.add('k-btn--yellow', 'k-btn--lg');
      if (short > 0) {
        btn.classList.add('short');
        need.hidden = false;
        need.innerHTML = `You need ${coinTag(short)} more. Dive and finish missions to earn coins.`;
      }
    }
    this.diverGrid();
  },

  diverGrid() {
    const rank = deepMissions.rank;
    $('diverGrid').innerHTML = SKINS.map((s, i) => {
      const locked = rankLocked(s, rank), owned = suits.owns(s.id) && !locked;
      const tag = owned ? '' : locked ? `<small>${icon('lock')}${s.rank}</small>` : `<small>${coinTag(s.price)}</small>`;
      return `<button type="button" class="diver-thumb${i === viewed ? ' on' : ''}${locked ? ' locked' : owned ? '' : ' for-sale'}${s.id === wearing ? ' worn' : ''}${isNewDiver(s, rank) ? ' new' : ''}"
        role="radio" aria-checked="${i === viewed}" aria-label="${s.name}" data-i="${i}"><img src="${portraits[`diver-${s.id}`] ?? ''}" alt="">${tag}</button>`;
    }).join('');
    $('diverGrid').querySelectorAll<HTMLButtonElement>('[data-i]').forEach(b =>
      b.addEventListener('click', () => { buzz(6); this.showDiver(Number(b.dataset.i)); }));
  },

  diverAction() {
    const s = SKINS[viewed];
    if (s.id === wearing) return;
    const wasOwned = suits.owns(s.id) && !rankLocked(s, deepMissions.rank);
    if (!onSkin(s.id)) { nope($('diverAction')); return; }
    wearing = s.id;
    cheer(!wasOwned);
    this.showDiver(viewed);
  },

  // ---------- Missions

  openMissions() {
    this.screen('missions');
    this.renderMissionsScreen();
  },

  renderMissionsScreen() {
    const rank = deepMissions.rank, set = deepMissions.active;
    $('rankBig').textContent = String(rank);
    $('rankTitle').textContent = `Rank ${rank}`;
    $('rankBonus').textContent = `Coin bonus ×${deepMissions.bonus.toFixed(1)} on every dive`;
    const next = SKINS.find(d => d.rank === rank + 1);
    $('rankNext').innerHTML = `Finish all three to reach rank ${rank + 1} and earn ${coinTag(deepMissions.rankReward)}${next ? `, plus <b>${next.name}</b>` : ''}.`;
    const list = $('missionList');
    renderMissions(list, set);
    list.querySelectorAll('li').forEach((li, i) => {
      const m = set[i];
      if (!m || m.done) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'k-btn k-btn--white k-btn--sm mission-skip';
      b.innerHTML = `Skip ${coinTag(SKIP_COST)}`;
      b.setAttribute('aria-label', `Skip this mission for ${SKIP_COST} coins`);
      b.addEventListener('click', () => {
        if (deepMissions.skip(m.id)) { cheer(false); this.renderMissionsScreen(); } else nope(b);
      });
      // Same line as the "2 / 10" progress, on the right.
      const prog = li.querySelector('.k-mission-body > small');
      if (!prog) return;
      const foot = document.createElement('span');
      foot.className = 'mission-foot';
      prog.replaceWith(foot);
      foot.append(prog, b);
    });
  },

  // ---------- Shop (upgrades)

  openShop(tab: typeof shopTab = 'upgrades') {
    shopTab = tab;
    this.screen('shop');
    this.renderShop();
  },

  renderShop() {
    document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === shopTab)));
    $('gadgetInfo').hidden = shopTab !== 'gadgets';
    if (shopTab === 'gadgets') { this.renderGadgets(); return; }
    const list = $('shopList');
    list.innerHTML = UPGRADES.map(u => {
      const l = upgrades.level(u.id), cost = upgrades.cost(u.id);
      markSeen(`up:${u.id}:${l}`, isNewUpgrade(u.id));
      const pips = Array.from({ length: MAX_LEVEL }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('');
      const buy = cost === null
        ? '<span class="shop-max">Max</span>'
        : `<button type="button" class="k-btn k-btn--yellow k-btn--sm${coins.balance < cost ? ' short' : ''}" data-up="${u.id}" aria-label="Upgrade ${u.name} for ${cost} coins">${coinTag(cost)}</button>`;
      return `<li class="shop-item"><img src="${portraits[u.icon] ?? ''}" alt="">
        <div class="shop-body"><b>${u.name}</b><span>${u.effect(l)}</span>${cost === null ? '' : `<small>Next: ${u.effect(l + 1)}</small>`}
        <span class="shop-pips" aria-label="Level ${l} of ${MAX_LEVEL}">${pips}</span></div>${buy}</li>`;
    }).join('');
    list.querySelectorAll<HTMLButtonElement>('[data-up]').forEach(b => b.addEventListener('click', () => {
      const r = upgrades.buy(b.dataset.up as (typeof UPGRADES)[number]['id']);
      if (r === 'bought') { cheer(true); this.renderShop(); } else nope(b);
    }));
  },

  renderGadgets(message = '') {
    const rank = deepMissions.rank, eq = gadgets.equipped(rank), slots = gadgets.slots(rank);
    const info = $('gadgetInfo');
    info.innerHTML = message || `Equipped <b>${eq.length}/${slots}</b>${slots < 3 ? ` · a third slot opens at rank ${THIRD_SLOT_RANK}` : ''}`;
    info.classList.toggle('warn', !!message);
    $('shopList').innerHTML = GADGETS.map(g => {
      const owned = gadgets.owns(g.id), on = eq.includes(g.id);
      markSeen(`gd:${g.id}`, isNewGadget(g.id));
      const btn = !owned
        ? `<button type="button" class="k-btn k-btn--yellow k-btn--sm${coins.balance < g.price ? ' short' : ''}" data-buy="${g.id}" aria-label="Buy ${g.name} for ${g.price} coins">${coinTag(g.price)}</button>`
        : `<button type="button" class="k-btn k-btn--sm${on ? '' : ' k-btn--white'}" data-eq="${g.id}" aria-pressed="${on}">${on ? 'Equipped' : 'Equip'}</button>`;
      return `<li class="shop-item${on ? ' equipped' : ''}"><img src="${portraits[`gd-${g.id}`] ?? ''}" alt="">
        <div class="shop-body"><b>${g.name}</b><span>${g.text}</span></div>${btn}</li>`;
    }).join('');
    $('shopList').querySelectorAll<HTMLButtonElement>('[data-buy]').forEach(b => b.addEventListener('click', () => {
      const r = gadgets.buy(b.dataset.buy as GadgetId, deepMissions.rank);
      if (r === 'bought') { cheer(true); this.renderGadgets(); } else nope(b);
    }));
    $('shopList').querySelectorAll<HTMLButtonElement>('[data-eq]').forEach(b => b.addEventListener('click', () => {
      if (gadgets.toggle(b.dataset.eq as GadgetId, deepMissions.rank)) { cheer(false); this.renderGadgets(); }
      else { nope(b); this.renderGadgets('All slots are full. Unequip a gadget first.'); }
    }));
  },

  /**
   * Out of lives: "Save me?" with a five-second countdown. Resolves true if the player spends Golden
   * Shells to keep diving (the scene spends them), false if they decline or time runs out.
   * (A "watch an ad" option can sit beside the shell button later.)
   */
  saveMe(reason: string, cost: number, have: number): Promise<boolean> {
    this.screen('saveme');
    $('savemeReason').textContent = reason;
    $('savemeCost').innerHTML = shellTag(cost);
    $('savemeHave').innerHTML = `You have ${shellTag(have)}`;
    const ring = $('savemeRing'), count = $('savemeCount');
    ring.style.animation = 'none'; void ring.getBoundingClientRect(); ring.style.animation = '';
    return new Promise(resolve => {
      let left = SAVE_ME_SECONDS;
      count.textContent = String(left);
      const tick = window.setInterval(() => {
        left--;
        count.textContent = String(Math.max(0, left));
        if (left > 0) sfx.tone(660, 0.06, { type: 'triangle', vol: 0.05 });
        else done(false);
      }, 1000);
      const done = (yes: boolean) => {
        clearInterval(tick);
        $('savemeYes').onclick = $('savemeNo').onclick = null;
        if (yes) this.screen(null);
        resolve(yes);
      };
      $('savemeYes').onclick = () => { buzz(10); done(true); };
      $('savemeNo').onclick = () => { buzz(6); done(false); };
    });
  },

  showOver(o: {
    depth: number; reason: string; zone: string; best: number; isBest: boolean; pearls: number;
    close: string; results: MissionResult[]; earned: { label: string; n: number }[]; rankUp: RankUp | null;
    /** A cave this dive opened, if any. */
    opened: string | null;
    /** Treasure chests found this dive (already paid out), shut until tapped. */
    chests: ChestPrize[];
  }) {
    diveEnded = true;
    store.set('divesDone', store.get('divesDone', 0) + 1);
    const stars = STAR_DEPTHS.filter(d => o.depth >= d).length;
    $('stars').innerHTML = STAR_DEPTHS.map((_, i) => STAR_SVG.replace('class="k-star"', `class="k-star${i < stars ? ' on' : ''}"`)).join('');
    $('overDepth').textContent = o.depth.toLocaleString();
    $('overReason').textContent = `${o.reason} · ${o.zone}`;
    $('overRibbon').textContent = o.isBest ? 'New Record!' : 'Game Over';
    $('overBest').hidden = !o.isBest;
    $('overClose').hidden = !o.close;
    $('overClose').textContent = o.close;
    renderEarned($('overEarned'), o.earned);
    renderChests($('overChests'), o.chests);
    renderMissions($('overMissions'), [], o.results);
    // A new record is the moment guests care most about losing progress (Subway Surfers asks here too).
    $('saveNudge').hidden = !(cloud.enabled && cloud.account.guest && o.isBest && o.depth >= 150);
    const up = $('overRankUp');
    up.hidden = !o.rankUp;
    if (o.rankUp) {
      const unlocked = SKINS.find(d => d.rank === o.rankUp!.rank);
      up.innerHTML = `Rank up! You're rank ${o.rankUp.rank}: coin bonus ×${deepMissions.bonus.toFixed(1)}${unlocked ? ` and <b>${unlocked.name}</b> unlocked` : ''}`;
    }
    $('overCave').hidden = !o.opened;
    if (o.opened) $('overCave').innerHTML = `New cave unlocked: <b>${o.opened}</b>! Pick it on the title screen.`;
    this.hud(false);
    this.screen('over');
  },

  /** Worldwide rank for the dive just finished (null hides it). */
  setRank(rank: number | null, isBest = false) {
    const el = $('overRank');
    el.hidden = !rank;
    if (rank) el.textContent = `${isBest ? 'Your new best ranks' : 'This dive ranks'} #${rank.toLocaleString()} worldwide`;
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

  /** The held lifeline (saves one dive-ending hit). */
  setLifeline(on: boolean) { $('lifeline').hidden = !on; },

  /** Active power-up with its remaining time (0..1). */
  setPerk(kind: 'shield' | 'magnet' | 'turbo' | null, frac: number) {
    const el = $('perk');
    if (kind !== shownPerk) {
      shownPerk = kind;
      el.hidden = !kind;
      el.dataset.kind = kind ?? '';
      $('perkIcon').textContent = kind === 'shield' ? 'Shield' : kind === 'magnet' ? 'Magnet' : kind === 'turbo' ? 'Turbo' : '';
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

  banner(text: string, label = 'Entering') {
    const el = $('banner');
    $('bannerLabel').textContent = label;
    $('bannerText').textContent = text;
    el.classList.remove('show');
    void el.offsetWidth; // restart the CSS animation
    el.classList.add('show');
  },

  /** A short tip in the pill at the bottom of the screen; null hides it. */
  hint(text: string | null, ms = 4000) {
    clearTimeout(hintTimer);
    $('hint').hidden = !text;
    if (!text) return;
    $('hintText').textContent = text;
    hintTimer = window.setTimeout(() => { $('hint').hidden = true; }, ms); // don't linger over play
  },

  /** First-dive guide: the screen split into its two steering halves, labelled. */
  guide(on: boolean) {
    $('guide').hidden = !on;
    guidePressed = 0;
    if (on) $('guide').querySelectorAll('.guide-zone').forEach(z => z.classList.remove('used', 'active'));
  },
  /** The half being pressed lights up and gets a tick once used: +1 up, -1 down, 0 none. */
  guidePress(dir: number) {
    if (dir === guidePressed || $('guide').hidden) return;
    guidePressed = dir;
    $('guide').querySelectorAll<HTMLElement>('.guide-zone').forEach(z => {
      const mine = (z.dataset.dir === 'up' ? 1 : -1) === dir;
      z.classList.toggle('active', mine);
      if (mine) z.classList.add('used');
    });
  },
  /** Both halves used: let the ticks show for a moment, then hand over to the tips. */
  guideDone() {
    clearTimeout(tipTimer);
    tipTimer = window.setTimeout(() => {
      this.guide(false);
      if (!$('hud').hidden) this.tips();
    }, 700);
  },
  /** After the guide: what else to know, one tip at a time. */
  tips() {
    this.hint('Grab bubbles to refill your air');
    clearTimeout(tipTimer);
    tipTimer = window.setTimeout(() => this.hint('Dodge critters: you have 3 lives'), 4300);
  },
};

/** The leaderboard screen: top divers, plus your own row when you're further down. */
async function openBoard() {
  ui.screen('board');
  const list = $('boardList'), status = $('boardStatus');
  ($('nameInput') as HTMLInputElement).value = cloud.name;
  status.textContent = 'Loading…';
  status.hidden = false;
  list.replaceChildren();
  const best = store.get('best', 0);
  const [top, rank] = await Promise.all([cloud.top(20), cloud.rank(best)]);
  if (!top) { status.textContent = 'Can’t reach the leaderboard right now.'; return; }
  status.hidden = top.length > 0;
  status.textContent = 'No dives yet. Be the first!';
  const row = (n: number | string, name: string, depth: number, me: boolean) => {
    const li = document.createElement('li');
    li.className = me ? 'me' : '';
    const r = document.createElement('span'); r.className = 'board-rank'; r.textContent = String(n);
    const nm = document.createElement('span'); nm.className = 'board-who'; nm.textContent = me ? `${name} (you)` : name;
    const d = document.createElement('b'); d.textContent = `${depth.toLocaleString()} m`;
    li.append(r, nm, d);
    return li;
  };
  top.forEach((s, i) => list.append(row(i + 1, s.name, s.best, s.me)));
  if (best > 0 && rank && !top.some(s => s.me)) {
    const gap = document.createElement('li'); gap.className = 'gap'; gap.textContent = '…';
    list.append(gap, row(rank, cloud.name, best, true));
  }
}

function renderAccount(message = '') {
  $('account').hidden = !cloud.enabled;
  const a = cloud.account;
  $('accountStatus').textContent = message || (a.guest
    ? 'You\u2019re playing as a guest, so your progress lives in this browser only. Sign in with Google to keep it safe and play on any device.'
    : 'Your progress is saved. Sign in with this account on any device to pick up where you left off.');
  // Signed in: who you are, with your Google photo (or your initial when there isn't one).
  $('accountProfile').hidden = a.guest;
  if (!a.guest) {
    const who = a.name || a.email?.split('@')[0] || 'Diver';
    $('accountName').textContent = who;
    $('accountEmail').textContent = a.email ?? '';
    $('accountEmail').hidden = !a.email;
    ($('accountProfile').querySelector('em') as HTMLElement).hidden = a.provider !== 'google';
    const av = $('accountAvatar');
    av.textContent = who[0].toUpperCase();
    if (a.photo) {
      const img = new Image();
      img.alt = ''; img.referrerPolicy = 'no-referrer'; // Google photos refuse requests that send a referrer
      img.onload = () => av.replaceChildren(img);
      img.src = a.photo;
    }
  }
  $('accountStatus').classList.toggle('ok', !!message);
  $('accountGuest').hidden = !a.guest || !$('accountConflict').hidden;
  $('signOutBtn').hidden = a.guest;
  $('signOutBtn').textContent = 'Sign out';
  $('accountError').hidden = true;
}
function showConflict(on: boolean) {
  $('accountConflict').hidden = !on;
  $('accountGuest').hidden = on || !cloud.account.guest;
  $('accountError').hidden = true;
}
function accountError(text: string) {
  const el = $('accountError');
  el.textContent = text;
  el.hidden = false;
  buzz(30);
}
/** Lock the account buttons while a sign-in runs; the one that started it shows a spinner. */
function setBusy(on: boolean, btn?: HTMLElement) {
  $('account').querySelectorAll('button').forEach(b => { (b as HTMLButtonElement).disabled = on; });
  $('account').classList.toggle('busy', on);
  $('account').querySelectorAll('.k-spinner').forEach(s => s.remove());
  $('account').querySelectorAll('.loading').forEach(b => b.classList.remove('loading'));
  if (on && btn?.classList.contains('k-btn')) {
    btn.classList.add('loading');
    btn.insertAdjacentHTML('beforeend', '<span class="k-spinner" aria-label="Working"></span>');
  }
}

/** Affordable or newly unlocked, and not looked at yet. */
function isNewDiver(s: Skin, rank: number) {
  if (suits.owns(s.id) && !s.rank) return false;
  const available = s.rank ? !rankLocked(s, rank) : coins.balance >= s.price;
  return available && !seen.has(`diver:${s.id}`);
}
function isNewUpgrade(id: (typeof UPGRADES)[number]['id']) {
  const cost = upgrades.cost(id);
  return cost !== null && coins.balance >= cost && !seen.has(`up:${id}:${upgrades.level(id)}`);
}
function isNewGadget(id: GadgetId) {
  const g = GADGETS.find(x => x.id === id)!;
  return !gadgets.owns(id) && coins.balance >= g.price && !seen.has(`gd:${id}`);
}
function markSeen(key: string, isNew: boolean) {
  if (!isNew) return;
  seen.add(key);
  store.set('seen', [...seen]);
}

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
