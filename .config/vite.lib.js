import fs from 'fs'
import path from 'path'

import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import tsconfigPaths from 'vite-tsconfig-paths'

// import reactRefresh from '@vitejs/plugin-react-refresh'
const PWD = process.env.PWD
const pkg = require(path.join(PWD, 'package.json'))

export const lib = {
  entry: path.resolve(PWD, 'src/index.ts'),
  name: pkg.name,
  fileName: 'index'
}
export const basePlugins = [
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
]

/**
 * @type {import('vite').UserConfig}
 */
export default defineConfig({
  plugins: basePlugins,
  build: {
    lib
  }
})

// export const react = defineConfig({
//   plugins: [reactRefresh(), ...basePlugins],
//   build: {
//     lib,
//     rollupOptions: {
//       external: ['react'],
//       output: {
//         globals: {
//           react: 'react'
//         }
//       }

//       //   external: ['react', 'vue'],
//       //   output: {
//       //     globals: {
//       //       react: 'react',
//       //       vue: 'vue'
//       //     }
//       //   }
//     }
//   }
// })
