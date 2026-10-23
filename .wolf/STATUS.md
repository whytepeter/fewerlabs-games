---
description: session handoff, regenerate with /handoff when a quest finishes
budget_tokens: 1000
---
# STATUS — fewerlabs-games

> Read this FIRST when resuming. Last updated: 2026-10-23 (after eaf74e9)

## ✅ Done

- **Repo:** four standalone projects: `store/` (plain TS + Vite + vite-plugin-pwa) and the games `deep-dive/`, `ripple/`, `skip/` (Phaser 3.90 + TS + Vite 8). Each is its own Vercel project (Root Directory = folder). Everything is committed and pushed to `main`.
- **Games:** cartoon UI kit, music per game, perks, coins/missions (no daily), PWA update prompt, hi-DPI view. Deep Dive has a soft wall bounce plus sharp-coral stretches that cost a life; Ripple's pond runs edge to edge.
- **Store (bfd4475 → eaf74e9):** a clean dark storefront: Inter font, no cartoon chrome, routes `/`, `/game/<id>` and `/play/<id>`, SPA rewrite in `vercel.json`, its own PWA.
  - **Home:** a Netflix-style full-bleed carousel, Draw Am first as a poster slide over a blurred copy of itself, then the games full-bleed. It has progress dashes, side arrows, swipe, and holds on hover or focus. The top bar floats over it until you scroll.
  - **Carousel layout:** content is aligned to the page container via `--edge`. Below it: Continue playing, the All games card grid, and a features strip.
  - **Pages:** each detail page has facts, a screenshot gallery, about, how to play, controls, info and a More games grid. The player has a slim bar on desktop and goes full screen on phones and short landscape screens.
- **Catalog:** `store/src/catalog.ts` holds 4 games. Draw Am is `external` + `featured` + `poster`: drawam.app sends `X-Frame-Options: DENY`, so Play opens a new tab and `/play/draw-am` redirects there. Images live in `store/public/games/<id>/`: wide/tall/title for the gallery, hero-wide/hero-tall without HUD for cards and the carousel.
- **Embed protocol:** `store/src/embed.ts` frames `<url>/?embed=1`, shows a loader, gives up after 15 s with an error, and checks the origin of messages `{fewerlabs:1, game, type:'ready'|'score'|'exit'}`. The game SDK `*/src/core/embed.ts` adds an "All games" button to the title and pause menus, reports scores, and hides the update banner.
- **Docs:** `store/README.md` covers deploying, env vars, the protocol and adding a game; the root README lists the store.

## 🚀 Next quest

**Deploy everything to Vercel and wire the store to the games**
- Create four Vercel projects with Root Directory `store`, `deep-dive`, `ripple` and `skip`. In the store project, set `VITE_GAME_DEEP_DIVE_URL`, `VITE_GAME_RIPPLE_URL` and `VITE_GAME_SKIP_URL`, then redeploy.
- **Acceptance:**
  - Each game loads inside the store's player on phone and desktop.
  - "All games" returns to the store.
  - Best scores show on the detail pages.
  - Refreshing `/game/x` and `/play/x` works.
  - The PWA installs.
- **Open decisions (user):**
  - The real domains for the store and the games.
  - Whether to limit each game's `frame-ancestors` to the store's origin; they currently allow any site to frame them.
  - Whether to embed Draw Am later, which needs a drawam.app header change plus the SDK.
- Commits: no Claude co-author (`.claude/rules/no-claude-coauthor.md`). `origin` is now SSH, so plain `git push` works. The user committed the OpenWolf and agent files themselves in c7447a4, so they're tracked now.

## Context

- **Style:** the user wants Netflix styling only on the carousel (see the cerebrum Do-Not-Repeat list). Buttons are the store's own pills, and the lists are cards, not sideways rows.
- **Dev servers:** they come from `fewerlabs/.claude/launch.json`. The store is set to 5180 but runs on 5184 when 5180 is taken; the games run on 5181–5183. The store's dev catalog points at `http://<host>:5181–5183`.
- **Browser pane quirks:**
  - A hidden pane pauses rAF, and screenshots lag one frame or stay stale after scrolling, so use `scrollTo` and take two shots.
  - Service workers don't work there; for SW checks or screenshots, use puppeteer-core with local Chrome from the scratchpad.
- **Unresolved:** once, a Deep Dive run in the store returned to `/` by itself, and I couldn't reproduce it. Also, Deep Dive's title menu gets cramped on short stages.

## 📚 References
- `store/README.md`: deploy, env vars, embed protocol, adding a game
- `.wolf/cerebrum.md`, `.wolf/buglog.json`
