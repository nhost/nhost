# Branded Types

Use branded types when structurally identical values must not be mixed: user IDs
vs order IDs, meters vs feet, raw strings vs validated URLs, or money in
different currencies.

## Prefer Runtime Branding

```ts
const UserIdSchema = z.string().uuid().brand("UserId");
const OrderIdSchema = z.string().uuid().brand("OrderId");

type UserId = z.infer<typeof UserIdSchema>;
type OrderId = z.infer<typeof OrderIdSchema>;

const userId = UserIdSchema.parse(input);
```

Branding should usually happen at the same boundary that validates the value.
After that, the rest of the code can accept the branded type.

## Factory Branding

If the repo uses a type utility such as `Tagged` or `Brand`, hide the cast inside
a validating factory.

```ts
type UserId = Tagged<string, "UserId">;

function createUserId(input: string): UserId {
  if (!isUuid(input)) throw new Error("Invalid user id");
  return input as UserId;
}
```

The direct cast is acceptable only inside the factory because the runtime guard
is adjacent to it.

## Avoid Direct Casts

```ts
const unsafeUserId = input as UserId;
```

This compiles even when `input` is invalid. It also makes tests and callsites
look safer than they are.

## When Not to Brand

Do not brand values just to make simple code look stricter. Avoid branding when:

- the value never crosses a meaningful boundary
- a discriminated union would model the domain better
- the runtime value cannot be validated
- the brand forces broad casts across the codebase

If most callsites need `as Brand`, the brand is in the wrong place or is not
worth carrying.
