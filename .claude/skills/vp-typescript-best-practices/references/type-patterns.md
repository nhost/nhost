# Type Patterns

Use types to constrain the places where drift is costly. Do not turn every local
variable into an annotation exercise.

## Inference vs Annotation

| Situation | Prefer |
| --- | --- |
| Local intermediate value | Inference |
| Exported function or public module API | Explicit signature |
| Object literal passed into another API | `satisfies TargetType` or `: TargetType` |
| Test fixture defaults | `const defaults: Model = {...}` |
| Runtime schema output | `z.infer<typeof Schema>` |
| Value transformed across a boundary | `z.input` / `z.output` or named boundary types |

```ts
const defaults: User = {
  id: "user-1",
  name: "Test User",
};

const routeConfig = {
  path: "/users/:userId",
  lazy: () => import("./UserPage"),
} satisfies RouteConfig;
```

## `satisfies` vs `: Type`

| Need | Use |
| --- | --- |
| Keep literal inference and validate shape | `const value = {...} satisfies Type` |
| Intentionally widen to the public contract | `const value: Type = {...}` |
| Return a typed value from a callback | Callback return annotation |
| Tighten an existing value without validation | Do not use `as`; add a guard or parser |

`satisfies` is most useful when future additions should fail compilation: route
tables, option maps, enum-like records, fixture defaults, and schema maps.

## Type Extraction

Extract from the source of truth instead of copying.

```ts
type SubmitPayload = Parameters<typeof submitUser>[0];
type SubmitResult = Awaited<ReturnType<typeof submitUser>>;
type ButtonClick = ComponentProps<typeof Button>["onClick"];
type ErrorArgs = ConstructorParameters<typeof Error>;
type Timeout = NonNullable<typeof config["timeout"]>;
```

Good extraction targets:

- generated clients and SDK functions
- schema objects and parser return values
- component props and callback props
- class constructors and built-in APIs
- existing config objects and literal maps

## Function Typing

When a function value implements a known contract, put the contract on the const
so parameters are typed from the receiving API.

```ts
const onClick: ComponentProps<typeof Button>["onClick"] = (event) => {
  trackClick(event.currentTarget);
};
```

For exported helpers with a local contract, prefer a named type or colocated
type-only namespace when the repo allows it.

```ts
namespace serializeData {
  export interface Options {
    includeEmptyFields?: boolean;
  }
}

function serializeData(value: unknown, options: serializeData.Options = {}) {
  // implementation
}
```

Use `function` declarations when hoisting, overloads, generators, or local repo
style make them clearer. The preference is contract-first typing, not banning
`function`.

## `as const`

Use `as const` when exact readonly literals are the source of truth.

```ts
const statuses = ["draft", "published", "archived"] as const;
type Status = (typeof statuses)[number];
```

Do not add `as const` to values that already have a contextual type.

```ts
const items: Array<MenuItem> = [];
items.push({ type: "button", label: "Save" });
```

`.map()` often loses contextual typing. Annotate the result or callback return.

```ts
const items: Array<MenuItem> = labels.map((label) => ({
  type: "button",
  label,
}));
```

## Array Syntax

Follow the repo's lint rule if one exists. As a portable style preference, use
generic array syntax for exported aliases, public API types, and nested arrays.

```ts
type Users = Array<User>;
type ReadonlyUsers = ReadonlyArray<User>;
type Matrix = Array<Array<number>>;
```

Local implementation code may use whichever syntax the file already uses. Do not
mix styles in one edited area without a reason.

## Object Types

Follow the repo's lint rule when it chooses `interface` or `type`. As a portable
default:

- use `interface` for object shapes intended to be extended or implemented
- use `type` for unions, tuples, mapped types, conditional types, and aliases
- avoid `{}` as a data shape; it accepts most non-nullish values

```ts
type EmptyObject = Record<string, never>;
type JsonObject = Record<string, unknown>;

function cloneObject<TObject extends Record<string, any>>(value: TObject): TObject {
  return structuredClone(value);
}
```

`any` in a generic constraint can be appropriate when the implementation does
not inspect the values. `any` in data flow is not a constraint; it is an escape
hatch.

## Generic Names

Use descriptive, `T`-prefixed generic names for public or complex APIs.

```ts
function defineSchemaMap<TSchemaMap extends Record<string, Schema>>(map: TSchemaMap): TSchemaMap {
  return map;
}
```

Good fallback names: `TConfig`, `TItem`, `TResult`, `TError`, `TSchemaMap`.
Short names such as `T`, `K`, and `V` are fine only when the meaning is obvious
from a tiny, conventional generic like `Record<K, V>` or `Array<T>`.

## Local Type Grouping

For a function with related options and return types, colocate those types near
the value. Fallback preference: use a type-only namespace when the repo permits
that style; otherwise use exported types with a shared prefix.

```ts
namespace retryOperation {
  export interface Options {
    maxAttempts: number;
  }
}

function retryOperation(options: retryOperation.Options) {
  // implementation
}
```

Never use namespaces for runtime organization in modern ESM code.
