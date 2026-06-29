import { describe, it, expect } from 'vitest'
import { NEUTRAL_WEATHER, weatherIgnitionFactor, effectiveBurnDuration } from '../weather'
import { Weather } from '../types'

function w(overrides: Partial<Weather>): Weather {
  return { ...NEUTRAL_WEATHER, ...overrides }
}

// ─── weatherIgnitionFactor ───────────────────────────────────────────────────

describe('weatherIgnitionFactor', () => {
  it('vaut 1 pour la météo neutre (non-régression)', () => {
    expect(weatherIgnitionFactor(NEUTRAL_WEATHER)).toBe(1)
  })

  it('augmente avec la température', () => {
    expect(weatherIgnitionFactor(w({ temperature: 40 }))).toBeGreaterThan(1)
  })

  it('diminue quand il fait froid', () => {
    expect(weatherIgnitionFactor(w({ temperature: 0 }))).toBeLessThan(1)
  })

  it('diminue avec l\'humidité de l\'air', () => {
    expect(weatherIgnitionFactor(w({ humidity: 90 }))).toBeLessThan(1)
  })

  it('diminue avec l\'humidité du combustible', () => {
    expect(weatherIgnitionFactor(w({ fuelMoisture: 40 }))).toBeLessThan(1)
  })

  it('chaud + sec donne un facteur supérieur à humide + froid', () => {
    const hotDry  = w({ temperature: 40, humidity: 10, fuelMoisture: 3 })
    const coldWet = w({ temperature: 5,  humidity: 90, fuelMoisture: 40 })
    expect(weatherIgnitionFactor(hotDry)).toBeGreaterThan(weatherIgnitionFactor(coldWet))
  })

  it('ne descend jamais sous 0', () => {
    const extreme = w({ temperature: -10, humidity: 100, fuelMoisture: 50 })
    expect(weatherIgnitionFactor(extreme)).toBeGreaterThanOrEqual(0)
  })
})

// ─── effectiveBurnDuration ───────────────────────────────────────────────────

describe('effectiveBurnDuration', () => {
  it('un combustible plus humide allonge la durée', () => {
    const dry = effectiveBurnDuration(8, w({ fuelMoisture: 0 }))
    const wet = effectiveBurnDuration(8, w({ fuelMoisture: 50 }))
    expect(wet).toBeGreaterThan(dry)
  })

  it('combustible sec (0 %) conserve la durée de base', () => {
    expect(effectiveBurnDuration(8, w({ fuelMoisture: 0 }))).toBe(8)
  })

  it('une durée de 0 (eau, roche) reste 0', () => {
    expect(effectiveBurnDuration(0, w({ fuelMoisture: 50 }))).toBe(0)
  })

  it('ne descend jamais sous 1 pour un combustible inflammable', () => {
    expect(effectiveBurnDuration(1, w({ fuelMoisture: 0 }))).toBeGreaterThanOrEqual(1)
  })
})
