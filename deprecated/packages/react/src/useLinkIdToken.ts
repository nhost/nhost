import {
  ActionErrorState,
  ActionSuccessState,
  ErrorPayload,
  LinkIdTokenHandlerParams,
  LinkIdTokenHandlerResult,
  linkIdTokenPromise
} from '@nhost/nhost-js'
import { useState } from 'react'
import { useNhostClient } from './useNhostClient'

interface LinkIdTokenHandler {
  (params: LinkIdTokenHandlerParams): Promise<LinkIdTokenHandlerResult>
}

export interface LinkIdTokenHookResult extends ActionErrorState, ActionSuccessState {
  linkIdToken: LinkIdTokenHandler
}

interface LinkIdTokenHook {
  (): LinkIdTokenHookResult
}

/**
 * Use the hook `useLinkIdToken` to link a user account with the provider's account using an id token
 *
 * @example
 * ```tsx
 * const { linkIdToken, isLoading, isSuccess, isError, error } = useLinkIdToken()
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await linkIdToken({
 *      provider: 'google',
 *      idToken: '...',
 *      nonce: '...'
 *   })
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-link-id-token
 */
export const useLinkIdToken: LinkIdTokenHook = () => {
  const nhost = useNhostClient()
  const [error, setError] = useState<ErrorPayload | null>(null)
  const isSuccess = !error
  const isError = !!error
  const [isLoading, setIsLoading] = useState(false)

  const linkIdToken: LinkIdTokenHandler = async ({
    provider,
    idToken,
    nonce
  }: LinkIdTokenHandlerParams) => {
    setIsLoading(true)

    const result = await linkIdTokenPromise(nhost.auth.client, {
      provider,
      idToken,
      ...(nonce && { nonce })
    })

    const { error } = result

    if (error) {
      setError(error)
    }

    setIsLoading(false)

    return result
  }

  return { linkIdToken, isLoading, isSuccess, isError, error }
}
