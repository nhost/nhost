# Template Literal Types

Use template literal types for string patterns that are finite, meaningful, and
worth checking at compile time.

## Good Uses

```ts
type CssUnit = "px" | "rem" | "em" | "%";
type CssValue = `${number}${CssUnit}`;

type EventName = `on${Capitalize<"click" | "focus" | "blur">}`;

type Route = "/users/:userId" | "/posts/:postId";
type RouteParam<TRoute extends string> = TRoute extends `${string}:${infer TParam}`
  ? TParam
  : never;
```

Good candidates:

- route patterns and route parameters
- event names derived from a closed event union
- i18n or feature keys generated from known segments
- units such as CSS lengths or metric labels
- namespaced storage keys

## Keep Runtime and Type Sources Aligned

Prefer deriving the type from a runtime list when the strings are also used at
runtime.

```ts
const resources = ["users", "posts"] as const;
type Resource = (typeof resources)[number];
type ApiPath = `/api/${Resource}`;
```

Do not maintain a runtime array and an unrelated template type by hand.

## Avoid Clever Opaque Types

Template literal types can become unreadable quickly. Avoid them when:

- the runtime format is open-ended
- a schema parser would communicate the constraint better
- the type expands into a huge union
- reviewers cannot tell which strings are valid without running TypeScript

For external input, template literal types are not validation. Parse the string
before trusting it.
