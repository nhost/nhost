# dashboard-lint

`dashboard-lint` checks only what a branch adds to `dashboard/src`. New files are checked completely, existing files only on added or changed lines, and problems already on the base branch are never reported. It combines two sets of checks:

- Code rules, through Biome, GritQL plugins, and TypeScript checks. [LINT-RULES.md](LINT-RULES.md) lists them.
- The design doctor rules from `dashboard/design-doctor` (raw colors, arbitrary values, unknown classes, inline styles, runtime class names, reinvented components, direct Radix imports), plus `no-restyle` for `ui/v3` components.

It is not wired into CI, Nix, or the pnpm workspace; run it by hand.

## Try it

From the repository root, with Node 22 or later and the dashboard dependencies installed:

```bash
export PATH="$PWD/tools/dashboard-lint/lint/bin:$PATH"
dashboard-lint design sync
dashboard-lint --list-rules
dashboard-lint
```

It looks for the Biome version pinned in `nixops/overlays/js.nix` in the Nix store. Enter the dashboard dev shell once (`nix develop .#dashboard`) or set `DASHBOARD_LINT_BIOME=/path/to/biome`.

## Layout

| Path | Contents |
| --- | --- |
| `lint/bin/dashboard-lint` | Entry point |
| `lint/src/` | CLI, Biome runner, TypeScript checks, design rules and `no-restyle` |
| `lint/biome/` | Biome configuration template and GritQL plugins |
| `lint/test/` | Probes that replay past commits and planted violations |
| `design-doctor/` | `no-restyle` policy and documentation; `design sync` copies the design doctor from the current checkout into `design-doctor/tool/` |
| `SKILL.md` | Instructions for AI agents that use the tool |
