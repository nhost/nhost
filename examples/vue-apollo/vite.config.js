import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

import vue from '@vitejs/plugin-vue'
import vuetify from '@vuetify/vite-plugin'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tsconfigPaths(),
    vue(),
    vuetify({
      autoImport: true
    })
  ]
  // define: { 'process.env': {} },
  // resolve: {
  //   alias: {
  //     '@': path.resolve(__dirname, 'src')
  //   }
  // }
})
