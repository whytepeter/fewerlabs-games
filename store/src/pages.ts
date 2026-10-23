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

function bestMeta(g: Game) {
  const s = profile.stats(g.id);
  return s.best > 0 ? `<span class="best">${icon('trophy')}${fmt(s.best, g.unit)}</span>` : '';
}

function card(g: Game) {
  return `<article class="card">
    <a class="card-shot" href="/game/${g.id}" data-link aria-label="${g.title}">
      <img src="${shot(g, 'hero-wide')}" alt="${g.title}" loading="lazy" width="1600" height="900" />
    </a>
    <div class="card-info">
      <img class="app-icon" src="${iconUrl(g)}" alt="" width="48" height="48" />
      <a class="card-text" href="/game/${g.id}" data-link>
        <h3>${g.title}</h3>
        <p>${g.tagline}</p>
      </a>
      ${playLink(g, 'btn btn-sm')}
    </div>
    <div class="meta"><span>${g.tags.join(' · ')}</span>${g.external ? `<span>${host(g)}</span>` : ''}${bestMeta(g)}</div>
  </article>`;
}

export function homePage(): Page {
  const f = featuredGame;
  const recent = profile.recent().map(gameById).filter((g): g is Game => !!g);
  return {
    title: 'Fewer Labs Games',
    nav: 'home',
    html: `<div class="wrap">
      <section class="spot" style="--c:${f.color}" aria-label="Featured game">
        <a class="spot-art" href="/game/${f.id}" data-link tabindex="-1" aria-hidden="true">
          <picture>
            <source media="(max-width: 640px)" srcset="${shot(f, 'hero-wide')}" />
            <img src="${shot(f, 'hero-wide')}" alt="" width="1200" height="630" />
          </picture>
        </a>
        <div class="spot-copy">
          <span class="eyebrow">Featured</span>
          <div class="spot-app">
            <img class="app-icon" src="${iconUrl(f)}" alt="" width="64" height="64" />
            <div><h1>${f.title}</h1><p class="spot-tag">${f.tagline}</p></div>
          </div>
          <p class="spot-desc">${f.description.split('. ').slice(0, 2).join('. ')}.</p>
          <div class="spot-actions">
            ${playLink(f, 'btn btn-light btn-lg', `${icon('play')}Play now`)}
            <a class="btn btn-glass btn-lg" href="/game/${f.id}" data-link>Details</a>
          </div>
          <div class="meta">${f.tags.map(t => `<span>${t}</span>`).join('')}${f.external ? `<span>Opens ${host(f)}</span>` : ''}</div>
        </div>
      </section>

      ${recent.length ? `
      <section class="section">
        <div class="section-head"><h2>Continue playing</h2></div>
        <div class="recent">${recent.map(g => {
          const s = profile.stats(g.id);
          const inner = `<img class="app-icon" src="${iconUrl(g)}" alt="" width="52" height="52" />
            <span class="recent-copy"><b>${g.title}</b><small>${s.best > 0 ? `${g.scoreLabel} ${fmt(s.best, g.unit)}` : g.tagline}</small></span>
            <span class="btn btn-sm btn-primary">Play</span>`;
          return g.external
            ? `<a class="recent-item" href="${g.url}" target="_blank" rel="noopener" data-opens="${g.id}">${inner}</a>`
            : `<a class="recent-item" href="/play/${g.id}" data-link>${inner}</a>`;
        }).join('')}</div>
      </section>` : ''}

      <section class="section" id="all">
        <div class="section-head"><h2>All games</h2><p>${GAMES.length} games · all free</p></div>
        <div class="grid">${GAMES.map(card).join('')}</div>
      </section>

      <section class="section">
        <div class="features">
          <div class="feature">${icon('bolt')}<div><b>Play instantly</b><span>Runs right in your browser. Nothing to download, no account.</span></div></div>
          <div class="feature">${icon('devices')}<div><b>Phone or desktop</b><span>Touch, mouse or keyboard, portrait or landscape.</span></div></div>
          <div class="feature">${icon('offline')}<div><b>Works offline</b><span>Solo games keep working without a connection after your first visit.</span></div></div>
        </div>
      </section>
    </div>`,
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

      <section class="section">
        <div class="section-head"><h2>More games</h2></div>
        <div class="grid">${others.map(card).join('')}</div>
      </section>
    </div>`,
  };
}
