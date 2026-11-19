package sql_test

import (
	"log/slog"
	"strings"
	"testing"

	"github.com/vektah/gqlparser/v2"

	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	csql "github.com/nhost/nhost/services/constellation/connector/sql"
	"github.com/nhost/nhost/services/constellation/connector/sql/sqlite"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestDefaultInsertSQLiteConnector(t *testing.T) {
	t.Parallel()

	md := defaultInsertMetadata()
	md.Kind = "sqlite"

	md.Tables = md.Tables[1:2]
	for i := range md.Tables[0].InsertPermissions {
		md.Tables[0].InsertPermissions[i].Permission.Columns = []string{}
	}

	md.Tables[0].InsertPermissions = append(
		md.Tables[0].InsertPermissions,
		metadata.InsertPermission{
			Role: "preset", Permission: metadata.InsertPermissionConfig{
				Columns: []string{}, Set: map[string]any{"label": "X-Hasura-Label"},
			},
		},
	)
	md.Tables[0].SelectPermissions = append(
		md.Tables[0].SelectPermissions,
		metadata.SelectPermission{
			Role:       "preset",
			Permission: metadata.SelectPermissionConfig{Columns: []string{"id", "label"}},
		},
	)
	sqlite.FlattenMetadata(md)

	client := testdb.NewSQLite(
		t,
		`CREATE TABLE thing (id INTEGER PRIMARY KEY, label TEXT NOT NULL DEFAULT 'default')`,
	)

	conn, err := csql.NewConnector(t.Context(), client, md, nil, nil)
	if err != nil {
		t.Fatalf("NewConnector: %v", err)
	}

	t.Cleanup(conn.Close)

	schemas, err := conn.GetSchema()
	if err != nil {
		t.Fatalf("GetSchema: %v", err)
	}

	tests := []struct {
		name, role, query string
		preset            bool
	}{
		{"single", "admin", `mutation { insert_thing_one(object: {}) { id } }`, false},
		{
			"multiple",
			"admin",
			`mutation { insert_thing(objects: [{}, {}]) { affected_rows } }`,
			false,
		},
		{"empty input", "unchecked", `mutation { insert_thing_one(object: {}) { id } }`, false},
		{"post-check", "checked", `mutation { insert_thing_one(object: {}) { id } }`, false},
		{
			"preset empty input",
			"preset",
			`mutation { result: insert_thing_one(object: {}) { id label } }`,
			true,
		},
		{
			"upsert",
			"admin",
			`mutation { insert_thing_one(object: {}, on_conflict: {constraint: thing_pkey, update_columns: []}) { id } }`,
			false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			_, schema, err := schemamerge.BuildValidatedSchema(schemas[tt.role], tt.role)
			if err != nil {
				t.Fatalf("BuildValidatedSchema: %v", err)
			}

			if tt.role != "admin" && len(schema.Types["thing_insert_input"].Fields) != 0 {
				t.Fatal("role's insert input should have no fields")
			}

			doc, gqlErr := gqlparser.LoadQueryWithRules(schema, tt.query, nil)
			if gqlErr != nil {
				t.Fatalf("LoadQuery: %v", gqlErr)
			}

			_, err = conn.Execute(
				t.Context(),
				doc.Operations[0],
				doc.Fragments,
				nil,
				tt.role,
				map[string]any{
					"x-hasura-min-id": "0",
					"x-hasura-label":  "preset",
				},
				slog.New(slog.DiscardHandler),
			)

			wantError := "inserts without columns are not supported by this database backend"
			if tt.preset {
				// Presets supply a SQL column, but SQLite still cannot execute the
				// shared writable CTE. Empty-input compatibility does not enable writes.
				wantError = `near "INSERT": syntax error`
			}

			if err == nil || !strings.Contains(err.Error(), wantError) {
				t.Fatalf("Execute error = %v, want %q", err, wantError)
			}
		})
	}
}
