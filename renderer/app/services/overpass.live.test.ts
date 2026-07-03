/**
 * Test « vrai réseau » — OPT-IN. Désactivé par défaut (n'est pas lancé par `npm test`).
 * Pour l'exécuter : `OVERPASS_LIVE=1 npx vitest run overpass.live`.
 *
 * Appelle réellement l'API Overpass sur une toute petite bbox.
 */
import { describe, it, expect } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ingestBounds } from './overpass'
import { FileOsmCache } from './osmCache'
import { getOverpassConfig } from './overpass.config'
import type { Bounds } from '../../domain/types'

const LIVE = !!process.env['OVERPASS_LIVE']

// Petite zone (quelques centaines de mètres) pour limiter la charge serveur.
const SMALL_BOUNDS: Bounds = {
  south: 43.121,
  west: 5.928,
  north: 43.125,
  east: 5.934,
}

describe.skipIf(!LIVE)('ingestBounds — vrai réseau (opt-in)', () => {
  it('récupère et classe une vraie zone OSM', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'simufeu-live-'))
    try {
      const deps = { cache: new FileOsmCache(dir), config: getOverpassConfig() }
      const { geojson, distribution } = await ingestBounds(SMALL_BOUNDS, deps)
      expect(geojson.type).toBe('FeatureCollection')
      const total = Object.values(distribution).reduce((a, b) => a + b, 0)
      expect(total).toBeGreaterThanOrEqual(0)
      // eslint-disable-next-line no-console
      console.log('[live] distribution =', distribution)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }, 60_000)
})
