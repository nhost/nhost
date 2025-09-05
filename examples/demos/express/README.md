# Express with Nhost SDK Demo

This demo showcases how to integrate the Nhost SDK with an Express server, demonstrating two authentication methods for server-side applications.

## Overview

This demo shows how to:

1. Create an SSR (Server-Side Rendering) Nhost client in an Express application
2. Handle authentication using cookies
3. Handle authentication using Authorization headers (JWT tokens)
4. Make authenticated GraphQL requests to retrieve data

## Setup

1. Clone the repository and navigate to this demo directory:

```bash
cd sdk-experiment/demos/express
```

2. Install dependencies:

```bash
pnpm install
```

3. Start the local Nhost backend (from the root directory):

```bash
cd ../..
pnpm nhost:dev
```

4. Start the Express server:

```bash
cd demos/express
pnpm dev
```

The server will start on port 4000.

## Authentication Methods

### 1. Cookie-based Authentication

This method reads the Nhost session from cookies passed in the HTTP request. It provides full session information including user details.

```typescript
const nhostClientFromCookies = (req: Request) => {
  return createSSRClient({
    subdomain: "local",
    region: "local",
    storage: {
      get: (): Session | null => {
        const s = req.cookies.nhostSession || null;
        if (!s) {
          return null;
        }
        const session = JSON.parse(s) as Session;
        return session;
      },
      // ... other handlers
    },
  });
};
```

### 2. Authorization Header Authentication

This method reads the JWT token from the Authorization header. Note that this provides only partial session information (just the access token).

```typescript
const nhostClientFromAuthHeader = (req: Request) => {
  return createSSRClient({
    subdomain: "local",
    region: "local",
    storage: {
      get: (): Session | null => {
        const s = req.headers.authorization || null;
        if (!s) {
          return null;
        }
        // Extract token from "Bearer <token>"
        const token = s.split(" ")[1];
        const session = { accessToken: token } as Session;
        return session;
      },
      // ... other handlers
    },
  });
};
```

## API Endpoints

The server has two endpoints that demonstrate both authentication methods:

- `POST /cookies` - Authenticates using cookies
- `POST /auth-header` - Authenticates using the Authorization header

Both endpoints retrieve a list of files using GraphQL after authenticating the user.

## Testing

Use the included curl script to test both authentication methods:

```bash
# Run the curl commands
./curl.sh
```

### Example Requests

#### Using cookies:

```bash
curl \
    -X POST \
    -b "nhostSession=%7B%22accessToken%22%3A%22eyJhbGci...%22%7D" \
    http://localhost:4000/cookies
```

#### Using authorization header:

```bash
curl \
    -X POST \
    -H "Authorization: Bearer eyJhbGci..." \
    http://localhost:4000/auth-header
```

## Response Example

Both endpoints return similar responses:

```json
{
  "session": {
    "accessToken": "eyJhbGci...",
    "accessTokenExpiresIn": 900,
    "refreshToken": "3038a6aa-caf2-48c8-b901-bd626bb7494c",
    "refreshTokenId": "74376dd5-ff33-4b2c-bced-a0b847facfe9",
    "user": {
      "avatarUrl": "https://www.gravatar.com/avatar/a52a0027726bf3a4ec2728489732b38d?d=blank&r=g",
      "createdAt": "2025-05-20T12:15:35.232886Z",
      "defaultRole": "user",
      "displayName": "asd",
      "email": "asdsad@asd.com",
      "emailVerified": true,
      "id": "5cc1b449-9912-4080-95f7-3d270305bc62",
      "isAnonymous": false,
      "locale": "en",
      "metadata": null,
      "phoneNumberVerified": false,
      "roles": ["user", "me"]
    }
  },
  "files": [
    {
      "id": "1a4cbc24-0f43-4734-84dc-fbec0e615cb4",
      "name": "Screenshot 2025-05-19 at 15.08.43.png",
      "size": 42815,
      "mimeType": "image/png",
      "bucketId": "default",
      "uploadedByUserId": "5cc1b449-9912-4080-95f7-3d270305bc62"
    }
  ]
}
```

## Key Concepts

- **SSR Client**: The `createSSRClient` function creates a special version of the Nhost client optimized for server-side environments.
- **Custom Storage**: We implement custom storage handlers to retrieve session data from HTTP requests rather than browser storage.
- **Authentication Flexibility**: The demo shows how to support both cookie-based and header-based authentication schemes.

## Next Steps

- Add error handling middleware
- Implement refresh token rotation
- Add more examples of GraphQL operations
- Integrate with a frontend application
