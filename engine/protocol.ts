// Contrat de communication UI ↔ worker moteur.
// Module de TYPES uniquement (aucune dépendance Node) : importable côté worker
// (engine/worker.ts) comme côté renderer (renderer/ui, renderer/domain).
import { Cell, SimPhase, SimState, TerrainType, Weather } from './types'
import { TerrainConfig } from './terrainConfig'

/** Terrain d'une cellule, pour le remplissage en masse. */
export interface TerrainPatch {
  id: string
  terrain: TerrainType
}

/** Messages reçus par le worker (UI → moteur). */
export type WorkerInMsg =
  | { type: 'init';        radiusX?: number; radiusY?: number; seed?: number }
  | { type: 'navigate';    direction: 'forward' | 'backward' | 'jump'; tick?: number }
  | { type: 'ignite';      id: string }
  | { type: 'paint';       id: string; terrain: TerrainType }
  | { type: 'loadTerrain'; cells: TerrainPatch[] }
  | { type: 'setWeather';  weather: Weather }
  | { type: 'setPhase';    phase: SimState['phase'] }
  | { type: 'reset';       radiusX?: number; radiusY?: number; seed?: number }

/** État complet d'un tick, sérialisé pour le renderer. */
export interface StateMsg {
  type: 'state'
  cells: Cell[]
  tick: number
  phase: SimPhase
  terrainConfig: Record<TerrainType, TerrainConfig>
  tickMax: number
}

/** Messages émis par le worker (moteur → UI). */
export type WorkerOutMsg =
  | StateMsg
  | { type: 'error'; message: string }
