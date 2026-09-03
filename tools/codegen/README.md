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
8. `middleware::HeaderPriority` has a `Scoped` variant. `middleware::SetRole { role: String, priority: HeaderPriority }` and `middleware::SetHeaders { headers: HashMap<String, String>, priority: HeaderPriority }` implement `http::Middleware`; all fields must be constructible by the generated module, which sets `priority` to `HeaderPriority::Scoped`.
9. `session::SessionStorage` implements `Clone` and can be passed to `http::send` by shared reference.

The executable reference for this contract is the minimal crate in [`processor/rust/testdata/compile-fixture`](processor/rust/testdata/compile-fixture). `TestRustGeneratedOutputCompiles` copies that crate, renders every shared and Rust-specific OpenAPI fixture into it, and runs `cargo check` plus Clippy. The test skips when Cargo is unavailable so Go-only development remains supported; the codegen Nix check includes Cargo, rustc, and Clippy so CI always enforces the contract. Changes to generated runtime requirements must update both the compile fixture and this list.

Keeping status and headers is required even for bodyless operations: for example, a generated `HEAD` method has `T = ()`, and its headers are the operation's result.

## Rust OpenAPI extensions

- `x-rust-type` overrides the generated type for scalar and typed-map schemas. Its value is emitted verbatim as a Rust type expression; the generator does not validate the expression or add an import. The host crate must make the path resolve and ensure the type satisfies the traits and methods required where that schema is used, such as Serde traits, `Clone`, `Debug`, or `ToString`.
- The presence of `x-nhost-sensitive` on an object property or query/header parameter schema forces its value to be rendered as `<redacted>` by the generated `Debug` implementation. The marker's value is ignored. The generator also redacts string-like fields and parameters whose names match its built-in credential vocabulary.

## Rust validation and type behavior

- Names that normalize to the same generated Rust type, field, client method, parameter field, or method argument are rejected instead of producing colliding identifiers.
- A type containing multipart binary fields is rejected when the same type is used in any generated non-multipart context; `FilePart` is only valid for `multipart/form-data` request bodies.
- Nullability of array items and typed-map values is preserved with `Option<T>` on the container member.
- Spec-derived text emitted as a Rust string literal, including wire names and static path segments, is escaped as Rust source.

## Regenerating shared goldens

Fixtures in `processor/testdata` feed both the TypeScript and Rust render tests. After changing a shared fixture, regenerate both golden sets before running the full suite:

```sh
go test ./tools/codegen/processor -run '^TestInterMediateRepresentationRender$' -update
go test ./tools/codegen/processor/rust -run '^TestRustRender$' -update
```
