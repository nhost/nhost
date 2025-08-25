import {
  ActionErrorState,
  ActionLoadingState,
  ActionSuccessState,
  AddSecurityKeyHandlerResult,
  addSecurityKeyPromise,
  ErrorPayload
} from '@nhost/nhost-js'
import { ToRefs, ref, computed } from 'vue'
import { useNhostClient } from './useNhostClient'

interface AddSecurityKeyHandler {
  (
    /** Optional human-readable name of the security key */
    nickname?: string
  ): Promise<AddSecurityKeyHandlerResult>
}

export interface AddSecuritKeyComposableResult
  extends ToRefs<ActionErrorState>,
    ToRefs<ActionSuccessState>,
    ToRefs<ActionLoadingState> {
  /** Add a security key to the current user with the WebAuthn API */
  add: AddSecurityKeyHandler
}

/**
 * Use the composable `useAddSecurityKey` to add a WebAuthn security key.
 *
 * @example
 * ```tsx
 * const { add, isLoading, isSuccess, isError, error } = useAddSecurityKey()
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await add('key nickname')
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-add-security-key
 */
export const useAddSecurityKey = (): AddSecuritKeyComposableResult => {
  const { nhost } = useNhostClient()
  const error = ref<ErrorPayload | null>(null)
  const isSuccess = computed(() => !error)
  const isError = computed(() => !!error)
  const isLoading = ref<boolean>(false)

  const add: AddSecurityKeyHandler = async (nickname) => {
    isLoading.value = true

    const result = await addSecurityKeyPromise(nhost.auth.client, nickname)

    const { error: addSecurityKeyError } = result

    if (error) {
      error.value = addSecurityKeyError
    }

    isLoading.value = false

    return result
  }

  return { add, isLoading, isSuccess, isError, error }
}
