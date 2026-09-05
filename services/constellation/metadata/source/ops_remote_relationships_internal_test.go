package source

import (
	"strings"
	"testing"
)

// deleteRemoteRelArgs targets the same name/table as createRemoteRelArgs.
const deleteRemoteRelArgs = `{"source":"default",` +
	`"table":{"schema":"public","name":"users"},` +
	`"name":"rel"}`

// TestDeleteRemoteRelationship_LeavesNoPhantom guards the lowering hazard: on
// load FromJSON lowers each remote relationship into a same-named object/array
// relationship, and export strips that duplicate only while the name is still
// in remote_relationships. Deleting the remote relationship must therefore also
// drop the lowered duplicate, or it persists as a phantom object/array
// relationship that keeps being served and blocks re-creating the same name.
func TestDeleteRemoteRelationship_LeavesNoPhantom(t *testing.T) {
	t.Parallel()

	s := bootstrappedStore(t, &fakeWriter{})
	seedUsersTable(t, s)

	if _, _, err := s.PgCreateRemoteRelationship(
		t.Context(), []byte(createRemoteRelArgs),
	); err != nil {
		t.Fatalf("PgCreateRemoteRelationship: %v", err)
	}

	if _, _, err := s.PgDeleteRemoteRelationship(
		t.Context(), []byte(deleteRemoteRelArgs),
	); err != nil {
		t.Fatalf("PgDeleteRemoteRelationship: %v", err)
	}

	raw, _ := s.HasuraSnapshotJSON()
	if strings.Contains(string(raw), `"rel"`) {
		t.Fatalf("deleted remote relationship %q left a residual entry in snapshot; raw=%s",
			"rel", raw)
	}

	// Re-creating the same name must succeed rather than collide with a phantom
	// object/array relationship via ErrRelationshipExists.
	if _, _, err := s.PgCreateRemoteRelationship(
		t.Context(), []byte(createRemoteRelArgs),
	); err != nil {
		t.Fatalf("re-create after delete: %v, want nil", err)
	}
}
