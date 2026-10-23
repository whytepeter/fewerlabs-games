import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '../core/kit.css';
import './hub.css';
import { icon, wobbleLetters } from '../core/icons';
import { initPWA } from '../core/pwa';

wobbleLetters(document.getElementById('logo')!);

// Show each game's best score. Games save under "<game>:best" (see core/settings.ts).
document.querySelectorAll<HTMLElement>('[data-game]').forEach(card => {
  let best = 0;
  try { best = Number(JSON.parse(localStorage.getItem(`${card.dataset.game}:best`) ?? '0')) || 0; } catch { /* storage unavailable */ }
  const el = card.querySelector('.best');
  if (el && best > 0) el.innerHTML = `${icon('trophy')}${best.toLocaleString()}${card.dataset.unit ? ' ' + card.dataset.unit : ''}`;
});

// Install prompt: a button where the browser offers one (Android/desktop Chrome), a hint on iOS.
type InstallEvent = Event & { prompt(): Promise<void> };
const box = document.getElementById('install')!;
const btn = document.getElementById('installBtn') as HTMLButtonElement;
const standalone = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

if (!standalone && ios) {
  box.hidden = false;
  document.getElementById('installText')!.textContent = 'Tip: tap Share, then "Add to Home Screen" to play offline, full screen.';
}
addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  const evt = e as InstallEvent;
  box.hidden = false;
  btn.hidden = false;
  btn.onclick = () => { void evt.prompt(); box.hidden = true; };
});

initPWA();
