package source

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"sync/atomic"

	"github.com/jackc/pgx/v5"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

// ErrStoreNotInitialized is returned by Store methods invoked before
// Bootstrap (or NewDatabaseBackedStore) has seeded the snapshot.
var ErrStoreNotInitialized = errors.New("metadata store not initialized")

// ErrStoreReadOnly is returned by Apply when the Store has no writer
// attached (e.g. file-source deployments mounted through this type).
var ErrStoreReadOnly = errors.New("metadata store is read-only")

// ErrResourceVersionConflict is returned by MetadataWriter.WriteMetadata
// when the row's resource_version differs from the caller's expected
// value — i.e. another writer bumped it since the Store read its snapshot.
// The dispatcher maps it to the Hasura error code "conflict".
var ErrResourceVersionConflict = errors.New("metadata resource_version conflict")

// MetadataWriter persists a metadata snapshot to durable storage with
// optimistic concurrency. expectedRV must match the row's current
// resource_version; otherwise WriteMetadata returns
// ErrResourceVersionConflict and the row is left untouched. On success
// the row is updated to (newRaw, newRV).
// MetadataWriter and Queryer are the Store's two external-system boundaries:
// the durable Postgres metadata persistence sink and a pgx query handle. They
// are exported only so mockgen can target them; cross-package consumers (e.g.
// controller tests) drive the Store through the generated mock subpackage. The
// source package's own tests are white-box (package source) and cannot import
// source/mock without an import cycle, so they keep inline stubs.
//
//go:generate mockgen -package mock -destination mock/source.go . MetadataWriter,Queryer
type MetadataWriter interface {
	WriteMetadata(ctx context.Context, newRaw []byte, expectedRV, newRV int64) error
}

// Store is the in-process mutable metadata source. It holds the current
// Hasura wire snapshot, its parsed form, and the corresponding native
// metadata, all protected by a mutex. Mutations go through Apply, which
// clones the snapshot, runs the caller-supplied mutator against the
// clone, persists the result through the configured MetadataWriter, and
// then atomically swaps in the new state and broadcasts an Update on
// Watch.
//
// Store satisfies metadata.Source: InitialLoad and Watch return data
// from the live snapshot, HasuraSnapshotJSON exposes the raw wire form.
// Close shuts down the broadcast channel; closing the underlying writer
// is the caller's responsibility (see dbStoreSource in cmd/serve.go).
type Store struct {
	mu              sync.Mutex
	hasura          *hasura.Metadata
	native          *metadata.Metadata
	raw             []byte
	resourceVersion int64

	writer MetadataWriter

	// queryer is the optional Postgres handle used by read-only ops
	// (pg_suggest_relationships, pg_get_viewdef) and reload_metadata. Set
	// once at construction (see NewStore / NewDatabaseBackedStore) and never
	// mutated, so readers may load it without holding mu. Nil when the Store
	// is not database-backed; those ops then return ErrReadOpRequiresDB.
	queryer Queryer

	ch     chan metadata.Update
	closed bool

	// rsValidator validates a prospective remote schema synchronously
	// before a mutation is persisted: it resolves URL/headers, parses the
	// per-role permission SDL, and introspects the upstream endpoint. It is
	// the same path the controller uses to build the connector, so an
	// accepted add/update/permission mutation is guaranteed to rebuild
	// cleanly. Wired at construction by the production server (to a
	// remoteschema.New-backed closure) and by tests (to a fake-doer-backed
	// one); nil leaves remote-schema mutations un-introspected — only the
	// file/read-only and pure bulk_atomic paths run that way. Set once
	// before serving, so it is read without holding mu.
	rsValidator RemoteSchemaValidator

	// rsIntrospector fetches the raw introspection `data` document for a
	// remote schema. Backs introspect_remote_schema / reload_remote_schema.
	// Wired at construction like rsValidator; nil makes those ops return
	// ErrRemoteSchemaIntrospectionUnavailable. Set once before serving.
	rsIntrospector RemoteSchemaIntrospector

	initOnce atomic.Bool
	logger   *slog.Logger
}

// RemoteSchemaIntrospector fetches the raw GraphQL introspection `data`
// document (`{"__schema": {...}}`) for a remote schema, resolving its URL and
// headers from the (native) definition. Returns the bytes verbatim so the
// metadata API can echo them in an introspect_remote_schema response.
type RemoteSchemaIntrospector func(
	ctx context.Context, rs *metadata.RemoteSchemaMetadata,
) ([]byte, error)

// SetRemoteSchemaIntrospector installs the introspector used by
// introspect_remote_schema / reload_remote_schema. Call once during startup
// before the Store begins serving requests.
func (s *Store) SetRemoteSchemaIntrospector(i RemoteSchemaIntrospector) {
	s.rsIntrospector = i
}

// RemoteSchemaValidator validates a prospective remote schema against its
// upstream endpoint. Implementations resolve the definition's URL and
// headers, parse every role's permission SDL, and perform an admin
// introspection, returning a non-nil error if any step fails. The native
// metadata form is passed (convert via metadata.ConvertRemoteSchema) so the
// validator can reuse the connector-construction path.
type RemoteSchemaValidator func(ctx context.Context, rs *metadata.RemoteSchemaMetadata) error

// SetRemoteSchemaValidator installs the synchronous remote-schema validator
// used by add_remote_schema / update_remote_schema / *_remote_schema_permissions.
// Call once during startup before the Store begins serving requests.
func (s *Store) SetRemoteSchemaValidator(v RemoteSchemaValidator) {
	s.rsValidator = v
}

// NewStore returns a Store that has not yet been bootstrapped. Callers
// must invoke Bootstrap before Apply / Watch / InitialLoad. writer may be
// nil to construct a read-only Store (Apply will return ErrStoreReadOnly).
// queryer may be nil when the Store is not database-backed; the read ops
// (pg_suggest_relationships, pg_get_viewdef, reload_metadata) then return
// ErrReadOpRequiresDB. Both writer and queryer are set once here and never
// mutated afterwards, so the read ops load them without holding s.mu.
func NewStore(writer MetadataWriter, queryer Queryer, logger *slog.Logger) *Store {
	if logger == nil {
		logger = slog.Default()
	}

	return &Store{
		mu:              sync.Mutex{},
		hasura:          nil,
		native:          nil,
		raw:             nil,
		resourceVersion: 0,
		writer:          writer,
		queryer:         queryer,
		ch:              make(chan metadata.Update, 1),
		closed:          false,
		rsValidator:     nil,
		rsIntrospector:  nil,
		initOnce:        atomic.Bool{},
		logger:          logger,
	}
}

// NewDatabaseBackedStore builds a Store seeded from the given DBSource's
// hdb_metadata snapshot. The DBSource is used as the MetadataWriter; the
// caller must close the DBSource separately (Store.Close only releases
// the broadcast channel).
func NewDatabaseBackedStore(
	ctx context.Context, dbSrc *DatabaseMetadataSource,
) (*Store, error) {
	if _, err := dbSrc.InitialLoad(ctx); err != nil {
		return nil, fmt.Errorf("initial load: %w", err)
	}

	raw, rv := dbSrc.HasuraSnapshotJSON()
	if raw == nil {
		return nil, fmt.Errorf(
			"%w: hdb_metadata snapshot empty after initial load",
			ErrStoreNotInitialized,
		)
	}

	h, err := hasura.FromJSON(raw)
	if err != nil {
		return nil, fmt.Errorf("parsing hdb_metadata snapshot: %w", err)
	}

	s := NewStore(dbSrc, dbSrc.store, dbSrc.logger)

	if err := s.bootstrapLocked(h, raw, rv); err != nil {
		return nil, err
	}

	return s, nil
}

// Queryer is the minimal Postgres handle the Store needs for read-only
// ops. Satisfied by *pgxpool.Pool through the package's internal
// metadataStore interface; exported here so external callers (tests) can
// plug in a fake at construction via NewStore.
type Queryer interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

// BootstrapFromJSON seeds the Store from a raw Hasura wire JSON blob and
// resource version. Equivalent to hasura.FromJSON + Bootstrap; primarily
// useful for tests and for callers that already have the wire form.
func (s *Store) BootstrapFromJSON(raw []byte, rv int64) error {
	h, err := hasura.FromJSON(raw)
	if err != nil {
		return fmt.Errorf("parsing bootstrap snapshot: %w", err)
	}

	return s.Bootstrap(h, rv)
}

// Bootstrap seeds the Store with an initial Hasura snapshot and resource
// version. Subsequent calls are rejected — bootstrap is one-shot per
// Store instance.
func (s *Store) Bootstrap(h *hasura.Metadata, rv int64) error {
	if h == nil {
		return fmt.Errorf("%w: nil hasura snapshot", ErrStoreNotInitialized)
	}

	raw, err := metadata.MarshalHasura(h)
	if err != nil {
		return fmt.Errorf("marshaling bootstrap snapshot: %w", err)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	return s.bootstrapLocked(h, raw, rv)
}

func (s *Store) bootstrapLocked(h *hasura.Metadata, raw []byte, rv int64) error {
	if !s.initOnce.CompareAndSwap(false, true) {
		return fmt.Errorf("%w: already bootstrapped", ErrStoreNotInitialized)
	}

	s.hasura = h
	s.native = mustFromHasura(raw)
	s.raw = raw
	s.resourceVersion = rv

	return nil
}

func mustFromHasura(raw []byte) *metadata.Metadata {
	m, err := metadata.FromHasuraJSON(raw)
	if err != nil {
		// raw came from MarshalHasura or hdb_metadata, both of which
		// must round-trip through FromHasuraJSON cleanly. A failure
		// here indicates a programming error in the converter.
		panic(fmt.Sprintf("metadata/source: re-parsing snapshot: %v", err))
	}

	return m
}

// InitialLoad returns the bootstrapped native metadata. The ctx is
// accepted to satisfy metadata.Source; Store does no I/O here because
// NewDatabaseBackedStore already seeded the snapshot.
func (s *Store) InitialLoad(_ context.Context) (*metadata.Metadata, error) {
	if !s.initOnce.Load() {
		return nil, ErrStoreNotInitialized
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	return s.native, nil
}

// Watch returns the broadcast channel. The channel is closed when Close
// is called or ctx is cancelled. Updates are best-effort: the channel is
// buffered to depth 1; a slow consumer that misses an Update sees only
// the newest state on the next read.
//
// Watch must be called exactly once (mirroring DatabaseMetadataSource.Watch).
// The returned channel is shared, and the spawned goroutine closes it when ctx
// is cancelled — so a second concurrent caller would have its channel closed
// out from under it when the first caller's ctx is done. There is a single
// consumer in practice (the controller hot-reload loop).
func (s *Store) Watch(ctx context.Context) <-chan metadata.Update {
	go func() {
		<-ctx.Done()
		s.closeChannel()
	}()

	return s.ch
}

// HasuraSnapshotJSON returns the current Hasura wire form and resource
// version. Returns (nil, 0) before Bootstrap.
func (s *Store) HasuraSnapshotJSON() ([]byte, int64) {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.raw, s.resourceVersion
}

// ResourceVersion returns the current resource version without copying
// the snapshot. Returns 0 before Bootstrap.
func (s *Store) ResourceVersion() int64 {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.resourceVersion
}

// Close shuts down the broadcast channel. Subsequent Apply calls
// continue to succeed (mutations and persistence still work); only the
// Watch fan-out is disabled. Safe to call multiple times.
func (s *Store) Close() {
	s.closeChannel()
}

func (s *Store) closeChannel() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.closed {
		return
	}

	s.closed = true
	close(s.ch)
}

// Apply runs mutate against a working copy of the current Hasura
// snapshot. On success it persists the new state via the writer with
// optimistic concurrency (expectedRV = the snapshot's rv), bumps the
// version, swaps in the new state, and broadcasts a metadata.Update.
// On any error the in-memory state and resource_version are unchanged.
//
// The returned version is the new resource_version after a successful
// bump.
func (s *Store) Apply(
	ctx context.Context,
	mutate func(*hasura.Metadata) error,
) (int64, error) {
	return s.apply(ctx, nil, mutate)
}

// apply is Apply with an optional optimistic-concurrency precondition. When
// expectedRV is non-nil it is compared against the current snapshot version
// UNDER s.mu — atomically with the write — so a concurrent admin mutation that
// bumps the version between a caller's read and this write is detected as a
// conflict instead of being silently overwritten. (A pre-check outside the lock
// would leave a window in which a lost update could slip through.)
func (s *Store) apply(
	ctx context.Context,
	expectedRV *int64,
	mutate func(*hasura.Metadata) error,
) (int64, error) {
	newRV, queryer, err := s.applyLocked(ctx, expectedRV, mutate)
	if err != nil {
		return 0, err
	}

	// Announce the change to peer replicas (best-effort) OUTSIDE s.mu: a notify
	// failure does not undo the committed write, and this second Postgres
	// round-trip has no correctness reason to serialize every reader behind it.
	// queryer is nil when the Store is not database-backed. Mirrors
	// ReconcileAfterProxy, which also notifies lock-free.
	if queryer != nil {
		if err := notifyMetadataChange(ctx, queryer, newRV); err != nil {
			s.logger.WarnContext(ctx, "metadata change notification failed", "error", err)
		}
	}

	return newRV, nil
}

// applyLocked performs the durable, lock-held portion of apply: it validates
// the OCC precondition, clones-mutates-marshals the snapshot, writes it through
// the writer under s.mu, then swaps all derived state and broadcasts. It
// returns the new resource_version and the Queryer to notify peers with (nil
// when the Store is not database-backed) so the caller can issue the
// best-effort NOTIFY without holding s.mu.
func (s *Store) applyLocked( //nolint:ireturn // returns Queryer so the caller can NOTIFY peers lock-free.
	ctx context.Context,
	expectedRV *int64,
	mutate func(*hasura.Metadata) error,
) (int64, Queryer, error) {
	if !s.initOnce.Load() {
		return 0, nil, ErrStoreNotInitialized
	}

	if s.writer == nil {
		return 0, nil, ErrStoreReadOnly
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if expectedRV != nil && *expectedRV != s.resourceVersion {
		return 0, nil, ErrResourceVersionConflict
	}

	working, err := cloneHasura(s.raw)
	if err != nil {
		return 0, nil, fmt.Errorf("cloning hasura snapshot: %w", err)
	}

	if err := mutate(working); err != nil {
		return 0, nil, err
	}

	newRaw, err := metadata.MarshalHasura(working)
	if err != nil {
		return 0, nil, fmt.Errorf("marshaling mutated snapshot: %w", err)
	}

	// Re-parse into native form BEFORE the durable write. A converter bug must
	// surface here, as an error, rather than after WriteMetadata has committed:
	// a post-commit failure would leave the database ahead of the in-memory
	// snapshot and wedge every later Apply on a resource_version conflict.
	native, err := metadata.FromHasuraJSON(newRaw)
	if err != nil {
		return 0, nil, fmt.Errorf("re-parsing mutated snapshot: %w", err)
	}

	currentRV := s.resourceVersion
	newRV := currentRV + 1

	if err := s.writer.WriteMetadata(ctx, newRaw, currentRV, newRV); err != nil {
		return 0, nil, fmt.Errorf("persisting metadata: %w", err)
	}

	// Swap all derived state together, only after the commit succeeded, so any
	// failure above leaves the in-memory snapshot and version untouched.
	s.hasura = working
	s.native = native
	s.raw = newRaw
	s.resourceVersion = newRV

	s.broadcastLocked(metadata.Update{
		Metadata: s.native,
		Err:      nil,
	})

	return newRV, s.queryer, nil
}

func (s *Store) broadcastLocked(update metadata.Update) {
	if s.closed {
		return
	}

	// Buffered to depth 1; drop-and-replace on full buffer so the newest
	// post-mutation state always supersedes a queued stale one.
	select {
	case s.ch <- update:
	default:
		select {
		case <-s.ch:
		default:
		}

		select {
		case s.ch <- update:
		default:
		}
	}
}

// cloneHasura re-parses the wire JSON to produce an independent
// *hasura.Metadata that shares no state with the original. The
// round-trip is the simplest way to deep-clone — the wire form is the
// source of truth, and FromJSON / MarshalHasura already preserve
// unknown fields via `,unknown`.
func cloneHasura(raw []byte) (*hasura.Metadata, error) {
	clone, err := hasura.FromJSON(raw)
	if err != nil {
		return nil, fmt.Errorf("parsing snapshot for clone: %w", err)
	}

	return clone, nil
}
