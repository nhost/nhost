import { nhostNextMiddleware } from '@nhost/nextjs'
import { NHOST_URL } from './nhost-url'

export const middleware = nhostNextMiddleware(NHOST_URL)
