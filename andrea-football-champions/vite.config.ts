import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base relativa: il gioco funziona in qualsiasi sottocartella (GitHub Pages, Netlify, ecc.)
export default defineConfig({
  base: './',
  build: { outDir: '../docs', emptyOutDir: true, chunkSizeWarningLimit: 1200 },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['icons/*.png', 'favicon.svg'],
      manifest: {
        name: 'Andrea Football Champions',
        short_name: 'Andrea FC',
        description: 'Il gioco di calcio di Andrea: disegna la traiettoria e segna!',
        lang: 'it',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0b2a4a',
        theme_color: '#0b2a4a',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024
      }
    })
  ],
  test: { environment: 'node' }
} as any);
