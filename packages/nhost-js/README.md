# Nhost JavaScript SDK

The Nhost JavaScript SDK provides a client-side interface to interact with Nhost services, including authentication, storage, and GraphQL operations.

## Installation

```bash
# npm
npm install @nhost/nhost-js@beta

# yarn
yarn add @nhost/nhost-js@beta

# pnpm
pnpm add @nhost/nhost-js@beta
```

## Quick Start

```typescript
import { createClient } from '@nhost/nhost-js'

// Initialize the Nhost client
const nhost = createClient({
  subdomain: 'your-project',
  region: 'eu-central-1'
})

// Use authentication features
const response = await nhost.auth.signInEmailPassword({
  email: 'user@example.com',
  password: 'password123'
})

if (response.body.session) {
  console.log('Signed in successfully!')
}

// Use GraphQL features
const response = await nhost.graphql.request({
  query: `
    query GetUsers {
      users {
        id
        displayName
        email
      }
    }
  `
})

return response.body.data.users

// Use storage features
const response = await nhost.storage.uploadFiles({
  'file[]': [file]
})

return response.body.processedFiles[0]

// call a serverless function
const response = await nhost.functions.fetch('/echo', {
  method: 'POST',
  body: JSON.stringify({
    message: 'Hello, world!'
  }),
  headers: {
    'Content-Type': 'application/json'
  }
})
```

## Modules

The Nhost SDK consists of several modules:

- **Auth**: User authentication and session management
- **Storage**: File upload, download, and management
- **GraphQL**: Executing queries and mutations against your Hasura GraphQL API
- **Functions**: Invoking serverless functions

## Documentation

For detailed documentation and API reference, see the [Nhost Documentation](https://docs.nhost.io).

## License

MIT
