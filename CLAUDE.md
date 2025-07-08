# Nhost Hasura Auth - Go Migration Guide

We are migrating from Node.js to Go. This document contains patterns, conventions, and workflows for implementing new endpoints and features.

## Core Principles

- **Always write tests** for endpoints and new use cases in existing endpoints
- **Follow existing patterns** - use other implementations as examples
- **Security first** - never expose secrets, always validate inputs, follow auth patterns
- **Database safety** - use transactions where appropriate, handle errors gracefully

## Directory Structure

```
go/
├── api/                    # OpenAPI specs and generated types
│   ├── openapi.yaml       # API specification
│   ├── server.gen.go      # Generated server code
│   └── types.gen.go       # Generated types
├── controller/            # HTTP handlers and business logic
│   ├── post_*.go         # Endpoint handlers
│   ├── *_test.go         # Tests
│   ├── workflows.go      # Business logic workflows
│   ├── errors.go         # Error definitions and handling
│   └── mock/             # Generated mocks
├── sql/                  # Database layer
│   ├── query.sql         # SQL queries
│   ├── query.sql.go      # Generated Go code
│   └── models.go         # Database models
└── middleware/           # HTTP middleware
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
        - your-tag
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

Create `go/controller/post_your_endpoint.go`:

```go
package controller

import (
    "context"
    
    "github.com/nhost/hasura-auth/go/api"
    "github.com/nhost/hasura-auth/go/middleware"
)

func (ctrl *Controller) PostYourEndpoint( //nolint:ireturn
    ctx context.Context, request api.PostYourEndpointRequestObject,
) (api.PostYourEndpointResponseObject, error) {
    logger := middleware.LoggerFromContext(ctx)
    
    // Validate inputs
    if apiErr := ctrl.wf.ValidateInput(request.Body.Field, logger); apiErr != nil {
        return api.PostYourEndpoint401JSONResponse(ctrl.respondWithError(apiErr)), nil
    }
    
    // Get authenticated user if needed
    user, apiErr := ctrl.wf.GetUserFromJWTInContext(ctx, logger)
    if apiErr != nil {
        return api.PostYourEndpoint401JSONResponse(ctrl.sendError(ErrUnauthenticatedUser)), nil
    }
    
    // Business logic
    result, apiErr := ctrl.wf.DoSomething(ctx, user.ID, request.Body.Field, logger)
    if apiErr != nil {
        return api.PostYourEndpoint401JSONResponse(ctrl.respondWithError(apiErr)), nil
    }
    
    return api.PostYourEndpoint200JSONResponse(*result), nil
}
```

**Controller patterns**:
- Always get logger from context: `middleware.LoggerFromContext(ctx)`
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
        logger.Warn("business rule validation failed")
        return nil, ErrInvalidRequest
    }
    
    // Database operations
    result, err := wf.db.YourQuery(ctx, sql.YourQueryParams{
        UserID: userID,
        Input:  pgtype.Text{String: input, Valid: true},
    })
    if errors.Is(err, pgx.ErrNoRows) {
        logger.Warn("resource not found")
        return nil, ErrNotFound
    }
    if err != nil {
        logger.Error("database error", logError(err))
        return nil, ErrInternalServerError
    }
    
    return &result, nil
}
```

**Workflow patterns**:
- Take context, relevant IDs, inputs, and logger as parameters
- Return result and `*APIError` (not Go error)
- Log warnings for user errors, errors for system errors
- Use `pgtype.Text{String: value, Valid: true}` for nullable text fields
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
    // ... existing methods
    YourNewMethod(ctx context.Context, params YourParams) (YourResult, error)
}
```

### 7. Testing

Create `go/controller/post_your_endpoint_test.go`:

```go
package controller_test

import (
    "context"
    "testing"
    
    "github.com/google/go-cmp/cmp"
    "github.com/google/uuid"
    "github.com/nhost/hasura-auth/go/api"
    "github.com/nhost/hasura-auth/go/controller"
    "github.com/nhost/hasura-auth/go/controller/mock"
    "go.uber.org/mock/gomock"
)

func TestPostYourEndpoint(t *testing.T) {
    t.Parallel()
    
    userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")
    
    cases := []testRequest[api.PostYourEndpointRequestObject, api.PostYourEndpointResponseObject]{
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
            request: api.PostYourEndpointRequestObject{
                Body: &api.YourRequest{
                    Field: "test-value",
                },
            },
            expectedResponse: api.PostYourEndpoint200JSONResponse(expectedResponse),
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
            
            resp, err := c.PostYourEndpoint(context.Background(), tc.request)
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

After making changes, always run:

```bash
go generate ./...
```

This generates:
- API server code from OpenAPI spec (`api/server.gen.go`, `api/types.gen.go`)
- SQL client code from queries (`sql/query.sql.go`)
- Mocks from interfaces (`controller/mock/`)

## Authentication Patterns

### JWT Authentication

```go
// Get authenticated user
user, apiErr := ctrl.wf.GetUserFromJWTInContext(ctx, logger)
if apiErr != nil {
    return api.PostEndpoint401JSONResponse(ctrl.sendError(ErrUnauthenticatedUser)), nil
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
```

## Security Best Practices

1. **Input Validation**: Always validate inputs at the workflow level
2. **Authorization**: Check user permissions before operations
3. **Token Handling**: Always hash tokens before storage/comparison
4. **Error Messages**: Don't expose sensitive information in errors
5. **Logging**: Log security events appropriately (warn for user errors, error for system issues)

## Database Best Practices

1. **Use Transactions**: For multi-step operations
2. **Handle NULL**: Use `pgtype.Text` for nullable fields
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
return api.PostEndpoint401JSONResponse(ctrl.sendError(ErrInvalidRequest)), nil

// For server errors (500-level)  
return api.PostEndpoint401JSONResponse(ctrl.respondWithError(apiErr)), nil
```

## Development Workflow

1. **Design**: Plan the endpoint, request/response, and database changes
2. **OpenAPI**: Define the API specification
3. **SQL**: Add required database queries
4. **Generate**: Run `go generate ./...`
5. **Implement**: Write controller and workflow code
6. **Test**: Write comprehensive tests
7. **Format**: Run `golines -w --base-formatter=gofumpt .`
8. **Lint**: Run `golangci-lint run --fix`
9. **Test**: Run `go test -v ./...`

## Lint and Tests

- **Formatter**: `golines -w --base-formatter=gofumpt .`
- **Linter**: `golangci-lint run --fix`
- **Tests**: `go test -v ./...`
- **Coverage**: `go test -v -cover ./...`

## Migration Notes

When migrating from Node.js:
1. Check existing Node.js implementation for business logic
2. Identify database operations needed
3. Map validation rules to Go workflows
4. Ensure error codes match existing API
5. Test authentication flows carefully
6. Verify response formats match exactly
