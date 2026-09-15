# betterleaks - Secret-Scanning Configuration Guide

**Important**: Always load the root `CLAUDE.md` at the repository root for general monorepo conventions before working on this project.

This project has no Go or TypeScript of its own. It owns the `betterleaks` configuration the monorepo is scanned with, a thin Nix wrapper that bakes that configuration into the pinned upstream binary, and a fixture-based test suite for the configuration. The upstream build itself is pinned in `nixops/overlays/go.nix`.

## Core Principles

- **CI runs the base revision's config and toolchain.** `.github/workflows/ci_betterleaks.yaml` checks out the *base* revision and fetches the PR's commits as data only, so `betterleaks.toml`, the Nix toolchain and the base `.betterleaksignore` all come from already-merged code. Do not reintroduce a PR-head checkout for these. **Deliberate exception:** the scan *merges* the base `.betterleaksignore` with the copy on the PR head (`git show refs/nhost/under-review:...`), so a PR can add a fingerprint to suppress its own reviewed false positive. The merge only adds — a PR cannot drop or empty a base suppression — but it does mean a PR can suppress a finding in its own run, so the reviewer must read the `.betterleaksignore` diff. This is gated by `check-permissions` (write access or the `safe_to_test` label).
- **The path filter must cover this whole directory.** When the config is supplied through `--config`/`BETTERLEAKS_CONFIG` (which the wrapper does) its own git history is scanned, and `betterleaks.toml`, `README.md` and `tests/` all contain fake secrets. The global `filter` excludes the directory with a single anchored prefix, `` `^tools/betterleaks/` ``. Keep it anchored (`^`); a non-anchored or optional-group form (e.g. `\.?`) was observed to stop matching.
- **The wrapper is a separate derivation.** Never copy the configuration into the Go build in `nixops/overlays/go.nix`: that puts the file in the Go derivation's hash, so every allowlist tweak forces a full recompile and a Nix cache miss. `project.nix` feeds the two files to a `runCommand` wrapper instead.
- **Every *reported* rule gets a fixture.** `tests/<rule-id>.sh` holds a few inline files the rule must report and a few it must not; add a fixture for the case you are changing and run `make test`. The three `skipReport` component rules (`nhost-project-url`/`-subdomain`/`-region`) have no script — they produce no findings to assert, and are exercised indirectly whenever the admin-secret validator resolves a target. If one regresses, validation silently falls back to the hard-coded projects; tighten them with care.
- **The test does not cover validation.** CI runs `--validation-status valid,none`; the admin-secret rule has a validator, so its findings fail CI only when confirmed live. The test proves matching and filtering, nothing more.
- **Prefer `betterleaks:allow` over `.betterleaksignore`.** An inline comment documents the false positive where it lives. The ignore file is for reviewed false positives that cannot carry a comment, one fingerprint per line.

## Directory Structure

```
tools/betterleaks/
├── betterleaks.toml      # Global CEL path/secret filter, per-rule allowlists, nhost-hasura-admin-secret rule + validator
├── .betterleaksignore    # Reviewed false positives by fingerprint
├── project.nix           # check (config check + tests/*.sh), package (wrapper), devShell
├── tests/
│   └── nhost-hasura-admin-secret.sh   # Inline fixtures: detect/ must be reported, ignore/ must not
└── Makefile              # check, test, develop
```

## Commands

```sh
make check            # nix build of checks.<system>.betterleaks (config check + tests/*.sh)
make test             # per-rule tests, in the dev shell
nix develop .\#betterleaks --command betterleaks git . \
  --log-opts='--diff-merges=first-parent origin/main..HEAD'   # what CI runs, without validation
```
