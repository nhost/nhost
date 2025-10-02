# Configuration

This document describes all available configuration options for the Nhost MCP tool. The configuration file uses TOML format.

## TOML

```toml
# Cloud configuration for managing Nhost Cloud projects and organizations
# Remove section to disable this access
[cloud]
# Personal Access Token (PAT) for Nhost Cloud API authentication
# Get one at: https://app.nhost.io/account
pat = "your-pat-here"

# Enable mutations on Nhost Cloud configurations
# When false, only queries are allowed
enable_mutations = true

# Local configuration for interacting with Nhost CLI projects
# Remove section to disable access
[local]
# Admin secret for local project authentication
admin_secret = "your-admin-secret"

# Optional: Custom config server URL
# Default: https://local.dashboard.local.nhost.run/v1/configserver/graphql
config_server_url = "your-custom-url"

# Optional: Custom GraphQL URL
# Default: https://local.graphql.local.nhost.run/v1
graphql_url = "your-custom-url"

# Project-specific configurations
[[projects]]
# Project subdomain (required)
subdomain = "your-project-subdomain"

# Project region (required)
region = "your-project-region"

# Authentication: Use either admin_secret or pat
# Admin secret for project access
admin_secret = "your-project-admin-secret"
# OR
# Project-specific PAT
pat = "your-project-pat"

# List of allowed GraphQL queries
# Use ["*"] to allow all queries, [] to disable all
allow_queries = ["*"]

# List of allowed GraphQL mutations
# Use ["*"] to allow all mutations, [] to disable all
# Only effective if mutations are enabled for the project
allow_mutations = ["*"]
```
## Example Configuration

```toml
[cloud]
pat = "1234567890abcdef"
enable_mutations = true

[local]
admin_secret = "nhost-admin-secret"

[[projects]]
subdomain = "my-app"
region = "eu-central-1"
admin_secret = "project-admin-secret"
allow_queries = ["*"]
allow_mutations = ["createUser", "updateUser"]

[[projects]]
subdomain = "another-app"
region = "us-east-1"
pat = "nhp_project_specific_pat"
allow_queries = ["getUsers", "getPosts"]
allow_mutations = []
```