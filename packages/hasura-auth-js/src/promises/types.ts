import { ErrorPayload, User } from '../types'

export interface ActionErrorState {
  /**
   * @return `true` if an error occurred
   * @depreacted use `!isSuccess` or `!!error` instead
   * */
  isError: boolean
  /** Provides details about the error */
  error: ErrorPayload | null
}

export interface ActionLoadingState {
  /**
   * @return `true` when the action is executing, `false` when it finished its execution.
   */
  isLoading: boolean
}

export interface ActionSuccessState {
  /** Returns `true` if the action is successful. */
  isSuccess: boolean
}

export interface SessionActionHandlerResult extends ActionSuccessState, ActionErrorState {
  /** User information */
  user: User | null
  /** Access token (JWT) */
  accessToken: string | null
}

export interface NeedsEmailVerificationState {
  /** @return `true` if an email is required to complete the action, and that a verification email has been sent to complete the action. */
  needsEmailVerification: boolean
}
