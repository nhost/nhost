# Simplify CLI npm publishing with Nix

**Status:** ready
**Created:** 2026-06-25

---

## 1. Requirements

Captured from the discussion with the user. Reflects the agreed scope at the time of writing.

### 1.1 Problem / motivation

The current `cli/npm` branch adds npm publishing for the Nhost CLI, but it changes existing GitHub workflows more than desired and introduces `actions/setup-node`, which weakens the repository's Nix-based reproducibility story. The change should integrate better with existing release practices: Nix-built CLI artifacts, pinned tooling, and minimal shared workflow churn.

### 1.2 Functional requirements

- Publish the Nhost CLI to npm as `@nhost/cli` plus platform-specific packages for darwin/linux on arm64/x64.
- Use the release version and the same Nix-built CLI binaries produced by the CLI release path.
- Publish platform packages before the main `@nhost/cli` package.
- Make reruns safe after partial npm failures by skipping package versions already present on npm.
- Preserve npm trusted publishing/OIDC if feasible.
- Recommend one implementation approach and document rejected alternatives briefly.

### 1.3 Non-functional requirements / constraints

- Do not use `actions/setup-node` in CI.
- If npm tooling is needed in GitHub Actions, run it from Nix, preferably the existing `.#pnpm` shell / `pkgs.nhost.nodejs` toolchain.
- Keep workflow changes minimal and avoid broad redesign of shared release workflows.
- Keep the shared JS/SDK npm workflow behavior backward-compatible.
- Keep phases self-contained, functional, and testable.

### 1.4 Surfaces in scope

- `.github/workflows/ci_release.yaml` — pass the Discord webhook secret into the CLI release workflow.
- `.github/workflows/cli_wf_release.yaml` — host the CLI-specific Nix-native npm publish job.
- `.github/workflows/wf_release_npm.yaml` — restore to the existing JS/SDK-only Nix+pnpm release path.
- `cli/project.nix` — stage npm packages from `cli-multiplatform` and optionally add build-time consistency checks.
- `flake.nix` — keep exposing `packages.<system>.cli-npm` if already present.
- `cli/Makefile` — keep `build-npm` for Nix staging.
- `cli/npm/*` — package metadata, shim, and publishing documentation.

### 1.5 Out of scope

- Broad release workflow redesign.
- Reworking unrelated npm package releases such as `@nhost/nhost-js` beyond restoring shared workflow compatibility.
- Removing npm publishing entirely.
- Adding a reusable binary-npm publish framework before there is reuse.

### 1.6 Success criteria

- No CLI npm publishing path uses `actions/setup-node`.
- The shared `wf_release_npm.yaml` no longer has CLI artifact mode and remains compatible with existing JS/SDK callers.
- CLI npm packages are staged from Nix-built release binaries and validated before publishing.
- Publish reruns skip package versions already on npm and publish platform packages before the main package.
- Docs describe the Nix-native CI path, trusted-publisher setup, bootstrap path, and recovery behavior.
- Workflow lint/static checks and Nix/package dry-run checks pass where available.

### 1.7 Open questions / blockers (optional)

- None blocking. First-time npm package bootstrap and trusted-publisher configuration are external operational prerequisites documented by this plan.

---

## 2. Implementation strategy

### 2.1 Central design decision

Restore `.github/workflows/wf_release_npm.yaml` to its pre-branch JS/SDK-only Nix+pnpm behavior and stop routing CLI npm publishing through it. Add a CLI-specific inline `publish-npm` job in `.github/workflows/cli_wf_release.yaml` that re-materializes `cli-npm` from the Nix cache and runs `npm view` / `npm publish` through `nix develop .#pnpm -c ...`. Remove the `cli-npm-dist` artifact handoff; rebuilding the thin Nix staging derivation avoids upload-artifact executable-bit loss while keeping a clean retry boundary.

### 2.2 Key constraints and invariants

- `actions/setup-node` must not be used for this feature.
- `wf_release_npm.yaml` must not grow CLI-specific artifact publishing branches.
- `publish-npm` must run `make get-version VER=${{ inputs.VERSION }}` before `make build-npm` in the same checkout and must not restore `project.nix` before building.
- `VERSION` returned by `make get-version` is the sanitized release version and must be used for validation, dist-tag decisions, publish messages, and Discord text.
- Nix-provided npm must be `>= 11.5.1` before publishing.
- Staged packages must validate before any `npm publish`: expected directories exist, all versions match `VERSION`, main `optionalDependencies` match the four platform package names at `VERSION`, and binaries are executable.
- Publish order is explicit: `darwin-arm64`, `darwin-x64`, `linux-arm64`, `linux-x64`, then `main`.
- `publish-npm` must keep `permissions: id-token: write, contents: read` for npm trusted publishing.
- The current npm JS shim is in scope only for validation; the user's objection is CI Node setup, not Node as an npm package runtime.

### 2.3 Touched surfaces

- `.github/workflows/ci_release.yaml` — keep/pass `DISCORD_WEBHOOK_PRODUCTION` into the CLI workflow.
- `.github/workflows/cli_wf_release.yaml` — replace artifact/reusable-workflow npm publishing with inline Nix-native publish job.
- `.github/workflows/wf_release_npm.yaml` — remove branch artifact mode and restore baseline JS/SDK behavior.
- `cli/project.nix` — keep `cli-npm`; add a cheap package-name consistency check if needed.
- `cli/Makefile` / `flake.nix` — keep existing `build-npm` and `cli-npm` exposure unless validation requires adjustment.
- `cli/npm/PUBLISHING.md` / `cli/npm/README.md` — update docs to match the Nix-native publishing path.

### 2.4 Compatibility, deployment, and rollback notes

- **Compatibility:** Existing JS/SDK npm releases remain on the restored `wf_release_npm.yaml` path. CLI npm publishing moves to `cli_wf_release.yaml` only. npm trusted publisher setup must target `.github/workflows/cli_wf_release.yaml` / `publish-npm` for all five CLI packages.
- **Deployment:** Bootstrap the five npm packages and trusted-publisher settings before relying on CI. A live prerelease/beta run is the final proof that npm accepts the OIDC claim for the reusable workflow/job nesting.
- **Rollback:** Standard revert is sufficient. If npm publishing fails after some platform packages publish, rerun after the fix; the publish loop skips versions already present and proceeds to missing packages.

---

## 3. Phased plan of action

### Phase 1 — Atomic workflow simplification

**Goal:** Remove CLI artifact/setup-node publishing and replace it with a valid Nix-native inline CLI publish job while restoring the shared npm workflow.

**Depends on:** none

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `.github/workflows/ci_release.yaml` — retain the `DISCORD_WEBHOOK` pass-through for CLI release notifications.
- `.github/workflows/cli_wf_release.yaml` — remove artifact staging/upload and reusable `wf_release_npm.yaml` call; add inline `publish-npm` job.
- `.github/workflows/wf_release_npm.yaml` — restore baseline JS/SDK-only behavior.

**Implementation steps:**

1. Restore `wf_release_npm.yaml` to the single-mode Nix+pnpm release flow: required AWS/Nix cache secrets, setup Nix, `make build`, copy `result/dist`, `nix develop .#pnpm -c pnpm version`, and `nix develop .#pnpm -c pnpm publish`.
2. Remove `ARTIFACT`, artifact conditionals, `actions/setup-node`, artifact download, and direct npm publish branch from `wf_release_npm.yaml`.
3. In `cli_wf_release.yaml`, remove `Stage npm packages`, `Upload npm packages`, `cli-npm-dist`, and the reusable-workflow `publish-npm` call.
4. Add a normal `publish-npm` job with `needs: build-multiplatform`, explicit generous `timeout-minutes` suitable for a cache-miss rebuild, `permissions: id-token: write, contents: read`, checkout of `${{ inputs.GIT_REF }}`, AWS configuration, and `.github/actions/setup-nix` using existing CLI release cache secrets.
5. Run publish-job commands from `cli`: `VERSION=$(make get-version VER=${{ inputs.VERSION }})`, then `make build-npm`. Do not restore `project.nix` before `make build-npm`.
6. Gate publishing on `nix develop .#pnpm -c npm --version` being `>= 11.5.1`.
7. Compute npm tag from sanitized `VERSION` (`alpha|beta|dev|rc` => `beta`, otherwise `latest`) and use that same `VERSION` in validation and notifications.
8. Add prepublish validation for expected package directories, version equality, optional dependency names/versions, package-name prefix consistency where practical, and executable bits.
9. Publish in explicit platform-first order using Nix-provided `node` and `npm`; skip `name@version` already on npm.
10. Keep Discord notification through `ci_release.yaml` -> `cli_wf_release.yaml` secret input -> `.github/actions/discord-notification`. Verify the notification action tolerates an empty webhook, or guard the step when the secret is empty.

**Tests and checks:**

- `actionlint .github/workflows/ci_release.yaml .github/workflows/cli_wf_release.yaml .github/workflows/wf_release_npm.yaml` if available.
- Static grep checks scoped correctly:
  - no `actions/setup-node` in `.github/workflows` for this feature;
  - no `cli-npm-dist` in `.github/workflows`;
  - no `ARTIFACT` input/branch in `.github/workflows/wf_release_npm.yaml`;
  - no CLI `publish-npm` call to `.github/workflows/wf_release_npm.yaml`.
- `nix develop .#pnpm -c npm --version` reports `>= 11.5.1`.
- `make -C cli build-npm` after `make get-version` staging.
- `npm pack --dry-run --json` through Nix for `cli/result/dist/main` and each platform directory.

**Definition of done:**

- After this phase, the CLI release workflow is valid and does not depend on later phases.
- `cli_wf_release.yaml` no longer references `wf_release_npm.yaml`.
- Existing SDK callers still use the restored shared npm workflow.
- The publish job validates staged version equals sanitized `VERSION` before any `npm publish`, preventing accidental `0.0.0-dev` publishes.
- The Discord secret path is complete and safe when the webhook is absent.
- The system remains fully functional because CLI release binary upload/Homebrew update still run in `build-multiplatform`, and npm publishing is isolated in a dependent job.

**Phase commit message:** `ci(cli): publish npm packages via nix`

**Implementation log**

- Implemented inline CLI npm publishing in `.github/workflows/cli_wf_release.yaml`: removed the `cli-npm-dist` artifact handoff and reusable `wf_release_npm.yaml` call, added a dependent `publish-npm` job that checks out the release ref, configures Nix/cache access, runs `make get-version` before `make build-npm`, gates npm trusted publishing support on npm `>= 11.5.1`, validates staged package names/versions/optional dependencies/executable bits, publishes platform packages before `@nhost/cli`, and skips already-published `name@version` pairs.
- Restored `.github/workflows/wf_release_npm.yaml` to the JS/SDK-only Nix + pnpm release flow. `.github/workflows/ci_release.yaml` was left unchanged because it already passes `DISCORD_WEBHOOK_PRODUCTION` into the CLI workflow, and the Discord action itself guards empty webhook URLs.
- Reviewer verdict: `ACCEPT`. The reviewer confirmed the shared npm workflow matches the pre-CLI baseline, the CLI workflow no longer references `wf_release_npm.yaml`, the publish job satisfies the phase definition of done, and residual npm OIDC/bootstrap risks are external operational prerequisites for Phase 3 docs rather than blockers.
- Autonomous decisions / assumptions:
  - Used the plan's workflow/package checks as the mandatory Phase 1 gate instead of unrelated full monorepo tests because Phase 1 only changes release workflows; this maximizes correctness signal and long-term maintainability without widening validation to unrelated projects.
  - Treated the initial local `make -C cli get-version` failure on macOS BSD `date`/`sed` as an environment/tooling mismatch, then reran the same gate with GNU coreutils/gnused on `PATH`, matching CI/Linux semantics; this preserves correctness while avoiding a false negative from local platform tools.
  - Accepted the reviewer-noted npm trusted-publisher live-claim and first-publish bootstrap risks as non-blocking because they are external operational prerequisites already called out by the plan and will be documented in Phase 3.
- Quality gate history:
  - `nix run nixpkgs#actionlint -- -ignore 'label "blacksmith-2vcpu-ubuntu-2404" is unknown' -ignore 'SC2001' -ignore 'SC2086' .github/workflows/ci_release.yaml .github/workflows/cli_wf_release.yaml .github/workflows/wf_release_npm.yaml` — passed. Unignored actionlint only reported the repository's custom runner label and pre-existing unchanged `ci_release.yaml` shellcheck style/info findings.
  - Static grep checks — passed: no `actions/setup-node` in `.github/workflows` for this feature, no `cli-npm-dist`, no `ARTIFACT` input/branch in `wf_release_npm.yaml`, and no CLI `publish-npm` call to `wf_release_npm.yaml`.
  - `nix develop .#pnpm -c npm --version` — passed with npm `11.7.0`.
  - `make -C cli get-version VER=0.0.0-dev && make -C cli build-npm` — initially failed locally with BSD `date`/`sed`; rerun with GNU coreutils/gnused on `PATH` passed and restored `cli/project.nix` afterwards.
  - `nix develop .#pnpm -c npm pack --dry-run --json ./cli/result/dist/{main,darwin-arm64,darwin-x64,linux-arm64,linux-x64}` — passed for all five staged packages.
  - Direct staged package validation for versions, optional dependencies, package names, and executable bits — passed.
  - `git diff --check` for the scoped workflow files — passed.

### Phase 2 — Harden Nix package staging invariants

**Goal:** Add lightweight validation to the Nix staging path without broadening the publishing design.

**Depends on:** Phase 1

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `cli/project.nix` — add a cheap `jq` consistency check in or near `cli-npm` if it is not already covered sufficiently.
- `cli/Makefile`, `flake.nix`, `cli/npm/package.json`, `cli/npm/platforms/*/package.json`, `cli/npm/bin/nhost` — inspect and adjust only if validation exposes a mismatch.

**Implementation steps:**

1. Keep the existing `cli-npm` derivation that stages from `cli-multiplatform`.
2. Add a simple build-time check that the main package `optionalDependencies` keys exactly match the four platform package `name` fields and that staged dependency versions are `${version}`.
3. If practical without fragile JS parsing, also check that the package-name prefix expected by `bin/nhost` remains aligned with `@nhost/cli`; otherwise document that the publish-job validation covers package names and that `PKG_PREFIX` remains a reviewed sync point.
4. Do not add a separate `cli-npm-publish` Nix helper in this phase.

**Tests and checks:**

- `make -C cli build-npm`.
- From repo root, inspect `cli/result/dist/main/package.json`, `cli/result/dist/*/package.json`, and executable bits.
- `nix develop .#pnpm -c npm pack --dry-run --json ./cli/result/dist/main` and repeat for each platform package, or equivalent from `cli`.

**Definition of done:**

- Nix staging fails early on platform package name/dependency drift.
- All five staged packages use the release version and expected files.
- This phase may be a small `cli/project.nix`-only change; implementers must not broaden into renames or helper scripts unless validation finds an actual mismatch.
- The repo remains fully functional after this phase.

**Phase commit message:** `build(cli): validate npm package staging`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

### Phase 3 — Update CLI npm publishing docs

**Goal:** Make maintainer documentation match the Nix-native CI and recovery flow.

**Depends on:** Phase 1, Phase 2

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `cli/npm/PUBLISHING.md` — update CI, bootstrap, trusted-publisher, and recovery instructions.
- `cli/npm/README.md` — update only if workflow/package behavior described there changes.

**Implementation steps:**

1. Rewrite the CI section to describe `cli_wf_release.yaml`: `build-multiplatform` builds/caches release binaries, then `publish-npm` rebuilds `cli-npm` from cache and publishes through `nix develop .#pnpm -c npm publish`.
2. Remove mentions of artifact handoff, upload/download executable-bit loss, `chmod` workaround, and `actions/setup-node` from the normal CI path.
3. Document that all five npm packages need trusted-publisher/OIDC configuration for `.github/workflows/cli_wf_release.yaml` / `publish-npm`, not the restored shared npm workflow.
4. Document first-publish/manual bootstrap and recovery ordering: platform packages first, main last; reruns skip already-published exact versions.
5. Note that a live prerelease/beta release is the final integration test for npm's trusted-publisher claim matching.

**Tests and checks:**

- Markdown/lint checks if configured.
- Docs review against the final workflow diff.
- `git diff --check`.

**Definition of done:**

- Docs match actual workflow behavior and external npm prerequisites.
- Docs no longer describe setup-node or artifact handoff for the normal CI path.
- Maintainers can follow the docs to bootstrap, publish, and recover partial publishes.
- The repo remains fully functional because this phase is documentation-only.

**Phase commit message:** `docs(cli): document nix npm publishing`

**Implementation log**

_(filled by `nhost-implement` during execution: implementation notes, reviewer verdict, and any assumption/decision taken with its pillar justification.)_

---

## 4. Implementation execution protocol

Use this loop for each phase, starting with the first unimplemented phase:

1. **Implement:** Ask the routed implementer to implement only the current phase while keeping the full plan in mind. Use `subagent` with `agentScope: "both"`, `model: "gpt-5.5"`, `context: "fresh"`, inline `output`, no `acceptance` gate, no `worktree`, and the implementer listed for the phase. The prompt must include the full plan, the current phase, and the requirement that tests be written or updated for the implementation.
2. **Review:** Ask the routed reviewer to review the implementation. Use `subagent` with `agentScope: "both"`, `model: "claude-opus-4-8"`, `context: "fresh"`, inline `output`, no `acceptance` gate, no `worktree`, and the reviewer listed for the phase. The reviewer must inspect the actual diff, verify consistency with the full plan and surrounding phases, and run the tests/checks written by the implementer when practical.
3. **Improve:** If the reviewer provides feedback, ask the implementer to address it. Keep the feedback scoped to the current phase unless fixing it safely requires adjusting the plan.
4. **Repeat:** Continue review/improve cycles until the reviewer accepts the phase or no blocking concerns remain. If the loop stalls or the reviewer raises a plan-level issue, stop and ask the user before proceeding.
5. **Commit:** Commit all changes made during the phase with the phase commit message, after the relevant checks pass or any skipped checks are explicitly justified.
6. **Continue:** Move to the next phase and repeat until all phases are complete.

Language routing:

| Phase files | Implementer | Reviewer |
| --- | --- | --- |
| any supported files | `nhost-implementer` | `nhost-reviewer` |

The unified agents infer Go, JS/TS, mixed, or generic guidance from the files in scope and load the matching repository rules before acting.

---

## 5. Validation matrix

| Requirement | Phase(s) | Validation |
| --- | --- | --- |
| No `actions/setup-node` in CLI npm CI | 1 | Workflow diff and grep checks; actionlint |
| Preserve existing JS/SDK npm release behavior | 1 | `wf_release_npm.yaml` restored to baseline; existing SDK callers still reference it |
| Publish CLI npm packages from Nix-built release binaries | 1, 2 | `make -C cli build-npm`; staged package inspection |
| Platform packages publish before main | 1, 3 | Explicit publish order in workflow; docs review |
| Reruns safe after partial publishes | 1, 3 | `npm view name@version` skip logic; docs recovery section |
| Preserve npm trusted publishing/OIDC | 1, 3 | `id-token: write`; npm `>=11.5.1`; docs for trusted publisher; live prerelease final check |
| Prevent accidental `0.0.0-dev` publish | 1 | Sanitized `VERSION` validation before publish |
| Keep package metadata internally consistent | 1, 2 | Prepublish validation; Nix staging invariant; `npm pack --dry-run` |
| Keep maintainer docs accurate | 3 | Docs review and markdown checks |

---

## 6. Risks and mitigations

- **Risk:** npm rejects OIDC for the reusable workflow/job claim. — **Mitigation:** use npm `>=11.5.1`, keep `id-token: write`, document trusted-publisher target as `.github/workflows/cli_wf_release.yaml` / `publish-npm`, and validate with a prerelease.
- **Risk:** first publish of the five new package names cannot use trusted publishing yet. — **Mitigation:** document manual bootstrap as an external prerequisite.
- **Risk:** Nix cache push from `build-multiplatform` fails and `publish-npm` rebuilds slowly. — **Mitigation:** set a generous publish-job timeout; rebuild remains correct even if slower.
- **Risk:** Homebrew/GitHub release failures block `publish-npm` because it depends on `build-multiplatform`. — **Mitigation:** this is no worse than the current branch coupling; rerun behavior remains safe through npm skip logic.
- **Risk:** inline shell publishing logic becomes hard to reuse. — **Mitigation:** intentionally accept this for minimal diff; extract a helper only when another binary npm package needs it.
- **Risk:** Discord webhook is absent for some release paths. — **Mitigation:** verify/guard notification step so empty webhook does not fail the job.

---

## 7. Follow-ups (out of scope for this plan)

- Extract a reusable Nix-packaged binary npm publish helper if more binary npm packages are added — tracked in: TBD.
- Consider decoupling npm publish from Homebrew/GitHub release side effects if release retry ergonomics become a recurring issue — tracked in: TBD.
