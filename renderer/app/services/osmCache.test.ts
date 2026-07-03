import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cacheKey, FileOsmCache } from './osmCache'

describe('cacheKey', () => {
  it('est déterministe pour les mêmes entrées', () => {
    expect(cacheKey('bbox', 'query')).toBe(cacheKey('bbox', 'query'))
  })

  it('diffère quand une entrée change', () => {
    expect(cacheKey('bbox-a', 'q')).not.toBe(cacheKey('bbox-b', 'q'))
  })
})

describe('FileOsmCache', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'simufeu-cache-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('retourne null sur un miss', async () => {
    const cache = new FileOsmCache(dir)
    expect(await cache.get('absent')).toBeNull()
  })

  it('set puis get relit la valeur', async () => {
    const cache = new FileOsmCache(dir)
    const payload = { hello: 'world', n: 42 }
    await cache.set('k1', payload)
    expect(await cache.get('k1')).toEqual(payload)
  })

  it('expire les entrées plus vieilles que le TTL', async () => {
    let clock = 1_000
    const ttl = 100
    const cache = new FileOsmCache(dir, ttl, () => clock)
    await cache.set('k', { v: 1 })
    clock += ttl + 1 // dépasse le TTL
    expect(await cache.get('k')).toBeNull()
  })
})
