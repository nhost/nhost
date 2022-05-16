import { reactive, unref } from 'vue'

import { encodeQueryParameters, Provider, ProviderOptions, rewriteRedirectTo } from '@nhost/core'

import { RefOrValue } from './helpers'
import { useNhostClient } from './useNhostClient'

/**
 * Oauth Providers
 * @example
```js
const providerLink = useProviderLink();
```
*/
export const useProviderLink = (options?: RefOrValue<ProviderOptions>) => {
  const { nhost } = useNhostClient()
  return reactive(
    new Proxy({} as Record<Provider, string>, {
      get(_, provider: string) {
        const optionsValue = unref(options)
        return encodeQueryParameters(
          `${nhost.auth.client.backendUrl}/signin/provider/${provider}`,
          rewriteRedirectTo(nhost.auth.client.clientUrl, optionsValue as any)
        )
      }
    })
  )
}
