# Deep Dive

One-button endless diver. Hold to swim up and let go to sink in landscape; in portrait you dive straight down and steer by touching left or right. Grab air, dodge jellies, mines, lunging anglerfish and electric eels, and keep clear of the sharp coral that lines some stretches of the trench. Three lives, pearls, power-ups, missions and suits to buy.

A standalone Phaser 3 + TypeScript + Vite project, shipped as an installable PWA that plays offline after the first visit and prompts players when an update is ready.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173, also reachable from a phone on the same Wi-Fi
npm run build     # typecheck, then production build into dist/
npm run preview   # serve the production build (service worker included)
```

## Deploy to Vercel

Import this repository in Vercel and set **Root Directory** to `deep-dive`. `vercel.json` holds the rest (Vite framework, `npm run build`, `dist/` output, cache headers that keep updates flowing).

## Structure

```
index.html        the page (HUD and menus are HTML, styled by src/core/kit.css + src/style.css)
public/           icon.svg, generated app icons, manifest.webmanifest (npm run icons regenerates icons)
src/main.ts       boots Phaser and the UI
src/scenes/       Boot (draws textures) and the game scene
src/game/         game rules, art, song, missions, shop items
src/ui.ts         menus, HUD and game-over card
src/core/         engine helpers: hi-DPI view, sound, generated music, settings, haptics,
                  textures, cartoon UI kit, icons, coins/missions/shop, PWA update banner
```
