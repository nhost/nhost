# nhost mcp

A Model Context Protocol (MCP) server implementation for interacting with Nhost Cloud projects and services.

## Overview

MCP-Nhost is designed to provide a unified interface for managing Nhost projects through the Model Context Protocol. It enables seamless interaction with Nhost Cloud services, offering a robust set of tools for project management and configuration.

## Available Tools

The following tools are currently exposed through the MCP interface:

1. **cloud-get-graphql-schema**
   - Provides the GraphQL schema for the Nhost Cloud platform
   - Gives access to queries and mutations available for cloud management

2. **cloud-graphql-query**
   - Executes GraphQL queries and mutations against the Nhost Cloud platform
   - Enables project and organization management
   - Allows querying and updating project configurations
   - Mutations require enabling them when starting the server

3. **local-get-graphql-schema**
   - Retrieves the GraphQL schema for local Nhost development projects
   - Provides access to project-specific queries and mutations
   - Helps understand available operations for local development helping generating code
   - Uses "user" role unless specified otherwise

4. **local-graphql-query**
   - Executes GraphQL queries against local Nhost development projects
   - Enables testing and development of project-specific operations
   - Supports both queries and mutations for local development
   - Uses "user" role unless specified otherwise

5. **local-config-server-get-schema**
   - Retrieves the GraphQL schema for the local config server
   - Helps understand available configuration options for local projects

6. **local-config-server-query**
   - Executes GraphQL queries against the local config server
   - Enables querying and modifying local project configuration
   - Changes require running 'nhost up' to take effect

7. **local-get-management-graphql-schema**
   - Retrieves the GraphQL management schema for local projects
   - Useful for understanding how to manage Hasura metadata, migrations, and permissions
   - Provides insight into available management operations before using the management tool

8. **local-manage-graphql**
   - Interacts with GraphQL's management endpoints for local projects
   - Manages Hasura metadata, migrations, permissions, and remote schemas
   - Creates and applies database migrations
   - Handles data and schema changes through proper migration workflows
   - Manages roles and permissions

9. **project-get-graphql-schema**
   - Retrieves the GraphQL schema for Nhost Cloud projects
   - Provides access to project-specific queries and mutations
   - Uses "user" role unless specified otherwise

10. **project-graphql-query**
    - Executes GraphQL queries against Nhost Cloud projects
    - Enables interaction with live project data
    - Supports both queries and mutations (need to be allowed)
    - Uses "user" role unless specified otherwise

11. **search**
    - Searches Nhost's official documentation
    - Provides information about Nhost features, APIs, and guides
    - Helps find relevant documentation for implementing features or solving issues
    - Returns links to detailed documentation pages

## Screenshots and Examples

You can find screenshots and examples of the current features and tools in the [screenshots](docs/mcp/screenshots.md) file.

## Installing

To install mcp-nhost, you can use the following command:

```bash
sudo curl -L https://raw.githubusercontent.com/nhost/mcp-nhost/main/get.sh | bash
```

## Configuring

After installing mcp-nhost, you will need to configure it. You can do this by running the command `mcp-nhost config` in your terminal. See [CONFIG.md](docs/mcp/CONFIG.md) for more details.

## Configuring clients

#### Cursor

1. Go to "Cursor Settings"
2. Click on "MCP"
3. Click on "+ Add new global MCP server"
4. Add the following object inside `"mcpServers"`:

```json
    "mcp-nhost": {
      "command": "/usr/local/bin/mcp-nhost",
      "args": [
        "start",
      ],
    }
```

## CLI Usage

For help on how to use the CLI, you can run:

```bash
mcp-nhost --help
```

Or check [USAGE.md](docs/mcp/USAGE.md) for more details.

## Troubleshooting

If you run into issues using the MCP server you can try running the tools yourself. For example:

```
# cloud-get-graphql-schema
echo  '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"cloud-get-graphql-schema","arguments":{}},"id":1}' | mcp-nhost start

# cloud-graphql-query
echo  '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"cloud-graphql-query","arguments":{"query":"{ apps { id subdomain name } }"}},"id":1}' | mcp-nhost start

# local-get-graphql-schema
echo  '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"local-get-graphql-schema","arguments":{"role":"user"}},"id":1}' | mcp-nhost start

# local-graphql-query
echo  '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"local-graphql-query","arguments":{"query":"{ users { id } }", "role":"admin"}},"id":1}' | mcp-nhost start

# local-config-server-get-schema
echo  '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"local-config-server-get-schema","arguments":{}},"id":1}' | mcp-nhost start

# local-config-server-query
echo  '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"local-config-server-query","arguments":{"query":"{ config(appID: \"00000000-0000-0000-0000-000000000000\", resolve: true) { postgres { version } } }"}},"id":1}' | mcp-nhost start

# local-get-management-graphql-schema
echo  '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"local-get-management-graphql-schema","arguments":{}},"id":1}' | mcp-nhost start

# local-manage-graphql
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"local-manage-graphql","arguments":{"body":"{\"type\":\"export_metadata\",\"args\":{}}","endpoint":"https://local.hasura.local.nhost.run/v1/metadata"}},"id":1}' | mcp-nhost start

# project-get-graphql-schema - set projectSubdomain to your own project
echo  '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"project-get-graphql-schema","arguments":{"projectSubdomain":"replaceMe", "role": "user"}},"id":1}' | mcp-nhost start

# project-graphql-query - set projectSubdomain to your own project
echo  '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"project-graphql-query","arguments":{"projectSubdomain":"replaceMe","query":"{ users { id } }", "role":"admin"}},"id":1}' | mcp-nhost start

# search
echo  '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"search","arguments":{"query":"how to enable magic links"}},"id":1}' | mcp-nhost start
```

## Roadmap

- ✅ Cloud platform: Basic project and organization management
- ✅ Cloud projects: Configuration management
- ✅ Local projects: Configuration management
- ✅ Local projects: Graphql Schema awareness and query execution
- ✅ Cloud projects: Schema awareness and query execution
- ✅ Local projects: Create migrations
- ✅ Local projects: Manage permissions and relationships
- ✅ Documentation: integrate or document use of mintlify's mcp server
- ✅ Local projects: Auth and Storage schema awareness (maybe via mintlify?)
- ✅ Cloud projects: Auth and Storage schema awareness (maybe via mintlify?)
- 🔄 Local projects: Manage more metadata

If you have any suggestions or feature requests, please feel free to open an issue for discussion.

## Security and Privacy

### Enhanced Protection Layer

The MCP server is designed with security at its core, providing an additional protection layer beyond your existing GraphQL permissions. Key security features include:

- **Authentication enforcement** for all requests
- **Permission and role respect** based on your existing authorization system and the credentials provided
- **Query/mutation filtering** to further restrict allowed operations

### Granular Access Control

One of the MCP server's key security advantages is the ability to specify exactly which operations can pass through, even for authenticated users:

```toml
[[projects]]
subdomain = "my-blog"
region = "eu-central-1"
pat = "nhp_project_specific_pat"
allow_queries = ["getBlogs", "getCommends"]
allow_mutations = ["insertBlog", "insertComment"]
```

With the configuration above, an LLM will be able to only execute the queries and mutations above on behalf of a user even if the user has broader permissions in the Nhost project.

## Contributing

We welcome contributions to mcp-nhost! If you have suggestions, bug reports, or feature requests, please open an issue or submit a pull request.
