import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// globals: false → on nettoie le DOM manuellement entre chaque test.
afterEach(() => cleanup())
