import { useContext, useMemo } from 'react'

import { encodeQueryParameters, Provider, ProviderOptions, rewriteRedirectTo } from '@nhost/core'

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
export const useProviderLink = (options?: ProviderOptions) => {
  const nhost = useContext(NhostReactContext)

  return useMemo(
    () =>
      new Proxy({} as Record<Provider, string>, {
        get(_, provider: string) {
          return encodeQueryParameters(
            `${nhost.auth.client.backendUrl}/signin/provider/${provider}`,
            rewriteRedirectTo(nhost.auth.client.clientUrl, options as any)
          )
        }
      }),
    [nhost, options]
  )
}
