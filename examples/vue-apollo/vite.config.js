import { defineConfig } from 'vite'
import path from 'path'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
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
