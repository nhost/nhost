import { resolve } from 'node:path';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'StripeGraphqlJs',
      formats: ['es', 'cjs'],
      fileName: (format) => {
        const ext = format === 'cjs' ? 'cjs' : 'js';
        return `stripe-graphql-js.${ext}`;
      },
    },
    rollupOptions: {
      external: [
        'tslib',
        '@pothos/core',
        'graphql',
        'graphql-scalars',
        'graphql-yoga',
        'jsonwebtoken',
        'stripe',
      ],
      output: {
        globals: {},
      },
    },
    target: ['es2022'],
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: true,
    minify: 'terser',
  },
  plugins: [
    peerDepsExternal(),
    nodeResolve({
      preferBuiltins: true,
    }),
  ],
});
