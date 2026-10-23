# Fewer Labs Games (store)

The storefront for every Fewer Labs game. It lists the games, shows a details page for each, and plays them inside the store on phone and desktop. Each game is hosted on its own site; the store loads it in a frame.

- **Featured:** Draw Am, which opens on its own site (see "External games" below).
- **Embedded:** Deep Dive, Ripple and Skip play inside the store's player.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:5180
```

In development, the embedded games are loaded from their own dev servers on the same host: Deep Dive on 5181, Ripple on 5182 and Skip on 5183. Start those too (`npm run dev -- --port 5181` in `../deep-dive`, and so on).

## Deploy to Vercel

1. Deploy each game as its own Vercel project (Root Directory `deep-dive`, `ripple`, `skip`).
2. Import this repository once more with **Root Directory** set to `store`.
3. In the store project, add these environment variables (Settings → Environment Variables), then redeploy:

| Variable | Value |
|---|---|
| `VITE_GAME_DEEP_DIVE_URL` | Deep Dive's URL, e.g. `https://deep-dive.vercel.app` |
| `VITE_GAME_RIPPLE_URL` | Ripple's URL |
| `VITE_GAME_SKIP_URL` | Skip's URL |
| `VITE_GAME_DRAW_AM_URL` | Optional. Defaults to `https://www.drawam.app` |

A game without a URL still appears in the store; its player shows a "not connected yet" message.

`vercel.json` rewrites every page route (`/`, `/game/<id>`, `/play/<id>`) to `index.html`, so refreshing any page works.

## Pages

| Route | What it shows |
|---|---|
| `/` | The featured game, "Continue playing", every game, and why the store is nice to use |
| `/game/<id>` | Details: screenshots, about, how to play, controls, your best score |
| `/play/<id>` | The game. Full screen on phones; on larger screens there is a bar with back, best score, restart and full screen. External games redirect to their own site. |

## The embed engine

`src/embed.ts` loads a game at `<url>/?embed=1` in a frame, shows a loading screen until the game says it's ready, and offers Retry or "Open in a new tab" if it takes longer than 15 seconds.

Each embedded game includes a small SDK, `src/core/embed.ts`. When the game sees `?embed=1` inside a frame, it:

- adds an **All games** button to its title and pause menus;
- hides its own update banner;
- posts messages to the store, which accepts them only from the game's own origin:

```js
{ fewerlabs: 1, game: 'skip', type: 'ready' }                       // started
{ fewerlabs: 1, game: 'skip', type: 'score', score: 412, best: 530 } // a run finished
{ fewerlabs: 1, game: 'skip', type: 'exit' }                        // "All games" tapped
```

The store keeps each game's best score, runs finished and last played time in `localStorage` (`store:profile`). The games keep their own saves on their own sites.

### Adding a game

1. Add an entry to `GAMES` in `src/catalog.ts`.
2. Put its `icon.svg` and screenshots in `public/games/<id>/`: `wide.webp`, `tall.webp`, `title.webp` for the gallery, and `hero-wide.webp`, `hero-tall.webp` (no HUD) for cards and banners.
3. To play it inside the store, copy `src/core/embed.ts` from one of the games into it and call `initEmbed('<id>')` at startup and `embed.score(score, best)` at game over. Its site must allow being framed (no `X-Frame-Options: DENY` or `frame-ancestors 'none'`).

### External games

Set `external: true` for a game whose site can't or shouldn't be framed. Its Play buttons open the site in a new tab, and `/play/<id>` redirects there. Draw Am is external: drawam.app sends `X-Frame-Options: DENY` and `frame-ancestors 'none'`, and its live multiplayer rooms work best on their own page. To embed it later, allow the store's origin in its `frame-ancestors`, add the SDK, and remove `external`.
