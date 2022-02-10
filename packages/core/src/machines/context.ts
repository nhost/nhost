import { ErrorPayload } from '../errors'

// TODO better typing
type User = any //Record<string, unknown>

export type NhostContext = {
  user: User | null
  mfa: boolean
  accessToken: string | null
  refreshToken: string | null
  errors: Partial<
    Record<'newPassword' | 'newEmail' | 'registration' | 'authentication', ErrorPayload>
  >
}

export const INITIAL_CONTEXT: NhostContext = {
  user: null,
  mfa: false,
  accessToken: null,
  refreshToken: null,
  errors: {}
}
