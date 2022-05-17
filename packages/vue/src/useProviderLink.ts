import { reactive } from 'vue'

import { encodeQueryParameters, Provider, ProviderOptions, rewriteRedirectTo } from '@nhost/core'

import { NestedRefOfValue, nestedUnref } from './helpers'
import { useNhostClient } from './useNhostClient'

/**
 * Oauth Providers
 * @example
```js
const providerLink = useProviderLink();
```
*/
export const useProviderLink = (options?: NestedRefOfValue<ProviderOptions | undefined>) => {
  const { nhost } = useNhostClient()
  return reactive(
    new Proxy({} as Record<Provider, string>, {
      get(_, provider: string) {
        const optionsValue = nestedUnref(options)
        return encodeQueryParameters(
          `${nhost.auth.client.backendUrl}/signin/provider/${provider}`,
          rewriteRedirectTo(nhost.auth.client.clientUrl, optionsValue as any)
        )
      }
    })
  )
}
