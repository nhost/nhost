import { ErrorPayload } from '../errors'
import type { NhostSession, PasswordlessOptions, SignUpOptions } from '../types'

export type NhostEvents =
  | { type: 'SESSION_UPDATE'; data: { session: NhostSession } }
  | { type: 'TRY_TOKEN'; token: string }
  | { type: 'SIGNIN_ANONYMOUS' }
  | { type: 'SIGNIN_PASSWORD'; email?: string; password?: string }
  | {
    type: 'SIGNIN_PASSWORDLESS_EMAIL'
    email?: string
    options?: PasswordlessOptions
  }
  | { type: 'SIGNUP_EMAIL_PASSWORD'; email?: string; password?: string; options?: SignUpOptions }
  | { type: 'TOKEN_REFRESH_ERROR'; error: ErrorPayload }
  | { type: 'SIGNOUT'; all?: boolean }
