// public/icon.svg から PWA 用の PNG アイコンを作る（アイコンを変えたときだけ実行）
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const svg = await readFile(new URL('../public/icon.svg', import.meta.url));
const out = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));

const sizes = [
  ['pwa-64x64.png', 64],
  ['pwa-192x192.png', 192],
  ['pwa-512x512.png', 512],
  ['maskable-icon-512x512.png', 512],
  ['apple-touch-icon-180x180.png', 180],
];

for (const [name, size] of sizes) {
  await sharp(svg, { density: 300 }).resize(size, size).flatten({ background: '#1F49AE' }).png().toFile(out(name));
  console.log('wrote', name);
}
