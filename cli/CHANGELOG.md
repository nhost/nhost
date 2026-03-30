## [cli@1.42.0] - 2026-03-30

### 🚀 Features

- *(cli)* Login via oauth2 (#4089)


### ⚙️ Miscellaneous Tasks

- *(cli)* Update schema and certs (#4097)
- *(cli)* Bump nhost/dashboard to 2.55.0 (#4090)

## [cli@1.41.1] - 2026-03-28

### 🐛 Bug Fixes

- *(cli)* Add aliases matching internal cloud services (#4076)


### ⚙️ Miscellaneous Tasks

- *(cli)* Bump schema (#4084)

## [cli@1.41.0] - 2026-03-26

### 🚀 Features

- *(cli)* Add run service volume overrides for local dev (#4047)
- *(stripe-graphql-js)* Update dependencies and modernize build (#3664)


### 🐛 Bug Fixes

- *(cli)* Forward stdin to Hasura CLI wrapper for interactive navigation (#4046)
- *(cli)* Require initialized project before running config pull (#4045)
- *(cli)* Remove possibility to bind mcp server to a port for security reasons (#4060)

## [cli@1.40.0] - 2026-03-25

### 🚀 Features

- *(cli)* Add default MCP config for local development (#4036)

## [cli@1.39.0] - 2026-03-20

### 🚀 Features

- *(dashboard)* Allow configuring allowedCIDRs (#4029)


### 🐛 Bug Fixes

- *(cli)* Conditionally enable storage URL based on port exposure (#4033)


### ⚙️ Miscellaneous Tasks

- *(cli)* Bump nhost/dashboard to 2.54.0 (#4031)

## [cli@1.38.4] - 2026-03-18

### ⚙️ Miscellaneous Tasks

- *(cli)* Bump schema (#4020)
- *(cli)* Bump nhost/dashboard to 2.53.0 (#4009)
- *(cli)* Bump schema (#4023)

## [cli@1.38.3] - 2026-03-13

### ⚙️ Miscellaneous Tasks

- *(cli)* Update schema (#3999)

## [cli@1.38.2] - 2026-03-11

### ⚙️ Miscellaneous Tasks

- *(cli)* Bump nhost/dashboard to 2.52.0 (#3945)

## [cli@1.38.1] - 2026-03-08

### ⚙️ Miscellaneous Tasks

- *(ci)* Added brew and nix installation methods for the cli (#3975)
- *(cli)* Fix formula name for brew (#3977)
- *(cli)* Update certs (#3979)

## [cli@1.38.0] - 2026-02-19

### 🚀 Features

- *(auth)* Added oauth2/oidc provider functionality (#3922)


### 🐛 Bug Fixes

- *(docs)* Fix CLI reference documentation (#3895)
- *(nixops)* Bump go to 1.26.0 (#3907)


### ⚙️ Miscellaneous Tasks

- *(cli)* Bump nhost/dashboard to 2.50.0 (#3919)

## [cli@1.37.0] - 2026-02-05

### 🚀 Features

- *(docs)* Release starlight (#3877)


### ⚙️ Miscellaneous Tasks

- *(cli)* Bump nhost/dashboard to 2.47.0 (#3884)

## [cli@1.36.0] - 2026-02-02

### 🚀 Features

- *(cli)* Added mcp tool to list documentation (#3863)


### 🐛 Bug Fixes

- *(cli)* Use astro docs as source (#3859)
- *(cli)* Bump schema (#3872)


### ⚙️ Miscellaneous Tasks

- *(cli)* Bump nhost/dashboard to 2.46.3 (#3800)

## [cli@1.35.0] - 2026-01-28

### 🚀 Features

- *(docs)* Document functions logging (#3793)
- *(nixops)* Update nixpkgs (#3808)
- *(cli)* Embed documentation in the binary and add subcommands and MCP tools to search/retrieve (#3836)


### ⚙️ Miscellaneous Tasks

- *(cli)* Update certs (#3791)
- *(cli)* Update dev/local certs (#3843)

## [cli@1.34.12] - 2025-12-23

### Chore

- *(deps)* Udpate nhost schema (#3779)

## [cli@1.34.11] - 2025-12-18

### 🐛 Bug Fixes

- *(cli)* Bump schema (#3763)


### ⚙️ Miscellaneous Tasks

- *(cli)* Bump nhost/dashboard to 2.44.1 (#3739)

## [cli@1.34.10] - 2025-12-16

### 🐛 Bug Fixes

- *(cli)* Cmd-shell in a single parameter (#3760)

## [cli@1.34.9] - 2025-12-01

### ⚙️ Miscellaneous Tasks

- *(cli)* Bump nhost/dashboard to 2.43.0 (#3719)
- *(cli)* Update certs (#3726)

## [cli@1.34.8] - 2025-11-19

### 🐛 Bug Fixes

- *(cli)* Update traefik (#3710)

## [cli@1.34.7] - 2025-11-13

### ⚙️ Miscellaneous Tasks

- *(cli)* Bump nhost/dashboard to 2.42.0 (#3693)

## [cli@1.34.6] - 2025-11-13

### 🐛 Bug Fixes

- *(cli)* Mcp: specify items type for arrays in tools (#3687)


### ⚙️ Miscellaneous Tasks

- *(cli)* Update bindings (#3689)

## [cli@1.34.5] - 2025-11-06

### ⚙️ Miscellaneous Tasks

- *(nixops)* Bump go to 1.25.3 and nixpkgs due to CVEs (#3652)
- *(cli)* Udpate certs and schema (#3675)
- *(cli)* Bump nhost/dashboard to 2.41.0 (#3669)

# Changelog

All notable changes to this project will be documented in this file.

## [cli@1.34.4] - 2025-10-28

### 🐛 Bug Fixes

- *(cli)* Update NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL correctly (#3643)

## [cli@1.34.3] - 2025-10-27

### ⚙️ Miscellaneous Tasks

- *(cli)* Update schema (#3622)
- *(cli)* Bump nhost/dashboard to 2.40.0 (#3629)

## [cli@1.34.2] - 2025-10-20

### ⚙️ Miscellaneous Tasks

- *(cli)* Minor fix to download script when specifying version (#3602)
- *(cli)* Update schema (#3613)

## [cli@1.34.1] - 2025-10-13

### 🐛 Bug Fixes

- *(cli)* Remove references to mcp-nhost (#3575)
- *(cli)* Workaround os.Rename issues when src and dst are on different partitions (#3599)


### ⚙️ Miscellaneous Tasks

- *(auth)* Change some references to deprecated hasura-auth (#3584)
- *(docs)* Udpated README.md and CONTRIBUTING.md (#3587)

## [cli@1.34.0] - 2025-10-09

### 🚀 Features

- *(cli)* Added mcp server functionality from mcp-nhost (#3550)
- *(cli)* Mcp: move configuration to .nhost folder and integrate cloud credentials (#3555)
- *(cli)* Mcp: added support for environment variables in the configuration (#3556)
- *(cli)* MCP refactor and documentation prior to official release (#3571)


### 🐛 Bug Fixes

- *(dashboard)* Remove NODE_ENV from restricted env vars (#3573)


### ⚙️ Miscellaneous Tasks

- *(nixops)* Update nhost-cli (#3554)
- *(cli)* Bump nhost/dashboard to 2.38.4 (#3539)

## [cli@1.33.0] - 2025-10-02

### 🚀 Features

- *(cli)* Migrate from urfave/v2 to urfave/v3 (#3545)


### 🐛 Bug Fixes

- *(cli)* Disable tls on AUTH_SERVER_URL when auth uses custom port (#3549)
- *(cli)* Fix breaking change in go-getter dependency (#3551)


### ⚙️ Miscellaneous Tasks

- *(cli)* Update certs (#3552)

## [cli@1.32.2] - 2025-10-01

### ⚙️ Miscellaneous Tasks

- *(cli)* Remove hasura- prefix from auth/storage images (#3538)

## [cli@1.32.1] - 2025-09-29

### ⚙️ Miscellaneous Tasks

- *(ci)* Minor improvements to the ci (#3527)
- *(cli)* Update schema (#3529)

