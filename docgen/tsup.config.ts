import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['./src/index.ts'],
  splitting: true,
  sourcemap: true,
  dts: true,
  clean: true,
  format: ['cjs']
})
