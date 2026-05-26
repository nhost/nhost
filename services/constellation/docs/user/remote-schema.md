# Remote Schemas

Remote schemas allow you to integrate external GraphQL APIs into your Constellation GraphQL schema. Queries are forwarded to the remote endpoint and the results are merged into a unified GraphQL API.

## Configuration

Remote schemas are configured in `metadata/remote_schemas.yaml`:

```yaml
- name: my-remote-schema
  definition:
    url: "https://api.example.com/graphql"
    timeout_seconds: 60
    headers:
      - name: x-api-key
        value_from_env: API_KEY
    forward_client_headers: true
  permissions:
    - role: user
      definition:
        schema: |
          schema {
            query: Query
          }
          type Query {
            getUser(id: ID!): User
          }
          type User {
            id: ID!
            name: String!
          }
```

### Definition Options

| Field | Type | Description |
|-------|------|-------------|
| `url` | string | The URL of the remote GraphQL endpoint. Supports `{{ENV_VAR}}` interpolation. |
| `url_from_env` | string | Environment variable containing the URL (alternative to `url`). |
| `timeout_seconds` | int | Request timeout in seconds (default: 60). |
| `headers` | array | Static headers to send with every request. |
| `forward_client_headers` | bool | Whether to forward client headers to the remote endpoint. |

### Headers

You can configure static headers to be sent with every request to the remote schema:

```yaml
headers:
  # Literal value
  - name: x-custom-header
    value: "my-value"

  # Value from environment variable
  - name: x-api-key
    value_from_env: API_KEY
```

### Forward Client Headers

When `forward_client_headers: true`, client headers from the original request are forwarded to the remote schema with the following behavior:

**Headers that are NOT forwarded:**
- `Content-Length`, `Content-MD5`, `Content-Type`
- `Host`, `Origin`, `Referer`
- `User-Agent`, `Accept`, `Accept-Encoding`, `Accept-Language`, `Accept-Datetime`
- `Cache-Control`, `Connection`, `DNT`, `Transfer-Encoding`
- All `x-hasura-*` headers (these are sent separately as session variables)

**X-Forwarded headers created:**
- `Host` → `X-Forwarded-Host`
- `User-Agent` → `X-Forwarded-User-Agent`
- `Origin` → `X-Forwarded-Origin`

**Header priority (highest to lowest):**
1. Configured headers (from `headers` field)
2. Session variables (`x-hasura-*` headers)
3. Forwarded client headers

## Session Variables

Session variables (e.g., `x-hasura-user-id`, `x-hasura-role`) are automatically sent as HTTP headers to the remote schema. This allows the remote endpoint to identify the user making the request.

For example, if a request has these session variables:
- `x-hasura-user-id: user-123`
- `x-hasura-role: user`
- `x-hasura-team-id: team-456`

These are sent as headers to the remote schema endpoint.

## Permissions

Permissions define what parts of the remote schema each role can access. The `admin` role always has full access to the remote schema (obtained via introspection).

For other roles, you must define a GraphQL SDL schema that specifies the allowed types and fields:

```yaml
permissions:
  - role: user
    definition:
      schema: |
        schema {
          query: Query
          mutation: Mutation
        }
        type Query {
          myProfile: User
          publicData: [Item!]!
        }
        type Mutation {
          updateProfile(name: String!): User
        }
        type User {
          id: ID!
          name: String!
        }
        type Item {
          id: ID!
          title: String!
        }
```

### Argument Presets with @preset

The `@preset` directive allows you to inject values into arguments automatically, hiding them from the client. This is useful for:
- Enforcing row-level security by injecting user/tenant IDs
- Setting default values that clients cannot override

**How preset values are resolved:**
- If the value starts with `x-hasura-`, it is interpolated from the corresponding session variable
- Otherwise, the value is treated as a literal string

**Preset from session variable:**
```yaml
schema: |
  type Query {
    myTeam(teamId: ID! @preset(value: "x-hasura-team-id")): Team
  }
```

The `teamId` argument is hidden from the client schema. When a user queries `myTeam`, the value is automatically taken from their `x-hasura-team-id` session variable.

**Preset with literal value:**
```yaml
schema: |
  type Mutation {
    createPost(
      title: String!
      source: String! @preset(value: "web-app")
    ): Post
  }
```

The `source` argument is hidden from the client and always set to `"web-app"`.

**Complete example with multiple presets:**
```yaml
permissions:
  - role: user
    definition:
      schema: |
        schema {
          query: Query
          mutation: Mutation
        }
        type Query {
          # User can only query their own team's data
          myTeam(teamId: ID! @preset(value: "x-hasura-team-id")): Team
          teamGames(teamId: ID! @preset(value: "x-hasura-team-id")): [Game!]!

          # These queries have no presets - user provides arguments
          team(id: ID!): Team
          leaderboard: [Team!]!
        }
        type Mutation {
          # teamId comes from session, source is hardcoded
          reportGame(
            homeTeamId: ID! @preset(value: "x-hasura-team-id")
            awayTeamId: ID!
            homeScore: Int!
            awayScore: Int!
            source: String! @preset(value: "user-reported")
          ): Game
        }
        type Team {
          id: ID!
          name: String!
        }
        type Game {
          id: ID!
          homeScore: Int!
          awayScore: Int!
        }
```

With this configuration:
- `myTeam` query: client calls `{ myTeam { name } }`, `teamId` is injected from session
- `reportGame` mutation: client provides `awayTeamId`, `homeScore`, `awayScore`; `homeTeamId` comes from session, `source` is always `"user-reported"`

## Admin Role

The `admin` role always has unrestricted access to the full remote schema obtained via introspection. You cannot define permissions for the admin role - any admin permissions in metadata are ignored.

Admin users can:
- Access all types and fields
- Use all arguments (no presets are applied)
- See the complete schema via introspection
