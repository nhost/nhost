import { ErrorPayload } from '../errors'
import { User } from '../types'

export type NhostContext = {
  user: User | null
  mfa: boolean
  accessToken: {
    value: string | null
    expiresAt: Date
  }
  refreshTimer: {
    elapsed: number
    attempts: number
  }
  refreshToken: {
    value: string | null
  }
  errors: Partial<
    Record<
      'newPassword' | 'newEmail' | 'registration' | 'authentication' | 'resetPassword',
      ErrorPayload
    >
  >
}

export const INITIAL_MACHINE_CONTEXT: NhostContext = {
  user: null,
  mfa: false,
  accessToken: {
    value: null,
    expiresAt: new Date()
  },
  refreshTimer: {
    elapsed: 0,
    attempts: 0
  },
  refreshToken: {
    value: null
  },
  errors: {}
}
