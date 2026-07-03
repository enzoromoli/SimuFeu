/**
 * Types du domaine pour l'ingestion OSM.
 *
 * `TerrainType` et `OSM_TAGS` proviennent désormais de l'ENGINE (source unique de
 * vérité, depuis le merge de `simu-engine`). On ne ré-importe que des DONNÉES PURES
 * (`engine/types`, `engine/terrainConfig`) — aucune logique de simulation. Resync de
 * l'ancienne copie locale effectué : voir docs/decisions.md.
 */

import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from 'geojson'
import { TerrainType } from '../../engine/types'
import { TERRAIN_CONFIG } from '../../engine/terrainConfig'

export type { Feature, FeatureCollection, GeoJsonProperties, Geometry }
export { TerrainType }

/** Boîte englobante en degrés (lat/lon). Objet nommé pour éviter les bugs d'ordre. */
export interface Bounds {
  south: number
  west: number
  north: number
  east: number
}

/** Valeurs numériques de `TerrainType` (0..8), dérivées de l'enum de l'engine. */
export const TERRAIN_TYPES: readonly TerrainType[] = Object.values(TerrainType).filter(
  (v): v is TerrainType => typeof v === 'number',
)

/**
 * Tags OSM source par type de terrain — dérivés des `osmTags` de `TERRAIN_CONFIG`
 * (`engine/terrainConfig.ts`). Format `clé=valeur` ; `clé=*` est un wildcard
 * (n'importe quelle valeur de la clé).
 */
export const OSM_TAGS: Record<TerrainType, readonly string[]> = TERRAIN_TYPES.reduce(
  (acc, t) => {
    acc[t] = TERRAIN_CONFIG[t].osmTags
    return acc
  },
  {} as Record<TerrainType, readonly string[]>,
)

/** Distribution : nombre de features par type de terrain. */
export type TerrainDistribution = Record<TerrainType, number>

/**
 * Feature GeoJSON enrichie d'un type de terrain dans ses propriétés.
 * `terrain` est ajouté par le classifieur lors de l'ingestion.
 */
export type ClassifiedProperties = GeoJsonProperties & { terrain: TerrainType }
export type ClassifiedFeature = Feature<Geometry, ClassifiedProperties>
