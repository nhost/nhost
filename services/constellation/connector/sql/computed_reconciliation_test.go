package sql_test

import (
	"bytes"
	"log/slog"
	"strings"
	"testing"

	csql "github.com/nhost/nhost/services/constellation/connector/sql"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// TestComputedUnknownFilterCurrentBehavior documents the unresolved Phase 2
// missing_computed variant: without a definition or grant, it has the same
// metadata shape as any ordinary unknown key. The existing parser still
// rejects the entire connector, not just this permission.
func TestComputedUnknownFilterCurrentBehavior(t *testing.T) {
	t.Parallel()
	conn := computedTestDB(t)

	md, err := metadata.FromHasuraJSON(computedFixture(t, "metadata.json"))
	if err != nil {
		t.Fatalf("fixture metadata: %v", err)
	}

	for i := range md.Databases[0].Tables {
		if md.Databases[0].Tables[i].Table.Name == "items" {
			for j := range md.Databases[0].Tables[i].SelectPermissions {
				p := &md.Databases[0].Tables[i].SelectPermissions[j]
				if p.Role == "cf_reader" {
					p.Permission.Filter = map[string]any{
						"missing_computed": map[string]any{"_eq": true},
					}
				}
			}
		}
	}

	pool, err := postgres.Open(t.Context(), conn.Config().ConnString())
	if err != nil {
		t.Fatalf("open fixture: %v", err)
	}
	defer pool.Close()

	_, err = csql.NewConnector(t.Context(), postgres.NewClient(pool), &md.Databases[0],
		metadata.NewInconsistencies(), slog.Default())
	if err == nil || !strings.Contains(err.Error(), "failed to build GraphQL roots") {
		t.Fatalf("unknown filter unexpectedly changed its source-level error: %v", err)
	}
}

func TestComputedMalformedGrantListFailsClosed(t *testing.T) {
	t.Parallel()

	conn := computedTestDB(t)
	fixture := computedFixture(t, "metadata.json")

	const original = `"computed_fields": ["item_label", "item_score", "item_second", "item_payload"]`
	if bytes.Count(fixture, []byte(original)) != 1 {
		t.Fatal("reader grant fixture changed")
	}

	malformed := bytes.Replace(fixture, []byte(original), []byte(`"computed_fields": "*"`), 1)

	md, err := metadata.FromHasuraJSON(malformed)
	if err != nil {
		t.Fatalf("load malformed grant fixture: %v", err)
	}

	pool, err := postgres.Open(t.Context(), conn.Config().ConnString())
	if err != nil {
		t.Fatalf("open fixture: %v", err)
	}

	inc := metadata.NewInconsistencies()

	connector, err := csql.NewConnector(
		t.Context(),
		postgres.NewClient(pool),
		&md.Databases[0],
		inc,
		slog.Default(),
	)
	if err != nil {
		pool.Close()
		t.Fatalf("build connector: %v", err)
	}
	defer connector.Close()

	schemas, err := connector.GetSchema()
	if err != nil {
		t.Fatalf("role schemas: %v", err)
	}

	if schemas[metadata.RoleAdmin] == nil || schemas["cf_no_grant"] == nil ||
		computedQueryHasField(schemas["cf_reader"], "cf_select_items") ||
		!computedQueryHasField(schemas["cf_reader"], "cf_select_tags") {
		t.Fatalf(
			"malformed list kept the reader's item grant or lost unaffected roles: %+v",
			inc.Snapshot(),
		)
	}

	var grantFailure bool
	for _, entry := range inc.Snapshot() {
		if entry.Kind == metadata.InconsistencyKindSelectPermission &&
			entry.Name == "cf_select.items.cf_reader" {
			grantFailure = true
		}
	}

	if !grantFailure {
		t.Fatalf("missing select permission inconsistency: %+v", inc.Snapshot())
	}
}

func TestSQLiteComputedGrantStillServes(t *testing.T) {
	t.Parallel()
	client := testdb.NewSQLite(t, "CREATE TABLE items (id INTEGER PRIMARY KEY)")
	md := &metadata.DatabaseMetadata{
		Name: "sqlite", Kind: "sqlite", Tables: []metadata.TableMetadata{{
			Table:          metadata.TableSource{Name: "items"},
			ComputedFields: []metadata.ComputedField{{Name: "unavailable"}},
			SelectPermissions: []metadata.SelectPermission{{
				Role: "reader", Permission: metadata.SelectPermissionConfig{
					Columns: []string{"id"}, ComputedFields: []string{"unavailable"},
				},
			}},
		}},
	}
	inc := metadata.NewInconsistencies()

	connector, err := csql.NewConnector(t.Context(), client, md, inc, slog.Default())
	if err != nil {
		t.Fatalf("SQLite computed grant changed connector construction: %v", err)
	}

	t.Cleanup(connector.Close)

	schemas, err := connector.GetSchema()
	if err != nil || schemas["reader"] == nil ||
		!computedQueryHasField(schemas["reader"], "items") ||
		len(inc.Snapshot()) != 0 {
		t.Fatalf(
			"SQLite ignored grant changed: schemas=%v inconsistencies=%v error=%v",
			schemas != nil,
			inc.Snapshot(),
			err,
		)
	}
}

func computedQueryHasField(s *graph.Schema, name string) bool {
	if s == nil || s.QueryType == nil {
		return false
	}

	for _, obj := range s.Types {
		if obj.Name != *s.QueryType {
			continue
		}

		for _, field := range obj.Fields {
			if field.Name == name {
				return true
			}
		}
	}

	return false
}

//nolint:gocognit,cyclop // Each isolated DDL case verifies construction and schema survival.
func TestComputedReconciliationTestDB(
	t *testing.T,
) {
	t.Parallel()

	tests := []struct {
		name  string
		ddl   string
		grant []string
		kind  string
	}{
		{"valid scalar grant gated", "", []string{"item_label"}, ""},
		{
			"dropped function and grant",
			"DROP FUNCTION cf_select.item_label(cf_select.items)",
			[]string{"item_label"},
			metadata.InconsistencyKindComputedField,
		},
		{
			"overloaded function and grant",
			"CREATE FUNCTION cf_select.item_label(item cf_select.items, suffix text DEFAULT '!') RETURNS text LANGUAGE sql STABLE AS $$ SELECT item.label || suffix $$",
			[]string{"item_label"},
			metadata.InconsistencyKindComputedField,
		},
		{
			"manual table grant",
			"",
			[]string{"item_tags"},
			metadata.InconsistencyKindSelectPermission,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			conn := computedTestDB(t)
			if tt.ddl != "" {
				if _, err := conn.Exec(t.Context(), tt.ddl); err != nil {
					t.Fatalf("fixture DDL: %v", err)
				}
			}

			md, err := metadata.FromHasuraJSON(computedFixture(t, "metadata.json"))
			if err != nil {
				t.Fatalf("fixture metadata: %v", err)
			}

			for i := range md.Databases[0].Tables {
				if md.Databases[0].Tables[i].Table.Name != "items" {
					continue
				}

				for j := range md.Databases[0].Tables[i].SelectPermissions {
					p := &md.Databases[0].Tables[i].SelectPermissions[j]
					if p.Role == "cf_reader" {
						p.Permission.ComputedFields = tt.grant
					}
				}
			}

			pool, err := postgres.Open(t.Context(), conn.Config().ConnString())
			if err != nil {
				t.Fatalf("open fixture: %v", err)
			}

			inc := metadata.NewInconsistencies()

			connector, err := csql.NewConnector(
				t.Context(),
				postgres.NewClient(pool),
				&md.Databases[0],
				inc,
				slog.Default(),
			)
			if err != nil {
				pool.Close()
				t.Fatalf("build connector: %v", err)
			}

			t.Cleanup(connector.Close)

			if tt.kind != "" {
				found := false
				for _, entry := range inc.Snapshot() {
					if entry.Kind == tt.kind {
						found = true
					}
				}

				if !found {
					t.Fatalf("missing %s: %+v", tt.kind, inc.Snapshot())
				}
			}

			schemas, err := connector.GetSchema()
			if err != nil {
				t.Fatalf("role schemas: %v", err)
			}

			if schemas[metadata.RoleAdmin] == nil {
				t.Fatal("valid source lost admin schema")
			}

			if len(md.Databases[0].Tables) == 0 {
				t.Fatal("input metadata mutated")
			}
		})
	}
}

func TestComputedExtensionBaseTypeGrantKeepsTableRoot(t *testing.T) {
	t.Parallel()
	conn := computedTestDB(t)

	_, err := conn.Exec(t.Context(), `
		CREATE EXTENSION citext;
		CREATE EXTENSION vector;
		CREATE FUNCTION cf_select.item_ci(item cf_select.items) RETURNS citext
		LANGUAGE sql STABLE AS $$ SELECT item.label::citext $$;
		CREATE FUNCTION cf_select.item_similarity(item cf_select.items, q vector) RETURNS float8
		LANGUAGE sql STABLE AS $$ SELECT 1.0::float8 $$;
	`)
	if err != nil {
		t.Fatalf("create isolated extension fixtures: %v", err)
	}

	md, err := metadata.FromHasuraJSON(computedFixture(t, "metadata.json"))
	if err != nil {
		t.Fatalf("decode fixture: %v", err)
	}

	for i := range md.Databases[0].Tables {
		table := &md.Databases[0].Tables[i]
		if table.Table.Name != "items" {
			continue
		}

		for _, entry := range []struct{ field, function string }{
			{field: "item_ci", function: "item_ci"},
			{field: "item_similarity", function: "item_similarity"},
		} {
			table.ComputedFields = append(table.ComputedFields, metadata.ComputedField{
				Name: entry.field,
				Definition: metadata.ComputedFieldDefinition{
					Function: metadata.FunctionSource{Schema: "cf_select", Name: entry.function},
				},
			})
		}

		for j := range table.SelectPermissions {
			if table.SelectPermissions[j].Role == "cf_reader" {
				table.SelectPermissions[j].Permission.ComputedFields = append(
					table.SelectPermissions[j].Permission.ComputedFields,
					"item_ci",
					"item_similarity",
				)
			}
		}
	}

	pool, err := postgres.Open(t.Context(), conn.Config().ConnString())
	if err != nil {
		t.Fatalf("open fixture: %v", err)
	}

	inc := metadata.NewInconsistencies()

	connector, err := csql.NewConnector(
		t.Context(),
		postgres.NewClient(pool),
		&md.Databases[0],
		inc,
		slog.Default(),
	)
	if err != nil {
		pool.Close()
		t.Fatalf("build connector: %v", err)
	}

	t.Cleanup(connector.Close)

	schemas, err := connector.GetSchema()
	if err != nil || !computedQueryHasField(schemas["cf_reader"], "cf_select_items") ||
		len(inc.Snapshot()) != 0 {
		t.Fatalf(
			"extension base type revoked reader table access: inconsistencies=%+v err=%v",
			inc.Snapshot(),
			err,
		)
	}
}
