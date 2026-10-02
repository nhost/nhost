# Security policy

## Reporting a vulnerability

Please don't open a public issue for security problems.

Email **security@nhost.io**. You can also report privately through GitHub: go to the [nhost/nhost Security tab](https://github.com/nhost/nhost/security) and choose **Report a vulnerability**.

This covers the plugin itself: the skills, the manifests and the MCP configuration. For the Nhost CLI, the MCP server and the Nhost platform, see the [nhost/nhost security policy](https://github.com/nhost/nhost/security/policy).

## Scope notes

- The plugin contains only instructions and configuration. It holds no secrets. The only software it starts is the Nhost CLI's MCP server, which `npx` downloads from npm.
- A skill instruction that could lead an agent to write insecure code, such as exposing an admin secret or granting overly broad permissions, is a valid security report.
