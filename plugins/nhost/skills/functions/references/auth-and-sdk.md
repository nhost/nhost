# Verifying callers and using nhost-js inside a function

Read this before writing any function that acts for a signed-in user, touches user data, or uses the admin secret.

Sources: [JWT verification](https://docs.nhost.io/products/functions/guides/jwt-verification), [Using the Nhost SDK](https://docs.nhost.io/products/functions/guides/nhost-sdk), [Environment variables](https://docs.nhost.io/platform/cloud/environment-variables), [Webhook security](https://docs.nhost.io/products/events/guides/webhook-security).

## 1. Pick the verification path

Find out which kind of key the project signs JWTs with. Look at the JWT settings in `nhost/nhost.toml` or `.secrets`, or ask the user. Don't guess.

- **Asymmetric keys (`RS256`/`RS384`/`RS512`)**: verify against the public JWKS. This is the recommended path in the docs.
- **Symmetric key (`HS256`/`HS384`/`HS512`)**, which is the usual default: verify with the shared key from `NHOST_JWT_SECRET`.

Dependencies: `npm install jsonwebtoken jwks-rsa` and `npm install -D @types/jsonwebtoken`. Both packages are pure JS, so they bundle fine.

### Asymmetric (JWKS), from the docs guide

```ts
import type { Request, Response } from 'express'
import process from 'node:process'
import jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'

const client = jwksClient({
  jwksUri: `https://${process.env.NHOST_SUBDOMAIN}.auth.${process.env.NHOST_REGION}.nhost.run/v1/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 86400000,
})

export default (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const token = authHeader.split(' ')[1]
  jwt.verify(
    token,
    (header, cb) => client.getSigningKey(header.kid, (err, key) => (err ? cb(err) : cb(null, key.getPublicKey()))),
    { algorithms: ['RS256', 'RS384', 'RS512'] },
    (err, decoded) => {
      if (err) return res.status(401).json({ error: 'Unauthorized' })
      const userId = (decoded as jwt.JwtPayload).sub // trust this, not req.body
      res.status(200).json({ userId })
    },
  )
}
```

### Symmetric

`NHOST_JWT_SECRET` holds a JSON string such as `{"key": "...", "type": "HS256"}`, not the raw key. Parse it and pass `.key` to `jwt.verify`:

```ts
const { key } = JSON.parse(process.env.NHOST_JWT_SECRET ?? '{}')
jwt.verify(token, key, { algorithms: ['HS256', 'HS384', 'HS512'] }, (err, decoded) => { /* as above */ })
```

Keep this key server-side. It can mint tokens as well as verify them.

### Claims

Roles and user ID are in the token under `https://hasura.io/jwt/claims` (for example `x-hasura-allowed-roles`). The standard `sub` claim is the user ID. To check a role, read it from the verified token, never from the request body.

## 2. Call Nhost services from the function

Create the client once at module scope. Take `subdomain` and `region` from `process.env.NHOST_SUBDOMAIN` and `process.env.NHOST_REGION`, which are `local`/`local` when running locally.

**As the caller.** This respects the caller's GraphQL permissions and is the preferred option:

```ts
import { createClient } from '@nhost/nhost-js'
const nhost = createClient({ region: process.env.NHOST_REGION, subdomain: process.env.NHOST_SUBDOMAIN })

const { body } = await nhost.graphql.request(
  { query: `query { todos { id title } }` },
  { headers: { Authorization: req.headers.authorization ?? '' } },
)
if (body.errors) return res.status(400).json({ errors: body.errors })
```

**As admin.** This bypasses all permissions. Use it only after you've verified the caller and checked that they're allowed to do the operation:

```ts
import { createClient, withAdminSession } from '@nhost/nhost-js'
const nhost = createClient({
  region: process.env.NHOST_REGION,
  subdomain: process.env.NHOST_SUBDOMAIN,
  configure: [withAdminSession({ adminSecret: process.env.NHOST_ADMIN_SECRET })],
})
```

**As a specific user with admin auth.** Use this for background jobs or event triggers that have no user token. Pass `role: 'user'` and `sessionVariables: { 'user-id': userId }` to `withAdminSession`. The `userId` must come from trusted data, such as the event payload or a verified token, never from an unauthenticated request.

The client exposes `nhost.storage` and `nhost.auth` too. For example, `nhost.storage.uploadFiles({ 'bucket-id': 'reports', 'file[]': [file] })` returns `body.processedFiles`. Responses are `{ body, status, headers }`, and failures throw `FetchError`.

## 3. Webhook-triggered functions (events, cron)

These calls come from Nhost, not from a user, so they carry no user JWT. Validate the `nhost-webhook-secret` header against `process.env.NHOST_WEBHOOK_SECRET` with a timing-safe compare, as in the [Webhook security](https://docs.nhost.io/products/events/guides/webhook-security) guide, and return 401 if it doesn't match.

## Related

- Issuing custom tokens or impersonating users: [Custom JWTs](https://docs.nhost.io/products/functions/guides/custom-jwts). This is an advanced pattern, so confirm with the user before building it.
- Serving a GraphQL API from a function: [GraphQL server](https://docs.nhost.io/products/functions/guides/graphql-server).
