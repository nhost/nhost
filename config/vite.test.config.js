import { defineConfig } from 'vitest/config'

const cwd = process.cwd()

export default defineConfig({
  test: {
    coverage: {
      enabled: true
    },
    testTimeout: 30000,
    environment: 'node',
    watch: false,
    include: [`${cwd}/src/**/*.{spec,test}.{ts,tsx}`, `${cwd}/tests/**/*.{spec,test}.{ts,tsx}`]
  }
})
