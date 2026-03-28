## [storage@0.12.1] - 2026-03-18

### 🐛 Bug Fixes

- *(storage)* Do not set CDN-Cache-Control header on public files (#4022)

## [storage@0.12.0] - 2026-03-18

### 🚀 Features

- *(storage)* Allow configuring image processing workers defaulting to 2 * GOMAXPROCS (#4015)
- *(storage)* Added cdn-cache-control middleware (#4003)


### 🐛 Bug Fixes

- *(internal/lib)* Abstract metadata management and allow for fixes/merges (#3953)
- *(storage)* Cleanup multipart form correctly when replacing files (#4002)
- *(storage)* Always detect mimetype when uploading files (#4018)


### ⚙️ Miscellaneous Tasks

- *(storage)* Reflect supported formats for quality option correctly (#4014)

## [storage@0.11.1] - 2026-02-16

### 🐛 Bug Fixes

- *(nixops)* Bump go to 1.26.0 (#3907)
- *(storage)* Memory improvements (#3912)

## [storage@0.11.0] - 2026-02-02

### 🚀 Features

- *(nixops)* Update nixpkgs (#3808)


### 🐛 Bug Fixes

- *(cli)* Bump schema (#3763)
- *(internal/lib)* Avoid reading multipart-form body (#3861)
- *(storage)* Improve image processing and resource management (#3835)

## [storage@0.10.0] - 2025-11-27

### 🚀 Features

- *(storage)* Added support for images/heic (#3694)

## [storage@0.9.1] - 2025-11-06

### 🐛 Bug Fixes

- *(storage)* Format date-time headers with RFC2822 (#3672)

## [storage@0.9.0] - 2025-11-04

### 🚀 Features

- *(internal/lib)* Common oapi middleware for go services (#3663)


### ⚙️ Miscellaneous Tasks

- *(nixops)* Bump go to 1.25.3 and nixpkgs due to CVEs (#3652)

# Changelog

All notable changes to this project will be documented in this file.

## [storage@0.8.2] - 2025-10-14

### ⚙️ Miscellaneous Tasks

- *(auth)* Change some references to deprecated hasura-auth (#3584)
- *(docs)* Udpated README.md and CONTRIBUTING.md (#3587)
- *(storage)* Migrate to urfave and slog libraries (#3606)

## [storage@0.8.1] - 2025-09-30

### 🐛 Bug Fixes

- *(storage)* Pass buildVersion correctly (#3542)

## [storage@0.8.0] - 2025-09-30

## Changes

* feat: generate server boilerplate from openapi schema @dbarrosop (https://github.com/nhost/hasura-storage/pull/245)

## 🧰 Maintenance

* chore: bump nixbuild/nix-quick-install-action from 31 to 32 @[dependabot[bot]](https://github.com/apps/dependabot) (https://github.com/nhost/hasura-storage/pull/244)
* chore: bump nixbuild/nix-quick-install-action from 30 to 31 @[dependabot[bot]](https://github.com/apps/dependabot) (https://github.com/nhost/hasura-storage/pull/242)
* chore: bump Codium-ai/pr-agent from 0.29 to 0.30 @[dependabot[bot]](https://github.com/apps/dependabot) (https://github.com/nhost/hasura-storage/pull/243)

---

For previous versions, please see the [old releases page](https://github.com/nhost/hasura-storage/releases).
