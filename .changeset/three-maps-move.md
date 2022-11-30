---
'hasura-auth': minor
---

Optionally conceal sensitive error messages

Introduce a new `AUTH_CONCEAL_ERRORS` environment variable that conceals error messages to avoid leaking indirect information about users e.g. a user is registered in the application or a given password is invalid.

It is disabled by default.
