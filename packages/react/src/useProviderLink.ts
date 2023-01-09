import {
  encodeQueryParameters,
  Provider,
  ProviderOptions,
  rewriteRedirectTo
} from '@nhost/nhost-js'
import { useContext, useEffect, useState } from 'react'
import { NhostReactContext } from './provider'

/**
 *  Use the hook `useProviderLink` to get an OAuth provider URL that can be used to sign in users.
 *
 * @example
 * ```js
 * const providerLink = useProviderLink();
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

  useEffect(() => {
    setIsSSR(false)
  }, [])

  const nhost = useContext(NhostReactContext)

  return new Proxy({} as Record<Provider, string>, {
    get(_, provider: string) {
      return encodeQueryParameters(
        `${nhost.auth.client.backendUrl}/signin/provider/${provider}`,
        rewriteRedirectTo(isSSR ? undefined : nhost.auth.client.clientUrl, options as any)
      )
    }
  })
}
