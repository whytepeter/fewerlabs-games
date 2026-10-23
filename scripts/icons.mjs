// Generates PWA icons (PNG + favicon) next to every public/**/icon.svg.
// Run after changing an icon: npm run icons
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const svgs = ['public/icon.svg'];
for (const d of readdirSync('public', { withFileTypes: true })) {
  if (d.isDirectory() && existsSync(join('public', d.name, 'icon.svg'))) svgs.push(join('public', d.name, 'icon.svg'));
}
for (const svg of svgs.filter(existsSync)) {
  console.log(`icons: ${svg}`);
  execFileSync('npx', ['pwa-assets-generator', '--preset', 'minimal-2023', svg], { stdio: 'inherit' });
}
