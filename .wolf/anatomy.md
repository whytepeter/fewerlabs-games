# anatomy.md

> Auto-maintained by OpenWolf. Last scanned: 2026-10-24T15:30:41.598Z
> Files: 72 tracked | Anatomy hits: 0 | Misses: 0

> Project structure index. Auto-maintained by OpenWolf hooks and daemon.
> Run `openwolf scan` to generate, or wait for the first Claude Code session.
> Status: Pending initial scan

## ./

- `.gitignore` — Git ignore rules (~8 tok)
- `404.html` — Lost at sea · Fewer Labs (~246 tok)
- `AGENTS.md` — OpenWolf (~75 tok)
- `CLAUDE.md` — OpenWolf (~99 tok)
- `GEMINI.md` — OpenWolf (~75 tok)
- `index.html` — Fewer Labs Games (~1697 tok)
- `package.json` — Node.js package manifest (~170 tok)
- `README.md` — Project documentation (~924 tok)
- `tsconfig.json` — TypeScript configuration (~135 tok)
- `vercel.json` (~165 tok)
- `vite.config.ts` — Vite build configuration (~494 tok)

## deep-dive/

- `index.html` — Deep Dive (~2290 tok)

## deep-dive/src/game/

- `chests.ts` — What's inside a treasure chest. (~222 tok)

## deep-dive/src/scenes/

- `GameScene.ts` — angler: seconds left in its lunge wind-up / dash; eel: charge cycle offset (~19778 tok)

## public/

- `manifest.webmanifest` (~165 tok)

## public/deep-dive/

- `manifest.webmanifest` (~182 tok)

## public/ripple/

- `manifest.webmanifest` (~189 tok)

## public/skip/

- `manifest.webmanifest` (~179 tok)

## ripple/

- `index.html` — Ripple (~2807 tok)

## scripts/

- `icons.mjs` — /icon.svg. (~176 tok)

## skip/

- `index.html` — Skip (~1860 tok)

## src/core/

- `haptics.ts` — Short vibration on devices that support it (Android Chrome); a no-op elsewhere, including iOS Safari. (~146 tok)
- `icons.ts` — Replace every <i data-icon="name"> in the page with its SVG. (~1254 tok)
- `kit.css` — Styles: 65 rules, 39 vars (~5216 tok)
- `meta.ts` — Arcade-wide progression shared by every game, stored on this device: (~2182 tok)
- `metaui.ts` — DOM pieces for the arcade meta (coins, missions, daily), styled by kit.css (.k-coins, (~833 tok)
- `music.ts` — Generated background music: a small step sequencer on the shared AudioContext, so there are (~2097 tok)
- `pwa.ts` — Service worker registration with an update prompt, shared by every page. (~520 tok)
- `rng.ts` — Small seeded random number generator (mulberry32): same seed, same sequence, on every device. (~240 tok)
- `settings.ts` — Per-device persistence. Storage can be unavailable (private mode, blocked site data), (~418 tok)
- `sfx.ts` — Call from a pointer/key handler. Safe to call repeatedly. (~874 tok)
- `tex.ts` — Art is drawn procedurally with the 2D canvas API into Phaser textures at TEX_RES times (~673 tok)
- `view.ts` — Crisp rendering on high-DPI phones. (~857 tok)

## src/games/deep-dive/

- `main.ts` — Declares game (~263 tok)
- `style.css` — Styles: 99 rules, 5 vars, 6 media queries, 6 animations (~4007 tok)
- `ui.ts` — Equip (buying if needed); false when the player can't afford it. (~2943 tok)

## src/games/deep-dive/game/

- `ambient.ts` — A low underwater drone that gets darker (lower filter cutoff) with depth. (~508 tok)
- `biomes.ts` — Depth zones in metres. Colours blend over the last 80 m before each boundary. (~442 tok)
- `cave.ts` — Trench ceiling and floor at a world x, for a view of height H. (~190 tok)
- `missions.ts` — Deep Dive mission templates. Stats reported at the end of each dive: (~502 tok)
- `skins.ts` — Diver suits, bought with arcade coins. (~254 tok)
- `song.ts` — Dreamy A-minor loop (Am F C G), in the same key as the ambient drone. Builds with depth. (~219 tok)

## src/games/deep-dive/scenes/

- `BootScene.ts` — Radius of the headlamp's light pool and the darkness texture's on-screen width (logical px). (~4248 tok)
- `GameScene.ts` — angler: seconds left in its lunge wind-up / dash; eel: charge cycle offset (~10599 tok)

## src/games/ripple/

- `main.ts` — Run n full frames (logic, tweens, rendering) at a fixed step, independent of rAF. (~1125 tok)
- `style.css` — Styles: 109 rules, 66 vars, 2 media queries (~4435 tok)
- `ui.ts` — The equipped boat style changed (bought or picked). (~2760 tok)

## src/games/ripple/game/

- `art.ts` — The equipped boat style (shop); set before building themed textures. (~4332 tok)
- `audio.ts` — Rising chime: `n` climbs with the combo and with score. (~621 tok)
- `layout.ts` — Safe-area insets (notch, home indicator) measured from the #safe probe element. (~599 tok)
- `meta.ts` — Ripple's hooks into the arcade meta (core/meta.ts): missions, boat shop, Classic/Daily mode. (~676 tok)
- `palette.ts` — Raw CSS colour strings, usable directly with the 2D canvas API. (~705 tok)
- `sim.ts` — Pause between losing the last boat and the game-over screen. (~8245 tok)
- `skins.ts` — Draw one boat of a style at (0, 0). (~2019 tok)
- `song.ts` — "Lily Pond": a cozy F-major loop at 92 bpm with a little swing. Pluck-like arp (filtered (~341 tok)

## src/games/ripple/scenes/

- `Boot.ts` — Draws every texture once (no image files to load), then hands over to the game. (~134 tok)
- `Game.ts` — Points for 1, 2 and 3 stars. Bot playtests (30 runs each, portrait): a simple bot averages ~9 (~9764 tok)

## src/games/skip/

- `main.ts` — Block page gestures the game doesn't want: pinch zoom, double-tap zoom, long-press menus. (~405 tok)
- `style.css` — Styles: 80 rules, 103 vars, 1 media queries, 5 animations (~4617 tok)
- `ui.ts` — Distance in metres for 1, 2 and 3 stars. From the bot: never tapping scores ~74 m (p90 106), (~3541 tok)

## src/games/skip/game/

- `art.ts` — Parallax strips are wide, so they use a lower resolution to stay under 4096 px. (~5172 tok)
- `audio.ts` — Pitch climbs with the Perfect streak and holds at the top note instead of wrapping. (~865 tok)
- `palette.ts` — CSS colour strings, for canvas drawing. (~618 tok)
- `progress.ts` — Coins for one throw: distance/25 + Perfects/3 + 3 per hoop. A decent throw pays ~15–40. (~943 tok)
- `sim.ts` — The timing ring appears this long before the stone reaches the water. (~5109 tok)
- `song.ts` — "Skip Song": breezy C major, 112 bpm, I–V–vi–IV. A plucky triangle arp like a ukulele, (~373 tok)

## src/games/skip/scenes/

- `Boot.ts` — Paints every texture from the current palette, then hands over to the game. (~86 tok)
- `Game.ts` — The stone is drawn a little larger than its physics size so its face reads on a phone. (~12471 tok)

## src/games/skip/tools/

- `bot.mjs` — Headless playtest: `npm run bot` (or `node src/tools/bot.mjs 300`). Needs Node 22.18+, which (~1683 tok)

## src/hub/

- `404.ts` (~63 tok)
- `hub.css` — Styles: 40 rules, 2 vars, 1 media queries, 1 animations (~1420 tok)
- `main.ts` — Declares el (~615 tok)
