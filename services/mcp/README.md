# Nhost MCP Service

The Nhost MCP service adds an agentic interface to any Nhost project. It exposes your project's GraphQL API and file storage as an [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server, allowing AI assistants like Claude, Cursor, or any MCP-compatible client to query and mutate your data.

If you're building on Nhost, this service lets your users interact with their project data through AI assistants — no custom integration code required. Deploy it alongside your project and any MCP-compatible client can connect, authenticate on behalf of your users via your existing Nhost Auth setup, and work with your data within the permissions defined.

## How It Works

The MCP server sits between your AI assistant and your Nhost project's services. It provides three GraphQL tools:

- **`get-schema`** - Introspects the GraphQL schema so the assistant understands your data model. Returns either a summary of available operations or the full SDL for specific queries/mutations.
- **`graphql-query`** - Executes read-only GraphQL queries against your project.
- **`graphql-mutation`** - Executes GraphQL mutations to create, update, or delete data.

When `--storage-url` / `MCP_STORAGE_URL` is configured, it also provides four storage tools:

- **`storage-upload`** - Uploads one or more files or images, with bucket selection and optional per-file IDs, names, and custom metadata.
- **`storage-download`** - Downloads files or images, including image transformations, conditional requests, and byte ranges.
- **`storage-update`** - Replaces file content while preserving its ID. The replacement filename becomes the stored name unless overridden.
- **`storage-delete`** - Permanently deletes a file and its metadata.

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
| `--storage-url` | `MCP_STORAGE_URL` | Storage service URL including API prefix, e.g. `https://SUBDOMAIN.storage.REGION.nhost.run/v1`; enables storage tools when set |
| `--storage-max-transfer-bytes` | `MCP_STORAGE_MAX_TRANSFER_BYTES` | Maximum decoded upload batch or storage response size in bytes (default: `50000000`, 50 MB) |
| `--storage-max-request-bytes` | `MCP_STORAGE_MAX_REQUEST_BYTES` | Maximum MCP POST body when storage is enabled, including base64 and metadata (default: `70000000`, 70 MB) |
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

File content is transferred as standard base64 (not a data URL). The MCP server does not read local files or fetch arbitrary source URLs. The default transfer budget is **50 MB (50,000,000 bytes)** per call: it bounds each storage response and the combined decoded upload/update files. This matches storage's default file-size limit, but storage still enforces the selected bucket's own settings and permissions.

Both budgets are deployment settings, not fixed small-file restrictions:

- `MCP_STORAGE_MAX_TRANSFER_BYTES` controls decoded upload batch and upstream response bytes.
- `MCP_STORAGE_MAX_REQUEST_BYTES` bounds HTTP POST bodies for the entire MCP endpoint, including GraphQL calls, **only when storage is enabled**. Its default is **70 MB (70,000,000 bytes)**, allowing base64 for 50 MB of files plus JSON and metadata. Oversized requests fail before MCP parsing.

Both settings must be positive integers below `9223372036854775807`; zero does not disable protection. To allow 100 MB transfers, for example:

```dotenv
MCP_STORAGE_MAX_TRANSFER_BYTES=100000000
MCP_STORAGE_MAX_REQUEST_BYTES=140000000
```

Choose request headroom for base64 (about 33% larger), JSON, and metadata when raising the transfer budget. Split batches above your configured budget; raise the limits or use storage directly for larger individual uploads/replacements, which do not support chunking. MCP clients, model providers, proxies, and bucket settings may impose smaller limits.

Uploads validate base64 before contacting storage, then decode it lazily into the outgoing multipart stream without retaining decoded files or a complete multipart payload. Successful downloads encode directly into the final base64 buffer, avoiding a separate raw-file buffer. **MCP request parsing and final responses are still buffered**. As a starting memory estimate, allow about 7 times the file bytes per concurrent upload or image download, and about 15 times per concurrent non-image download, plus headroom for baseline memory, JSON, metadata, and other active calls. Measure peak memory with your workload. The budgets are byte-transfer ceilings, not a process-memory guarantee. Use the lower limits in the 256 MiB example below.

### Upload (`POST /files`)

```json
{
  "files": [{ "name": "avatar.png", "data": "<base64 bytes>", "contentType": "image/png" }],
  "bucketId": "default",
  "metadata": [{ "id": "optional-custom-id", "name": "profile.png", "metadata": { "alt": "Profile picture" } }]
}
```

`files` is required. `contentType` is optional; storage detects the actual MIME type from file bytes. Omit `bucketId` to use storage's default bucket. Omit `metadata` entirely, or supply one entry per file in the same order (use `{}` for files without overrides). Each entry supports optional `id`, `name`, and arbitrary JSON `metadata`.

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

Downloads above `MCP_STORAGE_MAX_TRANSFER_BYTES` return an MCP error with the upstream `statusCode` and headers (including `Content-Length`, `Accept-Ranges`, and `ETag` when supplied), but no partial `data`. Raise the configured budget or retry with `range`, for example `{ "id": "large-file", "range": "bytes=0-1048575" }`, then request subsequent chunks within the budget and use `Content-Range` to determine the total size. If a transformation exceeds the limit, reduce its output size or omit transformation arguments and download the original in ranges: storage ignores ranges when transformations are requested. All storage response bodies, including upload/update/delete and error bodies, share the configured budget; a local size error after a write does not imply the write failed, so inspect storage state before retrying.

### Update (`PUT /files/{id}`)

```json
{
  "id": "existing-file-id",
  "file": { "name": "new-avatar.png", "data": "<base64 bytes>" },
  "metadata": { "name": "profile.png", "metadata": { "alt": "Updated picture" } }
}
```

`id` and `file` are required, even when changing only the name or custom metadata. The file ID stays the same. The stored name becomes `file.name` unless `metadata.name` is non-empty. To keep the current name, use it as `file.name`. A non-empty `metadata.metadata` object replaces the entire custom metadata object. Omitting it or passing `{}` leaves the current custom metadata unchanged.

### Delete (`DELETE /files/{id}`)

Pass `{ "id": "existing-file-id" }` to permanently delete the file and its metadata.

All four tools return structured `statusCode` and `headers`. Upload/update/delete include the complete storage response in `body` when present. Upstream failures set the MCP error flag without discarding error details or `processedFiles` from partially successful uploads. Batch uploads and replacements are not atomic; inspect failure responses before retrying. No administrative credentials are added: storage enforces the caller's permissions.

## Deploying to Nhost

To deploy to Nhost Run you can use the one-click install link below:

https://app.nhost.io/run-one-click-install?config=eyJuYW1lIjoibWNwIiwiaW1hZ2UiOnsiaW1hZ2UiOiJuaG9zdC9tY3A6MC4xLjAiLCJwdWxsQ3JlZGVudGlhbHMiOm51bGx9LCJjb21tYW5kIjpbIm1jcCJdLCJyZXNvdXJjZXMiOnsiY29tcHV0ZSI6eyJjcHUiOjEyNSwibWVtb3J5IjoyNTZ9LCJzdG9yYWdlIjpbXSwicmVwbGljYXMiOjEsImF1dG9zY2FsZXIiOm51bGx9LCJlbnZpcm9ubWVudCI6W3sibmFtZSI6Ik1DUF9BVVRIX1VSTCIsInZhbHVlIjoiaHR0cHM6Ly9TVUJET01BSU4uYXV0aC5SRUdJT04ubmhvc3QucnVuL3YxIn0seyJuYW1lIjoiTUNQX1JFQUxNIiwidmFsdWUiOiJodHRwczovL21jcC5hY21lLmNvbSJ9LHsibmFtZSI6Ik1DUF9HUkFQSFFMX0VORFBPSU5UIiwidmFsdWUiOiJodHRwOi8vaGFzdXJhLXNlcnZpY2U6ODA4MC92MS9ncmFwaHFsIn0seyJuYW1lIjoiTUNQX0lOU1RSVUNUSU9OUyIsInZhbHVlIjoiVGhlc2UgYXJlIHNvbWUgaW5zdHJ1Y3Rpb25zIGZvciB5b3VyIE1DUCBzZXJ2ZXIuIn0seyJuYW1lIjoiTUNQX0VORk9SQ0VfUk9MRSIsInZhbHVlIjoidXNlcl9tY3AifV0sInBvcnRzIjpbeyJwb3J0IjozMDAwLCJ0eXBlIjoiaHR0cCIsInB1Ymxpc2giOnRydWV9XSwiaGVhbHRoQ2hlY2siOm51bGx9

Set `MCP_AUTH_URL` to your project's Auth URL and `MCP_REALM` to your public MCP URL. Adjust `MCP_INSTRUCTIONS` and `MCP_ENFORCE_ROLE` as needed.

Check the [releases](https://github.com/nhost/nhost/releases) page for the most recent version. Both examples pin `nhost/mcp:0.1.0` for GraphQL only; that image does not support storage tools.

Alternatively, add a `run-mcp.toml` to your project directory:

```toml
name = 'mcp'
command = ['mcp']

[image]
image = 'nhost/mcp:0.1.0'

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

### Enable storage on the example deployment

For either method, replace `nhost/mcp:0.1.0` with a release image that supports `--storage-url`, `--storage-max-transfer-bytes`, and `--storage-max-request-bytes` (check `mcp --help` for that image). Older images ignore these environment variables.

On the 256 MiB example service, set explicit lower limits for one transfer at a time. The server defaults can exhaust that much memory on a single call. Add one `[[environment]]` block per variable in `run-mcp.toml`, or set them in the one-click service configuration:

```dotenv
MCP_STORAGE_URL=https://SUBDOMAIN.storage.REGION.nhost.run/v1
MCP_STORAGE_MAX_TRANSFER_BYTES=10000000
MCP_STORAGE_MAX_REQUEST_BYTES=14000000
```

Use your backend's storage URL, including its API prefix (for local development, `https://local.storage.local.nhost.run/v1`). Increase memory as needed before raising the limits or allowing concurrent transfers. Leave `MCP_STORAGE_URL` unset to keep storage tools disabled.

## Connecting an MCP Client

Point your MCP client to the server URL. For example, in Claude Desktop's configuration:

1. Go to customize -> Connectors
2. Click on `+` and enter any name you want and the url where your MCP server resides, for instance https://mcp.acme.com
3. Click "Add"
4. Once connected you will be redirected to your [Oauth2's consent page](https://docs.nhost.io/products/auth/oauth2-provider/authorization-flow#what-you-build-the-consent-page) to authorize the Oauth2 client.
