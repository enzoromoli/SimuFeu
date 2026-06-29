import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  test: {
    projects: [
      {
        // Couches Node : moteur, domaine, services.
        // Préférer les sources .ts aux .js compilés du moteur (engine/*.js produits par
        // build:engine pour le worker Node) — sinon les tests tournent sur des artefacts
        // périmés. Aligné avec vite.config.js (décision 2026-06-28).
        resolve: {
          extensions: ['.mts', '.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
        },
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts', 'engine/__tests__/**/*.test.ts'],
          exclude: ['src/ui/**'],
        },
      },
      {
        // Couche UI : composants React testés sous jsdom.
        plugins: [react()],
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['src/ui/**/*.test.{ts,tsx,js,jsx}'],
          setupFiles: ['./src/ui/test/setup.ts'],
        },
      },
    ],
  },
})
