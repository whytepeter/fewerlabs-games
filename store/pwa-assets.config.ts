import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// icon.svg is a full-bleed tile with the mark already inside the maskable safe zone,
// so the apple and maskable icons need no extra padding (the default pads them in white).
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0 },
    apple: { ...minimal2023Preset.apple, padding: 0 },
  },
  images: ['public/icon.svg'],
});
