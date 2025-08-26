import { InterpreterFrom } from 'xstate'

import { SendVerificationEmailMachine } from '../machines'
import { SendVerificationEmailOptions } from '../types'

import { AuthActionErrorState, AuthActionLoadingState } from './types'

export interface SendVerificationEmailHandlerResult extends AuthActionErrorState {
  /** Returns `true` when a new verification email has been sent */
  isSent: boolean
}

export interface SendVerificationEmailState
  extends AuthActionLoadingState,
    SendVerificationEmailHandlerResult {}

export const sendVerificationEmailPromise = (
  interpreter: InterpreterFrom<SendVerificationEmailMachine>,
  email: string,
  options?: SendVerificationEmailOptions
): Promise<SendVerificationEmailHandlerResult> =>
  new Promise<SendVerificationEmailHandlerResult>((resolve) => {
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
