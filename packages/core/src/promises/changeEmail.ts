import { InterpreterFrom } from 'xstate'

import { ChangeEmailMachine } from '../machines'
import { ChangeEmailOptions } from '../types'

import { CommonActionState } from './types'

export interface ChangeEmailState extends CommonActionState {
  needsEmailVerification: boolean
}
export type ChangeEmailHandlerResult = Omit<ChangeEmailState, 'isLoading'>

export const changeEmailPromise = async (
  interpreter: InterpreterFrom<ChangeEmailMachine>,
  email: string,
  options?: ChangeEmailOptions
): Promise<ChangeEmailHandlerResult> =>
  new Promise<ChangeEmailHandlerResult>((resolve) => {
    interpreter.send('REQUEST', {
      email,
      options
    })
    interpreter.onTransition((s) => {
      if (s.matches({ idle: 'error' })) {
        resolve({ error: s.context.error, isError: true, needsEmailVerification: false })
      } else if (s.matches({ idle: 'success' })) {
        resolve({ error: null, isError: false, needsEmailVerification: true })
      }
    })
  })
