import { registerSW } from 'virtual:pwa-register';
import { icon } from './icons';

/**
 * Service worker registration with an update prompt, and the install prompt's plumbing.
 *
 * Updates: a new version downloads in the background and waits. A small banner offers to switch to
 * it ("Update" reloads into it); dismissing it is fine, the new version is used on the next launch.
 * Installed apps can stay open for days, so we also check when the app comes back to the
 * foreground and once an hour. While `busy()` says a run is on, the banner waits until it's over.
 *
 * Install: Chrome and friends hand us a deferred install dialog (beforeinstallprompt); iPhone and
 * iPad Safari can only install through Share → Add to Home Screen, so the game explains that instead.
 */

const CHECK_EVERY = 60 * 60 * 1000;

export function initPWA(opts: { busy?: () => boolean } = {}) {
  if (!('serviceWorker' in navigator)) return;

  const updateSW = registerSW({
    onNeedRefresh() { whenFree(opts.busy, () => showBanner(() => void updateSW(true))); },
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => { if (navigator.onLine) void reg.update().catch(() => {}); };
      setInterval(check, CHECK_EVERY);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    },
  });
}

/** Run `fn` now, or as soon as `busy` stops returning true. */
function whenFree(busy: (() => boolean) | undefined, fn: () => void) {
  if (!busy?.()) { fn(); return; }
  const t = setInterval(() => { if (!busy()) { clearInterval(t); fn(); } }, 1000);
}

function showBanner(update: () => void) {
  if (document.getElementById('k-update')) return;
  const el = document.createElement('div');
  el.id = 'k-update';
  el.className = 'k-update k-scale';
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <span class="k-update-icon">${icon('star')}</span>
    <span class="k-update-text">New version ready</span>
    <button class="k-btn k-btn--sm k-update-go" type="button">Update</button>
    <button class="k-update-close" type="button" aria-label="Later">${icon('close')}</button>`;
  el.querySelector<HTMLButtonElement>('.k-update-go')!.addEventListener('click', () => {
    el.classList.add('busy');
    update();
  });
  el.querySelector<HTMLButtonElement>('.k-update-close')!.addEventListener('click', () => el.remove());
  document.body.appendChild(el);
}

/* ---------- Install */

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPrompt | null = null;
let installed = false;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach(fn => fn());

// Chrome fires this early, so listen from module load rather than from a screen.
addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); // no mini-infobar; the game offers its own
  deferred = e as InstallPrompt;
  changed();
});
addEventListener('appinstalled', () => { deferred = null; installed = true; changed(); });

/** Already running as an installed app. */
export const isInstalled = () =>
  installed
  || matchMedia('(display-mode: standalone)').matches
  || matchMedia('(display-mode: fullscreen)').matches
  || (navigator as { standalone?: boolean }).standalone === true;

/** iPhone/iPad Safari, which installs through Share → Add to Home Screen only. */
export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/**
 * How this browser can install the app right now: 'prompt' (we can show the install dialog),
 * 'ios' (explain Add to Home Screen) or null (installed, or not possible here).
 */
export function installMode(): 'prompt' | 'ios' | null {
  if (isInstalled()) return null;
  if (deferred) return 'prompt';
  return isIOS() ? 'ios' : null;
}

/** Called whenever installMode() may have changed. */
export function onInstallChange(fn: () => void) { listeners.add(fn); }

/** Show the browser's install dialog. Resolves true when the player accepted. */
export async function install() {
  const p = deferred;
  if (!p) return false;
  deferred = null;
  await p.prompt();
  const { outcome } = await p.userChoice;
  changed();
  return outcome === 'accepted';
}
