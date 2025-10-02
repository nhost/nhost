# NAME

nhost-mcp - Nhost's Model Context Protocol (MCP) server

# SYNOPSIS

nhost-mcp

```
[--help|-h]
[--version|-v]
```

**Usage**:

```
nhost-mcp [GLOBAL OPTIONS] [command [COMMAND OPTIONS]] [ARGUMENTS...]
```

# GLOBAL OPTIONS

**--help, -h**: show help

**--version, -v**: print the version


# COMMANDS

## docs

Generate markdown documentation for the CLI

**--help, -h**: show help

### help, h

Shows a list of commands or help for one command

## config

Generate and save configuration file

**--config-file**="": Configuration file path (default: /Users/dbarroso/.config/nhost/mcp-nhost.toml)

**--confirm**: Skip confirmation prompt

**--help, -h**: show help

### help, h

Shows a list of commands or help for one command

## start

Starts the MCP server

**--bind**="": Bind address in the form <host>:<port>. If omitted use stdio

**--config-file**="": Path to the config file (default: /Users/dbarroso/.config/nhost/mcp-nhost.toml)

**--help, -h**: show help

### help, h

Shows a list of commands or help for one command

## gen

Generate GraphQL schema for Nhost Cloud

**--help, -h**: show help

**--nhost-pat**="": Personal Access Token

**--with-mutations**: Include mutations in the generated schema

### help, h

Shows a list of commands or help for one command

## upgrade

Checks if there is a new version and upgrades it

**--confirm**: Confirm the upgrade without prompting

**--help, -h**: show help

### help, h

Shows a list of commands or help for one command

## help, h

Shows a list of commands or help for one command

