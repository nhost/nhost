import { ApiError } from './backend-services'
import { DEFAULT_TOKEN_EXPIRATION } from './constants'

// TODO better typing
type User = Record<string, unknown>

export type NhostContext = {
  user: User | null
  mfa: boolean
  accessToken: { value: string | null; expiresIn: number }
  refreshToken: {
    value: string | null
    timer: { elapsed: number; attempts: number; error: ApiError | null }
    newToken: { error: ApiError | null }
  }
  error: ApiError | null
  email?: string
  password?: string
  newEmail: { error: ApiError | null }
  newPassword: { error: ApiError | null }
}

export const INITIAL_CONTEXT: NhostContext = {
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
      attempts: 0,
      error: null
    },
    newToken: { error: null }
  },
  newEmail: {
    error: null
  },
  newPassword: {
    error: null
  },
  error: null,
  email: undefined,
  password: undefined
}
