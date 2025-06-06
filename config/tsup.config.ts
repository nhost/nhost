import { defineConfig } from 'tsup'

import path from 'path'
import fs from 'fs'

const packageJsonPath = path.resolve(process.cwd(), 'package.json')
const rawPackageJson = fs.readFileSync(packageJsonPath, 'utf-8')
const packageJson = JSON.parse(rawPackageJson)

const createGlobalName = (packageName: string) =>
  'Nhost' +
  packageName
    .replace(/@nhost\//g, '')
    .replace(/-([a-z])/g, (g) => g[1].toUpperCase())
    .replace(/^./, (str: string) => str.toUpperCase())

const clientGlobalName = createGlobalName(packageJson.name)

export default defineConfig([
  // --- Client Build (ESM, CJS) ---
  {
    entry: { 'index': 'src/index.ts' },
    outDir: 'dist',
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    treeshake: true,
    platform: 'browser',
    external: Object.keys(packageJson.dependencies),
    banner: {
      js: '"use client"'
    }
  },

  // --- Client UMD Build ---
  {
    entry: {
      // Define the output filename here (without extension)
      [packageJson.name.replace(/@nhost\//g, '')]: 'src/index.ts' // -> umd/react.js (if name is @nhost/react)
    },
    bundle: true,
    minify: false,
    treeshake: true,
    outDir: 'umd', // Separate output directory for UMD
    format: ['iife'],
    globalName: clientGlobalName, // e.g., NhostReact
    splitting: false,
    sourcemap: true,
    env: {
      NODE_ENV: 'production'
    },
    clean: true,
    platform: 'browser',
    external: Object.keys(packageJson.peerDependencies),
    // TODO: doesnt work, react is not an external still
    esbuildOptions(buildOptions: any) {
      // For UMD, expecting React to be global, so JSX transform should use it.
      buildOptions.jsx = 'automatic' // Transforms JSX to React.createElement
      buildOptions.jsxFactory = 'React.createElement'
      buildOptions.jsxFragment = 'React.Fragment'
    }
  },

  // --- Server Build (ESM) ---
  {
    entry: { 'server': 'src/server.ts' },
    outDir: 'dist',
    format: ['esm'],
    dts: true, // Will create dist/index.server.d.ts
    splitting: false,
    sourcemap: true,
    clean: true,
    treeshake: true,
    platform: 'node',
    external: Object.keys(packageJson.dependencies)
  }
])
