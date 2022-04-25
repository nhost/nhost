import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import baseConfig from './vite.config.base'

export default defineConfig({
  ...baseConfig,
  plugins: [react(), ...baseConfig.plugins],
  build: {
    ...baseConfig.build,
    rollupOptions: {
      ...baseConfig.rollupOptions,
      external: ['react', 'react-dom', '@nhost/react'],
      output: {
        globals: {
          react: 'react',
          'react-dom': 'react-dom',
          '@nhost/react': '@nhost/react'
        }
      }
    }
  }
})
