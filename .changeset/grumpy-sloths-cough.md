---
'@nhost/react': patch
---

Deprecate the use of values sent as hook parameters

Although handlers parameters of authentication hooks can be given when creating the hook, it is recommended to use them when executing the handler. For instance, instead of:

```js
const { signInEmailPasswordless } = useSignInEmailPasswordless('nuno@fcporto.pt')
signInEmailPasswordless()
```

It is recommended to use the following syntax:

```js
const { signInEmailPasswordless } = useSignInEmailPasswordless()
signInEmailPasswordless('nuno@fcporto.pt')
```

No breaking change has been introduced. For instance, `useSignUpEmailPassword('szilard@brussels.be','1234', options)` will appear as deprecated but will work, while `useSignUpEmailPassword(options)` will work too.
