---
title: Authentication
sidebar_position: 1
---

# Authentication

Nhost provides a ready-to-use authentication service, integrated with Nhost JavaScript SDK. This makes it easy to build login flows with multiple sign-in methods.

## Getting Started

Sign up a user with the [Nhost JavaScript SDK](/reference/sdk):

```js
import { NhostClient } from '@nhost/nhost-js';

const nhost = new NhostClient({
  backendUrl: 'https://[app-subdomain].nhost.run',
});

await nhost.auth.signUp({
  email: 'joe@nhost.io',
  password: 'secret-password',
});
```

## How it works

1. A user signs up and the user information is added to the `auth.users` table.
2. Nhost returns an [access token](#access-tokens) (JWT token) and the user's information.
3. The user sends a request to the GraphQL API together with the access token.
4. The GraphQL API reviews the access token to ensure the user is authorized to send the request.

Nhost's authentication service is integrated with your database. All users are stored in the app's database under the `auth` schema and can be accessed using GraphQL:

```graphql
query {
  users {
    id
    displayName
    avatarUrl
    email
  }
}
```

## Tokens

Nhost authentication uses two tokens: Access tokens and refresh tokens.

[Nhost JavaScript SDK](/reference/sdk) automatically handles access and refresh tokens.

### Access tokens

An access token is used to authenticate and authorize a user when doing a GraphQL request.

Access tokens are cryptographically signed and cannot be revoked. They are only valid for 15 minutes. Users can request a new valid access token with a refresh token.

An access token includes a user's ID and roles. Here's an example:

```json
{
  "https://hasura.io/jwt/claims": {
    "x-hasura-user-id": "c8ee8353-b886-4530-9089-631ea7fd4c8a",
    "x-hasura-default-role": "user",
    "x-hasura-allowed-roles": ["user", "me"]
  },
  "iat": 1595146465,
  "exp": 1595147365
}
```

### Refresh tokens

A refresh token is used to request a new access token. Refresh tokens are long-lived tokens stored in the database.
