import { ErrorPayload } from '../errors'
import { User } from '../types'

export interface ActionErrorState {
  /** @return `true` if an error occurred */
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

export interface CommonActionState extends ActionErrorState, ActionLoadingState {}

export interface ActionSuccessState {
  /** Returns `true` if the action is successful. */
  isSuccess: boolean
}

export interface DefaultActionState extends CommonActionState, ActionSuccessState {}

export interface SessionActionState extends DefaultActionState {
  /** User information */
  user: User | null
  /** Access token (JWT) */
  accessToken: string | null
}
export type SessionActionHandlerResult = Omit<SessionActionState, 'isLoading'>
