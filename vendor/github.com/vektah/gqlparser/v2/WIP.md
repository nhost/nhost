# SDL Validation Gaps: graphql-js vs gqlparser `ValidateSchemaDocument`

## Architectural context

Two facts apply throughout this analysis.

**Fail-fast vs. accumulate.** gqlparser returns on the first error encountered; graphql-js collects and reports all errors in one pass. A schema with multiple violations will always surface only one error in gqlparser.

**Isolated validation.** graphql-js SDL rules receive a `SDLValidationContext` carrying a pre-existing schema object, enabling checks like "this type already exists in the schema you're extending." gqlparser validates a single `SchemaDocument` in isolation. Checks that require pre-existing schema context are not gaps — they are an architectural difference.

---

## Unintentional gaps

### `UniqueArgumentDefinitionNames` — missing entirely

`validateArgs` (`schema.go:432`) checks that argument names don't begin with `__`, that referenced types exist, and that argument directives are valid. It never checks for duplicate argument names within the same list. Both field arguments and directive arguments are unprotected:

```graphql
type Query {
  field(id: ID, id: String): Boolean
}
```

graphql-js rejects with:
> `Argument "Query.field(id:)" can only be defined once.`

`schema_test.yml` has no case for this.

---

### `UniqueOperationTypes` — silent overwrite in three distinct cases

graphql-js rejects any attempt to specify the same operation type more than once. gqlparser silently overwrites with the last value in all three scenarios.

**Case A — duplicate within one `schema {}` block:**

```graphql
schema { query: A  query: B }
```

The loop at `schema.go:124` processes both entries and assigns `schema.Query` twice. Last writer wins, no error. `schema_test.yml`'s "multiple schema entry points" test only covers two separate `schema {}` blocks, not two operations within one block.

**Case B — two `extend schema` blocks both specifying the same operation:**

```graphql
schema { query: Query }
extend schema { mutation: Mut }
extend schema { mutation: OtherMut }
```

The loop at `schema.go:155` overwrites `schema.Mutation` on the second extension. No error.

**Case C — `extend schema` re-specifying an operation from the base `schema {}` block:**

```graphql
schema { query: Query }
extend schema { query: Other }
```

`schema.Query` ends up pointing at `Other`. graphql-js rejects with:
> `Type for query already defined in the schema. It cannot be redefined.`

---

## Intentional divergences

### `PossibleTypeExtensions` — allows extensions of undefined types

When an extension references a type that doesn't exist, gqlparser creates a synthetic `Definition` for it (`schema.go:41–48`) and continues. graphql-js rejects with:
> `Cannot extend type "X" because it is not defined.`

This is **intentional**: `schema_test.yml` has an explicit test case "can extend non existant types" asserting no error. The practical use case is federation-style schemas where types are extended without a local base definition.

The consequence worth noting: the resulting ghost type does pass through `validateDefinition`. If the extension body provides at least one field and all types referenced in it exist, the ghost type becomes a valid Object type in the compiled schema. A typo in an extension's type name therefore produces a new, unexpected type rather than an error.

---

### `UniqueDirectiveNames` — builtin redeclaration silently accepted

For non-builtin directives, gqlparser correctly returns an error (`schema.go:107`), tested by `schema_test.yml`'s "cannot redeclare directives" case. For the six builtins — `include`, `skip`, `deprecated`, `specifiedBy`, `defer`, `oneOf` — a redeclaration is silently accepted with the first definition kept. `schema_test.yml` has an explicit "can redeclare builtin directives" test asserting this.

graphql-js rejects any directive redefinition, including builtins:
> `Directive "@skip" already exists in the schema. It cannot be redefined.`

The rationale is documented at `schema.go:95`: servers may ship directive definitions from an older or divergent spec version, and validating definition equivalence is considered more work than it's worth. The practical consequence is that a schema with a conflicting `@deprecated` or `@skip` definition loads without error.

---

## Confirmed covered

**`UniqueTypeNames`** — the first-pass map insertion at `schema.go:30–34` catches any type defined more than once in the document, returning `"Cannot redeclare type X."` Tested by `schema_test.yml`.

**`UniqueFieldDefinitionNames`** — field merging (`schema.go:63`) is followed by an O(n²) pair-scan at `schema.go:386–397`, catching duplicates within a definition, across definition + extension, and across multiple extensions. Tested by three cases in `schema_test.yml`.

**`UniqueEnumValueNames`** — enum value merging (`schema.go:65`) is followed by an O(n²) pair-scan at `schema.go:399–410`, mirroring the field check, catching duplicates within a definition and across extensions, returning `"Enum value X.Y can only be defined once."` Tested by two cases in `schema_test.yml` (same definition and across an extension).

**`UniqueDirectivesPerLocation` (SDL)** — `validateDirectives` (`schema.go:468`) tracks seen directive names per call and rejects a repeated non-repeatable directive with `"The directive X can only be used once at this location."` It is gated by a `singleLocation` flag (`schema.go:479`) so it applies only to single authored locations — fields, enum values, arguments, and the `schema` / `extend schema` directive lists. A type's own directives are exempt: they are merged across the base definition and every extension (`schema.go:65`-style append for `def.Directives`), which the spec treats as distinct locations, so the merged list validated at `schema.go:422` passes `singleLocation: false`. Consequence worth noting: a non-repeatable directive repeated within a single type definition (e.g. `type T @x @x` with no extension) is **not** caught, because provenance is lost once the base and extension directive lists are merged — directive definitions aren't even registered until `schema.go:112`, after the merge. graphql-js catches this by validating pre-merge AST nodes. Tested by four cases in `schema_test.yml` (non-repeatable directive repeated on a field and on an enum value; positive cases for a repeatable directive, the same directive on distinct field locations, and a directive on a type plus its extension).

**`LoneSchemaDefinition`** — `len(sd.Schema) > 1` is checked at `schema.go:115`. The graphql-js check for "schema already defined in prior context" is an isolated-validation architectural difference, not a gap.

---

## Summary

| Rule | Status | Nature |
|---|---|---|
| `UniqueArgumentDefinitionNames` | Missing | Unintentional gap — no test, no check |
| `UniqueOperationTypes` | Missing (3 cases) | Unintentional gap — silent overwrite |
| `PossibleTypeExtensions` | Intentional divergence | Allows ghost types; federation use case |
| `UniqueDirectiveNames` (builtins) | Intentional divergence | Explicit test documents the choice |
| `UniqueTypeNames` | Covered | — |
| `UniqueFieldDefinitionNames` | Covered | — |
| `UniqueEnumValueNames` | Covered | Pair-scan mirroring the field check; tested |
| `UniqueDirectivesPerLocation` (SDL) | Covered (with caveat) | Per single authored location; merged type-level list exempt |
| `LoneSchemaDefinitionRule` | Covered / arch. difference | Within-doc check present |
