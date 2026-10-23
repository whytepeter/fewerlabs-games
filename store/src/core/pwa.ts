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
  if (document.getElementById('update')) return;
  const el = document.createElement('div');
  el.id = 'update';
  el.className = 'update';
  el.setAttribute('role', 'status');
  el.innerHTML = `
    ${icon('download')}<span>A new version is ready</span>
    <button class="btn btn-sm btn-primary" type="button" data-go>Update</button>
    <button class="btn btn-sm btn-icon" type="button" data-later aria-label="Later">${icon('close')}</button>`;
  el.querySelector<HTMLButtonElement>('[data-go]')!.addEventListener('click', () => {
    el.classList.add('busy');
    update();
  });
  el.querySelector<HTMLButtonElement>('[data-later]')!.addEventListener('click', () => el.remove());
  document.body.appendChild(el);
}
