import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false
      },
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icon-*.png'],
      manifest: {
        name: 'AI智能衣橱',
        short_name: '智能衣橱',
        description: 'AI智能衣橱 - 拍照识别、智能管理您的衣物',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1989fa',
        orientation: 'portrait',
        icons: [
          { src: '/icon-72x72.png', sizes: '72x72', type: 'image/png', purpose: 'maskable any' },
          { src: '/icon-96x96.png', sizes: '96x96', type: 'image/png', purpose: 'maskable any' },
          { src: '/icon-128x128.png', sizes: '128x128', type: 'image/png', purpose: 'maskable any' },
          { src: '/icon-144x144.png', sizes: '144x144', type: 'image/png', purpose: 'maskable any' },
          { src: '/icon-152x152.png', sizes: '152x152', type: 'image/png', purpose: 'maskable any' },
          { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable any' },
          { src: '/icon-384x384.png', sizes: '384x384', type: 'image/png', purpose: 'maskable any' },
          { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable any' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /\/uploads\/.*\.(?:png|jpg|jpeg|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wardrobe-images',
              expiration: {
                maxEntries: 120,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          },
          {
            urlPattern: /\/api\/.*$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'wardrobe-api',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 10
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    host: true,  // 允许局域网访问
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  }
})
