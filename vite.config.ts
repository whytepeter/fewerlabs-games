import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// One page per game: any top-level folder with an index.html becomes /<folder>/.
const root = import.meta.dirname;
const pages: Record<string, string> = {
  hub: resolve(root, 'index.html'),
  notFound: resolve(root, '404.html'), // Vercel serves /404.html for any unknown path
};
for (const dir of readdirSync(root, { withFileTypes: true })) {
  if (!dir.isDirectory() || ['node_modules', 'dist', 'public', 'src', 'scripts'].includes(dir.name)) continue;
  const html = resolve(root, dir.name, 'index.html');
  if (existsSync(html)) pages[dir.name] = html;
}

export default defineConfig({
  // --host so the dev server is reachable from a phone on the same Wi-Fi
  server: { host: true },
  preview: { host: true },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
    rolldownOptions: { input: pages },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // Each game ships its own manifest (public/<game>/manifest.webmanifest) so it can be
      // installed as its own app; one service worker at / caches the whole site for offline play.
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
});
