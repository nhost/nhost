import { ErrorPayload, User } from '../../types'

export type StateErrorTypes = 'registration' | 'authentication' | 'signout'

export type AuthContext = {
  user: User | null
  mfa: {
    ticket: string
  } | null
  accessToken: {
    value: string | null
    expiresAt: Date | null
  }
  refreshTimer: {
    startedAt: Date | null
    attempts: number
    lastAttempt: Date | null
  }
  refreshToken: {
    value: string | null
  }
  /** Number of times the user tried to get an access token from a refresh token but got a network error */
  importTokenAttempts: number
  errors: Partial<Record<StateErrorTypes, ErrorPayload>>
}

export const INITIAL_MACHINE_CONTEXT: AuthContext = {
  user: null,
  mfa: null,
  accessToken: {
    value: null,
    expiresAt: null
  },
  refreshTimer: {
    startedAt: null,
    attempts: 0,
    lastAttempt: null
  },
  refreshToken: {
    value: null
  },
  importTokenAttempts: 0,
  errors: {}
}
