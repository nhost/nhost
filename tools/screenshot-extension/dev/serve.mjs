// Live-reloading dev server for the toolbar UI. Bundles dev/harness.ts (which
// mounts the real toolbar with the Chrome APIs stubbed) and serves dev/ with
// esbuild's built-in watch + reload. Edit src/content/*.ts -> page reloads.
//
//   pnpm dev   ->   http://localhost:5500/harness.html
//
// Nothing is written to disk; outputs are served from memory.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.SS_DEV_PORT) || 5500;

const ctx = await esbuild.context({
  entryPoints: { harness: path.join(root, 'harness.ts') },
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  sourcemap: true,
  outdir: path.join(root, '.serve'),
  logLevel: 'info',
});

await ctx.watch();
const { hosts, port } = await ctx.serve({
  servedir: root,
  host: '0.0.0.0',
  port: PORT,
});

const lanHost = hosts.find(
  (h) => !['0.0.0.0', '127.0.0.1', 'localhost', '::'].includes(h),
);

console.log('\nScreenshot toolbar harness:');
console.log(`  → http://localhost:${port}/harness.html`);
if (lanHost) {
  console.log(`  → http://${lanHost}:${port}/harness.html`);
}
console.log('\nEditing src/content/*.ts live-reloads the page.\n');
