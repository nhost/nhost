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

Do not declare the directive yourself in the permission SDL. Constellation adds an internal helper scalar while parsing the SDL so `@preset(value: ...)` can accept normal GraphQL input literals, then removes the helper directive and hidden arguments from the schema exposed to clients.

**How preset values are resolved:**
- A quoted string or block string whose value starts with `x-hasura-` is treated as a session-variable name, looked up from the request session, and coerced to the hidden argument's GraphQL type before forwarding.
- Other values are treated as literal GraphQL input values. Use the syntax that matches the hidden argument type: quoted strings for `String`/`ID`, numbers for `Int`/`Float`, `true`/`false` for `Boolean`, unquoted enum values for enums, lists for list arguments, and input-object literals for input objects.

**Preset from session variable:**
```yaml
schema: |
  type Query {
    myTeam(teamId: ID! @preset(value: "x-hasura-team-id")): Team
  }
```

The `teamId` argument is hidden from the client schema. When a user queries `myTeam`, the value is automatically taken from their `x-hasura-team-id` session variable and coerced as an `ID`.

**Preset with typed literal values:**
```yaml
schema: |
  enum Source {
    OFFICIAL
    USER_REPORTED
  }

  input GameFilter {
    active: Boolean
    tags: [String!]
  }

  type Game {
    id: ID!
  }

  type Query {
    topGames(
      limit: Int! @preset(value: 10)
      includeStats: Boolean! @preset(value: true)
      source: Source! @preset(value: OFFICIAL)
      filter: GameFilter @preset(value: {active: true, tags: ["ranked"]})
    ): [Game!]!
  }
```

The hidden arguments are forwarded as typed GraphQL values (`10`, `true`, `OFFICIAL`, and the input object), not as strings.

**Preset with a literal string value:**
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

**Session-variable coercion example:**
```yaml
schema: |
  type Game {
    id: ID!
  }

  type Query {
    topGames(limit: Int! @preset(value: "x-hasura-page-limit")): [Game!]!
  }
```

If the request session contains `x-hasura-page-limit: 25`, Constellation forwards `limit: 25` to the remote schema. Preset coercion is best-effort: Constellation does not raise a local validation error when a session variable is missing, empty, or cannot be parsed as the hidden argument type. A missing or empty session variable is injected as an empty string; this is forwarded as `""` for `String`/`ID` arguments, and for non-string targets it is forwarded as an empty-string literal when it cannot be parsed as the target type, so the remote GraphQL server may reject the forwarded operation during validation. Ensure any session variables used by presets are present and non-empty, especially for non-null or security-sensitive arguments.

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

          # This query has no presets - user provides arguments
          team(id: ID!): Team

          # limit is a typed literal preset
          leaderboard(limit: Int! @preset(value: 10)): [Team!]!
        }
        type Mutation {
          # teamId comes from session; source and isHome are hardcoded
          reportGame(
            homeTeamId: ID! @preset(value: "x-hasura-team-id")
            awayTeamId: ID!
            homeScore: Int!
            awayScore: Int!
            isHome: Boolean! @preset(value: true)
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
- `leaderboard` query: client calls `{ leaderboard { name } }`, `limit` is injected as the integer literal `10`
- `reportGame` mutation: client provides `awayTeamId`, `homeScore`, `awayScore`; `homeTeamId` comes from session, `isHome` is always `true`, and `source` is always `"user-reported"`

## Admin Role

The `admin` role always has unrestricted access to the full remote schema obtained via introspection. You cannot define permissions for the admin role - any admin permissions in metadata are ignored.

Admin users can:
- Access all types and fields
- Use all arguments (no presets are applied)
- See the complete schema via introspection
