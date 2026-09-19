import { resolve } from 'node:path';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import { defineConfig, type Plugin } from 'vite';

const REACT_ENTRY = 'devtools/react';

/**
 * Put `'use client'` back on the React entry.
 *
 * The directive cannot survive as source: rollup strips module-level
 * directives when it bundles, and an `output.banner` is added early enough for
 * terser to drop it again. Written here, after minification, it stays. Without
 * it the entry cannot be imported from a Next.js server component, since the
 * hook inside makes the module client-only.
 *
 * The directive gets its own line, which pushes every generated line of the
 * chunk down by one. Rollup has already finalised the chunk's source map and
 * vite has emitted it as a sibling `.map` asset by the time this hook runs, so
 * `chunk.map` is a detached copy that no longer feeds the output — the emitted
 * asset is what gets written. Prepend one `;` to that asset's `mappings` to
 * insert an empty generated line for the directive: this shifts every original
 * mapping down to its new line while leaving the per-line columns (untouched
 * by a prologue on its own line) exactly as rollup recorded them, keeping the
 * map (`sourcemap: true` below) aligned. Prepending the directive on the same
 * line instead would leave line counts unchanged but shift every column of the
 * code line by the directive's width, silently mis-mapping the whole entry.
 */
function clientDirectivePlugin(): Plugin {
  return {
    name: 'nhost-devtools-use-client',
    generateBundle(_options, bundle) {
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type !== 'chunk' || chunk.name !== REACT_ENTRY) {
          continue;
        }
        chunk.code = `'use client';\n${chunk.code}`;

        const mapAsset = bundle[`${fileName}.map`];
        if (mapAsset?.type === 'asset' && typeof mapAsset.source === 'string') {
          const map = JSON.parse(mapAsset.source) as { mappings: string };
          map.mappings = `;${map.mappings}`;
          mapAsset.source = JSON.stringify(map);
        }
      }
    },
  };
}

export default defineConfig({
  build: {
    lib: {
      entry: {
        devtools: resolve(__dirname, 'src/index.ts'),
        [REACT_ENTRY]: resolve(__dirname, 'src/react/index.tsx'),
      },
      name: 'NhostDevtools',
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => {
        const ext = format === 'cjs' ? 'cjs' : 'js';
        return entryName === 'devtools'
          ? `devtools.${ext}`
          : `${entryName}.${ext}`;
      },
    },
    rollupOptions: {
      // react is an optional peer dependency: only the /react entry reaches
      // for it, and a vanilla consumer must not be handed a bundled copy.
      external: ['tslib', 'react', 'react/jsx-runtime'],
      output: {
        globals: {},
      },
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
          return;
        }
        warn(warning);
      },
    },
    target: ['es2022'],
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: true,
    minify: 'terser',
    cssCodeSplit: true,
  },
  plugins: [peerDepsExternal(), clientDirectivePlugin()],
});
