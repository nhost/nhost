import {
  AuthenticationResponseJSON,
  PublicKeyCredentialRequestOptionsJSON
} from '@simplewebauthn/types'
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

export async function elevateEmailSecurityKeyPromise(
  authClient: AuthClient,
  email: string
): Promise<ElevateWithSecurityKeyHandlerResult> {
  const snapshot = authClient.interpreter?.getSnapshot()
  const accessToken = snapshot?.context.accessToken.value

  const { data: optionsJSON } = await postFetch<PublicKeyCredentialRequestOptionsJSON>(
    `${authClient.backendUrl}/elevate/webauthn`,
    {
      email
    },
    accessToken
  )

  let credential: AuthenticationResponseJSON

  try {
    credential = await startAuthentication({ optionsJSON })
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

      return {
        error: null,
        isError: false,
        isSuccess: true,
        elevated: true
      }
    }

    throw new Error(
      `IMPOSSIBLE: /elevate/webauthn/verify error -> either session is false OR signInError is true: session = ${session}, signInError = ${String(signInError)}`
    )
  } catch (e) {
    const { error } = e as { error: AuthErrorPayload }

    return {
      error,
      isError: true,
      isSuccess: false,
      elevated: false
    }
  }
}
