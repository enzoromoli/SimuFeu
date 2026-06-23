export enum CellState {
  INTACT  = 'INTACT',
  ON_FIRE = 'ON_FIRE',
  BURNED  = 'BURNED',
}

export enum TerrainType {
  WATER       = 0, // natural=water, waterway=*, landuse=reservoir
  ROCK        = 1, // natural=bare_rock, natural=scree, natural=cliff
  WETLAND     = 2, // natural=wetland
  GRASSLAND   = 3, // natural=grassland, landuse=meadow, landuse=grass
  FARMLAND    = 4, // landuse=farmland, landuse=orchard, landuse=vineyard
  SCRUB       = 5, // natural=scrub, natural=heath
  FOREST      = 6, // landuse=forest, natural=wood
  RESIDENTIAL = 7, // landuse=residential
  INDUSTRIAL  = 8, // landuse=industrial, landuse=commercial
}

export interface Cell {
  id:               string
  q:                number
  r:                number
  s:                number
  terrain:          TerrainType
  state:            CellState
  fireTick:         number | null
  ignitionPressure: number
}

export type SimPhase = 'setup' | 'running' | 'paused'

export interface SimState {
  cells: Map<string, Cell>
  tick:  number
  phase: SimPhase
}
