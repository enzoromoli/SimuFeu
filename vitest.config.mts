import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  test: {
    projects: [
      {
        // Couches Node : moteur, domaine, services. Inchangé.
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
