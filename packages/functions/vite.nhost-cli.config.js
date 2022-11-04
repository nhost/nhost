import glob from 'glob'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const files = glob.sync('dev/**/*.ts', { cwd: __dirname, ignore: ['**/_*/**', 'dev/public/**'] })

export default defineConfig({
  publicDir: 'dev/public',
  build: {
    outDir: 'functions',
    target: 'node16',
    ssr: true,

    rollupOptions: {
      // preserveModules: true,
      input: Object.fromEntries(
        files.map((file) => {
          return [
            // This remove `dev/` as well as the file extension from each file, so e.g.
            // src/nested/foo.js becomes nested/foo
            path.relative('dev', file.slice(0, file.length - path.extname(file).length)),
            // This expands the relative paths to absolute paths, so e.g.
            // src/nested/foo becomes /project/src/nested/foo.js
            fileURLToPath(new URL(file, import.meta.url))
          ]
        })
      ),
      output: {
        // entryFileNames: '[name].js',
        chunkFileNames: '_chunks/[hash].js'
      }
    },
    lib: {
      entry: files,
      formats: ['cjs']
    }
  }
})
