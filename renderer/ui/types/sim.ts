import type { Bounds } from '../../domain/types'

// Paramètres de configuration d'une simulation (écran de config).
export interface SimParams {
  simName: string
  simDate: string
  simDescription: string
  windDirection: number
  windSpeed: number
  windGust: number
  temperature: number
  humidity: number
  vegetation: string
  fuelMoisture: number
}

export type ParamKey = keyof SimParams

// Mise à jour typée d'un paramètre (la valeur suit le type du champ).
export type UpdateParam = <K extends ParamKey>(key: K, value: SimParams[K]) => void

// Zone d'étude dessinée sur la carte.
export interface Zone {
  bounds: Bounds
  areaKm2: number
}

export type MapLayer = 'plan' | 'satellite'
