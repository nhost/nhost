---
title: Main
---

The Nhost SDK for Rust: a small, idiomatic async client for Nhost's Auth,
Storage, GraphQL, and Functions services.

The auth and storage REST clients are generated from the shared OpenAPI
specs; the fetch middleware chain, session handling, GraphQL, and Functions
clients are hand-written. It mirrors the architecture of `@nhost/nhost-js`
and the Python and Go SDKs.

## Functions

### `create_client`

```rust
fn create_client(options: Options) -> NhostClient
```

Creates an app client with automatic refresh + token attachment.

### `create_nhost_client`

```rust
fn create_nhost_client(options: Options) -> NhostClient
```

Creates and configures an Nhost client, applying `options.configure`.

### `create_server_client`

```rust
fn create_server_client(options: Options) -> Result<NhostClient, Error>
```

Creates a server client with explicit storage and no automatic refresh. It
requires `options.storage` — sharing a process-wide session store between
users can leak tokens across requests, so pass a per-request/user backend.

### `generate_service_url`

```rust
fn generate_service_url(service: ServiceType, subdomain: Option<&str>, region: Option<&str>, custom_url: Option<&str>) -> String
```

Builds the base URL for an Nhost service. Precedence: an explicit
`custom_url` wins; otherwise a cloud URL is built from subdomain/region;
otherwise the local development URL is used.

### `with_admin_session`

```rust
fn with_admin_session(options: AdminSessionOptions) -> ConfigurationFn
```

Applies admin-secret middleware to storage, graphql, and functions.
Security warning: never use in client-side code.

### `with_chain_functions`

```rust
fn with_chain_functions(chain: Vec<ChainFunction>) -> ConfigurationFn
```

Applies arbitrary chain functions to all four clients.

### `with_client_side_session_middleware`

```rust
fn with_client_side_session_middleware(ctx: &mut ConfigureContext)
```

Enables automatic session refresh, token attachment, and session capture.

### `with_server_side_session_middleware`

```rust
fn with_server_side_session_middleware(ctx: &mut ConfigureContext)
```

Enables token attachment and session capture, but no automatic refresh.

## Structs

### `ConfigureContext`

```rust
struct ConfigureContext
```

The set of clients passed to a configuration function.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `auth` | `Client` |  |
| `storage` | `Client` |  |
| `graphql` | `Client` |  |
| `functions` | `Client` |  |
| `session_storage` | `SessionStorage` |  |
| `refresh_auth` | `Arc<Client>` |  |

### `NhostClient`

```rust
struct NhostClient
```

Unified access to Nhost auth, storage, graphql, and functions.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `auth` | `Client` |  |
| `storage` | `Client` |  |
| `graphql` | `Client` |  |
| `functions` | `Client` |  |
| `session_storage` | `SessionStorage` |  |

#### Methods

##### `get_user_session`

```rust
fn get_user_session(&self) -> Option<StoredSession>
```

Returns the current session from storage, or `None`.

##### `refresh_session`

```rust
async fn refresh_session(&self, margin: i64) -> Result<Option<StoredSession>, Error>
```

Refreshes the session using the stored refresh token.

##### `clear_session`

```rust
fn clear_session(&self)
```

Removes the current session from storage (client-side sign-out).

### `Options`

```rust
struct Options
```

Configuration for creating an Nhost client.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `subdomain` | `Option<String>` |  |
| `region` | `Option<String>` |  |
| `auth_url` | `Option<String>` |  |
| `storage_url` | `Option<String>` |  |
| `graphql_url` | `Option<String>` |  |
| `functions_url` | `Option<String>` |  |
| `storage` | `Option<Box<dyn Backend>>` |  |
| `reqwest` | `Option<Client>` |  |
| `configure` | `Vec<ConfigurationFn>` |  |

#### Trait implementations

- `Default`

## Enums

### `ServiceType`

```rust
enum ServiceType
```

One of the Nhost services.

#### Variants

| Variant | Description |
| --- | --- |
| `Auth` |  |
| `Storage` |  |
| `Graphql` |  |
| `Functions` |  |

## Type Aliases

### `ConfigurationFn`

```rust
type ConfigurationFn = Box<dyn FnOnce(&mut ConfigureContext)>
```

A configuration function applied during client construction.

## Constants

### `DEFAULT_REFRESH_MARGIN_SECONDS`

```rust
const DEFAULT_REFRESH_MARGIN_SECONDS: i64 = 60
```

Default refresh margin used by the client-side middleware and refresh.
