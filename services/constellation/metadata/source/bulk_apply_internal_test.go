package source

import (
	"errors"
	"strings"
	"testing"
)

func trackChild(name string) BulkChild {
	return BulkChild{
		Type: "pg_track_table",
		Args: []byte(`{"source":"default","table":{"schema":"public","name":"` + name + `"}}`),
	}
}

func missingSourceChild(name string) BulkChild {
	return BulkChild{
		Type: "pg_track_table",
		Args: []byte(`{"source":"missing","table":{"schema":"public","name":"` + name + `"}}`),
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

	_, _, _, err := s.ApplyBulk(
		t.Context(),
		[]BulkChild{trackChild("users"), missingSourceChild("x"), trackChild("orgs")},
		false,
	)

	var childErr *BulkChildError
	if !errors.As(err, &childErr) {
		t.Fatalf("err = %v, want *BulkChildError", err)
	}

	if childErr.Index != 1 {
		t.Errorf("fail index = %d, want 1", childErr.Index)
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
		[]BulkChild{trackChild("users"), missingSourceChild("x"), trackChild("orgs")},
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
		if msg, _ := o.Body["message"].(string); msg != "already-tracked" {
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
