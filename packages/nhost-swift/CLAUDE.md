# Nhost Swift SDK conventions

This package is a SwiftPM library package exposing the public module `Nhost`.

## Build and checks

- Use the repository Nix workflow as the source of truth: `make -C packages/nhost-swift check`.
- For direct SwiftPM checks, run through the Nix dev shell: `nix develop .#nhost-swift -c swift build` and `nix develop .#nhost-swift -c swift test --disable-swift-testing`.
- Keep `Package.swift` on Swift tools 6.0 unless the plan and Nix toolchain are updated together.

## Source layout

- `Sources/Nhost/Core` contains package-wide primitives.
- `Sources/Nhost/HTTP` contains request/response, errors, transport, and middleware pipeline contracts.
- `Sources/Nhost/Encoding` contains wire-format helpers used by generated clients.
- `Sources/Nhost/Generated` is reserved for OpenAPI output in later phases.

## Runtime and generated code

- Generated files must include a generated header, be deterministic, and never be hand-edited.
- When validating new generated files before commit, make them tracked or intent-to-add first; Nix flake checks do not include untracked files in the dirty-tree source snapshot.
- Hand-written runtime APIs should remain small, `Sendable` where practical, and usable from generated code without Foundation dependencies beyond the package baseline.
- REST clients use `NhostJSON.restEncoder` and `NhostJSON.restDecoder`; do not reuse that date strategy for arbitrary GraphQL or Functions user response decoding unless the caller explicitly opts in.
- Tests should use `StubTransport` or custom `HTTPTransport` implementations rather than performing network I/O.
- In async XCTest methods, await actor/storage values into local variables before passing them to `XCTAssert*`/`XCTUnwrap`; XCTest autoclosures are synchronous and reject `await` directly inside assertions.
