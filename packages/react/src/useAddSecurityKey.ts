import {
  ActionErrorState,
  ActionSuccessState,
  AddSecurityKeyHandlerResult,
  addSecurityKeyPromise,
  ErrorPayload
} from '@nhost/nhost-js'
import { useState } from 'react'
import { useNhostClient } from './useNhostClient'

interface AddSecurityKeyHandler {
  (
    /** Optional human-readable name of the security key */
    nickname?: string
  ): Promise<AddSecurityKeyHandlerResult>
}

export interface AddSecuritKeyHookResult extends ActionErrorState, ActionSuccessState {
  /** Add a security key to the current user with the WebAuthn API */
  add: AddSecurityKeyHandler
}

interface AddSecuritKeyHook {
  (): AddSecuritKeyHookResult
}

/**
 * Use the hook `useAddSecurityKey` to add a WebAuthn security key.
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
 * @docs https://docs.nhost.io/reference/react/use-add-security-key
 */
export const useAddSecurityKey: AddSecuritKeyHook = () => {
  const nhost = useNhostClient()
  const [error, setError] = useState<ErrorPayload | null>(null)
  const isSuccess = !error
  const isError = !!error

  const [isLoading, setIsLoading] = useState(false)

  const add: AddSecurityKeyHandler = async (nickname) => {
    setIsLoading(true)
    const result = await addSecurityKeyPromise(nhost.auth.client, nickname)
    const { error } = result
    if (error) {
      setError(error)
    }
    setIsLoading(false)
    return result
  }

  return { add, isLoading, isSuccess, isError, error }
}
