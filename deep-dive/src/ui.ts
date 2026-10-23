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
}

/** Depths that earn 1, 2 and 3 stars: reaching the Twilight Zone, Midnight Zone and the Abyss. */
export const STAR_DEPTHS = [150, 400, 750];

const SCREENS = ['title', 'pause', 'over', 'board', 'divers', 'missions', 'shop', 'settings'] as const;
type Screen = (typeof SCREENS)[number] | null;
/** Menus reached from the title; Back (or Escape) returns to it. */
const SUB = new Set<Screen>(['board', 'divers', 'missions', 'shop', 'settings']);
const LABELS: Record<keyof Settings, string> = { sound: 'Sound', music: 'Music', haptics: 'Vibration' };
const portrait = () => matchMedia('(orientation: portrait)').matches;

let shownDepth = -1;
let o2Low = false;
let lowShown = false;
let shownPerk: string | null = null;
let toastTimer = 0;
let hintTimer = 0;
let onSkin: (id: string) => boolean = () => false;
let viewed = 0;      // index of the diver shown on the Divers screen
let wearing = 'classic';
let bestShown = 0;
let shopTab: 'upgrades' | 'gadgets' = 'upgrades';
/** Divers and upgrades the player had already seen as affordable/unlocked (for the "New" dots). */
const seen = new Set<string>(store.get<string[]>('seen', []));

/** Click handler with the usual tap sound and buzz. */
const onTap = (id: string, fn: () => void) =>
  $(id).addEventListener('click', () => { sfx.unlock(); buzz(6); fn(); });
const coinTag = (n: number) => `${coinIcon()}${n.toLocaleString()}`;
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
    hydrateIcons();
    wobbleLetters($('logo'));
    mountCoins();
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
    on('boardBtn', () => void openBoard());
    on('boardBack', () => this.back());
    on('showcase', () => this.openDivers());
    on('diversBtn', () => this.openDivers());
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

    const syncOrientation = () => {
      // Touch the side you want to move toward: left/right in portrait (the dive runs down the screen), top/bottom in landscape.
      $('howHold').textContent = 'Touch';
      $('howHoldText').textContent = portrait() ? 'left / right to steer' : 'top / bottom to steer';
      $('hintText').textContent = portrait() ? 'Touch left or right to steer' : 'Touch the top to swim up, the bottom to go down';
    };
    syncOrientation();
    matchMedia('(orientation: portrait)').addEventListener('change', syncOrientation);
  },

  isOpen(name: Exclude<Screen, null>) { return !$(name).hidden; },

  /** A text field has focus. */
  typing() { return document.activeElement instanceof HTMLInputElement; },

  screen(name: Screen) {
    for (const id of SCREENS) $(id).hidden = id !== name;
    // No update banner mid-dive (playing or paused); it shows once the dive is over.
    holdUpdates(name === null || name === 'pause');
    if (name) { $('banner').classList.remove('show'); $('toast').classList.remove('show'); }
  },

  hud(visible: boolean) {
    $('hud').hidden = !visible;
    if (!visible) { this.lowO2(false); this.hint(false); }
  },

  showTitle(best: number, skin: string) {
    bestShown = best;
    wearing = skin;
    // First-timers see how to play above the Dive button.
    $('howto').hidden = store.get('learned', false);
    $('boardBtn').hidden = !cloud.enabled;
    this.refreshTitle();
    this.hud(false);
    this.screen('title');
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
    $('titleBest').textContent = bestShown.toLocaleString();
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

  /** Settings > Your progress: link the guest to Google or email, switch accounts, sign out. */
  initAccount() {
    const run = async (fn: () => Promise<LinkResult>) => {
      setBusy(true);
      const r = await fn();
      setBusy(false);
      if (r === 'linked') { cheer(true); renderAccount('Saved! Your progress now follows your account.'); }
      else if (r === 'exists') showConflict(true);
      else if (r !== 'redirect') accountError(r.error);
    };
    onTap('googleBtn', () => void run(() => cloud.linkGoogle()));
    onTap('emailBtn', () => { $('emailForm').hidden = !$('emailForm').hidden; if (!$('emailForm').hidden) $('emailInput').focus(); });
    $('emailForm').addEventListener('submit', e => {
      e.preventDefault();
      const mode = ((e as SubmitEvent).submitter as HTMLButtonElement | null)?.dataset.mode === 'signin' ? 'signin' : 'create';
      const email = ($('emailInput') as HTMLInputElement).value, pass = ($('passInput') as HTMLInputElement).value;
      void run(() => cloud.linkEmail(email, pass, mode));
    });
    onTap('useAccountBtn', () => void (async () => {
      setBusy(true);
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

  showOver(o: {
    depth: number; reason: string; zone: string; best: number; isBest: boolean; pearls: number;
    close: string; results: MissionResult[]; earned: { label: string; n: number }[]; rankUp: RankUp | null;
  }) {
    const stars = STAR_DEPTHS.filter(d => o.depth >= d).length;
    $('stars').innerHTML = STAR_DEPTHS.map((_, i) => STAR_SVG.replace('class="k-star"', `class="k-star${i < stars ? ' on' : ''}"`)).join('');
    $('overDepth').textContent = o.depth.toLocaleString();
    $('overReason').textContent = `${o.reason} · ${o.zone}`;
    $('overRibbon').textContent = o.isBest ? 'New Record!' : 'Game Over';
    $('overBest').hidden = !o.isBest;
    $('overClose').hidden = !o.close;
    $('overClose').textContent = o.close;
    renderEarned($('overEarned'), o.earned);
    renderMissions($('overMissions'), [], o.results);
    // A new record is the moment guests care most about losing progress (Subway Surfers asks here too).
    $('saveNudge').hidden = !(cloud.enabled && cloud.account.guest && o.isBest && o.depth >= 150);
    const up = $('overRankUp');
    up.hidden = !o.rankUp;
    if (o.rankUp) {
      const unlocked = SKINS.find(d => d.rank === o.rankUp!.rank);
      up.innerHTML = `Rank up! You're rank ${o.rankUp.rank}: coin bonus ×${deepMissions.bonus.toFixed(1)}${unlocked ? ` and <b>${unlocked.name}</b> unlocked` : ''}`;
    }
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

  banner(text: string, label = 'Entering') {
    const el = $('banner');
    $('bannerLabel').textContent = label;
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
    ? 'You\u2019re playing as a guest, so your progress lives in this browser only. Save it to an account to keep it safe and play on any device.'
    : `Saved to ${a.email ?? 'your account'}${a.provider === 'google' ? ' (Google)' : ''}. Sign in with it on any device to pick up where you left off.`);
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
function setBusy(on: boolean) {
  $('account').querySelectorAll('button').forEach(b => { (b as HTMLButtonElement).disabled = on; });
  $('account').classList.toggle('busy', on);
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
