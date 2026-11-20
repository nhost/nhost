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

### Native support

- Platform support lives in `features/support/`, with `/support` (queues), `/support/ticket` (new ticket), and `/support/tickets/[ticketId]` (conversation). Pages share `getSupportLayout` and stay outside project-state gates so paused projects can still receive help.
- Operations in `gql/support/` use the console-next `support` schema's camel-cased API and generated types from `@/generated/graphql`. Use the native Nhost client with a per-request `user` / `support_agent` role, never a shared role override or admin secret.
- Support queries are scoped by native user ID and role, discard inactive data, and hide stale results after errors. Ticket status, assignment, and severity controls require the `support_agent` allowed role, and their requests must pass `x-hasura-role: support_agent`; customers can view and reply but cannot update ticket fields. Create tickets and load organizations as `user`, including for agents. Membership, attribution, transitions, and closed-state rules are enforced by the backend, not the UI.
- Severity entitlements come from `organization.plan.supportAllowedSeverities`, for both creation (`user`) and ticket changes (`support_agent`). Keep all levels visible, disabling disallowed ones. Missing/empty entitlements fail closed. Reset invalid new-ticket choices when organization/plan data changes; do not rewrite existing ticket severity or block unrelated status/assignment/reply actions. Defaults start at `low` or the first permitted level; the backend rechecks the current plan.
- Descriptions and replies use `SupportMarkdownEditor` and `SupportMarkdown` (react-markdown + remark-gfm). Keep raw HTML, embedded images, and dangerous URL schemes disabled; never use MDX or raw HTML for untrusted ticket content.
- `TicketAttachments` lists completed attachments in stable 100-row pages. Both ticket/draft `attachments` relationships read reservations directly: always filter `discardedAt IS NULL`, `file.bucketId = support_tickets_attachments`, and `file.isUploaded = true`. There is no completed-attachments view. Reserve each upload ID through `insertSupportAttachmentUpload`, then use native Storage's private `support_tickets_attachments` bucket with that ID and the same actor role. Files are 1–5,000,000 bytes each; retry with fresh IDs and retain per-file successes. Uploads are ticket-level, independent of replies/workflow. Closed tickets allow downloads only. Use authenticated, no-store downloads and save blobs as octet-stream; never embed blobs, generate signed/public URLs, replace files, or delete files as a client.
- New-ticket attachments use `useSupportAttachmentDraft` and `DraftAttachments`. Draft creation, draft reservations, Storage reads/writes, and ticket insertion must all use `user`, even for agents. Keep title/body in the form. Fetch every 100-row page of retained reservations and completed files; discard failed/unwanted reservations before submission or fresh-ID retries. Recover completed uploads after lost responses. Publishing via `attachmentDraftID` transfers all reservations directly to the ticket and deletes the draft; discarded reservations remain hidden tombstones. Recover submissions by querying tickets with that immutable, unique token, not a removed draft/ticket relationship. A missing draft plus an empty ticket lookup is ambiguous under lost access: retain the token and block replacement/clearing until confirmed. Never create a replacement draft/ticket for an uncertain submission. Drafts are immutable, with no age expiry or cancellation API. Organization changes require discarding all retained reservations and confirming the draft is still unsubmitted and empty; never retarget it. Uncertain submissions must keep the original token rather than clearing/replacing the draft. New-ticket state is keyed by native user ID. Clearing reservations does not delete the immutable draft or bytes, and leaving/reloading the form does not restore its draft.
- The old Zendesk API route and credentials are retired. See the support section in `README.md` for deployment prerequisites and limitations.

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
