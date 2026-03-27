# Nhost MCP Service - Go Development Guide

**Important**: Always load the root `CLAUDE.md` at the repository root for general monorepo conventions before working on this project.

This document contains patterns, conventions, and workflows for implementing new tools and features in the Nhost MCP service. The service exposes a Hasura GraphQL endpoint as an MCP (Model Context Protocol) server, allowing AI assistants to query and mutate data.

## Core Principles

- **Always write tests** for new tools and middleware
- **Follow existing patterns** - use other tool implementations as examples
- **Security first** - forward auth tokens, never expose secrets
- **MCP protocol compliance** - use proper tool annotations (read-only, destructive, idempotent hints)

## Directory Structure

```
services/mcp/
├── main.go                 # Entry point
├── server/
│   ├── server.go          # MCP server setup, CLI command, HTTP handler composition
│   ├── middleware.go      # Request/response logging with trace IDs
│   └── server_test.go     # Server initialization and tool registration tests
├── auth/
│   ├── auth.go            # OAuth2/OIDC middleware, JWT validation, discovery endpoints
│   └── auth_test.go       # Auth middleware and discovery endpoint tests
├── tools/
│   ├── query.go           # GraphQL query and mutation tools
│   └── schema.go          # Schema introspection and summarization tool
├── project.nix            # Nix build configuration
└── Makefile               # Standard shared Makefile targets
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

The auth middleware (`auth/auth.go`) implements OAuth2/OIDC:

1. Client sends `Authorization: Bearer <token>` header
2. Middleware discovers JWKS endpoint from the auth server's `/.well-known/openid-configuration`
3. JWT is validated (signature, issuer, expiration)
4. Authorization header is propagated to tool handlers via context
5. Tool handlers forward the header to downstream GraphQL requests via `authorizationInterceptor`

**Discovery endpoints** served by the MCP server:
- `/.well-known/oauth-authorization-server` - server metadata
- `/.well-known/oauth-protected-resource` - resource metadata

Auth is optional - when `--auth-url` is not set, requests proceed unauthenticated.

## GraphQL Query Validation

Queries and mutations are validated against allowlists before execution (`cli/mcp/graphql/query.go`):

- Parses the GraphQL operation with `gqlparser`
- Rejects subscriptions
- Checks top-level selection fields against `allowedQueries` / `allowedMutations`
- Supports `"*"` wildcard to allow any operation

## CLI Flags

```
--listen-addr             HTTP listen address (default: :3000)
--graphql-endpoint        GraphQL endpoint URL (required)
--mcp-instructions        Server-level instructions
--query-instructions      Query tool instructions
--mutation-instructions   Mutation tool instructions
--schema-instructions     Schema tool instructions
--auth-url                OAuth2 auth server URL (enables auth)
--realm                   WWW-Authenticate realm
--scopes                  OAuth2 scopes (default: openid, graphql)
```

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
5. **Format**: Run `golines -w --base-formatter=gofumpt .`
6. **Lint**: Run `golangci-lint run --fix`
7. **Test**: Run `go test -v ./...`

## Lint and Tests

- **Formatter**: `golines -w --base-formatter=gofumpt .`
- **Linter**: `golangci-lint run --fix`
- **Tests**: `go test -v ./...`
- **Coverage**: `go test -v -cover ./...`
