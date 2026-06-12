# Union Types and Exhaustive Handling

Use unions when a value can be one of a known set of states, events, commands, or
result shapes. Make future variants fail loudly at compile time.

## Discriminated Unions

```ts
type Result<TData, TError> =
  | { status: "success"; data: TData }
  | { status: "error"; error: TError }
  | { status: "loading" };

function renderResult(result: Result<User, Error>) {
  switch (result.status) {
    case "success":
      return renderUser(result.data);
    case "error":
      return renderError(result.error);
    case "loading":
      return renderSpinner();
    default:
      result satisfies never;
      throw new Error(`Unhandled result: ${String(result)}`);
  }
}
```

Good discriminator names are `type`, `kind`, `status`, and `state`. Keep
discriminator values readable string literals.

## When to Add Exhaustive Checks

| Scenario | Add check? |
| --- | --- |
| `switch` over a union discriminant | Yes |
| `if` / `else if` handles every `typeof` or `instanceof` case | Yes |
| Intentional no-op variants are listed | Yes |
| `Record<Union, Value>` declaration | Already checked by the record |
| Early filter such as `if (x !== "foo") return` | No, it is not handling every case |
| Open-ended strings from user or network input | Validate first, then exhaust over the parsed union |

## Negative Branch Certainty

Use an IIFE in expressions when only the remaining branch should be possible.

```ts
const teamId =
  referrer.type === "team" || referrer.type === "user-in-team"
    ? referrer.teamId
    : (() => {
        referrer.type satisfies "user";
        return null;
      })();
```

If a new referrer variant is added, the negative branch must be revisited.

## Intentional No-op Cases

List no-op cases explicitly. Do not hide them in `default`.

```ts
switch (event.type) {
  case "created":
    syncCreated(event);
    return;
  case "updated":
    syncUpdated(event);
    return;
  case "heartbeat":
  case "presence":
    return;
  default:
    event satisfies never;
    throw new Error("Unhandled event");
}
```

## Record Coverage

When every union member maps to a value, a record is often simpler than a switch.

```ts
const labelByStatus: Record<Status, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};
```

Use `satisfies Record<Status, Value>` when you want to preserve literal values.

```ts
const colorByStatus = {
  draft: "gray",
  published: "green",
  archived: "red",
} satisfies Record<Status, string>;
```

## Runtime Boundaries

Do not exhaust over raw strings from network, storage, or user input. Parse them
into a closed union first.

```ts
const StatusSchema = z.enum(["draft", "published", "archived"]);
type Status = z.infer<typeof StatusSchema>;

const status = StatusSchema.parse(input);
```
