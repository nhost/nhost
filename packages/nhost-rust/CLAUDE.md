# nhost-rust — agent notes

Idiomatic async Rust SDK for Nhost (reqwest + reqwest-middleware + serde). The
public surface is Rust-native (builder, typed GraphQL, `Error` enum), not a
port of `@nhost/nhost-js`. There is no Rust rules document under
`.claude/docs/` (only Go and JS/TS); follow this file and the surrounding Rust
code for crate conventions.

## Two parts

1. **Generated** (`src/auth/client.rs`, `src/storage/client.rs`) — produced by
   the `rust` plugin in `tools/codegen` from the shared OpenAPI specs. **Never
   hand-edit.** Regenerate with `./gen.sh` (uses the `codegen` binary or
   `go run`, then `rustfmt --edition 2021`). Files carry a generated header and
   `#![allow(...)]` so they don't trip clippy. A generated Rust `Debug` impl
   redacts a property or request parameter when `x-nhost-sensitive` is present,
   or when `canContainSensitiveValue` accepts its schema and `sensitiveFieldName`
   matches its snake-cased raw name. The exact names are `api_key`,
   `authorization`, `code`, `code_verifier`, `cookie`, `credential`, `otp`,
   `password`, `private_key`, `secret`, `signature`, `ticket`, and `token`; the
   accepted suffixes are `_api_key`, `_code_verifier`, `_otp`, `_password`,
   `_private_key`, `_secret`, `_signature`, `_ticket`, and `_token`.
   `canContainSensitiveValue` rejects only schemas with exactly one type that is
   `boolean`, `integer`, or `number`; references, unions, and schemas without a
   type remain eligible. The extension check is presence-only, so even
   `x-nhost-sensitive: false` redacts. For a matching name, a schema change from
   `boolean` to `string` therefore adds redaction rather than removing it.
   Redaction is field-level: arbitrary values inside caller-controlled metadata,
   session variables, Hasura claims, and header maps are not inspected. This
   affects `Debug` only; serde must preserve real wire and persistence values.
   The hand-written `http::Response<T>` derives `Debug` with no wrapper-level
   redaction: it prints its header map verbatim and delegates its body to `T`'s
   `Debug`, including headers and payloads returned by caller-deployed functions.
   `GraphqlResponse<T>` likewise derives `Debug` and delegates `data` to `T`;
   its `GraphqlError` entries use the redaction described below. Do not
   debug-format either response wrapper when its unredacted values can contain
   credentials, tokens, cookies, or sensitive redirects. `ApiError` and
   `GraphqlOperationError` instead have redacting `Debug` implementations: they
   keep status, messages, error entries, header names, JSON field names, and
   non-sensitive values, while recursively redacting JSON values whose snake-
   or camel-cased names match the generated-model policy. `GraphqlError` applies
   the same recursive policy to `locations`, `path`, and `extensions`, except
   that the conventional non-secret `extensions.code` error classification
   remains visible. Error header values are redacted for `authorization`,
   `proxy-authorization`, `cookie`, `set-cookie`, `x-api-key`, `location`, and
   names ending in `-secret`
   or `-token`; a redacted `location` still shows that the redirect header was
   present but intentionally hides the entire URL. These policies cannot
   recognize secrets stored under arbitrary names, and human-readable error
   messages remain visible. Generated request methods, Functions response
   helpers, and `graphql::Operation::execute` return
   `Result<http::Response<T>, Error>` (with `execute` wrapping
   `GraphqlResponse<T>`), where `Response` carries `body`, `status`, and `headers`
   (void → `Response<()>`; use `.into_body()` when the metadata is not needed).
   OpenAPI `in: header` parameters are typed fields in the
   operation's `*Params` bundle and are applied per call by generated
   `to_headers()` code; `with_role`/`with_headers` clones remain available for
   headers that apply to every request made through the clone. Header precedence,
   most specific first, is: typed per-call/request-built header, scoped
   `with_role`/`with_headers` clone, admin-session role/session variables,
   builder default (`NhostBuilder::role`/`header`), then session bearer token.
   `SetRole`, `SetHeaders`, `AdminSession`, and `AttachToken` all record writes in
   the request's `MiddlewareHeaders` priority map. `SetRole` and `SetHeaders`
   require an explicit `HeaderPriority`; custom `from_clients` pipelines use
   `Default` for builder-equivalent global defaults and `Scoped` only for scoped
   clones. `HeaderPriority` declaration order is semantic because `Ord` selects
   the winner. `AdminSessionOptions::session_variables` are written after its
   dedicated secret and role at the same `Admin` priority, so colliding
   `admin-secret` or `role` keys override those dedicated fields. A header
   present on the request but absent from the map came from request construction
   and is never replaced. This deliberately keeps `.json()`'s `Content-Type:
   application/json` authoritative over scoped or builder header middleware;
   use the raw functions request API when sending a body with another media type.
2. **Hand-written runtime** — `error`, `http`, `middleware`, `session`,
   `graphql`, `functions`, the top-level builder (`client.rs`, re-exported from
   `lib.rs`), and `auth/pkce.rs`.

## Key design points

- **Middleware = `reqwest-middleware`.** Each middleware impls
  `reqwest_middleware::Middleware`; the trait future is `?Send` on `wasm32`.
  `crate::http::build_client` assembles a `ClientWithMiddleware` from a base
  `reqwest::Client` + an ordered `Vec<Arc<dyn Middleware>>`. Middleware is
  request-side only (attach token, refresh, role/headers/admin).
- **Session updates are NOT middleware.** A browser `reqwest::Response` cannot
  be rebuilt from buffered bytes, so the JS SDK's response-sniffing middleware
  is impossible on wasm. Instead `crate::http::send` buffers the response and,
  when the client carries a `session_sink` (only the auth client does), captures
  sessions from successful auth responses, clears them on `/signout` regardless
  of status, and clears them after a successful `/user/password` response. All
  session-store failures propagate to the auth call. Bare-session capture
  deliberately differs from the JS SDK: it keys on all four fields required by
  the OpenAPI `Session` schema (`accessToken`, `accessTokenExpiresIn`,
  `refreshToken`, and `refreshTokenId`) rather than requiring the optional
  `user`. This follows the service contract even when current service responses
  happen to include a user. The explicit four-field check is currently equivalent
  to successful `Session` deserialization because all four generated fields are
  required. It keeps the discriminator stable against generated-struct churn: if
  a future spec change makes a field optional, capture does not silently broaden.
  Capture deliberately examines every successful auth response rather than using
  the JS SDK's path allowlist. A flattened census of all 56 documented 2xx response
  shapes found that only `Session` itself has all four fields; Rust also gates on
  success and rejects undecodable JWTs while storing, so an allowlist would add no
  protection and would make future session-bearing endpoints silently stop being
  captured. Do not add one. An all-empty four-field session passes the shape gate,
  but the service constructs it only with `ErrInvalidRefreshToken` on a non-2xx
  response, and session JWT decoding would reject it on success; do not add a
  JS-style truthiness check.
- **Refresh:** the session-refresh middleware and `Nhost::refresh_session` use a
  retained, dedicated bare `Arc<auth::Client>` (no middleware or session sink),
  so refreshing doesn't recurse and `session::refresh_once` is the sole,
  unconditional owner of the successful refresh response's store write. This
  differs from the JS and Go SDKs: middleware installed only on the public auth
  client (including builder-default custom headers) does not run for an explicit
  `Nhost::refresh_session`. A custom `from_clients` refresh client must remain
  middleware-free; configure required default headers on its underlying
  `reqwest::Client`. Refreshes serialize via a `tokio::sync::Mutex` in
  `SessionStorage`.
  `SessionRefresh` still skips the exact normalized `<auth base>/token` URL
  because the public `auth::Client::refresh_token` method itself passes through
  the middleware. Without the guard, a direct call with an expired session first
  performs a middleware refresh and rotates the stored token, then submits the
  original request with the now-stale token. The
  `public_auth_refresh_token_does_not_trigger_recursive_pre_refresh` test guards
  this path by asserting that exactly one `/token` request is sent; its timeout
  additionally catches a `from_clients` re-entrancy hang. A path-suffix check is
  insufficient because the same middleware runs for every service and valid
  storage, GraphQL, or Functions paths may also end in `/token`. Middleware
  ordering is also load-bearing: builder defaults and scoped middleware run
  before `SessionRefresh`, making its `Authorization` check effective, while
  header priorities settle middleware-write conflicts. Auth, storage, GraphQL,
  and Functions all preserve this ordering. Consequently a builder-default
  `Authorization` disables automatic refresh for that client and allows its
  stored session to go stale; use one only with caller-managed token lifecycle.
- **Construction:** `service_url` and `Nhost::new` are fallible.
  `service_url` validates every derived or custom base URL through the same parse
  path: HTTP(S) only, host required, no userinfo/query/fragment, and all trailing
  slashes stripped (consumers append `/path`). Subdomain and region values allow
  only ASCII letters, digits, and hyphens. A service URL must be derivable (both
  subdomain and region, or neither for local dev) or explicitly overridden;
  empty, whitespace-only, or unsupported-character project fields are always
  rejected. Rejecting queries and fragments keeps service endpoints derived with
  `append_path` append-safe and predictable. The
  `tests/unit.rs::query_bearing_auth_url_is_rejected_at_construction` test guards
  this construction invariant directly. `Nhost::builder()` is the normal path;
  `Nhost::from_clients` (mirroring `new NhostClient(..)` in
  `@nhost/nhost-js`) takes the four service clients, the dedicated refresh auth
  client, and the session store for callers who assemble the pipeline
  themselves. `builder().build()` ends in
  `from_clients`, so there is one construction path. Each service client has a
  public `Client::new(url, reqwest, middleware)`, and the generated ones add
  `with_session_capture(sessions)` to enable the auth client's response-driven
  session updates. `service_url` is public so callers can derive validated
  cloud/local URLs.
- **`Backend` returns `Result`** (`Error::Storage` on file/localStorage I/O);
  don't silently swallow errors. Persisted `decodedToken` values are a cache,
  not an authority: `SessionStorage::get` re-decodes the access token so refresh
  scheduling, SDK session accessors, and reserialization agree even when a
  built-in or custom backend returns edited persisted JSON. Session storage
  requires an integer `exp` after the Unix epoch and a positive,
  millisecond-representable `accessTokenExpiresIn`. Absolute client time is not
  used to reject a server-issued expiry because clock skew is indistinguishable
  from an unusual claim. A newly received token with `iat` is scheduled from
  local receipt for the smaller of the issuer-clock `exp - iat` duration and
  `accessTokenExpiresIn`. For a newly received token without `iat`, and for any
  session loaded from persistence (which has no trustworthy receipt time), the
  deadline is the earlier of absolute `exp` and one advertised lifetime from
  local observation. This deliberately favors one possibly unnecessary refresh
  under a fast client clock over attaching a potentially stale bearer; after an
  accepted refresh without `iat`, the deadline is receipt-anchored to the
  advertised lifetime so the clock mismatch cannot hot-loop. The advertised
  cap prevents a slow clock from creating a never-refresh schedule.
  Invalid tokens surface `Error::InvalidToken` through `SessionStorage::get`.
  A `Backend::get` failure fails the request
  (`Error::Middleware` wrapping `Error::Storage`) in both `SessionRefresh` and
  `AttachToken`. Refresh retries are phase-based rather than error-variant-based:
  once a 2xx refresh response is observed, body-read, decode, and storage
  failures are returned without another request. Storage failures before the
  request are also returned immediately. An undecodable 2xx reaches the caller
  as `Error::Json`, not `Ok(None)`. This
  prevents an observed-successful rotation from re-submitting its consumed
  token. A response lost after the server commits is indistinguishable from a
  pre-acceptance transport failure, and a proxy 5xx cannot reveal whether the
  origin committed; both remain retryable and require a server-side rotation
  grace window to close safely. On browser builds, `detect_storage`
  falls back to `MemoryStorage` when a `localStorage` handle cannot be obtained at
  construction; if an obtained handle's later `get_item` call fails (for example,
  access is revoked), that read does reach this error path.
- **`Error` is a real enum** (`Api(Box<ApiError>)`,
  `GraphQl(Box<GraphqlOperationError>)`, `InvalidToken`, `Config`, `Storage`,
  `Http`, `Middleware`, `Json`). Boxed response errors keep `Result<_, Error>`
  small (there's a `<= 32` size test). For `ApiError`, a message extracted from
  a recognized JSON response body takes precedence; unstructured non-JSON
  bodies are retained but never promoted to the message. A trimmed, non-blank
  `X-Error` header is the fallback when the body has no recognized message.
  Response-derived messages use only the first line, omit control characters,
  and are capped at 200 characters plus an ellipsis. This preserves the reason
  from bodyless storage HEAD errors, which storage reports only through
  `X-Error`. Non-empty response bodies are retained for every error status,
  including 412. All of the JS SDK's generated clients (auth and storage)
  instead discard every 412 body because their shared generated template
  hardcodes that rule, while its hand-written functions client retains a user
  function's 412 body. Auth emits no 412 and storage's 412 response variants
  contain headers only, so this generated-client divergence is unreachable
  against Nhost services in practice. `GraphqlOperationError` retains structured
  entries,
  partial JSON data, status, and headers; `GraphqlError::code()` reads the
  conventional string `extensions.code`. For GraphQL requests, a non-empty
  body-level `errors` array takes precedence over a 3xx status other than 304,
  or a 4xx/5xx status; otherwise those statuses become `Error::Api`.
  `Operation::send` checks raw errors before decoding typed data, while
  `execute` returns `http::Response<GraphqlResponse<T>>`: the body is the full
  `data` + `errors` envelope and the outer response retains transport status and
  headers. This precedence deliberately requires GraphQL to bypass `http::send`
  and call `http::send_buffered` directly; changes to `send`'s status mapping
  therefore do not reach the GraphQL client.
- **Deferred GraphQL variable errors.** `Operation::variables` and `variable`
  store `Result<Variables, serde_json::Error>` so their builder API remains
  `-> Self`; `execute()` and `send()` both return `Error::Json` before building
  a request because they share the same raw execution path.
  Merging a named variable into non-object variables records an error rather
  than silently doing nothing. A later `variables()` call replaces the prior
  value or error completely.
- **Multipart and binary generated shapes.** A module with binary multipart
  fields gets `FilePart { file_name: String, content: Vec<u8>, content_type:
  Option<String> }`; callers supply the filename. On upload, hasura-storage
  falls back to the parsed multipart filename when `metadata.name` is empty. On
  replace, any metadata part overwrites that filename unconditionally, including
  with an empty name.
  (Go's multipart parser strips directory components before storage.)
  `application/octet-stream` responses are `Response<bytes::Bytes>`, reusing
  the buffer owned by `http::send`, as `functions::send` does.
- **Request-parameter bundle optionality.** URL builders decide on query
  parameters alone, since they cannot send headers; request methods use query
  and header parameters together. A params value is optional only when all
  parameters considered for that method are optional.
- **URL construction.** The crate depends directly on `url` because URL
  construction is part of its own cloud-host and request-path logic, not merely
  a reqwest implementation detail. Append paths with `http::append_path`, which
  uses `Url::path_segments_mut().push()` semantics; never use `Url::join` (it
  replaces a base URL's final path segment) or concatenate paths with `format!`.
  Generated clients pass raw OpenAPI path parameters as individual segments, so
  slashes and query markers are encoded without crossing URL components.
  `Url::path_segments_mut().push()` percent-encodes `%` as `%25` and `/` as
  `%2F`, so a path parameter cannot introduce a separator or survive as a
  percent-encoded dot spelling. It does not normalize dot segments: it silently
  discards a segment exactly equal to `.` or `..`. `http::append_path` maps those
  two values to `%2E`/`%2E%2E` so `push()` preserves them as `%252E`/`%252E%252E`
  instead of dropping the segment; `push()`'s unconditional escaping, not that
  mapping, prevents traversal. Dot-segment normalization is a property of
  `Url::parse`/`set_path`, which is why pre-encoding followed by `set_path()` is
  unsafe. An empty path parameter remains an empty trailing segment (for example,
  `delete_file("")` requests `/files/`), so callers must validate identifiers
  when an item operation could otherwise resolve to a collection route. The
  generator's `urlencode` helper remains only for redirect query strings.
- **Cloud host labels.** Subdomain and region are single 1-63 byte ASCII DNS
  labels with alphanumeric endpoints. Unicode/IDNA input is deliberately
  rejected instead of being silently converted to punycode; Nhost cloud project
  identifiers are canonical ASCII values.
- clippy runs with `-D warnings` on the hand-written code (generated is
  allow-all).

## Feature matrix (TLS + wasm)

- TLS is crate-selected. reqwest 0.13 renamed its pure-Rust backend feature to
  `rustls`; our `rustls-tls` (default) forwards to `reqwest/rustls`, `native-tls`
  to `reqwest/native-tls`. Base reqwest pulls `json`+`multipart`+`form`+`query`
  (the last two are feature-gated in 0.13 and used by generated clients).
- The `wasm` feature targets the browser (`wasm32-unknown-unknown`). The wasm
  `reqwest::Client` state is `Send + Sync`; only its futures are `!Send`. The
  sole `!Send` state is `web_sys::Storage` in `LocalStorage`, so
  `session.rs` has a **`#[cfg(all(feature = "wasm", target_arch = "wasm32"))]
  unsafe impl Send + Sync for SessionStorage`** (sound: wasm32 is
  single-threaded). The target gate is essential because Cargo features also
  apply to native builds. This lets every middleware/client satisfy
  `Middleware: Send + Sync` on both targets and keeps the cfg-splits minimal:
  - `Backend`/`ChangeCallback` drop `Send + Sync` only under
    `all(feature = "wasm", target_arch = "wasm32")`;
  - `#[cfg_attr(target_arch = "wasm32", async_trait(?Send))]` on every
    `Middleware` impl (matching reqwest-middleware);
  - `std::time` → `web_time`; `FileStorage` is gated off only on
    wasm32-with-`wasm` and remains available to callers on native builds with the
    `wasm` feature enabled. `LocalStorage`
    (`cfg(all(feature = "wasm", target_arch = "wasm32"))`, key `"nhostSession"`)
    is gated on there. `detect_storage` returns `LocalStorage` on
    wasm32-with-`wasm` and `MemoryStorage` in every other configuration; it never
    selects `FileStorage`;
  - crate-level `#![cfg_attr(all(feature = "wasm", target_arch = "wasm32"),
    allow(clippy::arc_with_non_send_sync))]`.
- getrandom on wasm: `.cargo/config.toml` sets `--cfg getrandom_backend="wasm_js"`.
- The nix check builds the whole matrix: clippy (rustls), `native-tls` build,
  clippy (wasm), and a real `wasm32-unknown-unknown` build (needs the devshell's
  wasm32 std — not available in a bare sandbox). Its wasm checks are:

  ```sh
  cargo clippy --offline --lib --tests --no-default-features --features wasm -- -D warnings
  cargo build --offline --target wasm32-unknown-unknown --no-default-features --features wasm
  cargo test --offline --test unit --no-default-features --features wasm
  ```

  The clippy command runs natively; the separate build exercises the wasm32
  target. A `cargo clippy --target wasm32-unknown-unknown` form needs the
  devshell's wasm32 std, and `--all-targets` pulls native-only dev-dependencies
  (`tokio` rt/net and `wiremock`) that do not compile for wasm32.

## Tests

- The full Nix check requires the local backend: run `make dev-env-up`, then
  `make check`, and finish with `make dev-env-down`. `make check` builds
  `.#checks.<system>.nhost-rust`; it checks generated-client staleness, formatting,
  rustls clippy, a native-tls library build, wasm clippy (including tests), a real
  `wasm32-unknown-unknown` build, default and native wasm-feature unit tests,
  doctests, and the backend integration tests. Every doctest must remain fenced
  `no_run`: the eight current doctests are compile-only, which keeps the doctest
  step hermetic.
  `make check` runs while the local backend is up, so an executable doctest
  could make live requests. The derivation creates an empty output directory;
  its value is the exit status, not a build artifact. `make build` is not a
  substitute and fails because this check-only project intentionally has no
  `packages.<system>.nhost-rust` output.
- The integration tests reach the host backend because the check derivation sets
  `__noChroot`. Nix honours that flag only for a trusted user when
  `sandbox = relaxed`; with `sandbox = true`, Nix silently ignores the flag and
  the integration step cannot reach the host backend.
- Seed a temporary downstream crate with this package's `Cargo.lock` before an
  offline compile; fresh offline resolution can select an unavailable or yanked
  transitive release even when the package itself builds offline.
- Offline: `cargo test --offline --lib --test unit` (pkce, service URLs via the
  builder, JWT decode, graphql/functions/error via wiremock, scoped
  `with_role`/`with_headers`).
  When changing middleware header precedence, test against `AttachToken` and
  `AdminSession`, not just `SetRole`/`SetHeaders`: they write headers too, and
  `without_session_management()` in a test hides both. Give copied-crate mutation
  tests an isolated `CARGO_TARGET_DIR`; sharing the production target can make a
  later production command execute a scratch-built test binary until a forced
  rebuild.
- Integration: `tests/integration.rs`, gated on `NHOST_LOCAL_BACKEND`; hits the
  local backend (signup, graphql `__typename`, storage upload, functions
  `/echo`) with `Nhost::new("local", "local").expect("static configuration")`. Run
  `make dev-env-up` from `packages/nhost-rust` before the tests and
  `make dev-env-down` there afterward.
