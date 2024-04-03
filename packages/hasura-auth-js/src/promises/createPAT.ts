import { AuthClient } from '../internal-client'
import { AuthErrorPayload, PersonalAccessTokenCreationResponse } from '../types'
import { postFetch } from '../utils/fetch'
import { AuthActionErrorState, AuthActionLoadingState, AuthActionSuccessState } from './types'

export interface CreatePATHandlerParams {
  /**
   * The expiration date of the personal access token.
   */
  expiresAt: Date
  /**
   * Optional metadata to attach to the personal access token.
   */
  metadata?: Record<string, string | number>
}

export interface CreatePATHandlerResult extends AuthActionErrorState, AuthActionSuccessState {
  /**
   * The data returned by the backend.
   */
  data?: {
    /**
     * The ID of the personal access token that was created.
     */
    id?: string | null
    /**
     * The personal access token that was created.
     */
    personalAccessToken?: string | null
  } | null
}

export interface CreatePATState extends CreatePATHandlerResult, AuthActionLoadingState {}

export const createPATPromise = async (
  { backendUrl, interpreter }: AuthClient,
  { expiresAt, metadata }: CreatePATHandlerParams
): Promise<CreatePATHandlerResult> => {
  try {
    const { data } = await postFetch<PersonalAccessTokenCreationResponse>(
      `${backendUrl}/pat`,
      { expiresAt: expiresAt.toISOString(), metadata },
      interpreter?.getSnapshot().context.accessToken.value
    )

    return {
      data: data
        ? {
            id: data.id || null,
            personalAccessToken: data.personalAccessToken || null
          }
        : null,
      isError: false,
      error: null,
      isSuccess: true
    }
  } catch (e) {
    const { error } = e as { error: AuthErrorPayload }
    return { isError: true, error, isSuccess: false, data: null }
  }
}
