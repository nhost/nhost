package source

import (
	"context"
	stdjson "encoding/json"
	json "encoding/json/v2"
	"errors"
	"fmt"
	"strings"

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

// Bulk op type names. The engine recognises them as children so it can recurse:
// a bulk / bulk_keep_going child runs its own children against the same in-flight
// metadata (a nested bare array result); a bulk_atomic child runs as an
// all-or-nothing sub-group (a single success object). This mirrors Hasura, which
// dispatches every child — nested bulk included — through the same recursive
// metadata runner under one final write.
const (
	opBulk          = "bulk"
	opBulkAtomic    = "bulk_atomic"
	opBulkKeepGoing = "bulk_keep_going"
)

// maxBulkNestingDepth bounds nested-bulk recursion. Hasura imposes no limit;
// this is a defensive cap against pathological / abusive nesting. The dashboard
// never nests, so any real request is depth 1.
const maxBulkNestingDepth = 20

// ErrBulkArgsMissing is returned when a bulk request arrives as an object but
// carries no "args" key. Hasura rejects such a request; treating it as an empty
// (silently successful) bulk would mask a malformed call.
var ErrBulkArgsMissing = errors.New(`bulk request object is missing the "args" array`)

// ErrBulkAtomicUnsupported mirrors Hasura's "Bulk atomic does not support this
// command": bulk_atomic accepts only a narrow whitelist of relationship ops and,
// by extension, rejects nested bulk of any kind.
var ErrBulkAtomicUnsupported = errors.New("bulk_atomic does not support this command")

// ErrBulkNestingTooDeep is returned when nested bulk exceeds maxBulkNestingDepth.
var ErrBulkNestingTooDeep = errors.New("bulk nesting too deep")

// bulkAtomicWhitelist is the set of ops Hasura's bulk_atomic accepts that
// Constellation also implements. Hasura additionally allows native-query /
// logical-model / stored-procedure track-untrack, which Constellation has no
// ops for. Everything else (table tracking, permissions, functions, event
// triggers, reads, whole-metadata, and nested bulk) is rejected by Hasura's
// bulk_atomic, and Constellation matches that.
//
//nolint:gochecknoglobals // immutable lookup set, mirrors Hasura's bulk_atomic whitelist.
var bulkAtomicWhitelist = map[string]struct{}{
	opPgCreateObjectRelationship: {},
	opPgCreateArrayRelationship:  {},
	opPgDropRelationship:         {},
	opPgDeleteRemoteRelationship: {},
}

// BulkAtomicSupports reports whether op is accepted as a bulk_atomic child.
func BulkAtomicSupports(op string) bool {
	_, ok := bulkAtomicWhitelist[op]

	return ok
}

// BulkChild is one child operation of a bulk / bulk_keep_going / bulk_atomic
// request. A child whose Type is itself a bulk op carries that nested bulk's
// children in Args.
type BulkChild struct {
	Type string
	Args []byte
}

// bulkChildEnvelope decodes a child's {"type", "args"} pair. Args is kept raw so
// the verbatim bytes reach the per-op handler (or the nested bulk parser).
type bulkChildEnvelope struct {
	Type string             `json:"type"`
	Args stdjson.RawMessage `json:"args"`
}

// ParseBulkChildren decodes a bulk request's args into its child list. Hasura
// accepts either a bare array of children or a {"args":[...]} envelope; the
// dashboard uses both, so both are accepted. An object with no "args" key (or a
// non-array "args") is malformed and fails loudly rather than degrading into a
// zero-length (silently successful) bulk.
func ParseBulkChildren(argsJSON []byte) ([]BulkChild, error) {
	var envelopes []bulkChildEnvelope
	if err := json.Unmarshal(argsJSON, &envelopes); err == nil {
		return toBulkChildren(envelopes), nil
	}

	var envelope map[string]stdjson.RawMessage
	if err := json.Unmarshal(argsJSON, &envelope); err != nil {
		return nil, fmt.Errorf("parsing bulk args: %w", err)
	}

	rawArgs, ok := envelope["args"]
	if !ok {
		return nil, ErrBulkArgsMissing
	}

	if err := json.Unmarshal(rawArgs, &envelopes); err != nil {
		return nil, fmt.Errorf("parsing bulk args: %w", err)
	}

	return toBulkChildren(envelopes), nil
}

func toBulkChildren(envelopes []bulkChildEnvelope) []BulkChild {
	children := make([]BulkChild, len(envelopes))
	for i, e := range envelopes {
		children[i] = BulkChild{Type: e.Type, Args: []byte(e.Args)}
	}

	return children
}

// BulkResult is the recursive per-child result ApplyBulk produces.
//
//   - A leaf success sets Body (the wire body: a {"message": ...} envelope for
//     mutating ops, or the payload map for reads).
//   - A failed child (only in a keep-going slot) sets Err, which the caller
//     classifies into a Hasura-shaped {code, error} object. Type carries the
//     child's op so the caller can pick the right code.
//   - A nested bulk / bulk_keep_going child sets Children and Array: the caller
//     renders Children as a bare nested array (matching Hasura). A nested
//     bulk_atomic child instead renders as a single Body of {"message":"success"}.
//
// Its fields are a tagged union (leaf body / error / nested children); build one
// via leafResult / errResult / arrayResult rather than a partial literal.
type BulkResult struct {
	Type     string
	Body     any
	Err      error
	Children []BulkResult
	Array    bool
}

// BulkChildError wraps the failure that aborted a fail-fast bulk (or a nested
// fail-fast / atomic group). Path is the index path from the request root so the
// caller can build "$.args[i].args[j]"; Type is the failing child's op for
// classification.
type BulkChildError struct {
	Path []int
	Type string
	Err  error
}

func (e *BulkChildError) Error() string {
	return fmt.Sprintf("bulk child %v: %v", e.Path, e.Err)
}

func (e *BulkChildError) Unwrap() error { return e.Err }

// PathString renders the JSON path of the failing child, e.g. "$.args[1].args[0]".
func (e *BulkChildError) PathString() string {
	var b strings.Builder
	b.WriteString("$")

	for _, i := range e.Path {
		fmt.Fprintf(&b, ".args[%d]", i)
	}

	return b.String()
}

// bulkStep is the executable plan for one child, built (and arg-validated) in a
// pre-pass that runs before the write lock is taken so per-call DB introspection
// (the untrack cascade) and nested parsing do not serialize behind s.mu.
//
// Exactly one of group / read / noop / mutate is meaningful, unless buildErr is
// set (a parse/validation error to surface when the step runs). typ is the
// child's op type, threaded into results and errors for classification. Build one
// via mutateStep / readStep / noopStep / groupStep / errStep rather than a
// partial literal.
type bulkStep struct {
	typ      string
	mutate   MutationFn // metadata-mutating child (incl. whole-metadata replace/clear)
	read     bulkReadFn // read-only child
	noop     bool       // always-success child that never touches metadata (reload in bulk)
	group    *bulkGroup // nested bulk / bulk_keep_going / bulk_atomic child
	buildErr error      // arg/build error to surface when the step runs
}

// bulkGroup is the planned form of a (possibly nested) bulk. keepGoing selects
// bulk_keep_going semantics; atomic selects bulk_atomic (all-or-nothing, narrow
// whitelist). A group with neither flag is a fail-fast bulk.
type bulkGroup struct {
	steps     []bulkStep
	keepGoing bool
	atomic    bool
}

// Step constructors set every bulkStep field (so the literal is complete) and
// name the one variant each child uses.

func mutateStep(typ string, fn MutationFn, buildErr error) bulkStep {
	return bulkStep{typ: typ, mutate: fn, read: nil, noop: false, group: nil, buildErr: buildErr}
}

func readStep(typ string, read bulkReadFn) bulkStep {
	return bulkStep{typ: typ, mutate: nil, read: read, noop: false, group: nil, buildErr: nil}
}

func noopStep(typ string) bulkStep {
	return bulkStep{typ: typ, mutate: nil, read: nil, noop: true, group: nil, buildErr: nil}
}

func groupStep(typ string, group *bulkGroup) bulkStep {
	return bulkStep{typ: typ, mutate: nil, read: nil, noop: false, group: group, buildErr: nil}
}

func errStep(typ string, err error) bulkStep {
	return bulkStep{typ: typ, mutate: nil, read: nil, noop: false, group: nil, buildErr: err}
}

// Result constructors set every BulkResult field for the same reason.

func leafResult(typ string, body any) BulkResult {
	return BulkResult{Type: typ, Body: body, Err: nil, Children: nil, Array: false}
}

func errResult(typ string, err error) BulkResult {
	return BulkResult{Type: typ, Body: nil, Err: err, Children: nil, Array: false}
}

func arrayResult(typ string, children []BulkResult) BulkResult {
	return BulkResult{Type: typ, Body: nil, Err: nil, Children: children, Array: true}
}

// bulkReadFn runs a read-only child against the in-flight working metadata.
type bulkReadFn func(ctx context.Context, working *hasura.Metadata) (map[string]any, error)

// ApplyBulk processes children in order against ONE working copy of the current
// snapshot and performs a single durable write with a single resource_version
// bump — matching Hasura, which runs all children of a /v1/metadata request
// (nested bulk included) against one in-flight metadata and writes once at the
// end.
//
// keepGoing=false (bulk): the first child error aborts the whole batch with no
// write (the working copy is discarded); the error is returned as a
// *BulkChildError carrying the failing child's index path.
//
// keepGoing=true (bulk_keep_going): each child runs against a clone so a failure
// rolls back only that child; failed children ride in the results and the batch
// continues. A single write persists the accumulated successes.
//
// A child may itself be a bulk: bulk / bulk_keep_going children recurse and
// produce a nested array; bulk_atomic children run as an all-or-nothing
// sub-group producing a single success object. Everything shares the one working
// copy and the one final write.
//
// The returned bool reports whether a durable write happened. When no child
// mutated (all reads, all idempotent no-ops, or — under keepGoing — all failed)
// no write is issued and the current resource_version is returned unchanged.
func (s *Store) ApplyBulk(
	ctx context.Context, children []BulkChild, keepGoing bool,
) ([]BulkResult, int64, bool, error) {
	if !s.initOnce.Load() {
		return nil, 0, false, ErrStoreNotInitialized
	}

	// Pre-pass (lock-free): build/validate every child's step, recursing into
	// nested bulks. Untrack-cascade DB introspection happens here, on its own
	// short-lived connection, so it does not hold s.mu.
	group := s.planGroup(ctx, children, keepGoing, false, 0)

	results, rv, mutated, queryer, err := s.applyBulkLocked(ctx, group)
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

	return results, rv, mutated, nil
}

// applyBulkLocked is the lock-held portion of ApplyBulk: it clones the snapshot,
// runs the top-level group against the working copy, and (if anything mutated)
// performs the single durable write. It returns the Queryer to notify peers with
// (nil when no write happened or the Store is not database-backed) so the caller
// can NOTIFY without holding s.mu — mirroring applyLocked.
func (s *Store) applyBulkLocked( //nolint:ireturn // returns Queryer so the caller can NOTIFY lock-free.
	ctx context.Context,
	group *bulkGroup,
) ([]BulkResult, int64, bool, Queryer, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	working, err := cloneHasura(s.raw)
	if err != nil {
		return nil, 0, false, nil, fmt.Errorf("cloning hasura snapshot: %w", err)
	}

	startRV := s.resourceVersion

	results, mutated, abortErr := s.runGroup(ctx, working, group, nil)
	if abortErr != nil {
		// Fail-fast abort: the working copy is discarded, no write happens.
		return nil, 0, false, nil, abortErr
	}

	if !mutated {
		return results, startRV, false, nil, nil
	}

	if s.writer == nil {
		return nil, 0, false, nil, ErrStoreReadOnly
	}

	newRV, err := s.commitWorkingLocked(ctx, working, startRV)
	if err != nil {
		return nil, 0, false, nil, err
	}

	return results, newRV, true, s.queryer, nil
}

// runGroup executes a group's steps against working IN PLACE, returning the
// per-child results, whether working changed, and — for a fail-fast or atomic
// group — a *BulkChildError on the first child failure (with prefix prepended to
// the failing child's index path). A keep-going group never aborts: child
// failures ride in the results and the run continues.
//
// prefix is the index path of this group within an enclosing request (nil at the
// top level), so abort errors carry their full "$.args[i].args[j]" path.
func (s *Store) runGroup(
	ctx context.Context, working *hasura.Metadata, g *bulkGroup, prefix []int,
) ([]BulkResult, bool, *BulkChildError) {
	results := make([]BulkResult, len(g.steps))
	mutated := false

	for i, st := range g.steps {
		res, changed, err := s.runChild(ctx, working, st, g.keepGoing, childPath(prefix, i))
		if err != nil {
			if g.keepGoing {
				results[i] = errResult(err.Type, err.Err)

				continue
			}

			return nil, false, err
		}

		if changed {
			mutated = true
		}

		results[i] = res
	}

	return results, mutated, nil
}

// runChild executes one planned step against working. For a leaf it returns the
// child's body; for a nested group it recurses (always against a clone, so the
// nested group is its own rollback boundary) and renders the nested result.
//
// isolate (set for keep-going parents) makes a leaf mutation apply to a clone
// committed only on success, so a failing child rolls back without disturbing
// the successes already accumulated in working. Under fail-fast the leaf mutates
// working in place: a failure aborts the batch, which discards working entirely.
//
// path is this child's full index path; a returned *BulkChildError carries it
// (or, for a nested abort, the deeper path the sub-group built).
func (s *Store) runChild(
	ctx context.Context, working *hasura.Metadata, st bulkStep, isolate bool, path []int,
) (BulkResult, bool, *BulkChildError) {
	if st.group != nil {
		return s.runNestedGroup(ctx, working, st, path)
	}

	body, changed, err := s.runLeaf(ctx, working, st, isolate)
	if err != nil {
		return BulkResult{}, false, &BulkChildError{Path: path, Type: st.typ, Err: err}
	}

	return leafResult(st.typ, body), changed, nil
}

// runNestedGroup runs a nested bulk against a clone of working so the sub-group
// is its own rollback boundary, then commits the clone into working iff the
// group succeeded. A nested bulk / bulk_keep_going renders as a bare array; a
// nested bulk_atomic renders as a single {"message":"success"} object.
func (s *Store) runNestedGroup(
	ctx context.Context, working *hasura.Metadata, st bulkStep, path []int,
) (BulkResult, bool, *BulkChildError) {
	clone, err := cloneWorking(working)
	if err != nil {
		return BulkResult{}, false, &BulkChildError{Path: path, Type: st.typ, Err: err}
	}

	results, changed, abortErr := s.runGroup(ctx, clone, st.group, path)
	if abortErr != nil {
		// The nested group aborted (fail-fast or atomic rollback); discard the
		// clone and propagate the deeper failure (the parent decides whether to
		// abort or record it as a slot error).
		return BulkResult{}, false, abortErr
	}

	*working = *clone

	if st.group.atomic {
		return leafResult(st.typ, map[string]any{"message": "success"}), changed, nil
	}

	return arrayResult(st.typ, results), changed, nil
}

// runLeaf executes one non-group step against working, returning the per-child
// body, whether it changed the metadata, and any error.
func (s *Store) runLeaf(
	ctx context.Context, working *hasura.Metadata, st bulkStep, isolate bool,
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
		return applyMutateStep(working, st.mutate, isolate)
	}

	return nil, false, fmt.Errorf("%w: %q", ErrUnknownMutationOp, st.typ)
}

// childPath returns prefix with index i appended, without aliasing prefix's
// backing array (each child needs its own path slice).
func childPath(prefix []int, i int) []int {
	path := make([]int, len(prefix)+1)
	copy(path, prefix)
	path[len(prefix)] = i

	return path
}

// applyMutateStep runs a mutating step. Under isolate it applies to a clone and
// commits only on success, so a failing child rolls back without disturbing the
// successes already accumulated in working. Otherwise it mutates working in
// place: a failure aborts the whole batch, which discards working entirely, so a
// partial in-place mutation never reaches the durable write.
func applyMutateStep(
	working *hasura.Metadata, fn MutationFn, isolate bool,
) (map[string]any, bool, error) {
	target := working

	if isolate {
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

	if isolate {
		*working = *target
	}

	if code != "" {
		return map[string]any{"message": string(code)}, false, nil
	}

	return map[string]any{"message": "success"}, true, nil
}

// cloneWorking deep-clones the in-flight metadata via its wire form so a child
// (or a nested group) can be rolled back without mutating the shared working
// copy.
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

// planGroup resolves a child list to an executable group before the write lock
// is taken, recursing into nested bulks. depth bounds nesting (maxBulkNestingDepth).
func (s *Store) planGroup(
	ctx context.Context, children []BulkChild, keepGoing, atomic bool, depth int,
) *bulkGroup {
	steps := make([]bulkStep, len(children))
	for i, c := range children {
		steps[i] = s.planBulkChild(ctx, c, atomic, depth)
	}

	return &bulkGroup{steps: steps, keepGoing: keepGoing, atomic: atomic}
}

// planBulkChild resolves a child to an executable step. In an atomic group only
// the narrow whitelist is accepted (matching Hasura, which rejects nested bulk
// and everything off-list). Otherwise bulk children recurse; mutation children
// funnel through BuildMutation; pg_untrack_table additionally resolves its
// cascade dependencies from the data database (the same DB-backed cascade the
// single-op path gets); the validating remote-schema ops (add/update_remote_schema,
// add_remote_schema_permissions) introspect the upstream synchronously here, off
// the write lock, matching the single-op path; reads bind to their lock-free
// cores; the whole-metadata ops compose onto the working copy.
func (s *Store) planBulkChild(ctx context.Context, c BulkChild, atomic bool, depth int) bulkStep {
	if atomic {
		if !BulkAtomicSupports(c.Type) {
			return errStep(c.Type, fmt.Errorf("%w (op %q)", ErrBulkAtomicUnsupported, c.Type))
		}

		fn, err := BuildMutation(c.Type, c.Args)

		return mutateStep(c.Type, fn, err)
	}

	switch c.Type {
	case opBulk:
		return s.planNested(ctx, c, false /* keepGoing */, false /* atomic */, depth)
	case opBulkKeepGoing:
		return s.planNested(ctx, c, true /* keepGoing */, false /* atomic */, depth)
	case opBulkAtomic:
		return s.planNested(ctx, c, false /* keepGoing */, true /* atomic */, depth)
	case opPgGetViewdef:
		return readStep(
			c.Type,
			func(ctx context.Context, _ *hasura.Metadata) (map[string]any, error) {
				return s.PgGetViewdef(ctx, c.Args)
			},
		)
	case opPgSuggestRelationships:
		return readStep(
			c.Type,
			func(ctx context.Context, working *hasura.Metadata) (map[string]any, error) {
				return s.pgSuggestRelationshipsAgainst(ctx, working, c.Args)
			},
		)
	case opReplaceMetadata:
		fn, err := buildReplaceMetadataMutation(c.Args)

		return mutateStep(c.Type, fn, err)
	case opClearMetadata:
		return mutateStep(c.Type, clearMetadataMutation(), nil)
	case opReloadMetadata:
		// The working copy is, by construction, the current in-flight state, so
		// a reload is a success no-op here rather than a DB refetch that would
		// discard earlier children's edits.
		return noopStep(c.Type)
	case opPgUntrackTable:
		deps, err := s.loadUntrackDeps(ctx, c.Args)
		if err != nil {
			return errStep(c.Type, err)
		}

		fn, bErr := buildPgUntrackTable(c.Args, deps)

		return mutateStep(c.Type, fn, bErr)
	case opAddRemoteSchema:
		// Synchronous upstream introspection, like the single-op path; the bulk
		// pre-pass runs it off s.mu (see planAddRemoteSchema).
		return s.planAddRemoteSchema(ctx, c.Args)
	case opUpdateRemoteSchema:
		return s.planUpdateRemoteSchema(ctx, c.Args)
	case opAddRemoteSchemaPermissions:
		return s.planAddRemoteSchemaPermissions(ctx, c.Args)
	default:
		fn, err := BuildMutation(c.Type, c.Args)

		return mutateStep(c.Type, fn, err)
	}
}

// planNested parses and plans a nested bulk child, enforcing the depth cap.
func (s *Store) planNested(
	ctx context.Context, c BulkChild, keepGoing, atomic bool, depth int,
) bulkStep {
	if depth+1 > maxBulkNestingDepth {
		return errStep(c.Type, ErrBulkNestingTooDeep)
	}

	children, err := ParseBulkChildren(c.Args)
	if err != nil {
		return errStep(c.Type, err)
	}

	return groupStep(c.Type, s.planGroup(ctx, children, keepGoing, atomic, depth+1))
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
