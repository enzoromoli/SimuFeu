import { parentPort } from 'worker_threads'
import { makeGrid } from './gridUtils'
import { placeInitialFire, paintTerrain, loadTerrains } from './simEngine'
import { createHistoryManager, HistoryManager } from './historyManager'
import { TERRAIN_CONFIG } from './terrainConfig'
import { NEUTRAL_WEATHER } from './weather'
import { SimState } from './types'
import { WorkerInMsg } from './protocol'

const DEFAULT_RADIUS_X = 20
const DEFAULT_RADIUS_Y = 20
const DEFAULT_SEED     = 0xdeadbeef

type InMsg = WorkerInMsg

// État de départ neutre : la météo réelle arrive ensuite via le message `setWeather`.
function initialState(radiusX: number, radiusY: number): SimState {
  return { cells: makeGrid(radiusX, radiusY), tick: 0, phase: 'setup', weather: NEUTRAL_WEATHER }
}

let hm: HistoryManager = createHistoryManager(initialState(DEFAULT_RADIUS_X, DEFAULT_RADIUS_Y), DEFAULT_SEED)
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
      const radiusX = msg.radiusX ?? DEFAULT_RADIUS_X
      const radiusY = msg.radiusY ?? DEFAULT_RADIUS_Y
      const seed    = msg.seed    ?? DEFAULT_SEED
      hm = createHistoryManager(initialState(radiusX, radiusY), seed)
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

    case 'setWeather': {
      hm.applyAndInvalidate(currentTick, s => ({ ...s, weather: msg.weather }))
      sendCurrentState()
      break
    }

    case 'setPhase': {
      hm.applyAndInvalidate(currentTick, s => ({ ...s, phase: msg.phase }))
      sendCurrentState()
      break
    }

    case 'reset': {
      const radiusX = msg.radiusX ?? DEFAULT_RADIUS_X
      const radiusY = msg.radiusY ?? DEFAULT_RADIUS_Y
      const seed    = msg.seed    ?? DEFAULT_SEED
      hm = createHistoryManager(initialState(radiusX, radiusY), seed)
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
