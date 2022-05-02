import fs from 'fs'
import path from 'path'

import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import tsconfigPaths from 'vite-tsconfig-paths'

const PWD = process.env.PWD
const pkg = require(path.join(PWD, 'package.json'))

const tsEntry = path.resolve(PWD, 'src/index.ts')
const entry = fs.existsSync(tsEntry) ? tsEntry : tsEntry.replace('.ts', '.tsx')

const deps = [...Object.keys(Object.assign({}, pkg.peerDependencies, pkg.dependencies))]

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    dts({
      exclude: ['**/*.spec.ts', '**/*.test.ts', '**/tests/**'],
      afterBuild: () => {
        const types = fs.readdirSync(path.join(PWD, 'dist/src'))
        types.forEach((file) => {
          fs.renameSync(path.join(PWD, 'dist/src', file), path.join(PWD, 'dist', file))
        })
        fs.rmdirSync(path.join(PWD, 'dist/src'))
      }
    })
  ],
  build: {
    sourcemap: true,
    lib: {
      entry,
      name: pkg.name,
      fileName: 'index',
      formats: ['cjs', 'es']
    },
    rollupOptions: {
      external: (id) => deps.some((dep) => id.startsWith(dep)),
      output: {
        globals: {
          'graphql/language/printer': 'graphql/language/printer',
          '@apollo/client': '@apollo/client',
          '@apollo/client/link/context': '@apollo/client/link/context',
          '@apollo/client/link/subscriptions': '@apollo/client/link/subscriptions',
          '@apollo/client/utilities': '@apollo/client/utilities',
          'graphql-ws': 'graphql-ws',
          xstate: 'xstate',
          axios: 'axios',
          'js-cookie': 'Cookies',
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': '_jsx',
          '@nhost/react': '@nhost/react'
        }
      }
    }
  }
})
