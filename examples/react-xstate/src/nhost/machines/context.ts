import { ApiError } from '../hasura-auth'

// TODO better typing
type User = any //Record<string, unknown>

export type NhostContext = {
  user: User | null
  mfa: boolean
  accessToken: string | null
  refreshToken: string | null
  error: ApiError | null
  email: string | null
  password: string | null
  errors: Partial<Record<'newPassword' | 'newEmail', ApiError>>
  newEmail: ApiError | null
  newPassword: ApiError | null
}

export const INITIAL_CONTEXT: NhostContext = {
  user: null,
  mfa: false,
  accessToken: null,
  refreshToken: null,
  newEmail: null,
  newPassword: null,
  error: null,
  email: null,
  password: null,
  errors: {}
}
