# Nhost MCP Service - Go Development Guide

**Important**: Always load the root `CLAUDE.md` at the repository root for general monorepo conventions before working on this project.

**Design rules**: Repo-wide Go rules live in `.claude/docs/go-design-rules.md` — load that first. Only MCP-specific patterns (tool annotations, OAuth2/PKCE auth flow, JWT forwarding to upstream services, storage tools, query allowlists) are documented below.

This document contains patterns, conventions, and workflows for implementing new tools and features in the Nhost MCP service. The service exposes a Hasura GraphQL endpoint and optional Nhost storage service as an MCP (Model Context Protocol) server, allowing AI assistants to query/mutate data and manage files.

## Core Principles

- **Always write tests** for new tools and middleware
- **Follow existing patterns** - use other tool implementations as examples
- **Security first** - forward auth tokens, never expose secrets
- **MCP protocol compliance** - use proper tool annotations (read-only, destructive, idempotent hints)

## Directory Structure

```
services/mcp/
├── main.go                          # Entry point
├── server/
│   ├── server.go                    # MCP server setup, CLI command, HTTP handler composition
│   └── server_test.go               # Server initialization and tool registration tests
├── auth/
│   ├── auth.go                      # OAuth2/OIDC middleware, JWT validation, discovery endpoints
│   └── auth_test.go                 # Auth middleware and discovery endpoint tests
├── tools/
│   ├── query.go                     # GraphQL query and mutation tools
│   ├── schema.go                    # Schema introspection and summarization tool
│   ├── query_internal_test.go       # GraphQL tool handler tests
│   ├── storage.go                   # Storage registration, authenticated HTTP transport and responses
│   ├── storage_upload.go            # Multipart batch upload and replacement
│   ├── storage_download.go          # Download transformations, conditions and ranges
│   └── storage_test.go              # In-process MCP and HTTP storage contract tests
├── project.nix                      # Nix build configuration
└── Makefile                         # Standard shared Makefile targets
```

GraphQL query parsing and validation lives in `cli/mcp/graphql/` (shared with the CLI MCP server).

## Implementing New Tools

### 1. Tool Registration

Add a new tool in `tools/` following the existing pattern:

```go
func (t *Tool) RegisterYourTool(mcpServer *mcpserver.MCPServer) {
    tool := mcp.NewTool(
        "tool-name",
        mcp.WithDescription("Description of what this tool does"),
        mcp.WithToolAnnotation(mcp.ToolAnnotation{
            Title:           "Human-readable title",
            ReadOnlyHint:    toBoolPtr(true),   // Set appropriately
            DestructiveHint: toBoolPtr(false),
            IdempotentHint:  toBoolPtr(true),
            OpenWorldHint:   toBoolPtr(true),
        }),
        mcp.WithString("param", mcp.Description("Parameter description"), mcp.Required()),
    )
    mcpServer.AddTool(tool, mcp.NewStructuredToolHandler(t.handleYourTool))
}
```

**Tool annotation guidelines**:
- `ReadOnlyHint`: true for queries/introspection, false for mutations
- `DestructiveHint`: true for mutations that delete or overwrite data
- `IdempotentHint`: true if calling the tool multiple times has the same effect
- `OpenWorldHint`: true if the tool interacts with external systems

### 2. Tool Handler

```go
type YourToolRequest struct {
    Param string `json:"param" jsonschema:"required,description=Parameter description"`
}

func (t *Tool) handleYourTool(
    ctx context.Context,
    _ mcp.CallToolRequest,
    args YourToolRequest,
) (*mcp.CallToolResult, error) {
    // Validate inputs
    // Execute logic
    // Return structured result
    return mcp.NewToolResultStructured(result, string(jsonBytes)), nil
}
```

### 3. Register in Server

Add the registration call in `server/server.go` `BuildServer()`:

```go
t.RegisterYourTool(mcpServer)
```

### 4. Update Tests

Add tool verification to `server/server_test.go` to confirm registration and correct annotations.

## Authentication Flow

The auth middleware (`auth/auth.go`) implements OAuth2 with PKCE for MCP clients:

1. MCP client discovers auth requirements via `/.well-known/oauth-protected-resource`
2. Client obtains a token from the authorization server (Nhost Auth) using the OAuth2 authorization code flow with PKCE
3. Client sends `Authorization: Bearer <token>` header on MCP requests
4. Middleware fetches JWKS from `<auth-url>/.well-known/jwks.json` and validates the JWT (signature, issuer, expiration)
5. The validated JWT (and its Authorization header) are propagated to tool handlers via context
6. Tool handlers forward the Authorization header to downstream GraphQL and storage requests via `authorizationInterceptor`, so backend permissions apply based on the JWT's Hasura claims

**Discovery endpoints** served by the MCP server:
- `/.well-known/oauth-authorization-server` - authorization server metadata (issuer, token endpoint, supported grants/scopes)
- `/.well-known/oauth-protected-resource` - resource metadata (resource URI, authorized servers, supported scopes)

**Role enforcement**: The `--enforce-role` flag checks that the JWT's `x-hasura-default-role` Hasura claim matches the specified role. When set, requests whose token carries a different default role receive a 403 Forbidden response. OAuth2 scopes (`openid`, `graphql`) are always advertised in the well-known endpoints.

## Storage Tools

- `--storage-url` / `MCP_STORAGE_URL` explicitly configures the storage API URL for the same backend, including its API prefix (normally `/v1`). Without it, no storage tools are registered. Do not infer service URLs from arbitrary GraphQL hosts.
- `tools.RegisterStorage` registers `storage-upload`, `storage-download`, `storage-update`, and `storage-delete`. Keep parity with POST `/files` and GET/PUT/DELETE `/files/{id}` in `services/storage/controller/openapi.yaml`.
- Forward the caller's Authorization header via the same context/interceptor as GraphQL. Never add admin secrets, accept arbitrary request URLs/headers, or follow upstream redirects.
- Transfer bytes as base64; do not read server-local paths or fetch user-provided source URLs. Upload/update use real multipart field names (`file[]`/`metadata[]`/`bucket-id`, or `file`/`metadata`). Preserve metadata ordering and explicit empty custom metadata objects.
- Bound every storage response to 4 MiB (`maxStorageTransferBytes`), checking Content-Length before reading and using `io.LimitReader` for unknown or incorrect lengths. Oversized responses return an MCP error retaining upstream status/headers, without truncated data. Download errors direct callers to `range` (e.g. `bytes=0-4194303`); transformations must be omitted for storage to honor ranges.
- Preflight each upload/update's decoded base64 size, and the full batch total, against the same 4 MiB cap before decoding or constructing multipart bodies. Account for base64 padding at the boundary; line breaks count toward the conservative size estimate. Larger individual uploads/replacements must use storage directly.
- mcp-go reads HTTP bodies before typed handlers run. With storage enabled, `server.storageRequestBodyLimit` caps all MCP POST bodies at 8 MiB (including GraphQL and metadata); keep this guard in front of the MCP transport, not just in storage handlers.
- Return status, headers and complete bodies within that cap, including partial upload `processedFiles`, conditional 304/412 responses, and partial download bytes. Only full successful nonempty image downloads produce MCP image content; carry their bytes only in that block and omit `data` from the structured response and its JSON text mirror. Other downloads retain base64 `data`. A response-size error after a write does not imply the write failed.
- The private `httpClient` interface allows `storage_limits_internal_test.go` to inject inline stubs for byte-read accounting; `storage_test.go` uses `httptest` servers to exercise the real transport. `RegisterStorage` owns the timeout and no-redirect policy rather than accepting caller-supplied clients.

## GraphQL Query Validation

Queries and mutations are validated against allowlists before execution (`cli/mcp/graphql/query.go`):

- Parses the GraphQL operation with `gqlparser`
- Rejects subscriptions
- Checks top-level selection fields against `allowedQueries` / `allowedMutations`
- Supports `"*"` wildcard to allow any operation

## Testing

### Test Patterns

Tests use in-process MCP client (`mcp-go/client`) and standard HTTP test utilities:

```go
// Server tests - verify tool registration
func TestBuildServer(t *testing.T) {
    mcpServer, err := server.BuildServer(cmd)
    // Use mcp-go client to initialize and list tools
    // Verify tool names, descriptions, and annotations with cmp.Diff
}

// Auth tests - mock auth server with RSA key pair
func TestMiddleware(t *testing.T) {
    // Create test RSA key, mock JWKS/OIDC endpoints
    // Test: missing token, invalid scheme, expired token, valid token
    // Verify WWW-Authenticate headers
}
```

**Testing conventions**:
- Use `cmp.Diff` with `cmpopts.SortSlices` for comparing tool lists
- Use `t.Parallel()` for all tests
- Create mock HTTP servers for auth and GraphQL endpoints
- Test both success and error paths

## Key Dependencies

- `github.com/mark3labs/mcp-go` - MCP protocol implementation
- `github.com/urfave/cli/v3` - CLI framework
- `github.com/golang-jwt/jwt/v5` - JWT parsing and validation
- `github.com/MicahParks/keyfunc/v3` - JWKS integration
- `github.com/vektah/gqlparser/v2` - GraphQL query parsing

## Development Workflow

1. **Design**: Plan the tool, its parameters, and annotations
2. **Implement**: Write tool registration and handler in `tools/`
3. **Wire up**: Register in `server/server.go` `BuildServer()`
4. **Test**: Write tests for tool registration and handler logic
5. Run the mandatory post-change checks from `.claude/docs/go-design-rules.md`.
