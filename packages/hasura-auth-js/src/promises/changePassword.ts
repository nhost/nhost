import { InterpreterFrom } from 'xstate'

import { ChangePasswordMachine } from '../machines'

import { ActionErrorState, ActionLoadingState, ActionSuccessState } from './types'

export interface ChangePasswordState extends ChangePasswordHandlerResult, ActionLoadingState {}

export interface ChangePasswordHandlerResult extends ActionErrorState, ActionSuccessState {}

export const changePasswordPromise = async (
  interpreter: InterpreterFrom<ChangePasswordMachine>,
  password: string,
  ticket?: string
): Promise<ChangePasswordHandlerResult> =>
  new Promise<ChangePasswordHandlerResult>((resolve) => {
    interpreter.send('REQUEST', {
      password,
      ticket
    })
    interpreter.onTransition((state) => {
      if (state.matches({ idle: 'error' })) {
        resolve({ error: state.context.error, isError: true, isSuccess: false })
      } else if (state.matches({ idle: 'success' })) {
        resolve({ error: null, isError: false, isSuccess: true })
      }
    })
  })
