import { resolve } from 'node:path';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: {
        'nhost-js': resolve(__dirname, 'src/index.ts'),
        'nhost-js/auth': resolve(__dirname, 'src/auth/index.ts'),
        'nhost-js/fetch': resolve(__dirname, 'src/fetch/index.ts'),
        'nhost-js/functions': resolve(__dirname, 'src/functions/index.ts'),
        'nhost-js/graphql': resolve(__dirname, 'src/graphql/index.ts'),
        'nhost-js/session': resolve(__dirname, 'src/session/index.ts'),
        'nhost-js/storage': resolve(__dirname, 'src/storage/index.ts'),
      },
      name: 'NhostJs',
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => {
        const ext = format === 'cjs' ? 'cjs' : 'js';
        return entryName === 'nhost-js'
          ? `nhost-js.${ext}`
          : `${entryName}.${ext}`;
      },
    },
    rollupOptions: {
      external: ['tslib'],
      output: {
        globals: {},
      },
    },
    target: ['es2022'],
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: true,
    minify: 'terser',
    cssCodeSplit: true,
  },
  plugins: [
    peerDepsExternal(),
    nodeResolve({
      browser: true,
      preferBuiltins: true,
    }),
  ],
});
