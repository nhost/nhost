import { InterpreterFrom } from 'xstate'

import { WebAuthnMachine } from '../machines'

import { ActionErrorState, ActionLoadingState } from './types'
export interface WebAuthnHandlerResult extends ActionErrorState {}

export interface WebAuthnState extends WebAuthnHandlerResult, ActionLoadingState {}

export const addWebAuthnDevicePromise = async (
  interpreter: InterpreterFrom<WebAuthnMachine>
): Promise<WebAuthnHandlerResult> =>
  new Promise<WebAuthnHandlerResult>((resolve) => {
    interpreter.send('REQUEST')
    interpreter.onTransition((s) => {
      if (s.matches({ idle: 'error' })) {
        resolve({ error: s.context.error, isError: true })
      } else if (s.matches({ idle: 'success' })) {
        resolve({ error: null, isError: false })
      }
    })
  })
