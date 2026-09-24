> _Model warning:_ expected `gpt-6-sol`; observed `unknown-gpt` via implementer self-report. Attribution only.

# Review finding 07 — pg_jsonschema drift checker ignores changes to the four inherited 0.3.3 functions — ADDRESSED — *traits improved: reliability, testability, maintainability; confidence HIGH*

**Severity:** suggestion
**Scope:** in-scope
**Scope rationale:** `check-pg-jsonschema-upgrade.py` was added on this branch specifically to keep the hand-maintained `pg_jsonschema--0.3.3--0.3.4.sql` in sync with a fresh 0.3.4 install. It skips one class of drift entirely, which weakens the safe in-place upgrade guarantee the goal depends on.
**File:** services/postgres/extensions/check-pg-jsonschema-upgrade.py
**Line:** 67
**Work unit:** PR_pgupgr-update/RUN-6886066177998911949/WU-006
**Agent:** nhost-reviewer
**Model:** claude-opus-5-5

## Finding

`pg_jsonschema.nix` installs a hand-written `pg_jsonschema--0.3.3--0.3.4.sql` in `postInstall`, then runs `check-pg-jsonschema-upgrade.py` against the pgrx-generated `pg_jsonschema--0.3.4.sql`. The checker splits the generated script into connected-object blocks. It then removes every block whose `AS 'MODULE_PATHNAME', '<wrapper>'` names one of the four 0.3.3 wrappers, and only checks that those four blocks exist:

```python
inherited = wrappers & _EXISTING_WRAPPERS
if inherited:
    if len(inherited) != 1 or wrappers != inherited:
        raise ValueError(...)
    existing_wrappers.update(inherited)
    continue
```

It never compares those blocks with the definitions that a 0.3.3 database already has. Today they match: I compared the shipped 0.3.3 install SQL (`/nix/store/…-pg_jsonschema-v0.4.0-rc1/share/postgresql/extension/pg_jsonschema--0.3.3.sql`) with the generated 0.3.4 SQL, and the only differences are in comments.

Nothing enforces that, though. The pinned source is an unstable post-tag commit (`rev = "d08e4dea…"`). A future bump could keep `default_version = '0.3.4'` but change an inherited function, for example switching `jsonb_matches_schema`'s `schema` parameter to `jsonb` or changing its volatility or `STRICT`. That would require `CREATE OR REPLACE`, `DROP`, or `CREATE` statements in the upgrade script. I simulated exactly that edit: I changed the `jsonb_matches_schema` block in a copy of the generated SQL to `"schema" jsonb` and `STABLE`, and the checker still exited 0.

In that case, upgraded databases would keep the old function definition while fresh installs got the new one. The checker would pass the build, and the existing `pg_extension_update_paths` assertion in `tests/plugins.sql` would pass too.

## Suggested plan

- Make the checker validate the inherited blocks as well as the added ones. Embed (or ship next to the script) the four 0.3.3 function definitions in a normalized form, and compare them with the corresponding generated 0.3.4 blocks after the same normalization. Normalization means stripping `/* … */` comments, `-- src/…` and `-- pg_jsonschema::…` locator lines, and collapsing whitespace, so that pgrx's comment-only differences (`/* pgrx::datum::json::Json */` vs `/* Json */`) do not cause false failures.
- If any inherited definition differs, fail with a message telling the maintainer to add the corresponding `CREATE OR REPLACE FUNCTION` / `DROP FUNCTION` statements to `pg_jsonschema--0.3.3--0.3.4.sql`, or to add a new version step.
- Validation: run the checker against the current generated SQL (should pass), and against a copy with a modified inherited signature or volatility (should now fail). Then rebuild `.#packages.<system>.postgres-pg18` to confirm the `postInstall` assertion still passes.

> _Implementer note (unknown-gpt, confidence HIGH):_ `services/postgres/project.nix` now runs the five pg_jsonschema checker regression tests inside the PostgreSQL Nix check, with Python in its build inputs and the test and checker in its source fileset. The ARM check log confirms the suite executed and passed, including the negative drift cases; the checker still compares all four inherited 0.3.3 definitions and rejects drift.
>
> _Reviewer note (claude-opus-5-5, confidence HIGH, verdict ACCEPT):_ `check-pg-jsonschema-upgrade.py` now embeds the four pg_jsonschema 0.3.3 function definitions (`_INHERITED_FUNCTIONS`). `_upgrade_objects` compares each generated inherited block with its baseline after `_normalize_definition` strips pgrx comments and the `-- src/…` / `-- pg_jsonschema::…` locator lines and normalizes whitespace. `postInstall` now fails when an inherited function's name, arguments, return type, volatility, `STRICT`, `PARALLEL`, `COST` or security attribute changes, and when an inherited block is duplicated. Comment, locator and whitespace edits still pass, and the exact `Counter` check on added objects is unchanged. The earlier concern (CI never ran the regression suite) is resolved. The `project.nix` `check` now adds `python3` to `nativeBuildInputs` and runs `tests/test_pg_jsonschema_upgrade.py` through `unittest discover` before the PostgreSQL integration steps. The test and the checker are both in that derivation's `${src}` fileset, so every `make check`/CI run of `checks.<system>.postgres` executes the five tests. Evidence: the embedded baseline normalizes to the same text as the previously shipped `pg_jsonschema--0.3.3.sql` (4/4), and all seven cached generated 0.3.4 scripts pass. A fresh aarch64 check build, forced with a nonce so the cache could not satisfy it, logged all five tests passing. No material concern remains.
