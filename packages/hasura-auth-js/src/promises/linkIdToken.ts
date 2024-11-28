import { AuthClient } from '../internal-client'
import { AuthErrorPayload, Provider } from '../types'
import { postFetch } from '../utils/fetch'
import { AuthActionErrorState, AuthActionSuccessState } from './types'

export interface LinkIdTokenHandlerParams {
  provider: Provider
  idToken: string
  nonce?: string
}

export interface LinkIdTokenHandlerResult extends AuthActionErrorState, AuthActionSuccessState {}

export const linkIdTokenPromise = async (
  { backendUrl, interpreter }: AuthClient,
  { provider, idToken, nonce }: LinkIdTokenHandlerParams
): Promise<LinkIdTokenHandlerResult> => {
  try {
    await postFetch<string>(
      `${backendUrl}/link/idtoken`,
      { provider, idToken, ...(nonce && { nonce }) },
      interpreter?.getSnapshot().context.accessToken.value
    )

    return {
      isError: false,
      error: null,
      isSuccess: true
    }
  } catch (e) {
    const { error } = e as { error: AuthErrorPayload }
    return { isError: true, error, isSuccess: false }
  }
}
