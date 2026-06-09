# Nhost Swift SDK

This package contains the in-progress Swift 6 SDK for Nhost. It exposes the public SwiftPM module `Nhost` and currently ships the hand-written runtime contract that future generated Auth and Storage REST clients will target.

## Development

Use the repository Nix workflow:

```sh
make -C packages/nhost-swift check
nix develop .#nhost-swift -c swift build
nix develop .#nhost-swift -c swift test --disable-swift-testing
```

The package declares Apple platforms iOS 15, macOS 12, tvOS 15, and watchOS 8. The authoritative portable check runs under the Nix-provided Swift 6 toolchain on Linux.

## Runtime contract

Generated clients should use the runtime helpers under `Sources/Nhost` instead of reimplementing transport or encoding behavior:

- `JSONValue` for untyped JSON maps, variables, and decoded error bodies.
- `NhostResponse<T>`, `NhostRawResponse`, `NhostHTTPError`, and `FetchError` for response metadata and structured failures.
- `NhostJSON.restEncoder` and `NhostJSON.restDecoder` for REST payloads, including RFC3339 dates with or without fractional seconds.
- `FetchFunction`, `ChainFunction`, `NhostFetchPipeline`, `HTTPTransport`, `URLSessionTransport`, and `StubTransport` for request execution and middleware.
- Query, header, urlencoded, multipart, binary, and redirect URL helpers for OpenAPI wire-format support.

Generated Swift files will live under `Sources/Nhost/Generated/` in later phases. They must be regenerated from OpenAPI inputs and never edited by hand.
