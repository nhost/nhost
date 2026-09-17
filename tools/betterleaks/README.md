# betterleaks

Secret-scanning configuration for the monorepo, run by
`.github/workflows/ci_betterleaks.yaml` against every pull request.

- `betterleaks.toml` — the configuration: global path filter and secret
  allowlist, the `nhost-hasura-admin-secret` rule with its heuristics, and the
  `validate` block. **Note:** the validator POSTs each candidate admin secret
  (in an `X-Hasura-Admin-Secret` header) to Nhost project metadata endpoints —
  two hard-coded projects plus any `*.hasura.<region>.nhost.run` project URL
  found in the same diff. A PR that names its own project therefore has its
  diff's candidate secrets sent to that project. The host is always forced to
  end in `.nhost.run`, so it cannot be redirected off-Nhost.
- `.betterleaksignore` — reviewed false positives, one fingerprint per line.
- `project.nix` — packages the pinned upstream build from
  `nixops/overlays/go.nix` with both files baked in, and exposes a `check`
  that validates the configuration and runs the tests.
- `tests/<rule-id>.sh` — one script per custom rule: a few inline fixtures
  that must be reported and a few that must not.

There is deliberately no `.betterleaks.toml` at the repository root: the
wrapped binary from `nix develop .\#betterleaks` supplies both files itself,
through `BETTERLEAKS_CONFIG` and `--gitleaks-ignore-path`. A betterleaks
installed some other way needs `--config tools/betterleaks/betterleaks.toml
--gitleaks-ignore-path tools/betterleaks/.betterleaksignore`.

## How CI uses these files

The workflow checks out the **base** revision and fetches the PR's commits as
data only, so `betterleaks.toml` and the scanner itself always come from
already-merged code — a config change takes effect only once merged.

`.betterleaksignore` is the deliberate exception: CI merges the base list with
the copy on the PR head, so a PR **can** add a fingerprint to suppress its own
reviewed false positive in the same PR. The merge only adds; a PR cannot drop
or empty a base suppression. The cost is that a PR can suppress one of its own
findings, so a reviewer must read the `.betterleaksignore` diff — the scan is
gated by `check-permissions` (write access or the `safe_to_test` label).

CI fails only on findings whose validation status is `valid` (the validator
confirmed the secret is live) or `none` (the rule has no validator). A rotated
or fake admin secret that the validator rejects does not fail the build.

## Usage

```sh
# scan the commits on your branch that are not yet on main, like CI does
nix develop .\#betterleaks --command betterleaks git . \
  --log-opts='--diff-merges=first-parent origin/main..HEAD'

# same, with fingerprints printed (see "Ignoring a finding")
nix develop .\#betterleaks --command betterleaks git . \
  --log-opts='--diff-merges=first-parent origin/main..HEAD' --verbose --legacy-print

# validate the configuration and run the rule tests
make check

# rule tests only
make test
```

## CI failed on a "leaked secret" in my PR — what do I do?

**Is it a real secret?** Rotate it and remove it from the code. Don't touch
this directory.

**Is it fake (a test value, an example, a fixture)?** Silence it. Two ways:

- Easiest: add `# betterleaks:allow` at the end of the offending line. Done.
- Can't edit that line (JSON, a lockfile, generated code)? Add **one line** to
  `tools/betterleaks/.betterleaksignore`:

  ```
  path/to/file.go:rule-id:line
  ```

  Read those three values straight off the failed CI log's finding box:

  ```
  ┌─private-key──○                         <- rule-id
  │ 12 │ const key = "REDACTED"            <- line number
  │   path .......... path/to/file.go      <- path
  ```

  So here you'd add: `path/to/file.go:private-key:12`

Commit and push — CI re-runs and the finding is gone. You can do this in the
**same PR**; no separate PR needed. (The one exception is a change to
`betterleaks.toml` itself, which only takes effect once merged.)

### Ignoring a finding (`.betterleaksignore`)

One fingerprint per line, two forms:

```
path:rule-id:line               # ignores the finding wherever it appears in history
commit:path:rule-id:line        # ignores it in that one commit only
```

Prefer the path form; the commit form stops matching as soon as the commit is
rebased. CI's output does not print the fingerprint itself but every part of
it, so compose it from the finding box: the `path` attribute, the rule id in
the box header, and the line number in the left margin (use the `git.sha`
attribute as the commit if you want the commit form). Locally,
`--verbose --legacy-print` or `-f json` print the fingerprint directly.

Add a short comment above the entry saying why it is a false positive, and
prune entries whose file no longer exists.

### Changing the configuration (`betterleaks.toml`)

Where a change belongs:

- **A well-known placeholder value** (`nhost-admin-secret`, `changeme`, a test
  JWT, …) — append it to the `finding["secret"] in [...]` list inside the
  global `filter`. It is then ignored for every rule.
- **A path that should never be scanned** (generated code, fixtures, …) —
  append an anchored pattern to the `filter.matchesAny(attributes["path"],
  [...])` list in the global `filter`. Keep patterns separate and anchored;
  do not merge them with optional groups.
- **A false positive in how admin secrets are recognised** — extend the
  `nhost-hasura-admin-secret` rule's `filter` (the bare-identifier, prose and
  template heuristics live there) rather than the regex.
- **A new kind of secret** — add a `[[rules]]` entry and a matching
  `tests/<rule-id>.sh`.

Then add a fixture under `detect/` or `ignore/` in the rule's test script and
run `make check`, which also confirms the file still parses and every regex
and CEL expression compiles. The tests cover matching and filtering only, not
`--validation`.
