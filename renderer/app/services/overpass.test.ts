import { describe, it, expect, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import {
  buildQuery,
  classifyCollection,
  fetchOverpass,
  ingestBounds,
  normalize,
  type OverpassDeps,
  type OverpassJson,
} from './overpass'
import { getOverpassConfig } from './overpass.config'
import type { OsmCache } from './osmCache'
import { type Bounds, TerrainType } from '../../domain/types'

const BOUNDS: Bounds = { south: 43.0, west: 6.0, north: 43.2, east: 6.1 }

const here = dirname(fileURLToPath(import.meta.url))

async function loadFixture(): Promise<OverpassJson> {
  const path = join(here, '..', '..', '__fixtures__', 'overpass-sample.json')
  return JSON.parse(await readFile(path, 'utf8')) as OverpassJson
}

/** Cache en mémoire (test) implémentant l'interface OsmCache. */
function memCache(): OsmCache {
  const store = new Map<string, unknown>()
  return {
    get: async <T>(k: string) => (store.has(k) ? (store.get(k) as T) : null),
    set: async <T>(k: string, v: T) => {
      store.set(k, v)
    },
  }
}

function okResponse(json: unknown): Response {
  return { ok: true, status: 200, statusText: 'OK', json: async () => json } as Response
}

describe('buildQuery', () => {
  it('produit une seule requête couvrant tous les tags + le wildcard', () => {
    const q = buildQuery(BOUNDS, getOverpassConfig({}))
    // exemples de tags exacts
    expect(q).toContain('["landuse"="forest"]')
    expect(q).toContain('["natural"="water"]')
    expect(q).toContain('["landuse"="commercial"]')
    // wildcard waterway=* -> filtre sur la clé seule
    expect(q).toContain('["waterway"]')
    expect(q).not.toContain('["waterway"="*"]')
    // un seul bloc union (une ligne « ( » et une ligne « ); »)
    expect(q.match(/^\($/gm)?.length).toBe(1)
    expect(q.match(/^\);$/gm)?.length).toBe(1)
    expect(q).toContain('out geom;')
  })

  it('réordonne la bbox en sud,ouest,nord,est', () => {
    const q = buildQuery(BOUNDS, getOverpassConfig({}))
    expect(q).toContain('(43,6,43.2,6.1)')
  })
})

describe('fetchOverpass (cache)', () => {
  it('appelle le réseau au 1er appel, puis lit le cache au 2e (même bbox)', async () => {
    const fixture = await loadFixture()
    const fetchFn = vi.fn(async () => okResponse(fixture))
    const deps: OverpassDeps = {
      cache: memCache(),
      fetchFn: fetchFn as unknown as typeof fetch,
      config: getOverpassConfig({}),
    }

    const first = await fetchOverpass(BOUNDS, deps)
    const second = await fetchOverpass(BOUNDS, deps)

    expect(fetchFn).toHaveBeenCalledTimes(1) // 2e appel servi par le cache
    expect(first).toEqual(second)
  })

  it('lève une erreur sur réponse HTTP non OK', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: false,
      status: 504,
      statusText: 'Gateway Timeout',
    }) as Response)
    const deps: OverpassDeps = {
      cache: memCache(),
      fetchFn: fetchFn as unknown as typeof fetch,
      config: getOverpassConfig({}),
    }
    await expect(fetchOverpass(BOUNDS, deps)).rejects.toThrow(/504/)
  })
})

describe('normalize + classifyCollection', () => {
  it('normalise puis classe la fixture avec la bonne distribution', async () => {
    const fixture = await loadFixture()
    const fc = normalize(fixture)
    const { geojson, distribution } = classifyCollection(fc)

    expect(distribution[TerrainType.FOREST]).toBe(1)
    expect(distribution[TerrainType.WATER]).toBe(2) // natural=water + waterway=river
    expect(distribution[TerrainType.ROCK]).toBe(1)
    // highway=track ignoré
    expect(geojson.features).toHaveLength(4)
    // chaque feature classée porte un `terrain`
    for (const f of geojson.features) {
      expect(typeof f.properties.terrain).toBe('number')
    }
  })
})

describe('ingestBounds (bout en bout, offline)', () => {
  it('renvoie le GeoJSON classé + la distribution depuis la fixture', async () => {
    const fixture = await loadFixture()
    const fetchFn = vi.fn(async () => okResponse(fixture))
    const deps: OverpassDeps = {
      cache: memCache(),
      fetchFn: fetchFn as unknown as typeof fetch,
      config: getOverpassConfig({}),
    }

    const { geojson, distribution } = await ingestBounds(BOUNDS, deps)
    expect(geojson.type).toBe('FeatureCollection')
    expect(geojson.features.length).toBe(4)
    expect(distribution[TerrainType.WATER]).toBe(2)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })
})
