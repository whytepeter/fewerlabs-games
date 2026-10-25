// Shared icon set for the cartoon UI kit (24x24, filled). Use <i data-icon="pause"></i> in markup
// and call hydrateIcons() once on load; or icon('pause') to get the SVG string in code.

const PATHS = {
  play: '<path d="M8 4.8v14.4a1.3 1.3 0 0 0 2 1.1l11-7.2a1.3 1.3 0 0 0 0-2.2L10 3.7a1.3 1.3 0 0 0-2 1.1z"/>',
  pause: '<rect x="5.5" y="4" width="5" height="16" rx="1.8"/><rect x="13.5" y="4" width="5" height="16" rx="1.8"/>',
  home: '<path d="M12 3.2 2.6 11a1 1 0 0 0 .7 1.8H5V20a1 1 0 0 0 1 1h4v-5.5h4V21h4a1 1 0 0 0 1-1v-7.2h1.7a1 1 0 0 0 .7-1.8z"/>',
  restart: '<path d="M12 4a8 8 0 1 0 8 8h-3a5 5 0 1 1-1.5-3.5L13 11h7V4l-2.4 2.4A8 8 0 0 0 12 4z"/>',
  sound: '<path d="M4 9h4l5-4.5v15L8 15H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.6 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  mute: '<path d="M4 9h4l5-4.5v15L8 15H4z"/><path d="m16 9 5 6m0-6-5 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  music: '<path d="M9 17.5V5.8a1 1 0 0 1 .8-1l9-1.8a1 1 0 0 1 1.2 1v11"/><ellipse cx="6.5" cy="17.8" rx="3.3" ry="2.7"/><ellipse cx="17.5" cy="15.2" rx="3.3" ry="2.7"/><path d="M9 8.5 20 6.3" fill="none" stroke="currentColor" stroke-width="2.2"/>',
  'music-off': '<path d="M9 17.5V5.8a1 1 0 0 1 .8-1l9-1.8a1 1 0 0 1 1.2 1v11"/><ellipse cx="6.5" cy="17.8" rx="3.3" ry="2.7"/><ellipse cx="17.5" cy="15.2" rx="3.3" ry="2.7"/><path d="M3 3l18 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  vibrate: '<rect x="7.5" y="3" width="9" height="18" rx="2.2"/><path d="M4 8v8M20 8v8M1.8 10v4M22.2 10v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  fullscreen: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
  trophy: '<path d="M7 3h10v2h3a1 1 0 0 1 1 1c0 3.2-2 5.4-4.6 5.9A5.5 5.5 0 0 1 13 14.8V18h3v3H8v-3h3v-3.2a5.5 5.5 0 0 1-3.4-2.9C5 11.4 3 9.2 3 6a1 1 0 0 1 1-1h3zm0 4H5.1c.3 1.4 1 2.4 2 2.9A6 6 0 0 1 7 9zm10 0v2c0 .3 0 .6-.1.9 1-.5 1.7-1.5 2-2.9z"/>',
  depth: '<path d="M12 2.5c-.6 0-1 .4-1 1v13.1l-3.3-3.3a1 1 0 0 0-1.4 1.4l5 5c.4.4 1 .4 1.4 0l5-5a1 1 0 0 0-1.4-1.4L13 16.6V3.5c0-.6-.4-1-1-1z"/>',
  bubble: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2.6"/><circle cx="9.2" cy="9.2" r="2.2"/>',
  heart: '<path d="M12 20.5 4.2 13a5 5 0 0 1 7.1-7.1l.7.7.7-.7a5 5 0 0 1 7.1 7.1z"/>',
  pearl: '<circle cx="12" cy="12" r="7.5"/><circle cx="9.6" cy="9.4" r="2.2" fill="#fff"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.6"/>',
  star: '<path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z"/>',
  calendar: '<path fill-rule="evenodd" d="M7 2.5a1 1 0 0 1 1 1V5h8V3.5a1 1 0 1 1 2 0V5h1a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1V3.5a1 1 0 0 1 1-1ZM5 10v9h14v-9Zm3 2h3v3H8Z"/>',
  // A little cartoon TV with antennae and a play button on its screen: rewarded ads.
  tv: '<path d="M8.2 2.6 12 6.2l3.8-3.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><rect x="2" y="6" width="20" height="13.5" rx="4"/><rect x="4.6" y="8.4" width="14.8" height="8.7" rx="2.4" fill="#16233b" opacity=".45"/><path d="M10.4 10.4v4.9a.5.5 0 0 0 .75.43l4.1-2.45a.5.5 0 0 0 0-.86l-4.1-2.45a.5.5 0 0 0-.75.43z"/><path d="M6.5 19.5 5.6 21.6M17.5 19.5l.9 2.1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    gift: '<path d="M3.5 8.5h17v4h-17zM5 12.5h14V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M12 8.5c-1-3-5.5-4.5-6-2s4 2 6 2c2 0 6.5.5 6-2s-5-1-6 2zM11 8.5h2V21h-2z" fill="#fff" opacity=".85"/>',
  boat: '<path d="M2.5 13h19l-3.2 5.5a2 2 0 0 1-1.7 1H7.4a2 2 0 0 1-1.7-1z"/><path d="M11 3.5v8H5.5z"/><path d="M12.5 5v6.5H18z"/>',
  stone: '<ellipse cx="12" cy="13" rx="9" ry="5.5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="m4 7.5 8 6 8-6" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>',
  gear: '<path fill-rule="evenodd" d="M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Zm8.4 5 .1-1.6-.1-1.6 2-1.6-2-3.4-2.4.9a8 8 0 0 0-2.7-1.5L14.9 2h-3.8l-.4 2.3A8 8 0 0 0 8 5.8l-2.4-.9-2 3.4 2 1.6L5.5 12l.1 1.6-2 1.6 2 3.4 2.4-.9a8 8 0 0 0 2.7 1.5l.4 2.3h3.8l.4-2.3a8 8 0 0 0 2.7-1.5l2.4.9 2-3.4z"/>',
  bag: '<path d="M4.5 8.5h15l-1.1 11.6a1.6 1.6 0 0 1-1.6 1.4H7.2a1.6 1.6 0 0 1-1.6-1.4z"/><path d="M8.6 10V7a3.4 3.4 0 0 1 6.8 0v3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  diver: '<circle cx="12" cy="11" r="8.6"/><circle cx="13.2" cy="11" r="5" fill="#7fd6ff"/><rect x="6.5" y="18.2" width="11" height="3.8" rx="1.6"/>',
  prev: '<path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>',
  next: '<path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>',
} as const;

export type IconName = keyof typeof PATHS;

export function icon(name: IconName) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${PATHS[name]}</svg>`;
}

/** Replace every <i data-icon="name"> in the page with its SVG. */
export function hydrateIcons(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('i[data-icon]').forEach(el => {
    const name = el.dataset.icon as IconName;
    if (PATHS[name]) el.outerHTML = icon(name);
  });
}

/** Wrap each letter of an element's text in a span so .k-logo letters can bounce in turn. */
export function wobbleLetters(el: HTMLElement) {
  const text = el.textContent ?? '';
  el.setAttribute('aria-label', text);
  el.innerHTML = [...text]
    .map((ch, i) => ch === ' ' ? ' ' : `<span class="k-l" aria-hidden="true" style="animation-delay:${(i * 0.09).toFixed(2)}s">${ch}</span>`)
    .join('');
}

/** The star used by .k-stars (filled/outlined via CSS). */
export const STAR_SVG =
  '<svg class="k-star" viewBox="0 0 48 48" aria-hidden="true"><path d="m24 4 6 12.2 13.4 2-9.7 9.4 2.3 13.3L24 34.6l-12 6.3 2.3-13.3-9.7-9.4 13.4-2z"/><path class="k-star-shine" d="M17 18.5c2-.3 3.6-1.3 4.6-3.2l1-2c-1.6 2.6-3.7 4-5.6 5.2z"/></svg>';
