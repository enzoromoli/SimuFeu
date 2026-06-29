/**
 * Client Overpass + orchestrateur d'ingestion OSM.
 *
 * Seul effet de bord : l'appel réseau (isolé dans `fetchOverpass`), médiatisé par un
 * cache injecté. Tout le reste est pur. La conversion de `Bounds` vers l'ordre Overpass
 * (sud, ouest, nord, est) est faite ICI et jamais exposée à l'appelant.
 */

import osmtogeojson from 'osmtogeojson'
import {
  type Bounds,
  type ClassifiedFeature,
  type Feature,
  type FeatureCollection,
  type Geometry,
  OSM_TAGS,
  TERRAIN_TYPES,
  type TerrainDistribution,
} from '../../domain/types'
import { classify } from '../../domain/osmClassify'
import { type OsmCache, cacheKey } from './osmCache'
import {
  getOverpassConfig,
  type OverpassConfig,
} from './overpass.config'

/** Résultat d'une ingestion : GeoJSON classé + distribution des terrains. */
export interface IngestResult {
  geojson: FeatureCollection<Geometry, { terrain: number }>
  distribution: TerrainDistribution
}

/** Dépendances injectables (pour les tests : `fetchFn` et `cache` mockables). */
export interface OverpassDeps {
  cache: OsmCache
  fetchFn?: typeof fetch
  config?: OverpassConfig
}

/** Convertit un `Bounds` en bbox Overpass `sud,ouest,nord,est`. Interne. */
function toOverpassBbox(b: Bounds): string {
  return `${b.south},${b.west},${b.north},${b.east}`
}

/**
 * Construit l'UNIQUE requête Overpass : union de TOUS les `OSM_TAGS`, en un seul appel.
 * Gère le wildcard (`clé=*` -> filtre sur la seule clé).
 */
export function buildQuery(bounds: Bounds, config: OverpassConfig): string {
  const bbox = toOverpassBbox(bounds)
  const seen = new Set<string>()
  const selectors: string[] = []
  for (const terrain of TERRAIN_TYPES) {
    for (const tag of OSM_TAGS[terrain]) {
      if (seen.has(tag)) continue
      seen.add(tag)
      const eq = tag.indexOf('=')
      const key = tag.slice(0, eq)
      const value = tag.slice(eq + 1)
      const selector = value === '*' ? `["${key}"]` : `["${key}"="${value}"]`
      selectors.push(`  nwr${selector}(${bbox});`)
    }
  }
  return [
    `[out:json][timeout:${config.timeoutSeconds}][maxsize:${config.maxSizeBytes}];`,
    '(',
    ...selectors,
    ');',
    'out geom;',
  ].join('\n')
}

/** Forme minimale de la réponse Overpass JSON consommée par osmtogeojson. */
export interface OverpassJson {
  elements: unknown[]
  [k: string]: unknown
}

/**
 * Récupère la réponse Overpass brute pour une bbox. Lit le cache d'abord ;
 * n'appelle le réseau qu'en cas de miss, puis met en cache. SEUL effet de bord.
 */
export async function fetchOverpass(
  bounds: Bounds,
  deps: OverpassDeps,
): Promise<OverpassJson> {
  const config = deps.config ?? getOverpassConfig()
  const query = buildQuery(bounds, config)
  const key = cacheKey(toOverpassBbox(bounds), query)

  const cached = await deps.cache.get<OverpassJson>(key)
  if (cached !== null) return cached

  const fetchFn = deps.fetchFn ?? fetch
  const res = await fetchFn(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': config.userAgent,
    },
    body: `data=${encodeURIComponent(query)}`,
  })
  if (!res.ok) {
    throw new Error(`Overpass HTTP ${res.status} ${res.statusText}`)
  }
  const json = (await res.json()) as OverpassJson
  await deps.cache.set(key, json)
  return json
}

/** Normalise une réponse Overpass en GeoJSON via osmtogeojson. Pur. */
export function normalize(overpass: OverpassJson): FeatureCollection {
  return osmtogeojson(overpass) as FeatureCollection
}

function emptyDistribution(): TerrainDistribution {
  const dist = {} as TerrainDistribution
  for (const t of TERRAIN_TYPES) dist[t] = 0
  return dist
}

/**
 * Annote chaque feature d'un `terrain` et calcule la distribution. Les features sans
 * tag reconnu sont ignorées (cf. classifieur). Pur.
 */
export function classifyCollection(fc: FeatureCollection): IngestResult {
  const dist = emptyDistribution()
  const classified: ClassifiedFeature[] = []
  for (const feature of fc.features as Feature[]) {
    const terrain = classify(feature)
    if (terrain === null) continue
    dist[terrain] += 1
    classified.push({
      ...feature,
      properties: { ...(feature.properties ?? {}), terrain },
    })
  }
  return {
    geojson: { type: 'FeatureCollection', features: classified },
    distribution: dist,
  }
}

/**
 * Point d'entrée public : `Bounds` -> GeoJSON classé + distribution.
 * fetch (caché) -> normalisation -> classification.
 */
export async function ingestBounds(
  bounds: Bounds,
  deps: OverpassDeps,
): Promise<IngestResult> {
  const overpass = await fetchOverpass(bounds, deps)
  const fc = normalize(overpass)
  return classifyCollection(fc)
}
