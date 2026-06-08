# Code Style Patterns

These patterns keep TypeScript's control-flow analysis useful and make unsafe
areas easy to review.

## Promote Nullable Lookups Once

```ts
const tryRoot = document.getElementById("root");
if (!tryRoot) throw new Error("Root element not found");
const root = tryRoot;

root.dataset.ready = "true";
```

Use `tryX` for the nullable binding and `x` for the promoted value when it makes
the flow clearer. Avoid `!` unless a framework contract proves the value exists
and there is no reasonable local guard.

## Keep Narrowed Objects Intact

Do not destructure discriminated result objects before narrowing. TypeScript
tracks relationships better when the object remains whole.

```ts
const result = useRemoteResource();

if (result.status === "success") {
  renderData(result.data);
}

if (result.status === "error") {
  renderError(result.error);
}
```

Destructure when you are renaming, omitting rest props, or reading independent
primitive values. Array and tuple destructuring are still appropriate.

## Guard Indexed Access

With `noUncheckedIndexedAccess`, indexed reads are `T | undefined`. Treat that
as a useful warning, not noise.

```ts
for (const item of items) {
  consume(item);
}

for (const index in items) {
  const item = items[index];
  if (item === undefined) continue;
  consume(item);
}
```

Use `Record<KeyUnion, Value>` when every key must exist. Use
`Partial<Record<KeyUnion, Value>>` or `Map` when missing keys are valid.

## Validate Before Use

External data should arrive as `unknown`.

```ts
function readUser(input: unknown): User {
  return UserSchema.parse(input);
}

function isUserEvent(input: unknown): input is UserEvent {
  return UserEventSchema.safeParse(input).success;
}
```

Use one parser or transform at the boundary. Internal callers should consume the
validated type, not repeat casts.

## Escape Hatches

`as`, `any`, `@ts-expect-error`, and non-null assertions are review triggers.
When one is unavoidable, keep it narrow and document:

- **WHY** the type system cannot express the safe fact
- **SCOPE** of the unsafe bridge
- **SAFETY** check, runtime guard, test, or upstream issue that keeps it valid

```ts
// @ts-expect-error -- Upstream type omits the runtime-supported `signal` option.
// Scope: this one call. Safety: covered by abort-controller integration test.
client.request({ signal });
```

Prefer `@ts-expect-error` over `@ts-ignore`; the former fails when the error is
fixed. Do not use either to skip ordinary type work.

## Error Types

Give domain-independent transport, validation, and authorization failures
distinct error classes or discriminants when callers need different retry or UI
behavior. Do not classify errors by brittle message text if a typed class,
status code, schema, or discriminant is available.

```ts
class MalformedResponseError extends Error {
  override name = "MalformedResponseError";
  constructor(...args: ConstructorParameters<typeof Error>) {
    super(...args);
  }
}
```

Extract constructor parameters from the base class instead of copying overloads.

## Generated and Foreign Code

Do not hand-edit generated code to satisfy local TypeScript errors. Prefer, in
order:

1. Regenerate from the source schema or IDL.
2. Fix the generator input.
3. Add a small typed wrapper at the boundary.
4. Add a documented escape hatch with a removal condition.
