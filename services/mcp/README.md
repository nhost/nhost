# Nhost MCP Service

The Nhost MCP service adds an agentic interface to any Nhost project. It exposes your project's GraphQL API and file storage as an [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server, allowing AI assistants like Claude, Cursor, or any MCP-compatible client to query and mutate your data.

If you're building on Nhost, this service lets your users interact with their project data through AI assistants — no custom integration code required. Deploy it alongside your project and any MCP-compatible client can connect, authenticate on behalf of your users via your existing Nhost Auth setup, and work with your data within the permissions defined.

## How It Works

The MCP server sits between your AI assistant and your Nhost project's services. It provides three GraphQL tools:

- **`get-schema`** - Introspects the GraphQL schema so the assistant understands your data model. Returns either a summary of available operations or the full SDL for specific queries/mutations.
- **`graphql-query`** - Executes read-only GraphQL queries against your project.
- **`graphql-mutation`** - Executes GraphQL mutations to create, update, or delete data.

When `--storage-url` / `MCP_STORAGE_URL` is configured, it also provides the read-only **`storage-download`** tool for files and images, including image transformations, conditional requests, and byte ranges.

On startup, the server fetches a schema summary from your GraphQL endpoint and includes it in the MCP instructions, giving the AI assistant immediate context about your data model without any additional configuration.

## Authentication with OAuth2

The MCP service integrates with Nhost Auth as an [OAuth2 authorization server](https://docs.nhost.io/products/auth/oauth2-provider/), following the [MCP Authorization specification](https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization). This means any MCP client that supports OAuth2 can authenticate with your Nhost project automatically.

The flow works as follows:

1. The MCP client discovers authentication requirements by fetching `/.well-known/oauth-protected-resource` from the MCP server.
2. The client redirects the user to the Nhost Auth authorization endpoint for login (authorization code flow with PKCE).
3. After authentication, the client exchanges the authorization code for a JWT access token.
4. All subsequent MCP requests include the JWT as a Bearer token.
5. The MCP server validates the JWT signature via JWKS, checks the issuer and expiration, then forwards the token on every GraphQL and storage request.
6. The backend services enforce permissions based on the JWT's claims, so the AI assistant can only access data and files the authenticated user is allowed to access.

IMPORTANT! [CIMD](https://docs.nhost.io/products/auth/oauth2-provider/cimd-clients/) needs to be enabled.

## Enforcing a Specific Role

The `--enforce-role` flag restricts the MCP server to accept only tokens whose `x-hasura-default-role` claim matches the specified role. Requests with a different default role receive a 403 Forbidden response.

For example, setting `--enforce-role=user_mcp` means only tokens issued with `user_mcp` as the default role will be accepted. If you've configured permissions for that role with limited access (e.g., read-only on certain tables), the AI assistant will be restricted to those permissions.

This lets you:

- Create a dedicated role (e.g., `user_mcp`) with restricted permissions for AI access.
- Allow AI assistants to read data but not modify it.
- Limit which tables or columns are visible to the assistant.
- Run multiple MCP instances with different role configurations for different use cases.

## Configuration

All flags can be set via environment variables.

| Flag | Env Var | Description |
|------|---------|-------------|
| `--listen-addr` | `MCP_LISTEN_ADDR` | HTTP listen address (default: `:3000`) |
| `--debug` | `MCP_DEBUG` | Enable debug logging |
| `--log-format-text` | `MCP_LOG_FORMAT_TEXT` | Format logs in plain text instead of JSON |
| `--graphql-endpoint` | `MCP_GRAPHQL_ENDPOINT` | GraphQL endpoint URL (**required**) |
| `--storage-url` | `MCP_STORAGE_URL` | Storage service URL including API prefix, e.g. `https://SUBDOMAIN.storage.REGION.nhost.run/v1`; enables `storage-download` when set |
| `--storage-max-transfer-bytes` | `MCP_STORAGE_MAX_TRANSFER_BYTES` | Maximum storage download response size in bytes (default: `50000000`, 50 MB) |
| `--mcp-instructions` | `MCP_INSTRUCTIONS` | Server-level MCP instructions |
| `--query-instructions` | `MCP_QUERY_INSTRUCTIONS` | Instructions for the graphql-query tool |
| `--mutation-instructions` | `MCP_MUTATION_INSTRUCTIONS` | Instructions for the graphql-mutation tool |
| `--schema-instructions` | `MCP_SCHEMA_INSTRUCTIONS` | Instructions for the get-schema tool |
| `--auth-url` | `MCP_AUTH_URL` | OAuth2 authorization server URL (**required**) |
| `--realm` | `MCP_REALM` | Realm for WWW-Authenticate header |
| `--enforce-role` | `MCP_ENFORCE_ROLE` | Enforce that the JWT's default Hasura role matches this value |
| `--browser-html` | `MCP_BROWSER_HTML` | HTML content to serve when a browser visits the service URL |

## Storage Tools

Set `MCP_STORAGE_URL` to the storage service belonging to the **same backend** as your GraphQL and Auth URLs, including its API prefix (normally `/v1`). It is explicitly configured, not inferred from GraphQL, so custom domains and internal service addresses work too. Without this setting, only the three GraphQL tools are registered. Tool arguments cannot override the service URL, authorization, or arbitrary headers; upstream redirects are not followed.

`MCP_STORAGE_MAX_TRANSFER_BYTES` limits each upstream download response, including error bodies, to **50 MB (50,000,000 bytes)** by default. Set it to a positive integer less than `9223372036854775807` to change the limit. Storage still enforces the bucket's settings and the caller's permissions. The MCP server does not read local files or fetch arbitrary source URLs.

Successful downloads encode directly into a base64 buffer without retaining a separate raw-file buffer. **MCP responses are still buffered**. As a starting memory estimate, allow about 7 times the file bytes per concurrent image download and about 15 times per concurrent non-image download, plus headroom for baseline memory and other calls. Measure with your workload; the transfer limit is not a process-memory guarantee. Client, model provider, or proxy limits may be smaller.

### Download (`GET /files/{id}`)

`id` is required. All download options are exposed:

| Arguments | Storage behavior |
|-----------|------------------|
| `q` | Image quality, 1–100 |
| `h`, `w` | Maximum image height/width in pixels, preserving aspect ratio |
| `b` | Blur sigma, including explicit zero |
| `f` | Output format: `same`, `auto`, `jpeg`, `png`, `webp`, `avif`, `heic` |
| `accept` | `Accept` header for `f=auto`, e.g. `image/webp` |
| `range` | `Range` header, e.g. `bytes=0-1023` |
| `ifMatch`, `ifNoneMatch` | ETag conditions |
| `ifModifiedSince`, `ifUnmodifiedSince` | HTTP-date conditions |

Storage enforces its configured transformation limits and supported formats. As with the REST endpoint, ranges are ignored when transformations are requested. Responses include the HTTP status and all response headers, including caching, ETag, last-modified and content-range information. Complete, nonempty image downloads carry their bytes only in MCP image content; the structured response and its JSON text summary omit `data`. Other downloads, including partial and non-image responses and errors, return base64 `data` without image content. A `304` is a successful empty-body result; `412` is an error result with the response details preserved.

Downloads above `MCP_STORAGE_MAX_TRANSFER_BYTES` return an MCP error with the upstream `statusCode` and headers (including `Content-Length`, `Accept-Ranges`, and `ETag` when supplied), but no partial `data`. Raise the configured budget or retry with `range`, for example `{ "id": "large-file", "range": "bytes=0-1048575" }`, then request subsequent chunks within the budget and use `Content-Range` to determine the total size. If a transformation exceeds the limit, reduce its output size or omit transformation arguments and download the original in ranges: storage ignores ranges when transformations are requested.

## Deploying to Nhost

To deploy to Nhost Run you can use the one-click install link below:

https://app.nhost.io/run-one-click-install?config=eyJuYW1lIjoibWNwIiwiaW1hZ2UiOnsiaW1hZ2UiOiJuaG9zdC9tY3A6MC40LjAiLCJwdWxsQ3JlZGVudGlhbHMiOm51bGx9LCJjb21tYW5kIjpbIm1jcCJdLCJyZXNvdXJjZXMiOnsiY29tcHV0ZSI6eyJjcHUiOjEyNSwibWVtb3J5IjoyNTZ9LCJzdG9yYWdlIjpbXSwicmVwbGljYXMiOjEsImF1dG9zY2FsZXIiOm51bGx9LCJlbnZpcm9ubWVudCI6W3sibmFtZSI6Ik1DUF9BVVRIX1VSTCIsInZhbHVlIjoiaHR0cHM6Ly9TVUJET01BSU4uYXV0aC5SRUdJT04ubmhvc3QucnVuL3YxIn0seyJuYW1lIjoiTUNQX1JFQUxNIiwidmFsdWUiOiJodHRwczovL21jcC5hY21lLmNvbSJ9LHsibmFtZSI6Ik1DUF9HUkFQSFFMX0VORFBPSU5UIiwidmFsdWUiOiJodHRwOi8vaGFzdXJhLXNlcnZpY2U6ODA4MC92MS9ncmFwaHFsIn0seyJuYW1lIjoiTUNQX0lOU1RSVUNUSU9OUyIsInZhbHVlIjoiVGhlc2UgYXJlIHNvbWUgaW5zdHJ1Y3Rpb25zIGZvciB5b3VyIE1DUCBzZXJ2ZXIuIn0seyJuYW1lIjoiTUNQX0VORk9SQ0VfUk9MRSIsInZhbHVlIjoidXNlcl9tY3AifSx7Im5hbWUiOiJNQ1BfU1RPUkFHRV9VUkwiLCJ2YWx1ZSI6Imh0dHA6Ly9oYXN1cmEtc3RvcmFnZS1zZXJ2aWNlOjUwMDAvdjEifSx7Im5hbWUiOiJNQ1BfU1RPUkFHRV9NQVhfVFJBTlNGRVJfQllURVMiLCJ2YWx1ZSI6IjEwMDAwMDAwIn1dLCJwb3J0cyI6W3sicG9ydCI6MzAwMCwidHlwZSI6Imh0dHAiLCJwdWJsaXNoIjp0cnVlfV0sImhlYWx0aENoZWNrIjpudWxsfQ==

Set `MCP_AUTH_URL` to your project's Auth URL and `MCP_REALM` to your public MCP URL. Adjust `MCP_INSTRUCTIONS` and `MCP_ENFORCE_ROLE` as needed.

Both examples use `nhost/mcp:0.4.0` and enable `storage-download`. Check the [releases](https://github.com/nhost/nhost/releases) page before deploying; the image tag must be published.

Alternatively, add a `run-mcp.toml` to your project directory:

```toml
name = 'mcp'
command = ['mcp']

[image]
image = 'nhost/mcp:0.4.0'

[[environment]]
name = 'MCP_AUTH_URL'
value = 'https://local.auth.local.nhost.run/v1'

[[environment]]
name = 'MCP_REALM'
value = 'https://myapp.example.com'

[[environment]]
name = 'MCP_GRAPHQL_ENDPOINT'
value = 'http://hasura-service:8080/v1/graphql'

[[environment]]
name = 'MCP_STORAGE_URL'
value = 'http://hasura-storage-service:5000/v1'

[[environment]]
name = 'MCP_STORAGE_MAX_TRANSFER_BYTES'
value = '10000000'

[[environment]]
name = 'MCP_INSTRUCTIONS'
value = 'This MCP server interacts with my application'

[[environment]]
name = 'MCP_ENFORCE_ROLE'
value = 'user_mcp'

[[ports]]
port = 3000
type = 'http'
publish = true

[resources]
replicas = 1

[resources.compute]
cpu = 125
memory = 256
```

Then deploy your project as usual. The MCP server will be available at the published port and any MCP-compatible client can connect to it.

You can also try locally with:

```
nhost up --run-service run-mcp.toml
```

### Storage downloads on Nhost Run

Both examples use the internal Storage endpoint, `http://hasura-storage-service:5000/v1`. If the service can't reach that hostname, use the Storage URL for the same backend, including its API prefix (for local development, `https://local.storage.local.nhost.run/v1`).

The examples set a 10 MB download response limit for the 256 MiB service. This is a starting point for one download at a time, not a concurrency limit. The 50 MB server default can exhaust that much memory on a single call. Increase memory as needed before raising the limit or allowing concurrent downloads.

Grant only Download (`select`) on the files the caller's role should be able to read. Remove `MCP_STORAGE_URL` to disable `storage-download`.

## Connecting an MCP Client

Point your MCP client to the server URL. For example, in Claude Desktop's configuration:

1. Go to customize -> Connectors
2. Click on `+` and enter any name you want and the url where your MCP server resides, for instance https://mcp.acme.com
3. Click "Add"
4. Once connected you will be redirected to your [Oauth2's consent page](https://docs.nhost.io/products/auth/oauth2-provider/authorization-flow#what-you-build-the-consent-page) to authorize the Oauth2 client.
