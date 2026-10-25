import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

/**
 * App icons from public/icon.svg (`npm run icons`). The art is full-bleed, so no padding: the default
 * preset shrinks it onto a white tile, which looks like a framed sticker on the home screen. The doodle
 * head sits inside the middle 80%, so the maskable crop keeps it whole.
 */
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0 },
    apple: { ...minimal2023Preset.apple, padding: 0 },
  },
  images: ['public/icon.svg'],
});
