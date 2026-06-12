# TypeScript Setup

Use the repository's existing TypeScript, package manager, and lint setup. Do not
install new tooling just to follow this skill unless the user approves it.

## Strict Defaults

When a repo has no stronger convention, prefer the strictest reasonable base
config, such as `@tsconfig/strictest`, and keep these checks enabled:

| Option | Why it matters |
| --- | --- |
| `strict` | Enables the core safety checks |
| `noUncheckedIndexedAccess` | Forces guards for indexed array/object reads |
| `exactOptionalPropertyTypes` | Distinguishes absent properties from `undefined` |
| `noImplicitOverride` | Makes subclass overrides explicit |
| `noPropertyAccessFromIndexSignature` | Makes dynamic dictionary access visible |
| `useUnknownInCatchVariables` | Prevents assuming caught values are `Error` |

Project references are useful in monorepos because they make typecheck boundaries
explicit and keep generated/build-only packages separate from app packages.

## Erasable Syntax

If the repo uses strip-only transpilation or `erasableSyntaxOnly`, avoid
TypeScript constructs that require runtime emit or non-standard transforms.

Prefer:

- union types and const arrays over `enum`
- parameter properties expanded into normal assignments
- ESM modules over runtime namespaces
- type-only imports/exports where possible

Type-only namespaces may be acceptable in repos that already use them, but do
not introduce namespace-heavy organization as a default style.

## Runtime Validation

Use the repo's existing validation library. Zod is common, but the principle is
library-independent:

- external input starts as `unknown`
- parse or normalize at the boundary
- derive TypeScript types from the runtime schema
- distinguish schema input and output when transforms apply

## Better Built-in Types

`@total-typescript/ts-reset` can improve built-in types such as `JSON.parse`, but
it changes global typing. Prefer it for greenfield strict TypeScript projects,
but add it only when the repo already uses it or the user approves the change.

## Verification

Use the narrowest command that proves the changed type behavior, then broaden
when the risk warrants it.

Common commands:

```bash
npm run typecheck
npm run checkTypes
pnpm exec tsc -b --noEmit
pnpm exec tsc --noEmit
```

Use the repo's actual scripts and package manager instead of inventing new ones.
