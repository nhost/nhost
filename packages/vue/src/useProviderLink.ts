import { ProviderOptions } from '@nhost/core'

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
  const { client } = useNhostClient()
  // TODO
  return {}
  // return useMemo(
  //   () =>
  //     new Proxy({} as Record<Provider, string>, {
  //       get(_, provider: string) {
  //         return encodeQueryParameters(
  //           `${nhost.value.auth.client.backendUrl}/signin/provider/${provider}`,
  //           rewriteRedirectTo(nhost.value.auth.client.clientUrl, options)
  //         )
  //       }
  //     }),
  //   [nhost, options]
  // )
}
