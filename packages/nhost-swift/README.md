# Nhost Swift SDK

Swift 6 SDK for Nhost applications. The package exposes the public SwiftPM
module `Nhost`, generated Auth and Storage REST clients, session management,
GraphQL and Functions clients, and portable test/runtime helpers.

## Installation

Add the package from a checkout of this repository while registry publishing is
out of scope:

```swift
// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "MyApp",
    platforms: [.iOS(.v15), .macOS(.v12), .tvOS(.v15), .watchOS(.v8)],
    dependencies: [
        .package(path: "../nhost/packages/nhost-swift"),
    ],
    targets: [
        .target(
            name: "MyApp",
            dependencies: [
                .product(name: "Nhost", package: "nhost-swift"),
            ]
        ),
    ]
)
```

In this repository, use the Nix workflow as the source of truth:

```sh
make -C packages/nhost-swift check
nix develop .#nhost-swift -c swift build
nix develop .#nhost-swift -c swift test --disable-swift-testing
```

The package declares iOS 15, macOS 12, tvOS 15, and watchOS 8. The portable
check runs with the Nix-provided Swift 6 toolchain on Linux; Apple destination
builds run in supplementary CI.

## Create a client

Create a client from a Nhost project subdomain and region:

```swift
import Foundation
import Nhost

let nhost = createClient(
    NhostClientOptions(
        subdomain: "my-project",
        region: "eu-central-1"
    )
)
```

For local development or custom deployments, pass service URLs explicitly:

```swift
let local = createClient(
    NhostClientOptions(
        authURL: URL(string: "http://localhost:1337/v1")!,
        storageURL: URL(string: "http://localhost:1337/v1/storage")!,
        graphqlURL: URL(string: "http://localhost:1337/v1/graphql")!,
        functionsURL: URL(string: "http://localhost:1337/v1/functions")!,
        defaultHeaders: ["x-app-version": "1.0.0"],
        role: "user"
    )
)
```

Use `createClient` for app clients with automatic session refresh and token
attachment. Use `createNhostClient` when you want the generated clients without
session middleware, and `createServerClient` only in trusted/server-style code
with explicit custom session storage.

## Auth and sessions

Generated Auth methods return `NhostResponse<T>`, preserving status and headers
alongside the decoded body. (`signInEmailPassword` works the same way for
existing users.)

```swift
let email = "ada-\(UUID().uuidString.lowercased())@example.com"
let password = UUID().uuidString

let signUp = try await nhost.auth.signUpEmailPassword(
    body: AuthSignUpEmailPasswordRequest(
        email: email,
        password: password,
        options: AuthSignUpOptions(
            displayName: "Ada Lovelace",
            metadata: ["favoriteNumber": .number(7)]
        )
    )
)

let session = signUp.body.session
print("signed in with token expiring in \(session?.accessTokenExpiresIn ?? 0)s")

let stored = try await nhost.getUserSession()
let defaultRole = stored?.decodedToken.hasuraClaims?["x-hasura-default-role"]?.stringValue
let userID = session?.user?.id ?? ""
```

`createClient` stores Auth responses in the configured session store, refreshes
sessions before service requests, and attaches `Authorization: Bearer <token>`
unless a request already has an Authorization header.

## GraphQL

GraphQL accepts raw query strings, optional variables, and an optional operation
name. Decoding uses a neutral `JSONDecoder` by default so user response models do
not inherit REST date-decoding behavior unless you opt in.

```swift
struct UserRow: Decodable, Sendable {
    let id: String
    let displayName: String
}

struct UsersData: Decodable, Sendable {
    let users: [UserRow]
}

let users = try await nhost.graphql.request(
    UsersData.self,
    query: """
    query Users($limit: Int!) {
      users(limit: $limit) { id displayName }
    }
    """,
    variables: ["limit": .number(10)],
    operationName: "Users"
)

print(users.body.data?.users ?? [])
```

Mutations use the same API:

```swift
struct UpdatedUser: Decodable, Sendable {
    let id: String
    let displayName: String
}

struct UpdateUserData: Decodable, Sendable {
    let updateUser: UpdatedUser?
}

let updated = try await nhost.graphql.request(
    UpdateUserData.self,
    query: """
    mutation UpdateDisplayName($id: uuid!, $displayName: String!) {
      updateUser(pk_columns: { id: $id }, _set: { displayName: $displayName }) {
        id
        displayName
      }
    }
    """,
    variables: ["id": .string(userID), "displayName": .string("Ada King")],
    operationName: "UpdateDisplayName"
)

print(updated.body.data?.updateUser?.displayName ?? "")
```

If a GraphQL response contains `errors`, the client throws
`GraphQLExecutionError` with status, headers, raw body, decoded errors, and any
partial `data` value.

### Persistent GraphQL response caching

The GraphQL cache is an opt-in, persistent cache of complete raw query response
bodies. It is not a normalized entity cache: overlapping queries are independent,
and mutations and subscriptions are never cached or invalidated automatically.
Enable it when constructing a client; existing calls remain `.networkOnly` by
default even after configuration:

```swift
let cachedNhost = createClient(
    NhostClientOptions(
        subdomain: "my-project",
        region: "eu-central-1",
        graphqlCache: GraphQLCacheConfiguration()
    )
)
```

The default file store is created lazily. Merely configuring it, or making a
`.networkOnly` request, does not initialize the cache, consult the clock, or emit
cache diagnostics. You can customize `freshnessTTL`, `staleIfErrorInterval`,
`maximumTotalBytes`, `maximumEntryBytes`, `maximumEntries`, `directoryURL`,
`fileProtection`, `purgePreviousScopeOnSignOut`, `store`, `scopeResolver`, and a
privacy-sanitized `diagnosticObserver`.

Default values are:

| Setting                                                      | Default                                |
| ------------------------------------------------------------ | -------------------------------------- |
| Freshness TTL                                                | 5 minutes                              |
| Additional stale-if-error interval                           | 24 hours after the fresh period        |
| Total size                                                   | 50 MiB                                 |
| Per-entry size                                               | 5 MiB                                  |
| Entry count                                                  | 1,000                                  |
| Apple file protection                                        | `completeUntilFirstUserAuthentication` |
| Purge previous managed scope on sign-out/session replacement | enabled                                |

Freshness is measured from the last successful write, not last access. An entry
is fresh at `age <= freshnessTTL`, and stale fallback is allowed at
`freshnessTTL < age <= freshnessTTL + staleIfErrorInterval`. Clock rollback
clamps age to zero and reports a sanitized diagnostic.

#### Single-response policies

Select behavior per request with `GraphQLCacheRequestOptions`; `namespace` and
`tags` add invalidation/key dimensions but can never replace authorization,
endpoint, operation, query, or variables isolation.

| Policy          | Behavior                                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `.networkOnly`  | Legacy network behavior and no cache work. This is always the default.                                                 |
| `.cacheOnly`    | Returns a fresh, compatible entry without network I/O; every cache-side failure is thrown.                             |
| `.cacheFirst`   | Returns a fresh compatible entry, otherwise makes one network request and caches an eligible success best-effort.      |
| `.networkFirst` | Makes one network request first and falls back within the fresh-plus-stale window **only** for `FetchError.transport`. |

```swift
let cachedUsers = try await nhost.graphql.request(
    UsersData.self,
    query: """
    query Users($limit: Int!) {
      users(limit: $limit) { id displayName }
    }
    """,
    variables: ["limit": .number(10)],
    operationName: "Users",
    cacheOptions: GraphQLCacheRequestOptions(
        policy: .cacheFirst,
        namespace: "people",
        tags: ["profile"]
    )
)

let offlineUsers = try await nhost.graphql.request(
    UsersData.self,
    query: """
    query Users($limit: Int!) {
      users(limit: $limit) { id displayName }
    }
    """,
    variables: ["limit": .number(10)],
    operationName: "Users",
    cacheOptions: GraphQLCacheRequestOptions(
        policy: .cacheOnly,
        namespace: "people",
        tags: ["profile"]
    )
)

print(cachedUsers.body.data?.users ?? [])
print(offlineUsers.body.data?.users ?? [])
```

`.cacheOnly` throws `GraphQLCacheError` for an unconfigured cache, a miss, an
expired or decoder-incompatible entry, an ineligible operation, key/scope or
configuration failure, store failure, or authorization scope change. A mutation,
subscription, malformed document, or ambiguous multi-operation document is
ineligible. Network-capable policies bypass caching for ineligible operations or
an unavailable cache setup and retain legacy network behavior.

`.networkFirst` never serves fallback for cancellation, HTTP responses (including
401/403), invalid responses, encoding/decoding failures, or
`GraphQLExecutionError`; only `FetchError.transport` is eligible. If cache
fallback also fails, the original transport error remains primary. Cache reads
re-decode the raw body with the decoder supplied to the current call. An
incompatible entry is evicted; recoverable policies continue to the network.

Only conservatively selected GraphQL queries can be written. A response is
persisted only after a 2xx response, no GraphQL execution errors, and successful
caller-model decoding. Exact query UTF-8 and canonical variables are keyed, so
query whitespace changes and absent versus present-empty variables remain
distinct. Non-2xx decodable envelopes and partial GraphQL error responses preserve
the normal API behavior but are not cached.

#### Stale while revalidate

`staleWhileRevalidate` is a network-capable stream. With caching enabled it can
emit one fresh-or-stale `.cached` value immediately, performs exactly one refresh,
and then emits `.fresh`. With no eligible cached value it emits only `.fresh`.
The refresh error is delivered unchanged after any cached emission. Passing
`.networkOnly`, using an unconfigured/opaque-fetch client, or selecting an
ineligible operation produces one uncached fresh network value; `.cacheOnly` does
not suppress the refresh performed by this separate streaming API.

Each emission includes `GraphQLCacheMetadata`: source, creation and last-write
times, age, expiry state, stored HTTP status, and a sanitized persistence outcome
(`stored`, `notAttempted`, `skipped`, or `failedAndReported`). Cancelling the
consumer task cancels the producer, prevents later emissions, and prevents a
cache commit when cancellation is observed before the atomic file replacement.
A commit that already reached that atomic point cannot be undone retroactively.

A SwiftUI `.task` automatically cancels its stream consumption when the view
disappears:

```swift
struct CachedUsersView: View {
    struct CachedUser: Decodable, Sendable {
        let id: String
        let displayName: String
    }

    struct CachedUsersData: Decodable, Sendable {
        let users: [CachedUser]
    }

    let graphql: GraphQLClient
    @State private var users: [CachedUser] = []
    @State private var errorMessage: String?

    var body: some View {
        List(users, id: \.id) { user in
            Text(user.displayName)
        }
        .overlay {
            if let errorMessage { Text(errorMessage) }
        }
        .task {
            do {
                for try await result in graphql.staleWhileRevalidate(
                    CachedUsersData.self,
                    query: "query Users { users { id displayName } }",
                    operationName: "Users",
                    cacheOptions: GraphQLCacheRequestOptions(
                        policy: .cacheFirst,
                        namespace: "people"
                    )
                ) {
                    switch result {
                    case let .cached(response, _), let .fresh(response, _):
                        users = response.body.data?.users ?? []
                    }
                }
            } catch is CancellationError {
                // View disappearance cancelled the refresh.
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
```

#### Authorization isolation and middleware

Every cache key protects the endpoint, selected operation/name, exact query,
variables, and authorization context. Managed-session isolation includes the
user, stable token claims (all claims except top-level `iat` and `exp`), effective
role, and Hasura session variables. Explicit `Authorization`, admin secret,
admin role/session variables, and other protected/vary headers are isolated too.
Admin-context queries are cacheable when scope derivation succeeds, but admin
credentials must never be shipped in an untrusted app.

Effective role precedence is: per-call `x-hasura-role`, admin-session role,
`defaultHeaders["x-hasura-role"]`, configured `role`, then the token default
role. Header names are matched case-insensitively. If authorization state changes
while a cache-enabled read, request, or stream is in flight, it fails closed with
`GraphQLCacheError.authorizationScopeChanged`; the mismatched response is not
returned, emitted, or persisted. Diagnostics distinguish a final-header mismatch
(`protectedRequestStateChanged`) from a session epoch/fingerprint mismatch
(`sessionAuthorizationChanged`). If the current session snapshot temporarily
cannot be read, the SDK does not report a confirmed scope change: cache-only
throws `GraphQLCacheError.unavailableScope`, while network-capable APIs return the
successful network response without persisting it and report an
`unavailableScope` diagnostic.

Custom middleware makes cache association unavailable unless
`GraphQLCacheConfiguration.scopeResolver` returns a
`GraphQLCacheCustomScope`. The resolver is preflight-only: its identifier and
exact protected/vary header expectations augment mandatory SDK dimensions, and
the SDK verifies them against the final request. Returning `nil` bypasses caching;
a resolver cannot replace SDK-derived isolation. Final request association also
requires exactly one matching terminal POST. Synthetic responses, extra terminal
calls, or URL/body/method rewrites keep the legacy network result but skip cache
association and report a sanitized diagnostic.

`GraphQLClient(url:fetch:)` and `GraphQLClient(baseURL:fetch:)` take opaque fetch
closures whose final request cannot be verified, so they remain network-only and
cannot be made cacheable by a resolver. Use the transport-and-middleware
initializer or an Nhost client factory for caching. Offline reads do not execute
session refresh or arbitrary middleware. Custom session backends are re-read,
but the SDK cannot observe a complete out-of-band A→B→A session transition that
occurs entirely between two SDK reads.

By default, managed sign-out, password change, `clearSession`, or a semantic user
or claims replacement queues best-effort deletion of the previous protected
scope and all user-associated scopes. Stable token refreshes that only change
`iat`/`exp` do not purge. Set `purgePreviousScopeOnSignOut: false` to disable this
hygiene. Authorization isolation never depends on deletion succeeding.

#### Invalidation and pruning

Use `client.graphql.cache` for explicit management. Every non-`nil` field is
combined with logical AND; an empty filter removes every entry in that store.
`createdAtOrBefore` and `lastSuccessfulWriteAtOrBefore` are inclusive and do not
use last access. `invalidate` returns the number removed, while `prune` applies
configured count and byte limits immediately. Explicit management and
`.cacheOnly` surface store failures rather than hiding them.

`.current` targets the protected scope derived for a synthetic
`query NhostCacheScope { __typename }` request with no per-call headers. It
matches resolver-augmented entries only when the resolver's augmentation is
stable for that synthetic current-scope context. For request-varying grouping,
use a stable namespace or tag filter, or use `.user(id)` to target every
managed-session role/claims scope associated with that user. The SDK hashes the
supplied Nhost user ID internally; `.user(id)` does not match anonymous,
explicit-authorization, or admin entries. Add an endpoint or another facet when
you want a narrower deletion.

```swift
let removedEntries = try await nhost.graphql.cache.invalidate(
    GraphQLCacheInvalidationFilter(
        endpoint: nhost.serviceURLs.graphql,
        scope: .user(userID),
        operationName: "Users",
        namespace: "people",
        tag: "profile"
    )
)

try await nhost.graphql.cache.prune()
print("removed \(removedEntries) cached user queries")
```

#### Persistence and privacy

The default store persists the raw GraphQL response body, original 2xx status,
an optional validated `application/json` or
`application/graphql-response+json` content type, timestamps used for freshness
and LRU, sizes/counts, and opaque SHA-256 keys/facets. It does **not** persist raw
access tokens, admin secrets, claims objects, user IDs, queries, variables,
endpoints, operation names, namespaces, tags, or arbitrary response/request
headers in metadata. A custom `GraphQLCacheStore` still receives raw response
body bytes, so apply equivalent privacy controls in custom implementations.

Cached GraphQL bodies can contain sensitive personal or application data. The
cache directory is excluded from backups and defaults to Apple file protection,
but cache-directory placement, backup exclusion, file protection, and hashed
metadata are **not encryption**. Choose cacheable queries conservatively and do
not treat this cache as a credential store. File protection is a portability
no-op where the platform does not provide it.

The cache is bounded and LRU-pruned; operating systems may evict cache-directory
content, and uninstalling an app normally removes its sandboxed cache. Neither is
a secure-erasure guarantee, especially when a custom directory or custom store
is used. Same-process clients for one canonical directory share serialization
and conflicting configurations fail closed. Cross-process locking/coordination
is out of scope, as are encrypted bodies, normalized entities, mutation-driven
invalidation, and request coalescing.

## Storage

Storage upload and download methods are generated from the Storage OpenAPI spec.
Binary downloads return `Data`.

```swift
let fileData = Data("hello from Swift".utf8)

let upload = try await nhost.storage.uploadFiles(
    body: StorageUploadFilesBody(
        bucketId: "default",
        metadata: [
            StorageUploadFileMetadata(
                name: "hello-swift.txt",
                metadata: ["source": .string("swift-sdk")]
            ),
        ],
        file: [fileData]
    )
)

let fileID = upload.body.processedFiles[0].id
let download = try await nhost.storage.getFile(id: fileID)
print(String(decoding: download.body, as: UTF8.self))

_ = try await nhost.storage.deleteFile(id: fileID)
```

Storage errors are surfaced as `FetchError.http(NhostHTTPError)`, preserving the
HTTP status, headers, raw response body, decoded JSON body when available, and
extracted error messages.

### Streaming uploads

For large files, use the streaming variant of `uploadFiles`: `.fileURL` sources
are assembled into a temporary multipart file and streamed from disk, so the
file is never fully loaded into memory. Sources passed as `.data` use the same
in-memory path as the generated method — give the SDK bytes and it works in
memory; give it a file URL and it streams. Given a `movieURL` pointing at a
file on disk:

```swift
let streamedUpload = try await nhost.storage.uploadFiles(
    bucketId: "default",
    files: [
        .fileURL(movieURL, metadata: ["source": .string("swift-sdk")]),
    ]
)

_ = try await nhost.storage.deleteFile(id: streamedUpload.body.processedFiles[0].id)
```

> **Memory note:** downloads (and `.data` uploads) are still fully buffered in
> memory; streaming downloads via `URLSession.bytes(for:)`/`download(for:)` are
> a planned follow-up.

## Functions

Use `fetch` for arbitrary methods and raw bodies, or `post` for JSON request
bodies. Responses are decoded by content type: JSON into your `Decodable` type,
`text/*` into `String`, and everything else into `Data`. (`/helloworld` and
`/echo` are the functions deployed in the package-local dev backend.)

```swift
struct HelloResponse: Decodable, Sendable {
    let message: String
}

let hello = try await nhost.functions.post(
    HelloResponse.self,
    path: "/helloworld"
)

if case let .json(body) = hello.body {
    print(body.message)
}

struct EchoRequest: Encodable, Sendable { let message: String }

let echo = try await nhost.functions.post(
    JSONValue.self,
    path: "/echo",
    body: EchoRequest(message: "Hi")
)

print(echo.body.json?["body"]?["message"]?.stringValue ?? "")
```

Non-2xx Functions responses throw `FunctionsHTTPError` with status, headers,
raw body, decoded text/JSON/data body, and extracted messages.

## Custom session storage

On Apple platforms, `createClient` uses Keychain-backed session storage by
default. On platforms without Keychain, it falls back to memory storage. Keychain
session replacement updates the existing item atomically, including its
accessibility, and reads never modify the item. If stored data is corrupt, reads
throw `KeychainSessionStorageError.decoding` and protected requests fail closed.
Recover explicitly with `client.clearSession()` and authenticate again, or by a
later successful session write, which atomically overwrites the corrupt item.
You can provide your own backend for tests, server-side Swift, or custom
persistence.

```swift
actor SessionBox {
    private var session: StoredSession?

    func get() -> StoredSession? { session }
    func set(_ value: StoredSession) { session = value }
    func remove() { session = nil }
}

let box = SessionBox()
let sessionStorage = CustomSessionStorageBackend(
    get: { await box.get() },
    set: { await box.set($0) },
    remove: { await box.remove() }
)

let serverClient = createServerClient(
    NhostServerClientOptions(
        authURL: URL(string: "https://auth.example.com/v1")!,
        storageURL: URL(string: "https://storage.example.com/v1")!,
        graphqlURL: URL(string: "https://graphql.example.com/v1")!,
        functionsURL: URL(string: "https://functions.example.com/v1")!,
        sessionStorage: sessionStorage
    )
)
```

`createServerClient` does not add automatic refresh middleware. It updates and
attaches sessions from the custom storage you provide, which is useful for
trusted contexts that already control the session lifecycle.

## Security notes

- Never ship `x-hasura-admin-secret` or `AdminSessionOptions` in an iOS, macOS,
  tvOS, watchOS, browser, or other untrusted client app. Admin-secret access is
  for trusted server-side code and tests only.
- Access tokens and refresh tokens are credentials. Do not log them, include
  them in crash reports, or store them in plain text. Prefer the default
  Keychain storage on Apple platforms or a custom encrypted store in server
  environments.
- `createServerClient` requires explicit storage because sharing a process-wide
  session store between users can leak tokens across requests. Create scoped
  storage per request/user.
- GraphQL and Functions response decoders are intentionally neutral by default.
  Pass `decoder: { NhostJSON.restDecoder }` only when your own response model is
  known to use the generated REST date format.

## Integration tests

Integration tests live in `Tests/NhostIntegrationTests` and run by default
against the package-local backend copied from `packages/nhost-js`. Start the
backend before running checks, matching the CI workflow:

```sh
nix develop .#nhost-swift -c make -C packages/nhost-swift dev-env-up
nix develop .#nhost-swift -c swift test --package-path packages/nhost-swift --disable-swift-testing --filter NhostIntegrationTests
nix develop .#nhost-swift -c make -C packages/nhost-swift dev-env-down
```

The default local URLs are:

- `https://local.auth.local.nhost.run/v1`
- `https://local.storage.local.nhost.run/v1`
- `https://local.graphql.local.nhost.run/v1`
- `https://local.functions.local.nhost.run/v1`

By default, the tests create unique email/password users automatically. If
`NHOST_SWIFT_TEST_EMAIL` already exists, the suite signs in with
`NHOST_SWIFT_TEST_PASSWORD` and reuses that user. Override URLs or inputs when
testing another Nhost environment:

```sh
NHOST_AUTH_URL=https://<subdomain>.auth.<region>.nhost.run/v1 \
NHOST_STORAGE_URL=https://<subdomain>.storage.<region>.nhost.run/v1 \
NHOST_GRAPHQL_URL=https://<subdomain>.graphql.<region>.nhost.run/v1 \
NHOST_FUNCTIONS_URL=https://<subdomain>.functions.<region>.nhost.run/v1 \
NHOST_SWIFT_TEST_EMAIL=ada@example.com \
NHOST_SWIFT_TEST_PASSWORD=password123 \
NHOST_SWIFT_STORAGE_BUCKET_ID=default \
NHOST_SWIFT_GRAPHQL_QUERY='query { users(limit: 1) { id } }' \
NHOST_SWIFT_FUNCTION_PATH=/echo \
nix develop .#nhost-swift -c swift test --package-path packages/nhost-swift --disable-swift-testing --filter NhostIntegrationTests
```

The Storage integration creates a small text file with a unique ID, downloads it,
and attempts to delete it during cleanup. Use a dedicated test project or bucket
with permissions appropriate for the configured test user when overriding the
local backend.

## Generated code

Auth and Storage clients under `Sources/Nhost/Generated/` are generated from:

- `services/auth/docs/openapi.yaml`
- `services/storage/controller/openapi.yaml`

Regenerate them with:

```sh
nix develop .#nhost-swift -c ./packages/nhost-swift/gen.sh
```

The Nix check verifies generated output idempotence by regenerating in the build
sandbox and diffing against the committed `Sources/Nhost/Generated` files. Do not
edit generated files by hand.
