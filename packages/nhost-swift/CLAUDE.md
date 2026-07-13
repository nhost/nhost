# Nhost Swift SDK conventions

This package is a SwiftPM library package exposing the public module `Nhost`.

## Build and checks

- Use the repository Nix workflow as the source of truth: `make -C packages/nhost-swift check`. The `nhost-swift` flake check is currently exposed on `x86_64-linux`, not Apple hosts; on Apple hosts run the direct Nix-shell SwiftPM checks below and rely on the Linux CI/full gate for the derivation.
- For direct SwiftPM checks, run through the Nix dev shell from this package directory: `nix develop .#nhost-swift -c swift build` and `nix develop .#nhost-swift -c swift test --disable-swift-testing` (or pass `--package-path packages/nhost-swift` from the repository root).
- Integration tests under `Tests/NhostIntegrationTests` run against the local backend started with `make -C packages/nhost-swift dev-env-up`, mirroring `packages/nhost-js`; keep URL/env overrides documented in `README.md`.
- Keep `Package.swift` on Swift tools 6.0 unless the plan and Nix toolchain are updated together.

## Source layout

- `Sources/Nhost/Core` contains package-wide primitives, including the CryptoKit-backed SHA-256 helper and its pure-Swift Linux fallback. Keep the package dependency-free because the Nix `package` derivation builds without network access for SwiftPM.
- `Sources/Nhost/HTTP` contains request/response, errors, transport, and middleware pipeline contracts.
- `Sources/Nhost/Encoding` contains wire-format helpers used by generated clients.
- `Sources/Nhost/Auth` contains hand-written auth helpers such as PKCE; shared hashing belongs in Core.
- `Sources/Nhost/Storage` contains hand-written storage helpers. `StorageClientStreaming.swift` mirrors the generated `uploadFiles` multipart wire layout exactly (bucket-id, file[], metadata[]); `StorageStreamingTests.testStreamingUploadMatchesGeneratedWireFormatForDataSources` guards against drift — keep it passing when the storage OpenAPI spec changes.
- `Sources/Nhost/Generated` is reserved for OpenAPI output in later phases.

## Runtime and generated code

- Generated files must include a generated header, be deterministic, and never be hand-edited.
- When validating new generated files before commit, make them tracked or intent-to-add first; Nix flake checks do not include untracked files in the dirty-tree source snapshot.
- Hand-written runtime APIs should remain small, `Sendable` where practical, and usable from generated code without Foundation dependencies beyond the package baseline.
- REST clients use `NhostJSON.restEncoder` and `NhostJSON.restDecoder`; do not reuse that date strategy for arbitrary GraphQL or Functions user response decoding unless the caller explicitly opts in.
- Unit tests should use `StubTransport` or custom `HTTPTransport` implementations rather than performing network I/O; integration tests are the only networked tests and target the local backend by default.
- README ```swift code blocks are executable documentation: each must appear verbatim (modulo indentation and `import`lines) in`Tests/NhostIntegrationTests/ReadmeExamplesTests.swift`, which runs them against the local backend; `testReadmeSwiftCodeBlocksAppearVerbatimInThisFile` enforces the link, so update both sides together.
- In async XCTest methods, await actor/storage values into local variables before passing them to `XCTAssert*`/`XCTUnwrap`; XCTest autoclosures are synchronous and reject `await` directly inside assertions.
