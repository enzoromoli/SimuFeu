import { describe, it, expect } from 'vitest'
import { getOverpassConfig, OVERPASS_DEFAULTS } from './overpass.config'

describe('getOverpassConfig', () => {
  it('utilise l\'endpoint par défaut sans variable d\'environnement', () => {
    const cfg = getOverpassConfig({})
    expect(cfg.endpoint).toBe('https://overpass-api.de/api/interpreter')
  })

  it('surcharge l\'endpoint via OVERPASS_ENDPOINT', () => {
    const cfg = getOverpassConfig({ OVERPASS_ENDPOINT: 'https://mirror.example/api' })
    expect(cfg.endpoint).toBe('https://mirror.example/api')
  })

  it('ignore une variable vide et retombe sur le défaut', () => {
    const cfg = getOverpassConfig({ OVERPASS_ENDPOINT: '   ' })
    expect(cfg.endpoint).toBe('https://overpass-api.de/api/interpreter')
  })

  it('expose les garde-fous timeout/maxsize et un User-Agent non vide', () => {
    const cfg = getOverpassConfig({})
    expect(cfg.timeoutSeconds).toBe(OVERPASS_DEFAULTS.timeoutSeconds)
    expect(cfg.maxSizeBytes).toBe(OVERPASS_DEFAULTS.maxSizeBytes)
    expect(cfg.userAgent.length).toBeGreaterThan(0)
  })
})
