# AGENTS.md

This document provides guidelines for agentic coding assistants working in this repository.

## Build, Lint, and Test Commands

### Core Commands
```bash
pnpm install          # Install dependencies (use pnpm, not npm/yarn)
pnpm dev              # Start development server (port 3000)
pnpm build            # Production build (skips lint)
pnpm start            # Start production server
pnpm lint             # Run ESLint with max warnings 0
pnpm type-check       # TypeScript type checking
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
pnpm format                 # Format code with Prettier
```

### Note
Some tests have special handling: `BaseTableForm.test.tsx` is excluded from the main test run and executed separately.

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

## Code Style Guidelines

### TypeScript
- Use explicit types for function parameters and return values when not obvious
- Use `type` for complex types, `interface` for objects
- Use TypeScript's `as const` for literal values
- **DO NOT** prefix interfaces with `I` (ESLint rule: interface format must be PascalCase without `I` prefix)
- Use optional chaining (`?.`) and nullish coalescing (`??`) where appropriate
- Use `unknown` instead of `any` when type is unknown; prefer explicit types

### Imports
- Use absolute imports with `@/` alias (configured in tsconfig.json)
- Example: `import Button from '@/components/ui/v3/button';`
- **DO NOT** use relative imports like `../` or `./` (eslint rule warns)
- Group imports in this order: React → external libraries → absolute imports → absolute type imports
- Use type-only imports for types: `import type { Foo } from '@/types'`
- Use ESLint rule: `@typescript-eslint/consistent-type-imports`

### React Components
- Use `.tsx` extension for React components
- Use function components with TypeScript interfaces for props
- Use `React.forwardRef` for components that need ref forwarding
- Use `displayName` for named components (especially with forwardRef)
- Avoid `React.Fc`; prefer explicit prop types
- Arrow functions are allowed for components (airbnb rule allows `allowArrowFunctions: true`)

### Naming Conventions
- **Components**: PascalCase (`Button`, `UserProfile`)
- **Hooks**: camelCase with `use` prefix (`useAccessToken`, `usePreviousData`)
- **Variables/Functions**: camelCase (`isLoading`, `handleSubmit`)
- **Constants**: SCREAMING_SNAKE_CASE for config constants, PascalCase for object constants
- **Types/Interfaces**: PascalCase (no `I` prefix)
- **Files**: kebab-case for non-components, PascalCase for components

### CSS and Styling
- Use Tailwind CSS classes (configured with `tailwind-merge` and `clsx`)
- Use `cn()` utility from `@/lib/utils` for class merging
- Example: `className={cn('base-class', variant && 'variant-class', className)}`
- Component variants use `class-variance-authority` (see `button.tsx`)

### Error Handling
- Use `try/catch` with explicit error types
- Use `console.error` for logging errors (ESLint allows `console.error`, warns on other console methods)
- Use toast notifications for user-facing errors (`react-hot-toast`)
- Wrap async operations with error boundaries where appropriate
- Use `react-error-boundary` for component-level error handling

### Testing
- Use Vitest as the test runner
- Use React Testing Library for component testing
- Use MSW (Mock Service Worker) for API mocking
- Test files: `*.test.tsx` or `*.spec.tsx` alongside source files
- Use `render()` and `screen` from `@/tests/testUtils`
- Use `waitFor()` for async assertions
- Mock Next.js router with `vi.mock('next/router', ...)`
- Set `process.env` values before tests if needed

### Form Handling
- Use `react-hook-form` for forms
- Use `zod` or `yup` for validation
- Use `@hookform/resolvers` for schema validation

### State Management
- Use Recoil for global state (Recoil atoms/selectors)
- Use TanStack Query (React Query) for server state
- Use local state with `useState`/`useReducer` for UI state

### GraphQL
- Generated types in `@/utils/__generated__/graphql`
- Use `graphql-request` for simple queries
- Use `@apollo/client` for complex cases
- MSW handlers in `src/tests/msw/mocks/`

### Miscellaneous
- Use strict mode (configured in tsconfig.json)
- No `any` type unless absolutely necessary
- Use `VoidFunction` for callback types
- Curly braces required for all control statements (ESLint `curly: ['error', 'all']`)
- Prefer early returns over nested conditionals
- No comments unless explaining complex logic (code should be self-documenting)

## Linting and Formatting

- **ESLint**: Extends `next`, `airbnb`, `airbnb-typescript`, `airbnb/hooks`, `prettier`
- **Prettier**: Single quotes, trailing commas, 2-space indent, 80 print width
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
- `chore(dashboard): update dependencies`
