import { InterpreterFrom } from 'xstate'

import { ChangePasswordMachine } from '../machines'

import { DefaultActionState } from './types'

export type ChangePasswordHandlerResult = Omit<DefaultActionState, 'isLoading'>

export const changePasswordPromise = async (
  interpreter: InterpreterFrom<ChangePasswordMachine>,
  password: string
): Promise<ChangePasswordHandlerResult> =>
  new Promise<ChangePasswordHandlerResult>((resolve) => {
    interpreter.send('REQUEST', {
      password
    })
    interpreter.onTransition((state) => {
      if (state.matches({ idle: 'error' })) {
        resolve({ error: state.context.error, isError: true, isSuccess: false })
      } else if (state.matches({ idle: 'success' })) {
        resolve({ error: null, isError: false, isSuccess: true })
      }
    })
  })
