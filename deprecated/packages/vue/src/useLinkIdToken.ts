import {
  ActionErrorState,
  ActionLoadingState,
  ActionSuccessState,
  ErrorPayload,
  LinkIdTokenHandlerParams,
  LinkIdTokenHandlerResult,
  linkIdTokenPromise
} from '@nhost/nhost-js'
import { computed, ref, ToRefs } from 'vue'
import { useNhostClient } from './useNhostClient'

export interface LinkIdTokenResult
  extends ToRefs<ActionErrorState>,
    ToRefs<ActionSuccessState>,
    ToRefs<ActionLoadingState> {
  linkIdToken(params: LinkIdTokenHandlerParams): Promise<LinkIdTokenHandlerResult>
}

/**
 * Use the hook `useLinkIdToken` to link a user account with the provider's account using an id token
 *
 * @example
 * ```tsx
 * const { linkIdToken, isLoading, isSuccess, isError, error } = useLinkIdToken()
 *
 * const handleLinkIdToken = async () => {
 *   await linkIdToken({
 *      provider: 'google',
 *      idToken: '...',
 *      nonce: '...'
 *   })
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-link-id-token
 */
export const useLinkIdToken = (): LinkIdTokenResult => {
  const { nhost } = useNhostClient()
  const error = ref<ErrorPayload | null>(null)
  const isSuccess = computed(() => !error)
  const isError = computed(() => !!error)
  const isLoading = ref<boolean>(false)

  const linkIdToken = async ({ provider, idToken, nonce }: LinkIdTokenHandlerParams) => {
    isLoading.value = true

    const result = await linkIdTokenPromise(nhost.auth.client, {
      provider,
      idToken,
      ...(nonce && { nonce })
    })

    const { error: linkIdTokenError } = result

    if (error) {
      error.value = linkIdTokenError
    }

    isLoading.value = false
    return result
  }

  return { linkIdToken, isLoading, isSuccess, isError, error }
}
