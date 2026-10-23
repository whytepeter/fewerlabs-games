import { GAMES, featuredGame, gameById, iconUrl, shot, type Game } from './catalog';
import { profile } from './profile';
import { icon } from './core/icons';

/** Home and game-detail pages. Each returns HTML plus an optional hook that runs once mounted. */
export interface Page { html: string; title: string; nav?: string; mount?(root: HTMLElement): () => void }

const fmt = (n: number, unit: string) => `${n.toLocaleString()}${unit ? ` ${unit}` : ''}`;
const host = (g: Game) => { try { return new URL(g.url).hostname.replace(/^www\./, ''); } catch { return ''; } };

/** A Play link: embedded games open in the store's player, external ones on their own site. */
function playLink(g: Game, cls: string, label = 'Play') {
  return g.external
    ? `<a class="${cls}" href="${g.url}" target="_blank" rel="noopener" data-opens="${g.id}">${label}${icon('external')}</a>`
    : `<a class="${cls}" href="/play/${g.id}" data-link>${label}</a>`;
}

const DWELL = 8000;

/** A small square-ish tile in a sideways row: the art links to details, the round button plays. */
function tile(g: Game) {
  const s = profile.stats(g.id);
  return `<article class="tile">
    <a class="tile-link" href="/game/${g.id}" data-link aria-label="${g.title}">
      <img class="tile-art" src="${shot(g, 'hero-wide')}" alt="" loading="lazy" width="1600" height="900" />
      <span class="tile-info">
        <img class="app-icon" src="${iconUrl(g)}" alt="" width="40" height="40" />
        <span><b>${g.title}</b><small>${s.best > 0 ? `${icon('trophy')}${fmt(s.best, g.unit)}` : g.tags.slice(0, 2).join(' · ')}</small></span>
      </span>
    </a>
    ${g.external
      ? `<a class="tile-play" href="${g.url}" target="_blank" rel="noopener" data-opens="${g.id}" aria-label="Play ${g.title} on ${host(g)}">${icon('play')}</a>`
      : `<a class="tile-play" href="/play/${g.id}" data-link aria-label="Play ${g.title}">${icon('play')}</a>`}
  </article>`;
}

/** A sideways-scrolling row of tiles with arrow buttons on wide screens. Rows with no games are skipped. */
export function rail(title: string, games: Game[], id = '') {
  if (!games.length) return '';
  return `<section class="rail"${id ? ` id="${id}"` : ''}>
    <h2 class="rail-title">${title}</h2>
    <div class="rail-wrap">
      <button class="rail-arrow prev" type="button" aria-label="Scroll left" hidden>${icon('back')}</button>
      <div class="rail-track">${games.map(tile).join('')}</div>
      <button class="rail-arrow next" type="button" aria-label="Scroll right" hidden>${icon('next')}</button>
    </div>
  </section>`;
}

/** Wire the arrows on every row: they only show when the row overflows. */
export function mountRails(root: HTMLElement) {
  const offs: (() => void)[] = [];
  root.querySelectorAll<HTMLElement>('.rail-wrap').forEach(wrap => {
    const track = wrap.querySelector<HTMLElement>('.rail-track')!;
    const prev = wrap.querySelector<HTMLElement>('.prev')!, next = wrap.querySelector<HTMLElement>('.next')!;
    const sync = () => {
      prev.hidden = track.scrollLeft < 8;
      next.hidden = track.scrollLeft + track.clientWidth > track.scrollWidth - 8;
    };
    prev.onclick = () => track.scrollBy({ left: -track.clientWidth * .85, behavior: 'smooth' });
    next.onclick = () => track.scrollBy({ left: track.clientWidth * .85, behavior: 'smooth' });
    track.addEventListener('scroll', sync, { passive: true });
    addEventListener('resize', sync);
    offs.push(() => removeEventListener('resize', sync));
    sync();
  });
  return () => offs.forEach(f => f());
}

/** One billboard slide: full-bleed gameplay art, or a framed poster over a blurred copy of itself. */
function slide(g: Game, i: number) {
  const lazy = i === 0 ? '' : 'loading="lazy"';
  const art = g.poster
    ? `<div class="slide-blur" style="background-image:url(${shot(g, 'hero-wide')})"></div>
       <a class="slide-poster" href="/game/${g.id}" data-link tabindex="-1" aria-hidden="true"><img src="${shot(g, 'hero-wide')}" alt="" width="1200" height="630" ${lazy} /></a>`
    : `<picture class="slide-bg">
        <source media="(max-width: 640px)" srcset="${shot(g, 'hero-tall')}" />
        <img src="${shot(g, 'hero-wide')}" alt="" ${lazy} />
      </picture>`;
  const meta = [
    g.featured ? '<b class="tag-new">Featured</b>' : '',
    '<span>Free</span>',
    ...g.tags.map(t => `<span>${t}</span>`),
    g.external ? `<span class="tag-box">${host(g)}</span>` : '<span class="tag-box">Plays here</span>',
  ].join('');
  return `<div class="slide${g.poster ? ' slide--poster' : ''}${i === 0 ? ' on' : ''}" style="--c:${g.color}" aria-hidden="${i !== 0}">
    ${art}
    <div class="slide-copy">
      <div class="slide-brand"><img src="${iconUrl(g)}" alt="" width="40" height="40" /><span>Fewer Labs</span></div>
      <h1>${g.title}</h1>
      <div class="slide-meta">${meta}</div>
      <p>${g.description.split('. ')[0]}.</p>
      <div class="slide-actions">
        ${g.external
          ? `<a class="btn btn-light btn-lg" href="${g.url}" target="_blank" rel="noopener" data-opens="${g.id}">${icon('play')}Play</a>`
          : `<a class="btn btn-light btn-lg" href="/play/${g.id}" data-link>${icon('play')}Play</a>`}
        <a class="btn btn-grey btn-lg" href="/game/${g.id}" data-link>${icon('info')}More info</a>
      </div>
    </div>
  </div>`;
}

export function homePage(): Page {
  const slides = [featuredGame, ...GAMES.filter(g => g !== featuredGame)];
  const recent = profile.recent().map(gameById).filter((g): g is Game => !!g);
  const solo = GAMES.filter(g => !g.external);
  const together = GAMES.filter(g => g.tags.includes('Multiplayer'));
  return {
    title: 'Fewer Labs Games',
    nav: 'home',
    html: `
      <section class="billboard" aria-roledescription="carousel" aria-label="Featured games" style="--dwell:${DWELL}ms">
        ${slides.map(slide).join('')}
        <button class="bb-arrow prev" type="button" aria-label="Previous game">${icon('back')}</button>
        <button class="bb-arrow next" type="button" aria-label="Next game">${icon('next')}</button>
        <div class="bb-dots" role="tablist">
          ${slides.map((g, i) => `<button class="bb-dot${i === 0 ? ' on' : ''}" role="tab" aria-selected="${i === 0}" aria-label="Show ${g.title}"><i></i></button>`).join('')}
        </div>
      </section>
      <div class="rails">
        ${rail('Continue playing', recent)}
        ${rail('All games', [featuredGame, ...GAMES.filter(g => g !== featuredGame)], 'all')}
        ${rail('Quick solo games', solo)}
        ${together.length > 0 && together.length < GAMES.length ? rail('Play with your friends', together) : ''}
        <div class="wrap">
          <div class="features">
            <div class="feature">${icon('bolt')}<div><b>Play instantly</b><span>Runs right in your browser. Nothing to download, no account.</span></div></div>
            <div class="feature">${icon('devices')}<div><b>Phone or desktop</b><span>Touch, mouse or keyboard, portrait or landscape.</span></div></div>
            <div class="feature">${icon('offline')}<div><b>Works offline</b><span>Solo games keep working without a connection after your first visit.</span></div></div>
          </div>
        </div>
      </div>`,
    mount(root) {
      // Rotate through the games. Arrows, dots and swipes jump; hovering or focusing holds it.
      const bb = root.querySelector<HTMLElement>('.billboard')!;
      const items = [...bb.querySelectorAll<HTMLElement>('.slide')];
      const dots = [...bb.querySelectorAll<HTMLElement>('.bb-dot')];
      const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
      let i = 0, timer = 0, held = false;
      const show = (n: number) => {
        i = (n + items.length) % items.length;
        items.forEach((s, k) => { s.classList.toggle('on', k === i); s.setAttribute('aria-hidden', String(k !== i)); });
        dots.forEach((d, k) => {
          d.classList.toggle('on', k === i);
          d.setAttribute('aria-selected', String(k === i));
          const bar = d.querySelector('i')!;
          bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = '';
        });
      };
      const play = () => {
        clearInterval(timer);
        bb.classList.toggle('paused', still || held);
        if (!still && !held) timer = window.setInterval(() => show(i + 1), DWELL);
      };
      const go = (n: number) => { show(n); play(); };
      const hold = (on: boolean) => { held = on; if (!on) show(i); play(); };
      dots.forEach((d, k) => d.addEventListener('click', () => go(k)));
      bb.querySelector('.bb-arrow.prev')!.addEventListener('click', () => go(i - 1));
      bb.querySelector('.bb-arrow.next')!.addEventListener('click', () => go(i + 1));
      const copy = [...bb.querySelectorAll<HTMLElement>('.slide-copy')];
      copy.forEach(c => {
        c.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hold(true); });
        c.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hold(false); });
      });
      bb.addEventListener('focusin', () => hold(true));
      bb.addEventListener('focusout', () => hold(false));
      let x0 = 0;
      bb.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
      bb.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - x0;
        if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1));
      });
      play();
      const offRails = mountRails(root);
      return () => { clearInterval(timer); offRails(); };
    },
  };
}

export function gamePage(g: Game): Page {
  const s = profile.stats(g.id);
  const others = GAMES.filter(o => o.id !== g.id);
  const facts = g.external
    ? [['Players', 'Friends', 'or online rooms'], ['Genre', g.tags[1] ?? g.tags[0], g.tags[2]?.toLowerCase() ?? ''], ['Plays at', host(g), 'opens in a new tab'], ['Price', 'Free', 'no download']]
    : [['Your best', s.best > 0 ? fmt(s.best, g.unit) : '—', g.scoreLabel.toLowerCase()], ['Runs', s.plays.toLocaleString(), 'finished'], ['Genre', g.tags[1] ?? g.tags[0], g.tags[0].toLowerCase()], ['Price', 'Free', 'no ads, no account']];
  const info = g.external
    ? [['Developer', 'Fewer Labs'], ['Works on', 'Phone, tablet, desktop'], ['Language', 'Pidgin or English'], ['Internet', 'Needed to play together'], ['Website', host(g)]]
    : [['Developer', 'Fewer Labs'], ['Works on', 'Phone, tablet, desktop'], ['Orientation', g.landscapeFirst ? 'Best in landscape' : 'Portrait or landscape'], ['Offline', 'After first play'], ['Progress', 'Saved on this device']];
  return {
    title: `${g.title} · Fewer Labs Games`,
    html: `<div class="wrap">
      <a class="crumb" href="/" data-link>${icon('back')}All games</a>
      <section class="app-head">
        <img class="app-icon" src="${iconUrl(g)}" alt="" width="112" height="112" />
        <div class="app-head-text">
          <h1>${g.title}</h1>
          <p class="tagline">${g.tagline}</p>
        </div>
        <div class="app-actions">
          ${playLink(g, 'btn btn-primary btn-lg', `${icon('play')}${g.external ? `Play on ${host(g)}` : 'Play'}`)}
          ${!g.external && g.url ? `<a class="btn btn-ghost btn-lg" href="${g.url}" target="_blank" rel="noopener">${icon('external')}Open site</a>` : ''}
        </div>
      </section>

      <div class="facts">${facts.map(([k, v, sub]) => `<div class="fact"><span>${k}</span><b>${v}</b><small>${sub}</small></div>`).join('')}</div>

      <div class="gallery" aria-label="Screenshots">
        <img src="${shot(g, 'wide')}" alt="${g.title} on a wide screen" width="1280" height="720" />
        <img src="${shot(g, 'tall')}" alt="${g.title} on a phone" width="390" height="844" />
        <img src="${shot(g, 'title')}" alt="${g.title} title screen" width="1280" height="720" loading="lazy" />
      </div>

      <div class="detail-cols">
        <div class="prose">
          <h2>About this game</h2>
          <p>${g.description}</p>
          <h2>How to play</h2>
          <ol class="steps">${g.howTo.map(([k, v]) => `<li><div><b>${k}</b><span>${v}</span></div></li>`).join('')}</ol>
        </div>
        <aside class="side">
          <div class="side-card">
            <h3>Controls</h3>
            <dl class="kv">
              <div><dt>Touch</dt><dd>${g.controls.touch}</dd></div>
              <div><dt>Mouse</dt><dd>${g.controls.mouse}</dd></div>
              <div><dt>Keyboard</dt><dd>${g.controls.keys}</dd></div>
            </dl>
          </div>
          <div class="side-card">
            <h3>Information</h3>
            <dl class="kv">${info.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
          </div>
        </aside>
      </div>

    </div>
    <div class="rails rails--page">${rail('More games', others)}</div>`,
    mount: mountRails,
  };
}
