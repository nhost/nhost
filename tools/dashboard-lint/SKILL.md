---
name: dashboard-lint
description: Lint the code a branch adds to the Nhost dashboard (dashboard/src) against the team's review rules. Use after editing dashboard TypeScript or TSX and before committing.
---

# dashboard-lint

`dashboard-lint` checks only what the current change adds. New files are checked completely. Existing files are checked only on added or changed lines. Problems that already exist on the base branch are never reported, and you must not fix them unless the task asks for it.

## Run it

From any worktree of the nhost repository:

```bash
dashboard-lint                 # working tree vs origin/main
dashboard-lint --format json   # for parsing
dashboard-lint --list-rules    # every rule with its fix hint
```

Exit code 0 means no findings in new code, 1 means findings, and 2 means a usage or environment error. The error output includes a hint.

It also checks design-system rules (rule ids `design/<rule>`): raw palette colors, arbitrary values, unknown Tailwind classes, inline styles, class names built at runtime, raw elements that a `ui/v3` component replaces, direct Radix imports, and restyled `ui/v3` components (`design/no-restyle`: on a `ui/v3` component, `className` may only place it, with margin, width, position and similar layout classes; padding, gap, color, typography, borders, radius, shadows and transitions come from its `variant` and `size` props). A finding is new when the change adds more of the same rule and subject (for example `no-raw-colors` / `text-white`) than it removes, so reordering classes or moving code into a new file reports nothing. Messages name the nearest theme token, or the component's variants and sizes. If no variant fits, say so in your summary instead of restyling; add a variant to the component only when the design explicitly calls for it. Details: `dashboard-lint design explain <rule>`.

Before writing dashboard UI, look up what already exists instead of reinventing it. Search, do not print whole:

```bash
dashboard-lint design catalog | grep -i -E 'dialog|table'   # components, import paths, what they replace
dashboard-lint design tokens | grep -i -E 'muted|border'      # theme colors, spacing, radii, text sizes
```

## Act on the result

- Fix every finding before you commit or report the work as done. Each finding names the rule, the line, and a `fix:` hint.
- Rerun `dashboard-lint` until it exits 0, and put the final command and its result in your summary.
- If you believe a finding is wrong, do not work around it and do not add suppression comments (`design-doctor-ignore` comments are reported as findings). Leave the code as it is, and report the finding with your reasoning in your final summary.

## What it does not replace

It does not replace the repository's own checks (`pnpm test`, Biome, typecheck) or verifying the change in the running app. Run those as well.
