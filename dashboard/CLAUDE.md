# Dashboard Development Guide

**Important**: Always load the root `CLAUDE.md` at the repository root for general monorepo conventions before working on this project.

**Design rules**: Repo-wide JS/TS rules — including the full **Dashboard (React/Next.js)** section covering TypeScript, imports, components, naming, styling, errors, testing, forms, state, and GraphQL — live in `.claude/docs/javascript-design-rules.md`. Load that first. Only dashboard workflows (commands, navigation wiring, specific helpers and references) are documented below.

This document covers commands, project layout, and dashboard-specific workflows not captured in the design-rules doc.

## Build, Lint, and Test Commands

### Core Commands

```bash
pnpm install          # Install dependencies (use pnpm, not npm/yarn)
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
vitest run --reporter=verbose src/features/orgs/layout/OrgLayout/OrganizationGuard.test.tsx  # Run specific test with verbose output
```

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
  components/       # UI components (ui/v2, ui/v3, presentational)
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

- When creating a new feature page, think if we have to add it to the `overlayPages` list in `ProjectStateGuard.tsx`.
- When creating a new feature page, add it accordingly to the `ProjectPagesComboBox` or `ProjectSettingsPagesComboBox` components.
- When creating a new feature page, add it accordingly to the `NavTree.tsx` component.

### Helpers and references

- Use `execPromiseWithErrorToast` from `@/features/orgs/utils/execPromiseWithErrorToast` for mutations / async operations that should show loading/success/error toasts. It takes a promise callback and `{ loadingMessage, successMessage, errorMessage }`.
- When using table data hooks, use `useTableSchemaQuery` if you only need column definitions or foreign key relations (no row data). Use `useTableQuery` only when you also need row data (e.g. for a data grid).
- For mutations, use `isPending` (not the deprecated `isLoading`) for status checks.
- Reference component test: `src/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/CustomCheckEditor.test.tsx` — MSW setup, `TestWrapper` with `react-hook-form`, grouping by `describe`, async assertions with `waitFor`.
- Mock Next.js router with `vi.mock('next/router', ...)`. Do not mock components — mock responses (e.g., via MSW) instead. Mocking hooks like `useRouter` is acceptable.

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
