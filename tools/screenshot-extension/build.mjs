import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = path.dirname(fileURLToPath(import.meta.url));
const outdir = path.join(root, 'dist');
const watch = process.argv.includes('--watch');

const options = {
  entryPoints: {
    background: path.join(root, 'src/background.ts'),
    content: path.join(root, 'src/content/index.ts'),
  },
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  outdir,
  logLevel: 'info',
};

async function copyStatic() {
  await mkdir(outdir, { recursive: true });
  await copyFile(
    path.join(root, 'manifest.json'),
    path.join(outdir, 'manifest.json'),
  );

  const iconsSrc = path.join(root, 'icons');
  const iconsOut = path.join(outdir, 'icons');
  await mkdir(iconsOut, { recursive: true });
  for (const entry of await readdir(iconsSrc)) {
    if (entry.endsWith('.png')) {
      await copyFile(path.join(iconsSrc, entry), path.join(iconsOut, entry));
    }
  }
}

await copyStatic();

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('watching… (manifest changes need a manual rebuild)');
} else {
  await esbuild.build(options);
}
