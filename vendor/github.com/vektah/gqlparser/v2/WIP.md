# SDL Validation Gaps: graphql-js vs gqlparser `ValidateSchemaDocument`

## Architectural context

Two facts apply throughout this analysis.

**Fail-fast vs. accumulate.** gqlparser returns on the first error encountered; graphql-js collects and reports all errors in one pass. A schema with multiple violations will always surface only one error in gqlparser.

**Isolated validation.** graphql-js SDL rules receive a `SDLValidationContext` carrying a pre-existing schema object, enabling checks like "this type already exists in the schema you're extending." gqlparser validates a single `SchemaDocument` in isolation. Checks that require pre-existing schema context are not gaps — they are an architectural difference.

---

## Unintentional gaps

None currently known.

---

## Intentional divergences

### `PossibleTypeExtensions` — allows extensions of undefined types

When an extension references a type that doesn't exist, gqlparser creates a synthetic `Definition` for it (`schema.go:41–48`) and continues. graphql-js rejects with:
> `Cannot extend type "X" because it is not defined.`

This is **intentional**: `schema_test.yml` has an explicit test case "can extend non existant types" asserting no error. The practical use case is federation-style schemas where types are extended without a local base definition.

The consequence worth noting: the resulting ghost type does pass through `validateDefinition`. If the extension body provides at least one field and all types referenced in it exist, the ghost type becomes a valid Object type in the compiled schema. A typo in an extension's type name therefore produces a new, unexpected type rather than an error.

---

### `UniqueDirectiveNames` — builtin redeclaration silently accepted

For non-builtin directives, gqlparser correctly returns an error (`schema.go:106`), tested by `schema_test.yml`'s "cannot redeclare directives" case. For the directives the prelude declares — currently `include`, `skip`, `deprecated`, `specifiedBy`, `defer`, `oneOf` — a redeclaration is silently accepted with the last definition kept. The set is generated from the prelude (`isPreludeDirective` in `prelude_directives.go`, written by `go generate ./validator`), so a directive added to the prelude is covered once the file is regenerated, and a test fails until it is. `schema_test.yml`'s "can redeclare builtin directives" case and `TestRedeclareBuiltinDirectives` assert this.

graphql-js rejects any directive redefinition, including builtins:
> `Directive "@skip" already exists in the schema. It cannot be redefined.`

The rationale is documented at `schema.go:96`: servers may ship directive definitions from an older or divergent spec version, and validating definition equivalence is considered more work than it's worth. The practical consequence is that a schema with a conflicting `@deprecated` or `@skip` definition loads without error.

---

## Confirmed covered

**`UniqueTypeNames`** — the first-pass map insertion at `schema.go:30–34` catches any type defined more than once in the document, returning `"Cannot redeclare type X."` Tested by `schema_test.yml`.

**`UniqueFieldDefinitionNames`** — field merging (`schema.go:63`) is followed by an O(n²) pair-scan at `schema.go:386–397`, catching duplicates within a definition, across definition + extension, and across multiple extensions. Tested by three cases in `schema_test.yml`.

**`UniqueEnumValueNames`** — enum value merging (`schema.go:65`) is followed by an O(n²) pair-scan at `schema.go:399–410`, mirroring the field check, catching duplicates within a definition and across extensions, returning `"Enum value X.Y can only be defined once."` Tested by two cases in `schema_test.yml` (same definition and across an extension).

**`UniqueArgumentDefinitionNames`** — `validateArgNames` runs a pair-scan over each field's argument list (from `validateDefinition`) and each directive definition's argument list (from `validateDirective`), returning `"Argument Query.field(id:) can only be defined once."` or `"Argument @dir(id:) can only be defined once."`, matching the graphql-js wording without the quotes. Field arguments cannot be split across extensions, so a per-field check is sufficient. Tested by `schema_test.yml` cases for object fields, interface fields and directive definitions, plus positive cases for the same argument name on different fields and directives.

**`UniqueArgumentNames` (SDL)** — the argument loop in `validateDirectives` rejects an argument repeated within a single directive application (`@dir(a: 1, a: 2)`) on any schema location, returning `"There can be only one argument named a."`, the graphql-js wording without the quotes. Tested by `schema_test.yml` cases on a field, a type, the `schema` block, a field argument definition and an enum value, plus a positive case for the same argument on a repeated repeatable directive.

**`UniqueDirectivesPerLocation` (SDL)** — `validateDirectives` (`schema.go:468`) tracks seen directive names per call and rejects a repeated non-repeatable directive with `"The directive X can only be used once at this location."` It is gated by a `singleLocation` flag (`schema.go:479`) so it applies only to single authored locations — fields, enum values, arguments, and the `schema` / `extend schema` directive lists. A type's own directives are exempt: they are merged across the base definition and every extension (`schema.go:65`-style append for `def.Directives`), which the spec treats as distinct locations, so the merged list validated at `schema.go:422` passes `singleLocation: false`. Consequence worth noting: a non-repeatable directive repeated within a single type definition (e.g. `type T @x @x` with no extension) is **not** caught, because provenance is lost once the base and extension directive lists are merged — directive definitions aren't even registered until `schema.go:112`, after the merge. graphql-js catches this by validating pre-merge AST nodes. Tested by four cases in `schema_test.yml` (non-repeatable directive repeated on a field and on an enum value; positive cases for a repeatable directive, the same directive on distinct field locations, and a directive on a type plus its extension).

**`UniqueOperationTypes`** — `ValidateSchemaDocument` tracks the operation types seen across the `schema {}` block and every `extend schema` block, returning `"There can be only one query type in schema."` (graphql-js wording) for the second occurrence. This covers a duplicate within one block, the same operation in two extensions, and an extension re-specifying an operation from the base block. graphql-js reports the last case as `"Type for query already defined in the schema. It cannot be redefined."` only when extending a pre-existing schema object, which is an isolated-validation architectural difference. Tested by three cases in `schema_test.yml`, plus a positive case adding each operation type once across extensions.

**`UniqueInputFieldNames` (SDL)** — `validateInputFieldNames` walks an input object value, including objects nested in other objects and lists, and rejects a field set more than once with `There can be only one input field named "x".`, the same message as the query-side rule. It runs on directive argument values at every schema location (from `validateDirectives`) and on default values of field arguments, directive definition arguments and input fields. Tested by `schema_test.yml` cases for each of those, plus a positive case for the same field name at different depths.

**`LoneSchemaDefinition`** — `len(sd.Schema) > 1` is checked at `schema.go:115`. The graphql-js check for "schema already defined in prior context" is an isolated-validation architectural difference, not a gap.

---

## Summary

| Rule | Status | Nature |
|---|---|---|
| `PossibleTypeExtensions` | Intentional divergence | Allows ghost types; federation use case |
| `UniqueDirectiveNames` (builtins) | Intentional divergence | Explicit test documents the choice |
| `UniqueTypeNames` | Covered | — |
| `UniqueFieldDefinitionNames` | Covered | — |
| `UniqueArgumentDefinitionNames` | Covered | Field and directive argument lists; tested |
| `UniqueEnumValueNames` | Covered | Pair-scan mirroring the field check; tested |
| `UniqueArgumentNames` (SDL) | Covered | Directive applications on schema locations; tested |
| `UniqueDirectivesPerLocation` (SDL) | Covered (with caveat) | Per single authored location; merged type-level list exempt |
| `UniqueOperationTypes` | Covered | Across `schema` and `extend schema` blocks; tested |
| `UniqueInputFieldNames` (SDL) | Covered | Directive argument values and default values; tested |
| `LoneSchemaDefinitionRule` | Covered / arch. difference | Within-doc check present |

---

# Query validation work for gqlgen incremental delivery (`@defer` / `@stream`)

These items describe what gqlparser would need for gqlgen to match graphql-js 17 on incremental delivery. They are query-document (executable) validation and prelude changes, not SDL gaps, so they sit outside the table above. Behavior was checked on 2026-10-22 against graphql-js `17.0.0-alpha.2` (the 2022-08-24 era), `17.0.0-alpha.9` (Apollo Server's pin) and `17.0.2`, and against this checkout of gqlparser.

Three facts apply to all three items:

- **gqlparser accepts every case below today.** The cases are duplicate labels, a variable label, `if: null`, `@defer` on a root mutation field and `@defer` in a subscription. Once a schema declares `@stream`, it also accepts `@stream` on a non-list field and overlapping `@stream` fields.
- **The specs are imported from graphql-js 16.x.x, which has no `@defer`/`@stream` rules.** `export.sh` pins `MAIN="16.x.x"`. graphql-js `17.x.x` (`106e8799` when checked) ships `DeferStreamDirectiveLabelRule`, `DeferStreamDirectiveOnRootFieldRule`, `DeferStreamDirectiveOnValidOperationsRule` and `StreamDirectiveOnListFieldRule` tests, plus about 35 `@stream` mentions in the `OverlappingFieldsCanBeMergedRule` tests. Moving the whole importer to 17.x.x brings every other 17 change with it. Importing only those spec files is the smaller step, but `export.js` would have to learn to select them, because it requires every `-test.ts` file in the directory. Either way the exporter needs updating for 17.x.x:
  - Its `fakeModules` table intercepts `mocha` and `./harness`.
  - 17.x.x tests import `describe`/`it` from `node:test`, and import `./harness.ts`, with the extension.
  - Without new keys for those two, the real modules load.
- **The walker visits fragment bodies more than once.** It walks a named fragment's selection set once for each operation that spreads it (`validatedFragmentSpreads` is reset per operation), and again in `walkFragment`. graphql-js visits each AST node once per document. A rule built on `OnDirective` will therefore see the same `*ast.Directive` several times, and has to deduplicate by pointer. Measured: a `@defer` inside a fragment spread by two operations was visited 3 times.

## Unique `@defer` labels (`DeferStreamDirectiveLabelRule`)

**graphql-js 17.0.2 behavior:**
- **Scope:** for every `@defer` or `@stream` directive node in the document, across all operations and fragments (the same label in two different operations is an error, even though only one of them executes), a `label` argument must be a literal string. It may also be absent, or a literal `null` (17.0.2 only).
- **Two error messages:**
  - A variable label: `Argument "@defer(label:)" must be a static string.`
  - A label value seen on an earlier node: `Value for arguments "defer(label:)" and "stream(label:)" must be unique across all Defer/Stream directive usages.` It reports both nodes. gqlparser can do the same: `core.At` appends a location, so passing it twice gives two.
- **What it doesn't catch:** the check is per AST node, not per payload. A fragment containing `... @defer(label: "a")` that is spread in two places is valid in all three versions, yet it produces two payloads with the same label. Labels therefore can't serve as payload identity. gqlgen has to key deferred payloads on where the fragment occurs in the response, not on the label alone.

**Version differences:**
- alpha.2 rejected `label: null` as non-static, and its messages were `Defer/Stream directive label argument must be unique.` and `Directive "defer"'s label argument must be a static string.`
- alpha.9 matches 17.0.2, except that it still rejects `label: null`.

**Changes needed:**
1. Add `validator/rules/defer_stream_directive_label.go` and register it in `NewDefaultRules` (`validator/rules/rules.go`).
   - It applies to `@stream` as soon as a schema declares it.
   - It keeps one label→directive map for the whole document, and deduplicates visits by `*ast.Directive` pointer, because of the walker behavior above.
2. Use the 17.0.2 messages, and accept a literal `null` label.
3. Tests: import `DeferStreamDirectiveLabelRule-test.ts` from 17.x.x, or add equivalent `validator/testdata` cases. Include the "same fragment spread twice" case as valid.

**gqlgen impact:** this is a breaking change for gqlgen users. Today gqlgen merges duplicate labels into one payload, and it accepts variable labels; both would start failing validation. Because `Rules` has `RemoveRule`, gqlgen can opt out, or adopt the rule in a release that calls out the break. gqlparser should still ship the rule by default, to match graphql-js.

## Validation shared by the older and newer `@defer` formats

The 2022-08-24 format (`deferSpec=20220824`) and the newer format (`incrementalSpec=v0.2`) are wire shapes that gqlgen's transport writes. gqlparser produces no responses, so it needs no format-specific code, and it should validate a document the same way whichever format the client negotiates.

**Why a single 17.0.2 rule set covers both formats:** the references that still serve the older format all validate with graphql-js 17-era rules:
- Apollo Server pins `17.0.0-alpha.9` and converts its output with `@yaacovcr/transform`.
- graphql-js 17.0.2 serves the older format through `legacyExecuteIncrementally`. That function doesn't validate, so a server built on it runs `validate()` with 17.0.2's `specifiedRules` first.

alpha.2's differences don't need reproducing: it rejected `label: null`, had no subscription rule, and accepted identical overlapping `@stream` fields. Apollo Router uses its own validator, which I haven't checked.

**Changes needed:**
1. **Prelude `if` nullability.**
   - gqlparser declares `@defer(if: Boolean = true, label: String)`. That block is hand-written in `export.js`, because 16.x has no `@defer`. alpha.2, alpha.9 and 17.0.2 all declare `if: Boolean! = true`.
   - Changing the prelude to `Boolean!` rejects only a literal `if: null`. A nullable `Boolean` variable stays allowed, because the argument has a default (`ExpectedTypeHasDefault` in `variables_in_allowed_position.go:31`).
   - A schema that declares its own `@defer` already replaces the prelude's definition. A user-declared `Boolean!` survives loading.
   - This was measured with a user-declared `@defer(if: Boolean! = true)`:
     - gqlparser rejects a literal `if: null`.
     - It accepts `query($b: Boolean)`, `query($b: Boolean = null)` and `query($b: Boolean!)`, as graphql-js 17.0.2 does.
   - **gqlgen consequence, at run time:** when a nullable `$b` arrives as `null`, graphql-js 17.0.2 reports a field error: `Argument "@defer(if:)" has invalid value: Expected variable "$b" provided to non-null type "Boolean!" not to be null.` gqlgen's `deferrable()` (`graphql/executable_schema.go:308`) instead silently treats it as "don't defer". gqlgen does that argument coercion itself, so gqlparser can't fix it.
   - The description strings already match graphql-js.
2. **`DeferStreamDirectiveOnRootFieldRule`.**
   - It forbids `@defer` on a fragment (inline or spread, followed into fragment definitions) whose selections are root fields of a `mutation` or `subscription`. `@defer` directly on the query root is allowed.
   - Messages: `Defer directive cannot be used on root mutation type "Mutation".`, and the same with `subscription`.
   - It is the same in all three versions. `@defer` nested below a root mutation field is valid.
3. **`DeferStreamDirectiveOnValidOperationsRule`** (alpha.9 and later).
   - In a `subscription`, `@defer` is an error unless its `if` can be false: a literal `false`, or a variable.
   - In 17.0.2, selections that an `@skip`/`@include` might skip are exempt: `@skip` whose `if` is `true` or a variable, or `@include` whose `if` is `false` or a variable. alpha.9 has no exemption, so it rejects `... @defer @skip(if: $s)`, which 17.0.2 accepts.
   - The rule walks the whole subscription, including fragment spreads.
   - Message: ``Defer directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.``
4. **Identity needs nothing from gqlparser.**
   - The newer format sends one `pending` per occurrence of a deferred fragment. gqlgen can identify an occurrence by the response path plus the `*ast.InlineFragment` or `*ast.FragmentSpread` pointer, which is stable within a parsed document.
   - The path is required, because a fragment definition spread in two places shares its inner nodes.
   - Worth a doc note on the AST that callers may rely on node pointer identity within one `QueryDocument`.
5. **Tests:** import the 17.x.x spec files for rules 2 and 3, using the 17.0.2 messages.

**gqlgen impact:** items 2 and 3 reject queries gqlgen accepts today. That makes them the same kind of breaking change as the label rule, with the same opt-out route.

## `@stream`

**graphql-js 17.0.2 definition:**
`directive @stream(initialCount: Int! = 0, if: Boolean! = true, label: String) on FIELD`. alpha.9 is the same, and alpha.2 had `initialCount: Int = 0`.

`@defer` and `@stream` are not in graphql-js 17's `specifiedDirectives`, so a schema has to opt in to them. gqlparser, by contrast, puts `@defer` in its prelude for every schema.

**Changes needed:**
1. **Declaring the directive.**
   - **Option a:** add `@stream` to the prelude. That is what gqlgen would need. Then run `go generate ./validator`, so schemas that already declare `@stream` keep loading.
   - **Release coordination:** every gqlgen server would then advertise `@stream` in introspection and accept it before gqlgen implements it. gqlgen pins the current behavior with `TestStreamDirectiveIsUnsupported` (`codegen/testserver/singlefile/defer_test.go`), which fails by design when that happens. So the prelude change and gqlgen's implementation should be released together.
   - **Option b:** an opt-in, such as a second prelude or a load option. That decouples the two releases.
2. **`StreamDirectiveOnListFieldRule`.**
   - `@stream` is allowed only on a list field or a non-null list field.
   - Message: `Directive "@stream" cannot be used on non-list field "Query.hero".` alpha.2's wording was different.
3. **Extend rules 2 and 3 of the previous item to `@stream`.**
   - Rule 2 errors on a `@stream` placed on a root field of a mutation or subscription: `Stream directive cannot be used on root subscription type "Subscription".` A `@stream` nested below a root mutation field is valid.
   - Rule 3 has a matching `Stream directive not supported on subscription operations…` message.
4. **The label rule** (first item) already covers `@stream` labels, which share one namespace with `@defer` labels.
5. **`OverlappingFieldsCanBeMerged`.**
   - Two fields with the same response name conflict whenever either one carries `@stream`, even when both carry identical `@stream` arguments.
     - Identical arguments: `they have overlapping stream directives. See https://github.com/graphql/defer-stream-wg/discussions/100`.
     - Any other combination: `they have overlapping stream directives`.
   - It fires even when the two fields' parent types are mutually exclusive, for example `... on A { f @stream }` next to `... on B { f }`. That is unlike the rest of the rule.
   - The check also applies to nested subfields: `Fields "hero" conflict because subfields "friends" conflict because …`.
   - alpha.2 allowed identical streams, and called the rest "differing".
   - In graphql-js it is `hasNoOverlappingStreams`, called from `findConflict` before the type comparison. gqlparser's equivalent point is in `validator/rules/overlapping_fields_can_be_merged.go`.
   - The 17.x.x `OverlappingFieldsCanBeMergedRule-test.ts` has the cases.
6. **Not validation:**
   - `initialCount >= 0` is checked at execution time in graphql-js (`getStreamUsage`: `initialCount must be a positive integer`), so it belongs to gqlgen, not gqlparser.
   - The same applies to graphql-js's execution-time guard against `@stream` in subscriptions.

# Introspection work for graphql-js 16.14 / 17 parity

gqlgen's `introspection.Query` requests every introspection field the prelude declares, apart from the optional fields in `introspection.QueryOptions`. gqlgen's `TestQueryRequestsEveryIntrospectionField` enforces this, so each prelude change below also needs a gqlgen change. Checked on 2026-10-22 against the published graphql-js `16.14.0`, `16.14.2` and `17.0.2` packages.

## Directive deprecation (`experimentalDirectiveDeprecation`)

**graphql-js 16.14.0 and 17.0.2 declare:**

```graphql
type __Schema {
  directives(includeDeprecated: Boolean! = false): [__Directive!]!
}
type __Directive {
  isDeprecated: Boolean!
  deprecationReason: String
}
```

With `includeDeprecated: false`, the default, `__Schema.directives` leaves out deprecated directives. `getIntrospectionQuery` requests these fields only with `experimentalDirectiveDeprecation: true`, which is off by default.

**gqlparser today:**
- The prelude already accepts `@deprecated` on `DIRECTIVE_DEFINITION`, through the deviations in `export.js`'s `applyPreludeDeviations`.
- Introspection gives clients no way to see that a directive is deprecated, though: the prelude's `__Schema.directives` takes no arguments, and `__Directive` has neither field.

**Changes needed:**
1. **Prelude.**
   - Re-running `export.sh` against graphql-js `16.x.x` at 16.14.0 or later adds exactly these three fields. `printIntrospectionSchema` from 16.14.2 differs from today's prelude in nothing else.
   - The same re-export makes both `applyPreludeDeviations` replacements fail their "must match exactly once" check, because 16.14 already prints the `DIRECTIVE_DEFINITION` locations. Delete the deviations then.
   - The re-export also brings in every other `16.x.x` change to the imported spec tests, so review those separately.
2. **gqlgen** (in the same release as the gqlparser change, because its contract test fails until then):
   - Add `IsDeprecated()` and `DeprecationReason()` to `introspection.Directive`, read from the definition's `@deprecated`.
   - Bind `__Schema.directives` to a method that takes `includeDeprecated`. This is the same pattern `injectBuiltins` uses for `args` and `inputFields`, and it keeps deprecated directives from leaking.
   - Add `QueryOptions.ExperimentalDirectiveDeprecation`, off by default, matching graphql-js. graphql-js servers older than 16.14.0 reject these fields.

## `includeDeprecated` is `Boolean!` in graphql-js 17

| Argument | gqlparser prelude | graphql-js 16.14 | graphql-js 17.0.2 |
|---|---|---|---|
| `__Schema.directives(includeDeprecated:)` | (no argument) | `Boolean! = false` | `Boolean! = false` |
| `__Type.fields`, `inputFields`, `enumValues`, `__Field.args`, `__Directive.args` `(includeDeprecated:)` | `Boolean = false` | `Boolean = false` | `Boolean! = false` |

A client that passes an explicit `includeDeprecated: null` is treated as passing `false` by gqlparser-based servers and graphql-js 16.x, but gets a validation error from 17.0.2. This doesn't affect queries that pass `true` or `false`, including gqlgen's `introspection.Query`. Make the arguments non-null together with the move to 17.x.x specs, not before. Changing the generated prelude means another deviation in `export.js` until then.
