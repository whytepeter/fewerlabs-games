import { defineConfig } from '@vite-pwa/assets-generator/config';

// App icons from public/icon.svg (`npm run icons`). The art is full-bleed pond water with the
// rings centred inside Android's safe zone (a circle 80% wide), so no icon needs padding: the
// generator's default white margin would show as a white frame on home screens.
const WATER = '#5f9fb4';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: { sizes: [64, 192, 512], favicons: [[48, 'favicon.ico']], padding: 0 },
    maskable: { sizes: [512], padding: 0, resizeOptions: { background: WATER } },
    apple: { sizes: [180], padding: 0, resizeOptions: { background: WATER } },
  },
  images: ['public/icon.svg'],
});
