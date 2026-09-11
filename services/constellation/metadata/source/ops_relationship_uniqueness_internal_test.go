package source

import (
	"errors"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

// seedUsersTable tracks public.users on the bootstrapped store so a
// relationship can subsequently be created on it. Relationship creates
// require a tracked table; without this seed they would fail with
// ErrTableNotTracked rather than exercising the uniqueness guards.
func seedUsersTable(t *testing.T, s *Store) {
	t.Helper()

	if _, _, err := s.PgTrackTable(t.Context(), []byte(
		`{"source":"default","table":{"schema":"public","name":"users"}}`,
	)); err != nil {
		t.Fatalf("PgTrackTable: %v", err)
	}
}

const (
	createObjectRelArgs = `{"source":"default",` +
		`"table":{"schema":"public","name":"users"},` +
		`"name":"rel",` +
		`"using":{"manual_configuration":{` +
		`"remote_table":{"schema":"public","name":"users"},"column_mapping":{"id":"id"}}}}`

	createArrayRelArgs = `{"source":"default",` +
		`"table":{"schema":"public","name":"users"},` +
		`"name":"rel",` +
		`"using":{"manual_configuration":{` +
		`"remote_table":{"schema":"public","name":"users"},"column_mapping":{"id":"id"}}}}`

	createRemoteRelArgs = `{"source":"default",` +
		`"table":{"schema":"public","name":"users"},` +
		`"name":"rel",` +
		`"definition":{"to_source":{"source":"default",` +
		`"table":{"schema":"public","name":"users"},` +
		`"relationship_type":"object","field_mapping":{"id":"id"}}}}`
)

// TestCreateRemoteRelationship_RejectsExistingObjectName is the regression
// guard for the silent data-loss bug: creating a remote relationship whose
// name already belongs to an object relationship must be rejected, and the
// pre-existing object relationship must survive in the persisted snapshot
// (it would otherwise be dropped by withoutDerivedRelationships on the next
// marshal).
func TestCreateRemoteRelationship_RejectsExistingObjectName(t *testing.T) {
	t.Parallel()

	s := bootstrappedStore(t, &fakeWriter{})
	seedUsersTable(t, s)

	if _, _, err := s.PgCreateObjectRelationship(
		t.Context(),
		[]byte(createObjectRelArgs),
	); err != nil {
		t.Fatalf("PgCreateObjectRelationship: %v", err)
	}

	_, _, err := s.PgCreateRemoteRelationship(t.Context(), []byte(createRemoteRelArgs))
	if !errors.Is(err, ErrRelationshipExists) {
		t.Fatalf("PgCreateRemoteRelationship err = %v, want ErrRelationshipExists", err)
	}

	raw, _ := s.HasuraSnapshotJSON()
	if !strings.Contains(string(raw), `"rel"`) {
		t.Fatalf("object relationship %q was dropped from snapshot; raw=%s", "rel", raw)
	}
}

// TestCreateObjectRelationship_RejectsExistingRemoteName covers the symmetric
// direction: a remote relationship exists first, then an object relationship
// of the same name must not be created.
//
// Here the rejection surfaces as the idempotent CodeAlreadyExists rather than
// a hard ErrRelationshipExists: a to_source remote relationship is lowered into
// an ObjectRelationship of the same name by convertRemoteRelationships at clone
// time, so the create-object handler's within-kind already-exists check fires
// first. Both outcomes map to the Hasura "already-exists" wire code via
// classifyMutationError, so the name collision is reported either way and the
// existing remote relationship is never clobbered. Forcing a hard error here
// would false-positive against the lowered duplicate that the round-trip
// invariant deliberately keeps in place.
func TestCreateObjectRelationship_RejectsExistingRemoteName(t *testing.T) {
	t.Parallel()

	s := bootstrappedStore(t, &fakeWriter{})
	seedUsersTable(t, s)

	if _, _, err := s.PgCreateRemoteRelationship(
		t.Context(),
		[]byte(createRemoteRelArgs),
	); err != nil {
		t.Fatalf("PgCreateRemoteRelationship: %v", err)
	}

	_, code, err := s.PgCreateObjectRelationship(t.Context(), []byte(createObjectRelArgs))
	if err != nil {
		t.Fatalf("PgCreateObjectRelationship err = %v, want nil with CodeAlreadyExists", err)
	}

	if code != CodeAlreadyExists {
		t.Fatalf("PgCreateObjectRelationship code = %q, want %q", code, CodeAlreadyExists)
	}

	// The remote relationship must survive unchanged.
	raw, _ := s.HasuraSnapshotJSON()
	if !strings.Contains(string(raw), `"remote_relationships"`) {
		t.Fatalf("remote relationship was dropped from snapshot; raw=%s", raw)
	}
}

// TestCreateArrayRelationship_RejectsExistingObjectName covers the
// object-then-array cross-kind collision.
func TestRenameRelationship_RejectsExistingRemoteName(t *testing.T) {
	t.Parallel()

	// Models the state inside a single in-flight working copy (e.g. a bulk
	// request that creates a remote relationship and then renames an object
	// relationship in the same batch): the remote relationship "rem" lives only
	// in RemoteRelationships and has NOT been lowered into the object/array
	// lists, because that lowering happens once at FromJSON load time, not per
	// child op. Renaming "obj" onto "rem" would create two relationships sharing
	// one GraphQL field name (and a non-round-tripping export), so it must be
	// rejected — mirroring the create handlers, which check both the
	// object/array and the remote name spaces.
	tbl := hasura.TableSource{Schema: "public", Name: "users"}
	tm := &hasura.TableMetadata{
		Table:               tbl,
		ObjectRelationships: []hasura.ObjectRelationship{{Name: "obj"}},
		RemoteRelationships: []hasura.RemoteRelationship{{Name: "rem"}},
	}

	_, err := renameRelationship(tm, tbl, "obj", "rem")
	if !errors.Is(err, ErrRelationshipExists) {
		t.Fatalf("renameRelationship err = %v, want ErrRelationshipExists", err)
	}

	if tm.ObjectRelationships[0].Name != "obj" {
		t.Fatalf(
			"object relationship renamed to %q despite collision with remote relationship",
			tm.ObjectRelationships[0].Name,
		)
	}
}

func TestCreateArrayRelationship_RejectsExistingObjectName(t *testing.T) {
	t.Parallel()

	s := bootstrappedStore(t, &fakeWriter{})
	seedUsersTable(t, s)

	if _, _, err := s.PgCreateObjectRelationship(
		t.Context(),
		[]byte(createObjectRelArgs),
	); err != nil {
		t.Fatalf("PgCreateObjectRelationship: %v", err)
	}

	_, _, err := s.PgCreateArrayRelationship(t.Context(), []byte(createArrayRelArgs))
	if !errors.Is(err, ErrRelationshipExists) {
		t.Fatalf("PgCreateArrayRelationship err = %v, want ErrRelationshipExists", err)
	}
}

// TestCreateRelationships_DistinctNamesSucceed is the sanity case: distinct
// names across all three kinds all succeed, and re-creating the SAME object
// relationship is idempotent (CodeAlreadyExists, not ErrRelationshipExists).
func TestCreateRelationships_DistinctNamesSucceed(t *testing.T) {
	t.Parallel()

	s := bootstrappedStore(t, &fakeWriter{})
	seedUsersTable(t, s)

	objArgs := `{"source":"default","table":{"schema":"public","name":"users"},` +
		`"name":"obj","using":{"manual_configuration":{` +
		`"remote_table":{"schema":"public","name":"users"},"column_mapping":{"id":"id"}}}}`
	arrArgs := `{"source":"default","table":{"schema":"public","name":"users"},` +
		`"name":"arr","using":{"manual_configuration":{` +
		`"remote_table":{"schema":"public","name":"users"},"column_mapping":{"id":"id"}}}}`
	remoteArgs := `{"source":"default","table":{"schema":"public","name":"users"},` +
		`"name":"rem","definition":{"to_source":{"source":"default",` +
		`"table":{"schema":"public","name":"users"},` +
		`"relationship_type":"object","field_mapping":{"id":"id"}}}}`

	if _, _, err := s.PgCreateObjectRelationship(t.Context(), []byte(objArgs)); err != nil {
		t.Fatalf("PgCreateObjectRelationship(obj): %v", err)
	}

	if _, _, err := s.PgCreateArrayRelationship(t.Context(), []byte(arrArgs)); err != nil {
		t.Fatalf("PgCreateArrayRelationship(arr): %v", err)
	}

	if _, _, err := s.PgCreateRemoteRelationship(t.Context(), []byte(remoteArgs)); err != nil {
		t.Fatalf("PgCreateRemoteRelationship(rem): %v", err)
	}

	// Re-creating the same object relationship is an idempotent no-op.
	_, code, err := s.PgCreateObjectRelationship(t.Context(), []byte(objArgs))
	if err != nil {
		t.Fatalf("re-create object relationship err = %v, want nil", err)
	}

	if code != CodeAlreadyExists {
		t.Errorf("re-create object relationship code = %q, want %q", code, CodeAlreadyExists)
	}
}

// TestReplaceMetadata_ResourceVersionConflict verifies that replace_metadata
// honours the optimistic-concurrency token: a stale resource_version is
// rejected with ErrResourceVersionConflict and no write occurs, while a
// matching version (or none) succeeds.
func TestReplaceMetadata_ResourceVersionConflict(t *testing.T) {
	t.Parallel()

	const replacement = `{"version":3,"sources":[]}`

	t.Run("stale version conflicts", func(t *testing.T) {
		t.Parallel()

		w := &fakeWriter{}
		s := bootstrappedStore(t, w)

		// Current version is 7 (bootstrappedStore); 6 is stale.
		args := `{"metadata":` + replacement + `,"resource_version":6}`

		_, _, err := s.ReplaceMetadata(t.Context(), []byte(args))
		if !errors.Is(err, ErrResourceVersionConflict) {
			t.Fatalf("err = %v, want ErrResourceVersionConflict", err)
		}

		if w.callCount() != 0 {
			t.Errorf("writer calls = %d, want 0 (no write on conflict)", w.callCount())
		}

		if got := s.ResourceVersion(); got != 7 {
			t.Errorf("ResourceVersion = %d, want 7 (unchanged on conflict)", got)
		}
	})

	t.Run("matching version succeeds", func(t *testing.T) {
		t.Parallel()

		w := &fakeWriter{}
		s := bootstrappedStore(t, w)

		args := `{"metadata":` + replacement + `,"resource_version":7}`

		rv, _, err := s.ReplaceMetadata(t.Context(), []byte(args))
		if err != nil {
			t.Fatalf("ReplaceMetadata: %v", err)
		}

		if rv != 8 {
			t.Errorf("rv = %d, want 8", rv)
		}
	})

	t.Run("absent version succeeds", func(t *testing.T) {
		t.Parallel()

		w := &fakeWriter{}
		s := bootstrappedStore(t, w)

		rv, _, err := s.ReplaceMetadata(t.Context(), []byte(replacement))
		if err != nil {
			t.Fatalf("ReplaceMetadata: %v", err)
		}

		if rv != 8 {
			t.Errorf("rv = %d, want 8", rv)
		}
	})
}
