import { describe, it, expect } from 'vitest'
import { getBeaufort } from './beaufort'

describe('getBeaufort', () => {
  it('classe une vitesse dans la bonne force', () => {
    expect(getBeaufort(0).force).toBe(0)
    expect(getBeaufort(15)).toMatchObject({ force: 3, label: 'Petite brise', level: 'moderate' })
    expect(getBeaufort(50).force).toBe(7)
  })

  it('borne haute : au-delà de 117 km/h → ouragan (force 12)', () => {
    expect(getBeaufort(200)).toMatchObject({ force: 12, level: 'extreme' })
  })

  it('renvoie toujours un palier (jamais undefined)', () => {
    for (const v of [-5, 0, 1, 11, 117, 118, 9999]) {
      expect(getBeaufort(v)).toBeDefined()
    }
  })
})
