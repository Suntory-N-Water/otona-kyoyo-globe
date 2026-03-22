import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // three.js は本質的に大きいため警告リミットを調整
    chunkSizeWarningLimit: 2000,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // three.js と react-globe.gl は最大のバンドルのため最優先で分割
            {
              name: 'three-vendor',
              test: /node_modules[\\/]three/,
              priority: 30,
            },
            {
              name: 'globe-vendor',
              test: /node_modules[\\/]react-globe\.gl/,
              priority: 20,
            },
            // leaflet 系
            {
              name: 'leaflet-vendor',
              test: /node_modules[\\/](leaflet|react-leaflet)/,
              priority: 15,
            },
            // その他 node_modules
            { name: 'vendor', test: /node_modules/, priority: 10 },
          ],
        },
      },
    },
  },
});
