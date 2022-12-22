---
'hasura-auth': patch
---

Always add required allowed roles and locales

Until now, it was required to pass on explicilty the `"me"` and `AUTH_USER_DEFAULT_ROLE` to `AUTH_USER_DEFAULT_ALLOWED_ROLES`. They are now automatically added if they are not in the environment variable.

Before:

```
AUTH_USER_DEFAULT_ROLE=user
AUTH_USER_DEFAULT_ALLOWED_ROLES=user,me,other
```

Now, the following configuration will also work:

```
AUTH_USER_DEFAULT_ROLE=user
AUTH_USER_DEFAULT_ALLOWED_ROLES=other
```

Both syntaxes will allow the roles `user`, `me`, and `other`.

Similarly, it is not required to add the ``to the`AUTH_LOCALE_ALLOWED_LOCALES`.

Before:

```
AUTH_LOCALE_DEFAULT=en
AUTH_LOCALE_ALLOWED_LOCALES=en,fr
```

Now, the following configuration will also work:

```
AUTH_LOCALE_DEFAULT=en
AUTH_LOCALE_ALLOWED_LOCALES=en,fr
```

Both syntwaxes will allow the locales `['en', 'fr']`
