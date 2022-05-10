import { InterpreterFrom } from 'xstate'

import { ResetPasswordMachine } from '../machines'
import { ResetPasswordOptions } from '../types'

import { CommonActionState } from './types'

export interface ResetPasswordState extends CommonActionState {
  isSent: boolean
}

export type ResetPasswordHandlerResult = Omit<ResetPasswordState, 'isLoading'>

export const resetPasswordPromise = async (
  interpreter: InterpreterFrom<ResetPasswordMachine>,
  email: string,
  options?: ResetPasswordOptions
): Promise<ResetPasswordHandlerResult> =>
  new Promise((resolve) => {
    interpreter.send('REQUEST', {
      email,
      options
    })
    interpreter.onTransition((state) => {
      if (state.matches({ idle: 'error' })) {
        resolve({ error: state.context.error, isError: true, isSent: false })
      } else if (state.matches({ idle: 'success' })) {
        resolve({ error: null, isError: false, isSent: true })
      }
    })
  })
