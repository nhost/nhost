import hoc from '@nhost/nextjs'
import { NHOST_URL } from './nhost-url'

export const withNhost = hoc({
  backendUrl: NHOST_URL
})
