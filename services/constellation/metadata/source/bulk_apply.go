package source

import (
	"context"
	"fmt"

	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

// Snapshot-op type names. The mutation/read ops have their constants alongside
// their handlers; the whole-metadata ops are dispatched only here and in the
// controller, so their names live with the bulk engine that interprets them.
const (
	opReplaceMetadata = "replace_metadata"
	opClearMetadata   = "clear_metadata"
	opReloadMetadata  = "reload_metadata"
)

// BulkChild is one child operation of a bulk / bulk_keep_going request.
type BulkChild struct {
	Type string
	Args []byte
}

// BulkChildOutcome is the per-child result ApplyBulk produces. Exactly one of
// Body / Err is set: Body holds the wire body for a successful child (a
// {"message": ...} envelope for mutating ops, or the payload map for reads);
// Err holds the raw error for a failed child, which the caller classifies into
// a Hasura-shaped code. Err is only ever set in the bulk_keep_going path — the
// fail-fast bulk path aborts via ApplyBulk's returned error instead.
type BulkChildOutcome struct {
	Body map[string]any
	Err  error
}

// BulkChildError wraps a child failure with its index so the caller can build
// the "$.args[i]" error path. ApplyBulk returns it (as its error) for the
// fail-fast bulk path.
type BulkChildError struct {
	Index int
	Err   error
}

func (e *BulkChildError) Error() string {
	return fmt.Sprintf("bulk child %d: %v", e.Index, e.Err)
}

func (e *BulkChildError) Unwrap() error { return e.Err }

// bulkStep is the executable plan for one child, built (and arg-validated) in a
// pre-pass that runs before the write lock is taken so per-call DB introspection
// (the untrack cascade) does not serialize behind s.mu. Exactly one of
// mutate / read / noop is meaningful, unless buildErr is set.
type bulkStep struct {
	typ      string
	mutate   MutationFn // metadata-mutating child (incl. whole-metadata replace/clear)
	read     bulkReadFn // read-only child
	noop     bool       // always-success child that never touches metadata (reload in bulk)
	buildErr error      // arg/build error to surface when the step runs
}

// bulkReadFn runs a read-only child against the in-flight working metadata.
type bulkReadFn func(ctx context.Context, working *hasura.Metadata) (map[string]any, error)

// ApplyBulk processes children in order against ONE working copy of the current
// snapshot and performs a single durable write with a single resource_version
// bump — matching Hasura, which runs all children of a /v1/metadata request
// against one in-flight metadata and writes once at the end.
//
// keepGoing=false (bulk): the first child error aborts the whole batch with no
// write (the working copy is discarded); the error is returned as a
// *BulkChildError carrying the child index.
//
// keepGoing=true (bulk_keep_going): each mutating child runs against a clone so
// a failure rolls back only that child; failed children ride in the outcomes
// and the batch continues. A single write persists the accumulated successes.
//
// The returned bool reports whether a durable write happened. When no child
// mutated (all reads, all idempotent no-ops, or — under keepGoing — all failed)
// no write is issued and the current resource_version is returned unchanged.
func (s *Store) ApplyBulk(
	ctx context.Context, children []BulkChild, keepGoing bool,
) ([]BulkChildOutcome, int64, bool, error) {
	if !s.initOnce.Load() {
		return nil, 0, false, ErrStoreNotInitialized
	}

	// Pre-pass (lock-free): build/validate each child's step. Untrack-cascade DB
	// introspection happens here, on its own short-lived connection, so it does
	// not hold s.mu.
	steps := make([]bulkStep, len(children))
	for i, c := range children {
		steps[i] = s.planBulkChild(ctx, c)
	}

	outcomes, rv, mutated, queryer, err := s.applyBulkLocked(ctx, steps, keepGoing)
	if err != nil {
		return nil, 0, false, err
	}

	// Announce the change to peer replicas (best-effort) OUTSIDE s.mu, mirroring
	// apply. queryer is nil when the Store is not database-backed or no write
	// happened.
	if queryer != nil {
		if nErr := notifyMetadataChange(ctx, queryer, rv); nErr != nil {
			s.logger.WarnContext(ctx, "metadata change notification failed", "error", nErr)
		}
	}

	return outcomes, rv, mutated, nil
}

// applyBulkLocked is the lock-held portion of ApplyBulk: it clones the snapshot,
// runs every step against the working copy, and (if anything mutated) performs
// the single durable write. It returns the Queryer to notify peers with (nil
// when no write happened or the Store is not database-backed) so the caller can
// NOTIFY without holding s.mu — mirroring applyLocked.
func (s *Store) applyBulkLocked( //nolint:ireturn // returns Queryer so the caller can NOTIFY lock-free.
	ctx context.Context,
	steps []bulkStep,
	keepGoing bool,
) ([]BulkChildOutcome, int64, bool, Queryer, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	working, err := cloneHasura(s.raw)
	if err != nil {
		return nil, 0, false, nil, fmt.Errorf("cloning hasura snapshot: %w", err)
	}

	startRV := s.resourceVersion
	outcomes := make([]BulkChildOutcome, len(steps))
	mutated := false

	for i, st := range steps {
		body, changed, stepErr := s.runBulkStep(ctx, working, st, keepGoing)
		if stepErr != nil {
			if !keepGoing {
				return nil, 0, false, nil, &BulkChildError{Index: i, Err: stepErr}
			}

			outcomes[i] = BulkChildOutcome{Err: stepErr}

			continue
		}

		if changed {
			mutated = true
		}

		outcomes[i] = BulkChildOutcome{Body: body}
	}

	if !mutated {
		return outcomes, startRV, false, nil, nil
	}

	if s.writer == nil {
		return nil, 0, false, nil, ErrStoreReadOnly
	}

	newRV, err := s.commitWorkingLocked(ctx, working, startRV)
	if err != nil {
		return nil, 0, false, nil, err
	}

	return outcomes, newRV, true, s.queryer, nil
}

// runBulkStep executes one planned step against the working metadata, returning
// the per-child body, whether it changed the metadata, and any error.
func (s *Store) runBulkStep(
	ctx context.Context, working *hasura.Metadata, st bulkStep, keepGoing bool,
) (map[string]any, bool, error) {
	switch {
	case st.buildErr != nil:
		return nil, false, st.buildErr
	case st.read != nil:
		body, err := st.read(ctx, working)
		if err != nil {
			return nil, false, err
		}

		return body, false, nil
	case st.noop:
		return map[string]any{"message": "success"}, false, nil
	case st.mutate != nil:
		return applyMutateStep(working, st.mutate, keepGoing)
	}

	return nil, false, fmt.Errorf("%w: %q", ErrUnknownMutationOp, st.typ)
}

// applyMutateStep runs a mutating step. Under keepGoing it applies to a clone
// and commits only on success, so a failing child rolls back without disturbing
// the successes already accumulated in working. Under fail-fast it mutates
// working in place: a failure aborts the whole batch, which discards working
// entirely, so a partial in-place mutation never reaches the durable write.
func applyMutateStep(
	working *hasura.Metadata, fn MutationFn, keepGoing bool,
) (map[string]any, bool, error) {
	target := working

	if keepGoing {
		clone, err := cloneWorking(working)
		if err != nil {
			return nil, false, err
		}

		target = clone
	}

	code, err := fn(target)
	if err != nil {
		return nil, false, err
	}

	if keepGoing {
		*working = *target
	}

	if code != "" {
		return map[string]any{"message": string(code)}, false, nil
	}

	return map[string]any{"message": "success"}, true, nil
}

// cloneWorking deep-clones the in-flight metadata via its wire form so a
// per-child mutation can be rolled back (bulk_keep_going) without mutating the
// shared working copy.
func cloneWorking(working *hasura.Metadata) (*hasura.Metadata, error) {
	raw, err := metadata.MarshalHasura(working)
	if err != nil {
		return nil, fmt.Errorf("cloning working metadata: %w", err)
	}

	clone, err := cloneHasura(raw)
	if err != nil {
		return nil, fmt.Errorf("cloning working metadata: %w", err)
	}

	return clone, nil
}

// commitWorkingLocked persists the working metadata as a single write with one
// resource_version bump, then swaps in the new state and broadcasts. Mirrors the
// tail of applyLocked; the caller holds s.mu.
func (s *Store) commitWorkingLocked(
	ctx context.Context, working *hasura.Metadata, startRV int64,
) (int64, error) {
	if startRV != s.resourceVersion {
		// We have held s.mu since cloning, so this cannot happen in practice; it
		// is a defensive guard matching applyLocked's OCC precondition.
		return 0, ErrResourceVersionConflict
	}

	newRaw, err := metadata.MarshalHasura(working)
	if err != nil {
		return 0, fmt.Errorf("marshaling mutated snapshot: %w", err)
	}

	// Re-parse to native BEFORE the durable write so a converter bug fails
	// pre-commit rather than wedging later applies (see applyLocked).
	native, err := metadata.FromHasuraJSON(newRaw)
	if err != nil {
		return 0, fmt.Errorf("re-parsing mutated snapshot: %w", err)
	}

	newRV := s.resourceVersion + 1

	if err := s.writer.WriteMetadata(ctx, newRaw, s.resourceVersion, newRV); err != nil {
		return 0, fmt.Errorf("persisting metadata: %w", err)
	}

	s.hasura = working
	s.native = native
	s.raw = newRaw
	s.resourceVersion = newRV

	s.broadcastLocked(metadata.Update{Metadata: s.native, Err: nil})

	return newRV, nil
}

// planBulkChild resolves a child to an executable step before the write lock is
// taken. Mutation children funnel through BuildMutation; pg_untrack_table
// additionally resolves its cascade dependencies from the data database (the
// same DB-backed cascade the single-op path gets — bulk children are no longer
// limited to the metadata-only cascade); reads bind to their lock-free cores;
// the whole-metadata ops compose onto the working copy.
func (s *Store) planBulkChild(ctx context.Context, c BulkChild) bulkStep {
	switch c.Type {
	case opPgGetViewdef:
		return bulkStep{
			typ: c.Type,
			read: func(ctx context.Context, _ *hasura.Metadata) (map[string]any, error) {
				return s.PgGetViewdef(ctx, c.Args)
			},
		}
	case opPgSuggestRelationships:
		return bulkStep{
			typ: c.Type,
			read: func(ctx context.Context, working *hasura.Metadata) (map[string]any, error) {
				return s.pgSuggestRelationshipsAgainst(ctx, working, c.Args)
			},
		}
	case opReplaceMetadata:
		fn, err := buildReplaceMetadataMutation(c.Args)

		return bulkStep{typ: c.Type, mutate: fn, buildErr: err}
	case opClearMetadata:
		return bulkStep{typ: c.Type, mutate: clearMetadataMutation()}
	case opReloadMetadata:
		// The working copy is, by construction, the current in-flight state, so
		// a reload is a success no-op here rather than a DB refetch that would
		// discard earlier children's edits.
		return bulkStep{typ: c.Type, noop: true}
	case opPgUntrackTable:
		deps, err := s.loadUntrackDeps(ctx, c.Args)
		if err != nil {
			return bulkStep{typ: c.Type, buildErr: err}
		}

		fn, bErr := buildPgUntrackTable(c.Args, deps)

		return bulkStep{typ: c.Type, mutate: fn, buildErr: bErr}
	default:
		fn, err := BuildMutation(c.Type, c.Args)

		return bulkStep{typ: c.Type, mutate: fn, buildErr: err}
	}
}

// buildReplaceMetadataMutation composes replace_metadata onto the working copy.
// Inside a bulk the per-child resource_version precondition is ignored: the
// batch enforces one optimistic-concurrency check against the starting version
// at the single write.
func buildReplaceMetadataMutation(argsJSON []byte) (MutationFn, error) {
	newRaw, _, err := extractReplacePayload(argsJSON)
	if err != nil {
		return nil, err
	}

	newH, err := hasura.FromJSON(newRaw)
	if err != nil {
		return nil, fmt.Errorf("parsing replace_metadata payload: %w", err)
	}

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		*h = *newH

		return "", nil
	}, nil
}

// clearMetadataMutation composes clear_metadata onto the working copy.
func clearMetadataMutation() MutationFn {
	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		empty, err := hasura.FromJSON([]byte(emptyMetadataJSON))
		if err != nil {
			// Programming error: the seed constant must round-trip.
			return "", fmt.Errorf("parsing empty metadata seed: %w", err)
		}

		*h = *empty

		return "", nil
	}
}
