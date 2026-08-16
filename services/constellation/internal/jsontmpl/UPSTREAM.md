# Upstream pin

This package is a clean-room Go port of `hasura/kriti-lang`. Fixtures and
semantics are pinned against a specific upstream commit.

## License & attribution

Upstream `hasura/kriti-lang` is licensed under **Apache-2.0**. This package is a
derivative work; see the adjacent `NOTICE` file for the required attribution and
license pointer. Apache-2.0 §4 requires derivative works to retain attribution
and include the License.

## Pinned commit

- Repo: https://github.com/hasura/kriti-lang
- Commit: `daf56edd514a3c5439b457f9de08eaf43c876251`
- Date: 2022-11-15
- Subject: "Removes dead optional lookup code (#79)"

There is no in-tree clone of the upstream sources. All `*.hs` file/line
citations scattered through this package's comments (e.g. `Eval.hs:108`,
`Token.hs:121-148`) refer to the upstream repository **at the pinned commit
above**; read them at
`https://github.com/hasura/kriti-lang/tree/daf56edd514a3c5439b457f9de08eaf43c876251`.

Bump deliberately. When bumping:

1. Re-vendor `test/data/{eval,parser}/**` into `testdata/conformance/`.
2. Re-read `src/Kriti/Eval.hs` and `src/Kriti/CustomFunctions.hs` (in the
   upstream repo at the new commit) for any semantic changes; update the
   intentional-divergences section below if behaviour shifted.
3. Re-run the conformance suite; investigate any new failures before
   landing the bump.

## Intentional divergences from upstream

Documented here so future readers don't "fix" them. All three
crash-replacement divergences exist for the same reason: matching an
upstream uncaught Haskell exception would surface as a panic in the
Constellation webhook deliverer. A typed `FunctionError` is the only
port-viable behaviour. If upstream eventually fixes any of these,
mirror their chosen error message.

Each divergence is anchored by a fixture under `testdata/derived/`
so the port's expected behaviour is testable.

### `inverse(0)` — see testdata/derived/q10_inverse_zero

Upstream evaluates `1 / Scientific(0)`, which raises the uncaught
Haskell exception `"Ratio has zero denominator"`. The Go port returns
`FunctionError "Division by zero"`.

### `tail([])` — see testdata/derived/q02c_tail_empty_arr

Upstream calls `V.tail` on an empty `Vector`, which raises
`error "invalid slice (1,-1,0)"`. The Go port returns `FunctionError`
with message `"Empty array"` (mirroring upstream's `head([])` text
for consistency).

### `tail("")` — see testdata/derived/q02d_tail_empty_str

Upstream calls `T.tail` on an empty `Text`, which raises
`error "Data.Text.tail: empty input"`. The Go port returns
`FunctionError` with message `"Empty string"`.

### `\uXXXX` validation

Upstream's lexer uses Haskell `read` on the 4-hex-digit codepoint
and produces undefined behaviour on values outside the valid Unicode
range (lone surrogates, etc.). The Go port validates the codepoint
and returns a `LexError` on invalid input.

Rationale: same as above — undefined behaviour is not a portable
target. Robust validation is strictly safer than upstream and
shouldn't surface in normal admin templates.

### Lexer error classification — see testdata/derived/q08a, q08b

Upstream classifies lexer failures as `Parse Error` with the generic
message `Invalid Lexeme`. The Go port surfaces a distinct `Lex Error`
code (`CodeLexError`) with a more specific message, e.g.
`invalid lexeme "-"`. The `error_code` the dashboard keys off is still a
stable Kriti code; the richer message is a deliberate, strictly-more-
informative divergence. `derived_test.go` accepts any typed `Lex Error`
for these fixtures.

## Transform call-site parity

This package renders templates; the request/response *transform* builders that
consume it live in `connector/action/transform`. Two Hasura behaviours that are
not part of Kriti itself but are required for transform parity are implemented
there and pinned by tests in that package:

- A query parameter or form field whose value template renders to JSON `null`
  is **dropped** from the outgoing request (not sent as the literal string
  `null`), matching graphql-engine. Headers are not dropped this way.

No known transform gaps remain against the ported Hasura action transform
surface; see [action-parity-coverage.md](../../docs/developers/action-parity-coverage.md).

## Implementation notes

### JSON engine: `encoding/json/v2` + `jsontext`

The port uses `encoding/json/v2` and `encoding/json/jsontext`
throughout (the host service runs under `GOEXPERIMENT=jsonv2`), not v1
`encoding/json`. Two consequences worth knowing when bumping or
debugging:

- The public API exchanges raw JSON as `jsontext.Value` (`Render`'s
  result, the `Func` callback, scope bindings). Callers stay on a
  single json library.
- `eval.FromJSON` is a hand-written `jsontext.Decoder` token walk that
  preserves object key order (Kriti is order-sensitive). Mind the
  jsontext rule that a `Token` is voided by the next decoder call —
  capture string keys before recursing.
- v2 randomises map iteration order, so every `json.Marshal` of a Go
  map in the pipeline (scope binding in `WithVar`, function-argument
  encoding, the final result, and the conformance test's canonicaliser)
  passes `json.Deterministic(true)`. Without it, output bytes — and the
  conformance byte-comparison — are non-reproducible.
