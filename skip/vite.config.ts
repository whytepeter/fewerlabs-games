import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // --host so the dev server is reachable from a phone on the same Wi-Fi
  server: { host: true },
  preview: { host: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
  plugins: [
    VitePWA({
      // 'prompt': a new version waits until the player taps Update (see src/core/pwa.ts),
      // or takes over on the next launch. The page registers the worker itself via initPWA().
      registerType: 'prompt',
      injectRegister: false,
      manifest: false, // public/manifest.webmanifest
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
});
