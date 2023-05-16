import { startRegistration } from '@simplewebauthn/browser'
import {
  PublicKeyCredentialCreationOptionsJSON,
  RegistrationCredentialJSON
} from '@simplewebauthn/typescript-types'
import { postFetch } from '..'
import { CodifiedError } from '../errors'
import { AuthClient } from '../internal-client'
import { AuthErrorPayload, SecurityKey } from '../types'
import { AuthActionErrorState, AuthActionLoadingState, AuthActionSuccessState } from './types'

export interface AddSecurityKeyHandlerResult extends AuthActionErrorState, AuthActionSuccessState {
  key?: SecurityKey
}

export interface AddSecurityKeyState extends AddSecurityKeyHandlerResult, AuthActionLoadingState {}

export const addSecurityKeyPromise = async (
  { backendUrl, interpreter }: AuthClient,
  nickname?: string
): Promise<AddSecurityKeyHandlerResult> => {
  try {
    const { data: options } = await postFetch<PublicKeyCredentialCreationOptionsJSON>(
      `${backendUrl}/user/webauthn/add`,
      {},
      interpreter?.getSnapshot().context.accessToken.value
    )
    let credential: RegistrationCredentialJSON
    try {
      credential = await startRegistration(options)
    } catch (e) {
      throw new CodifiedError(e as Error)
    }
    const { data: key } = await postFetch<SecurityKey>(
      `${backendUrl}/user/webauthn/verify`,
      { credential, nickname },
      interpreter?.getSnapshot().context.accessToken.value
    )
    return { key, isError: false, error: null, isSuccess: true }
  } catch (e) {
    const { error } = e as { error: AuthErrorPayload }
    return { isError: true, error, isSuccess: false }
  }
}
