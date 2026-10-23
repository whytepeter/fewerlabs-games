# Skip

Pull back to throw a stone across an endless lake, then tap exactly as it touches the water to keep it skipping. Perfect taps build a streak; hoops, ducks, logs and lily pads change your line. Five stones with different feel, missions and coins.

A standalone Phaser 3 + TypeScript + Vite project, shipped as an installable PWA that plays offline after the first visit and prompts players when an update is ready.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173, also reachable from a phone on the same Wi-Fi
npm run build     # typecheck, then production build into dist/
npm run preview   # serve the production build (service worker included)
npm run bot       # headless playtest of the timing balance
```

## Deploy to Vercel

Import this repository in Vercel and set **Root Directory** to `skip`. `vercel.json` holds the rest (Vite framework, `npm run build`, `dist/` output, cache headers that keep updates flowing).

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
