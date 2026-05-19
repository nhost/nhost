---
name: nhost_fix_vulnerabilities
description: Find and fix dependency vulnerabilities in this monorepo using audit-ci-recursive and pnpm.overrides.
disable-model-invocation: false
allowed-tools: Bash(pnpm *), Bash(bash *), Bash(cd *), Bash(jq *), Read, Edit, Write, Grep, Glob
---

You are a dependency-security assistant for this monorepo. CLAUDE.md is already loaded — do not re-describe the repo. Follow the workflow below exactly.

## Workflow

### 1. Scan

Run the project's audit script **from the repo root** — the script is defined in the root `package.json` and will error out if invoked from a workspace subdirectory. Also, **do not pass `-w`** (pnpm's root-workspace flag): the script already uses `pnpm -r exec` internally to iterate workspaces, and `-w` conflicts with that.

```bash
pnpm run audit-ci-recursive
```

The wrapper (`.claude/skills/nhost_fix_vulnerabilities/audit-workspace.sh`) groups output by workspace. Each finding includes:

- `📂 <workspace>` — the folder containing the issue
- `<package>@<version> [SEVERITY]`
- `Vulnerable: <range>  →  Fix: <range>`
- `Path: <dependency chain>` — how the package enters this workspace
- Advisory URL

If the script produces **no output** and exits 0, stop here — report that no vulnerabilities were found and exit.

### 2. Classify each finding

For every finding, decide: **direct** or **transitive**.

- **Direct**: the vulnerable package appears in the workspace's own `package.json` (`dependencies` / `devDependencies`). The `Path:` line is short (e.g., `.>package`).
- **Transitive**: the package is pulled in by another dependency. The `Path:` line has multiple hops (e.g., `.>expo>@expo/cli>@expo/plist>@xmldom/xmldom`).

Verify by reading the workspace's `package.json` — do not guess from the path alone.

### 3. Apply the fix

**Direct dependency:**

1. Edit the workspace's `package.json`, bumping the version constraint into the `Fix:` range.
2. Prefer the smallest change that resolves the advisory. If the current range is `^9.0.1` and the fix is `>=14.0.0`, bump to `^14.0.0`.
3. Flag major-version jumps to the user before applying — list known breaking changes (e.g., ESM-only, dropped Node versions, renamed APIs). Offer the bump but wait for confirmation if the jump spans ≥2 majors.

**Transitive dependency:**

> A transitive vulnerability is **not** a reason to skip the fix. The workspace that ships the vulnerable package is your responsibility to secure. Overrides exist as a fallback — but the preferred fix is bumping the parent that pulled it in.

Follow these steps in order. Only move to the next step if the current one doesn't resolve the vuln.

**Step A — Bump the top-level parent (preferred).**

1. From the `Path:` line, identify the **top-level parent**: the first hop after `.` (e.g., in `.>expo>@expo/cli>@expo/plist>@xmldom/xmldom`, the parent is `expo`).
2. Check for a newer compatible version:
   ```bash
   cd <workspace> && pnpm outdated <parent>
   ```
3. **If a newer version exists within the current major range** (e.g., workspace pins `^1.0.0`, latest is `1.5.2`):
   - Bump the version constraint in the workspace's `package.json`.
   - Run `pnpm install`.
   - **Verify scoped** (see "Per-fix verification" below) — the parent bump is workspace-local, so checking that one workspace is enough.
   - If the advisory is gone → keep the change, move to the next finding.
   - If the advisory is still present → **revert** the parent bump in `package.json` + `pnpm install` to restore state, then proceed to Step B.

**Step B — Major-version parent bump (user decision required).**

If only a newer *major* version of the parent would fix the issue (e.g., workspace on `^1.x`, fix only shipped in `2.0`):

- **Stop and ask the user.** Present both options:
  - *Option A:* Bump `<parent>` from `^1.x` to `^2.x`. Breaking change — summarize notable breaks from the changelog (link it).
  - *Option B:* Add a `pnpm.overrides` entry (see Step C). Smaller diff, but `<parent>@1.x` was never tested against the overridden sub-dep version, so there's runtime risk.
- Do not pick for the user. Wait for their choice, then execute it.

**Step C — `pnpm.overrides` (fallback).**

Use this when Step A isn't possible (no newer parent version at all) or the user picked Option B in Step B.

1. Add an entry to `pnpm.overrides` in the **root** `package.json`.
2. Use a **narrow version range**, not a blanket pin. Pattern:
   ```json
   "<pkg>@<vulnerable-range>": "<minimum-fixed-version>"
   ```
   Example — advisory says `<0.9.10` is vulnerable, fix is `>=0.9.10`:
   ```json
   "@xmldom/xmldom@<0.9.10": ">=0.9.10"
   ```
3. Before adding, scan existing overrides for the same package. If one exists and the new range is a superset, **consolidate** into a single entry rather than stacking. Example: replace `"foo@<1.2.0": ">=1.2.0"` with `"foo@<1.5.0": ">=1.5.0"` if 1.5.0 covers both CVEs.
4. Avoid unbounded overrides (`"foo": ">=X"`) — they force every transitive copy to the new version and can break unrelated packages. Only use when the narrow form fails.
5. **Verify repo-wide** — overrides are global, so run the full `pnpm run audit-ci-recursive`. This is the one case where scoped verification is not enough: the same override likely fixes the same vuln in multiple workspaces, and a broad override could subtly affect resolution elsewhere. If the advisory still appears *anywhere*, widen the range or revert.

### 4. Verify

Verification depends on what kind of fix was just made.

**Per-fix verification — scoped (direct bump, Step A, Step B).**

The change is local to one workspace's `package.json`, so only that workspace needs re-checking. After `pnpm install`:

```bash
cd <workspace> && pnpm audit --json | jq '.advisories."<GHSA-id>"'
```

- `null` → advisory is gone. Keep the change, move on.
- Any object → advisory still present. Revert the change per the flow above, then try the next option in the ladder.

**Per-fix verification — repo-wide (Step C / overrides).**

Overrides at root affect every workspace. After `pnpm install`, run:

```bash
pnpm run audit-ci-recursive
```

Confirm the specific advisory no longer appears in *any* workspace. If it still does, widen the override range or revert and escalate.

**Match by advisory ID, not total vuln count.** A bump or override can fix one advisory and surface another; total numbers can look unchanged even though your specific GHSA is resolved.

**Final sweep (once, at the end).**

After all findings have been addressed, run one last `pnpm run audit-ci-recursive` as a regression check across all workspaces. This catches cases where sequential fixes interacted unexpectedly. If something unexpected remains, run `pnpm why <package>` in the affected workspace and escalate to the user with options: (a) bump the top-level parent, (b) add to `audit-ci.jsonc` allowlist with a written justification.

### 5. Report

When done, summarize:

- Vulnerabilities fixed — one line each: workspace, package, old → new version, advisory ID.
- Whether it was a direct bump or an override.
- Any remaining advisories and why they weren't fixed.
- Whether `pnpm install` produced peer-dependency warnings that need attention.

Do **not** run `pnpm build`, `pnpm test`, or the dashboard dev server — the user runs verification themselves.

Do **not** commit. Leave the working tree dirty so the user reviews the diff first.

## Constraints

- **Never** add broad `pnpm.overrides` entries without a version selector (would affect every package in the monorepo).
- **Never** add an advisory to `audit-ci.jsonc` allowlist as a first-line fix. Allowlisting is a last resort and requires written justification.
- **Never** delete or downgrade overrides you didn't add in this session unless the user explicitly asks.
- **Never** edit `pnpm-lock.yaml` (or any lockfile) by hand. Lockfiles are regenerated by `pnpm install` — hand-edits desync them from the resolver's internal state and cause silent integrity failures. Change `package.json`, then let `pnpm install` rewrite the lockfile.
- If the fix requires a major version bump that could be breaking, surface it and wait for user confirmation before editing.

## Tool usage

**Forbidden**: invoking `python3`, `python`, `node`, or any one-off interpreter to read, parse, or print file contents. Also forbidden: `cat <file> | python3 -c "..."` pipelines. If you catch yourself writing one of these, stop and use the alternatives below.

**Do this instead:**

| Goal | Correct tool |
|---|---|
| View a file (`package.json`, lockfile, anything) | `Read` |
| Extract a JSON field (e.g., version of a package) | `jq '.version' path/to/package.json` via Bash |
| Extract multiple fields | `jq '{name, version, dependencies}' path/to/package.json` |
| Trace a transitive dep | `pnpm why <pkg>` (inside the affected workspace) |
| Find strings across files | `Grep` |

`jq` and `pnpm` are guaranteed available. Python and Node are not part of this skill's toolkit — never reach for them.

**Always use `pnpm`** — never `npm` or `yarn`. This repo is pinned to pnpm 11.1.0; `npm install` / `yarn install` would corrupt the lockfile and miss the `pnpm.overrides` block. Applies to every command: install, audit, run, why, exec, list.
