import { ErrorPayload } from '../errors'

export type NhostEvents =
  | { type: 'SESSION_UPDATE'; data: any } // TODO type
  | { type: 'TRY_TOKEN'; token: string }
  | { type: 'SIGNIN_PASSWORD'; email: string; password: string }
  | { type: 'SIGNIN_PASSWORDLESS_EMAIL'; email: string }
  | { type: 'REGISTER'; email: string; password: string }
  | { type: 'TOKEN_REFRESH_ERROR'; error: ErrorPayload }
  | { type: 'SIGNOUT'; all?: boolean }
  | { type: 'CHANGE_EMAIL'; email: string }
  | { type: 'CHANGE_EMAIL_SUCCESS' }
  | { type: 'CHANGE_EMAIL_LOADING' }
  | { type: 'CHANGE_EMAIL_INVALID'; error: ErrorPayload }
  | { type: 'CHANGE_EMAIL_ERROR'; error: ErrorPayload }
  | { type: 'CHANGE_PASSWORD'; password: string }
  | { type: 'CHANGE_PASSWORD_INVALID'; error: ErrorPayload }
  | { type: 'CHANGE_PASSWORD_SUCCESS' }
  | { type: 'CHANGE_PASSWORD_LOADING' }
  | { type: 'CHANGE_PASSWORD_ERROR'; error: ErrorPayload }
