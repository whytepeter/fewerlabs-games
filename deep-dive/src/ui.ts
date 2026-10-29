import { onSettings, setSetting, settings, store, type Settings } from './core/settings';
import { coins, onMeta, SKIP_COST, type MissionResult, type RankUp } from './core/meta';
import { coinIcon, mountCoins, renderEarned, renderMissions } from './core/metaui';
import { deepMissions } from './game/missions';
import { sfx } from './core/sfx';
import { buzz } from './core/haptics';
import { isTouch } from './core/view';
import { hydrateIcons, icon, STAR_SVG, wobbleLetters } from './core/icons';
import { canAfford, CHARACTERS, charOf, charOwned, earnProgress, grantEarned, outfitsOf, portraits, rankLocked, SKINS, skinIndex, suits, type Skin } from './game/skins';
import { MAX_LEVEL, UPGRADES, upgrades } from './game/upgrades';
import { GADGETS, gadgets, THIRD_SLOT_RANK, type GadgetId } from './game/gadgets';
import { cleanName, cloud, topBest, type LinkResult } from './core/cloud';
import { holdUpdates, install, installMode, onInstallChange } from './core/pwa';
import { claimSignupGift, shellPrices, shellShop, shells, SIGNUP_GIFT } from './game/shells';
import type { ChestPrize } from './game/chests';
import type { Special } from './game/specials';
import { specialOf } from './game/specials';
import { boosterById, BOOSTERS, boosters, BOOSTER_WINDOW, type Booster, type BoosterId } from './game/boosters';
import { HUNT, hunt, type HuntPrize } from './game/hunt';
import { daily as dailyRun, DAILY_BONUS, dailyMissions, type DailyResult } from './game/daily';
import { STREAK, streak, type StreakGift } from './game/streak';
import { dev } from './core/dev';
import { ads, type ShowAd } from './core/ads';
import { consent } from './core/consent';
import { lagos, PRODUCTS as LAGOS_PRODUCTS } from './core/lagos';
import { CAVES, caveBest, currentCave, isUnlocked, markCavesSeen, newCaves, type CaveDef, type CaveId } from './game/caves';
import { caveTreasures, TREASURES, treasureLog } from './game/treasures';
import { liveDiver } from './liveDiver';

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
  /** Fire the diver's special move (when its meter is full). */
  special(): void;
  /** Start today's Daily Dive. */
  daily(): void;
  /** "Again" on the game-over screen: the same kind of dive as the last one. */
  again(): void;
  /** Use a booster at the start of a dive; false when it can't be used now. */
  booster(id: BoosterId): boolean;
}

/** Depths that earn 1, 2 and 3 stars: reaching the Twilight Zone, Midnight Zone and the Abyss. */
export const STAR_DEPTHS = [150, 400, 750];

const SCREENS = ['title', 'pause', 'saveme', 'over', 'board', 'divers', 'missions', 'shop', 'settings', 'caves', 'treasures'] as const;
type Screen = (typeof SCREENS)[number] | null;
/** Menus reached from the title; Back (or Escape) returns to it. */
const SUB = new Set<Screen>(['board', 'divers', 'missions', 'shop', 'settings', 'caves', 'treasures']);
const LABELS: Record<keyof Settings, string> = { sound: 'Sound', music: 'Music', haptics: 'Vibration' };
const portrait = () => matchMedia('(orientation: portrait)').matches;

let shownDepth = -1;
let o2Low = false;
let lowShown = false;
let shownPerk: string | null = null;
let toastTimer = 0;
let hintTimer = 0;
let guideLeft = 0;      // first-dive guide: bit 1 = swim up still to learn, bit 2 = go down
let guideHeld = 0;      // seconds the asked-for half has been held
let guideTimer = 0;
const GUIDE_HOLD = 0.5; // how long a half must be held to count as learned
// Coach tips, shown one at a time once the steering guide is done.
type CoachTip = { target: string; text: string };
let coachQueue: CoachTip[] = [];
let coachSeen = new Set<string>();
let coachTimer = 0;
const SAVE_ME_SECONDS = 5;
let diveEnded = false; // the next title screen comes straight after a dive
let showcase: ReturnType<typeof liveDiver> | undefined; // the title's big, live-drawn diver
let diverPreview: ReturnType<typeof liveDiver> | undefined; // and the Divers screen's
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
  } else if (c.id === 'pirate') {
    // A wrecked pirate ship on the sand: planked hull, broken mast with a tattered sail and flag, spilled gold.
    const hull = 'M10 60Q12 46 30 44L80 41Q88 41 90 48L84 62Z';
    const planks = [48, 54].map(y => `<path d="M16 ${y + 1}L${86 - (y - 48) * 0.4} ${y - 2}" stroke="${INK}" stroke-width="1.4" opacity=".55"/>`).join('');
    const coins = [[97, 54], [104, 55], [111, 54], [100, 49], [107, 49], [104, 44]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="4.2" ry="3.4" fill="#ffd23f" stroke="${INK}" stroke-width="1.6"/>`).join('');
    scene = `<path d="${hull}" fill="#9a6235" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>${planks}`
      + [28, 44, 60, 76].map(x => `<circle cx="${x}" cy="51" r="2.4" fill="${INK}"/>`).join('')
      + stroke('M50 44L60 20', 3.5, '#8a5a32') + stroke('M52 30L72 33', 2.4, '#8a5a32')
      + `<path d="M54 31L71 34L69 46L65 43L61 47L57 43L53 46Z" fill="#efe1c0" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`
      + `<path d="M60 20L71 22L70 27L59 25Z" fill="${INK}"/><circle cx="65" cy="23.4" r="1.5" fill="#fff"/>`
      + coins
      + `<g transform="translate(22 32) rotate(-25)"><rect x="-10" y="-4" width="20" height="8" rx="2" fill="#3b4252" stroke="${INK}" stroke-width="2"/><circle cx="-11" r="3" fill="#3b4252" stroke="${INK}" stroke-width="1.8"/></g>`;
  } else if (c.id === 'titanic') {
    // A great liner's hull fading into the dark: portholes, deck railing, a buff funnel with a black top, and a blue glint.
    const deck = (x: number) => 62 - (x + 4) * 0.385;
    const hull = 'M-4 62L74 32Q84 29 90 36L96 50L-4 76Z';
    const ports = [10, 24, 38, 52, 66].map(x => `<circle cx="${x}" cy="${deck(x) + 8}" r="2.6" fill="#bfe9ff" stroke="${INK}" stroke-width="1.4"/>`).join('');
    const rail = [0, 1, 2, 3, 4, 5, 6].map(i => { const x = 4 + i * 11; return `<path d="M${x} ${deck(x)}V${deck(x) - 7}" stroke="#c9d3dc" stroke-width="1.4"/>`; }).join('');
    scene = `<g transform="translate(58 34) rotate(-14)"><rect x="-7" y="-17" width="14" height="17" fill="#d9a04a" stroke="${INK}" stroke-width="2.2"/><rect x="-7" y="-22" width="14" height="6" fill="#1d1f26" stroke="${INK}" stroke-width="2.2"/></g>`
      + `<path d="${hull}" fill="#2e3a4a" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`
      + `<path d="M-4 76L96 50L98 56L-4 82Z" fill="#8a2b2b" stroke="${INK}" stroke-width="2"/>`
      + stroke(`M-2 ${deck(-2) - 7}L74 ${deck(74) - 7}`, 1.6, '#c9d3dc') + rail + ports
      + `<circle cx="106" cy="42" r="8" fill="#5fb8ff" opacity=".35"/><path d="M106 46.5C100.5 43 100.5 37.5 106 40C111.5 37.5 111.5 43 106 46.5Z" fill="#2f7bff" stroke="${INK}" stroke-width="1.4"/>`;
  } else if (c.id === 'riptide') {
    // Banded sandstone, streaks of a fast current with its chevrons, a sea fan and a starfish.
    const streaks = [[18, 22], [30, 40], [44, 26], [58, 44], [72, 24], [86, 38], [100, 28]].map(([x, y]) => `<path d="M${x} ${y}l-2 12" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/><circle cx="${x + 3}" cy="${y + 4}" r="1.1" fill="#f6dfb0"/>`).join('');
    const chev = (x: number, y: number) => `<path d="M${x - 6} ${y - 4}L${x} ${y + 3}L${x + 6} ${y - 4}" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" opacity=".4"/><path d="M${x - 6} ${y - 4}L${x} ${y + 3}L${x + 6} ${y - 4}" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
    const star = Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 2.6 : 6.5; return `${(96 + Math.cos(a) * r).toFixed(1)},${(53 + Math.sin(a) * r).toFixed(1)}`; }).join(' ');
    scene = streaks + chev(52, 30) + chev(52, 42)
      + `<path d="M22 60L8 40Q14 30 24 30Q34 30 38 40Z" fill="#b07cff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M22 58L14 38M22 58L24 32M22 58L34 40" stroke="#7a4ccf" stroke-width="1.2"/>`
      + `<polygon points="${star}" fill="#ff8a5c" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`
      + `<path d="M0 22Q30 16 60 21T120 20" stroke="#ffe0b0" stroke-width="2.5" fill="none" opacity=".7"/>`;
  } else if (c.id === 'sunken') {
    // Marble columns either side of a glowing temple doorway, with an arch and a gold glint.
    const col = (x: number, h: number) => `<rect x="${x - 5}" y="${62 - h}" width="10" height="${h}" fill="#e2d7bd" stroke="${INK}" stroke-width="2"/><rect x="${x - 8}" y="${57 - h}" width="16" height="6" fill="#e2d7bd" stroke="${INK}" stroke-width="2"/>`;
    scene = col(18, 36) + col(102, 30)
      + `<rect x="52" y="10" width="16" height="16" fill="#d9cfb4" stroke="${INK}" stroke-width="2"/><rect x="52" y="44" width="16" height="22" fill="#d9cfb4" stroke="${INK}" stroke-width="2"/>`
      + `<rect x="52" y="24" width="16" height="3" fill="#7fffd4"/><rect x="52" y="42" width="16" height="3" fill="#7fffd4"/><rect x="48" y="26" width="24" height="17" fill="#7fffd4" opacity=".18"/>`
      + `<path d="M30 30A14 14 0 0 1 42 16" fill="none" stroke="${INK}" stroke-width="7"/><path d="M30 30A14 14 0 0 1 42 16" fill="none" stroke="#e2d7bd" stroke-width="4"/>`
      + `<path d="M80 54L82 48L86 52L90 46L94 52L98 48L100 54Z" fill="#ffd23f" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><circle cx="90" cy="50" r="9" fill="#7fffd4" opacity=".2"/>`;
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
/** A cave's rare treasures on its card: little pictures, dark until found. */
function treasureLine(c: CaveDef) {
  const ts = caveTreasures(c.id);
  if (!ts.length) return '';
  const got = ts.filter(t => treasureLog.count(t.id) > 0).length;
  const pics = ts.map(t => `<img class="${treasureLog.count(t.id) ? '' : 'unfound'}" src="${portraits[`tr-${t.id}`] ?? ''}" alt="">`).join('');
  return `<small class="cave-goal cave-treasures">${pics}<span>${got ? `<b>${got}/${ts.length}</b> found` : ts.length > 1 ? `${ts.length} rare treasures` : 'A rare treasure'}</span></small>`;
}
/** The count on the title screen's Treasures tile. */
const drawTreasures = () => { const el = document.getElementById('treasuresCount'); if (el) el.textContent = `${treasureLog.found()}/${TREASURES.length}`; };
let viewed = 0;      // index of the diver shown on the Divers screen
let wearing = 'classic';
let shopTab: 'upgrades' | 'gadgets' | 'boosters' | 'shells' | 'coins' = 'upgrades';
let shownSpecial = '';
/** Divers and upgrades the player had already seen as affordable/unlocked (for the "New" dots). */
const seen = new Set<string>(store.get<string[]>('seen', []));

/** Click handler with the usual tap sound and buzz. */
const onTap = (id: string, fn: () => void) =>
  $(id).addEventListener('click', () => { sfx.unlock(); buzz(6); fn(); });
const coinTag = (n: number) => `${coinIcon()}${n.toLocaleString()}`;
const shellTag = (n: number) => `<img class="shell-ico" src="${portraits.shell ?? ''}" alt="">${n.toLocaleString()}`;
/** A diver's price, in coins or Sea Hearts. */
const priceTag = (s: Skin) => (s.shells ? shellTag(s.price) : coinTag(s.price));
/** One coin seen from the side, at (x, y): the face on top of a thick rim. */
const sideCoin = (x: number, y: number) =>
  `<path d="M${x - 13} ${y}v3a13 5 0 0 0 26 0v-3" fill="#f2a91e" stroke="#16233b" stroke-width="1.8"/>`
  + `<ellipse cx="${x}" cy="${y}" rx="13" ry="5" fill="#ffd23f" stroke="#16233b" stroke-width="1.8"/>`
  + `<ellipse cx="${x - 3}" cy="${y - 1}" rx="5" ry="1.5" fill="#fff1b0"/>`;
/** A stack of `n` coins standing on y = 40. */
const stack = (x: number, n: number) => Array.from({ length: n }, (_, i) => sideCoin(x, 38 - i * 5)).join('');
/** Pictures for the Lagos Life coin items: the doubler, then piles that grow with the pack. */
function coinArt(p: (typeof LAGOS_PRODUCTS)[number]) {
  const svg = (inner: string) => `<svg class="shop-coin" viewBox="0 0 48 48" aria-hidden="true">${inner}</svg>`;
  if (p.doubler) {
    return svg(`<circle cx="21" cy="25" r="15" fill="#ffc43d" stroke="#16233b" stroke-width="2.6"/><circle cx="21" cy="25" r="10" fill="none" stroke="#d18a00" stroke-width="2"/>`
      + `<rect x="25" y="4" width="21" height="15" rx="7.5" fill="#ff5a7a" stroke="#16233b" stroke-width="2.4"/>`
      + `<text x="35.5" y="15.5" text-anchor="middle" font-size="11" font-weight="700" font-family="Fredoka, sans-serif" fill="#fff">×2</text>`);
  }
  const c = p.coins ?? 0;
  if (c <= 5000) return svg(stack(24, 3));
  if (c <= 20000) return svg(stack(24, 6));
  return svg(stack(15, 5) + stack(32, 7) + `<path d="M40 6l1.6 3.4L45 11l-3.4 1.6L40 16l-1.6-3.4L35 11l3.4-1.6z" fill="#fff" stroke="#16233b" stroke-width="1.4"/>`);
}

/** Shop rows for Lagos Life products: Buy opens their pay sheet, which shows the price. */
function lagosRows(list: typeof LAGOS_PRODUCTS) {
  return list.map(p => `<li class="shop-item">${p.hearts ? `<img src="${portraits.shell ?? ''}" alt="">` : coinArt(p)}
        <div class="shop-body"><b>${p.name}</b><span>${p.note}</span></div>
        <button type="button" class="k-btn k-btn--green k-btn--sm" data-lagos="${p.id}">Buy</button></li>`).join('');
}
function bindLagosBuys(after: () => void) {
  $('shopList').querySelectorAll<HTMLButtonElement>('[data-lagos]').forEach(b => b.addEventListener('click', async () => {
    buzz(8);
    b.disabled = true;
    const ok = await lagos.buy(b.dataset.lagos!);
    b.disabled = false;
    if (ok) { cheer(true); after(); }
  }));
}

/** Game over: once a rewarded ad is ready, offer to pay the dive's coins again for watching it. */
function offerDoubleCoins(n: number) {
  const b = $('overAd') as HTMLButtonElement;
  b.hidden = true;
  b.onclick = null;
  if (n <= 0) return;
  void ads.rewarded('double-coins').then(show => {
    if (!show || $('over').hidden) return;
    b.disabled = false;
    b.innerHTML = `${icon('tv')}Double your coins <span class="price-chip">+${coinTag(n)}</span>`;
    b.setAttribute('aria-label', `Watch an ad to double your coins: ${n} more`);
    b.hidden = false;
    b.onclick = () => {
      buzz(10);
      b.disabled = true;
      void show().then(watched => {
        if (!watched) { b.hidden = true; return; }
        coins.add(n);
        b.innerHTML = `${coinTag(n)} added!`;
        sfx.tone(880, 0.15, { vol: 0.08 }); sfx.tone(1318, 0.3, { vol: 0.08, delay: 0.1 });
        buzz([15, 25, 15]);
      });
    };
  });
}

/** Treasure chests on the game-over screen: each shakes open on its own, one after another, to show its prize (a tap opens it sooner). */
function renderChests(el: HTMLElement, prizes: ChestPrize[]) {
  el.hidden = !prizes.length;
  el.innerHTML = `<p class="over-chests-hint">${prizes.length > 1 ? 'Treasure chests!' : 'Treasure chest!'}</p>`;
  prizes.forEach((prize, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'over-chest';
    b.style.animationDelay = `${i * 0.15}s`;
    b.setAttribute('aria-label', 'Open treasure chest');
    b.innerHTML = `<img src="${portraits.chest ?? ''}" alt="">`;
    const open = () => {
      if (b.classList.contains('opening') || b.classList.contains('open')) return;
      sfx.unlock(); buzz(10);
      b.classList.add('opening');
      sfx.tone(330, 0.08, { type: 'triangle', vol: 0.05 }); sfx.tone(392, 0.08, { type: 'triangle', vol: 0.05, delay: 0.12 });
      window.setTimeout(() => {
        b.classList.replace('opening', 'open');
        b.removeAttribute('aria-label');
        b.innerHTML = prize.kind === 'shell'
          ? `<span class="over-chest-prize"><img class="shell-ico" src="${portraits.shell ?? ''}" alt="">Sea Heart!</span>`
          : prize.kind === 'booster'
            ? `<span class="over-chest-prize"><img class="shell-ico" src="${portraits[boosterById(prize.id).icon] ?? ''}" alt="">${boosterById(prize.id).name}!</span>`
            : `<span class="over-chest-prize">${coinIcon()}+${prize.n}</span>`;
        sfx.tone(659, 0.15, { vol: 0.08 }); sfx.tone(880, 0.15, { vol: 0.08, delay: 0.08 }); sfx.tone(1318, 0.4, { vol: 0.08, delay: 0.16 });
        buzz([15, 25, 15]);
      }, 380);
    };
    b.addEventListener('click', open);
    // After the chests pop in; skipped if the player has already left the game-over screen.
    window.setTimeout(() => { if (b.isConnected && !el.closest('[hidden]')) open(); }, 900 + i * 700);
    el.append(b);
  });
}
/** Every Sea Heart counter (home, HUD, shop, divers). */
const drawShells = () => document.querySelectorAll<HTMLElement>('[data-shells]').forEach(el => { el.innerHTML = shellTag(shells.count); });
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

/** A hunt prize as a small tag: coins, a booster or a Sea Heart. */
function prizeTag(p: HuntPrize) {
  if (p.kind === 'coins') return coinTag(p.n);
  if (p.kind === 'shell') return shellTag(p.n);
  return `<img class="shell-ico" src="${portraits[boosterById(p.id).icon] ?? ''}" alt="">×${p.n}`;
}
const prizeName = (p: HuntPrize) => p.kind === 'coins' ? `${p.n} coins` : p.kind === 'shell' ? 'a Sea Heart' : `${p.n} ${boosterById(p.id).name} boosters`;

/** The weekly Pearl Hunt: a bar with the three prizes along it. `gained` highlights this dive's pearls. */
function huntBar(gained = 0) {
  // Prizes sit evenly along the bar (a third each); the fill moves through each stretch in turn.
  const now = hunt.pearls, k = HUNT.length;
  const frac = (n: number) => {
    const i = HUNT.findIndex(t => n < t.at);
    if (i < 0) return 1;
    const from = i ? HUNT[i - 1].at : 0;
    return (i + (n - from) / (HUNT[i].at - from)) / k;
  };
  const marks = HUNT.map(t => `<span class="hunt-mark${now >= t.at ? ' won' : ''}" style="left:${frac(t.at) * 100}%"><i>${prizeTag(t.prize)}</i></span>`).join('');
  return `<span class="hunt-track"><b class="hunt-was" style="transform:scaleX(${frac(now - gained)})"></b><b class="hunt-now" style="transform:scaleX(${frac(now)})"></b>${marks}</span>`;
}
function huntHead() {
  const next = hunt.next, d = hunt.daysLeft;
  return `<span class="hunt-head"><b>${icon('pearl')}Pearl Hunt</b><small>${next ? `${(next.at - hunt.pearls).toLocaleString()} pearls to the next prize` : 'All prizes won!'} · ${d === 1 ? 'ends today' : `${d} days left`}</small></span>`;
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
    on('playBtn', () => { enterFullscreen(); lockLandscape(); h.play(); });
    on('againBtn', h.again);
    on('dailyBtn', () => { enterFullscreen(); lockLandscape(); h.daily(); });
    document.querySelectorAll<HTMLButtonElement>('[data-board]').forEach(b => b.addEventListener('click', () => {
      buzz(6);
      void openBoard(b.dataset.board === 'today');
    }));
    on('pauseBtn', h.pause);
    $('specialBtn').addEventListener('click', () => { sfx.unlock(); h.special(); });
    $('boosterBar').addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-booster]');
      if (b && !h.booster(b.dataset.booster as BoosterId)) nope(b);
    });
    on('resumeBtn', h.resume);
    on('restartBtn', h.restart);
    on('menuBtn', h.menu);
    on('overMenuBtn', h.menu);
    on('boardBtn', () => void openBoard());
    on('boardBack', () => this.back());
    on('showcase', () => this.openDivers());
    on('diversBtn', () => this.openDivers());
    on('caveChip', () => this.openCaves());
    on('treasuresBtn', () => this.openTreasures());
    treasureLog.onChange(drawTreasures);
    drawTreasures();
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
    this.askAge(() => this.askName(() => this.askConsent(() => this.offerStreak(() => this.rotateHint()))));
    on('settingsBtn', () => { this.screen('settings'); renderAccount(); });
    on('saveNudge', () => { this.screen('settings'); renderAccount(); });
    this.initAccount();
    $('devMode').addEventListener('change', e => {
      dev.set((e.target as HTMLInputElement).checked);
      buzz(10);
      document.body.classList.toggle('dev-mode', dev.on);
    });
    document.body.classList.toggle('dev-mode', dev.on);
    on('diverPrev', () => this.showCharacter(-1));
    on('diverNext', () => this.showCharacter(1));
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
      const keys = !isTouch();
      $('howHold').textContent = keys ? 'Click or ↑ ↓' : 'Touch';
      $('howHoldText').textContent = keys ? (portrait() ? 'left / right, or the arrow keys' : 'top / bottom, or the arrow keys')
        : portrait() ? 'left / right to steer' : 'top / bottom to steer';
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
    $('specialBtn').hidden = !visible;
    if (!visible) $('boosterBar').hidden = true;
    if (!visible) { this.lowO2(false); this.hint(null); this.guide(false); this.coach(null); }
  },

  /** The title hub; the best shown is the selected cave's. */
  showTitle(skin: string) {
    wearing = skin;
    drawShells();
    // First-timers see how to play above the Dive button.
    $('howto').hidden = store.get('learned', false);
    $('boardBtn').hidden = !cloud.enabled && !lagos.on; // inside Lagos Life it's their leaderboard (the cloud is off there)
    this.refreshTitle();
    this.hud(false);
    this.screen('title');
    unlockOrientation();
    if (diveEnded) { diveEnded = false; window.setTimeout(() => this.offerInstall(), 700); }
  },

  back() {
    this.refreshTitle();
    this.screen('title');
  },

  /** Title hub: rank, diver showcase, best depth and the badges on the menu tiles. */
  refreshTitle() {
    $('howLives').textContent = store.get('learned', false) ? '3 lives' : '5 lives'; // a first dive has 2 extra
    const s = SKINS[skinIndex(wearing)];
    (showcase ??= liveDiver($('showcaseImg') as HTMLCanvasElement)).set(s);
    $('showcaseName').textContent = charOf(s).name;
    $('showcaseSpecial').textContent = specialOf(s.id).name;
    const cv = currentCave();
    const best = caveBest(cv.id);
    $('titleBest').textContent = best.toLocaleString();
    $('titleBestBox').classList.toggle('empty', !best);
    $('caveName').textContent = cv.name;
    $('caveSwatch').innerHTML = caveArt(cv);
    $('caveDot').hidden = !newCaves().length;
    const rank = deepMissions.rank, set = deepMissions.active, done = set.filter(m => m.done).length;
    $('rankNum').textContent = String(rank);
    $('rankPips').innerHTML = set.map(m => `<i class="${m.done ? 'on' : ''}"></i>`).join('');
    $('missionsCount').textContent = `${done}/${set.length}`;
    // Daily Dive: today's best, or a nudge if you haven't dived it yet today.
    $('dailyInfo').textContent = dailyRun.tries ? `Best ${dailyRun.best.toLocaleString()} m` : `+${DAILY_BONUS} coins`;
    $('dailyDot').hidden = dailyRun.tries > 0;
    $('diversDot').hidden = !SKINS.some(d => isNewDiver(d, rank));
    $('shopDot').hidden = !UPGRADES.some(u => isNewUpgrade(u.id)) && !GADGETS.some(g => isNewGadget(g.id));

    // The mission set on the hub (as Jetpack Joyride does); CSS shows only the next unfinished one.
    $('titleQuests').hidden = !store.get('learned', false);
    $('tqSet').textContent = `${done} of ${set.length} done`;
    $('tqList').innerHTML = set.map(m => {
      const frac = m.done ? 1 : Math.min(1, m.progress / m.target);
      return `<span class="tq-row${m.done ? ' done' : ''}"><i class="tq-check">${m.done ? icon('star') : ''}</i>
        <span class="tq-body"><span class="tq-text">${m.text}</span>
          <span class="tq-bar"><b style="transform:scaleX(${frac})"></b></span>
          <em>${Math.min(m.progress, m.target).toLocaleString()} / ${m.target.toLocaleString()}</em></span>
        <span class="tq-coin">${m.done ? 'Done' : coinTag(m.reward)}</span></span>`;
    }).join('');
    // The Pearl Hunt in one line: progress to the next prize.
    const next = hunt.next, now = hunt.pearls;
    $('tqHunt').innerHTML = `${icon('pearl')}<b>Pearl Hunt</b>` + (next
      ? `<span class="tq-bar"><b style="transform:scaleX(${Math.min(1, now / next.at)})"></b></span><em>${now.toLocaleString()} / ${next.at.toLocaleString()}</em><span class="tq-coin">${prizeTag(next.prize)}</span>`
      : '<em>All prizes won this week</em>');
  },

  /** Settings > Your progress: link the guest to Google, switch accounts, sign out. */
  initAccount() {
    const run = async (fn: () => Promise<LinkResult>, btn: HTMLElement) => {
      setBusy(true, btn);
      const r = await fn();
      setBusy(false);
      if (r === 'linked') { cheer(true); renderAccount(giftNote('Saved! Your progress now follows your account.')); }
      else if (r === 'exists') showConflict(true);
      else if (r !== 'redirect') accountError(r.error);
    };
    onTap('googleBtn', () => void run(() => cloud.linkGoogle(), $('googleBtn')));
    onTap('useAccountBtn', () => void (async () => {
      setBusy(true, $('useAccountBtn'));
      const r = await cloud.useExisting();
      setBusy(false);
      if (r === true) { showConflict(false); cheer(true); renderAccount(giftNote('Welcome back! Your saved progress is loaded.')); }
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
    // Also back from a redirect that linked the account: its sign-up shell (only once the save has synced).
    void cloud.start().then(() => {
      if (!cloud.account.guest && claimSignupGift() && this.isOpen('settings')) renderAccount(giftNote('Saved!', true));
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
    if (lagos.on) return;
    const mode = installMode(), asked = store.get('installAsked', { n: 0, at: 0 });
    if (!mode || store.get('divesDone', 0) < INSTALL_AFTER_DIVES || asked.n >= 3 || Date.now() - asked.at < INSTALL_GAP) return;
    if (!$('rotateHint').hidden || !this.isOpen('title')) return;
    store.set('installAsked', { n: asked.n + 1, at: Date.now() });
    $('installOfferPrompt').hidden = mode !== 'prompt';
    $('installOfferIOS').hidden = mode !== 'ios';
    $('installOffer').hidden = false;
  },

  /**
   * First open: the player's age, on a slider with Accept, before anything else (saved and synced,
   * so it's asked once). Accept stays off until the slider has been moved. Then `next`.
   */
  askAge(next: () => void) {
    if (lagos.on) { next(); return; } // inside Lagos Life: no personal questions (their rules)
    const age = store.get<number | null>('age', null);
    if (age !== null) { ads.init(age); next(); return; }
    const el = $('ageGate'), range = $('ageRange') as HTMLInputElement, ok = $('ageOk') as HTMLButtonElement;
    range.addEventListener('input', () => {
      $('ageValue').textContent = range.value === range.max ? `${range.value}+` : range.value;
      $('ageValue').classList.add('picked');
      ok.disabled = false;
    });
    ok.addEventListener('click', () => {
      buzz(6);
      store.set('age', Number(range.value));
      ads.init(Number(range.value));
      el.hidden = true;
      next();
    });
    el.hidden = false;
  },

  /**
   * Right after the age: the name shown on the leaderboard, asked once. It starts on the made-up
   * name, so Let's dive keeps that; an empty box keeps it too. Then `next`.
   */
  askName(next: () => void) {
    if (lagos.on) { next(); return; } // their board shows the player's Lagos Life name
    if (store.get('nameAsked', false)) { next(); return; }
    const el = $('namePop'), input = $('namePopInput') as HTMLInputElement;
    input.value = cloud.name;
    $('namePopForm').addEventListener('submit', e => {
      e.preventDefault();
      buzz(6);
      input.blur();
      store.set('nameAsked', true);
      if (cleanName(input.value) && cleanName(input.value) !== cloud.name) void cloud.rename(input.value);
      el.hidden = true;
      next();
    });
    el.hidden = false;
  },

  /**
   * After the age and name, once per device: the cookie notice, with one "Got it". Then `next`.
   */
  askConsent(next: () => void) {
    if (lagos.on) { next(); return; } // nothing to consent to: no analytics or outside ads there
    if (consent.asked) { next(); return; }
    const el = $('cookieBar');
    const answer = (all: boolean) => {
      buzz(6);
      consent.set({ analytics: all });
      el.hidden = true;
      next();
    };
    $('cookieAll').onclick = () => answer(true);
    el.hidden = false;
  },

  /** A first-open popover is up (the game's keys stay quiet). */
  askingAge() { return ['ageGate', 'namePop', 'cookieBar', 'streakPop'].some(id => !$(id).hidden); },

  /** Once a day, on opening the game: the login streak's gift for today, then `next`. */
  offerStreak(next: () => void) {
    const t = streak.today;
    if (!t.claimable) { next(); return; }
    const gift = (g: StreakGift) => g.kind === 'coins' ? coinTag(g.n) : g.kind === 'shell' ? shellTag(g.n)
      : `<img class="shell-ico" src="${portraits[boosterById(g.id).icon] ?? ''}" alt="">`;
    $('streakDays').innerHTML = STREAK.map((g, i) => `<li class="${i < t.day ? 'got' : i === t.day ? 'now' : ''}${i === STREAK.length - 1 ? ' big' : ''}">
      <small>Day ${i + 1}</small><span>${i < t.day ? icon('star') : gift(g)}</span></li>`).join('');
    $('streakSub').textContent = t.day ? `Day ${t.day + 1} in a row! Come back tomorrow for more.` : 'Come back every day for a bigger gift. Day 7 is a Sea Heart!';
    const el = $('streakPop');
    el.hidden = false;
    $('streakClaim').onclick = () => {
      if (!streak.claim()) return;
      cheer(true);
      // Seven days in a row earns Royal.
      const earnedNow = grantEarned();
      if (earnedNow.length) $('streakSub').innerHTML = `Seven days in a row! <b>${earnedNow.map(d => d.name).join(', ')}</b> joins your divers.`;
      el.querySelector(`li.now`)?.classList.add('claimed');
      drawShells();
      window.setTimeout(() => { el.hidden = true; next(); }, earnedNow.length ? 2400 : 650);
    };
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

  /** Every rare treasure: found ones in colour with their story, the rest as dark "?" silhouettes. */
  openTreasures() {
    this.screen('treasures');
    drawTreasures();
    const log = treasureLog.all();
    $('treasureCount').textContent = `${treasureLog.found()} of ${TREASURES.length} found`;
    $('treasureList').innerHTML = TREASURES.map(t => {
      const e = log[t.id], cave = CAVES.find(c => c.id === t.cave)!;
      const when = e ? new Date(`${e.first}T12:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
      return `<li class="treasure${e ? ' found' : ''}${t.legendary ? ' legendary' : ''}" style="--glow:${hex(t.glow)}">
        <span class="treasure-art"><img src="${portraits[`tr-${t.id}`] ?? ''}" alt="">${e ? '' : '<b aria-hidden="true">?</b>'}</span>
        <span class="treasure-body"><b>${e ? t.name : '???'}</b><small>${cave.name}${t.legendary ? ' · Legendary' : ''}</small>
          <span>${e ? t.story : `Somewhere between ${t.from} and ${t.to} m. Very rare.`}</span>
          ${e ? `<em>${e.n > 1 ? `Found ${e.n} times · ` : ''}First found ${when}</em>` : ''}</span>
      </li>`;
    }).join('');
  },

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
        <span class="cave-body"><b>${c.name}</b><span>${c.blurb}</span>${status}${open ? treasureLine(c) : ''}</span>
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

  /** Step to the previous or next character, showing the outfit they wear (or their first one). */
  showCharacter(dir: number) {
    const at = CHARACTERS.indexOf(charOf(SKINS[viewed]));
    const c = CHARACTERS[(at + dir + CHARACTERS.length) % CHARACTERS.length];
    this.showDiver(skinIndex(charOf(SKINS[skinIndex(wearing)]) === c ? wearing : c.base));
  },

  /** Show one outfit: its character up top (name, bio, special), the outfit's own perk below. */
  showDiver(i: number) {
    viewed = (i + SKINS.length) % SKINS.length;
    const s = SKINS[viewed], c = charOf(s), rank = deepMissions.rank;
    markSeen(`diver:${s.id}`, isNewDiver(s, rank));
    const img = $('diverImg') as HTMLCanvasElement;
    (diverPreview ??= liveDiver(img)).set(s);
    // Divers you can buy show in full colour (so you want them); rank rewards stay a mystery.
    img.classList.toggle('locked', rankLocked(s, rank));
    img.classList.toggle('for-sale', !suits.owns(s.id));
    img.classList.remove('pop'); void img.offsetWidth; img.classList.add('pop');
    $('diverName').textContent = c.name;
    $('diverBio').textContent = c.bio;
    $('diverPerk').innerHTML = `<b>${s.name}</b>${s.perkText}`;
    const sp = specialOf(s.id);
    $('diverSpecial').innerHTML = `<b>${sp.name}</b><span>${sp.text}</span>`;
    const btn = $('diverAction'), need = $('diverNeed');
    btn.className = 'k-btn k-btn--block';
    need.className = 'need-more';
    need.hidden = true;
    if (!charOwned(c) && s.id !== c.base) {
      btn.innerHTML = `${icon('lock')}Unlock ${c.name} first`; btn.classList.add('k-btn--white');
      need.hidden = false; need.textContent = `Get ${c.name} with their ${SKINS[skinIndex(c.base)].name} outfit, then dress them up.`;
    } else if (rankLocked(s, rank)) {
      btn.innerHTML = `${icon('lock')}Unlocks at rank ${s.rank}`; btn.classList.add('k-btn--white');
      need.hidden = false; need.textContent = 'Finish mission sets to rank up.';
    } else if (s.id === wearing) { btn.innerHTML = 'Wearing'; btn.classList.add('k-btn--white'); }
    else if (suits.owns(s.id)) btn.textContent = 'Wear';
    else if (s.earn) {
      // Earned by playing: show the goal and how far along you are; Sea Hearts skip the rest.
      const p = earnProgress(s)!;
      need.hidden = false;
      need.className = 'need-more earn-goal';
      need.innerHTML = `<b>${icon('star')}${s.earn.text}</b><span class="earn-bar"><b style="transform:scaleX(${p / s.earn.n})"></b></span><em>${p.toLocaleString()} / ${s.earn.n.toLocaleString()}</em>`;
      btn.innerHTML = `<span>Skip the goal</span><span class="price-chip">${priceTag(s)}</span>`;
      btn.classList.add('k-btn--yellow');
      if (shells.count < s.price) btn.classList.add('short');
    } else {
      const short = s.price - (s.shells ? shells.count : coins.balance);
      btn.innerHTML = `<span>${s.id === c.base ? 'Unlock' : 'Buy'}</span><span class="price-chip">${priceTag(s)}</span>`;
      btn.classList.add('k-btn--yellow', 'k-btn--lg');
      if (short > 0) {
        btn.classList.add('short');
        need.hidden = false;
        need.innerHTML = s.shells
          ? `You need ${shellTag(short)} more. Find Sea Hearts in treasure chests, or buy them in the shop.`
          : `You need ${coinTag(short)} more. Dive and finish missions to earn coins.`;
      }
    }
    this.charTabs();
    this.diverGrid();
    this.loadout();
  },

  /** One tab per character: their picture, name, and a lock until you have them. */
  charTabs() {
    const now = charOf(SKINS[viewed]), worn = SKINS[skinIndex(wearing)];
    $('charTabs').innerHTML = CHARACTERS.map(c => {
      const pic = charOf(worn) === c ? worn.id : c.base, owned = charOwned(c);
      const fresh = outfitsOf(c.id).some(s => isNewDiver(s, deepMissions.rank));
      return `<button type="button" class="char-tab${c === now ? ' on' : ''}${owned ? '' : ' for-sale'}${fresh ? ' new' : ''}" role="radio"
        aria-checked="${c === now}" data-c="${c.id}"><img src="${portraits[`diver-${pic}`] ?? ''}" alt=""><span>${owned ? '' : icon('lock')}${c.name}</span></button>`;
    }).join('');
    $('charTabs').querySelectorAll<HTMLButtonElement>('[data-c]').forEach(b => b.addEventListener('click', () => {
      buzz(6);
      const c = CHARACTERS.find(x => x.id === b.dataset.c)!;
      this.showCharacter(CHARACTERS.indexOf(c) - CHARACTERS.indexOf(charOf(SKINS[viewed])));
    }));
  },

  /** The gadgets you own, to equip right here before a dive (buying them stays in the shop). */
  loadout(message = '') {
    const rank = deepMissions.rank, eq = gadgets.equipped(rank), slots = gadgets.slots(rank);
    const owned = GADGETS.filter(g => gadgets.owns(g.id));
    $('loadoutCount').textContent = `${eq.length}/${slots}`;
    $('loadout').innerHTML = owned.map(g => {
      const on = eq.includes(g.id);
      return `<button type="button" class="gadget-chip${on ? ' on' : ''}" data-eq="${g.id}" aria-pressed="${on}" title="${g.text}">
        <img src="${portraits[`gd-${g.id}`] ?? ''}" alt=""><span>${g.name}</span></button>`;
    }).join('') + (message ? `<p class="need-more">${message}</p>` : '')
      + `<button type="button" class="k-btn k-btn--white k-btn--sm gadget-shop" data-shop>${owned.length ? 'More gadgets' : 'Get gadgets in the shop'}</button>`;
    $('loadout').querySelectorAll<HTMLButtonElement>('[data-eq]').forEach(b => b.addEventListener('click', () => {
      if (gadgets.toggle(b.dataset.eq as GadgetId, deepMissions.rank)) { buzz(6); this.loadout(); }
      else { nope(b); this.loadout('All slots are full. Take one off first.'); }
    }));
    $('loadout').querySelector('[data-shop]')!.addEventListener('click', () => this.openShop('gadgets'));
  },

  diverGrid() {
    const rank = deepMissions.rank;
    $('diverGrid').innerHTML = SKINS.map((s, i) => {
      if (charOf(s) !== charOf(SKINS[viewed])) return '';
      const locked = rankLocked(s, rank), owned = suits.owns(s.id) && !locked;
      const tag = owned ? '' : locked ? `<small>${icon('lock')}${s.rank}</small>`
        : s.earn ? `<small>${icon('star')}${earnProgress(s)}/${s.earn.n}</small>` : `<small>${priceTag(s)}</small>`;
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
    // Today's three daily missions, and the booster for clearing them all.
    const today = dailyMissions.list, b = boosterById(dailyMissions.bonusBooster);
    $('todayCard').innerHTML = `<span class="today-head"><b>${icon('calendar')}Today</b><small>${today.filter(m => m.done).length} of 3 · all three: <img class="shell-ico" src="${portraits[b.icon] ?? ''}" alt="">${b.name}${dailyMissions.bonusPaid ? ' (won!)' : ''}</small></span>`
      + today.map(m => `<span class="today-row${m.done ? ' done' : ''}"><i class="tq-check">${m.done ? icon('star') : ''}</i><span class="tq-body"><span class="tq-text">${m.text}</span>
        <span class="tq-bar"><b style="transform:scaleX(${Math.min(1, m.progress / m.target)})"></b></span></span><span class="tq-coin">${m.done ? 'Done' : coinTag(m.reward)}</span></span>`).join('');
    $('huntCard').innerHTML = huntHead() + huntBar()
      + `<span class="hunt-prizes">${HUNT.map(t => `<span class="${hunt.pearls >= t.at ? 'won' : ''}"><b>${t.at.toLocaleString()}</b> pearls: ${prizeName(t.prize)}</span>`).join('')}</span>`;
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
    $('gadgetInfo').hidden = shopTab === 'upgrades';
    if (shopTab === 'gadgets') { this.renderGadgets(); return; }
    if (shopTab === 'boosters') { this.renderBoosters(); return; }
    if (shopTab === 'shells') { this.renderShells(); return; }
    if (shopTab === 'coins') { this.renderCoins(); return; }
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

  /** One-use boosters: buy as many as you like, then tap them at the start of a dive. */
  renderBoosters() {
    $('gadgetInfo').innerHTML = 'Tap a booster in the <b>first few seconds</b> of a dive to use it. Chests and the Pearl Hunt give them too.';
    $('gadgetInfo').classList.remove('warn');
    $('shopList').innerHTML = BOOSTERS.map(b => {
      const n = boosters.count(b.id);
      return `<li class="shop-item"><img src="${portraits[b.icon] ?? ''}" alt="">
        <div class="shop-body"><b>${b.name}</b><span>${b.text}</span><small class="shop-have">You have ${n}</small></div>
        <button type="button" class="k-btn k-btn--yellow k-btn--sm${coins.balance < b.price ? ' short' : ''}" data-boost="${b.id}" aria-label="Buy ${b.name} for ${b.price} coins">${coinTag(b.price)}</button></li>`;
    }).join('');
    $('shopList').querySelectorAll<HTMLButtonElement>('[data-boost]').forEach(b => b.addEventListener('click', () => {
      if (boosters.buy(b.dataset.boost as BoosterId) === 'bought') { cheer(true); this.renderBoosters(); } else nope(b);
    }));
  },

  /** Sea Hearts for coins: this week's few, each dearer than the last. */
  renderShells() {
    const bought = shellShop.bought;
    $('gadgetInfo').innerHTML = `You have ${shellTag(shells.count)} · spend them on <b>Save me</b> or on divers. New stock every Monday.`;
    $('gadgetInfo').classList.remove('warn');
    const prices = shellPrices();
    // Inside Lagos Life: Sea Heart packs on their own pay sheet (the price shows there), above the weekly coin-priced ones.
    const packs = lagos.on ? lagosRows(LAGOS_PRODUCTS.filter(p => p.hearts)) : '';
    $('shopList').innerHTML = packs + prices.map((price, i) => {
      const btn = i < bought ? '<span class="shop-max">Sold</span>'
        : i > bought ? `<span class="shop-max">${icon('lock')}</span>`
        : `<button type="button" class="k-btn k-btn--yellow k-btn--sm${coins.balance < price ? ' short' : ''}" data-shell aria-label="Buy a Sea Heart for ${price} coins">${coinTag(price)}</button>`;
      return `<li class="shop-item${i < bought ? ' equipped' : ''}"><img src="${portraits.shell ?? ''}" alt="">
        <div class="shop-body"><b>Sea Heart</b><span>${i === 0 ? 'This week’s first Sea Heart' : i === bought ? 'Another one, a little dearer' : i < bought ? 'Bought this week' : `Opens once you buy the ${prices[i - 1].toLocaleString()}-coin one`}</span></div>${btn}</li>`;
    }).join('');
    $('shopList').querySelector<HTMLButtonElement>('[data-shell]')?.addEventListener('click', e => {
      const b = e.currentTarget as HTMLButtonElement;
      if (shellShop.buy() === 'bought') { cheer(true); this.renderShells(); } else nope(b);
    });
    bindLagosBuys(() => this.renderShells());
  },

  /** Inside Lagos Life only: coin packs and the Coin Doubler (gone once bought), on their pay sheet. */
  renderCoins() {
    $('gadgetInfo').innerHTML = `You have ${coinTag(coins.balance)} · spend them on divers, upgrades and gadgets.`;
    $('gadgetInfo').classList.remove('warn');
    $('shopList').innerHTML = lagosRows(LAGOS_PRODUCTS.filter(p => (p.coins || p.doubler) && !(p.doubler && lagos.doubler)));
    bindLagosBuys(() => this.renderCoins());
  },

  /**
   * Out of lives: "Save me?" with a five-second countdown. Resolves 'shell' if the player spends Sea
   * Hearts to keep diving (the scene spends them), 'ad' once they've watched a rewarded ad to the end,
   * or null if they decline or time runs out. `ad` (if offered) shows its button once an ad is ready;
   * without Sea Hearts enough and no ad, the screen closes straight away.
   */
  saveMe(reason: string, cost: number, have: number, ad: Promise<ShowAd | null> | null): Promise<'shell' | 'ad' | null> {
    this.screen('saveme');
    const canPay = have >= cost;
    $('savemeYes').hidden = !canPay;
    $('savemeAd').hidden = true;
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
        else done(null);
      }, 1000);
      let over = false;
      const done = (choice: 'shell' | 'ad' | null) => {
        if (over) return;
        over = true;
        clearInterval(tick);
        $('savemeYes').onclick = $('savemeNo').onclick = $('savemeAd').onclick = null;
        if (choice) this.screen(null);
        resolve(choice);
      };
      $('savemeYes').onclick = () => { buzz(10); done('shell'); };
      $('savemeNo').onclick = () => { buzz(6); done(null); };
      void (ad ?? Promise.resolve(null)).then(show => {
        if (over) return;
        if (!show) { if (!canPay) done(null); return; }
        $('savemeAd').hidden = false;
        $('savemeAd').onclick = () => {
          buzz(10);
          clearInterval(tick); // the countdown stops while the ad plays
          ring.style.animationPlayState = 'paused';
          void show().then(watched => done(watched ? 'ad' : null));
        };
      });
    });
  },

  showOver(o: {
    depth: number; reason: string; zone: string; best: number; isBest: boolean; pearls: number;
    close: string; results: MissionResult[]; earned: { label: string; n: number }[]; rankUp: RankUp | null;
    /** A cave this dive opened, if any. */
    opened: string | null;
    /** Treasure chests found this dive (already paid out), shut until tapped. */
    chests: ChestPrize[];
    /** The weekly Pearl Hunt: pearls counted before this dive, and prizes it just won. */
    hunt: { before: number; won: HuntPrize[] };
    /** It was today's Daily Dive (its own best and board). */
    daily: boolean;
    /** Daily missions after this dive, and the booster if all three just got done. */
    today: { results: DailyResult[]; bonus: BoosterId | null };
    /** Divers this dive earned (their goal was just reached). */
    newDivers: string[];
    /** Coins the dive itself paid (not missions): a rewarded ad can pay them again. 0: no offer. */
    adCoins: number;
  }) {
    diveEnded = true;
    store.set('divesDone', store.get('divesDone', 0) + 1);
    const stars = STAR_DEPTHS.filter(d => o.depth >= d).length;
    $('stars').innerHTML = STAR_DEPTHS.map((_, i) => STAR_SVG.replace('class="k-star"', `class="k-star${i < stars ? ' on' : ''}"`)).join('');
    $('overDepth').textContent = o.depth.toLocaleString();
    $('overReason').textContent = `${o.reason} · ${o.zone}`;
    // Not a record: show the best to beat and how far off it was.
    $('overBest').hidden = o.isBest || o.best <= 0;
    $('overBest').innerHTML = `${icon('trophy')}${o.daily ? 'Today’s best' : 'Best'} <b>${o.best.toLocaleString()} m</b>`
      + (o.best > o.depth ? `<small>${(o.best - o.depth).toLocaleString()} m to go</small>` : '');
    $('overRibbon').textContent = o.daily ? (o.isBest ? 'Today’s best!' : 'Daily Dive') : o.isBest ? 'New Record!' : 'Game Over';
    // Daily missions finished by this dive (and the all-three booster).
    const fresh = o.today.results.filter(r => r.justDone);
    $('overToday').hidden = !fresh.length;
    $('overToday').innerHTML = fresh.map(r => `<span>${icon('star')}Daily: ${r.mission.text} ${coinTag(r.mission.reward)}</span>`).join('')
      + (o.today.bonus ? `<span class="over-today-bonus">${icon('gift')}All three done: +1 ${boosterById(o.today.bonus).name}</span>` : '');
    $('overClose').hidden = !o.close;
    $('overClose').textContent = o.close;
    renderEarned($('overEarned'), o.earned);
    renderChests($('overChests'), o.chests);
    offerDoubleCoins(o.adCoins);
    renderMissions($('overMissions'), [], o.results);
    const gained = hunt.pearls - o.hunt.before;
    $('overHunt').hidden = gained <= 0 && !o.hunt.won.length;
    $('overHunt').innerHTML = huntHead() + huntBar(gained)
      + (o.hunt.won.length ? `<span class="hunt-won">${icon('star')}Pearl Hunt prize: ${o.hunt.won.map(prizeTag).join(' ')}</span>` : '');
    // A new record is the moment guests care most about losing progress (Subway Surfers asks here too).
    $('saveNudge').hidden = !(cloud.enabled && cloud.account.guest && o.isBest && o.depth >= 150);
    const up = $('overRankUp');
    up.hidden = !o.rankUp && !o.newDivers.length;
    if (o.rankUp) {
      const unlocked = SKINS.find(d => d.rank === o.rankUp!.rank);
      up.innerHTML = `Rank up! You're rank ${o.rankUp.rank}: coin bonus ×${deepMissions.bonus.toFixed(1)}${unlocked ? ` and <b>${unlocked.name}</b> unlocked` : ''}`;
    } else if (o.newDivers.length) up.innerHTML = `New diver earned: <b>${o.newDivers.join('</b> and <b>')}</b>! Wear them from Divers.`;
    $('overCave').hidden = !o.opened;
    if (o.opened) $('overCave').innerHTML = `New cave unlocked: <b>${o.opened}</b>! Pick it on the title screen.`;
    this.hud(false);
    this.screen('over');
  },

  /** Worldwide rank for the dive just finished (null hides it). */
  setRank(rank: number | null, isBest = false, daily = false) {
    const el = $('overRank');
    el.hidden = !rank;
    if (rank) el.textContent = daily ? `#${rank.toLocaleString()} in today’s Daily Dive` : `${isBest ? 'Your new best ranks' : 'This dive ranks'} #${rank.toLocaleString()} worldwide`;
  },

  setDepth(m: number) {
    if (m === shownDepth) return;
    shownDepth = m;
    $('depth').textContent = m.toLocaleString();
    if (m > 0 && m % 100 === 0) bump($('depthPill'));
  },

  /** `passed`: the dive is past the best, so the pill counts the new record live and glows. No best yet: no pill. */
  setBest(m: number, passed = false) {
    $('hudBest').textContent = m.toLocaleString();
    $('hudBestPill').classList.toggle('passed', passed);
    $('hudBestPill').hidden = m <= 0;
  },

  setPearls(n: number) {
    $('runPearls').textContent = String(n);
    if (n > 0) bump($('pearlPill'));
  },

  /** `max` (at the start of a dive) sets how many lives are drawn: a first dive has extra. */
  setHearts(n: number, max?: number) {
    const hearts = $('hearts');
    if (max) {
      const all = hearts.querySelectorAll('svg');
      for (let i = all.length; i < max; i++) hearts.append(all[0].cloneNode(true));
      for (let i = all.length - 1; i >= max; i--) all[i].remove();
      hearts.querySelectorAll('svg').forEach(el => el.classList.remove('lost', 'shake'));
    }
    hearts.setAttribute('aria-label', `${n} li${n === 1 ? 'fe' : 'ves'} left`);
    hearts.querySelectorAll('svg').forEach((el, i) => {
      const was = !el.classList.contains('lost');
      el.classList.toggle('lost', i >= n);
      if (was && i >= n) { el.classList.remove('shake'); void (el as unknown as HTMLElement).offsetWidth; el.classList.add('shake'); }
    });
  },

  /** The special button: the diver's face in a ring that fills as pearls charge the meter. */
  setSpecial(diver: string, s: Special, charge: number, active: boolean) {
    const btn = $('specialBtn');
    if (shownSpecial !== diver) {
      shownSpecial = diver;
      ($('specialImg') as HTMLImageElement).src = portraits[`diver-${diver}`] ?? '';
      $('specialName').textContent = s.name;
      btn.setAttribute('aria-label', `${s.name}: ${s.text}`);
    }
    $('specialFill').style.strokeDashoffset = String(176 * (1 - Math.max(0, Math.min(1, charge))));
    const ready = charge >= 1 && !active;
    if (ready && !btn.classList.contains('ready')) bump(btn);
    btn.classList.toggle('ready', ready);
    btn.classList.toggle('active', active);
  },

  /** Booster chips at the start of a dive (null or empty hides them). */
  setBoosters(list: Booster[] | null) {
    const bar = $('boosterBar');
    bar.hidden = !list?.length;
    if (!list?.length) return;
    const fresh = bar.dataset.open !== '1';
    bar.dataset.open = '1';
    bar.innerHTML = list.map(b => `<button class="booster-chip" type="button" data-booster="${b.id}" aria-label="Use ${b.name} (${boosters.count(b.id)} left)" title="${b.name}">
      <img src="${portraits[b.icon] ?? ''}" alt=""><em>${boosters.count(b.id)}</em></button>`).join('')
      + `<span class="booster-timer" style="animation-duration:${BOOSTER_WINDOW}s"></span>`;
    if (!fresh) (bar.querySelector('.booster-timer') as HTMLElement).style.animation = 'none';
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

  /** First-dive guide: the half of the screen to hold (or the arrow key), one direction at a time. */
  guide(on: boolean) {
    const g = $('guide');
    g.hidden = !on;
    clearTimeout(guideTimer);
    guideLeft = on ? 3 : 0;
    guideHeld = 0;
    if (!on) return;
    coachQueue = [];
    coachSeen = new Set();
    this.coach(null);
    const keys = !isTouch(), p = portrait();
    g.classList.toggle('touch', !keys);
    g.querySelectorAll<HTMLElement>('.guide-zone').forEach(z => {
      const up = z.dataset.dir === 'up';
      z.classList.remove('on', 'done', 'pressing');
      z.style.setProperty('--fill', '0');
      // In portrait the world is turned 90°, heading up the screen: "up" is the left half and the ← key.
      z.querySelector('.guide-key')!.textContent = p ? (up ? '←' : '→') : up ? '↑' : '↓';
      z.querySelector('.guide-say')!.textContent = keys
        ? (p ? (up ? 'Hold to steer left' : 'Hold to steer right') : up ? 'Hold to swim up' : 'Hold to go down')
        : p ? (up ? 'Hold here to steer left' : 'Hold here to steer right') : up ? 'Hold here to swim up' : 'Hold here to go down';
    });
    guideZone(1).classList.add('on');
  },
  /** Called every frame with the steering (+1 up, -1 down, 0 none). Returns true once both directions are learned. */
  guidePress(dir: number, dt: number): boolean {
    if (!guideLeft) return false;
    const bit = dir > 0 ? 1 : dir < 0 ? 2 : 0;
    $('guide').querySelectorAll('.guide-zone').forEach(z => z.classList.remove('pressing'));
    // Holding either half counts, even the one not asked for yet.
    if (!(bit & guideLeft)) { guideHeld = 0; showFill(); return false; }
    const zone = guideZone(bit);
    if (!zone.classList.contains('on')) {
      $('guide').querySelectorAll('.guide-zone.on').forEach(z => { z.classList.remove('on'); (z as HTMLElement).style.setProperty('--fill', '0'); });
      zone.classList.add('on');
      guideHeld = 0;
    }
    zone.classList.add('pressing');
    guideHeld += dt;
    showFill();
    if (guideHeld < GUIDE_HOLD) return false;
    buzz(12);
    sfx.unlock();
    zone.classList.replace('on', 'done');
    zone.classList.remove('pressing');
    guideLeft &= ~bit;
    guideHeld = 0;
    if (guideLeft) { guideZone(guideLeft).classList.add('on'); return false; }
    return true;
  },
  /** Steering learned (or time ran out): let the ticks show, then hand over to the coach tips. */
  guideDone() {
    guideLeft = 0;
    clearTimeout(guideTimer);
    guideTimer = window.setTimeout(() => { $('guide').hidden = true; pumpCoach(); }, 900);
  },
  /** A coach tip pointing at a HUD element: queued, each shown once per dive. `null` clears them. */
  coach(tip: { id: string; target: string; text: string } | null) {
    if (!tip) {
      clearTimeout(coachTimer);
      coachQueue = [];
      $('coach').hidden = true;
      document.querySelectorAll('.coach-target').forEach(e => e.classList.remove('coach-target'));
      return;
    }
    if (coachSeen.has(tip.id)) return;
    coachSeen.add(tip.id);
    coachQueue.push(tip);
    pumpCoach();
  },
};

/** The leaderboard screen: top divers, plus your own row when you're further down. */
/** The leaderboard: all time (Reef Trench), or today's Daily Dive. */
async function openBoard(today = false) {
  ui.screen('board');
  if (lagos.on) { void openLagosBoard(); return; }
  document.querySelectorAll<HTMLButtonElement>('[data-board]').forEach(b => b.setAttribute('aria-selected', String((b.dataset.board === 'today') === today)));
  const list = $('boardList'), status = $('boardStatus');
  ($('nameInput') as HTMLInputElement).value = cloud.name;
  status.textContent = 'Loading…';
  status.hidden = false;
  list.replaceChildren();
  const day = today ? dailyRun.day : undefined, best = today ? dailyRun.best : topBest();
  const [top, rank] = await Promise.all([cloud.top(20, day), cloud.rank(best, day)]);
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

/** Inside Lagos Life, "Top divers" is their leaderboard: Lagos Life players, by best depth. */
async function openLagosBoard() {
  const list = $('boardList'), status = $('boardStatus');
  status.textContent = 'Loading…';
  status.hidden = false;
  list.replaceChildren();
  const rows = await lagos.board();
  if (!rows) { status.textContent = 'Can’t reach the leaderboard right now.'; return; }
  status.hidden = rows.length > 0;
  status.textContent = 'No dives yet. Be the first!';
  rows.forEach((r, i) => {
    if (i > 0 && r.me && typeof r.rank === 'string') { const gap = document.createElement('li'); gap.className = 'gap'; gap.textContent = '…'; list.append(gap); }
    const li = document.createElement('li');
    li.className = r.me ? 'me' : '';
    const rank = document.createElement('span'); rank.className = 'board-rank'; rank.textContent = String(r.rank).replace(/^#/, '');
    const who = document.createElement('span'); who.className = 'board-who'; who.textContent = r.me ? `${r.name} (you)` : r.name;
    const d = document.createElement('b'); d.textContent = `${r.score.toLocaleString()} m`;
    li.append(rank, who, d);
    list.append(li);
  });
}

function renderAccount(message = '') {
  // Dev mode: only for the dev server and the developer's account (see core/dev.ts).
  $('devToggle').hidden = !dev.allowed;
  ($('devMode') as HTMLInputElement).checked = dev.on;
  document.body.classList.toggle('dev-mode', dev.on);
  $('account').hidden = !cloud.enabled;
  const a = cloud.account;
  $('accountStatus').textContent = message || (a.guest
    ? 'You\u2019re playing as a guest, so your progress lives in this browser only. Sign in with Google to keep it safe, play on any device and get a free Sea Heart.'
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
  $('signupGift').innerHTML = `+${shellTag(SIGNUP_GIFT)}`;
  $('accountStatus').classList.toggle('ok', !!message);
  $('accountGuest').hidden = !a.guest || !$('accountConflict').hidden;
  $('signOutBtn').hidden = a.guest;
  $('signOutBtn').textContent = 'Sign out';
  $('accountError').hidden = true;
}
/** A sign-in message, plus the sign-up shell when this account hasn't had it yet (`given`: already paid). */
function giftNote(text: string, given = false) {
  return given || claimSignupGift() ? `${text} Here’s a free Sea Heart for signing up.` : text;
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
  // Another character's outfits only count once you have that character.
  const c = charOf(s);
  if (s.id !== c.base && !charOwned(c)) return false;
  const available = s.rank ? !rankLocked(s, rank) : canAfford(s, coins.balance);
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
function guideZone(bit: number) {
  return $('guide').querySelector<HTMLElement>(`.guide-zone[data-dir="${bit & 1 ? 'up' : 'down'}"]`)!;
}
function showFill() {
  const on = $('guide').querySelector<HTMLElement>('.guide-zone.on');
  on?.style.setProperty('--fill', String(Math.min(1, guideHeld / GUIDE_HOLD)));
}
/** Show the next coach tip, if nothing else is on screen. */
function pumpCoach() {
  const box = $('coach');
  if (!box.hidden || !$('guide').hidden || $('hud').hidden) return;
  const tip = coachQueue.shift();
  if (!tip) return;
  const target = $(tip.target);
  const r = target.getBoundingClientRect();
  if (!r.width) { pumpCoach(); return; } // hidden target: skip it
  // In the HUD's middle stack (air bar over lives), sit below the whole stack so neither is covered.
  const stack = target.closest('.hud-mid')?.getBoundingClientRect();
  $('coachText').textContent = tip.text;
  box.hidden = false;
  // Below the target, or above it when it's in the lower half; the arrow points at its centre.
  const w = box.offsetWidth, h = box.offsetHeight, cx = r.left + r.width / 2;
  const left = Math.max(16, Math.min(innerWidth - w - 16, cx - w / 2));
  const above = r.top > innerHeight / 2;
  box.classList.toggle('above', above);
  box.style.left = `${left}px`;
  box.style.top = `${above ? r.top - h - 16 : Math.max(r.bottom, stack?.bottom ?? 0) + 16}px`;
  box.style.setProperty('--ax', `${cx - left}px`);
  target.classList.remove('coach-target');
  void target.offsetWidth;
  target.classList.add('coach-target');
  clearTimeout(coachTimer);
  coachTimer = window.setTimeout(() => {
    box.hidden = true;
    target.classList.remove('coach-target');
    coachTimer = window.setTimeout(pumpCoach, 400);
  }, 4200);
}

function enterFullscreen() {
  if (!isTouch() || !document.fullscreenEnabled || document.fullscreenElement) return;
  document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
}

function lockLandscape() {
  try {
    const doLock = () => { (screen.orientation as any).lock?.('landscape')?.catch?.(() => {}); };
    if (document.fullscreenElement) doLock();
    else document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })?.then(doLock).catch(() => doLock());
  } catch { /* unsupported */ }
}
function unlockOrientation() {
  try { (screen.orientation as any).unlock?.(); } catch { /* unsupported */ }
}
