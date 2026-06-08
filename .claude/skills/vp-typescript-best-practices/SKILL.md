---
name: vp-typescript-best-practices
description: >-
  Use when writing, reviewing, or refactoring TypeScript in .ts, .tsx, or
  .test-d.ts files; fixing TS errors; designing types; validating external data;
  reducing unsafe assertions; or choosing between inference, annotations,
  satisfies, generics, unions, Zod schemas, and type-level tests.
---

# TypeScript Best Practices

High safety per line of TypeScript. Follow the repository's documented style,
tsconfig, lint rules, and generated-code workflow first; use these guidelines as
portable defaults when the repo does not already decide.

## Fallback Style Preferences

Use these only when the repository has no conflicting convention:

- Prefer `Array<T>` / `ReadonlyArray<T>` over `T[]` / `readonly T[]` for visible
  aliases and public types.
- Prefer `interface` for extensible object shapes; prefer `type` for unions,
  tuples, mapped types, conditional types, and aliases.
- Prefer type-only namespaces to colocate a function's `Options`, `Result`, and
  overload contracts when the repo already permits namespaces.
- Prefer descriptive, `T`-prefixed generic names for public or complex APIs, such
  as `TConfig` and `TItem`; reserve `T`, `K`, and `V` for tiny conventional
  helpers.
- Treat acronyms as words in identifiers: `userId`, `ApiClient`, `HttpError`.

## Key Items

- **Prefer inference until a boundary needs a contract.** Let local variables and
  implementation details infer naturally; annotate exported APIs, callbacks,
  config objects, test fixtures, runtime boundaries, and values passed directly
  into another API.
- **Type entrypoints from the consumer contract.** Use
  `ComponentProps<typeof Button>["onClick"]`, `Parameters<typeof fn>[0]`,
  `ReturnType<typeof hook>`, or a public `Options` type instead of retyping the
  same structure by hand.
- **Use `satisfies` as a review anchor.** It validates object shape while keeping
  useful literal types. Use it where future schema, union, or config drift should
  fail at compile time.
- **Avoid `as` and `!` by default.** Prefer annotations, `satisfies`, control-flow
  narrowing, runtime validation, and explicit null checks. If an escape hatch is
  unavoidable, keep it local and document why it is safe.
- **Validate external data at runtime.** Network responses, storage, environment
  variables, messages, user input, and bridge APIs enter as `unknown`; parse or
  normalize once, then derive TypeScript types from that runtime schema.
- **Keep transform boundaries single-sourced.** If multiple callers must normalize
  the same wire shape, extract one shared transform or parser instead of copying
  conversion logic.
- **Preserve TypeScript narrowing.** Keep discriminated objects intact when the
  relationship between flags and data matters. Promote nullable lookups once with
  a guard instead of scattering non-null assertions.
- **Guard indexed access.** Treat `array[index]`, dictionary lookups, and dynamic
  keys as possibly missing unless the type system proves otherwise. Prefer
  value-driven iteration when the index is not needed.
- **Make unions exhaustive.** Branch on discriminants with `switch` or explicit
  guards, then use `satisfies never` so new variants break the build.
- **Extract, do not redefine.** Reuse types from schemas, generated clients,
  library APIs, class constructors, and existing values. Manual copies drift.
- **Keep literal lists as runtime data.** Prefer `as const` arrays or schemas plus
  derived union types over TypeScript `enum` when the repo uses strip-only or
  erasable syntax tooling.
- **Type-test complex types.** Use colocated `*.test-d.ts` files for generics,
  schema compatibility, overloads, and intentional negative cases.
- **Respect generated and third-party boundaries.** Regenerate generated code or
  wrap third-party gaps locally. Do not spread one local workaround across the
  application.

## Quick Reference

| Goal | Preferred pattern | Avoid |
| --- | --- | --- |
| Callback or prop type | `ComponentProps<typeof X>["onY"]` | Rewritten event types |
| Config object | `const value = {...} satisfies Options` | `as Options` |
| Runtime input | Schema parse, type guard, normalization function | `input as Model` |
| Nullable lookup | `const tryX = find(); if (!tryX) throw ...; const x = tryX` | `find()!` |
| Array/dictionary lookup | Guard `undefined`, use `for...of` when possible | `items[i]!` |
| Union handling | Discriminant `switch` + `value satisfies never` | Silent default branch |
| Error subclass args | `ConstructorParameters<typeof Error>` | Copying constructor overloads |
| Generated client types | `Parameters`, `ReturnType`, indexed access | Handwritten copies |
| Type-only regression | `*.test-d.ts` + `satisfies` | Runtime tests for pure types |
| Escape hatch | Local cast with WHY/SCOPE/SAFETY comment | Repo-wide `any` plumbing |
| Public array aliases | `Array<TItem>` / `ReadonlyArray<TItem>` | Mixed syntax without repo reason |
| Public generic names | `TConfig`, `TItem`, `TResult` | Cryptic names in large APIs |

## Core Patterns

### Consumer Contract Typing

```ts
const onSelect: ComponentProps<typeof Select>["onChange"] = (value) => {
  updateSelection(value);
};

const payload: Parameters<typeof submitUser>[0] = {
  id: user.id,
  name: user.name,
};
```

Use this when the variable exists mainly to feed another API. The type error
then appears where the value is created, not later at the callsite.

### Runtime Boundary Validation

```ts
const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
});

type User = z.infer<typeof UserSchema>;

function parseUser(input: unknown): User {
  return UserSchema.parse(input);
}
```

One runtime source of truth is safer than a handwritten `User` plus a separate
validator. When transforms apply, use `z.input` and `z.output` only to make that
boundary explicit.

### Exhaustive Branching

```ts
function labelStatus(status: Status): string {
  switch (status.kind) {
    case "loading":
      return "Loading";
    case "success":
      return "Done";
    case "error":
      return status.message;
    default:
      status satisfies never;
      throw new Error(`Unhandled status: ${String(status)}`);
  }
}
```

`satisfies never` is compile-time only. Throw or return deliberately when runtime
continuation would be unsafe.

## Common Mistakes

| Mistake | Better move |
| --- | --- |
| Adding types everywhere before reading the local style | Follow repo config, then annotate only useful boundaries |
| Using `as const` to compensate for missing shape validation | Add `satisfies TargetType` or contextual typing |
| Casting API data because "the backend returns this" | Parse the data or derive the type from the generated/schema source |
| Destructuring discriminated query/result objects too early | Keep the object intact until after narrowing |
| Silencing a third-party typing issue with a broad helper | Wrap the smallest bridge and document the safety argument |
| Adding `enum` in a strip-only toolchain | Use a runtime list/schema and derive the union type |
| Duplicating a generated client's request or response type | Extract from the generated function, schema, or model |

## References

- **[references/type-patterns.md](references/type-patterns.md)** - inference,
  annotations, `satisfies`, type extraction, generics, and local type grouping.
- **[references/code-style.md](references/code-style.md)** - safe lookups,
  narrowing, indexed access, assertions, and escape-hatch hygiene.
- **[references/union-exhaustive.md](references/union-exhaustive.md)** -
  discriminated unions, exhaustive checks, intentional no-op cases, and
  `Record<Union, Value>` coverage.
- **[references/type-testing.md](references/type-testing.md)** - `*.test-d.ts`
  patterns, bidirectional `satisfies`, and negative type tests.
- **[references/setup.md](references/setup.md)** - strict tsconfig defaults,
  project references, erasable syntax, and verification commands.
- **[references/branded-types.md](references/branded-types.md)** - nominal IDs,
  units, validated strings, and safe branding factories.
- **[references/template-literals.md](references/template-literals.md)** -
  string pattern types for routes, events, keys, and constrained values.
