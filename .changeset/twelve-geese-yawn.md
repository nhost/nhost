---
'hasura-auth': minor
---

Synchronise `AUTH_USER_DEFAULT_ALLOWED_ROLES` and `AUTH_USER_DEFAULT_ROLE` with the database
When starting the server, all the roles defined in `AUTH_USER_DEFAULT_ALLOWED_ROLES` and `AUTH_USER_DEFAULT_ROLE` are upserted into the `auth.roles`
table
