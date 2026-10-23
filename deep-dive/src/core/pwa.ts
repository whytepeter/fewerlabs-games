import { registerSW } from 'virtual:pwa-register';
import { icon } from './icons';

/**
 * Service worker registration with an update prompt, shared by every page.
 *
 * A new version downloads in the background and waits. A small banner offers to switch to it
 * ("Update" reloads into it); dismissing it is fine, the new version is used on the next launch.
 * Installed apps can stay open for days, so we also check for updates when the app comes back
 * to the foreground and once an hour.
 */

const CHECK_EVERY = 60 * 60 * 1000;

export function initPWA() {
  if (!('serviceWorker' in navigator)) return;

  const updateSW = registerSW({
    onNeedRefresh() { showBanner(() => void updateSW(true)); },
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => { if (navigator.onLine) void reg.update().catch(() => {}); };
      setInterval(check, CHECK_EVERY);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    },
  });
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
