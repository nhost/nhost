# Type Testing

Use `*.test-d.ts` files for type-level behavior that should fail or pass under
`tsc --noEmit`. Keep them colocated with the type or helper under test.

## Equality by Bidirectional `satisfies`

```ts
// file: infer-user.test-d.ts
const anyValue: any = {};

(() => {
  type Expected = {
    id: string;
    name: string;
  };
  type Result = InferUser<typeof UserSchema>;

  anyValue as Result satisfies Expected;
  anyValue as Expected satisfies Result;
})();
```

The two checks catch both missing fields and extra required fields.

## Negative Cases

Use `@ts-expect-error` when invalid usage must remain invalid.

```ts
navigate("/users/123");

// @ts-expect-error -- Unknown route should be rejected.
navigate("/missing");

// @ts-expect-error -- Route parameters must be strings.
navigate({ path: "/users/123" });
```

If the line stops producing an error, TypeScript reports an unused directive and
the regression is caught.

## Compatibility Checks

For schema or generated-client compatibility, test both directions when the
types should be identical.

```ts
(() => {
  type SchemaUser = z.infer<typeof UserSchema>;
  type ClientUser = Awaited<ReturnType<typeof client.getUser>>;

  anyValue as SchemaUser satisfies ClientUser;
  anyValue as ClientUser satisfies SchemaUser;
})();
```

If one side is intentionally wider, test only the intended direction and document
why.

## Practices

- Wrap each case in an IIFE to avoid name collisions.
- Keep examples small; type tests are documentation.
- Prefer direct `satisfies` checks over runtime assertion libraries for pure
  type behavior.
- Include edge cases: empty input, optional properties, unions, readonly arrays,
  and transformed schema input/output.
- Run the repository's normal typecheck command after editing type tests.
