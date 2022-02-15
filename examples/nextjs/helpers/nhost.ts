import { configureNhostSSR } from '@nhost/nextjs'
import { NHOST_URL } from './nhost-url'

export const withNhost = configureNhostSSR({
  backendUrl: NHOST_URL
})
