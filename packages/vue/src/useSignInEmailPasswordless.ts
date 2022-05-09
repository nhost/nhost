import { ToRefs, unref } from 'vue'

import { PasswordlessOptions } from '@nhost/core'
import { useSelector } from '@xstate/vue'

import { RefOrValue } from './helpers'
import {
  ActionComposableErrorState,
  ActionComposableSuccessState,
  DefaultActionComposableState
} from './types'
import { useAuthInterpreter } from './useAuthInterpreter'
import { useError } from './useError'

interface SignInEmailPasswordlessHandlerResult
  extends ActionComposableErrorState,
    ActionComposableSuccessState {}

interface SignInEmailPasswordlessComposableResult extends ToRefs<DefaultActionComposableState> {
  /** Sends a magic link to the given email */
  signInEmailPasswordless(email: RefOrValue<string>): Promise<SignInEmailPasswordlessHandlerResult>
}

/**
 * Passwordless email authentication
 */
export const useSignInEmailPasswordless = (
  options?: RefOrValue<PasswordlessOptions>
): SignInEmailPasswordlessComposableResult => {
  const service = useAuthInterpreter()
  const signInEmailPasswordless = (email: RefOrValue<string>) =>
    new Promise<SignInEmailPasswordlessHandlerResult>((resolve) => {
      service.value.send('SIGNIN_PASSWORDLESS_EMAIL', {
        email: unref(email),
        options: unref(options)
      })
      service.value.onTransition((state) => {
        if (state.matches({ authentication: { signedOut: 'failed' } })) {
          resolve({
            error: state.context.errors.authentication || null,
            isError: true,
            isSuccess: false
          })
        } else if (
          state.matches({
            authentication: { signedOut: 'noErrors' },
            email: 'awaitingVerification'
          })
        ) {
          resolve({ error: null, isError: false, isSuccess: true })
        }
      })
    })

  const error = useError('authentication')

  const isLoading = useSelector(service.value, (state) =>
    state.matches({ authentication: { authenticating: 'passwordlessEmail' } })
  )

  const isSuccess = useSelector(service.value, (state) =>
    state.matches({ authentication: { signedOut: 'noErrors' }, email: 'awaitingVerification' })
  )

  const isError = useSelector(service.value, (state) =>
    state.matches({ authentication: { signedOut: 'failed' } })
  )

  return { signInEmailPasswordless, isLoading, isSuccess, isError, error }
}
