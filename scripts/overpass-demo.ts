/**
 * Script de démonstration : récupère une vraie bbox via Overpass et affiche la
 * distribution des terrains. Lancement : `npm run ingest:demo`.
 *
 * Optionnel : passer une bbox en arguments `south west north east`, p.ex.
 *   npm run ingest:demo -- 43.121 5.928 43.135 5.944
 */
import { join } from 'node:path'
import { ingestBounds } from '../renderer/app/services/overpass'
import { FileOsmCache } from '../renderer/app/services/osmCache'
import { getOverpassConfig } from '../renderer/app/services/overpass.config'
import { type Bounds, TerrainType, TERRAIN_TYPES } from '../renderer/domain/types'

// Zone par défaut : un secteur autour de Toulon (Var), zone à risque feu de forêt.
const DEFAULT_BOUNDS: Bounds = {
  south: 43.121,
  west: 5.928,
  north: 43.155,
  east: 5.974,
}

function parseBounds(argv: string[]): Bounds {
  if (argv.length < 4) return DEFAULT_BOUNDS
  const [south, west, north, east] = argv.slice(0, 4).map(Number)
  if ([south, west, north, east].some((n) => Number.isNaN(n))) {
    throw new Error('Arguments bbox invalides : attendu `south west north east` numériques')
  }
  return { south: south!, west: west!, north: north!, east: east! }
}

async function main(): Promise<void> {
  const bounds = parseBounds(process.argv.slice(2))
  const cache = new FileOsmCache(join(process.cwd(), '.cache', 'osm'))
  const config = getOverpassConfig()

  console.log('Endpoint :', config.endpoint)
  console.log('Bbox     :', bounds)
  console.log('Requête en cours (réseau ou cache)…')

  const { geojson, distribution } = await ingestBounds(bounds, { cache, config })

  console.log(`\n${geojson.features.length} features classées.`)
  console.log('Distribution des terrains :')
  for (const t of TERRAIN_TYPES) {
    const count = distribution[t]
    if (count > 0) console.log(`  ${TerrainType[t].padEnd(12)} ${count}`)
  }
}

main().catch((err) => {
  console.error('Échec :', err instanceof Error ? err.message : err)
  process.exitCode = 1
})
