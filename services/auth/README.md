# Auth

## Core Features

- 🧑‍🤝‍🧑 Users are stored in Postgres and accessed via GraphQL
- 🔑 Multiple sign-in methods.
- ✨ Integrates with GraphQL and Hasura Permissions
- 🔐 JWT tokens and Refresh Tokens.
- ✉️ Emails sent on various operations
- ✅ Optional checking for Pwned Passwords.

## Sign in methods

- [**Email and Password**](./docs/workflows/email-password.md) - simple email and password method.
- [**Email**](./docs/workflows/passwordless-email.md) - also called **passwordless email** or **magic link**.
- [**SMS**](./docs/workflows/passwordless-sms.md) - also called **passwordless sms**.
- [**Anonymous**](./docs/workflows/anonymous-users.md) - sign in users without any method. Anonymous users can be
  converted to _regular_ users.
- [**OAuth providers**](./docs/workflows/oauth-providers.md): Facebook, Google, GitHub, Twitter, Apple, Azure AD, LinkedIn, Windows Live, Spotify, Strava, GitLab, BitBucket, Discord, WorkOS.
- [**Security keys with WebAuthn**](./docs/workflows/webauthn.md)

## Deploy Auth in Seconds

Use [Nhost](https://nhost.io) to start using Hasura Auth in seconds.

### Using Docker-compose

```sh
git clone https://github.com/nhost/nhost.git
cd services/auth/build/docker-compose
docker compose up
```

## Configuration

Read our [configuration guide](./docs/configuration.md) to customise the Hasura Auth settings.

## Workflows

- [Email and password](./docs/workflows/email-password.md)
- [Oauth social providers](./docs/workflows/oauth-providers.md)
- [Passwordless with emails (magic links)](./docs/workflows/passwordless-email.md)
- [Passwordless with SMS](./docs/workflows/passwordless-sms.md)
- [Anonymous users](./docs/workflows/anonymous-users.md)
- [Change email](./docs/workflows/change-email.md)
- [Change password](./docs/workflows/change-password.md)
- [Reset password](./docs/workflows/reset-password.md)
- [Refresh tokens](./docs/workflows/refresh-token.md)
- [Security keys with WebAuthn](./docs/workflows/webauthn.md)

## JWT Signing

The JWT tokens can be signed with either a symmetric key based on `HMAC-SHA` or with asymmetric keys based on `RSA`. To configure the JWT signing method, set the environment variable `HASURA_GRAPHQL_JWT_SECRET` which should follow the same format as [Hasura](https://hasura.io/docs/latest/graphql/core/auth/authentication/jwt.html#running-with-jwt) with a few considerations:

1. Only `HS` and `RS` algorithms are supported.
2. If using `RS` algorithm, the public key should be in PEM format.
3. If using `RS` algorithm, the private key should be in PKCS#8 format inside an extra field `signing_key`.
4. If using `RS` algorithm, an additional field `kid` can be added to specify the key id in the JWK Set.

When using asymmetric keys, you can get the JWK Set from the endpoing `.well-known/jwks.json`.

## Recipes

- Extending Hasura's permissions with [Custom JWT claims](./docs/recipes/custom-hasura-claims.md)
- [Extending the user schema](./docs/recipes/extending-user-schema.md)

## Reference

- CLI options and configuration available in the [CLI documentation](./docs/cli.md).
- The service comes with an [OpenAPI definition](./docs/openapi.yaml) which you can also see [online](https://editor.swagger.io/?url=https://raw.githubusercontent.com/nhost/hasura-auth/main/docs/openapi.yaml).
- [Database Schema](./docs/schema.md)

## Show your support

Give a ⭐️ if this project helped you!

## 📝 License

This project is MIT licensed.
