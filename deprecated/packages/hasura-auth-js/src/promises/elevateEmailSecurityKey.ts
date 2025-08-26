import { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/typescript-types'
import {
  AuthActionErrorState,
  AuthActionSuccessState,
  AuthClient,
  AuthErrorPayload,
  postFetch,
  SignInResponse
} from '..'
import { startAuthentication } from '@simplewebauthn/browser'

export interface ElevateWithSecurityKeyHandlerResult
  extends AuthActionSuccessState,
    AuthActionErrorState {
  elevated: boolean
}

function createAuthErrorPayload(e: any) {
  const error: AuthErrorPayload = {
    error: e.message || 'Something went wrong!',
    status: e.status || 1,
    message: e.message || 'Something went wrong!'
  }

  return error
}

export const elevateEmailSecurityKeyPromise = async (authClient: AuthClient, email: string) => {
  const snapshot = authClient.interpreter?.getSnapshot()
  const accessToken = snapshot?.context.accessToken.value

  let data: PublicKeyCredentialRequestOptionsJSON
  try {
    const response = await postFetch<PublicKeyCredentialRequestOptionsJSON>(
      `${authClient.backendUrl}/elevate/webauthn`,
      {
        email
      },
      accessToken
    )
    data = response.data
  } catch (e: any) {
    const error = createAuthErrorPayload(e)
    return {
      error,
      isError: true,
      isSuccess: false,
      elevated: false
    }
  }

  let credential
  try {
    credential = await startAuthentication(data)
  } catch (e: any) {
    const error = createAuthErrorPayload(e)
    return {
      error,
      isError: true,
      isSuccess: false,
      elevated: false
    }
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

    return {
      error: signInError!,
      isError: true,
      isSuccess: false,
      elevated: false
    }
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
