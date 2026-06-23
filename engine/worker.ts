import { parentPort } from 'worker_threads'
import { makeGrid } from './hexUtils'
import { step, placeInitialFire, paintTerrain } from './simEngine'
import { TERRAIN_CONFIG } from './terrainConfig'
import { SimState, TerrainType } from './types'

const DEFAULT_RADIUS = 12

type InMsg =
  | { type: 'init';     radius?: number }
  | { type: 'step' }
  | { type: 'ignite';   id: string }
  | { type: 'paint';    id: string; terrain: TerrainType }
  | { type: 'setPhase'; phase: SimState['phase'] }
  | { type: 'reset';    radius?: number }

let state: SimState = {
  cells: makeGrid(DEFAULT_RADIUS),
  tick:  0,
  phase: 'setup',
}

function serializeState(s: SimState) {
  return {
    cells:         Array.from(s.cells.values()),
    tick:          s.tick,
    phase:         s.phase,
    terrainConfig: TERRAIN_CONFIG,
  }
}

function send(msg: object): void {
  parentPort!.postMessage(msg)
}

parentPort!.on('message', (msg: InMsg) => {
  switch (msg.type) {

    case 'init': {
      const radius = msg.radius ?? DEFAULT_RADIUS
      state = { cells: makeGrid(radius), tick: 0, phase: 'setup' }
      send({ type: 'state', ...serializeState(state) })
      break
    }

    case 'step': {
      state = step(state)
      send({ type: 'state', ...serializeState(state) })
      break
    }

    case 'ignite': {
      state = placeInitialFire(msg.id, state)
      send({ type: 'state', ...serializeState(state) })
      break
    }

    case 'paint': {
      state = paintTerrain(msg.id, msg.terrain, state)
      send({ type: 'state', ...serializeState(state) })
      break
    }

    case 'setPhase': {
      state = { ...state, phase: msg.phase }
      send({ type: 'state', ...serializeState(state) })
      break
    }

    case 'reset': {
      const radius = msg.radius ?? DEFAULT_RADIUS
      state = { cells: makeGrid(radius), tick: 0, phase: 'setup' }
      send({ type: 'state', ...serializeState(state) })
      break
    }

    default: {
      const _exhaustive: never = msg
      send({ type: 'error', message: `unknown message type` })
    }
  }
})
