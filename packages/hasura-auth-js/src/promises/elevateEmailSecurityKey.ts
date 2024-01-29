import { FAILED_TO_ELEVATE, SessionActionHandlerResult } from '..'
import { AuthInterpreter } from '../machines'

export interface ElevateWithSecurityKeyHandlerResult extends SessionActionHandlerResult {}

export const elevateEmailSecurityKeyPromise = (interpreter: AuthInterpreter, email: string) =>
  new Promise<ElevateWithSecurityKeyHandlerResult>((resolve) => {
    const { context } = interpreter.send({ type: 'ELEVATE_SECURITY_KEY_EMAIL', email })

    interpreter.onTransition((state) => {
      console.log({ state })

      if (
        state.matches({
          authentication: {
            elevated: 'failed'
          }
        })
      ) {
        resolve({
          accessToken: context.accessToken.value,
          refreshToken: context.refreshToken.value,
          error: FAILED_TO_ELEVATE,
          isError: true,
          isSuccess: false,
          user: context.user,
          elevated: false
        })
      } else if (
        state.matches({
          authentication: {
            elevated: 'success'
          }
        })
      ) {
        resolve({
          accessToken: context.accessToken.value,
          refreshToken: context.refreshToken.value,
          error: null,
          isError: false,
          isSuccess: true,
          user: context.user,
          elevated: true
        })
      }
    })
  })
