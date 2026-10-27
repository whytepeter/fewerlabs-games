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

## Remote tuning

Balance numbers can change without a release. The defaults live in `src/game/tuning.ts`. To override any of them, create the Firestore document `config/deep-dive` in the Firebase console and add fields with the same names:

| Field | Default | What it does |
|---|---|---|
| `treasureOdds` | 1 | × every rare treasure's chance per dive (0–5) |
| `chestHeart`, `chestBooster` | 0.06, 0.14 | chance a chest holds a Sea Heart / a booster |
| `heartPrices` | [3000, 5000, 8000] | coin prices of the week's Sea Hearts in the shop |
| `perkGap`, `chestGap`, `heartGap` | 1 | × spacing of power-ups / chests / floating Sea Hearts (above 1 = rarer) |
| `coinRate` | 1 | × the coins a dive pays (not missions) |
| `adSaves` | 1 | rewarded-ad saves per dive (0 turns it off) |
| `adDoubleCoins` | 1 | 1 offers the double-coins ad, 0 doesn't |

Every player gets the same values. Players pick up a change the next time they open the game, and it applies from their next dive. Values out of range or of the wrong type are ignored. The Daily Dive keeps the default spawn spacing, so the day's trench stays the same for everyone.

## Play analytics

`src/core/analytics.ts` records a few events, tagged with the anonymous player id and the day: `app_open`, `dive_end` (cave, depth, cause, time, coins, saves, diver), `save_me` (Sea Heart, ad or none), `ad` (offered, none, watched, skipped), `spend` (what coins and Sea Hearts buy) and `treasure`. They queue on the device and go to Firestore in batches (`analytics/deep-dive/events`). Nothing is sent from the dev server or in dev mode. Players can add events but nobody can read them from the game.

To read them, use a service-account key (Firebase console > Project settings > Service accounts > Generate new private key):

```bash
FIREBASE_SERVICE_ACCOUNT="$(cat key.json)" npm run report -- 7
```

This prints the last 7 days: players and next-day return, dives per cave (median and top-10% depth, time, coins, what ends them), Save me choices, ad fill and watch rates, spending, and treasure finds.

## Lagos Life

Deep Dive is listed on [Lagos Life](https://lagoslife.app/developers/docs) at `https://deepdive.fewerlabs.dev/?lagoslife=1`. Inside their player (`src/core/lagos.ts`) it loads their SDK, sends each dive to their leaderboard and shows it in Top divers, and asks nothing personal: no sign-in, age, name or cookie questions, no cloud saves, analytics or outside ads. On the dev server, `http://localhost:5181/?lagoslife=1` previews this mode in a plain tab (their SDK only answers inside Lagos Life).

- **Purchases:** Sea Heart packs (`hearts5`, `hearts12`, `hearts30`), coin packs (`coins5k`, `coins20k`, `coins40k`) and the one-off `coin_doubler`, all made as products in their dashboard with exactly these ids. `api/lagos.ts` verifies the player's session and the purchase with Lagos Life, the game grants it once, then the server marks it delivered; paid purchases not yet delivered are picked up the next time the game starts.
- **Vercel env var:** `VATAR_SECRET`, a Secret for Production (`vtr_test_…` in their sandbox, `vtr_live_…` once approved). After changing it, redeploy with a fresh build: a dashboard redeploy that runs the ignore step is skipped when `deep-dive/` hasn't changed.

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
