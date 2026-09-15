---
title: Session
---

Package session provides the enriched, client-side session managed by the
SDK, JWT decoding, storage backends, and token refresh.

StoredSession is a superset of the raw auth Session returned by the API,
adding a DecodedToken with the parsed JWT payload so Hasura claims, roles,
and session variables are available without manually decoding the token.

## Constants and Variables

```go
const (
	OpRead   = "read"
	OpWrite  = "write"
	OpRemove = "remove"
)
```

Session-backend operation names reported by StorageError.Op.

```go
var ErrInvalidToken = errors.New("invalid access token format")
```

ErrInvalidToken is returned when an access token cannot be decoded.

## Types

### `Backend`

```go
type Backend interface {
	Get() (*StoredSession, error)
	Set(value StoredSession) error
	Remove() error
}
```

Backend persists a single StoredSession. Implement it to store sessions
somewhere other than memory (a file, Redis, a per-request store, ...).
Implementations must be safe for concurrent use by multiple goroutines;
Storage delegates operations directly and does not serialize backend access.

Every operation reports failure so a caller can decide whether losing the
session is acceptable. Get returns (nil, nil) when no session is stored,
which is not an error; it must return a non-nil error only when the session
could not be read, so that a backend outage is never mistaken for a signed
out user. Remove treats an absent session as success.

### `DecodedToken`

```go
type DecodedToken struct {
	Exp          int64          `json:"exp,omitempty"`
	Iat          int64          `json:"iat,omitempty"`
	Iss          string         `json:"iss,omitempty"`
	Sub          string         `json:"sub,omitempty"`
	HasuraClaims map[string]any `json:"https://hasura.io/jwt/claims,omitempty"`
	Raw          map[string]any `json:"-"`
}
```

DecodedToken is the decoded JWT access-token payload. Exp and Iat are epoch
seconds. Raw holds every claim (including unknown ones) as decoded.

Security: the token signature is NOT verified when producing this struct
(see DecodeUserSession). These claims are used only to schedule client-side
refresh of the SDK's own token and must never be trusted for authorization
decisions on tokens from an untrusted source. Server-side code must verify
the JWT against the auth JWKS (.well-known/jwks.json) before trusting claims.

#### `DecodeUserSession`

```go
func DecodeUserSession(accessToken string) (DecodedToken, error)
```

DecodeUserSession decodes the payload of a JWT access token. Hasura claims
encoded as PostgreSQL array literals (e.g. "{user,me}") are converted into
string slices, mirroring the JS SDK.

This decodes but does NOT verify the token: the signature is not checked and
no claim (including exp) is validated. It is intended only for reading the
SDK's own session token to drive refresh timing. Do not use the returned
claims to make authorization decisions on untrusted tokens; verify against
the auth JWKS first.

### `FileStorage`

```go
type FileStorage struct {
	Path string
	// contains filtered or unexported fields
}
```

FileStorage is a JSON-file backed session backend, useful for CLIs and local
scripts. A single instance is safe to share across goroutines: access is
serialized and writes are atomic (temp file + rename), so a concurrent Get
during a refresh's Set never observes a truncated or partial file.

#### `Get`

```go
func (f *FileStorage) Get() (*StoredSession, error)
```

#### `Remove`

```go
func (f *FileStorage) Remove() error
```

#### `Set`

```go
func (f *FileStorage) Set(value StoredSession) error
```

### `MemoryStorage`

```go
type MemoryStorage struct {
	// contains filtered or unexported fields
}
```

MemoryStorage is the default in-memory session backend. Because a single
instance is process-wide, do not share one between different users in a
server context — create a scoped backend per user.

#### `Get`

```go
func (m *MemoryStorage) Get() (*StoredSession, error)
```

#### `Remove`

```go
func (m *MemoryStorage) Remove() error
```

#### `Set`

```go
func (m *MemoryStorage) Set(value StoredSession) error
```

### `Storage`

```go
type Storage struct {
	// contains filtered or unexported fields
}
```

Storage wraps a Backend, decoding tokens on Set.

#### `NewStorage`

```go
func NewStorage(backend Backend) *Storage
```

NewStorage wraps a backend.

#### `Get`

```go
func (s *Storage) Get() (*StoredSession, error)
```

Get returns the current session from the backend. It returns (nil, nil) when
no session is stored, and a non-nil error only when the backend could not be
read — an unreadable store is not a signed out user.

The backend's error is returned unwrapped: a backend is caller-supplied, so
its error is the caller's own and adding a layer of SDK context would only
obscure it.

#### `Remove`

```go
func (s *Storage) Remove() error
```

Remove clears the session, reporting a backend failure so the caller can
decide whether a session left on disk is acceptable.

#### `Set`

```go
func (s *Storage) Set(value auth.Session) error
```

Set stores a raw auth Session, enriching it into a StoredSession. It returns
an error if the access token cannot be decoded or the backend rejects the
write.

### `StorageError`

```go
type StorageError struct {
	// Op is the operation that failed: OpRead, OpWrite, or OpRemove.
	Op string
	// Path is the file the operation was performed on.
	Path string
	// Err is the underlying error.
	Err error
}
```

StorageError reports a failed session-backend operation. The built-in
FileStorage returns it so callers can tell a genuine persistence failure
(a full disk, a read-only directory) apart from "no session stored".

#### `Error`

```go
func (e *StorageError) Error() string
```

#### `Unwrap`

```go
func (e *StorageError) Unwrap() error
```

### `StoredSession`

```go
type StoredSession struct {
	auth.Session

	DecodedToken DecodedToken `json:"decodedToken"`
}
```

StoredSession is the enriched session persisted by the SDK: the raw auth
Session plus the decoded access token.

#### `RefreshSession`

```go
func RefreshSession(
	ctx context.Context,
	authClient *auth.Client,
	storage *Storage,
	marginSeconds int,
) (*StoredSession, error)
```

RefreshSession refreshes the session if it is close to expiry and collapses
concurrent attempts into one request. A marginSeconds value of zero forces a
refresh. It retries once on failure. If the refresh token is rejected with
401 it clears the stored session and returns (nil, nil). Any other final
error is returned; if the access token is still valid, the existing session
is returned with that error so callers may keep using it while handling the
refresh failure.

The supplied authClient must be bare: its HTTP transport must not include
session-refresh middleware. A reentrancy guard prevents a misconfigured
client from deadlocking, but callers should not rely on that fallback.

#### `ToStoredSession`

```go
func ToStoredSession(s auth.Session) (StoredSession, error)
```

ToStoredSession enriches a raw auth Session into a StoredSession.

