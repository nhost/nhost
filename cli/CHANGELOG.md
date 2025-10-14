# Changelog

All notable changes to this project will be documented in this file.

## [cli@1.34.2] - 2025-10-14

### ⚙️ Miscellaneous Tasks

- *(cli)* Minor fix to download script when specifying version (#3602)

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

