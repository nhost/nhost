# Derived fixtures

Fixtures we authored by running the upstream Haskell `kriti` binary on
templates whose behaviour was not covered by the conformance suite.
Each fixture is a triple:

- `<name>.kriti`        — the template
- `<name>.input.json`   — the JSON document bound to `$`
- `<name>.output.txt`   — the expected outcome, in one of three forms:

```
OK <one-line-compact-json>
ERROR <error-class>: <message>
CRASH: <one-line Haskell exception>
```

`OK` lines hold the engine's standard output. `ERROR` lines come from
a clean Kriti error (`Runtime Error:` or `Parse Error:`). `CRASH:`
lines mark upstream bugs — three known cases: `inverse(0)`, `tail([])`,
`tail("")`. The Go port returns clean `FunctionError`s instead;
divergences are documented in `../UPSTREAM.md`.

## Regenerating

The upstream binary lives at
`third-party/hasura/kriti-lang/result/bin/kriti` (built via
`nix build` from that directory; see
`third-party/hasura/kriti-lang/NOTE.md` for the small patches the
nixpkgs-unstable build needs as of 2026-05).

To regenerate a fixture after a behaviour change:

```sh
KRITI=third-party/hasura/kriti-lang/result/bin/kriti
"$KRITI" -j FIXTURE.input.json -t FIXTURE.kriti -b '$'
```

The `third-party/` build tree is not committed to this repository; build
the upstream binary out-of-tree from the pinned commit in `../UPSTREAM.md`.

## How the port uses these

`derived_test.go` iterates this
directory and asserts the Go engine matches upstream — with one
deliberate exception: for `CRASH:` fixtures, the Go port is required
to return a typed `FunctionError`, not panic. The crash detail is
recorded for future bumps so we can spot if upstream eventually fixes
the underlying bug.
