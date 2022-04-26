import { ErrorPayload } from '@nhost/core'

export interface ActionComposableErrorState {
  /** @return `true` if an error occurred */
  isError: boolean
  /** Provides details about the error */
  error: ErrorPayload | null
}

export interface ActionComposableLoadingState {
  /**
   * @return `true` when the action is executing, `false` when it finished its execution.
   */
  isLoading: boolean
}
export interface CommonActionComposableState
  extends ActionComposableErrorState,
    ActionComposableLoadingState {}

export interface ActionComposableSuccessState {
  /** Returns `true` if the action is successful. */
  isSuccess: boolean
}

export interface DefaultActionComposableState
  extends CommonActionComposableState,
    ActionComposableSuccessState {}
