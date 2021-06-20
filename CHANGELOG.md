# Hasura Backend Plus

## Next release

- Transfer images (width, height, quality) by specifying query parameter (ex: .../example.jpg?w=100) (#403)
- Added `ALLOWED_USER_ROLES` that a user can have upon registration
- Bypass all permissoins with `x-admin-secret` (Same value as Hasura's admin secret) (#401)
- Revoke tokens (#401)
- server: add support for Postgres arrays in JWT claims to support `_in` operator for Hasura Permissions (#378)
- server: add support for user impersonation (#250)
## v2.2.1

- server: Default to email if no display_name exists for OAuth Provider.
- server: Merge accounts using external OAuth providers.
- server: Fix default allowed roles for OAuth Providers.

## v2.2.0

- server: `display_name` is attached for email templates
- server: Added auth middleware to support non-cookie approach for refresh and JWT tokens

## v2.1.1

- server: Support streaming content (#307)

## v2.1.0

- server: Added version endpoint
- build: multi-staged docker file (#274)
- build: reduction of the docker image from 617MB to 216MB (#291)
- server: Add `SameSite=None` header to mitigate future cross-site errors from Chrome (#294)
- server: Removed `X-Frame-Options` for GET storage requests.
- server: Return file key on upload
- server: add COOKIE_SECURE (default: true) and COOKIE_SAME_SITE (default: lax) environment variables

## v2.0.0

- build: Run HBP with node instead of ts-node for lower memory consumption
- server + docs: Set "HOST" default value to empty
- server: No cache on auth routes

## v2.0.0-rc.4

- server: Better default api rate limit values
- server: Added auth test
- server: Don't save original filename as metadata on s3 object
- server: Correct default value for `JWT_ALGORITHM`.
- server + docs: Added "HOST" environment variable (#253)

## v2.0.0-rc.3

- server: Added S3_SSL_ENABLEDD env var
- server: Added AUTH_LOCAL_USERS_ENABLED env variable to enable local (email/pw) users to register and login
- server: Added support for multiple default allowed user roles (#246)

## v2.0.0-rc.2

- server: Updated change password routes for concistency with change email (#235)
- docs: Added API documentation (#235)
- other: Added CHANGELOG.md file (#235)
- refactor(auth): change token endpoint from HTTP POST to GET
- ci(docs): trigger publish docs when changes are done to the examples directory
- docs(auth): login, mfa, jwt
- server: Added support for multiple default allowed user roles (#246)

## v2.0.0-rc.1

V2 is a complete rewrite of HBP with breaking changes and with different technical solutions than v1, but still solving the same problem: Authentication and Storage for Hasura.

100% Typescript
Two factor auth
Email support
Rate limits
Optional pw check agains Pwnd
Test coverages
More external providers (Github, Facebook, twitter, google, Apple, Linkedin, windowslive)
Better support for storage rules
password recovery via email
account activation via email
email change via confirmation email
auto-migration
documentation
