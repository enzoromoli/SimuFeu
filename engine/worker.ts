import { parentPort } from 'worker_threads'
import { makeGrid } from './hexUtils'
import { placeInitialFire, paintTerrain, loadTerrains } from './simEngine'
import { createHistoryManager, HistoryManager } from './historyManager'
import { TERRAIN_CONFIG } from './terrainConfig'
import { SimState } from './types'
import { WorkerInMsg } from './protocol'

const DEFAULT_RADIUS = 12
const DEFAULT_SEED   = 0xdeadbeef

type InMsg = WorkerInMsg

let hm: HistoryManager = createHistoryManager(
  { cells: makeGrid(DEFAULT_RADIUS), tick: 0, phase: 'setup' },
  DEFAULT_SEED
)
let currentTick = 0

function serializeState(s: SimState, tickMax: number) {
  return {
    cells:         Array.from(s.cells.values()),
    tick:          s.tick,
    phase:         s.phase,
    terrainConfig: TERRAIN_CONFIG,
    tickMax,
  }
}

function send(msg: object): void {
  parentPort!.postMessage(msg)
}

function sendCurrentState(): void {
  send({ type: 'state', ...serializeState(hm.getState(currentTick), hm.tickMax) })
}

parentPort!.on('message', (msg: InMsg) => {
  switch (msg.type) {

    case 'init': {
      const radius = msg.radius ?? DEFAULT_RADIUS
      const seed   = msg.seed   ?? DEFAULT_SEED
      hm = createHistoryManager({ cells: makeGrid(radius), tick: 0, phase: 'setup' }, seed)
      currentTick = 0
      sendCurrentState()
      break
    }

    case 'navigate': {
      if (msg.direction === 'forward') {
        if (currentTick < hm.tickMax) {
          currentTick++
        } else if (!hm.isComplete()) {
          hm.advance()
          currentTick++
        }
        // Si isComplete() et déjà au dernier tick, on ne bouge pas
      } else if (msg.direction === 'backward') {
        if (currentTick > 0) currentTick--
      } else if (msg.direction === 'jump') {
        const target = msg.tick ?? 0
        currentTick = Math.max(0, Math.min(target, hm.tickMax))
      }
      sendCurrentState()
      break
    }

    case 'ignite': {
      hm.applyAndInvalidate(currentTick, s => placeInitialFire(msg.id, s))
      sendCurrentState()
      break
    }

    case 'paint': {
      hm.applyAndInvalidate(currentTick, s => paintTerrain(msg.id, msg.terrain, s))
      sendCurrentState()
      break
    }

    case 'loadTerrain': {
      hm.applyAndInvalidate(currentTick, s => loadTerrains(msg.cells, s))
      sendCurrentState()
      break
    }

    case 'setPhase': {
      hm.applyAndInvalidate(currentTick, s => ({ ...s, phase: msg.phase }))
      sendCurrentState()
      break
    }

    case 'reset': {
      const radius = msg.radius ?? DEFAULT_RADIUS
      const seed   = msg.seed   ?? DEFAULT_SEED
      hm = createHistoryManager({ cells: makeGrid(radius), tick: 0, phase: 'setup' }, seed)
      currentTick = 0
      sendCurrentState()
      break
    }

    default: {
      const _exhaustive: never = msg
      send({ type: 'error', message: `unknown message type` })
    }
  }
})
