# `@nhost/sync-versions`

Synchronise versions of Nhost services from `nhost-cloud.yaml` to every Nhost project in the pnpm workspace.

## How it works

1. Update the versions in the `nhost-cloud.yaml` file
2. Commit the file

Husky and lint-staged will detect the change, and update any `nhost/config.yaml` found in the repository.

_Note:_ any change in a `nhost/config.yaml` file will also trigger the script and override the file with the versions given in `nhost-cloud.yaml`
