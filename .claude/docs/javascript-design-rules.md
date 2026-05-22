# JavaScript / TypeScript Design Rules

Authoritative JS/TS rules for the entire monorepo. These rules apply to every JS/TS file across `dashboard/`, `packages/nhost-js/`, `services/functions/`, `docs/`, and `examples/`.

The document has three sections: **Repo-wide rules** apply everywhere; **Dashboard (React/Next.js)** layers on top in `dashboard/`; **SDK & Node** layers on top in `packages/nhost-js/` and `services/functions/`. Always load the relevant project's `CLAUDE.md` (e.g. `dashboard/CLAUDE.md`) for project-specific addenda that this document does not duplicate.

---

## Repo-wide rules

### Tooling

- **Package manager:** `pnpm` 11.1.0. Never `npm` or `yarn` — `settings.json` denies them.
- **Linter/formatter:** **Biome** (config in root `biome.json` and `dashboard/biome.json`). Single quotes, space indentation, import sorting.
- **Monorepo orchestration:** **Turbo** (`turbo.json`). Run tasks via `turbo run <task>`.
- **Node ≥ 22** required.

### TypeScript

- Explicit types for function parameters and return values when not obvious.
- `type` for complex/union types, `interface` for object shapes.
- `as const` for literal values.
- **No `I` prefix** on interfaces.
- Use optional chaining (`?.`) and nullish coalescing (`??`).
- Use `unknown` instead of `any` when type is unknown. No `any` unless absolutely necessary.
- Strict mode is on; respect it.

### Errors

- `try/catch` with explicit error types.
- Use `console.error` for logging errors (Biome allows `console.error`; warns on other console methods).

### Comments

- No comments unless explaining complex logic — code should be self-explanatory.
- No inline JSX comments like `{/* Section Name */}` to label sections.

---

## Dashboard (React / Next.js)

Lives in `dashboard/`. Stack: React 19, TypeScript, Next.js (file-system routing), TanStack Query, Apollo Client, Tailwind CSS, Shadcn/Radix components.

### Imports

- **Absolute imports only**, via the `@/` alias (configured in `tsconfig.json`). Example: `import Button from '@/components/ui/v3/button';`.
- **No relative imports** (`../`, `./`) — Biome enforces this.
- Group imports: React → external libraries → absolute imports → absolute type imports.
- Type-only imports use `import type { Foo } from '@/types'`.
- Imports from `@testing-library/react*` are restricted — use `@/tests/testUtils`.

### Components

- `.tsx` for React components.
- Function components with TypeScript interfaces for props.
- `React.forwardRef` for components that need ref forwarding; set `displayName`.
- Avoid `React.FC`; prefer explicit prop types.
- Arrow functions are allowed for components.
- Prefer Shadcn / `ui/v3` over `ui/v2`. Use `ui/v3` for all new features.

### Naming

- **Components:** PascalCase (`Button`, `UserProfile`).
- **Hooks:** camelCase with `use` prefix (`useAccessToken`).
- **Variables/Functions:** camelCase.
- **Constants:** SCREAMING_SNAKE_CASE for config; PascalCase for object constants.
- **Types/Interfaces:** PascalCase (no `I` prefix).
- **Files:** kebab-case for non-components, PascalCase for components.

### Styling

- Tailwind CSS with `tailwind-merge` and `clsx`.
- Use `cn()` from `@/lib/utils` for class merging: `className={cn('base-class', variant && 'variant-class', { 'bg-red-500': isError }, className)}`.
- Component variants use `class-variance-authority` (see `button.tsx`).

### Errors (dashboard-specific)

- Toast notifications for user-facing errors via `react-hot-toast`.
- Component-level error handling via `react-error-boundary`.
- For mutations / async operations that should show loading/success/error toasts, use `execPromiseWithErrorToast` from `@/features/orgs/utils/execPromiseWithErrorToast` with `{ loadingMessage, successMessage, errorMessage }`.

### Forms

- `react-hook-form` for forms.
- `zod` or `yup` for validation, via `@hookform/resolvers`.

### State

- **Server state:** TanStack Query (React Query). For mutations, use `isPending`, not the deprecated `isLoading`.
- **UI state:** local `useState` / `useReducer`.
- **Table data:** `useTableSchemaQuery` if you only need columns / FK relations; `useTableQuery` only when you also need row data.

### GraphQL

- Generated types live in `@/utils/__generated__/graphql`.
- `graphql-request` for simple queries; `@apollo/client` for complex cases.
- MSW handlers in `src/tests/msw/mocks/`.

### Navigation

When adding a new feature page, check whether it needs to be registered in each of these:

- `overlayPages` list in `ProjectStateGuard.tsx`.
- `ProjectPagesComboBox` or `ProjectSettingsPagesComboBox`.
- `NavTree.tsx`.

### Testing

- **Runner:** Vitest. Globals (`describe`, `it`, `expect`, `beforeEach`, etc.) are provided — do not import them.
- **Component testing:** React Testing Library. Use `render()` and `screen` from `@/tests/testUtils`.
- **API mocking:** MSW (Mock Service Worker). Mock responses, not components. Mocking hooks like `useRouter` is acceptable.
- **Async assertions:** `waitFor()`.
- **Next.js router:** mock with `vi.mock('next/router', ...)`.
- **Test file naming:** `*.test.tsx` or `*.spec.tsx` alongside source files.
- Reference example: `src/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/CustomCheckEditor.test.tsx` (MSW setup, `TestWrapper` with `react-hook-form`, grouping by `describe`, async assertions with `waitFor`).

### Tool usage

- **Prefer the LSP tool** for TypeScript/TSX symbol lookups (references, definitions, hover/type info, rename impact). The LSP understands aliased imports, re-exports through barrels, and dynamic imports; grep does not.
- Use grep only for non-semantic searches: file globs, text in comments/strings, config files, GraphQL/SQL.

### Commit messages

`TYPE(dashboard): SUMMARY` where `TYPE` is `feat`, `fix`, or `chore`.

Examples: `feat(dashboard): add user profile settings page`, `fix(dashboard): resolve authentication redirect loop`.

---

## SDK & Node (`packages/nhost-js/`, `services/functions/`)

### packages/nhost-js (client SDK)

- Builds to ESM, CJS, and UMD. Public API is consumed by browsers and Node — design accordingly (no Node-only APIs in exported modules).
- Maintain the existing module shape: `auth`, `storage`, `graphql`, `functions` helpers.
- Type definitions ship with the package; treat them as part of the public contract.

### services/functions (local dev runtime)

- Node.js development runtime for serverless functions. **Local dev simulation only**, not a production service.
- Uses Express + esbuild bundling + hot-reload.
- Patterns follow the project's existing `CLAUDE.md` — load it when working here.

### Generic Node rules

- Prefer top-level `await` and ES modules where the target supports it.
- Validate input at process boundaries (HTTP handlers, CLI args, env vars).
- Never log secrets — credentials, tokens, signed URLs.
