# Fewer Labs Games

Fewer Labs' games and the store that hosts them. Each folder is its own project with its own build, PWA and Vercel config; they share no code at runtime (each has its own copy of the small engine in `src/core/`).

| Folder | Project |
|---|---|
| [`store/`](store/) | Fewer Labs Games: the storefront that lists every game and plays them on phone and desktop |
| [`deep-dive/`](deep-dive/) | Deep Dive: dive a darkening trench, one button (landscape) or steering (portrait) |
| [`ripple/`](ripple/) | Ripple: tap ripples to push paper boats to their docks |
| [`skip/`](skip/) | Skip: skip a stone across an endless lake with perfectly timed taps |

## Deploying

Each folder is its own Vercel project. In Vercel, import this repository once per folder and set the **Root Directory** to `store`, `deep-dive`, `ripple` or `skip`. Then point the store at the games with the `VITE_GAME_*_URL` variables (see [`store/README.md`](store/README.md)). Every folder's `vercel.json` sets the build and output, and an `ignoreCommand` ([`scripts/vercel-ignore.sh`](scripts/vercel-ignore.sh)) skips the build unless that folder changed since the last deploy, so a push to `deep-dive/` only rebuilds Deep Dive, and changes outside the four folders rebuild nothing.

## Working on a game

```bash
cd deep-dive      # or ripple, skip, store
npm install
npm run dev
```
