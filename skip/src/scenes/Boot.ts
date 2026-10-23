import Phaser from 'phaser';
import { paintAll } from '../game/art';

/** Paints every texture from the current palette, then hands over to the game. */
export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }
  create() {
    paintAll(this);
    this.scene.start('Game');
  }
}
