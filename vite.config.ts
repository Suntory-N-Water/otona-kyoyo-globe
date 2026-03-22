import { writeFileSync } from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/** ビルド時に robots.txt と sitemap.xml を生成するプラグイン */
function seoFilesPlugin(): Plugin {
  let baseUrl = '';
  return {
    name: 'seo-files',
    configResolved(config) {
      baseUrl = config.env.VITE_BASE_URL ?? '';
    },
    closeBundle() {
      writeFileSync(
        'dist/robots.txt',
        `User-agent: *\nAllow: /\n\nSitemap: ${baseUrl}/sitemap.xml\n`,
      );
      writeFileSync(
        'dist/sitemap.xml',
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${baseUrl}/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>\n`,
      );
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), seoFilesPlugin()],
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
