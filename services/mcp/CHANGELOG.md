## [mcp@0.5.0] - 2026-11-27

### 🚀 Features

- *(auth)* Type JWTs by purpose and add audience, sid and jti claims (#5240)


### 🐛 Bug Fixes

- *(auth)* Type JWTs by purpose (#5114)

## [mcp@0.4.0] - 2026-11-26

### 🚀 Features

- *(mcp)* Add read-only storage downloads (#5329)


### Chore

- *(deps)* Bump mcp-go and otel (#5449)

## [mcp@0.3.1] - 2026-11-11

### 🐛 Bug Fixes

- *(cli)* Enforce MCP allowlist on scalar root fields and fragments (#5362)

## [mcp@0.3.0] - 2026-09-18

### 🚀 Features

- *(mcp)* Add unauthenticated /healthz for probes (#4948)


### ⚙️ Miscellaneous Tasks

- *(nixops)* Bump Go to 1.27 (#4887)
- *(mcp)* Publish the MCP service to the official MCP Registry (#5039)

## [mcp@0.2.0] - 2026-06-29

### 🚀 Features

- *(mcp)* Detect browser requests and serve configurable HTML page (#4104)


### 🐛 Bug Fixes

- *(ci)* Make build and check work on NixOS (#4234)
- *(internal/lib)* Consolidate / improve middleware into shared internal/lib/oapi (#4513)


### ⚙️ Miscellaneous Tasks

- *(nixops)* Bump go due to cves (#4124)
- *(ci)* Minor changes to go linter to reduce noise (#4329)
- *(ci)* Follow-up skill improvements (#4332)
- *(nixops)* Drop nix-filter input in favor of pkgs.lib.fileset (#4377)

