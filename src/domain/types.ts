/**
 * Types du domaine pour l'ingestion OSM.
 *
 * NOTE : `TerrainType` et `OSM_TAGS` sont une COPIE LOCALE de l'engine
 * (`engine/types.ts` + `engine/terrainConfig.ts`, branche `simu-engine` non mergée).
 * Tant que `simu-engine` n'est pas mergée sur `dev`, on s'interdit d'importer depuis
 * `engine/`. À RESYNCHRONISER au merge (voir docs/decisions.md, 2026-06-25).
 */

import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from 'geojson'

export type { Feature, FeatureCollection, GeoJsonProperties, Geometry }

/** Boîte englobante en degrés (lat/lon). Objet nommé pour éviter les bugs d'ordre. */
export interface Bounds {
  south: number
  west: number
  north: number
  east: number
}

/**
 * Type de terrain — COPIE de `engine/types.ts`.
 * Les valeurs numériques sont identiques à l'engine (resync au merge).
 */
export enum TerrainType {
  WATER = 0,
  ROCK = 1,
  WETLAND = 2,
  GRASSLAND = 3,
  FARMLAND = 4,
  SCRUB = 5,
  FOREST = 6,
  RESIDENTIAL = 7,
  INDUSTRIAL = 8,
}

/**
 * Tags OSM source par type de terrain — COPIE des `osmTags` de `TERRAIN_CONFIG`
 * (`engine/terrainConfig.ts`). Format `clé=valeur` ; `clé=*` est un wildcard
 * (n'importe quelle valeur de la clé). Resync au merge.
 */
export const OSM_TAGS: Record<TerrainType, readonly string[]> = {
  [TerrainType.WATER]: ['natural=water', 'waterway=*', 'landuse=reservoir'],
  [TerrainType.ROCK]: ['natural=bare_rock', 'natural=scree', 'natural=cliff'],
  [TerrainType.WETLAND]: ['natural=wetland'],
  [TerrainType.GRASSLAND]: ['natural=grassland', 'landuse=meadow', 'landuse=grass'],
  [TerrainType.FARMLAND]: ['landuse=farmland', 'landuse=orchard', 'landuse=vineyard'],
  [TerrainType.SCRUB]: ['natural=scrub', 'natural=heath'],
  [TerrainType.FOREST]: ['landuse=forest', 'natural=wood'],
  [TerrainType.RESIDENTIAL]: ['landuse=residential'],
  [TerrainType.INDUSTRIAL]: ['landuse=industrial', 'landuse=commercial'],
}

/** Liste des valeurs numériques de `TerrainType` (utile pour itérer/typer). */
export const TERRAIN_TYPES: readonly TerrainType[] = [
  TerrainType.WATER,
  TerrainType.ROCK,
  TerrainType.WETLAND,
  TerrainType.GRASSLAND,
  TerrainType.FARMLAND,
  TerrainType.SCRUB,
  TerrainType.FOREST,
  TerrainType.RESIDENTIAL,
  TerrainType.INDUSTRIAL,
]

/** Distribution : nombre de features par type de terrain. */
export type TerrainDistribution = Record<TerrainType, number>

/**
 * Feature GeoJSON enrichie d'un type de terrain dans ses propriétés.
 * `terrain` est ajouté par le classifieur lors de l'ingestion.
 */
export type ClassifiedProperties = GeoJsonProperties & { terrain: TerrainType }
export type ClassifiedFeature = Feature<Geometry, ClassifiedProperties>
