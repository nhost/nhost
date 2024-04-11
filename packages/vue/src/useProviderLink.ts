import {
  encodeQueryParameters,
  Provider,
  ProviderOptions,
  rewriteRedirectTo
} from '@nhost/nhost-js'
import { reactive } from 'vue'
import { NestedRefOfValue, nestedUnref } from './helpers'
import { useAccessToken } from './useAccessToken'
import { useNhostClient } from './useNhostClient'

/**
 *  Use the composable `useProviderLink` to get an OAuth provider URL that can be used to sign in users.
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
 * import { useProviderLink } from '@nhost/vue';
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
export const useProviderLink = (
  options?: NestedRefOfValue<ProviderOptions | undefined>
): Record<Provider, string> => {
  const { nhost } = useNhostClient()
  const accessToken = useAccessToken()

  return reactive(
    new Proxy({} as Record<Provider, string>, {
      get(_, provider: string) {
        const optionsValue = nestedUnref(options)

        const connectOptions = optionsValue?.connect ? { connect: accessToken.value } : {}

        return encodeQueryParameters(
          `${nhost.auth.client.backendUrl}/signin/provider/${provider}`,
          rewriteRedirectTo(nhost.auth.client.clientUrl, {
            ...optionsValue,
            ...connectOptions
          } as any)
        )
      }
    })
  )
}
