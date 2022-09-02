import { InterpreterFrom } from 'xstate'

import { SecurityKeyMachine } from '../machines'

import { ActionErrorState, ActionLoadingState } from './types'
export interface SecurityKeyHandlerResult extends ActionErrorState {}

export interface SecurityKeyState extends SecurityKeyHandlerResult, ActionLoadingState {}

export const addSecurityKeyPromise = async (
  interpreter: InterpreterFrom<SecurityKeyMachine>,
  nickname?: string
): Promise<SecurityKeyHandlerResult> =>
  new Promise<SecurityKeyHandlerResult>((resolve) => {
    interpreter.send({ type: 'REQUEST', nickname })
    interpreter.onTransition((s) => {
      if (s.matches({ idle: 'error' })) {
        resolve({ error: s.context.error, isError: true })
      } else if (s.matches({ idle: 'success' })) {
        resolve({ error: null, isError: false })
      }
    })
  })
