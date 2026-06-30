package source

import (
	"errors"
	"slices"
	"strings"
	"testing"
)

func trackChild(name string) BulkChild {
	return BulkChild{
		Type: "pg_track_table",
		Args: []byte(`{"source":"default","table":{"schema":"public","name":"` + name + `"}}`),
	}
}

func missingSourceChild() BulkChild {
	return BulkChild{
		Type: "pg_track_table",
		Args: []byte(`{"source":"missing","table":{"schema":"public","name":"x"}}`),
	}
}

func TestApplyBulk_SingleWriteForMultipleMutations(t *testing.T) {
	t.Parallel()

	w := &fakeWriter{}
	s := bootstrappedStore(t, w)

	outcomes, rv, mutated, err := s.ApplyBulk(
		t.Context(),
		[]BulkChild{trackChild("users"), trackChild("orgs")},
		false,
	)
	if err != nil {
		t.Fatalf("ApplyBulk: %v", err)
	}

	if !mutated {
		t.Errorf("mutated = false, want true")
	}

	if len(outcomes) != 2 {
		t.Fatalf("outcomes = %d, want 2", len(outcomes))
	}

	// One durable write for the whole batch, one RV bump (7 → 8).
	if w.callCount() != 1 {
		t.Errorf("writer calls = %d, want 1 (single write)", w.callCount())
	}

	if rv != 8 || s.ResourceVersion() != 8 {
		t.Errorf("rv = %d / store rv = %d, want 8", rv, s.ResourceVersion())
	}
}

func TestApplyBulk_FailFastAbortsWithIndexNoWrite(t *testing.T) {
	t.Parallel()

	w := &fakeWriter{}
	s := bootstrappedStore(t, w)

	_, _, _, err := s.ApplyBulk( //nolint:dogsled
		t.Context(),
		[]BulkChild{trackChild("users"), missingSourceChild(), trackChild("orgs")},
		false,
	)

	var childErr *BulkChildError
	if !errors.As(err, &childErr) {
		t.Fatalf("err = %v, want *BulkChildError", err)
	}

	if len(childErr.Path) != 1 || childErr.Path[0] != 1 {
		t.Errorf("fail path = %v, want [1]", childErr.Path)
	}

	if !errors.Is(childErr.Err, ErrSourceNotFound) {
		t.Errorf("wrapped err = %v, want ErrSourceNotFound", childErr.Err)
	}

	// Fail-fast discards the whole batch — not even the first child persists.
	if w.callCount() != 0 {
		t.Errorf("writer calls = %d, want 0 (no partial write)", w.callCount())
	}

	if s.ResourceVersion() != 7 {
		t.Errorf("rv = %d, want 7 (unchanged)", s.ResourceVersion())
	}
}

func TestApplyBulk_KeepGoingPersistsSurvivorsInSingleWrite(t *testing.T) {
	t.Parallel()

	w := &fakeWriter{}
	s := bootstrappedStore(t, w)

	outcomes, rv, mutated, err := s.ApplyBulk(
		t.Context(),
		[]BulkChild{trackChild("users"), missingSourceChild(), trackChild("orgs")},
		true,
	)
	if err != nil {
		t.Fatalf("ApplyBulk: %v", err)
	}

	if !mutated {
		t.Errorf("mutated = false, want true")
	}

	if len(outcomes) != 3 {
		t.Fatalf("outcomes = %d, want 3", len(outcomes))
	}

	if outcomes[0].Err != nil || outcomes[2].Err != nil {
		t.Errorf("survivors carry errors: [0]=%v [2]=%v", outcomes[0].Err, outcomes[2].Err)
	}

	if outcomes[1].Err == nil {
		t.Errorf("outcome[1].Err = nil, want the failed child's error")
	}

	// Two survivors persisted by ONE write, one RV bump.
	if w.callCount() != 1 {
		t.Errorf("writer calls = %d, want 1 (single write of survivors)", w.callCount())
	}

	if rv != 8 {
		t.Errorf("rv = %d, want 8", rv)
	}

	// The failed child must not have leaked its target into the snapshot, and
	// both survivors must be present.
	snap, _ := s.HasuraSnapshotJSON()

	got := string(snap)
	for _, want := range []string{`"name":"users"`, `"name":"orgs"`} {
		if !strings.Contains(got, want) {
			t.Errorf("snapshot missing %s; snap = %s", want, got)
		}
	}
}

func TestApplyBulk_NoMutationNoWrite(t *testing.T) {
	t.Parallel()

	w := &fakeWriter{}
	s := bootstrappedStore(t, w)

	// Track users once outside the bulk, then re-track twice inside: both are
	// idempotent no-ops, so the bulk performs no write.
	if _, _, err := s.PgTrackTable(
		t.Context(),
		[]byte(`{"source":"default","table":{"schema":"public","name":"users"}}`),
	); err != nil {
		t.Fatalf("seed track: %v", err)
	}

	seedCalls := w.callCount()

	outcomes, rv, mutated, err := s.ApplyBulk(
		t.Context(),
		[]BulkChild{trackChild("users"), trackChild("users")},
		false,
	)
	if err != nil {
		t.Fatalf("ApplyBulk: %v", err)
	}

	if mutated {
		t.Errorf("mutated = true, want false (all idempotent)")
	}

	if w.callCount() != seedCalls {
		t.Errorf(
			"writer calls = %d, want %d (no write on all-idempotent)",
			w.callCount(),
			seedCalls,
		)
	}

	if rv != s.ResourceVersion() {
		t.Errorf("rv = %d, want current %d", rv, s.ResourceVersion())
	}

	for i, o := range outcomes {
		body, _ := o.Body.(map[string]any)
		if msg, _ := body["message"].(string); msg != "already-tracked" {
			t.Errorf("outcome[%d] message = %v, want already-tracked", i, o.Body)
		}
	}
}

func TestApplyBulk_UninitializedStore(t *testing.T) {
	t.Parallel()

	s := NewStore(&fakeWriter{}, nil, nil)

	if _, _, _, err := s.ApplyBulk(
		t.Context(),
		[]BulkChild{trackChild("users")},
		false,
	); !errors.Is(
		err,
		ErrStoreNotInitialized,
	) {
		t.Errorf("err = %v, want ErrStoreNotInitialized", err)
	}
}

// nestedBulkChild wraps children in a `bulk` op.
func nestedBulkChild(children ...BulkChild) BulkChild {
	var b strings.Builder

	b.WriteString("[")

	for i, c := range children {
		if i > 0 {
			b.WriteString(",")
		}

		b.WriteString(`{"type":"`)
		b.WriteString(c.Type)
		b.WriteString(`","args":`)
		b.Write(c.Args)
		b.WriteString("}")
	}

	b.WriteString("]")

	return BulkChild{Type: "bulk", Args: []byte(b.String())}
}

func TestApplyBulk_NestedBulk_SingleWriteNestedArray(t *testing.T) {
	t.Parallel()

	w := &fakeWriter{}
	s := bootstrappedStore(t, w)

	// bulk: [ track(users), bulk: [ track(orgs), track(teams) ] ]
	results, rv, mutated, err := s.ApplyBulk(
		t.Context(),
		[]BulkChild{
			trackChild("users"),
			nestedBulkChild(trackChild("orgs"), trackChild("teams")),
		},
		false,
	)
	if err != nil {
		t.Fatalf("ApplyBulk: %v", err)
	}

	if !mutated {
		t.Errorf("mutated = false, want true")
	}

	// One durable write for the whole (nested) bulk, one RV bump (7 → 8).
	if w.callCount() != 1 {
		t.Errorf("writer calls = %d, want 1 (single write across nesting)", w.callCount())
	}

	if rv != 8 {
		t.Errorf("rv = %d, want 8 (one bump)", rv)
	}

	if len(results) != 2 {
		t.Fatalf("results = %d, want 2", len(results))
	}

	// The nested child renders as an array result, not a leaf body.
	if !results[1].Array || len(results[1].Children) != 2 {
		t.Errorf("results[1] = %+v, want a 2-element nested array", results[1])
	}

	snap, _ := s.HasuraSnapshotJSON()

	got := string(snap)
	for _, want := range []string{`"name":"users"`, `"name":"orgs"`, `"name":"teams"`} {
		if !strings.Contains(got, want) {
			t.Errorf("snapshot missing %s; snap = %s", want, got)
		}
	}
}

func TestApplyBulk_NestedFailFast_AbortsWithNestedPath(t *testing.T) {
	t.Parallel()

	w := &fakeWriter{}
	s := bootstrappedStore(t, w)

	// bulk: [ track(users), bulk: [ track(orgs), missing-source ] ]
	// The inner bulk aborts at its index 1; the whole batch is discarded.
	_, _, _, err := s.ApplyBulk( //nolint:dogsled
		t.Context(),
		[]BulkChild{
			trackChild("users"),
			nestedBulkChild(trackChild("orgs"), missingSourceChild()),
		},
		false,
	)

	var childErr *BulkChildError
	if !errors.As(err, &childErr) {
		t.Fatalf("err = %v, want *BulkChildError", err)
	}

	if !slices.Equal(childErr.Path, []int{1, 1}) {
		t.Errorf("path = %v, want [1 1]", childErr.Path)
	}

	if childErr.PathString() != "$.args[1].args[1]" {
		t.Errorf("PathString = %q, want $.args[1].args[1]", childErr.PathString())
	}

	if w.callCount() != 0 {
		t.Errorf("writer calls = %d, want 0 (nested abort discards the batch)", w.callCount())
	}

	if s.ResourceVersion() != 7 {
		t.Errorf("rv = %d, want 7 (unchanged)", s.ResourceVersion())
	}
}

func TestApplyBulk_KeepGoing_CatchesNestedAbort(t *testing.T) {
	t.Parallel()

	w := &fakeWriter{}
	s := bootstrappedStore(t, w)

	// bulk_keep_going: [ inner-bulk-that-aborts, track(survivor) ]
	// The inner fail-fast bulk aborts; the keep-going parent records it as a slot
	// error, rolls back the inner partial work, and the survivor still persists.
	results, rv, mutated, err := s.ApplyBulk(
		t.Context(),
		[]BulkChild{
			nestedBulkChild(trackChild("orgs"), missingSourceChild()),
			trackChild("survivor"),
		},
		true,
	)
	if err != nil {
		t.Fatalf("ApplyBulk: %v", err)
	}

	if !mutated || rv != 8 {
		t.Errorf("mutated = %v rv = %d, want true / 8", mutated, rv)
	}

	if len(results) != 2 {
		t.Fatalf("results = %d, want 2", len(results))
	}

	if results[0].Err == nil {
		t.Errorf("results[0].Err = nil, want the nested abort error")
	}

	if results[1].Err != nil {
		t.Errorf("results[1].Err = %v, want nil (survivor)", results[1].Err)
	}

	// The inner bulk's partial child (orgs) must have rolled back; only the
	// survivor should be present.
	snap, _ := s.HasuraSnapshotJSON()
	got := string(snap)

	if strings.Contains(got, `"name":"orgs"`) {
		t.Errorf("snapshot leaked rolled-back inner child 'orgs'; snap = %s", got)
	}

	if !strings.Contains(got, `"name":"survivor"`) {
		t.Errorf("snapshot missing survivor; snap = %s", got)
	}
}

func TestApplyBulk_NestedDepthCapRejected(t *testing.T) {
	t.Parallel()

	w := &fakeWriter{}
	s := bootstrappedStore(t, w)

	// Build a bulk nested past maxBulkNestingDepth.
	inner := trackChild("users")
	for range maxBulkNestingDepth + 1 {
		inner = nestedBulkChild(inner)
	}

	_, _, _, err := s.ApplyBulk(t.Context(), []BulkChild{inner}, false) //nolint:dogsled

	var childErr *BulkChildError
	if !errors.As(err, &childErr) {
		t.Fatalf("err = %v, want *BulkChildError", err)
	}

	if !errors.Is(childErr.Err, ErrBulkNestingTooDeep) {
		t.Errorf("err = %v, want ErrBulkNestingTooDeep", childErr.Err)
	}

	if w.callCount() != 0 {
		t.Errorf("writer calls = %d, want 0", w.callCount())
	}
}
