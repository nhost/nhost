# Nhost Hasura Auth - Go Development Guide

This document contains patterns, conventions, and workflows for implementing new endpoints and features in the Nhost Hasura Auth Go codebase.

## Core Principles

- **Always write tests** for endpoints and new use cases in existing endpoints
- **Follow existing patterns** - use other implementations as examples
- **Security first** - never expose secrets, always validate inputs, follow auth patterns
- **Database safety** - use transactions where appropriate, handle errors gracefully

## Environment Setup

The project uses Nix for reproducible builds. Enter the dev shell with:

```bash
nix develop .#auth
# or from the services/auth directory:
make develop
```

This provides all necessary tools: go, golangci-lint, golines, gofumpt, mockgen, oapi-codegen, sqlc, vacuum-go, bun, etc.

See `CONTRIBUTING.md` for setup details.

## Directory Structure

```
docs/
├── openapi.yaml            # OpenAPI 3.0 spec (source of truth for API)
├── openapi.go              # Embeds openapi.yaml into Go binary
go/
├── api/                    # Generated API types and server stubs
│   ├── server.cfg.yaml     # oapi-codegen server generation config
│   ├── types.cfg.yaml      # oapi-codegen types generation config
│   ├── server.gen.go       # Generated Gin server code (strict-server mode)
│   └── types.gen.go        # Generated Go types
├── cmd/                    # Application entrypoint
├── controller/             # HTTP handlers and business logic
│   ├── controller.go       # Main controller, interfaces (DBClient, Emailer, etc.)
│   ├── workflows.go        # Business logic workflows
│   ├── errors.go           # Error definitions and handling
│   ├── config.go           # Configuration
│   ├── jwt.go              # JWT token generation/validation
│   ├── validator.go        # Input validation
│   ├── sign_in_*.go        # Endpoint handlers (following naming pattern)
│   ├── oauth2_*.go         # OAuth2 provider endpoints
│   ├── *_test.go           # Tests
│   ├── main_test.go        # Test helpers (testRequest, getController, etc.)
│   └── mock/               # Generated mocks (controller, workflows, jwt, validator)
├── sql/                    # Database layer
│   ├── query.sql           # SQL queries (source for sqlc generation)
│   ├── query.sql.go        # Generated Go code from queries
│   ├── sqlc.yaml           # sqlc config (pgx/v5, type overrides for UUID, Text, etc.)
│   ├── auth_schema_dump.sql # Schema used by sqlc for type inference
│   ├── models.go           # Generated database models
│   ├── data.go             # go:generate directive for schema.sh
│   └── schema.sh           # Script to dump auth schema
├── middleware/             # HTTP middleware (rate limiting, turnstile)
├── migrations/             # Database migrations (postgres)
├── notifications/          # Email template handling
├── oauth2/                 # OAuth2 provider implementation
├── oidc/                   # OpenID Connect ID token validation
├── providers/              # OAuth/social login providers
├── cryto/                  # Encryption utilities
├── hibp/                   # Have I Been Pwned integration
└── testhelpers/            # Test utilities (GomockCmpOpts, FilterPathLast, etc.)
test/                       # E2E tests (TypeScript/Bun)
email-templates/            # Email templates (bundled in Docker image)
vacuum.yaml                 # OpenAPI spec linting rules
vacuum-ignore.yaml          # OpenAPI spec lint suppressions
```

## Implementing New Endpoints

### 1. API Specification (OpenAPI)

Add endpoint definition to `docs/openapi.yaml`:

```yaml
paths:
  /your-endpoint:
    post:
      summary: Description of what this does
      tags:
        - authentication        # Use existing tags: authentication, security, session, user, system, verification
      security:
        - BearerAuth: []        # For authenticated endpoints
        - {}                    # For optional auth
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/YourRequest'
        required: true
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/YourResponse'
          description: Success description
        '401':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
          description: Error description

components:
  schemas:
    YourRequest:
      type: object
      additionalProperties: false
      properties:
        field:
          type: string
          description: Field description
      required:
        - field
```

**Important**:
- Use `additionalProperties: false` for strict validation
- Add proper descriptions and examples
- Define all possible response codes
- Use existing error response schemas

### 2. SQL Queries

Add database queries to `go/sql/query.sql`:

```sql
-- name: YourQueryName :one/:many/:exec
SELECT/UPDATE/DELETE/INSERT ...
WHERE condition = $1;
```

**Query naming conventions**:
- `:one` - returns single row
- `:many` - returns multiple rows
- `:exec` - no return value (INSERT/UPDATE/DELETE)
- Use descriptive names like `GetUserByRefreshTokenHash`

### 3. Controller Implementation

Create `go/controller/your_endpoint.go`:

```go
package controller

import (
    "context"

    "github.com/nhost/nhost/services/auth/go/api"
    oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
)

func (ctrl *Controller) YourEndpoint( //nolint:ireturn
    ctx context.Context, request api.YourEndpointRequestObject,
) (api.YourEndpointResponseObject, error) {
    logger := oapimw.LoggerFromContext(ctx)

    // Validate inputs
    if apiErr := ctrl.wf.ValidateInput(request.Body.Field, logger); apiErr != nil {
        return ctrl.respondWithError(apiErr), nil
    }

    // Get authenticated user if needed
    user, apiErr := ctrl.wf.GetUserFromJWTInContext(ctx, logger)
    if apiErr != nil {
        return ctrl.sendError(ErrUnauthenticatedUser), nil
    }

    // Business logic
    result, apiErr := ctrl.wf.DoSomething(ctx, user.ID, request.Body.Field, logger)
    if apiErr != nil {
        return ctrl.respondWithError(apiErr), nil
    }

    return api.YourEndpoint200JSONResponse(*result), nil
}
```

**Controller patterns**:
- Always get logger from context: `oapimw.LoggerFromContext(ctx)`
- Use workflows for business logic, not direct DB calls
- Handle errors with `ctrl.respondWithError(apiErr)` or `ctrl.sendError(ErrType)`
- Return appropriate HTTP status codes via generated response types

### 4. Workflow Methods

Add business logic to `go/controller/workflows.go`:

```go
func (wf *Workflows) DoSomething(
    ctx context.Context,
    userID uuid.UUID,
    input string,
    logger *slog.Logger,
) (*Result, *APIError) {
    // Validate business rules
    if !wf.ValidateBusinessRule(input) {
        logger.WarnContext(ctx, "business rule validation failed")
        return nil, ErrInvalidRequest
    }

    // Database operations
    result, err := wf.db.YourQuery(ctx, sql.YourQueryParams{
        UserID: userID,
        Input:  pgtype.Text{String: input, Valid: true},
    })
    if errors.Is(err, pgx.ErrNoRows) {
        logger.WarnContext(ctx, "resource not found")
        return nil, ErrNotFound
    }
    if err != nil {
        logger.ErrorContext(ctx, "database error", logError(err))
        return nil, ErrInternalServerError
    }

    return &result, nil
}
```

**Workflow patterns**:
- Take context, relevant IDs, inputs, and logger as parameters
- Return result and `*APIError` (not Go error)
- Log warnings for user errors, errors for system errors
- Use `pgtype.Text{String: value, Valid: true}` for nullable text fields or `sql.Text(value)` helper
- Handle `pgx.ErrNoRows` specifically for not found cases

### 5. Error Handling

Add errors to `go/controller/errors.go` if needed:

```go
var (
    ErrYourSpecificError = &APIError{api.YourErrorType}
)
```

**Error patterns**:
- Use existing error types when possible (`ErrInvalidRequest`, `ErrInternalServerError`, etc.)
- Map to appropriate HTTP status codes
- Provide meaningful error messages
- Never expose internal system details

### 6. Database Interface

If adding new database methods, update `go/controller/controller.go`:

```go
type DBClient interface {
    // ... existing composed interfaces
    YourNewMethod(ctx context.Context, params YourParams) (YourResult, error)
}
```

### 7. Testing

Create `go/controller/your_endpoint_test.go`:

```go
package controller_test

import (
    "context"
    "testing"

    "github.com/google/go-cmp/cmp"
    "github.com/google/uuid"
    "github.com/nhost/nhost/services/auth/go/api"
    "github.com/nhost/nhost/services/auth/go/controller"
    "github.com/nhost/nhost/services/auth/go/controller/mock"
    "go.uber.org/mock/gomock"
)

func TestYourEndpoint(t *testing.T) {
    t.Parallel()

    userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")

    cases := []testRequest[api.YourEndpointRequestObject, api.YourEndpointResponseObject]{
        {
            name:   "success case",
            config: getConfig,
            db: func(ctrl *gomock.Controller) controller.DBClient {
                mock := mock.NewMockDBClient(ctrl)

                mock.EXPECT().YourQuery(
                    gomock.Any(),
                    gomock.Any(),
                ).Return(expectedResult, nil)

                return mock
            },
            request: api.YourEndpointRequestObject{
                Body: &api.YourRequest{
                    Field: "test-value",
                },
            },
            expectedResponse: api.YourEndpoint200JSONResponse(expectedResponse),
            expectedJWT:      nil,
            jwtTokenFn:       nil,
            getControllerOpts: []getControllerOptsFunc{},
        },
        // Add error cases, edge cases, etc.
    }

    for _, tc := range cases {
        t.Run(tc.name, func(t *testing.T) {
            t.Parallel()

            ctrl := gomock.NewController(t)
            defer ctrl.Finish()

            c, _ := getController(t, ctrl, tc.config, tc.db, tc.getControllerOpts...)

            resp, err := c.YourEndpoint(context.Background(), tc.request)
            if err != nil {
                t.Fatalf("unexpected error: %v", err)
            }

            if diff := cmp.Diff(tc.expectedResponse, resp); diff != "" {
                t.Errorf("unexpected response (-want +got):\n%s", diff)
            }
        })
    }
}
```

**Testing patterns**:
- Use `testRequest` struct for consistent test structure
- Test success cases, error cases, edge cases, and validation
- Use `gomock.NewController(t)` and `defer ctrl.Finish()`
- Use `cmp.Diff` for response comparison
- Use `getSigninUser(userID)` helper for authenticated user scenarios

## Code Generation

After making changes to OpenAPI specs, SQL queries, or interfaces, run from the repo root:

```bash
go generate ./services/auth/...
```

Then format the generated code:

```bash
golines -w --base-formatter=gofumpt services/auth
```

**What gets generated** (all `go:generate` directives):
- `go/api/`: server stubs and types from `docs/openapi.yaml` via oapi-codegen
- `go/sql/`: Go code from `query.sql` via sqlc, schema dump via `schema.sh`
- `go/controller/mock/`: mocks from `controller.go`, `workflows.go`, `jwt.go`, `validator.go` via mockgen
- `go/oauth2/mock/`: mocks from `provider.go` (Signer, DBClient) via mockgen

**CI verifies** that generated code is up to date by comparing sha1sums before and after running `go generate`.

## Authentication Patterns

### JWT Authentication

```go
// Get authenticated user
user, apiErr := ctrl.wf.GetUserFromJWTInContext(ctx, logger)
if apiErr != nil {
    return ctrl.sendError(ErrUnauthenticatedUser), nil
}
```

### Optional Authentication

```go
// Optional auth - proceed with or without user
user, _ := ctrl.wf.GetUserFromJWTInContext(ctx, logger)
// user will be empty if not authenticated
```

### Refresh Token Operations

```go
// Hash refresh tokens before database operations
hashedToken := hashRefreshToken([]byte(refreshToken))

// Use proper pgtype for database parameters
pgtype.Text{String: hashedToken, Valid: true}
// Or use helper
sql.Text(hashedToken)
```

## Security Best Practices

1. **Input Validation**: Always validate inputs at the workflow level
2. **Authorization**: Check user permissions before operations
3. **Token Handling**: Always hash tokens before storage/comparison
4. **Error Messages**: Don't expose sensitive information in errors
5. **Logging**: Log security events appropriately (warn for user errors, error for system issues)

## Database Best Practices

1. **Use Transactions**: For multi-step operations
2. **Handle NULL**: Use `pgtype.Text` for nullable fields or `sql.Text()` helper
3. **Error Handling**: Always check for `pgx.ErrNoRows`
4. **Parameterized Queries**: Never build SQL strings dynamically
5. **Naming**: Use descriptive query names following existing patterns

## Common Patterns

### Refresh Token Deletion

```go
// Single token
wf.db.DeleteRefreshToken(ctx, pgtype.Text{String: hashedToken, Valid: true})

// All user tokens
wf.db.DeleteRefreshTokens(ctx, userID)
```

### User Validation

```go
if apiErr := wf.ValidateUser(user, logger); apiErr != nil {
    return user, apiErr
}
```

### Error Response

```go
// For client errors (400-level)
return ctrl.sendError(ErrInvalidRequest), nil

// For server errors (500-level)
return ctrl.respondWithError(apiErr), nil
```

## Development Workflow

All commands below are run from the **repo root** (`/nhost4`), not from `services/auth/`.

### Iterative development loop

1. **Design**: Plan the endpoint, request/response, and database changes
2. **OpenAPI**: Define the API spec in `docs/openapi.yaml`
3. **SQL**: Add required database queries to `go/sql/query.sql`
4. **Generate**: `go generate ./services/auth/...`
5. **Implement**: Write controller and workflow code
6. **Format**: `golines -w --base-formatter=gofumpt services/auth`
7. **Lint**: `golangci-lint run ./services/auth/...`
8. **Test**: `go test -v ./services/auth/...`

Repeat steps 5-8 as needed.

### Quick reference commands

```bash
# Format code
golines -w --base-formatter=gofumpt services/auth

# Lint (no --fix in CI, so catch issues early)
golangci-lint run ./services/auth/...

# Run unit tests
go test -v ./services/auth/...

# Run a specific test
go test -v -run TestYourEndpoint ./services/auth/go/controller/...

# Lint OpenAPI spec
vacuum lint -dqb -n info \
  --ignore-file services/auth/vacuum-ignore.yaml \
  --ruleset services/auth/vacuum.yaml \
  services/auth/docs/openapi.yaml

# Regenerate code after OpenAPI/SQL/interface changes
go generate ./services/auth/...
golines -w --base-formatter=gofumpt services/auth
```

### Pre-push (full CI-equivalent check)

Before pushing, run the full nix check which also runs vulnerability scanning, verifies generated code is up to date, and runs e2e tests:

```bash
cd services/auth
make check
```

This runs (in order): vacuum lint, golines format check, go generate + sha1sum verification, govulncheck, golangci-lint, unit tests (richgo), and e2e tests (bun).

### Dev environment (for e2e tests)

```bash
cd services/auth
make dev-env-up        # Start postgres, graphql, mailhog, memcached + auth docker image
make dev-env-up-short  # Start dependencies only (no auth service)
make dev-env-down      # Stop and remove volumes
```

## Linter Configuration

The linter config lives at the repo root: `.golangci.yaml` (version 2 format).

Key settings:
- **Default**: all linters enabled, with specific disables
- **funlen**: 65 lines max (relaxed for test files)
- **Formatters**: gofmt, gofumpt, goimports
- **Generated code**: excluded from linting (`generated: lax`)
- **ireturn**: relaxed for test files and `schema.resolvers.go`

## E2E / Integration Tests (TypeScript)

- **Runtime**: Always use **bun**, never npm/npx/node. The project uses Bun as its JavaScript runtime and test runner.
- **Test location**: `test/routes/` (organized by feature area, e.g. `test/routes/oauth2/`)
- **Framework**: `bun:test` (imports: `describe`, `it`, `expect`, `beforeAll`)
- **SDK**: Use `@nhost/nhost-js` (from `../../packages/nhost-js/`, already installed) for API calls instead of raw `fetch` wherever possible
- **Running tests**: `bun test --env-file .env.example` from `services/auth/`, or `bun test --env-file .env.example test/routes/oauth2/your-test.test.ts` for a specific file

## Additional Notes

When implementing new features:
1. Review existing similar implementations for business logic patterns
2. Identify required database operations and add appropriate queries
3. Follow established validation patterns in workflows
4. Ensure error codes match existing API conventions
5. Test authentication flows thoroughly
6. Verify response formats match API specifications
