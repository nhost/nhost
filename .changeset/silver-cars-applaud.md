---
'hasura-auth': minor
---

Introduce a new `refresh_tokens.hashed_refresh_token` column

Preparatory work to store refresh tokens as a SHA256 hash.

To avoid a breaking change, the `refresh_tokens.refresh_token` remains unchanged until the next major release.

- the `refresh_tokens.refresh_token column` is deprecated
- the hashed refresh token is a Postgres stored generated column
- the internal GraphQL queries are using the hashed refresh token
- the internal GraphQL mutations are still updating the `refresh_token` column

When introducing the breaking change, we will:

- rename `refresh_tokens.refresh_token` to `refresh_tokens.id`
- use the `id` column as an identifier
- remove the `generated` expression in the `hashed_refresh_token` column
- any new refresh token will then be saved uniquely as SHA256
