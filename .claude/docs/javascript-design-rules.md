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
- Use `unknown`, never `any`, when the type is unknown. Biome (`noExplicitAny`) flags every `any` — a warning repo-wide, an error in the dashboard.
- Avoid the non-null assertion `!`; use it only when you are certain the value is present at that point. Biome warns on it repo-wide, but the dashboard turns this rule off — there it's a human-judgment call, so don't rely on the linter to catch it.
- Strict mode is on; respect it.
- Use `VoidFunction` for callback types that return nothing.

### Control flow

- Prefer early returns over deeply nested conditionals.

### Errors

- The caught value in `catch` is `unknown` (strict mode) — narrow it (e.g. `err instanceof Error`) before use; you cannot annotate a catch binding with a specific error type. In the dashboard, only throw `Error` (or a subclass) — `useThrowOnlyError` enforces it.
- Logging: use `console.error` / `console.warn` / `console.info`. In the dashboard, Biome (`noConsole`) errors on any other method, including `console.log`.

### Comments

- No comments unless explaining complex logic — code should be self-explanatory.
- No inline JSX comments like `{/* Section Name */}` to label sections.

---

## Dashboard (React / Next.js)

Lives in `dashboard/`. Stack: React 19, TypeScript, Next.js (file-system routing), TanStack Query, Apollo Client, Tailwind CSS, Shadcn/Radix components.

### Imports

- Prefer the `@/` alias (configured in `tsconfig.json` — `baseUrl: "./src"`, `@/* → ./*`). Example: `import { Button } from '@/components/ui/v3/button';` (`ui/v3` components use named exports).
- **No parent-directory imports** (`../`) — Biome (`noRestrictedImports`) errors on these; use `@/` instead. Same-directory imports (`./sibling`) are allowed and used widely.
- Type-only imports use `import type { Foo } from '@/types'`.
- Imports from `@testing-library/react*` are restricted — use `@/tests/testUtils`.

### Components

- `.tsx` for React components.
- Function components with TypeScript interfaces for props.
- Accept `ref` as a regular prop (React 19) — `forwardRef` is no longer needed. Existing components still use `forwardRef` (~79 files) pending migration; don't add new ones.
- Avoid `React.FC`; use explicit prop types/interfaces.
- Components are function declarations (`function Foo() {}`). Arrow-function components exist but are rare — prefer declarations.
- Prefer Shadcn / `ui/v3` over `ui/v2`. Use `ui/v3` for all new features.

### Naming

- **Components:** PascalCase (`Button`, `UserProfile`).
- **Hooks:** camelCase with `use` prefix (`useAccessToken`).
- **Variables/Functions:** camelCase.
- **Constants:** SCREAMING_SNAKE_CASE for config; PascalCase for object constants.
- **Types/Interfaces:** PascalCase (no `I` prefix).
- **Files:** PascalCase for app/feature components (`CreateOrgFormDialog.tsx`); kebab-case for `ui/v3` Shadcn primitives (`alert-dialog.tsx`); camelCase for hooks (`useFoo.ts`) and utils (`execPromiseWithErrorToast.ts`).

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
- Validation via `@hookform/resolvers`. **New forms must use `zod`.** `yup` is legacy (~100 files) and being phased out — don't add new `yup` schemas; the goal is a single validator (`zod`).

### State

- **Server state:** TanStack Query (React Query). For mutations, use `isPending`, not the deprecated `isLoading`.
- **UI state:** local `useState` / `useReducer`.
- **Table data:** `useTableSchemaQuery` if you only need columns / FK relations; `useTableQuery` only when you also need row data.

### Effects (`useEffect`)

`useEffect` is an escape hatch for synchronizing with systems *outside* React (subscriptions, the DOM, non-React widgets, network). Before reaching for one, ask **why** the code runs:

- Can it be **computed from props/state**? Derive it during render (`useMemo` only if expensive).
- Does it run because of a **user interaction**? Put it in the event handler.
- Does it run because the component was **displayed** (or must sync with an external system)? Then an Effect is appropriate.

If none of the last applies, you don't need an Effect.

Do **not** use `useEffect` to:

- **Compute a value** from props/state — derive it during render.
- **Mirror one React state into another** — *including* state held in a custom hook, context provider, or store (Zustand). Wrapping state in a hook/context/store does not make it "external"; it's still React state. Set it where it originates (the event handler) or via the source's own subscription.
- **React to a user interaction** — put that logic in the event handler, not an effect keyed on the resulting state.

A mirroring effect re-runs on every change, leaves the target a render stale, and makes cleanup easy to get wrong.

**Example — pushing a form's dirty flag to `DialogProvider`:**

❌ effect keyed on a render value, mirroring form state → context state:

```tsx
const { setDirtySource } = useDialog();
const { isDirty } = form.formState;
useEffect(() => {
  setDirtySource(DIRTY_SOURCE_ID, isDirty);
  return () => setDirtySource(DIRTY_SOURCE_ID, false);
}, [isDirty, setDirtySource]);
```

✅ effect that *subscribes* to the form store, keyed only on stable deps:

```tsx
const { setDirtySource } = useDialog();
useEffect(() => {
  const unsubscribe = form.subscribe({
    formState: { isDirty: true },
    callback: ({ isDirty: nextIsDirty }) =>
      setDirtySource(DIRTY_SOURCE_ID, Boolean(nextIsDirty)),
  });
  return () => {
    unsubscribe();
    setDirtySource(DIRTY_SOURCE_ID, false);
  };
}, [form, setDirtySource]);
```

### GraphQL

- **Client:** `@apollo/client` is the only GraphQL client.
- **Generated code:** types and typed Apollo hooks are generated by codegen into `@/utils/__generated__/graphql`. Use the generated hooks for almost all GraphQL operations rather than hand-writing them.
- Some data fetching goes through TanStack Query (React Query) instead — see the **State** section.
- **Mocking:** MSW handlers in `src/tests/msw/mocks/` (`graphql/` and `rest/` subdirs). Mock responses, not hooks.

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
- **Test file naming:** `*.test.tsx` / `*.test.ts` alongside source files.
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
