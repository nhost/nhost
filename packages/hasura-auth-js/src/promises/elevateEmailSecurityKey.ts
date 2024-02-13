import {
  AuthenticationCredentialJSON,
  PublicKeyCredentialRequestOptionsJSON
} from '@simplewebauthn/typescript-types'
import {
  AuthActionErrorState,
  AuthActionSuccessState,
  AuthClient,
  AuthErrorPayload,
  CodifiedError,
  postFetch,
  SignInResponse
} from '..'
import { startAuthentication } from '@simplewebauthn/browser'

export interface ElevateWithSecurityKeyHandlerResult
  extends AuthActionSuccessState,
    AuthActionErrorState {
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

    try {
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

        resolve({
          error: null,
          isError: false,
          isSuccess: true,
          elevated: true
        })
      }
    } catch (e) {
      const { error } = e as { error: AuthErrorPayload }

      resolve({
        error,
        isError: true,
        isSuccess: false,
        elevated: false
      })
    }
  })
