/**
 * Classifieur PUR : associe les tags OSM d'une feature à un `TerrainType`.
 *
 * Règles (spec osm-ingestion) :
 *  - match exact `clé=valeur` d'abord, puis wildcard `clé=*` ;
 *  - une feature sans aucun tag reconnu est IGNORÉE (renvoie `null`) — règle réversible ;
 *  - aucune mutation, aucun effet de bord, jamais de `Math.random`.
 */

import {
  OSM_TAGS,
  TERRAIN_TYPES,
  TerrainType,
  type Feature,
  type TerrainDistribution,
} from './types'

type TagMap = Record<string, string>

/** Index inversé construit une seule fois à partir de `OSM_TAGS`. */
interface TagIndex {
  /** `"clé=valeur"` -> TerrainType */
  exact: Map<string, TerrainType>
  /** `"clé"` (wildcard `clé=*`) -> TerrainType */
  wildcard: Map<string, TerrainType>
}

function buildIndex(): TagIndex {
  const exact = new Map<string, TerrainType>()
  const wildcard = new Map<string, TerrainType>()
  for (const terrain of TERRAIN_TYPES) {
    for (const tag of OSM_TAGS[terrain]) {
      const eq = tag.indexOf('=')
      const key = tag.slice(0, eq)
      const value = tag.slice(eq + 1)
      if (value === '*') {
        if (!wildcard.has(key)) wildcard.set(key, terrain)
      } else {
        if (!exact.has(tag)) exact.set(tag, terrain)
      }
    }
  }
  return { exact, wildcard }
}

const INDEX = buildIndex()

/** Extrait la table de tags d'une feature GeoJSON (issue d'osmtogeojson). */
function tagsOf(feature: Feature): TagMap {
  const props = feature.properties as Record<string, unknown> | null
  const tags = props?.['tags']
  if (tags && typeof tags === 'object') return tags as TagMap
  // osmtogeojson peut aussi remonter les tags à plat dans properties.
  return (props ?? {}) as TagMap
}

/**
 * Classe une feature OSM en `TerrainType`, ou `null` si aucun tag n'est reconnu.
 * Fonction pure.
 */
export function classify(feature: Feature): TerrainType | null {
  const tags = tagsOf(feature)
  // 1) match exact prioritaire
  for (const [key, value] of Object.entries(tags)) {
    if (typeof value !== 'string') continue
    const hit = INDEX.exact.get(`${key}=${value}`)
    if (hit !== undefined) return hit
  }
  // 2) wildcard
  for (const key of Object.keys(tags)) {
    const hit = INDEX.wildcard.get(key)
    if (hit !== undefined) return hit
  }
  return null
}

function emptyDistribution(): TerrainDistribution {
  const dist = {} as TerrainDistribution
  for (const t of TERRAIN_TYPES) dist[t] = 0
  return dist
}

/**
 * Compte les features par `TerrainType`. Les features non classées (`null`) sont
 * ignorées. Fonction pure.
 */
export function distribution(features: Iterable<Feature>): TerrainDistribution {
  const dist = emptyDistribution()
  for (const feature of features) {
    const terrain = classify(feature)
    if (terrain !== null) dist[terrain] += 1
  }
  return dist
}
