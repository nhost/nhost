import { DEFAULT_TOKEN_EXPIRATION } from './constants'

// TODO better typing
type User = Record<string, unknown>

export type NhostContext = {
  user: User | null
  mfa: boolean
  accessToken: { value: string | null; expiresIn: number }
  refreshToken: { value: string | null; timer: { elapsed: number; attempts: number } }
  error?: unknown
  email?: string
  password?: string
}

export const INTIAL_CONTEXT: NhostContext = {
  user: null,
  mfa: false,
  accessToken: {
    value: null,
    expiresIn: DEFAULT_TOKEN_EXPIRATION
  },
  refreshToken: {
    value: null,
    timer: {
      elapsed: 0,
      attempts: 0
    }
  },
  error: undefined,
  email: undefined,
  password: undefined
}
