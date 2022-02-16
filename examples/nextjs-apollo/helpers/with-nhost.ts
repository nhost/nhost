import { configureNhostSSR } from '@nhost/nextjs'

export const withNhost = configureNhostSSR({
  backendUrl: 'http://127.0.0.1:1337'
})
