import type { ErrorPayload } from '../errors'
import { User } from '../types'

export type AuthContext = {
  user: User | null
  mfa: {
    ticket: string
  } | null
  accessToken: {
    value: string | null
    expiresAt: Date
  }
  refreshTimer: {
    startedAt: Date | null
    attempts: number
    lastAttempt: Date | null
  }
  refreshToken: {
    value: string | null
  }
  errors: Partial<Record<'registration' | 'authentication' | 'signout', ErrorPayload>>
}

export const INITIAL_MACHINE_CONTEXT: AuthContext = {
  user: null,
  mfa: null,
  accessToken: {
    value: null,
    expiresAt: new Date()
  },
  refreshTimer: {
    startedAt: null,
    attempts: 0,
    lastAttempt: null
  },
  refreshToken: {
    value: null
  },
  errors: {}
}
