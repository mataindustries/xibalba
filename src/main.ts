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
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: tableLayout.physics.gravityY },
      positionIterations: tableLayout.physics.solverIterations,
      velocityIterations: tableLayout.physics.solverIterations,
      debug: {
        showBody: true,
        showStaticBody: true,
        showInternalEdges: true,
        renderFill: false,
        lineColor: 0x00ff95,
        staticLineColor: 0xff38bd,
      },
    },
  },
  scene: [PinballScene],
}

new Phaser.Game(gameConfig)
