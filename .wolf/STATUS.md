---
description: session handoff, regenerate with /handoff when a quest finishes
budget_tokens: 1000
---
# STATUS — fewerlabs-games

> Read this FIRST when resuming. Last updated: 2026-10-24 (after 794922f)

## ✅ Done

- **Repo:** four standalone projects: `store/` (plain TS + Vite + vite-plugin-pwa) and the games `deep-dive/`, `ripple/` and `skip/` (Phaser 3.90 + TS + Vite 8). Each is its own Vercel project (Root Directory = its folder). `main` tracks `origin/main`.
- **Deep Dive, before this session:** three caves in `deep-dive/src/game/caves.ts` (Reef, Kelp, Frozen Trench), Golden Shell "Save me", game-over chests, gadgets, upgrades, missions and ranks.
- **Deep Dive balance, 794922f (pushed):**
  - **Treasure is rare and placed at random:** chests from 250 m, then every 1000–1800 m; a chest holds a shell 6% of the time, otherwise 30–150 coins; floating shells from 600 m, then every 3–4.5 km. Chests and shells sit next to a plain wall; other pickups avoid creatures (`spawnRow`, `openY`, `wallY` in `GameScene.ts`).
  - **Turbo:** the first power-up of every dive, in every cave, is a Turbo.
  - **Head Start gadget:** now a 6 s Turbo kick-off (about 250 m), then a 4 s shield (`HEAD_START_TURBO` and `HEAD_START_SHIELD` in `gadgets.ts`, price 1600).
  - **Per-cave pacing and pay:** each cave sets `pace` (creature spacing) and `pay` (Reef ×1, Kelp ×1.25, Frozen ×1.5). The pacing is a sawtooth: spacing breathes in and out every ~450 m, and each new zone opens with a 70 m calm stretch.
  - **Diver perks:** each diver has a small perk (`DIVER_PERK` in `skins.ts`), shown as a pill on the Divers screen.
  - **Shell divers:** most divers cost Golden Shells: Kelp 2, Puff 3, Royal 4, Lumi 5, Ghost 8. Coral costs 500 coins and Captain unlocks at rank 10. `migrateDivers()` (flag `diversV2`) keeps Puff and Lumi for players already at rank 3 or 6.
  - **Shells tab in the shop:** three shells a week, each price unlocking after the last; resets on Monday (`shellShop` in `shells.ts`). Added `shop().grant()` in `core/meta.ts`.
- **Store:** dark storefront with a Netflix-style carousel only (see the cerebrum), detail and player pages, and the embed protocol (`store/src/embed.ts` ↔ `*/src/core/embed.ts`). See `store/README.md`.

## 🚀 Next quest

**Commit the shell price change, then deploy to Vercel**
- **Uncommitted:** `deep-dive/src/game/shells.ts` sets `SHELL_PRICES = [1000, 3000, 5000]`, which the user asked for. It builds. Commit and push it once the user says so.
- **Deploy:** create four Vercel projects with Root Directory `store`, `deep-dive`, `ripple` and `skip`. In the store project, set `VITE_GAME_DEEP_DIVE_URL`, `VITE_GAME_RIPPLE_URL` and `VITE_GAME_SKIP_URL`, then redeploy.
- **Acceptance:**
  - Each game loads inside the store's player on phone and desktop.
  - "All games" returns to the store.
  - Best scores show on the detail pages.
  - Refreshing `/game/x` and `/play/x` works.
  - The PWA installs.
- **Open decisions (user):**
  - The real domains.
  - Whether to limit `frame-ancestors` to the store's origin.
  - Whether to embed Draw Am later.
  - Deep Dive extras I offered but the user hasn't approved:
    - Coral Guard also blocks icicles.
    - Pearl Pull also pulls air bubbles.
    - A Turbo upgrade in the shop.
    - Whether rare "gems" should be a separate currency. Golden Shells play that role for now.
  - No ad code exists yet. The natural slots are the "Save me" screen (`ui.saveMe` already has a comment for it), doubling a chest, and a free Head Start.

## Context

- **Preferences:** improve and rebalance existing Deep Dive features rather than adding new systems (see the cerebrum). Treasure should stay rare. The user earns up to about 600 coins per dive.
- **Commits:** never credit Claude (`.claude/rules/no-claude-coauthor.md`). Game commits leave `.wolf/` out; ask before committing it.
- **Testing:** headless tests use puppeteer-core with local Chrome against `npx vite preview`. Shop storage keys are doubled, e.g. `deep-dive:deep-dive:owned:suit`. Nobody has played the perks, rarity or pacing by hand yet.
- **Unresolved:** once, a Deep Dive run inside the store returned to `/` by itself, and it couldn't be reproduced.
