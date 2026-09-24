> _Model warning:_ expected `gpt-6-sol`; observed `unknown-gpt` via implementer self-report. Attribution only.

# Review finding 04 — New upgrade regression test lives in `scripts/`, outside the check fileset that CI uses to decide whether to run checks — ADDRESSED — *traits improved: reliability, testability, maintainability; confidence HIGH*

**Severity:** warning
**Scope:** in-scope
**Scope rationale:** The branch adds `test-extension-upgrades.sh` and `extension-upgrade-source.sql` as the regression guard that previous-image volumes still migrate. Placing them outside the Nix check fileset means CI can skip that guard when only those files change, which undermines the goal of verifying migration from the previous image.
**File:** services/postgres/scripts/test-extension-upgrades.sh
**Line:** 1
**Work unit:** PR_pgupgr-update/RUN-6886066177998911949/WU-003
**Agent:** nhost-reviewer
**Model:** claude-opus-5-5

## Finding

The branch adds `services/postgres/scripts/test-extension-upgrades.sh` and its fixture `services/postgres/scripts/extension-upgrade-source.sql`. It wires them into `_check-pre` through `check-extension-upgrades: ./scripts/test-extension-upgrades.sh`. The base branch had just done the opposite in commit `4007099f03` ("move graceful shutdown test into tests"): it moved `scripts/test-graceful-shutdown.sh` to `tests/` and removed `./scripts` from the check source fileset in `services/postgres/project.nix`:

```nix
fileset = fs.unions [
  ./postgres
  ./extensions
  ./tests
  (fs.fileFilter (f: f.hasExt "nix") ./.)
  ./plugins.md
];
```

That fileset matters because of how CI decides to run the Docker checks. `.github/workflows/wf_check.yaml` sets `BUILD_NEEDED` from `make check-dry-run`, the dry-run of `.#checks.<system>.postgres`. It runs `make dev-env-up` and `make check`, and therefore `_check-pre` and `check-extension-upgrades`, only when `BUILD_NEEDED == 'yes'`. Files under `services/postgres/scripts/` are not part of the check derivation's `src`, so editing them leaves the derivation unchanged. Once that derivation is cached, CI skips `make check`, and the modified upgrade test never runs.

The realistic trigger is the next release bump. The fixture hard-codes the previous release's extension versions (`('timescaledb', '2.27.2')`, `('pgmq', '1.11.1')`, …) next to `POSTGRES_UPGRADE_FROM_IMAGE:-nhost/postgres:18.4-20260610-1`, and the branch's own accepted concern says the two must advance together. A PR that updates only those two files, or breaks them, would pass CI without the test ever running. The placement also brings back the `scripts/` test location that the base branch just consolidated into `tests/`, which is where every other postgres check lives (`test-graceful-shutdown.sh`, `pitr-restore-container.sh`, `startup-scripts.sh`).

## Suggested plan

- Move `scripts/test-extension-upgrades.sh` and `scripts/extension-upgrade-source.sql` into `services/postgres/tests/`, and remove the reintroduced `scripts/` directory:
  - Update the Makefile target to `./tests/test-extension-upgrades.sh`.
  - Change the script's `plugins.sql` path from `"$script_dir/../tests/plugins.sql"` to `"$script_dir/plugins.sql"`. `upgrade_source` still resolves through `$script_dir`.
- Leave `project.nix` alone. `./tests` is already in the fileset, so the move makes both files inputs to the check derivation, and any change to them sets `BUILD_NEEDED=yes`.
- Validate with `make check-dry-run` before and after a whitespace-only edit to the relocated fixture: the derivation path should change, and it should not change for the same edit under `scripts/` today. Then run `nix develop .#postgres -c make -C services/postgres check`.

> _Implementer note (unknown-gpt, confidence HIGH):_ The extension upgrade script and SQL fixture now live under `services/postgres/tests/`, which `project.nix` includes in the check fileset; the Makefile and script resolve their relocated paths. `services/postgres/README.md` documents the general placement rule in a Tests section and recommends `git add -N <paths>` for new files instead of a `path:` flake.
>
> _Reviewer note (claude-opus-5-5, confidence HIGH, verdict ACCEPT):_ `test-extension-upgrades.sh` (still executable) and its byte-identical fixture `extension-upgrade-source.sql` now live in `services/postgres/tests/`, and `scripts/` no longer exists. `project.nix` already includes `./tests` in the check fileset, so editing either file changes the check derivation and CI's `BUILD_NEEDED` gate. Evaluating the flake with the new files intent-to-added shows both in the check's `src`. `check-extension-upgrades` now calls `./tests/test-extension-upgrades.sh`. The only script change is `plugins.sql` resolving as a sibling file, so the previous-image, pg_search/vector, invalid-database, inspection-failure, `app=old` and search-path assertions are unchanged. The README Tests section now gives the general rule for check scripts and fixtures and recommends `git add -N <paths>`, matching `services/ai/DEVELOPMENT.md`. That resolves the earlier concern about naming a single test and suggesting a `path:` flake.
