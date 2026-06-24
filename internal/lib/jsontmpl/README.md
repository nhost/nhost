<div align="center">

# jsontmpl

<a href="https://docs.nhost.io/reference/kriti">Docs</a>
  <br />
  <hr />
</div>

Go port of [`hasura/kriti-lang`](https://github.com/hasura/kriti-lang),
the JSON templating language Hasura uses for action / event-trigger /
cron / connection transforms. Kept under a Hasura-neutral package
name because the engine has no inherent dependency on Hasura.

**Status: implemented.** `Render` lexes, parses, and evaluates
templates against a `Scope`, and the upstream conformance suite passes.
Callers build a `Scope` with the generic `New` + `WithVar` + `WithFunc`
combinators.

## Layout

| Path                                       | Purpose                                                            |
|--------------------------------------------|--------------------------------------------------------------------|
| `jsontmpl.go`                              | Public API: `Render`, `Validate`, `Scope` (+ `WithVar`/`WithFunc`). |
| `errors.go`                                | `Error`, `ErrorCode` constants, `MarshalJSON` matching upstream.   |
| `jsontmpl_test.go`                         | Smoke tests for the implemented surface.                           |
| `conformance_test.go`                      | Conformance suite (eval + parser fixtures, vendored from upstream). |
| `testdata/conformance/eval/`               | 34 eval examples + goldens, vendored from upstream.                |
| `testdata/conformance/parser/success/`     | 15 parser-success fixtures.                                        |
| `testdata/conformance/parser/failure/`     | 3 parser-failure fixtures.                                         |
| `testdata/hasura/`                         | (reserved) graphql-engine transform fixtures.                      |
| `testdata/derived/`                        | Fixtures authored against the Haskell binary, anchoring the intentional divergences in `UPSTREAM.md`. |
| `UPSTREAM.md`                              | Pinned commit + intentional divergences.                           |

## Running the conformance suite

```sh
GOEXPERIMENT=jsonv2 go test ./internal/lib/jsontmpl/...
```

To see per-fixture status:

```sh
go test -v ./internal/lib/jsontmpl/
```

## Bumping the upstream pin

See `UPSTREAM.md`. tl;dr: bump the commit hash, re-vendor
`test/data/`, re-read `Eval.hs` + `CustomFunctions.hs` for any
semantic changes, run the suite, investigate failures.

## Where to read more

- `UPSTREAM.md` — the upstream pin, license/attribution, and the catalogue
  of intentional divergences.
- `NOTICE` — Apache-2.0 attribution for the upstream project.
- The upstream reference implementation, at the pinned commit:
  <https://github.com/hasura/kriti-lang/tree/daf56edd514a3c5439b457f9de08eaf43c876251/src/Kriti>
  (`test/Spec.hs` in the same tree shows how the fixtures are exercised).
