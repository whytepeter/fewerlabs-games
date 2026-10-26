/**
 * The games in the store. Each game is hosted on its own (its own Vercel project); the store
 * embeds it from `url`. Set the VITE_GAME_*_URL variables once the games are deployed; in
 * development they fall back to the local game dev servers.
 */

export type GameId = 'draw-am' | 'deep-dive' | 'ripple' | 'skip';

export interface Game {
  id: GameId;
  title: string;
  tagline: string;
  description: string;
  howTo: [string, string][];
  controls: { touch: string; mouse: string; keys: string };
  tags: string[];
  /** Unit shown after a score, e.g. "m" for metres. */
  unit: string;
  scoreLabel: string;
  /** Brand colour and a background gradient for banners and the player. */
  color: string;
  bg: string;
  /** Best played in landscape on phones (the store suggests rotating). */
  landscapeFirst: boolean;
  url: string;
  /**
   * Opens on its own site instead of inside the store, for games whose site refuses to be framed
   * (X-Frame-Options / frame-ancestors) or that need the full page, like a live multiplayer room.
   */
  external?: boolean;
  /** The store's headline game: first in the banner. */
  featured?: boolean;
  /** Its banner art is a poster with its own title, so the banner frames it instead of filling with it. */
  poster?: boolean;
}

/** A game's own site: its local dev server in `npm run dev`, its fewerlabs.dev subdomain otherwise. */
const dev = (port: number, live: string) => (import.meta.env.DEV ? `http://${location.hostname}:${port}` : live);
const clean = (u: string | undefined, fallback: string) => (u || fallback).replace(/\/+$/, '');

export const GAMES: Game[] = [
  {
    id: 'draw-am',
    title: 'Draw Am',
    tagline: 'Draw am. Guess am. Laugh.',
    description:
      'A free drawing and guessing game for you and your guys, in Pidgin or English. Start a room, share the link on WhatsApp, and take turns drawing while everyone races to guess. Jump into an online room with new players, try the daily challenge, and pick from word packs full of things you know. Local spellings count, so moi moi and moin moin both work.',
    howTo: [
      ['Start a room', 'Pick a name, start a room and share the link with your friends.'],
      ['Draw', 'When it is your turn, draw the word. No letters or numbers on the board.'],
      ['Guess', 'Type what you think the drawing is. Faster guesses score more.'],
      ['Play online', 'No friends around? Join a public room and find players.'],
    ],
    controls: { touch: 'Draw with your finger, type to guess', mouse: 'Click and drag to draw', keys: 'Type your guess and press Enter' },
    tags: ['Multiplayer', 'Drawing', 'Party'],
    unit: '',
    scoreLabel: 'Best',
    color: '#ffc20e',
    bg: '#fff6df',
    landscapeFirst: false,
    url: clean(import.meta.env.VITE_GAME_DRAW_AM_URL, 'https://www.drawam.app'),
    external: true,
    featured: true,
    poster: true,
  },
  {
    id: 'deep-dive',
    title: 'Deep Dive',
    tagline: 'How deep can you go?',
    description:
      'Dive an endless trench that gets darker and narrower with every zone. Grab air bubbles before your tank runs dry, dodge jellyfish, mines, lunging anglerfish and electric eels, and keep clear of the sharp coral. Collect pearls, pick up shields and magnets, and buy new diving suits.',
    howTo: [
      ['Landscape', 'Hold anywhere to swim up, let go to sink.'],
      ['Portrait', 'Touch the left or right half to steer.'],
      ['Air', 'Swim through bubbles to refill your tank.'],
      ['Lives', 'Three lives. Sharp coral and creatures take one.'],
    ],
    controls: { touch: 'Hold (landscape) or tap left/right (portrait)', mouse: 'Hold the mouse button', keys: 'Space / Up to swim, Left/Right to steer' },
    tags: ['One button', 'Endless', 'Underwater'],
    unit: 'm',
    scoreLabel: 'Deepest dive',
    color: '#2b8cff',
    bg: 'linear-gradient(180deg, #2ec4f0 0%, #0e74ad 55%, #0b1c4c 100%)',
    landscapeFirst: false,
    url: clean(import.meta.env.VITE_GAME_DEEP_DIVE_URL, dev(5181, 'https://deepdive.fewerlabs.dev')),
  },
  {
    id: 'ripple',
    title: 'Ripple',
    tagline: 'Float the paper boats home.',
    description:
      'Tap the pond to send out ripples that push paper boats home to the dock that matches their lantern, before their timer runs out. Rings stack and cancel, so a well-placed tap can steer two boats at once. Waves bring golden boats, freeze and life bubbles, and pond twists: wind, whirlpools and lily walls.',
    howTo: [
      ['Tap', 'Tap the water to make a ripple that pushes boats away.'],
      ['Dock', 'Steer each boat into the dock of its colour.'],
      ['Hurry', 'Before the ring around the boat runs out.'],
      ['Waves', 'Every few boats brings a new twist to the pond.'],
    ],
    controls: { touch: 'Tap anywhere on the water', mouse: 'Click the water', keys: 'Space to start, Esc to pause' },
    tags: ['Tap', 'Puzzle-ish', 'Relaxing'],
    unit: '',
    scoreLabel: 'Most boats home',
    color: '#3fb6a0',
    bg: 'linear-gradient(180deg, #a9c48a 0%, #5fb3c6 45%, #1f3d6b 100%)',
    landscapeFirst: false,
    url: clean(import.meta.env.VITE_GAME_RIPPLE_URL, dev(5182, 'https://ripple.fewerlabs.dev')),
  },
  {
    id: 'skip',
    title: 'Skip',
    tagline: 'One stone. One endless lake.',
    description:
      'Pull back to throw a stone across an endless lake, then tap exactly as it touches the water to keep it skipping. Perfect taps keep your speed and build a streak that powers up the music; spamming gets you nowhere. Fly through glass hoops, bounce off lily pads, startle ducks, and unlock stones with their own feel.',
    howTo: [
      ['Throw', 'Pull back anywhere and let go.'],
      ['Tap', 'Exactly as the stone touches the water.'],
      ['Streak', 'Chain Perfects for speed and Fever.'],
      ['Stones', 'Unlock Flat, Heavy, Bouncy and Lucky stones.'],
    ],
    controls: { touch: 'Drag to throw, tap to skip', mouse: 'Drag to throw, click to skip', keys: 'Space / Up to skip, Esc to pause' },
    tags: ['Timing', 'Endless', 'Flow'],
    unit: 'm',
    scoreLabel: 'Longest throw',
    color: '#ff9e7a',
    bg: 'linear-gradient(180deg, #ff9e7a 0%, #ffd27a 50%, #5aa6c4 100%)',
    landscapeFirst: false,
    url: clean(import.meta.env.VITE_GAME_SKIP_URL, dev(5183, 'https://skip.fewerlabs.dev')),
  },
];

/**
 * Screenshots captured from the real game: wide (landscape play), tall (phone play) and its title
 * screen, plus clean hero-* versions without the HUD for banners and cards.
 */
export const shot = (g: Game, kind: 'wide' | 'tall' | 'title' | 'hero-wide' | 'hero-tall') => `/games/${g.id}/${kind}.webp`;

export const featuredGame = GAMES.find(g => g.featured) ?? GAMES[0];

export const gameById = (id: string) => GAMES.find(g => g.id === id);
export const iconUrl = (g: Game) => `/games/${g.id}/icon.svg`;
