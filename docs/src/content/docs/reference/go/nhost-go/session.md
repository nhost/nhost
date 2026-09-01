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
	jwtSegments   = 3
	hasuraClaims  = "https://hasura.io/jwt/claims"
	defaultMargin = 60
)
```

```go
const unauthorized = 401
```

```go
var ErrInvalidToken = errors.New("invalid access token format")
```

ErrInvalidToken is returned when an access token cannot be decoded.

## Functions

### `decodeBase64URL`

```go
func decodeBase64URL(segment string) ([]byte, error)
```

### `isPostgresArray`

```go
func isPostgresArray(v string) bool
```

### `parsePostgresArray`

```go
func parsePostgresArray(v string) []string
```

## Types

### `Backend`

```go
type Backend interface {
	Get() (*StoredSession, bool)
	Set(value StoredSession)
	Remove()
}
```

Backend persists a single StoredSession. Implement it to store sessions
somewhere other than memory (a file, Redis, a per-request store, ...).

#### `DetectStorage`

```go
func DetectStorage() Backend
```

DetectStorage returns the default backend for the current environment.

### `ChangeCallback`

```go
type ChangeCallback func(session *StoredSession)
```

ChangeCallback is notified on every session change.

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
	mu   sync.RWMutex
}
```

FileStorage is a JSON-file backed session backend, useful for CLIs and local
scripts. A single instance is safe to share across goroutines: access is
serialized and writes are atomic (temp file + rename), so a concurrent Get
during a refresh's Set never observes a truncated or partial file.

#### `Get`

```go
func (f *FileStorage) Get() (*StoredSession, bool)
```

#### `Remove`

```go
func (f *FileStorage) Remove()
```

#### `Set`

```go
func (f *FileStorage) Set(value StoredSession)
```

### `MemoryStorage`

```go
type MemoryStorage struct {
	mu      sync.RWMutex
	session *StoredSession
}
```

MemoryStorage is the default in-memory session backend. Because a single
instance is process-wide, do not share one between different users in a
server context — create a scoped backend per user.

#### `Get`

```go
func (m *MemoryStorage) Get() (*StoredSession, bool)
```

#### `Remove`

```go
func (m *MemoryStorage) Remove()
```

#### `Set`

```go
func (m *MemoryStorage) Set(value StoredSession)
```

### `Storage`

```go
type Storage struct {
	backend     Backend
	mu          sync.Mutex
	refreshMu   sync.Mutex
	subscribers map[int]ChangeCallback
	nextID      int
}
```

Storage wraps a Backend, decoding tokens on Set and notifying subscribers on
every change.

#### `NewStorage`

```go
func NewStorage(backend Backend) *Storage
```

NewStorage wraps a backend.

#### `Get`

```go
func (s *Storage) Get() (*StoredSession, bool)
```

Get returns the current session from the backend, or (nil, false).

#### `OnChange`

```go
func (s *Storage) OnChange(cb ChangeCallback) func()
```

OnChange subscribes to session changes; the returned func unsubscribes.

#### `Remove`

```go
func (s *Storage) Remove()
```

Remove clears the session and notifies subscribers.

#### `Set`

```go
func (s *Storage) Set(value auth.Session) error
```

Set stores a raw auth Session, enriching it into a StoredSession, and
notifies subscribers. It returns an error if the access token cannot be
decoded.

#### `needsRefresh`

```go
func (s *Storage) needsRefresh(marginSeconds int) (*StoredSession, bool, bool)
```

needsRefresh reports (session, needsRefresh, sessionExpired) for the current
stored session given a margin (seconds before expiry to refresh).

#### `notify`

```go
func (s *Storage) notify(session *StoredSession)
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

RefreshSession refreshes the session if it is close to expiry. It retries
once on transient failure. If the refresh token is rejected with 401 it
clears the stored session and returns (nil, nil); any other error (e.g. a 5xx
or a network failure) is returned so callers can distinguish a transient
problem from a logged-out state.

#### `ToStoredSession`

```go
func ToStoredSession(s auth.Session) (StoredSession, error)
```

ToStoredSession enriches a raw auth Session into a StoredSession.

#### `refreshOnce`

```go
func refreshOnce(
	ctx context.Context,
	authClient *auth.Client,
	storage *Storage,
	marginSeconds int,
) (*StoredSession, error)
```

