# Nhost MCP Service

The Nhost MCP service adds an agentic interface to any Nhost project. It exposes your project's GraphQL API as an [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server, allowing AI assistants like Claude, Cursor, or any MCP-compatible client to query and mutate your data.

If you're building on Nhost, this service lets your users interact with their project data through AI assistants — no custom integration code required. Deploy it alongside your project and any MCP-compatible client can connect, authenticate on behalf of your users via your existing Nhost Auth setup, and work with your data within the permissions defined.

## How It Works

The MCP server sits between your AI assistant and your Nhost project's GraphQL API. It provides three tools that the assistant can call:

- **`get-schema`** - Introspects the GraphQL schema so the assistant understands your data model. Returns either a summary of available operations or the full SDL for specific queries/mutations.
- **`graphql-query`** - Executes read-only GraphQL queries against your project.
- **`graphql-mutation`** - Executes GraphQL mutations to create, update, or delete data.

On startup, the server fetches a schema summary from your GraphQL endpoint and includes it in the MCP instructions, giving the AI assistant immediate context about your data model without any additional configuration.

## Authentication with OAuth2

The MCP service integrates with Nhost Auth as an [OAuth2 authorization server](https://docs.nhost.io/products/auth/oauth2-provider/), following the [MCP Authorization specification](https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization). This means any MCP client that supports OAuth2 can authenticate with your Nhost project automatically.

The flow works as follows:

1. The MCP client discovers authentication requirements by fetching `/.well-known/oauth-protected-resource` from the MCP server.
2. The client redirects the user to the Nhost Auth authorization endpoint for login (authorization code flow with PKCE).
3. After authentication, the client exchanges the authorization code for a JWT access token.
4. All subsequent MCP requests include the JWT as a Bearer token.
5. The MCP server validates the JWT signature via JWKS, checks the issuer and expiration, then forwards the token on every GraphQL request.
6. The GraphQL service enforces row-level and column-level permissions based on the JWT's claims, so the AI assistant can only access data the authenticated user is allowed to see.

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
| `--graphql-endpoint` | `MCP_GRAPHQL_ENDPOINT` | GraphQL endpoint URL (**required**) |
| `--mcp-instructions` | `MCP_INSTRUCTIONS` | Server-level MCP instructions |
| `--query-instructions` | `MCP_QUERY_INSTRUCTIONS` | Instructions for the graphql-query tool |
| `--mutation-instructions` | `MCP_MUTATION_INSTRUCTIONS` | Instructions for the graphql-mutation tool |
| `--schema-instructions` | `MCP_SCHEMA_INSTRUCTIONS` | Instructions for the get-schema tool |
| `--auth-url` | `MCP_AUTH_URL` | OAuth2 authorization server URL (enables auth) |
| `--realm` | `MCP_REALM` | Realm for WWW-Authenticate header |
| `--enforce-role` | `MCP_ENFORCE_ROLE` | Enforce that the JWT's default Hasura role matches this value |

## Deploying to Nhost

To deploy to Nhost Run you can use the one-click install link below:

https://app.nhost.io/run-one-click-install?config=eyJuYW1lIjoibWNwIiwiaW1hZ2UiOnsiaW1hZ2UiOiJuaG9zdC9tY3A6MC4wLjgiLCJwdWxsQ3JlZGVudGlhbHMiOm51bGx9LCJjb21tYW5kIjpbIm1jcCJdLCJyZXNvdXJjZXMiOnsiY29tcHV0ZSI6eyJjcHUiOjEyNSwibWVtb3J5IjoyNTZ9LCJzdG9yYWdlIjpbXSwicmVwbGljYXMiOjEsImF1dG9zY2FsZXIiOm51bGx9LCJlbnZpcm9ubWVudCI6W3sibmFtZSI6Ik1DUF9BVVRIX1VSTCIsInZhbHVlIjoiaHR0cHM6Ly9TVUJET01BSU4uYXV0aC5SRUdJT04ubmhvc3QucnVuL3YxIn0seyJuYW1lIjoiTUNQX1JFQUxNIiwidmFsdWUiOiJodHRwczovL21jcC5hY21lLmNvbSJ9LHsibmFtZSI6Ik1DUF9HUkFQSFFMX0VORFBPSU5UIiwidmFsdWUiOiJodHRwOi8vaGFzdXJhLXNlcnZpY2U6ODA4MC92MS9ncmFwaHFsIn0seyJuYW1lIjoiTUNQX0lOU1RSVUNUSU9OUyIsInZhbHVlIjoiVGhlc2UgYXJlIHNvbWUgaW5zdHJ1Y3Rpb25zIGZvciB5b3VyIE1DUCBzZXJ2ZXIuIn0seyJuYW1lIjoiTUNQX0VORk9SQ0VfUk9MRSIsInZhbHVlIjoidXNlcl9tY3AifV0sInBvcnRzIjpbeyJwb3J0IjozMDAwLCJ0eXBlIjoiaHR0cCIsInB1Ymxpc2giOnRydWUsImluZ3Jlc3NlcyI6W3siZnFkbiI6WyJtY3Auc3RhZ2luZy5uaG9zdC5pbyJdfV0sInJhdGVMaW1pdCI6bnVsbH1dLCJoZWFsdGhDaGVjayI6bnVsbH0=

And edit as needed. Make sure to set the correct subdomain and region in the `MCP_AUTH_URL` (or your custom domain if you using one), set the `MCP_REALM` to the URL you will use for your MCP service, change the `MCP_INSTRUCTIONS` as needed and change or remove `MCP_ENFORCE_ROLE`

Alternatively, add a `run-mcp.toml` to your project directory:

```toml
name = 'mcp'
command = ['mcp']

[image]
image = 'nhost/mcp:0.0.8'

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

## Connecting an MCP Client

Point your MCP client to the server URL. For example, in Claude Desktop's configuration:

1. Go to customize -> Connectors
2. Click on `+` and enter any name you want and the url where your MCP server resides, for instance https://mcp.acme.com
3. Click "Add"
4. Once connected you will be redirected to your [Oauth2's consent page](https://docs.nhost.io/products/auth/oauth2-provider/authorization-flow#what-you-build-the-consent-page) to authorize the Oauth2 client.
