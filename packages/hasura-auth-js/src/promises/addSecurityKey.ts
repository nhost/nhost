import { startRegistration } from '@simplewebauthn/browser'
import {
  PublicKeyCredentialCreationOptionsJSON,
  RegistrationCredentialJSON
} from '@simplewebauthn/typescript-types'

import { CodifiedError } from '../errors'
import { AuthClient } from '../internal-client'
import { ErrorPayload, SecurityKey } from '../types'
import { nhostApiClient } from '../utils'

import { ActionErrorState, ActionLoadingState, ActionSuccessState } from './types'
export interface AddSecurityKeyHandlerResult extends ActionErrorState, ActionSuccessState {
  key?: SecurityKey
}

export interface AddSecurityKeyState extends AddSecurityKeyHandlerResult, ActionLoadingState {}

export const addSecurityKeyPromise = async (
  { backendUrl, interpreter }: AuthClient,
  nickname?: string
): Promise<AddSecurityKeyHandlerResult> => {
  const api = nhostApiClient(backendUrl)
  try {
    const { data: options } = await api.post<PublicKeyCredentialCreationOptionsJSON>(
      '/user/webauthn/add',
      {},
      {
        headers: {
          authorization: `Bearer ${interpreter?.getSnapshot().context.accessToken.value}`
        }
      }
    )
    let credential: RegistrationCredentialJSON
    try {
      credential = await startRegistration(options)
    } catch (e) {
      throw new CodifiedError(e as Error)
    }
    const { data: key } = await api.post<SecurityKey>(
      '/user/webauthn/verify',
      { credential, nickname },
      {
        headers: {
          authorization: `Bearer ${interpreter?.getSnapshot().context.accessToken.value}`
        }
      }
    )
    return { key, isError: false, error: null, isSuccess: true }
  } catch (e) {
    const { error } = e as { error: ErrorPayload }
    return { isError: true, error, isSuccess: false }
  }
}
