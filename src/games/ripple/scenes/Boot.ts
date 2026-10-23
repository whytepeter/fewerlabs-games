import Phaser from 'phaser';
import { buildNeutralTextures, buildThemedTextures, setBoatSkin } from '../game/art';
import { boatShop } from '../game/meta';

/** Draws every texture once (no image files to load), then hands over to the game. */
export class Boot extends Phaser.Scene {
  constructor() { super('boot'); }

  create() {
    buildNeutralTextures(this);
    setBoatSkin(boatShop.equipped);
    buildThemedTextures(this);
    this.scene.start('game');
  }
}
