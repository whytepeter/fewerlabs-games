import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '../../core/kit.css';
import './style.css';
import Phaser from 'phaser';
import { autoScaleUI, createGame } from '../../core/view';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';

autoScaleUI();

const game = createGame({
  type: Phaser.AUTO,
  backgroundColor: '#062a4a',
  banner: false,
  disableContextMenu: true,
  audio: { noAudio: true }, // all sound is synthesised in core/sfx.ts
  input: { activePointers: 3 },
  render: { antialias: true, powerPreference: 'high-performance' },
  fps: { target: 60 },
  scene: [BootScene, GameScene],
});

// Dev-only handle for debugging and scripted playtests.
if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;
