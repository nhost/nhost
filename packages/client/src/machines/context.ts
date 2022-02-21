import { ErrorPayload } from '../errors'

import { getExpiration } from './expiration'

// TODO better typing
type User = any //Record<string, unknown>

export type NhostContext = {
  user: User | null
  mfa: boolean
  accessToken: {
    value: string | null
    expiration: number
  }
  refreshTimer: {
    elapsed: number
    attempts: number
  }
  refreshToken: {
    value: string | null
  }
  errors: Partial<
    Record<'newPassword' | 'newEmail' | 'registration' | 'authentication', ErrorPayload>
  >
}

export const INITIAL_MACHINE_CONTEXT: NhostContext = {
  user: null,
  mfa: false,
  accessToken: {
    value: null,
    expiration: getExpiration()
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
