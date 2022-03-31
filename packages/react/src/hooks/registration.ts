import { useState } from 'react'

import { SignUpOptions } from '@nhost/core'
import { ErrorPayload } from '@nhost/core/src/errors'

import { useAuthInterpreter } from './common'

type UseSignUpEmailPasswordState = {
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
  error: ErrorPayload | null
  needsEmailVerification: boolean
}

export const useSignUpEmailPassword = (
  options?: SignUpOptions
): [
  (email: string, password: string) => Promise<Omit<UseSignUpEmailPasswordState, 'isLoading'>>,
  UseSignUpEmailPasswordState
] => {
  const service = useAuthInterpreter()
  const [state, setState] = useState<UseSignUpEmailPasswordState>({
    isLoading: false,
    isSuccess: false,
    isError: false,
    error: null,
    needsEmailVerification: false
  })

  const handler: ReturnType<typeof useSignUpEmailPassword>[0] = (
    email: string,
    password: string
  ) => {
    service.send({
      type: 'SIGNUP_EMAIL_PASSWORD',
      email,
      password,
      options
    })
    setState({
      isLoading: true,
      isSuccess: false,
      isError: false,
      error: null,
      needsEmailVerification: false
    })
    return new Promise((resolve) => {
      service.onTransition((s) => {
        if (s.matches({ authentication: { signedOut: 'failed' } })) {
          const result = {
            isSuccess: false,
            isError: true,
            error: s.context.errors.registration as ErrorPayload,
            needsEmailVerification: false
          }
          setState({ ...result, isLoading: false })
          resolve(result)
        } else if (s.matches({ authentication: { signedOut: 'needsEmailVerification' } })) {
          const result = {
            isSuccess: false,
            isError: false,
            error: null,
            needsEmailVerification: true
          }
          setState({ ...result, isLoading: false })
          return resolve(result)
        }
      })
    })
  }

  return [handler, state]
}
