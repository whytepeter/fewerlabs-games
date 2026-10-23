# Deep Dive

One-button endless diver. Hold to swim up and let go to sink in landscape; in portrait you dive straight down and steer by touching left or right. Grab air, dodge jellies, mines, lunging anglerfish and electric eels, and keep clear of the sharp coral that lines some stretches of the trench. Three lives, pearls, power-ups and close calls. The title is a hub: eight divers to buy or unlock by rank, mission sets that rank you up for a permanent coin bonus (Jetpack Joyride style), a shop of power-up upgrades, and a global leaderboard.

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

## Firebase (optional)

Anonymous sign-in, a cloud backup of progress (coins, suits, missions, best depth, name) and a global depth leaderboard. Without the env vars below the game runs fully offline from localStorage, exactly as before. Firebase loads lazily after the first frame; all of it lives in `src/core/cloud.ts`.

- **Env vars** (see `.env.example`): `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`. Set them in the Vercel project too.
- **Firebase console:** enable Authentication > Anonymous, Google and Email/Password (players start as guests and can save their progress to Google or email from Settings), add the game's domains under Authentication > Settings > Authorized domains, create a Firestore database, then deploy the rules from `../firebase`: `firebase deploy --only firestore:rules --project <id>`.
- **Local testing without a project:** `npm run emulators` (needs Java), then put the demo values from `.env.example` in `.env.development.local` and run `npm run dev`.
- **How sync works:** every save goes through `store` (`src/core/settings.ts`). After sign-in the newer of the device and the cloud wins; later changes upload two seconds after they happen, or when the tab is hidden. Sound, music and vibration stay per device.
- **Accounts:** saving to Google or email links the guest account, so its progress and leaderboard row carry over unchanged. If that sign-in already has an account, the player chooses to load its progress (replacing the guest's) or stay a guest. Signing out keeps the progress in the account and starts the device over as a new guest.
- **Limits:** a guest's backup only restores in the same browser. Inside the store's frame the browser partitions storage, so a player there is a separate anonymous account. The rules stop players from touching other rows and only let a best go up, but scores aren't verified server-side.

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
