# Go Design Rules

Authoritative Go design rules for the entire `github.com/nhost/nhost` monorepo. These rules apply to every Go file in `services/*`, `cli/`, `internal/lib/`, `tools/`, and any future Go code. They are deliberately stricter than what `golangci-lint` can see, because they target design and architecture concerns a linter cannot.

**Module-wide constraints.** Go 1.26.0. Single `go.mod` at the repo root with module path `github.com/nhost/nhost` — never add a per-project `go.mod` or per-project `vendor/`. After dependency changes, run `go mod vendor` from the root. After changes that affect code generation, run `go generate ./...`. Lint config lives in `.golangci.yaml`.

Skip `vendor/` and generated files (`*_gen.go`, `*.gen.go`, `generated.go`, `schema.resolvers.go`). Do not re-flag mechanical issues a strict `golangci-lint --fix ./...` run would catch on its own (formatting, unused vars, basic struct exhaustiveness) — those are the author's responsibility before merge.

---

## The three questions (for every change)

When *reviewing* a change to a Go symbol, every finding must answer one of these three questions:

1. **Placement** — Is this change in the *right* package? Does the new/modified code fit the package's single area of concern, or does it belong in a sibling package or a new subpackage?
2. **Package invariants** — Does the change make its package *violate* a design rule it previously satisfied? (A new untested export, a new external-system dependency with no interface, a new struct with `//nolint:exhaustruct`, an ungated DB feature, stale golden files, etc.)
3. **Local correctness** — Do the changed lines *themselves* follow the rules? (Error wrapping, no naked `return err`, no `export_test` re-exports, SQL through parameterised pipelines, security, logic correctness, table-driven tests, godoc, etc.)

When *writing* code, the same three lenses apply in reverse: place the symbol in the right package, do not break the package's invariants, write the changed lines so they pass local-correctness rules on the first try.

Read the surrounding package, not just the diff hunk. The diff tells you *what* changed; the package context tells you whether the change is *correct*.

---

## 🔴 Blocking (must fix before merge)

### Security & correctness

- **SQL injection.** Every user-provided value in SQL must flow through a parameterised pipeline (placeholder + params slice), never via string concatenation. Connectors that build SQL must thread values through `dialect.Placeholder(paramIndex)` (or the project's equivalent `VariableTracker`-style API) so the database receives `$1` / `?` and never the raw value.
- **Other security.** Command injection, hardcoded secrets, credentials written to logs, unsanitised input crossing a trust boundary.
- **Bugs / logic errors.** Off-by-one, nil deref, wrong branch, broken concurrency, incorrect state mutation. Mutating shared atomic-pointer state directly instead of going through the package's documented builder is a bug.

### Placement (Q1)

- **Cohesion.** A new/changed symbol whose purpose does not clearly fit the package's area of concern. Recommend moving it to an existing sibling package or extracting a subpackage.
- **Hardcoded dialect/backend syntax.** New code that differs between backends (e.g. PostgreSQL vs SQLite SQL syntax) must go through the project's abstraction interface, never hardcoded at the call site.

### Package invariants (Q2)

- **External-system boundary without an interface.** A new dependency on an external system (database, HTTP/REST API, message broker, filesystem, clock, or a concrete type so complex you only need one or two methods) must be hidden behind an interface *defined in the consuming package*. The trigger is testability: if a fake/mock would materially simplify tests, the dependency must be an interface. This is **not** a blanket "any external module type" rule — pure, easy-to-construct value types are fine to use directly.
- **Missing mockgen directive.** Every new boundary interface needs `//go:generate mockgen -package mock -destination mock/<name>.go . <Interface>` directly above it, with the mock generated into a `mock/` subdir. Never hand-written.
- **Untested new export.** Every new exported function/method/type must have tests, in `package foo_test` (black-box). Use `make coverage PACKAGE=<path>` to confirm.
- **`exhaustruct` nolint on internal type.** Never `//nolint:exhaustruct` for a type defined in this repo. Only permitted exceptions: external types you don't own, and a zero-value struct returned alongside an error on the error path. Flag it anywhere else.

### Local correctness (Q3)

- **Error wrapping.** Errors from another package or an external dep must be wrapped with call-site context: `return fmt.Errorf("loading config: %w", err)`. Flag naked `return err` from any function doing I/O or calling into another package, and any error swallowed via `_` or ignored in an `if`.
- **`export_test.go` / `XxxForTest` re-exports.** Banned. Flag any exported identifier that exists only so a black-box `_test` package can reach package-private state (a constructor injecting a private field, an accessor, an aliased sentinel). The fix is a white-box `foo_internal_test.go` with inline stub types. *Exception:* boundary interfaces exported for `mockgen` are legitimate public contract.
- **Ignored errors.** Never `_ = someFunc()` if the return is an error, never an empty `if err != nil {}` block that drops the error.

---

## 🟡 Warning (should fix before next release)

- **Subpackage extraction.** When code adds 2–3 related exported symbols forming a clear sub-concern, recommend extracting a subpackage.
- **Unexported by default.** A new exported symbol with no consumer outside its package (tests don't count) should be unexported. Watch exported struct fields especially.
- **Internal test placement.** Complex new unexported logic should be tested white-box in `foo_internal_test.go` (`package foo`). Don't mix `package foo` and `package foo_test` in one file; don't test public symbols white-box. White-box test files cannot import the same package's `mock/` subdirectory (import cycle); use inline stub types implementing the interface directly in the test file.
- **Constructor hygiene.** A new exported struct with required non-zero fields needs a `New*` constructor rather than relying on literal initialisation.
- **Table-driven tests.** New tests for a function with multiple input/output cases must use the `tests := []struct{...}{...}; for _, tt := range tests { t.Run(...) }` pattern. Flag `TestFoo1`/`TestFoo2` duplication.
- **Mocked tests AND integration tests.** Mocked unit tests should cover all logic branches; integration tests must validate that the mocks behave the way the real dependencies do.
- **Superfluous comments.** Comments that merely restate the code, or that depend on context the reader doesn't have ("needed for X" without saying what X is).
- **Package-level godoc.** A newly added package must have a godoc comment on its `package` declaration explaining its area of concern.
- **Unjustified `nolint`.** Acceptable only when the fix isn't worth the complexity, and always with a justification comment. Flag bare ones.
- **Missing docs on customer-facing changes.** New public/customer-facing functions or APIs should be documented.

## 🔵 Suggestion (optional)

- **Godoc on exports.** Every exported symbol should have a godoc comment beginning with the symbol's name.
- **Style / naming / minor refactors** consistent with surrounding code.

---

## Mandatory post-change checks

After every change to Go source files, before reporting work as complete, run from the repo root in this order:

1. `golines -w --base-formatter=gofumpt .`
2. `golangci-lint run --fix ./...`

Both commands operate on the whole project, not just the files you touched — this catches collateral fallout (import reorganisations, struct-field exhaustiveness, dead code). If either modifies files, re-stage them in the same commit. Treat any remaining `golangci-lint` finding as a blocker: either fix it or justify a targeted `//nolint:<linter>` with a comment.

---

## Project-specific invariants

Per-project Go invariants (e.g. Constellation's `Dialect` / `Capabilities` / `controllerState` rules, golden-file regen) live in each project's `CLAUDE.md`. Your startup protocol already loads them — apply them on top of the rules above.
