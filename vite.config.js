import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// La couche UI (React) vit dans renderer/ui ; Vite y a sa racine.
// Les couches renderer/domain et renderer/app restent importables via des chemins relatifs.
export default defineConfig({
  root: resolve(__dirname, 'renderer/ui'),
  base: './',
  plugins: [react()],
  resolve: {
    // Préférer les sources .ts aux .js compilés du moteur (engine/*.js, produits par
    // tsc pour le worker Node, sont en CommonJS et cassent l'analyse ESM de Rollup).
    extensions: ['.mts', '.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
  },
  build: {
    outDir: resolve(__dirname, 'renderer/ui/dist'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
