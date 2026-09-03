# codegen

This is a code generation tool used internally to generated code from OpenAPI specifications. This is for internal use only and does not aim at implementing all features of OpenAPI specifications, just the ones needed to generate SDKs for our internal services.

## Rust runtime contract

The Rust generator emits API code but not the hand-written crate modules that host it. The host crate must provide all of these interfaces:

1. `error::Error` provides `Config(String)` and accepts both `serde_json::Error` and `reqwest::Error` through `From`. Generated multipart code uses `Config` for caller-provided invalid MIME types, while other `?` expressions preserve serialization and request-building failures.
2. `http::Response<T>` exposes `body: T`, `status: S`, and `headers: reqwest::header::HeaderMap`. The status type `S` must match the first tuple element returned by `http::send`; both `u16` (used by the Nhost Rust SDK) and `reqwest::StatusCode` satisfy the generated uses.
3. `http::send(RequestBuilder, Option<&SessionStorage>)` is async and returns `Result<(S, HeaderMap, B), Error>`, where `S` is the type of `Response::status`, and `B` dereferences to `[u8]` and supports `to_vec()`; `Vec<u8>` and `bytes::Bytes` both satisfy the generated uses.
4. `http::append_path(&str, &[&str]) -> Result<url::Url, Error>` appends the generated path segments and is accessible from the generated module.
5. `http::build_client(reqwest::Client, &[Arc<dyn Middleware>]) -> ClientWithMiddleware` builds the middleware-aware client retained by the generated client.
6. `http::ClientWithMiddleware::request<U: reqwest::IntoUrl>(reqwest::Method, U) -> reqwest::RequestBuilder` accepts the `url::Url` returned by `append_path` and starts each generated request.
7. `http::Middleware` is object-safe because generated clients store `Arc<dyn Middleware>` values.
8. `middleware::SetRole { role: String }` and `middleware::SetHeaders { headers: HashMap<String, String> }` implement `http::Middleware`; their fields must be constructible by the generated module.
9. `session::SessionStorage` implements `Clone` and can be passed to `http::send` by shared reference.

The executable reference for this contract is the minimal crate in [`processor/rust/testdata/compile-fixture`](processor/rust/testdata/compile-fixture). `TestRustGeneratedOutputCompiles` copies that crate, renders every shared OpenAPI fixture into it, and runs `cargo check` plus Clippy. The test skips when Cargo is unavailable so Go-only development remains supported; the codegen Nix check includes Cargo, rustc, and Clippy so CI always enforces the contract.

Keeping status and headers is required even for bodyless operations: for example, a generated `HEAD` method has `T = ()`, and its headers are the operation's result.

## Regenerating shared goldens

Fixtures in `processor/testdata` feed both the TypeScript and Rust render tests. After changing a shared fixture, regenerate both golden sets before running the full suite:

```sh
go test ./tools/codegen/processor -run '^TestInterMediateRepresentationRender$' -update
go test ./tools/codegen/processor/rust -run '^TestRustRender$' -update
```
