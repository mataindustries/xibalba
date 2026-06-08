import Phaser from 'phaser'
import './style.css'
import { tableLayout } from './config/tableLayout'
import { PinballScene } from './scenes/PinballScene'

const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: tableLayout.table.width,
  height: tableLayout.table.height,
  backgroundColor: '#050810',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: tableLayout.table.width,
    height: tableLayout.table.height,
  },
  input: {
    activePointers: 3,
  },
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: tableLayout.tuning.gravity },
      positionIterations: tableLayout.physics.solverIterations,
      velocityIterations: tableLayout.physics.solverIterations,
      debug: false,
    },
  },
  scene: [PinballScene],
}

new Phaser.Game(gameConfig)
