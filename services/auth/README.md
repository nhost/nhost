# Auth

## Core Features

- 🧑‍🤝‍🧑 Users are stored in Postgres and accessed via GraphQL
- 🔑 Multiple sign-in methods.
- ✨ Integrates with GraphQL and Hasura Permissions
- 🔐 JWT tokens and Refresh Tokens.
- ✉️ Emails sent on various operations
- ✅ Optional checking for Pwned Passwords.

## Sign in methods

- **Email and Password** - simple email and password method.
- **Email** - also called **passwordless email** or **magic link**.
- **SMS** - also called **passwordless sms**.
- **Anonymous** - sign in users without any method. Anonymous users can be
  converted to _regular_ users.
- **OAuth providers**: Facebook, Google, GitHub, Twitter, Apple, Azure AD, LinkedIn, Windows Live, Spotify, Strava, GitLab, BitBucket, Discord, WorkOS.
- **Security keys with WebAuthn**
- Others...

## Documentation

- [Official Documentation](https://docs.nhost.io/products/auth/overview).
- [OpenAPI schema](https://docs.nhost.io/reference/auth/get--well-known-jwks-json)
