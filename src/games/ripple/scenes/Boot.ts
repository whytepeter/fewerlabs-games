import Phaser from 'phaser';
import { buildNeutralTextures, buildThemedTextures } from '../game/art';

/** Draws every texture once (no image files to load), then hands over to the game. */
export class Boot extends Phaser.Scene {
  constructor() { super('boot'); }

  create() {
    buildNeutralTextures(this);
    buildThemedTextures(this);
    this.scene.start('game');
  }
}
