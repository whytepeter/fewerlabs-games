// Shared icon set for the cartoon UI kit (24x24, filled). Use <i data-icon="pause"></i> in markup
// and call hydrateIcons() once on load; or icon('pause') to get the SVG string in code.

const PATHS = {
  play: '<path d="M8 4.8v14.4a1.3 1.3 0 0 0 2 1.1l11-7.2a1.3 1.3 0 0 0 0-2.2L10 3.7a1.3 1.3 0 0 0-2 1.1z"/>',
  pause: '<rect x="5.5" y="4" width="5" height="16" rx="1.8"/><rect x="13.5" y="4" width="5" height="16" rx="1.8"/>',
  home: '<path d="M12 3.2 2.6 11a1 1 0 0 0 .7 1.8H5V20a1 1 0 0 0 1 1h4v-5.5h4V21h4a1 1 0 0 0 1-1v-7.2h1.7a1 1 0 0 0 .7-1.8z"/>',
  restart: '<path d="M12 4a8 8 0 1 0 8 8h-3a5 5 0 1 1-1.5-3.5L13 11h7V4l-2.4 2.4A8 8 0 0 0 12 4z"/>',
  sound: '<path d="M4 9h4l5-4.5v15L8 15H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.6 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  mute: '<path d="M4 9h4l5-4.5v15L8 15H4z"/><path d="m16 9 5 6m0-6-5 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  vibrate: '<rect x="7.5" y="3" width="9" height="18" rx="2.2"/><path d="M4 8v8M20 8v8M1.8 10v4M22.2 10v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  fullscreen: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
  trophy: '<path d="M7 3h10v2h3a1 1 0 0 1 1 1c0 3.2-2 5.4-4.6 5.9A5.5 5.5 0 0 1 13 14.8V18h3v3H8v-3h3v-3.2a5.5 5.5 0 0 1-3.4-2.9C5 11.4 3 9.2 3 6a1 1 0 0 1 1-1h3zm0 4H5.1c.3 1.4 1 2.4 2 2.9A6 6 0 0 1 7 9zm10 0v2c0 .3 0 .6-.1.9 1-.5 1.7-1.5 2-2.9z"/>',
  depth: '<path d="M12 2.5c-.6 0-1 .4-1 1v13.1l-3.3-3.3a1 1 0 0 0-1.4 1.4l5 5c.4.4 1 .4 1.4 0l5-5a1 1 0 0 0-1.4-1.4L13 16.6V3.5c0-.6-.4-1-1-1z"/>',
  bubble: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2.6"/><circle cx="9.2" cy="9.2" r="2.2"/>',
  star: '<path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z"/>',
  boat: '<path d="M2.5 13h19l-3.2 5.5a2 2 0 0 1-1.7 1H7.4a2 2 0 0 1-1.7-1z"/><path d="M11 3.5v8H5.5z"/><path d="M12.5 5v6.5H18z"/>',
  stone: '<ellipse cx="12" cy="13" rx="9" ry="5.5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
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
