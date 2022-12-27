---
'@nhost/hasura-auth-js': minor
---

Allow 'hash' redirections

Some router libraries such as [vue-router](https://router.vuejs.org/guide/essentials/history-mode.html#hash-mode) or [react-router](https://reactrouter.com/en/main/router-components/hash-router) support a hash mode.

It is now possible to generate a redirection link that is compatible with such a mode:

```js
{
  redirectTo: '#/my-page'
}
```

Example using the parameter to sign using passwordless email:

```js
const nhost = new NhostClient(/** parameters */)
nhost.auth.signIn({ email: 'bob@sponge.com', options: { redirectTo: '#/my-page' } })
```
