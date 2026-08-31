# Nhost Docker Compose Example

This example demonstrates how to reproduce the Nhost stack using Docker Compose. It's based on our CLI implementation and provides a comprehensive demonstration environment for exploring Nhost's capabilities.

> **IMPORTANT**: This example is for demonstration purposes only. While it's a mostly complete representation of the Nhost stack, it includes development-friendly features that may not be suitable for production environments.

## Self-Hosting Notice

Please note:
- We don't officially support self-hosting without a support agreement (see [Nhost Pricing](https://nhost.io/pricing))
- This example is primarily for demonstration purposes
- Beyond fixes/updates to this example, support is community-provided
- Some dashboard options are greyed out as they relate to Nhost Cloud services (CI integration, configuration management, etc.)

## Available Endpoints

After starting the services, the following endpoints will be available:

| Service | URL | Description |
|---------|-----|-------------|
| Auth | http://local.auth.local.nhost.run | Authentication service |
| Dashboard | http://local.dashboard.local.nhost.run | Nhost dashboard |
| Database | postgres://local.db.local.nhost.run | PostgreSQL database |
| Functions | http://local.functions.local.nhost.run | Serverless functions |
| Hasura Console | http://local.graphql.local.nhost.run/console | GraphQL API management |
| GraphQL | http://local.graphql.local.nhost.run | GraphQL service |
| Mailhog | http://local.mailhog.local.nhost.run | Email testing tool (dev only) |
| Storage | http://local.storage.local.nhost.run | File storage service |

## Configuration

While minor configuration can be done via the `.env` file, this Docker Compose setup is primarily for demonstration. For production use:

- Study and understand the Docker Compose configuration
- Adjust it to your specific requirements
- Pay special attention to security settings in the `.env` file and the Docker Compose configuration
- Consider removing development-only services like Mailhog and Hasura Console

## Demo

Starting the services:

```
$ git clone https://github.com/nhost/nhost

$ cd nhost/examples/docker-compose

$ cp .env.example .env

$ docker compose up -d
[+] Running 10/10
 ✔ Container docker-compose-mailhog-1    Started                                   10.6s
 ✔ Container docker-compose-traefik-1    Started                                   10.6s
 ✔ Container docker-compose-dashboard-1  Started                                   10.6s
 ✔ Container docker-compose-functions-1  Started                                   10.6s
 ✔ Container docker-compose-storage-1    Started                                   21.8s
 ✔ Container docker-compose-auth-1       Started                                   21.9s
 ✔ Container docker-compose-graphql-1    Healthy                                   21.6s
 ✔ Container docker-compose-minio-1      Started                                   10.5s
 ✔ Container docker-compose-postgres-1   Healthy                                    6.5s
 ✔ Container docker-compose-console-1    Started                                   11.5s
```

### Testing Individual Services

#### Postgres

```
$ psql postgres://postgres:postgres@local.db.local.nhost.run -c "SELECT VERSION();"
                                                          version
---------------------------------------------------------------------------------------------------------------------------
 PostgreSQL 16.8 (Debian 16.8-1.pgdg120+1) on aarch64-unknown-linux-gnu, compiled by gcc (Debian 12.2.0-14) 12.2.0, 64-bit
(1 row)
```

#### Auth

```
$ curl http://local.auth.local.nhost.run/v1/version
{"version":"0.37.1"}

$ curl -X POST http://local.auth.local.nhost.run/v1/signup/email-password \
  -H "Content-Type: application/json" \
  -d '{"email": "email@acme.test", "password":"s3cur3p4ssw0rd!"}'
{
  "session": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NDMwODczMzEsImh0dHBzOi8vaGFzdXJhLmlvL2p3dC9jbGFpbXMiOnsieC1oYXN1cmEtYWxsb3dlZC1yb2xlcyI6WyJ1c2VyIiwibWUiXSwieC1oYXN1cmEtZGVmYXVsdC1yb2xlIjoidXNlciIsIngtaGFzdXJhLXVzZXItaWQiOiJmNDYwMzUyNC00NDhkLTRhOTYtYjZkNi1kNGNmNDc2Nzk2YTgiLCJ4LWhhc3VyYS11c2VyLWlzLWFub255bW91cyI6ImZhbHNlIn0sImlhdCI6MTc0MzA4NjQzMSwiaXNzIjoiaGFzdXJhLWF1dGgiLCJzdWIiOiJmNDYwMzUyNC00NDhkLTRhOTYtYjZkNi1kNGNmNDc2Nzk2YTgifQ.yBGn3Gsb0kuqXxEPbdqb9FOmKxGpQjDnAJCVYuBvPMM",
    "accessTokenExpiresIn": 900,
    "refreshToken": "5743ea5b-9561-46f6-a9a4-b0cbc3c13dd2",
    "refreshTokenId": "44a66ddf-a099-4a1d-bdb4-4c4d6e3d10ac",
    "user": {
      "avatarUrl": "https://www.gravatar.com/avatar/1de09cde1ce545d06c9381280237c224?d=blank&r=g",
      "createdAt": "2025-03-27T14:40:31.046694975Z",
      "defaultRole": "user",
      "displayName": "email@acme.test",
      "email": "email@acme.test",
      "emailVerified": false,
      "id": "f4603524-448d-4a96-b6d6-d4cf476796a8",
      "isAnonymous": false,
      "locale": "en",
      "metadata": null,
      "phoneNumberVerified": false,
      "roles": [
        "user",
        "me"
      ]
    }
  }
}
```

#### Storage

```
$ curl http://local.storage.local.nhost.run/v1/version
{"buildVersion":"0.7.1"}

$ curl -X POST http://local.storage.local.nhost.run/v1/files \
   -H "X-Hasura-Admin-Secret: change-me" \
   -H "Content-Type: multipart/form-data" \
   -F "file=@README.md"
{
  "id": "ed8d72f4-34da-446a-aac7-150fd909bfd8",
  "name": "README.md",
  "size": 6567,
  "bucketId": "default",
  "etag": "\"19dba20946122f4a2f0aa41a12288270\"",
  "createdAt": "2025-03-27T14:43:42.081047+00:00",
  "updatedAt": "2025-03-27T14:43:42.086137+00:00",
  "isUploaded": true,
  "mimeType": "text/plain; charset=utf-8",
  "uploadedByUserId": "",
  "metadata": null
}
```

#### GraphQL

```
$ curl http://local.graphql.local.nhost.run/v1/version
{"server_type":"ce","version":"v2.36.9-ce"}

$ curl -X POST http://local.graphql.local.nhost.run/v1/graphql \
  -H "Content-Type: application/json" \
  -H "X-Hasura-Admin-Secret: change-me" \
  -d '{"query":"query { users { id email } }"}'
{
  "data": {
    "users": [
      {
        "id": "f4603524-448d-4a96-b6d6-d4cf476796a8",
        "email": "email@acme.test"
      }
    ]
  }
}
```

#### Functions

```
$ curl http://local.functions.local.nhost.run/v1/echo
{
  "headers": {
    "host": "local.functions.local.nhost.run",
    "user-agent": "curl/8.7.1",
    "accept": "*/*",
    "x-forwarded-for": "172.19.0.1",
    "x-forwarded-host": "local.functions.local.nhost.run",
    "x-forwarded-port": "80",
    "x-forwarded-proto": "http",
    "x-forwarded-server": "941746efd09a",
    "x-real-ip": "172.19.0.1",
    "x-replaced-path": "/v1/echo",
    "accept-encoding": "gzip"
  },
  "query": {},
  "node": "v22.13.0",
  "arch": "arm64"
}
```

## Production Considerations

This example showcases most Nhost features but includes development-only components like:
- Mailhog for email testing
- Hasura Console for GraphQL schema management

For production deployments:
- Remove development-only services
- Configure proper authentication secrets
- Set up proper database credentials
- Implement proper SSL/TLS termination
- Configure appropriate resource limits
- Implement proper backup strategies

## Support

For official support with self-hosting, please see our [pricing page](https://nhost.io/pricing) for support agreements. Community support is available through our [Discord](https://discord.com/invite/9V7Qb2U) and [GitHub discussions](https://github.com/nhost/nhost/discussions).
