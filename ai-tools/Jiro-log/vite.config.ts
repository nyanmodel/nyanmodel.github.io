import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  base: '/ai-tools/Jiro-log/',
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
    manifest: {
      name: 'Jirō Log — 一杯を、自分の記録に。', short_name: 'Jirō Log', lang: 'ja',
      description: '写真からはじめる、二郎・二郎系の食事ログ。',
      theme_color: '#f6f4ed', background_color: '#f6f4ed', display: 'standalone',
      start_url: '/ai-tools/Jiro-log/#/visits', scope: '/ai-tools/Jiro-log/',
      icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }]
    },
    workbox: { globPatterns: ['**/*.{js,css,html,png,svg,woff2}'], navigateFallback: 'index.html', cleanupOutdatedCaches: true }
  })]
});
