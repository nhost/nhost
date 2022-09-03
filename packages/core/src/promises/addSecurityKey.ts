import { startRegistration } from '@simplewebauthn/browser'
import {
  PublicKeyCredentialCreationOptionsJSON,
  RegistrationCredentialJSON
} from '@simplewebauthn/typescript-types'

import { AuthClient } from '../client'
import { CodifiedError, ErrorPayload } from '../errors'
import { nhostApiClient } from '../hasura-auth'

import { ActionErrorState, ActionLoadingState, ActionSuccessState } from './types'
export interface AddSecurityKeyHandlerResult extends ActionErrorState, ActionSuccessState {
  id?: string
  nickname?: string
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
          authorization: `Bearer ${interpreter?.state.context.accessToken.value}`
        }
      }
    )
    let credential: RegistrationCredentialJSON
    try {
      credential = await startRegistration(options)
    } catch (e) {
      throw new CodifiedError(e as Error)
    }
    const { data } = await api.post<AddSecurityKeyHandlerResult>(
      '/user/webauthn/verify',
      { credential, nickname },
      {
        headers: {
          authorization: `Bearer ${interpreter?.state.context.accessToken.value}`
        }
      }
    )
    return { id: data.id, nickname, isError: false, error: null, isSuccess: true }
  } catch (e) {
    const { error } = e as { error: ErrorPayload }
    return { isError: true, error, isSuccess: false }
  }
}
