import '@fontsource-variable/inter';
import './style.css';
import { gameById } from './catalog';
import { gamePage, homePage, type Page } from './pages';
import { openPlayer } from './player';
import { icon } from './core/icons';
import { initPWA } from './core/pwa';
import { profile } from './profile';

/**
 * A tiny router over real URLs: "/" (store front), "/game/<id>" (details) and "/play/<id>"
 * (the game, embedded). Links marked data-link navigate without a page load; the browser's
 * back button and the phone back gesture work as expected.
 */

const app = document.getElementById('app')!;
let cleanup: (() => void) | null = null;

function render() {
  cleanup?.();
  cleanup = null;
  const [, section, id] = location.pathname.split('/');
  const game = id ? gameById(id) : undefined;

  // Games that can't be embedded live on their own site.
  if (section === 'play' && game?.external) {
    profile.opened(game.id);
    location.replace(game.url);
    return;
  }
  if (section === 'play' && game) {
    document.title = `Playing ${game.title} · Fewer Labs Games`;
    app.innerHTML = '';
    cleanup = openPlayer(game, () => (history.state?.fromStore ? history.back() : go('/', true)));
    return;
  }

  let page: Page;
  if (!section) page = homePage();
  else if (section === 'game' && game) page = gamePage(game);
  else page = { title: 'Not found · Fewer Labs Games', html: `<div class="wrap notfound"><h1>Page not found</h1><p>This page doesn't exist, but the games do.</p><a class="btn btn-primary" href="/" data-link>Browse games</a></div>` };

  document.title = page.title;
  app.innerHTML = page.html;
  document.querySelectorAll<HTMLElement>('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === page.nav));
  document.body.classList.toggle('home', page.nav === 'home');
  cleanup = page.mount?.(app) ?? null;
  const target = location.hash && document.getElementById(location.hash.slice(1));
  if (target) target.scrollIntoView();
  else window.scrollTo(0, 0);
}

function go(path: string, replace = false) {
  if (replace) history.replaceState({}, '', path);
  else history.pushState({ fromStore: true }, '', path);
  render();
}

document.addEventListener('click', e => {
  const out = (e.target as HTMLElement).closest<HTMLElement>('[data-opens]');
  const opened = out && gameById(out.dataset.opens!);
  if (opened) profile.opened(opened.id);
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-link]');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  if (a.pathname === location.pathname && a.hash) {
    history.replaceState(history.state, '', a.pathname + a.hash);
    document.getElementById(a.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  } else if (a.pathname + a.hash !== location.pathname + location.hash) go(a.pathname + a.hash);
});
addEventListener('popstate', render);

// On the home page the top bar floats over the billboard and turns solid once you scroll.
const topbar = document.querySelector<HTMLElement>('.topbar')!;
const syncTopbar = () => topbar.classList.toggle('solid', scrollY > 40);
addEventListener('scroll', syncTopbar, { passive: true });
syncTopbar();

// Install button where the browser offers one (Android / desktop Chrome).
type InstallEvent = Event & { prompt(): Promise<void> };
const installBtn = document.getElementById('installBtn') as HTMLButtonElement;
installBtn.innerHTML = `${icon('download')}Install`;
addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installBtn.hidden = false;
  installBtn.onclick = () => { void (e as InstallEvent).prompt(); installBtn.hidden = true; };
});

render();
initPWA();
