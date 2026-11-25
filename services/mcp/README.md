# Nhost MCP Service

The Nhost MCP service exposes your project's GraphQL API and optional file downloads over the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/). AI assistants such as Claude and Cursor can query or modify data and download files with the signed-in user's permissions.

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

## Storage Downloads

Set `MCP_STORAGE_URL` to the Storage API URL for the same project as your GraphQL and Auth endpoints, including `/v1`. Without this setting, `storage-download` is not listed. Storage applies the caller's file permissions.

`storage-download` requires a stored file `id`, not a local path or source URL. It supports the following options from the Storage download endpoint (`GET /files/{id}`):

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

The result includes the Storage HTTP status and response headers. Complete, nonempty image downloads include the bytes only in the MCP image block; read `structuredContent.data` for base64 bytes from other downloads, including byte ranges. A `304` response has no file bytes.

Clients that support [MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview) can show the download in a panel without another request to Storage. The panel previews complete AVIF, GIF, JPEG, PNG, and WebP images if the client can decode them. When it can't show a preview, it displays a status message. The tool result is the same for clients without MCP Apps.

A download over `MCP_STORAGE_MAX_TRANSFER_BYTES` returns an error with the Storage status and headers but no file bytes. Retry with a smaller range, for example `{ "id": "large-file", "range": "bytes=0-1048575" }`, or request a smaller image. Storage ignores byte ranges when transforming an image. See [Transfer limits](https://docs.nhost.io/products/ai/mcp/configuration#transfer-limits) before raising the limit.

## Deploying to Nhost

[Deploy MCP to Nhost Run](https://app.nhost.io/run-one-click-install?config=eyJuYW1lIjoibWNwIiwiaW1hZ2UiOnsiaW1hZ2UiOiJuaG9zdC9tY3A6MC40LjAiLCJwdWxsQ3JlZGVudGlhbHMiOm51bGx9LCJjb21tYW5kIjpbIm1jcCJdLCJyZXNvdXJjZXMiOnsiY29tcHV0ZSI6eyJjcHUiOjEyNSwibWVtb3J5IjoyNTZ9LCJzdG9yYWdlIjpbXSwicmVwbGljYXMiOjEsImF1dG9zY2FsZXIiOm51bGx9LCJlbnZpcm9ubWVudCI6W3sibmFtZSI6Ik1DUF9BVVRIX1VSTCIsInZhbHVlIjoiaHR0cHM6Ly9TVUJET01BSU4uYXV0aC5SRUdJT04ubmhvc3QucnVuL3YxIn0seyJuYW1lIjoiTUNQX1JFQUxNIiwidmFsdWUiOiJodHRwczovL21jcC5hY21lLmNvbSJ9LHsibmFtZSI6Ik1DUF9HUkFQSFFMX0VORFBPSU5UIiwidmFsdWUiOiJodHRwOi8vaGFzdXJhLXNlcnZpY2U6ODA4MC92MS9ncmFwaHFsIn0seyJuYW1lIjoiTUNQX0lOU1RSVUNUSU9OUyIsInZhbHVlIjoiVGhlc2UgYXJlIHNvbWUgaW5zdHJ1Y3Rpb25zIGZvciB5b3VyIE1DUCBzZXJ2ZXIuIn0seyJuYW1lIjoiTUNQX0VORk9SQ0VfUk9MRSIsInZhbHVlIjoidXNlcl9tY3AifSx7Im5hbWUiOiJNQ1BfU1RPUkFHRV9VUkwiLCJ2YWx1ZSI6Imh0dHA6Ly9oYXN1cmEtc3RvcmFnZS1zZXJ2aWNlOjUwMDAvdjEifSx7Im5hbWUiOiJNQ1BfU1RPUkFHRV9NQVhfVFJBTlNGRVJfQllURVMiLCJ2YWx1ZSI6IjEwMDAwMDAwIn1dLCJwb3J0cyI6W3sicG9ydCI6MzAwMCwidHlwZSI6Imh0dHAiLCJwdWJsaXNoIjp0cnVlfV0sImhlYWx0aENoZWNrIjpudWxsfQ==)

Set `MCP_AUTH_URL` to your project's Auth URL and `MCP_REALM` to your public MCP URL. Set `MCP_ENFORCE_ROLE` to your dedicated MCP role, or remove it to use each signed-in user's default role. Replace the sample `MCP_INSTRUCTIONS` with a description of your application.

The installer uses the project's internal GraphQL and Storage endpoints and sets a 10 MB download limit for a 256 MiB instance. Grant [Download permission](https://docs.nhost.io/products/ai/mcp/permissions#storage-permissions) only for the files the assistant should read, or remove `MCP_STORAGE_URL` to turn off downloads.

See the [deployment guide](https://docs.nhost.io/products/ai/mcp/deployment) for the OAuth2 prerequisites, manual TOML configuration, and local development.

## Connecting an MCP Client

Point your MCP client to the server URL. For example, in Claude Desktop's configuration:

1. Go to customize -> Connectors
2. Click on `+` and enter any name you want and the url where your MCP server resides, for instance https://mcp.acme.com
3. Click "Add"
4. Once connected you will be redirected to your [Oauth2's consent page](https://docs.nhost.io/products/auth/oauth2-provider/authorization-flow#what-you-build-the-consent-page) to authorize the Oauth2 client.
