---
'hasura-auth': patch
---

- The default role is now automatically added to the allowed roles.
- The default locale is now automatically added to the allowed locales.

Previously, it was explicitly required to add the `me` and `AUTH_USER_DEFAULT_ROLE` roles to `AUTH_USER_DEFAULT_ALLOWED_ROLES`. They are now automatically added to `AUTH_USER_DEFAULT_ALLOWED_ROLES`.

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
