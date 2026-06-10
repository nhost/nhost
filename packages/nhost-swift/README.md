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
alongside the decoded body.

```swift
let signIn = try await nhost.auth.signInEmailPassword(
    body: AuthSignInEmailPasswordRequest(
        email: "ada@example.com",
        password: ProcessInfo.processInfo.environment["NHOST_EXAMPLE_PASSWORD"] ?? "<password>"
    )
)

if let session = signIn.body.session {
    print("signed in with token expiring in \(session.accessTokenExpiresIn)s")
}

let stored = try await nhost.getUserSession()
let defaultRole = stored?.decodedToken.hasuraClaims?["x-hasura-default-role"]?.stringValue
print(defaultRole ?? "no role")
```

`createClient` stores Auth responses in the configured session store, refreshes
sessions before service requests, and attaches `Authorization: Bearer <token>`
unless a request already has an Authorization header.

## GraphQL

GraphQL accepts raw query strings, optional variables, and an optional operation
name. Decoding uses a neutral `JSONDecoder` by default so user response models do
not inherit REST date-decoding behavior unless you opt in.

```swift
struct Todo: Decodable, Sendable {
    let id: String
    let title: String
}

struct TodosData: Decodable, Sendable {
    let todos: [Todo]
}

let todos = try await nhost.graphql.request(
    TodosData.self,
    query: """
    query Todos($limit: Int!) {
      todos(limit: $limit, order_by: { created_at: desc }) { id title }
    }
    """,
    variables: ["limit": .number(10)],
    operationName: "Todos"
)

print(todos.body.data?.todos ?? [])
```

Mutations use the same API:

```swift
struct InsertTodoData: Decodable, Sendable {
    struct InsertTodo: Decodable, Sendable { let id: String }
    let insert_todos_one: InsertTodo?
}

let created = try await nhost.graphql.request(
    InsertTodoData.self,
    query: """
    mutation InsertTodo($title: String!) {
      insert_todos_one(object: { title: $title }) { id }
    }
    """,
    variables: ["title": .string("Ship Swift SDK")],
    operationName: "InsertTodo"
)
```

If a GraphQL response contains `errors`, the client throws
`GraphQLExecutionError` with status, headers, raw body, decoded errors, and any
partial `data` value.

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
                id: "hello-swift.txt",
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
```

Storage errors are surfaced as `FetchError.http(NhostHTTPError)`, preserving the
HTTP status, headers, raw response body, decoded JSON body when available, and
extracted error messages.

> **Memory note:** uploads and downloads are currently fully buffered in memory
> (`Data` in, `Data` out) — a multipart upload briefly holds roughly twice the
> file size. Keep transfers comfortably below available memory, especially on
> iOS; streaming via `URLSession.upload(for:fromFile:)`/`bytes(for:)` is a
> planned follow-up.

## Functions

Use `fetch` for arbitrary methods and raw bodies, or `post` for JSON request
bodies. Responses are decoded by content type: JSON into your `Decodable` type,
`text/*` into `String`, and everything else into `Data`.

```swift
struct HelloResponse: Decodable, Sendable {
    let message: String
}

let hello = try await nhost.functions.fetch(
    HelloResponse.self,
    path: "/hello"
)

if case let .json(body) = hello.body {
    print(body.message)
}

struct EchoRequest: Encodable, Sendable { let message: String }
struct EchoResponse: Decodable, Sendable { let echoed: String }

let echo = try await nhost.functions.post(
    EchoResponse.self,
    path: "/echo",
    body: EchoRequest(message: "Hi")
)
```

Non-2xx Functions responses throw `FunctionsHTTPError` with status, headers,
raw body, decoded text/JSON/data body, and extracted messages.

## Custom session storage

On Apple platforms, `createClient` uses Keychain-backed session storage by
default. On platforms without Keychain, it falls back to memory storage. You can
provide your own backend for tests, server-side Swift, or custom persistence.

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
