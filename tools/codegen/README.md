# codegen

This is a code generation tool used internally to generated code from OpenAPI specifications. This is for internal use only and does not aim at implementing all features of OpenAPI specifications, just the ones needed to generate SDKs for our internal services.

## Rust runtime contract

The Rust generator emits API code but not the hand-written crate modules that host it. The host crate must provide all of these interfaces:

1. `error::Error` accepts both `serde_json::Error` and `reqwest::Error` through `From` so generated `?` expressions preserve serialization and request-building failures.
2. `http::Response<T>` exposes `body: T`, `status: reqwest::StatusCode`, and `headers: reqwest::header::HeaderMap`. Equivalent types from the `http` crate are compatible.
3. `http::send(RequestBuilder, Option<&SessionStorage>)` is async and returns `Result<(StatusCode, HeaderMap, B), Error>`, where `B` dereferences to `[u8]` and supports `to_vec()`; `Vec<u8>` and `bytes::Bytes` both satisfy the generated uses.
4. `http::build_client(reqwest::Client, &[Arc<dyn Middleware>]) -> ClientWithMiddleware` builds the middleware-aware client retained by the generated client.
5. `http::ClientWithMiddleware::request(reqwest::Method, String) -> reqwest::RequestBuilder` starts each generated request.
6. `http::Middleware` is object-safe because generated clients store `Arc<dyn Middleware>` values.
7. `middleware::SetRole { role: String }` and `middleware::SetHeaders { headers: HashMap<String, String> }` implement `http::Middleware`; their fields must be constructible by the generated module.
8. `session::SessionStorage` implements `Clone` and can be passed to `http::send` by shared reference.

The executable reference for this contract is the minimal crate in [`processor/rust/testdata/compile-fixture`](processor/rust/testdata/compile-fixture). `TestRustGeneratedOutputCompiles` copies that crate, renders every shared OpenAPI fixture into it, and runs `cargo check` plus Clippy. The test skips when Cargo is unavailable so Go-only development remains supported; the codegen Nix check includes Cargo, rustc, and Clippy so CI always enforces the contract.

Keeping status and headers is required even for bodyless operations: for example, a generated `HEAD` method has `T = ()`, and its headers are the operation's result.

## Regenerating shared goldens

Fixtures in `processor/testdata` feed both the TypeScript and Rust render tests. After changing a shared fixture, regenerate both golden sets before running the full suite:

```sh
go test ./tools/codegen/processor -run '^TestInterMediateRepresentationRender$' -update
go test ./tools/codegen/processor/rust -run '^TestRustRender$' -update
```
