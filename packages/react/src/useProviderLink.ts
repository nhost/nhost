import {
  encodeQueryParameters,
  Provider,
  ProviderOptions,
  rewriteRedirectTo
} from '@nhost/nhost-js'
import { useContext, useEffect, useState } from 'react'
import { NhostReactContext } from './provider'
import { useAccessToken } from './useAccessToken'

/**
 *  Use the hook `useProviderLink` to get an OAuth provider URL that can be used to sign in users.
 *
 * @example
 * ```js
 * const providerLink = useProviderLink();
 * ```
 *
 * @example
 *
 *  Pass in the `connect` option to connect the user's account to the OAuth provider when different emails are used.
 *
 * ```js
 * const providerLink = useProviderLink({ connect: true });
 * ```
 *
 * @example
 * ```jsx
 * import { useProviderLink } from '@nhost/react';
 *
 * const Component = () => {
 *   const { facebook, github } = useProviderLink();
 *
 *   return (
 *     <div>
 *       <a href={facebook}>Sign in with Facebook</a>
 *       <a href={github}>Sign in with GitHub</a>
 *     </div>
 *   );
 * };
 * ```
 */
export const useProviderLink = (options?: ProviderOptions): Record<Provider, string> => {
  /**
   * @internal When using Nextjs or any SSR framework, nhost.auth.client.clientUrl will be set to `undefined`
   * as its value is set to window.location.origin.
   * This is because the request context is not available when setting up the client `new NhostClient()` outside of
   * the React/Nextjs context.
   */
  const [isSSR, setIsSSR] = useState(true)
  const accessToken = useAccessToken()

  useEffect(() => {
    setIsSSR(false)
  }, [])

  const nhost = useContext(NhostReactContext)

  return new Proxy({} as Record<Provider, string>, {
    get(_, provider: string) {
      let providerLink = `${nhost.auth.client.backendUrl}/signin/provider/${provider}`

      const connectOptions = options?.connect ? { connect: accessToken } : {}

      return encodeQueryParameters(
        providerLink,
        rewriteRedirectTo(isSSR ? undefined : nhost.auth.client.clientUrl, {
          ...options,
          ...connectOptions
        } as any)
      )
    }
  })
}
