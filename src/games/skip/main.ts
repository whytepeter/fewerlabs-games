import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '../../core/kit.css';
import './style.css';
import Phaser from 'phaser';
import { createGame, autoScaleUI } from '../../core/view';
import { P } from './game/palette';
import { Boot } from './scenes/Boot';
import { Game } from './scenes/Game';

// Block page gestures the game doesn't want: pinch zoom, double-tap zoom, long-press menus.
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());

autoScaleUI();

async function start() {
  // Canvas text needs the web font ready before the first popup is drawn.
  try {
    await Promise.race([
      Promise.all(['500 20px Fredoka', '600 20px Fredoka', '700 20px Fredoka'].map(f => document.fonts.load(f))),
      new Promise(r => setTimeout(r, 1500)),
    ]);
  } catch { /* fall back to system font */ }
  createGame({
    type: Phaser.AUTO,
    backgroundColor: P['sky-bot'],
    banner: false,
    audio: { noAudio: true },
    input: { activePointers: 3 },
    render: { antialias: true, roundPixels: false },
    scene: [Boot, Game],
  });
}
void start();
