## [functions@2.2.0] - 2026-06-12

### 🚀 Features

- *(functions)* Remove nodejs 20 support and add nodejs 24 (#4266)


### 🐛 Bug Fixes

- *(ci)* Make build and check work on NixOS (#4234)
- *(deps)* Fix fast-uri advisory (GHSA-v39h-62p7-jpjc) (#4265)
- *(deps)* Update brace-expansion due to CVE (#4306)
- *(deps)* Fix ws advisory (GHSA-58qx-3vcg-4xpx) (#4307)
- *(functions)* Load bundles lazily to fix OOM on large projects (#4230)
- *(deps)* Bump up shellquote due to CVE (#4499)


### ⚙️ Miscellaneous Tasks

- *(ci)* Follow-up skill improvements (#4332)
- *(nixops)* Drop nix-filter input in favor of pkgs.lib.fileset (#4377)
- *(nixops)* Scope pinned toolchain overlays (#4506)


### Chore

- *(deps)* Update pnpm to v11 (#4275)
- *(deps)* Update various packages due to CVEs (#4328)
- *(deps)* Update vulnerable dependencies (#4338)

## [functions@2.1.0] - 2026-04-30

### 🚀 Features

- *(functions)* Reuse esbuild context to lower memory usage (#4211)

