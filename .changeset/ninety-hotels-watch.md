---
'@nhost/nhost-js': major
---

Replace `axios` by `cross-fetch`

**Breaking Changes**

- The `config` type of `nhost.functions.call(url, data, config)` is not `AxiosRequestConfig` anymore, and deprecates the `useAxios: false` option.

- The `config` type of `nhost.graphql.request(document, [variables], config)` is not `AxiosRequestConfig` anymore, and deprecates the `useAxios: false` option.
