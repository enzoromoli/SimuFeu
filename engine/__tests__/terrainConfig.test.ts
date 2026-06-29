import { describe, it, expect } from 'vitest'
import { TERRAIN_CONFIG, PRESSURE_COEFF, NEIGHBOR_FIRE_WEIGHT } from '../terrainConfig'
import { TerrainType } from '../types'

describe('TERRAIN_CONFIG', () => {
  it('contient une entrée pour chaque TerrainType', () => {
    const numericTypes = Object.values(TerrainType).filter(v => typeof v === 'number') as TerrainType[]
    for (const t of numericTypes) {
      expect(TERRAIN_CONFIG[t], `TerrainType ${t} manquant`).toBeDefined()
    }
  })

  it('flammability est entre 0 et 1 pour tous les types', () => {
    for (const [key, cfg] of Object.entries(TERRAIN_CONFIG)) {
      expect(cfg.flammability, `terrain ${key}`).toBeGreaterThanOrEqual(0)
      expect(cfg.flammability, `terrain ${key}`).toBeLessThanOrEqual(1)
    }
  })

  it('burnDuration est positif ou nul', () => {
    for (const cfg of Object.values(TERRAIN_CONFIG)) {
      expect(cfg.burnDuration).toBeGreaterThanOrEqual(0)
    }
  })

  it('spreadBonus est entre 0 et 1', () => {
    for (const cfg of Object.values(TERRAIN_CONFIG)) {
      expect(cfg.spreadBonus).toBeGreaterThanOrEqual(0)
      expect(cfg.spreadBonus).toBeLessThanOrEqual(1)
    }
  })

  it('color est une couleur hexadécimale valide', () => {
    for (const cfg of Object.values(TERRAIN_CONFIG)) {
      expect(cfg.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('osmTags est un tableau non-vide pour chaque type', () => {
    for (const cfg of Object.values(TERRAIN_CONFIG)) {
      expect(Array.isArray(cfg.osmTags)).toBe(true)
      expect(cfg.osmTags.length).toBeGreaterThan(0)
    }
  })

  it('WATER et ROCK ont une flammabilité de 0', () => {
    expect(TERRAIN_CONFIG[TerrainType.WATER].flammability).toBe(0)
    expect(TERRAIN_CONFIG[TerrainType.ROCK].flammability).toBe(0)
  })

  it('SCRUB a la plus haute flammabilité', () => {
    const max = Math.max(...Object.values(TERRAIN_CONFIG).map(c => c.flammability))
    expect(TERRAIN_CONFIG[TerrainType.SCRUB].flammability).toBe(max)
  })

  it('FOREST a la plus longue durée de combustion', () => {
    const max = Math.max(...Object.values(TERRAIN_CONFIG).map(c => c.burnDuration))
    expect(TERRAIN_CONFIG[TerrainType.FOREST].burnDuration).toBe(max)
  })
})

describe('constantes de propagation', () => {
  it('PRESSURE_COEFF est strictement positif', () => {
    expect(PRESSURE_COEFF).toBeGreaterThan(0)
  })

  it('NEIGHBOR_FIRE_WEIGHT est strictement positif', () => {
    expect(NEIGHBOR_FIRE_WEIGHT).toBeGreaterThan(0)
  })
})
