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

```go
var ErrRefreshFailed = errors.New("session refresh failed")
```

ErrRefreshFailed marks a [RefreshSession] error from the refresh itself: the
auth service could not be reached, rejected the request, or the refresh
re-entered itself through a misconfigured auth client. The stored session is
unchanged, so a caller may carry on and let the server decide. Any other
error comes from the session store, which could not be read or updated.

```go
var ErrSessionWithoutUserID = errors.New("session has no user ID to store it under")
```

ErrSessionWithoutUserID is returned by [MultiUserMemoryStorage.Set] for a
session that names no user, since it has nothing to key the session by.

## Functions

### `AccessTokenFromContext`

```go
func AccessTokenFromContext(ctx context.Context) (string, bool)
```

AccessTokenFromContext returns the access token set by [WithAccessToken] and
whether a non-empty one is set.

### `UserIDFromContext`

```go
func UserIDFromContext(ctx context.Context) string
```

UserIDFromContext returns the user ID set by [WithUserID], or "" if none is.

### `WithAccessToken`

```go
func WithAccessToken(ctx context.Context, accessToken string) context.Context
```

WithAccessToken returns a copy of ctx whose SDK requests authenticate with
accessToken instead of a stored session. It is for a server acting on behalf
of a caller that sent its own token: the token is attached as-is, is never
stored or refreshed, and does not touch the client's session storage.

### `WithUserID`

```go
func WithUserID(ctx context.Context, userID string) context.Context
```

WithUserID returns a copy of ctx that selects the stored session of userID
for every SDK request made with it. It is how a server that keeps the
sessions of many users in one [Backend] says which user a request is for.

userID must come from something the caller has already verified, such as its
own authenticated cookie session. Never take it from an access token a client
sent: its claims are not verified by the SDK, so a forged token could select
another user's stored session.

Without a user ID, a request uses the only session of a single-session
backend ([MemoryStorage], [FileStorage]) and no session of a multi-user one
([MultiUserMemoryStorage]).

## Types

### `Backend`

```go
type Backend interface {
	Get(ctx context.Context, userID string) (*StoredSession, error)
	Set(ctx context.Context, value StoredSession) error
	Remove(ctx context.Context, userID string) error
}
```

Backend persists sessions keyed by user, so one interface serves both a
single-user application (a CLI, a script) and a server holding the sessions
of many users (Redis, a database, ...). Set keys a session by
[StoredSession.UserID]; Get and Remove take the user ID the request selected
with [WithUserID], or "" when it selected none.

A backend that holds a single session returns and removes it for "" or for
its own user, and reports nothing stored for any other user. A backend that
holds many sessions reports nothing stored for "", so a request that forgot
to name its user goes out unauthenticated rather than as someone else.

Implementations must be safe for concurrent use by multiple goroutines;
Storage delegates operations directly and does not serialize backend access.
The context is the SDK request's, so a remote backend can honour its deadline
and cancellation.

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

FileStorage is a JSON-file backend holding a single session, useful for CLIs
and local scripts. A single instance is safe to share across goroutines:
access is serialized and writes are atomic (temp file + rename), so a
concurrent Get during a refresh's Set never observes a truncated or partial
file.

#### `Get`

```go
func (f *FileStorage) Get(_ context.Context, userID string) (*StoredSession, error)
```

#### `Remove`

```go
func (f *FileStorage) Remove(_ context.Context, userID string) error
```

#### `Set`

```go
func (f *FileStorage) Set(_ context.Context, value StoredSession) error
```

### `MemoryStorage`

```go
type MemoryStorage struct {
	// contains filtered or unexported fields
}
```

MemoryStorage is an in-memory backend holding a single session, for
single-user programs and tests. It keeps only the most recent session, so a
server holding many users' sessions needs [MultiUserMemoryStorage] or a
shared store instead.

#### `Get`

```go
func (m *MemoryStorage) Get(_ context.Context, userID string) (*StoredSession, error)
```

#### `Remove`

```go
func (m *MemoryStorage) Remove(_ context.Context, userID string) error
```

#### `Set`

```go
func (m *MemoryStorage) Set(_ context.Context, value StoredSession) error
```

### `MultiUserMemoryStorage`

```go
type MultiUserMemoryStorage struct {
	// contains filtered or unexported fields
}
```

MultiUserMemoryStorage is an in-memory backend holding one session per user,
for a server running as a single process. Sessions live until they are
removed (sign-out or a rejected refresh), are lost on restart, and are not
shared between processes: a service with several replicas needs a shared
store, or the replicas will rotate one another's refresh tokens and sign
users out.

#### `Get`

```go
func (m *MultiUserMemoryStorage) Get(_ context.Context, userID string) (*StoredSession, error)
```

#### `Remove`

```go
func (m *MultiUserMemoryStorage) Remove(_ context.Context, userID string) error
```

#### `Set`

```go
func (m *MultiUserMemoryStorage) Set(_ context.Context, value StoredSession) error
```

### `Storage`

```go
type Storage struct {
	// contains filtered or unexported fields
}
```

Storage wraps a Backend, decoding tokens on Set and selecting the user from
the request context (see [WithUserID]).

#### `NewStorage`

```go
func NewStorage(backend Backend) *Storage
```

NewStorage wraps a backend.

#### `Get`

```go
func (s *Storage) Get(ctx context.Context) (*StoredSession, error)
```

Get returns the session ctx selects from the backend. It returns (nil, nil)
when no session is stored, and a non-nil error only when the backend could
not be read — an unreadable store is not a signed out user.

The backend's error is returned unwrapped: a backend is caller-supplied, so
its error is the caller's own and adding a layer of SDK context would only
obscure it.

#### `Remove`

```go
func (s *Storage) Remove(ctx context.Context) error
```

Remove clears the session ctx selects, reporting a backend failure so the
caller can decide whether a session left on disk is acceptable.

#### `Set`

```go
func (s *Storage) Set(ctx context.Context, value auth.Session) error
```

Set stores a raw auth Session, enriching it into a StoredSession keyed by its
user. It returns an error if the access token cannot be decoded or the
backend rejects the write.

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

RefreshSession refreshes the session ctx selects (see [WithUserID]) if it is
close to expiry, collapsing concurrent attempts on the same session into one
request. A marginSeconds value of zero forces a refresh. It retries once on
failure. If the refresh token is rejected with 401 it clears the stored
session and returns (nil, nil) — unless the store by then holds a session with
a different refresh token, which another process refreshed first, in which
case that session is returned. Any other final error is returned; if the
access token is still valid, the existing session is returned with that error
so callers may keep using it while handling the refresh failure. Errors from
the refresh itself wrap [ErrRefreshFailed]; the rest come from the store.

The supplied authClient must be bare: its HTTP transport must not include
session-refresh middleware. A reentrancy guard prevents a misconfigured
client from deadlocking, but callers should not rely on that fallback.

#### `ToStoredSession`

```go
func ToStoredSession(s auth.Session) (StoredSession, error)
```

ToStoredSession enriches a raw auth Session into a StoredSession.

#### `UserID`

```go
func (s StoredSession) UserID() string
```

UserID returns the ID of the user the session belongs to: the user returned
with the session, or else the subject of its access token. A [Backend] keys
sessions by it. Both come from the auth service's own response, so reading
them without verifying the token is safe here.

