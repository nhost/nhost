# Dashboard lint rules

Each rule targets a review comment that comes up repeatedly, and its message names the fix.

## Usage

```bash
dashboard-lint                       # working tree vs origin/main
dashboard-lint --format json
dashboard-lint --commit <sha>        # lint what one commit added
dashboard-lint --base <ref> --head <ref>
dashboard-lint --scope all           # audit the whole codebase, ignoring the diff
dashboard-lint --list-rules
```

Exit code 0 means no findings, 1 means findings, and 2 means a usage or environment error.

## Only new code

- `--scope lines` is the default. New files are checked completely. Existing files are checked only on lines the change adds or modifies, taken from `git diff -U0 -M` against the merge-base.
- Base: `origin/main`, or the ref given with `--base`. The merge-base is used, so a branch is judged only on its own additions.
- Findings outside added lines are counted as "pre-existing, ignored" and never block.
- Whole-file rules use a "did this change cause it" test:
  - `max-file-lines` fires only when the file was at or under 500 lines on the base.
  - `main-file-default-export` and `folder-needs-index` fire only for new files.
- A finding whose range spans an edited line counts as new. For example, editing the body of an old effect that only sets state reports that effect.
- No suppression comments. The only exception is that lines already on the base branch are never checked.

## How it runs

- **Biome** (the version pinned in `nixops/overlays/js.nix`) lints copies of the changed files in a temporary folder, so the repository's own `biome.json` never applies.
- **TypeScript checks** use the worktree's `dashboard/node_modules/typescript`. They read files from the working tree, or from Git objects in `--commit` mode, and use `git grep` for cross-file checks.
- **Design rules** run the design doctor's Biome plugins. See [Design rules](#design-rules).
- Nothing is written to the worktree.

## Rules

| Rule | Engine | Checks |
| --- | --- | --- |
| `it-not-test` | Biome `useConsistentTestIt`, tests in `src` only (Playwright e2e is not linted) | Use `it`, not `test`, in Vitest tests. |
| `no-nested-ternary` | Biome `noNestedTernary` | Do not nest ternary expressions. |
| `no-conditional-expect` | Biome `noConditionalExpect` | No `expect` inside `if`, a ternary, `&&`, or `catch` in tests. |
| `no-fire-event` | GritQL plugin, tests | Use `TestUserEvent` instead of `fireEvent`. |
| `no-query-selector-in-tests` | GritQL plugin, tests | Query elements the way a user finds them, not with `querySelector`. |
| `no-jsx-comments` | GritQL plugin | Do not label JSX with comments. |
| `no-vitest-imports` | TypeScript, value imports only (`import type` is allowed) | Vitest globals are enabled; do not import `describe`, `it`, `expect`, `vi`, or hooks. |
| `import-folder-not-file` | TypeScript, skips `index.ts` | Import a module through its folder: `@/…/X` from outside it, `./X` from inside it. |
| `effect-only-sets-state` | TypeScript, only setters from `useState` in the same file | An effect that only copies a value into state. |
| `function-declarations` | TypeScript, top-level arrow and function expressions; `components/ui/v3` is exempt; tests included | Use a function declaration for top-level functions and components. |
| `types-folder-only-types` | TypeScript | Files in a `types/` folder only declare types. |
| `feature-boundaries` | TypeScript | A project feature (`projects/<A>`) imports only from itself, `common`, or `hooks`. |
| `index-reexport-shape` | TypeScript | `index.ts` re-exports with relative paths and named defaults, never an unnamed `export { default }`. |
| `main-file-default-export` | TypeScript, new files | A new `Foo/Foo.ts(x)` has a default export named `Foo`. |
| `folder-needs-index` | TypeScript, new files | A new `Foo/Foo.ts(x)` needs `Foo/index.ts` with `export { default as Foo } from './Foo'`. |
| `barrel-exports-used-outside` | TypeScript and `git grep`, named re-exports only (`export *` is skipped) | `index.ts` exports only what code outside the folder imports. |
| `max-file-lines` | TypeScript, test files exempt | A source file grows past 500 lines. |
| `design` | Design doctor | The design rules below. |

## Design rules

The design doctor (`dashboard/design-doctor`, with policies ported from shadcn-ui/lint, MIT) runs as one more engine: rule id `design`, findings `design/<rule>`.

| Rule | Checks |
| --- | --- |
| `no-raw-colors` | Palette colors (`white` and `black` included) and literal SVG colors instead of theme tokens. |
| `no-arbitrary-values` | Arbitrary appearance values such as `rounded-[2px]`. Layout values pass. |
| `no-unknown-classes` | Classes and variants that Tailwind 3 cannot generate. |
| `no-inline-styles` | Inline `style` properties and `<style>` elements. Dynamic values go through CSS custom properties. |
| `require-static-classes` | Class names glued together at runtime, such as `text-${size}`. |
| `no-reinvented-components` | Raw buttons, inputs, textareas, selects, tables, and anchors that a shared component replaces. |
| `no-direct-radix-imports` | Radix imports outside `ui/v3`. Import the `ui/v3` export instead. |
| `no-restyle` | Appearance classes on `ui/v3` components. See [no-restyle](#no-restyle). |
| `no-ignore-comments` | Added `design-doctor-ignore` comments. The finding they try to hide is still reported. |

- **Tool.** `dashboard-lint design sync [--repo <checkout>] [--ref <branch|commit>]` copies `dashboard/design-doctor/` (without its tests) from the current checkout into `design-doctor/tool/` and records the commit in `design-doctor/pinned.json`. Rerun it after the design doctor changes.
- **Vocabulary per commit.** The rules depend on the theme (`tailwind.config.js`, `src/styles/*.css`), the `ui/v3` components, and the `components/{form,common,presentational}` barrels and the files they export. The design doctor's own `generate` builds the plugins, tokens, and catalog from those, in a temporary mirror of the worktree (or a throwaway checkout for a commit) with the worktree's `node_modules`. Results are cached in `cache/design-doctor/vocab/<id>/` and reused only when every input recorded in `generated/index.json` still has the same hash and no new file appeared in the folders it lists. Up to 20 entries are kept.
- **Only new findings, by count.** Each changed file is linted twice with only the design plugins: its merge-base version with the merge-base vocabulary, and its head version with the head vocabulary. Counts per rule and subject (for example `no-raw-colors` / `text-white`) are netted across all changed files, and extras are reported in files whose count went up, preferring added lines. Reordering or reformatting classes, and moving code into a new file, report nothing.
- **Suggestions.** New raw colors, arbitrary values, and unknown classes get the nearest token or class (`dark:bg-[#2f363d]` → nearest `dark:bg-border`).
- **Agent reference.** `dashboard-lint design catalog` (components, import paths, what they replace) and `dashboard-lint design tokens` print the generated files for the current worktree.
- **Biome version.** The plugins target the Biome version in the tool's `manifest.json`. A different Biome is a usage error, and a Biome run without a report is inconclusive (exit 2).

### no-restyle

Ported from shadcn-ui/lint `no-restyle` (MIT) into `lint/src/restyle/`, so `design sync` never overwrites it. Documentation: `design-doctor/no-restyle.md` (`dashboard-lint design explain no-restyle`). Policy: `design-doctor/restyle.json`.

- **Policy.** Layout only, on every `ui/v3` export except icons, as in shadcn-lint's default. On a `ui/v3` component, `className` may only place it, with margin, width, position, and similar layout classes. Padding, gap, color, typography, borders, radius, shadows, and transitions come from its `variant` and `size` props. Contracts can be added to `restyle.json` with shadcn-lint's syntax (`allow`, `deny`, `contracts: [{ pattern, allow, deny }]`), where entries are categories, tailwind-merge groups, or `*` patterns.
- **Classification.** By what the class does in this dashboard: the CSS properties the dashboard's Tailwind 3 configuration generates. Pinned to shadcn's category where CSS misleads: `sr-only` is layout, `space-*` is spacing, `ring-*` widths are shape, and `*-opacity-*` is color. Classes Tailwind cannot generate fall back to tailwind-merge's class group with shadcn-lint's group-to-category table. The dashboard's custom `text-sm+` is typography, although tailwind-merge alone files it under text color.
- **Sites.** Named, aliased, default, and namespace imports; literals, static parts of templates, `cn`/`clsx`/`cx`/`twMerge`/`twJoin`/`classNames`, conditionals, `&&`/`||`/`??`, arrays, clsx object keys, and same-file constants. With Radix `asChild`, the child element's classes count against the component. Wrappers that forward `className` are not followed.
- **Messages** are shadcn-lint's, with the component's `variant` and `size` values from the design doctor's catalog: `"p-4" is not allowed on <Button>: <Button> owns its spacing. Use a size (xs, sm, md, lg, inline, icon-xs, icon-sm, icon), or margin here or gap on the parent for space around it. Add a size in dashboard/src/components/ui/v3/button.tsx only if the design explicitly calls for one.`
- **Counting** follows the design rules: subject `<Component> <class>`, netted against the merge-base across the changed files.

## Review checklist (not linted)

- Assert what the user sees, not mocks or third-party code.
- No guards that can't fail.
- Validate before a mutation, not inside it.
- No unnecessary `useMemo`.
- Keep `it.each` simple, with no branching in the test body.
- Tests cover our code, not external dependencies.
