# Fewer Labs Games

Small, endless, one-thumb games in one site. Each game has its own page and can be installed to a home screen as its own app. One service worker caches the whole site, so everything plays offline after the first visit.

| Path | Game |
|---|---|
| `/` | Hub with every game and your best scores |
| `/deep-dive/` | Deep Dive: one-button diver in a darkening trench (landscape) |
| `/ripple/` | Ripple: tap ripples to push paper boats to their docks |
| `/skip/` | Skip: skip a stone across an endless lake with timed taps |

Built with Phaser 3, TypeScript and Vite (multi-page build), plus vite-plugin-pwa.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173, also reachable from a phone on the same Wi-Fi
npm run build      # typecheck, then production build into dist/
npm run preview    # serve the production build, service worker included
```

To play on a phone during development, open the Network URL that `npm run dev` prints. Offline and install support need `https` (or `localhost`), so test those on a Vercel deployment.

## Deploy to Vercel

`vercel.json` holds everything Vercel needs: Vite framework, `npm run build`, output in `dist/`, trailing slashes (`/ripple` redirects to `/ripple/`), and cache headers (the service worker is never cached, hashed assets are cached forever).

Either import the repo in the Vercel dashboard, or run:

```bash
npx vercel          # preview deployment
npx vercel --prod   # production
```

## Structure

```
index.html                 hub page
<game>/index.html          one page per game (any top-level folder with an index.html is built automatically)
public/                    hub icon and manifest
public/<game>/             each game's icon.svg, generated icons and manifest.webmanifest
src/core/                  shared by every game
  view.ts                    hi-DPI canvas sizing and camera helper (logical CSS-pixel coordinates)
  sfx.ts                     generated sound effects (Web Audio, no audio files)
  settings.ts                per-device storage namespaced by game path, plus Sound and Vibration settings
  haptics.ts                 vibration on supported devices
  tex.ts                     draws art into 3x textures with the canvas API
src/hub/                   hub script and styles
src/games/<game>/          each game's scenes, logic, UI and styles
scripts/icons.mjs          regenerates PNG icons from every icon.svg (npm run icons)
```

## Adding a game

1. Create `<game>/index.html` and `src/games/<game>/main.ts` (copy an existing game as a starting point).
2. Add `public/<game>/icon.svg` and `public/<game>/manifest.webmanifest` (with `start_url` and `scope` set to `/<game>/`), then run `npm run icons`.
3. Add a card for it in the hub's `index.html`. Its best score is read from `localStorage["<game>:best"]`.
