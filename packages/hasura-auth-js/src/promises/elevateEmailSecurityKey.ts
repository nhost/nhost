import {
  AuthenticationCredentialJSON,
  PublicKeyCredentialRequestOptionsJSON
} from '@simplewebauthn/typescript-types'
import {
  AuthClient,
  CodifiedError,
  postFetch,
  SessionActionHandlerResult,
  SignInResponse
} from '..'
import { startAuthentication } from '@simplewebauthn/browser'

export interface ElevateWithSecurityKeyHandlerResult extends SessionActionHandlerResult {
  elevated: boolean
}

export const elevateEmailSecurityKeyPromise = (authClient: AuthClient, email: string) =>
  new Promise<ElevateWithSecurityKeyHandlerResult>(async (resolve) => {
    const snapshot = authClient.interpreter?.getSnapshot()
    const accessToken = snapshot?.context.accessToken.value

    const { data } = await postFetch<PublicKeyCredentialRequestOptionsJSON>(
      `${authClient.backendUrl}/elevate/webauthn`,
      {
        email
      },
      accessToken
    )

    let credential: AuthenticationCredentialJSON

    try {
      credential = await startAuthentication(data)
    } catch (e) {
      throw new CodifiedError(e as Error)
    }

    const {
      data: { session },
      error: signInError
    } = await postFetch<SignInResponse>(
      `${authClient.backendUrl}/elevate/webauthn/verify`,
      {
        email,
        credential
      },
      accessToken
    )

    if (session && !signInError) {
      authClient.interpreter?.send({
        type: 'SESSION_UPDATE',
        data: {
          session
        }
      })
    }

    authClient.interpreter?.onTransition((state) => {
      if (state.matches({ authentication: 'signedIn' })) {
        resolve({
          accessToken: state.context.accessToken.value,
          refreshToken: state.context.refreshToken.value,
          error: null,
          isError: false,
          isSuccess: true,
          user: state.context.user,
          elevated: true
        })
      } else {
        resolve({
          accessToken: state.context.accessToken.value,
          refreshToken: state.context.refreshToken.value,
          error: null, // TODO pass error
          isError: true,
          isSuccess: false,
          user: state.context.user,
          elevated: false
        })
      }
    })
  })
