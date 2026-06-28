import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// La couche UI (React) vit dans src/ui ; Vite y a sa racine.
// Les couches src/domain et src/app restent importables via des chemins relatifs.
export default defineConfig({
  root: resolve(__dirname, 'src/ui'),
  base: './',
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, 'src/ui/dist'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
