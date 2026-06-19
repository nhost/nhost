package source

import (
	"errors"
	"strings"
	"testing"
)

// objRelArgs / arrRelArgs create a self-referential object / array relationship
// on public.users, named "obj" / "arr" so the drop and rename assertions can
// distinguish them from each other and from the lowered remote-relationship
// duplicate used by the remote-derived guard cases.
const (
	objRelArgs = `{"source":"default","table":{"schema":"public","name":"users"},` +
		`"name":"obj","using":{"manual_configuration":{` +
		`"remote_table":{"schema":"public","name":"users"},"column_mapping":{"id":"id"}}}}`

	arrRelArgs = `{"source":"default","table":{"schema":"public","name":"users"},` +
		`"name":"arr","using":{"manual_configuration":{` +
		`"remote_table":{"schema":"public","name":"users"},"column_mapping":{"id":"id"}}}}`
)

func dropRelArgs(name string) []byte {
	return []byte(`{"source":"default","table":{"schema":"public","name":"users"},` +
		`"relationship":"` + name + `"}`)
}

func renameRelArgs(name, newName string) []byte {
	return []byte(`{"source":"default","table":{"schema":"public","name":"users"},` +
		`"name":"` + name + `","new_name":"` + newName + `"}`)
}

func setEnumArgs(isEnum bool) []byte {
	v := "false"
	if isEnum {
		v = "true"
	}

	return []byte(`{"source":"default","table":{"schema":"public","name":"users"},` +
		`"is_enum":` + v + `}`)
}

// mustCreateObjRel / mustCreateArrRel / mustCreateRemoteRel seed a relationship
// on public.users and fail the test on error, keeping the create boilerplate out
// of the table-driven cases below.
func mustCreateObjRel(t *testing.T, s *Store) {
	t.Helper()

	if _, _, err := s.PgCreateObjectRelationship(t.Context(), []byte(objRelArgs)); err != nil {
		t.Fatalf("PgCreateObjectRelationship: %v", err)
	}
}

func mustCreateArrRel(t *testing.T, s *Store) {
	t.Helper()

	if _, _, err := s.PgCreateArrayRelationship(t.Context(), []byte(arrRelArgs)); err != nil {
		t.Fatalf("PgCreateArrayRelationship: %v", err)
	}
}

func mustCreateRemoteRel(t *testing.T, s *Store) {
	t.Helper()

	if _, _, err := s.PgCreateRemoteRelationship(t.Context(), []byte(createRemoteRelArgs)); err != nil {
		t.Fatalf("PgCreateRemoteRelationship: %v", err)
	}
}

func TestPgSetTableIsEnum(t *testing.T) {
	t.Parallel()

	t.Run("toggle on, idempotent re-apply, toggle off", func(t *testing.T) {
		t.Parallel()

		s := bootstrappedStore(t, &fakeWriter{})
		seedUsersTable(t, s)

		if _, code, err := s.PgSetTableIsEnum(t.Context(), setEnumArgs(true)); err != nil ||
			code != "" {
			t.Fatalf("PgSetTableIsEnum(true) = code %q err %v, want \"\" nil", code, err)
		}

		if raw, _ := s.HasuraSnapshotJSON(); !strings.Contains(string(raw), `"is_enum":true`) {
			t.Fatalf("snapshot missing is_enum:true after toggle on; raw=%s", raw)
		}

		// Re-applying the same value is a no-op that still succeeds.
		if _, _, err := s.PgSetTableIsEnum(t.Context(), setEnumArgs(true)); err != nil {
			t.Fatalf("PgSetTableIsEnum(true) re-apply: %v", err)
		}

		// Toggling back to false clears the flag; is_enum is omitzero so it
		// disappears from the snapshot entirely.
		if _, _, err := s.PgSetTableIsEnum(t.Context(), setEnumArgs(false)); err != nil {
			t.Fatalf("PgSetTableIsEnum(false): %v", err)
		}

		if raw, _ := s.HasuraSnapshotJSON(); strings.Contains(string(raw), `"is_enum"`) {
			t.Fatalf("is_enum still present after toggle off; raw=%s", raw)
		}
	})

	t.Run("missing required fields", func(t *testing.T) {
		t.Parallel()

		s := bootstrappedStore(t, &fakeWriter{})

		_, _, err := s.PgSetTableIsEnum(t.Context(), []byte(`{"source":"default","is_enum":true}`))
		if !errors.Is(err, errMissingRequiredField) {
			t.Fatalf("PgSetTableIsEnum err = %v, want errMissingRequiredField", err)
		}
	})

	t.Run("untracked table", func(t *testing.T) {
		t.Parallel()

		s := bootstrappedStore(t, &fakeWriter{})

		_, _, err := s.PgSetTableIsEnum(t.Context(), setEnumArgs(true))
		if !errors.Is(err, ErrTableNotTracked) {
			t.Fatalf("PgSetTableIsEnum err = %v, want ErrTableNotTracked", err)
		}
	})
}

func TestPgDropRelationship(t *testing.T) {
	t.Parallel()

	t.Run("drops object and array relationships", func(t *testing.T) {
		t.Parallel()

		s := bootstrappedStore(t, &fakeWriter{})
		seedUsersTable(t, s)
		mustCreateObjRel(t, s)
		mustCreateArrRel(t, s)

		if _, _, err := s.PgDropRelationship(t.Context(), dropRelArgs("obj")); err != nil {
			t.Fatalf("PgDropRelationship(obj): %v", err)
		}

		if _, _, err := s.PgDropRelationship(t.Context(), dropRelArgs("arr")); err != nil {
			t.Fatalf("PgDropRelationship(arr): %v", err)
		}

		raw, _ := s.HasuraSnapshotJSON()
		if strings.Contains(string(raw), `"obj"`) || strings.Contains(string(raw), `"arr"`) {
			t.Fatalf("relationship survived drop; raw=%s", raw)
		}
	})

	t.Run("missing relationship returns ErrRelationshipNotFound", func(t *testing.T) {
		t.Parallel()

		s := bootstrappedStore(t, &fakeWriter{})
		seedUsersTable(t, s)

		_, _, err := s.PgDropRelationship(t.Context(), dropRelArgs("nope"))
		if !errors.Is(err, ErrRelationshipNotFound) {
			t.Fatalf("PgDropRelationship err = %v, want ErrRelationshipNotFound", err)
		}
	})

	t.Run("remote-derived relationship is guarded", func(t *testing.T) {
		t.Parallel()

		s := bootstrappedStore(t, &fakeWriter{})
		seedUsersTable(t, s)

		// On load a remote relationship lowers into a same-named object/array
		// relationship; pg_drop_relationship must refuse to touch that duplicate
		// (it is managed via pg_delete_remote_relationship) and report not-found.
		mustCreateRemoteRel(t, s)

		_, _, err := s.PgDropRelationship(t.Context(), dropRelArgs("rel"))
		if !errors.Is(err, ErrRelationshipNotFound) {
			t.Fatalf("PgDropRelationship(remote) err = %v, want ErrRelationshipNotFound", err)
		}
	})

	t.Run("missing required fields", func(t *testing.T) {
		t.Parallel()

		s := bootstrappedStore(t, &fakeWriter{})

		_, _, err := s.PgDropRelationship(t.Context(), []byte(
			`{"source":"default","table":{"schema":"public","name":"users"}}`,
		))
		if !errors.Is(err, errMissingRequiredField) {
			t.Fatalf("PgDropRelationship err = %v, want errMissingRequiredField", err)
		}
	})
}

func TestPgRenameRelationship(t *testing.T) {
	t.Parallel()

	t.Run("successful rename", func(t *testing.T) {
		t.Parallel()

		s := bootstrappedStore(t, &fakeWriter{})
		seedUsersTable(t, s)
		mustCreateObjRel(t, s)

		if _, code, err := s.PgRenameRelationship(
			t.Context(), renameRelArgs("obj", "obj2"),
		); err != nil || code != "" {
			t.Fatalf("PgRenameRelationship = code %q err %v, want \"\" nil", code, err)
		}

		raw, _ := s.HasuraSnapshotJSON()
		if !strings.Contains(string(raw), `"obj2"`) || strings.Contains(string(raw), `"obj"`) {
			t.Fatalf("rename did not replace obj with obj2; raw=%s", raw)
		}
	})

	t.Run("self-rename is idempotent", func(t *testing.T) {
		t.Parallel()

		s := bootstrappedStore(t, &fakeWriter{})
		seedUsersTable(t, s)
		mustCreateObjRel(t, s)

		_, code, err := s.PgRenameRelationship(t.Context(), renameRelArgs("obj", "obj"))
		if err != nil {
			t.Fatalf("PgRenameRelationship self-rename err = %v, want nil", err)
		}

		if code != CodeAlreadyExists {
			t.Fatalf("PgRenameRelationship self-rename code = %q, want %q", code, CodeAlreadyExists)
		}
	})

	t.Run("rename onto existing name returns ErrRelationshipExists", func(t *testing.T) {
		t.Parallel()

		s := bootstrappedStore(t, &fakeWriter{})
		seedUsersTable(t, s)
		mustCreateObjRel(t, s)
		mustCreateArrRel(t, s)

		_, _, err := s.PgRenameRelationship(t.Context(), renameRelArgs("obj", "arr"))
		if !errors.Is(err, ErrRelationshipExists) {
			t.Fatalf("PgRenameRelationship err = %v, want ErrRelationshipExists", err)
		}
	})

	t.Run("remote-derived relationship is guarded", func(t *testing.T) {
		t.Parallel()

		s := bootstrappedStore(t, &fakeWriter{})
		seedUsersTable(t, s)
		mustCreateRemoteRel(t, s)

		_, _, err := s.PgRenameRelationship(t.Context(), renameRelArgs("rel", "rel2"))
		if !errors.Is(err, ErrRelationshipNotFound) {
			t.Fatalf("PgRenameRelationship(remote) err = %v, want ErrRelationshipNotFound", err)
		}
	})

	t.Run("missing relationship returns ErrRelationshipNotFound", func(t *testing.T) {
		t.Parallel()

		s := bootstrappedStore(t, &fakeWriter{})
		seedUsersTable(t, s)

		_, _, err := s.PgRenameRelationship(t.Context(), renameRelArgs("nope", "x"))
		if !errors.Is(err, ErrRelationshipNotFound) {
			t.Fatalf("PgRenameRelationship err = %v, want ErrRelationshipNotFound", err)
		}
	})

	t.Run("missing required fields", func(t *testing.T) {
		t.Parallel()

		s := bootstrappedStore(t, &fakeWriter{})

		_, _, err := s.PgRenameRelationship(t.Context(), []byte(
			`{"source":"default","table":{"schema":"public","name":"users"},"name":"obj"}`,
		))
		if !errors.Is(err, errMissingRequiredField) {
			t.Fatalf("PgRenameRelationship err = %v, want errMissingRequiredField", err)
		}
	})
}
