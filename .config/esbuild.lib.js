const esbuild = require('esbuild')

// Automatically exclude all node_modules from the bundled version
const { nodeExternalsPlugin } = require('esbuild-node-externals')
esbuild
  .build({
    entryPoints: ['./src/index.ts'],
    outfile: 'dist/index.cjs.js',
    bundle: true,
    minify: true,
    platform: 'node',
    format: 'cjs',
    sourcemap: true,
    target: 'node14',
    plugins: [nodeExternalsPlugin()]
  })
  .catch(() => process.exit(1))

esbuild
  .build({
    entryPoints: ['./src/index.ts'],
    outfile: 'dist/index.es.js',
    bundle: true,
    minify: true,
    platform: 'browser',
    format: 'esm',
    sourcemap: true,
    target: 'es2019'
  })
  .catch(() => process.exit(1))
