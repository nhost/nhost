## [functions@2.2.0] - 2026-07-24

### 🚀 Features

- *(functions)* Remove nodejs 20 support and add nodejs 24 (#4266)
- *(landing)* Wire into monorepo build & deploy pipeline
- *(landing)* Merge nhost/landing into monorepo (#4688)


### 🐛 Bug Fixes

- *(ci)* Make build and check work on NixOS (#4234)
- *(deps)* Fix fast-uri advisory (GHSA-v39h-62p7-jpjc) (#4265)
- *(deps)* Update brace-expansion due to CVE (#4306)
- *(deps)* Fix ws advisory (GHSA-58qx-3vcg-4xpx) (#4307)
- *(functions)* Load bundles lazily to fix OOM on large projects (#4230)
- *(deps)* Bump up shellquote due to CVE (#4499)
- *(nhost-js)* Resolve minimatch jest coverage crash (#4626)
- *(ci)* Fix vercel build complaining about a missing functions directory and update deps for vulnerabilities (#4690)


### 💼 Other

- Merge remote-tracking branch 'origin/main' into feat/merge-landing

# Conflicts:
#	dashboard/pnpm-lock.yaml
#	docs/pnpm-lock.yaml
#	examples/demos/express/pnpm-lock.yaml
#	examples/demos/pnpm-lock.yaml
#	examples/demos/react-demo/pnpm-lock.yaml
#	examples/guides/codegen-nhost/pnpm-lock.yaml
#	examples/guides/pnpm-lock.yaml
#	examples/guides/react-apollo/pnpm-lock.yaml
#	examples/guides/react-query/pnpm-lock.yaml
#	examples/guides/react-urql/pnpm-lock.yaml
#	examples/quickstarts/nextjs/pnpm-lock.yaml
#	examples/quickstarts/react/pnpm-lock.yaml
#	examples/quickstarts/reactnative/pnpm-lock.yaml
#	examples/quickstarts/svelte/pnpm-lock.yaml
#	examples/quickstarts/vue/pnpm-lock.yaml
#	examples/tutorials/nhost-nextjs-tutorial/pnpm-lock.yaml
#	examples/tutorials/nhost-react-tutorial/pnpm-lock.yaml
#	examples/tutorials/nhost-reactnative-tutorial/pnpm-lock.yaml
#	examples/tutorials/nhost-svelte-tutorial/pnpm-lock.yaml
#	examples/tutorials/nhost-vue-tutorial/pnpm-lock.yaml
#	examples/tutorials/pnpm-lock.yaml
#	packages/nhost-js/pnpm-lock.yaml
#	packages/stripe-graphql-js/pnpm-lock.yaml
#	pnpm-lock.yaml
#	pnpm-workspace.yaml
#	services/functions/pnpm-lock.yaml


### ⚙️ Miscellaneous Tasks

- *(ci)* Follow-up skill improvements (#4332)
- *(nixops)* Drop nix-filter input in favor of pkgs.lib.fileset (#4377)
- *(nixops)* Scope pinned toolchain overlays (#4506)


### Chore

- *(deps)* Update pnpm to v11 (#4275)
- *(deps)* Update various packages due to CVEs (#4328)
- *(deps)* Update vulnerable dependencies (#4338)
- *(deps)* Update vulnerable dependencies (#4530)
- *(deps)* Update vulnerable dependencies (#4541)
- *(deps)* Update vulnerable dependencies (#4610)

## [functions@2.1.0] - 2026-04-30

### 🚀 Features

- *(functions)* Reuse esbuild context to lower memory usage (#4211)

