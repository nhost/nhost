---
'@nhost/nhost-js': major
---

Replace `axios` by `cross-fetch`

**Breaking Changes**

The type of the third `config` argument of the method `nhost.functions.call(url, data, config)` is not `AxiosRequestConfig` anymore but `RequestInit`.

The type of the last `config` argument of the methode `nhost.graphql.request(document, [variables], config)` is not `AxiosRequestConfig` anymore but `RequestInit`.
