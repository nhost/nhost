> _Model warning:_ expected `gpt-6-sol`; observed `unknown-gpt` via implementer self-report. Attribution only.

# Review finding 06 — CHANGELOG omits the new startup extension-upgrade behavior — ADDRESSED — *traits improved: reliability, maintainability; confidence HIGH*

**Severity:** warning
**Scope:** in-scope
**Scope rationale:** The branch goal includes documenting startup constraints for safely upgrading installed extensions, and this branch's `init.sh` rewrite changes that startup behavior while the edited `### main` release notes list only version bumps.
**File:** services/postgres/CHANGELOG.md
**Line:** 7
**Work unit:** PR_pgupgr-update/RUN-6886066177998911949/WU-005
**Agent:** nhost-reviewer
**Model:** claude-opus-5-5

## Finding

The `### main` section of `services/postgres/CHANGELOG.md` holds the release notes for the next image. This branch adds the extension version list (lines 7-18), and every version in it matches the Nix pins in `services/postgres/extensions/*.nix` and the built `*.control` `default_version` values. The section does not mention that the branch also rewrites how existing volumes upgrade installed extensions at startup.

What changed in startup behavior (base `pgupgr/graceful-shutdown` → head `pgupgr/update`):

- **Before:** `services/postgres/postgres/nhost.d/XXXX-update-extensions.sql` ran one PL/pgSQL `DO` block. `run_nhost_scripts` ran it only in `$POSTGRES_DB`. The block called `ALTER EXTENSION … UPDATE` for each outdated extension inside that single session.
- **After:** that file is deleted. `services/postgres/postgres/bin/init.sh` now calls `update_extensions_all_databases` at the start of `run_nhost_scripts` on every boot. This function:
  - lists every database with `datallowconn`. That includes `postgres` and `template1`, not only `$POSTGRES_DB`.
  - finds outdated extensions in each database with `PGOPTIONS=… -c timescaledb.disable_load=on`.
  - updates TimescaleDB first. Each `ALTER EXTENSION :"extension" UPDATE` runs as the first command of its own `psql -X` session.
  - when an update fails, logs `WARNING: Failed to update extension <ext> in database <db>; continuing startup`. After a TimescaleDB failure it skips the remaining updates in that database.

```sh
# init.sh, update_extensions_all_databases
-c "SELECT datname FROM pg_database WHERE datallowconn ORDER BY datname"
```

Operators can see this change. Extensions in `postgres`, `template1`, and extra application databases are now upgraded automatically on the first boot of the new image. Before, only `$POSTGRES_DB` was upgraded, and every update ran inside one shared `DO`-block session. Failed upgrades now appear as startup warnings in a new format.

The CHANGELOG already documents this kind of change. The previous release entry says `- Update extensions script to dynamically update all outdated extensions instead of only timescaledb` (line 29). With the current entry, someone reading the release notes would think this release only bumps versions. They would not expect cross-database upgrades or the new warning lines. `services/postgres/README.md` ("Extension upgrades") only states the maintainer rule about separate sessions and `timescaledb.disable_load`. It does not describe this operator-facing behavior either.

## Suggested plan

- Add one or two bullets under `### main` in `services/postgres/CHANGELOG.md`, in the style of line 29. For example:
  - Installed extensions are now upgraded at startup in every database that accepts connections (including `postgres` and `template1`), not only `POSTGRES_DB`.
  - TimescaleDB is upgraded first, in a fresh session. A failed upgrade logs a warning and startup continues. After a TimescaleDB failure, the remaining upgrades in that database are skipped.
- Optionally, mention that the image ships a Nhost-maintained `pg_jsonschema--0.3.3--0.3.4.sql` upgrade script. `services/postgres/extensions/pg_jsonschema.nix` installs it in `postInstall` and checks it with `check-pg-jsonschema-upgrade.py`.
- Keep the wording in line with `update_extensions` / `update_extensions_all_databases` in `services/postgres/postgres/bin/init.sh`. Documentation-only change: no generated artifacts are affected. `docs/.../extensions.mdx` is generated from `plugins.md`, not from the CHANGELOG.
- Validation: `git diff` shows the new bullets under `### main`, and `prettier --check services/postgres/CHANGELOG.md` passes.

> _Implementer note (unknown-gpt, confidence HIGH):_ `services/postgres/CHANGELOG.md` now describes the actual `init.sh` startup upgrade scope, `pg_search` dependency handling, TimescaleDB session ordering, and nonfatal warning/skip behavior; it excludes invalid databases as the current catalog query does.
>
> _Reviewer note (claude-opus-5-5, confidence HIGH, verdict ACCEPT):_ `### main` in `services/postgres/CHANGELOG.md` now has two operator-facing bullets that match `update_extensions_all_databases` / `update_extensions` / `update_extension` in `services/postgres/postgres/bin/init.sh` at HEAD. The bullets cover these behaviors: every database matching `datallowconn AND datconnlimit <> -2` is upgraded, so invalid databases are excluded and `postgres` and `template1` are included, where the base branch's `XXXX-update-extensions.sql` `DO` block only upgraded `POSTGRES_DB`; `CREATE EXTENSION IF NOT EXISTS vector` runs before `pg_search` is updated; TimescaleDB is ordered first and each `ALTER EXTENSION` runs in its own `psql -X` session; a failed update logs a warning and startup continues; a TimescaleDB failure skips the remaining upgrades in that database; and a failed inspection logs a warning and skips that database. The bullets no longer repeat the original finding's outdated claim that every `datallowconn` database is upgraded. `test-extension-upgrades.sh` asserts the same behaviors. Formatted with Prettier, the file differs from HEAD only by the two added lines, so the new text adds no formatting changes. The whole-file failure already exists at HEAD. The CHANGELOG is not an input to the check fileset, the image source, or docs CI. No material concern.
