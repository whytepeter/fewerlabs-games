# Fewer Labs Games

Three independent, endless one-thumb games. Each folder is its own project with its own build, PWA and Vercel config; they share no code at runtime (each has its own copy of the small engine in `src/core/`).

| Folder | Game |
|---|---|
| [`deep-dive/`](deep-dive/) | Deep Dive: dive a darkening trench, one button (landscape) or steering (portrait) |
| [`ripple/`](ripple/) | Ripple: tap ripples to push paper boats to their docks |
| [`skip/`](skip/) | Skip: skip a stone across an endless lake with perfectly timed taps |

## Deploying

Each game is its own Vercel project. In Vercel, import this repository three times and set the **Root Directory** to `deep-dive`, `ripple` and `skip` respectively. Every folder's `vercel.json` sets the build and output.

## Working on a game

```bash
cd deep-dive      # or ripple, skip
npm install
npm run dev
```
