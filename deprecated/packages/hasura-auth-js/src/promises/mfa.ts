import { InterpreterFrom } from 'xstate'

import { EnableMfadMachine } from '../machines'

import { AuthActionErrorState } from './types'

export interface GenerateQrCodeHandlerResult extends AuthActionErrorState {
  qrCodeDataUrl: string
  isGenerated: boolean
  totpSecret: string | null
}

export interface GenerateQrCodeState extends GenerateQrCodeHandlerResult {
  isGenerating: boolean
}

export interface ActivateMfaHandlerResult extends AuthActionErrorState {
  isActivated: boolean
}

export interface DisableMfaHandlerResult extends AuthActionErrorState {
  isDisabled: boolean
}

export interface ActivateMfaState extends ActivateMfaHandlerResult {
  isActivating: boolean
}

export const generateQrCodePromise = (service: InterpreterFrom<EnableMfadMachine>) =>
  new Promise<GenerateQrCodeHandlerResult>((resolve) => {
    service.send('GENERATE')
    service.onTransition((state) => {
      if (state.matches('generated')) {
        resolve({
          error: null,
          isError: false,
          isGenerated: true,
          qrCodeDataUrl: state.context.imageUrl || '',
          totpSecret: state.context.secret
        })
      } else if (state.matches({ idle: 'error' })) {
        resolve({
          error: state.context.error || null,
          isError: true,
          isGenerated: false,
          qrCodeDataUrl: '',
          totpSecret: state.context.secret
        })
      }
    })
  })

export const activateMfaPromise = (service: InterpreterFrom<EnableMfadMachine>, code: string) =>
  new Promise<ActivateMfaHandlerResult>((resolve) => {
    service.send('ACTIVATE', {
      activeMfaType: 'totp',
      code
    })
    service.onTransition((state) => {
      if (state.matches({ generated: 'activated' })) {
        resolve({ error: null, isActivated: true, isError: false })
      } else if (state.matches({ generated: { idle: 'error' } })) {
        resolve({ error: state.context.error, isActivated: false, isError: true })
      }
    })
  })

export const disableMfaPromise = (service: InterpreterFrom<EnableMfadMachine>, code: string) =>
  new Promise<DisableMfaHandlerResult>((resolve) => {
    service.send('DISABLE', { code })
    service.onTransition((state) => {
      if (state.matches({ idle: 'disabled' })) {
        resolve({ error: null, isDisabled: true, isError: false })
      } else if (state.matches({ idle: 'error' })) {
        resolve({ error: state.context.error, isDisabled: false, isError: true })
      }
    })
  })
