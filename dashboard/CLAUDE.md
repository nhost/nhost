# Dashboard Development Guide

**Important**: Always load the root `CLAUDE.md` at the repository root for general monorepo conventions before working on this project.

**Design rules**: Repo-wide JS/TS rules — including the full **Dashboard (React/Next.js)** section covering TypeScript, imports, components, naming, styling, errors, testing, forms, state, and GraphQL — live in `.claude/docs/javascript-design-rules.md`. Load that first. Only dashboard workflows (commands, navigation wiring, specific helpers and references) are documented below.

This document covers commands, project layout, and dashboard-specific workflows not captured in the design-rules doc.

## Build, Lint, and Test Commands

### Core Commands

Run install and the SDK build from the repository root. The dashboard imports `@nhost/nhost-js` from its `dist/` output, and the root workspace has no `build` script.

```bash
pnpm install          # Install dependencies (use pnpm, not npm/yarn)
pnpm build:nhost-js   # Build @nhost/nhost-js before starting the dashboard
```

The remaining commands run from `dashboard/`. `pnpm dev:dashboard` from the repository root starts the same dev server as `pnpm dev`.

```bash
pnpm dev              # Start development server (port 3000)
pnpm build            # Production build (skips lint)
pnpm start            # Start production server
pnpm lint             # Run both Biome
pnpm test:typecheck       # TypeScript type checking
```

### Testing

```bash
pnpm test                    # Run lint + all vitests
pnpm test:vitest             # Run all vitests (unit/integration tests)
pnpm test:watch              # Run vitests in watch mode
vitest run <file>           # Run a single test file
vitest run --reporter=verbose src/features/orgs/guards/OrganizationGuard/OrganizationGuard.test.tsx  # Run specific test with verbose output
```

Run Vitest with `dashboard/` as the working directory so it loads
`vitest.config.mts` and resolves workspace dependencies such as `jsdom`.

In modal tests, interact with controls inside the open modal: modal layers hide outside
content with `aria-hidden`, so `screen.getByRole` cannot find background buttons.
For Radix backdrop-dismiss tests, wait one tick for its document pointer listener,
then dispatch `fireEvent.pointerDown(target, { button: 0, pointerType: 'mouse' })`
followed by `fireEvent.click(target)`: Radix defers primary-button outside dismissal
until click. Use `waitFor` for asynchronous dismissal assertions.

Route-entry tests for files under `src/pages/` belong under `src/tests/pages/` because the default Next.js page extensions treat colocated test files as routes.

### E2E Testing

```bash
pnpm e2e:local              # Run e2e tests against local environment
pnpm e2e:onboarding         # Run onboarding e2e tests
pnpm install-browsers       # Install Playwright browsers
```

### Code Generation

```bash
pnpm codegen                # Generate GraphQL types (reads from .env.local)
pnpm codegen-hasura-api     # Generate Hasura API client with Orval
pnpm format                 # Format code with Biome
```

## Project Structure

```
src/
  components/       # UI components (ui/v3, presentational)
  features/         # Feature-based modules with components/hooks/utils
  hooks/            # Shared React hooks
  pages/            # Next.js pages (file-system routing)
  providers/        # Context providers (Auth, Apollo, Nhost)
  utils/            # Utility functions
  types/            # TypeScript type definitions
  tests/            # Test utilities and mocks
  lib/              # Library code (e.g., utils.ts with cn())
  styles/           # Global styles
  gql/              # GraphQL queries/mutations
```

## Dashboard-specific conventions

These layer on top of the rules in `.claude/docs/javascript-design-rules.md`. Anything not listed here (TypeScript, imports, components, naming, styling, errors, testing, forms, state, GraphQL) follows that document.

### Navigation

A page's `getLayout` composes a shell from `components/layout/` with guards and scopes from `features/orgs/guards/`. `AppLayout` must be the root element of every organization and project page, so React keeps the shell mounted across navigation:

- Organization pages: `<AppLayout><OrganizationScope>{page}</OrganizationScope></AppLayout>`.
- Project pages: `<AppLayout><ProjectScope><ProjectStateGate>{page}</ProjectStateGate></ProjectScope></AppLayout>`. `ProjectScope` does not include the project-state gate, so every project page adds `ProjectStateGate` itself. Navigation that must stay usable while the project is paused goes between `ProjectScope` and `ProjectStateGate`. `ProjectScope` clears the TanStack Query cache and the project configuration in the Apollo cache when the user switches projects or leaves project pages (`useClearQueryCacheOnProjectChange`), so keep it the direct child of `AppLayout`; `ProjectStateGate` may remount on section navigation without clearing it.
- Project settings pages: `<AppLayout><ProjectScope><ProjectStateGate><SettingsGuard><SettingsArea>{page}</SettingsArea></SettingsGuard></ProjectStateGate></ProjectScope></AppLayout>`.
- Sections with route tabs (Database, GraphQL, …) use their area component from `features/orgs/projects/<area>/layout/<Area>Area.tsx` inside `ProjectScope`. Each area passes its route tabs to the shared `AreaLayout` (`features/orgs/projects/common/layout/AreaLayout`; new tabbed areas do the same), which composes `ProjectStateGate` below the tabs, keeping navigation available while the project is paused; do not add a second gate to these pages. Their settings pages wrap the settings content in `SettingsGuard` and `SettingsArea`.
- Pages outside an organization: `<StandaloneLayout><AuthGuard>{page}</AuthGuard></StandaloneLayout>`.

Write route-tab links and settings-tab links as explicit JSX, and select settings content with an explicit switch or conditional. Do not generate these UIs from arrays, configuration objects, `.map()`, `Object.entries()`, or generic tab builders. Parameterized tests and command-palette catalogs are exempt.

When creating a new feature page, check whether it needs to be added to:

- The `runningProjectPages` list in `projectStatePages.ts` (and `sidebarSkeletonPages` if the page has a sidebar), which `ProjectStateGate` reads via `requiresRunningProject()` / `hasSidebarSkeleton()` to show the project-state screen. They only take effect on pages that compose `ProjectStateGate`.
- `components/layout/DashboardNavigation/ProjectNavigation.tsx` or `components/layout/DashboardNavigation/OrganizationNavigation.tsx` for visible sidebar entries.
- The area's `features/orgs/projects/<area>/layout/<Area>RouteTabs.tsx` for its route tabs.
- `features/command-palette/catalog.tsx` (page names, routes, palette gates via `isHiddenFromPalette`, URL helpers) and `features/command-palette/tree.tsx` (search keywords, ids, hierarchy) so the command palette finds it. A page's palette `gate` only hides it in the command palette; it does not control sidebar entries or direct page access.

### Helpers and references

- Use `execPromiseWithErrorToast` from `@/features/orgs/utils/execPromiseWithErrorToast` for mutations / async operations that should show loading/success/error toasts. It takes a promise callback and `{ loadingMessage, successMessage, errorMessage }`.
- When using table data hooks, use `useTableSchemaQuery` if you only need column definitions or foreign key relations (no row data). Use `useTableQuery` only when you also need row data (e.g. for a data grid).
- For mutations, use `isPending` (not the deprecated `isLoading`) for status checks.
- Send metadata writes with `writeMetadata` from `@/utils/hasura-api/metadataFetch` unless the hook already switches to a `*Migration.ts` sibling for local projects; locally it also saves the change to `nhost/metadata`. Reads, reloads, and event and scheduled-event runs use `metadataOperation`.
- Reference component test: `src/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/CustomCheckEditor.test.tsx` — MSW setup, `TestWrapper` with `react-hook-form`, grouping by `describe`, async assertions with `waitFor`.
- Mock Next.js router with `vi.mock('next/router', ...)`. Do not mock components — mock responses (e.g., via MSW) instead. Mocking hooks like `useRouter` is acceptable.

### Metrics charts

Shared charting lives in `src/features/orgs/projects/common/metrics/`. Map data to `MetricSeries[]` plus `SeriesAccessors`, then render `MetricChart` (lines) or `StackedBarMetricChart` (stacked bars). Both get their interactions from `useChartInteractions`, so use it in any new chart instead of copying the logic. It wires these hooks together, so zooming or a legend change closes the pinned tooltip and a drag doesn't also pin; attach its handlers to the chart:

- `useSeriesVisibility` — legend click to isolate, ⌘/Ctrl/Shift-click to toggle a series.
- `usePinnedTooltip` — click to pin the tooltip, Escape to close; render `PinnedTooltip` / `HoverTooltipContent` from `MetricChartTooltip`.
- `useDragToZoom` — drag to select a range.

Time ranges stay per domain: `MetricsTimeRangeFilter` + `useMetricsTimeRangeUrlState` for relative ranges; billing resolves its billing-cycle ranges with `resolveBillingUsageTimeRange` in `BillingUsage/utils/`.

## Design doctor (opt-in)

The design doctor sources in `design-doctor/` are linted by default local `pnpm lint` (and `pnpm test`); only their type-check and tests are opt-in via `pnpm test:design-doctor`. Nix and CI do not include the doctor. Doctor `.mts` modules use relative `../` imports: native Node type stripping cannot resolve the application's `@/` alias, so the scoped Biome override exempts only this directory from `noRestrictedImports`. Application code still uses absolute `@/` imports. Default `pnpm lint` and the editor do not load design plugins; run `pnpm lint:design` from `dashboard/` to see all design warnings (including existing violations). `pnpm design-doctor` is the source of truth for scored findings, per-rule counts and coverage; use `--json [--out <path>]` for the versioned machine-readable report, `--markdown` for a capped summary, or `explain <rule-id>` for rule guidance. A committed, line-independent baseline marks existing violations; it is shrink-only and must never be hand-edited. `baseline update --seed <rule-id>` is permitted only for a new rule or a version/vocabulary change, not to absorb unrelated violations. Adding an `hsl(var(--x))` color token changes `no-raw-colors`' vocabulary hash (SVG paint detection) and requires re-seeding that rule. `pnpm design-doctor --check` fails on new findings, invalid suppressions, incomplete coverage, or a baselined rule whose version/vocabulary hash differs from the generated rules (including a rule removed from the manifest). Re-seed changed rules with `baseline update --seed <rule-id>`; run `baseline update` without a seed to drop removed rules. Run `pnpm design-doctor --changed --base <PR base branch> --check` for branch-scoped findings (empty changes are unscored). `pnpm design-doctor baseline update` only shrinks existing counts; `--seed <rule-id>` enrolls a new or version/vocabulary-changed rule, while `baseline move <old src/path> <new src/path>` handles undetected renames. Baseline updates require complete coverage. To suppress a design rule for the next syntax node, put a leading `// design-doctor-ignore <rule-id>: <reason>` or `/* design-doctor-ignore <rule-id>: <reason> */` before a statement, call argument, array element, JSX attribute or object property; use `{/* design-doctor-ignore <rule-id>: <reason> */}` before a JSX child. Keep the directive on its own line, with one rule id and a nonempty reason. Prefer `//` for code and `{/* */}` for JSX; JSDoc-style `/** design-doctor-ignore <rule-id>: <reason> */` (including inside JSX) and a directive on a later line of a block comment are also accepted. Stacked comments may target different rules; duplicates, malformed or unattached directives are invalid, while a valid directive covering no findings is unused. Only the first doctor directive in a block comment can apply; further ones are invalid. The report lists each suppression with its covered finding count. Use only `design-doctor-ignore <rule-id>: <reason>` for design findings; never use `biome-ignore`, `biome-ignore-all` or `biome-ignore-start` for bare `lint`, `lint/plugin` or a design rule: these categories hide design findings, so the doctor reports them as invalid, even when a different directive appears first in the same block comment. Other lint groups do not trigger this check. Coverage lists tracked VCS-ignored files without counting them as incomplete; untracked ignored scratch files do not affect completeness. The root `/logs/` ignore is anchored, so the dashboard logs feature is in scope. Warnings (such as changed generator inputs or a Biome version mismatch) go to stderr. Run `pnpm design-doctor generate` whenever tokens or shared components change (for example `tailwind.config.js`, `src/styles/globals.css`, `src/components/ui/v3/` or `design-doctor/catalog.meta.mts`) to refresh the tokens, catalog and rules. Never hand-edit `design-doctor/generated/` or `design-doctor/baseline.json`.

| Design rule | Fix guidance |
| --- | --- |
| [no-direct-radix-imports](design-doctor/docs/rules/no-direct-radix-imports.md) | Import the catalogued ui/v3 export, checking props and behavior; for unmapped names ask design instead of assuming a drop-in replacement. `react-slot` remains allowed. |
| [no-reinvented-components](design-doctor/docs/rules/no-reinvented-components.md) | Replace raw buttons, inputs, textareas, selects, tables and anchors with catalogued shared components. Check semantics and props: replacements are not necessarily drop-in. `asChild` children and specialized/dynamic inputs are exempt. |
| [no-arbitrary-values](design-doctor/docs/rules/no-arbitrary-values.md) | Replace arbitrary appearance values with declared v3 scale steps or tokens. The doctor gives exact or nearest (not exact) suggestions; layout values, arbitrary variants and direct CSS variable values pass. Arbitrary literal colors belong here, not to `no-raw-colors`. |
| [no-raw-colors](design-doctor/docs/rules/no-raw-colors.md) | Replace palette colors (`white`/`black` included) and literal SVG paint with declared tokens. `claimedByRawColors` claims just those palette classes; `no-unknown-classes` skips them and reports undeclared unprefixed color-shaped utilities with Tailwind v3 token declaration guidance. `pnpm design-doctor` offers nearest, not exact, color suggestions; define new colors in `theme.extend.colors` and their CSS variables in `src/styles/globals.css`. |
| [no-unknown-classes](design-doctor/docs/rules/no-unknown-classes.md) | Fix unsupported static base utilities or declare a real v3 color token. Doctor-side spelling suggestions are not guaranteed replacements. Fix misspelled variants with a generated v3 variant or register one with a plugin/`addVariant`; the base after a valid variant is not checked. Never add dead classes to `externalClasses` or hide false positives in the baseline. |
| [require-static-classes](design-doctor/docs/rules/require-static-classes.md) | Write complete class strings instead of gluing a template interpolation; use a finite lookup or conditional, or a CSS custom property with `w-[var(--x)]` for continuous values. On imported design components, inline unreadable values or name a same-file constant `*ClassName`/`*Class(es)` for convention scanning; helper calls and forwarded class props pass. |
| [no-inline-styles](design-doctor/docs/rules/no-inline-styles.md) | Replace ordinary inline properties with v3 classes; for dynamic lengths pass only a custom property using `style={{ '--x': value }}` and `w-[var(--x)]`. Use declared color tokens, not literal colors in custom properties. Unreadable style values and `<style>` elements are findings; `floatingStyles`, `provided.draggableProps.style` and forwarded `style` pass. |

## Tool Usage

- **Prefer the LSP tool for TypeScript/TSX symbol lookups** — finding references, definitions, hover/type info, rename impact. The LSP understands aliased imports, re-exports through barrels, and dynamic imports; grep does not.
- Use grep (`Bash`) only for non-semantic searches: file globs, text in comments or strings, config files, GraphQL/SQL, or when LSP isn't available.

## Commit Message Format

All commit messages and PR titles must follow this pattern:

`TYPE(dashboard): SUMMARY`

Where `TYPE` is:

- `feat`: mark this as a new feature
- `fix`: mark this as a bug fix
- `chore`: mark this as a maintenance task

Where `SUMMARY` is a short description of the changes.

**Examples:**

- `feat(dashboard): add user profile settings page`
- `fix(dashboard): resolve authentication redirect loop`
- `chore(dashboard): update README.md`
