import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['engine/__tests__/**/*.test.ts'],
  },
})
