---
'@nhost/hasura-auth-js': minor
---

Extend deanonymisation options
The Nhost Auth client method `auth.deanonymize` was only accepting `allowedRoles` and `defaultRole` as additional parameters. It is not possible to pass on an `options` parameter with the usual registration options such as `redirectTo`, `locale`, `metadata`, and `displayName`.
The `auth.deanonymize` parameters are now strongly typed.