---
'hasura-auth': minor
---

Introduce a new `refresh_tokens.refresh_token_hash` column.

Preparatory work to store refresh tokens as a SHA256 hash.

To avoid a breaking change, the `refresh_tokens.refresh_token` column remains unchanged until the next major release.

- The `refresh_tokens.refresh_token` column is now deprecated.
- The hashed refresh token is a Postgres stored generated column.
- The internal GraphQL queries are using the hashed refresh token.
- The internal GraphQL mutations are still updating the `refresh_token` column.

When introducing the breaking change, we will:

- Rename `refresh_tokens.refresh_token` to `refresh_tokens.id`.
- Use the `id` column as an identifier.
- Remove the `generated` expression in the `refresh_token_hash` column.
- New refresh tokens will then be saved uniquely as SHA256.
