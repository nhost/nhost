---
'@nhost/vue': minor
---

Don't remove parameters from the current url

Since [this PR](https://github.com/nhost/hasura-auth/pull/315), the hash part of the URL remains unchanged by hasura-auth in its redirections. As a result, Vue-router has now full control over this hash, meaning it works in both hash and history mode, without mangling the url.

Solves [#832](https://github.com/nhost/nhost/issues/832).
