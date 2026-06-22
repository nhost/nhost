package source

import (
	"errors"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

// cascadeFixtureJSON is a snapshot exercising the introspection-driven cascade.
// user_departments (the untrack target) is already absent, as it would be when
// cascadeUntrack runs. The reverse dependents all reach it through facts only
// the database knows: departments.employees and department_files.department are
// bare foreign_key_constraint_on relationships (no target table in metadata),
// and get_department_manager returns user_departments.
const cascadeFixtureJSON = `{
  "version": 3,
  "sources": [
    {
      "name": "default",
      "kind": "postgres",
      "tables": [
        {
          "table": {"schema": "public", "name": "departments"},
          "array_relationships": [
            {"name": "employees", "using": {"foreign_key_constraint_on": {"column": "department_id", "table": {"schema": "public", "name": "user_departments"}}}},
            {"name": "files", "using": {"foreign_key_constraint_on": {"column": "department_id", "table": {"schema": "public", "name": "department_files"}}}}
          ]
        },
        {
          "table": {"schema": "public", "name": "department_files"},
          "object_relationships": [
            {"name": "department", "using": {"foreign_key_constraint_on": "department_id"}}
          ]
        },
        {
          "table": {"schema": "storage", "name": "files"},
          "object_relationships": [
            {"name": "department_file", "using": {"foreign_key_constraint_on": {"column": "file_id", "table": {"schema": "public", "name": "department_files"}}}}
          ],
          "update_permissions": [
            {"role": "user", "permission": {"columns": ["id"], "filter": {"department_file": {"department": {"employees": {"role": {"_eq": "manager"}}}}}, "check": {}}}
          ]
        },
        {
          "table": {"schema": "public", "name": "news"},
          "select_permissions": [
            {"role": "exists_test", "permission": {"columns": ["id"], "filter": {"_exists": {"_table": {"schema": "public", "name": "user_departments"}, "_where": {}}}}},
            {"role": "plain", "permission": {"columns": ["id"], "filter": {}}}
          ]
        }
      ],
      "functions": [
        {"function": {"schema": "public", "name": "get_department_manager"}},
        {"function": {"schema": "public", "name": "search_news"}}
      ],
      "configuration": {"connection_info": {"database_url": {"from_env": "PG_URL"}}}
    }
  ]
}`

// TestCascadeUntrack_WithDeps exercises the introspection-driven cascade paths
// directly (no live database): a hand-built untrackDeps supplies the FK graph
// and function return types the database would. It pins that the cascade drops
// bare-FK reverse relationships, functions returning the table, and permissions
// that reach the table through a bare-FK relationship path or `_exists`, while
// leaving unrelated objects intact.
func TestCascadeUntrack_WithDeps(t *testing.T) {
	t.Parallel()

	h, err := hasura.FromJSON([]byte(cascadeFixtureJSON))
	if err != nil {
		t.Fatalf("hasura.FromJSON: %v", err)
	}

	target := hasura.TableSource{Schema: "public", Name: "user_departments"}

	deps := &untrackDeps{
		fkByOwnerCols: map[string]hasura.TableSource{
			fkOwnerKey(hasura.TableSource{Schema: "public", Name: "departments"}, []string{"department_id"}): target,
			fkOwnerKey(hasura.TableSource{Schema: "public", Name: "department_files"}, []string{"department_id"}): {
				Schema: "public",
				Name:   "departments",
			},
		},
		funcsReturningTarget: map[string]struct{}{
			funcKey("public", "get_department_manager"): {},
		},
	}

	cascadeUntrack(h, "default", target, deps)

	db := h.Databases[0]
	depts := tableByName(t, db, "public", "departments")

	if arrayRelExists(depts.ArrayRelationships, "employees") {
		t.Error("bare-FK reverse relationship departments.employees was not cascaded")
	}

	if !arrayRelExists(depts.ArrayRelationships, "files") {
		t.Error("departments.files (points at department_files) was wrongly dropped")
	}

	files := tableByName(t, db, "storage", "files")
	if updatePermExists(files.UpdatePermissions, "user") {
		t.Error(
			"storage.files update permission reaching the table via department_file.department.employees was not cascaded",
		)
	}

	news := tableByName(t, db, "public", "news")
	if selectPermExists(news.SelectPermissions, "exists_test") {
		t.Error("news select permission referencing the table via _exists was not cascaded")
	}

	if !selectPermExists(news.SelectPermissions, "plain") {
		t.Error("unrelated news select permission was wrongly dropped")
	}

	if funcExists(db, "get_department_manager") {
		t.Error("function get_department_manager (returns the table) was not cascaded")
	}

	if !funcExists(db, "search_news") {
		t.Error("unrelated function search_news was wrongly dropped")
	}
}

func tableByName(
	t *testing.T,
	db hasura.DatabaseMetadata,
	schema, name string,
) hasura.TableMetadata {
	t.Helper()

	for _, tbl := range db.Tables {
		if tbl.Table.Schema == schema && tbl.Table.Name == name {
			return tbl
		}
	}

	t.Fatalf("table %s.%s not found", schema, name)

	return hasura.TableMetadata{}
}

func arrayRelExists(rels []hasura.ArrayRelationship, name string) bool {
	for _, r := range rels {
		if r.Name == name {
			return true
		}
	}

	return false
}

func updatePermExists(perms []hasura.UpdatePermission, role string) bool {
	for _, p := range perms {
		if p.Role == role {
			return true
		}
	}

	return false
}

func selectPermExists(perms []hasura.SelectPermission, role string) bool {
	for _, p := range perms {
		if p.Role == role {
			return true
		}
	}

	return false
}

func funcExists(db hasura.DatabaseMetadata, name string) bool {
	for _, f := range db.Functions {
		if f.Function.Name == name {
			return true
		}
	}

	return false
}

// TestPgUntrackTable_NoCascade_BlocksOnReverseDependent pins the Hasura-parity
// gate: an uncascaded pg_untrack_table fails with dependency-error when another
// table holds a relationship pointing AT the target (here a metadata-explicit
// manual_configuration, resolvable without DB introspection), even though the
// target itself has no own dependents. Without this gate the table would be
// removed while leaving a dangling reference in the exported metadata.
func TestPgUntrackTable_NoCascade_BlocksOnReverseDependent(t *testing.T) {
	t.Parallel()

	w := &fakeWriter{}
	s := bootstrappedStore(t, w) // metadata-only (queryer == nil)

	for _, tbl := range []string{"departments", "user_departments"} {
		if _, _, err := s.PgTrackTable(t.Context(), []byte(
			`{"source":"default","table":{"schema":"public","name":"`+tbl+`"}}`,
		)); err != nil {
			t.Fatalf("PgTrackTable(%s): %v", tbl, err)
		}
	}

	if _, _, err := s.PgCreateObjectRelationship(t.Context(), []byte(
		`{"source":"default","table":{"schema":"public","name":"departments"},`+
			`"name":"manual_to_udept","using":{"manual_configuration":`+
			`{"remote_table":{"schema":"public","name":"user_departments"},`+
			`"column_mapping":{"id":"department_id"}}}}`,
	)); err != nil {
		t.Fatalf("create reverse relationship: %v", err)
	}

	writesBefore := w.callCount()

	_, _, err := s.PgUntrackTable(t.Context(), []byte(
		`{"source":"default","table":{"schema":"public","name":"user_departments"}}`,
	))
	if !errors.Is(err, ErrTableHasDependents) {
		t.Fatalf("err = %v, want ErrTableHasDependents", err)
	}

	if got := w.callCount(); got != writesBefore {
		t.Errorf(
			"writer called %d times after a blocked untrack, want %d (no write)",
			got,
			writesBefore,
		)
	}
}

// TestPgUntrackTable_NoCascade_CleanTableSucceeds is the positive control: a
// table with no own dependents and nothing pointing at it untracks without
// cascade.
func TestPgUntrackTable_NoCascade_CleanTableSucceeds(t *testing.T) {
	t.Parallel()

	s := bootstrappedStore(t, &fakeWriter{})

	if _, _, err := s.PgTrackTable(t.Context(), []byte(
		`{"source":"default","table":{"schema":"public","name":"users"}}`,
	)); err != nil {
		t.Fatalf("PgTrackTable: %v", err)
	}

	if _, _, err := s.PgUntrackTable(t.Context(), []byte(
		`{"source":"default","table":{"schema":"public","name":"users"}}`,
	)); err != nil {
		t.Fatalf("PgUntrackTable(clean, no cascade): %v", err)
	}
}

// reverseDepFixtureJSON has departments pointing at user_departments only
// through facts the database knows: a bare foreign_key_constraint_on
// relationship (no target table in metadata) and a function whose return type is
// the table. Neither is resolvable from metadata alone.
const reverseDepFixtureJSON = `{
  "version": 3,
  "sources": [
    {
      "name": "default",
      "kind": "postgres",
      "tables": [
        {
          "table": {"schema": "public", "name": "departments"},
          "object_relationships": [
            {"name": "owning_udept", "using": {"foreign_key_constraint_on": "department_id"}}
          ]
        }
      ],
      "functions": [
        {"function": {"schema": "public", "name": "get_department_manager"}}
      ],
      "configuration": {"connection_info": {"database_url": {"from_env": "PG_URL"}}}
    }
  ]
}`

// TestTableHasReverseDependents_DBFactsGateDetection pins that reverse dependents
// only the database can resolve — a bare foreign_key_constraint_on relationship
// and a function whose return type is the table — block an uncascaded untrack
// ONLY when the introspected deps are available, and degrade to a no-block
// metadata-only pass when they are not (the documented degradation).
func TestTableHasReverseDependents_DBFactsGateDetection(t *testing.T) {
	t.Parallel()

	h, err := hasura.FromJSON([]byte(reverseDepFixtureJSON))
	if err != nil {
		t.Fatalf("hasura.FromJSON: %v", err)
	}

	target := hasura.TableSource{Schema: "public", Name: "user_departments"}

	// Metadata-only: the bare FK and the function are invisible, so nothing
	// blocks.
	if tableHasReverseDependents(h, "default", target, nil) {
		t.Error("metadata-only detection saw a DB-only reverse dependent; want none")
	}

	// With introspected deps, both the bare-FK relationship and the function
	// resolve to the target, so the untrack is blocked.
	deps := &untrackDeps{
		fkByOwnerCols: map[string]hasura.TableSource{
			fkOwnerKey(
				hasura.TableSource{Schema: "public", Name: "departments"},
				[]string{"department_id"},
			): target,
		},
		funcsReturningTarget: map[string]struct{}{
			funcKey("public", "get_department_manager"): {},
		},
	}

	if !tableHasReverseDependents(h, "default", target, deps) {
		t.Error("deps-backed detection missed the bare-FK / function reverse dependent")
	}
}

// TestPgUntrackTable_Cascade_DropsReverseDependents pins the Hasura-parity
// cascade behavior: pg_untrack_table with cascade=true removes not only the
// table and its own dependents, but every relationship in OTHER tables that
// points at the untracked table whose target is recorded in metadata
// (foreign_key_constraint_on with an explicit target table, manual_configuration
// remote_table, and to_source remote relationships, including the object/array
// relationship a remote relationship lowers into on load).
//
// The bare foreign_key_constraint_on column form names no target table in
// metadata (the target is resolved from the database FK at reconcile), so it
// cannot be matched here and intentionally survives — a documented divergence
// pinned below so it cannot change silently.
func TestPgUntrackTable_Cascade_DropsReverseDependents(t *testing.T) {
	t.Parallel()

	s := bootstrappedStore(t, &fakeWriter{})

	for _, tbl := range []string{"departments", "user_departments", "users"} {
		if _, _, err := s.PgTrackTable(t.Context(), []byte(
			`{"source":"default","table":{"schema":"public","name":"`+tbl+`"}}`,
		)); err != nil {
			t.Fatalf("PgTrackTable(%s): %v", tbl, err)
		}
	}

	dept := `{"schema":"public","name":"departments"}`
	udept := `{"schema":"public","name":"user_departments"}`

	// Reverse dependent #1 — array relationship via foreign_key_constraint_on
	// with an explicit target table (ForeignKeyConstraint.Table).
	if _, _, err := s.PgCreateArrayRelationship(t.Context(), []byte(
		`{"source":"default","table":`+dept+`,"name":"members_to_udept",`+
			`"using":{"foreign_key_constraint_on":{"table":`+udept+`,"column":"department_id"}}}`,
	)); err != nil {
		t.Fatalf("create members_to_udept: %v", err)
	}

	// Reverse dependent #2 — object relationship via manual_configuration
	// (ManualConfiguration.RemoteTable).
	if _, _, err := s.PgCreateObjectRelationship(t.Context(), []byte(
		`{"source":"default","table":`+dept+`,"name":"manual_to_udept",`+
			`"using":{"manual_configuration":{"remote_table":`+udept+`,`+
			`"column_mapping":{"id":"department_id"}}}}`,
	)); err != nil {
		t.Fatalf("create manual_to_udept: %v", err)
	}

	// Reverse dependent #3 — to_source remote relationship (lowered into a
	// same-named array relationship on load).
	if _, _, err := s.PgCreateRemoteRelationship(t.Context(), []byte(
		`{"source":"default","table":`+dept+`,"name":"remote_to_udept",`+
			`"definition":{"to_source":{"source":"default","table":`+udept+`,`+
			`"relationship_type":"array","field_mapping":{"id":"department_id"}}}}`,
	)); err != nil {
		t.Fatalf("create remote_to_udept: %v", err)
	}

	// Non-target relationship — points at users, must survive.
	if _, _, err := s.PgCreateObjectRelationship(t.Context(), []byte(
		`{"source":"default","table":`+dept+`,"name":"keep_to_users",`+
			`"using":{"manual_configuration":{"remote_table":{"schema":"public","name":"users"},`+
			`"column_mapping":{"id":"id"}}}}`,
	)); err != nil {
		t.Fatalf("create keep_to_users: %v", err)
	}

	// Bare foreign_key_constraint_on (column on departments) — target not in
	// metadata, so the cascade cannot match it; it must survive (documented).
	if _, _, err := s.PgCreateObjectRelationship(t.Context(), []byte(
		`{"source":"default","table":`+dept+`,"name":"bare_to_udept",`+
			`"using":{"foreign_key_constraint_on":"manager_id"}}`,
	)); err != nil {
		t.Fatalf("create bare_to_udept: %v", err)
	}

	if _, _, err := s.PgUntrackTable(t.Context(), []byte(
		`{"source":"default","table":`+udept+`,"cascade":true}`,
	)); err != nil {
		t.Fatalf("PgUntrackTable cascade: %v", err)
	}

	raw, _ := s.HasuraSnapshotJSON()
	snap := string(raw)

	for _, dropped := range []string{
		"members_to_udept", "manual_to_udept", "remote_to_udept",
	} {
		if strings.Contains(snap, dropped) {
			t.Errorf("cascade left reverse dependent %q in metadata:\n%s", dropped, snap)
		}
	}

	// The untracked table and every reference to it must be gone.
	if strings.Contains(snap, "user_departments") {
		t.Errorf("cascade left a reference to the untracked table:\n%s", snap)
	}

	for _, kept := range []string{"keep_to_users", "bare_to_udept"} {
		if !strings.Contains(snap, kept) {
			t.Errorf("cascade wrongly removed %q:\n%s", kept, snap)
		}
	}
}
