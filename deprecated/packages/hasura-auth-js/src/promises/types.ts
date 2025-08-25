import { AuthErrorPayload, User } from '../types'

export interface AuthActionErrorState {
  /**
   * @return `true` if an error occurred
   * @depreacted use `!isSuccess` or `!!error` instead
   * */
  isError: boolean
  /** Provides details about the error */
  error: AuthErrorPayload | null
}

export interface AuthActionLoadingState {
  /**
   * @return `true` when the action is executing, `false` when it finished its execution.
   */
  isLoading: boolean
}

export interface AuthActionSuccessState {
  /** Returns `true` if the action is successful. */
  isSuccess: boolean
}

export interface SessionActionHandlerResult extends AuthActionSuccessState, AuthActionErrorState {
  /** User information */
  user: User | null
  /** Access token (JWT) */
  accessToken: string | null
  /** Access token (JWT) */
  refreshToken: string | null
}

export interface NeedsEmailVerificationState {
  /** @return `true` if an email is required to complete the action, and that a verification email has been sent to complete the action. */
  needsEmailVerification: boolean
}
