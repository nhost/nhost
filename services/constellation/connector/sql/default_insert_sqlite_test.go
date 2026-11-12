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
)

func TestDefaultInsertSQLiteConnector(t *testing.T) {
	t.Parallel()

	md := defaultInsertMetadata()
	md.Kind = "sqlite"
	md.Tables = md.Tables[1:2]
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

	tests := []struct{ name, role, query string }{
		{"single", "admin", `mutation { insert_thing_one(object: {}) { id } }`},
		{"multiple", "admin", `mutation { insert_thing(objects: [{}, {}]) { affected_rows } }`},
		{"post-check", "checked", `mutation { insert_thing_one(object: {}) { id } }`},
		{
			"upsert",
			"admin",
			`mutation { insert_thing_one(object: {}, on_conflict: {constraint: thing_pkey, update_columns: []}) { id } }`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			_, schema, err := schemamerge.BuildValidatedSchema(schemas[tt.role], tt.role)
			if err != nil {
				t.Fatalf("BuildValidatedSchema: %v", err)
			}

			doc, gqlErr := gqlparser.LoadQueryWithRules(schema, tt.query, nil)
			if gqlErr != nil {
				t.Fatalf("LoadQuery: %v", gqlErr)
			}

			_, err = conn.Execute(t.Context(), doc.Operations[0], doc.Fragments, nil, tt.role,
				map[string]any{"x-hasura-min-id": "0"}, slog.New(slog.DiscardHandler))
			if err == nil ||
				!strings.Contains(
					err.Error(),
					"inserts without columns are not supported by this database backend",
				) {
				t.Fatalf("Execute error = %v, want explicit unsupported empty-column insert", err)
			}
		})
	}
}
