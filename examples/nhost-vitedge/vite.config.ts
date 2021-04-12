import { UserConfig } from 'vite'
import vitedge from 'vitedge/plugin.js'
import reactRefresh from '@vitejs/plugin-react-refresh'

export default {
  plugins: [vitedge(), reactRefresh()],
} as UserConfig
