import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: { host: true, port: 5180 },
  preview: { host: true },
  build: { target: 'es2022' },
  plugins: [
    VitePWA({
      // A new version waits until the visitor taps Update (src/core/pwa.ts).
      registerType: 'prompt',
      injectRegister: false,
      manifest: false, // public/manifest.webmanifest
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
        // The store is a single-page app: any route offline falls back to the shell.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
