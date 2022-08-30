import { USER_ALREADY_SIGNED_IN } from '../errors'
import { AuthInterpreter } from '../types'

import {
  ActionLoadingState,
  NeedsEmailVerificationState,
  SessionActionHandlerResult
} from './types'

export interface SignInWebAuthnHandlerResult
  extends SessionActionHandlerResult,
    NeedsEmailVerificationState {}

export interface SignInWebAuthnState extends SignInWebAuthnHandlerResult, ActionLoadingState {}

export const signInWebAuthnPromise = (interpreter: AuthInterpreter, email: string) =>
  new Promise<SignInWebAuthnHandlerResult>((resolve) => {
    const { changed, context } = interpreter.send({ type: 'SIGNIN_WEBAUTHN', email })
    if (!changed) {
      return resolve({
        accessToken: context.accessToken.value,
        error: USER_ALREADY_SIGNED_IN,
        isError: true,
        isSuccess: false,
        needsEmailVerification: false,
        user: context.user
      })
    }
    interpreter.onTransition((state) => {
      if (
        state.matches({
          authentication: { signedOut: 'noErrors' },
          registration: { incomplete: 'needsEmailVerification' }
        })
      ) {
        resolve({
          accessToken: null,
          error: null,
          isError: false,
          isSuccess: false,
          needsEmailVerification: true,
          user: null
        })
      } else if (state.matches({ authentication: { signedOut: 'failed' } })) {
        resolve({
          accessToken: null,
          error: state.context.errors.authentication || null,
          isError: true,
          isSuccess: false,
          needsEmailVerification: false,
          user: null
        })
      } else if (state.matches({ authentication: 'signedIn' })) {
        resolve({
          accessToken: state.context.accessToken.value,
          error: null,
          isError: false,
          isSuccess: true,
          needsEmailVerification: false,
          user: state.context.user
        })
      }
    })
  })
