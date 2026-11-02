package controller

import (
	"log/slog"
	"os"
	"path/filepath"
	"testing"

	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

//nolint:cyclop // Sequential state builds assert independent snapshots at each transition.
func TestBuildStateComputedReload(
	t *testing.T,
) {
	t.Parallel()

	read := func(path string) []byte {
		t.Helper()

		bytes, err := os.ReadFile(filepath.Join("../integration", path))
		if err != nil {
			t.Fatalf("read fixture: %v", err)
		}

		return bytes
	}
	pool := testdb.NewPostgres(t,
		string(read("nhost/migrations/default/1790001000000_computed_fields/up.sql")),
		string(read("nhost/seeds/default/40-computed-fields.sql")),
	)
	load := func() *metadata.Metadata {
		t.Helper()

		md, err := metadata.FromHasuraJSON(read("computedfields/testdata/metadata.json"))
		if err != nil {
			t.Fatalf("parse metadata: %v", err)
		}

		md.Databases = md.Databases[:1]
		md.Databases[0].Configuration.ConnectionInfo.DatabaseURL = metadata.EnvString(
			pool.Config().ConnConfig.ConnString(),
		)

		return md
	}
	initial := load()
	logger := slog.New(slog.DiscardHandler)

	state, err := buildState(t.Context(), initial, 0, logger)
	if err != nil {
		t.Fatalf("initial build: %v", err)
	}
	defer state.closeConnectors()

	if state.connectors[initial.Databases[0].Name] == nil ||
		!computedStateHasQueryField(state, "cf_select_items") {
		t.Fatal("initial reader table not served")
	}

	before := len(state.inconsistencies)

	// A failed signature and its grant are isolated in the new state. The old
	// state, including its immutable inconsistency snapshot, stays available.
	_, err = pool.Exec(t.Context(), "DROP FUNCTION cf_select.item_label(cf_select.items)")
	if err != nil {
		t.Fatalf("drop fixture signature: %v", err)
	}

	reloaded := load()

	next, err := buildState(t.Context(), reloaded, 0, logger)
	if err != nil {
		t.Fatalf("reload build: %v", err)
	}
	defer next.closeConnectors()

	if next.connectors[reloaded.Databases[0].Name] == nil ||
		!computedStateHasQueryField(next, "cf_select_tags") {
		t.Fatal("bad field dropped entire source or unrelated table grant")
	}

	if computedStateHasQueryField(next, "cf_select_items") {
		t.Fatal("invalid scalar grant left reader table accessible")
	}

	if len(state.inconsistencies) != before {
		t.Fatal("old served state changed during rebuild")
	}

	if !computedStateHasKind(next, metadata.InconsistencyKindComputedField) ||
		!computedStateHasKind(next, metadata.InconsistencyKindSelectPermission) {
		t.Fatalf("new state did not fail closed: %+v", next.inconsistencies)
	}

	// Recreate the signature, then change only the grant. Each independent
	// build must reflect its own valid signature and permission snapshot.
	_, err = pool.Exec(
		t.Context(),
		"CREATE FUNCTION cf_select.item_label(item cf_select.items) RETURNS text LANGUAGE sql STABLE AS $$ SELECT item.label $$",
	)
	if err != nil {
		t.Fatalf("restore fixture signature: %v", err)
	}

	invalidGrant := load()
	setComputedReaderGrant(invalidGrant, []string{"item_tags"})

	grantState, err := buildState(t.Context(), invalidGrant, 0, logger)
	if err != nil {
		t.Fatalf("grant-only reload build: %v", err)
	}
	defer grantState.closeConnectors()

	if !computedStateHasKind(grantState, metadata.InconsistencyKindSelectPermission) ||
		computedStateHasKind(grantState, metadata.InconsistencyKindComputedField) ||
		computedStateHasQueryField(grantState, "cf_select_items") {
		t.Fatalf("invalid grant was not isolated: %+v", grantState.inconsistencies)
	}

	restored := load()
	setComputedReaderGrant(restored, nil)

	final, err := buildState(t.Context(), restored, 0, logger)
	if err != nil {
		t.Fatalf("restored build: %v", err)
	}
	defer final.closeConnectors()

	if !computedStateHasQueryField(final, "cf_select_items") {
		t.Fatal("reader table not restored after valid signature and grant reload")
	}

	if computedStateHasKind(final, metadata.InconsistencyKindComputedField) ||
		computedStateHasKind(final, metadata.InconsistencyKindSelectPermission) {
		t.Fatalf("stale reload inconsistency: %+v", final.inconsistencies)
	}
}

// TestBuildStateUnknownFilterKeys confirms that neither a computed-looking
// unidentifiable key nor an ordinary unknown column gets special handling.
// The existing root parser rejects their source; a separate source survives.
func TestBuildStateUnknownFilterKeys(t *testing.T) {
	t.Parallel()

	read := func(path string) []byte {
		t.Helper()

		content, err := os.ReadFile(filepath.Join("../integration", path))
		if err != nil {
			t.Fatalf("read fixture: %v", err)
		}

		return content
	}

	pool := testdb.NewPostgres(t,
		string(read("nhost/migrations/default/1790001000000_computed_fields/up.sql")),
		string(read("nhost/seeds/default/40-computed-fields.sql")),
	)

	tests := []struct {
		name       string
		key        string
		columnOnly bool
	}{
		{name: "unidentifiable missing_computed", key: "missing_computed"},
		{name: "column-only unknown key", key: "missing_column", columnOnly: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			md := unknownFilterMetadata(t, read("computedfields/testdata/metadata.json"),
				pool.Config().ConnConfig.ConnString(), tt.key, tt.columnOnly)

			state, err := buildState(t.Context(), md, 0, slog.New(slog.DiscardHandler))
			if err != nil {
				t.Fatalf("build state: %v", err)
			}
			defer state.closeConnectors()

			if state.connectors["cf_select"] != nil ||
				computedStateHasQueryField(state, "cf_select_items") ||
				state.connectors["cf_predicates"] == nil ||
				!computedStateHasQueryField(state, "cf_predicates_rules") {
				t.Fatalf("unexpected source survival for %s: %+v", tt.key, state.inconsistencies)
			}

			var sourceFailure bool
			for _, entry := range state.inconsistencies {
				if entry.Kind == metadata.InconsistencyKindDatabase && entry.Name == "cf_select" {
					sourceFailure = true
				}

				if entry.Kind == metadata.InconsistencyKindSelectPermission {
					t.Fatalf("unknown key misclassified as a computed permission: %+v", entry)
				}
			}

			if !sourceFailure {
				t.Fatalf("missing source-wide inconsistency: %+v", state.inconsistencies)
			}
		})
	}
}

func unknownFilterMetadata(
	t *testing.T,
	data []byte,
	connString, key string,
	columnOnly bool,
) *metadata.Metadata {
	t.Helper()

	md, err := metadata.FromHasuraJSON(data)
	if err != nil {
		t.Fatalf("parse metadata: %v", err)
	}

	for i := range md.Databases {
		db := &md.Databases[i]

		db.Configuration.ConnectionInfo.DatabaseURL = metadata.EnvString(connString)
		for j := range db.Tables {
			table := &db.Tables[j]
			if columnOnly {
				stripComputedControl(table, db.Name)
			}

			if db.Name == "cf_select" && table.Table.Name == "items" {
				for k := range table.SelectPermissions {
					if table.SelectPermissions[k].Role == "cf_reader" {
						table.SelectPermissions[k].Permission.Filter = map[string]any{
							key: map[string]any{"_eq": true},
						}
					}
				}
			}
		}
	}

	return md
}

// stripComputedControl keeps the unknown-key control free of all computed
// metadata, including the startup guard on the independent predicate source.
func stripComputedControl(table *metadata.TableMetadata, source string) {
	table.ComputedFields = nil
	for k := range table.SelectPermissions {
		table.SelectPermissions[k].Permission.ComputedFields = nil
	}

	if source != "cf_predicates" {
		return
	}

	kept := table.SelectPermissions[:0]
	for _, permission := range table.SelectPermissions {
		if permission.Role != "cf_predicate_guard" {
			kept = append(kept, permission)
		}
	}

	table.SelectPermissions = kept
	table.InsertPermissions = nil
}

func setComputedReaderGrant(md *metadata.Metadata, fields []string) {
	for i := range md.Databases[0].Tables {
		if md.Databases[0].Tables[i].Table.Name != "items" {
			continue
		}

		for j := range md.Databases[0].Tables[i].SelectPermissions {
			permission := &md.Databases[0].Tables[i].SelectPermissions[j]
			if permission.Role == "cf_reader" {
				permission.Permission.ComputedFields = fields
			}
		}
	}
}

func computedStateHasQueryField(s *controllerState, name string) bool {
	schema := s.validatedSchemas["cf_reader"]
	return schema != nil && schema.Query != nil && schema.Query.Fields.ForName(name) != nil
}

func computedStateHasKind(s *controllerState, kind string) bool {
	for _, entry := range s.inconsistencies {
		if entry.Kind == kind {
			return true
		}
	}

	return false
}
