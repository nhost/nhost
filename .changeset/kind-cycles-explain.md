---
'@nhost/hasura-auth-js': minor
'@nhost/nhost-js': minor
---

Deprecate Axios

Axios will be replaced by cross-fetch in the near future.

To prepare the transition, we recommend to adapt the following methods:

- `nhost.functions.call()`
- `nhost.graphql.request()`

Both methods are now marked as deprecated unless there is a specific `{ useAxios: false }` last parameter.

When using `useAxios: false`:

- the only allowed option is `headers: Record<string,string>`
- the returned value matches values foreseen in the next major version:
  - `nhost.functions.call`:
    - `error` is using the same standard error type as in `hasura-auth-js` and `hasura-storage-js`
    - `res` is using `{ status: number; statusText: string; data: T }`
  - `nhost.graphql.request`:
    - `error` is either using the standard error type, or `GraphQlError[]`
