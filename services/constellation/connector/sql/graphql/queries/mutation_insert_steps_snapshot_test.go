package queries_test

import (
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"log/slog"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/schema"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

//nolint:gocognit // Two snapshot cases share full fixture and outcome assertions.
func TestInsertComputedReturningUsesStatementSnapshot(
	t *testing.T,
) {
	t.Parallel()

	ddl := dependentInsertDDL + `
CREATE TABLE trigger_child(parent_id integer NOT NULL REFERENCES parent(id));
CREATE FUNCTION write_trigger_child() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN INSERT INTO trigger_child(parent_id) VALUES(NEW.id); RETURN NEW; END $$;
CREATE TRIGGER parent_trigger_child AFTER INSERT ON parent FOR EACH ROW EXECUTE FUNCTION write_trigger_child();
CREATE FUNCTION parent_trigger_count(p parent) RETURNS integer LANGUAGE sql STABLE AS $$
SELECT count(*)::integer FROM trigger_child WHERE parent_id=p.id $$;`

	tests := []struct {
		name, query          string
		wantCount, wantChild int
	}{
		{
			"flat",
			`mutation {insert_parent_one(object:{id:1,label:"flat"}) {id parent_trigger_count}}`,
			0,
			0,
		},
		{
			"nested",
			`mutation {insert_parent_one(object:{id:1,label:"nested",rel_arr_00000:{data:[{id:10}]}}) {id parent_trigger_count}}`,
			1,
			1,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			seed := testdb.NewPostgres(t, ddl)

			pool, err := postgres.Open(t.Context(), seed.Config().ConnConfig.ConnString())
			if err != nil {
				t.Fatal(err)
			}

			t.Cleanup(pool.Close)

			md := dependentInsertMetadata()
			md.Tables[0].ComputedFields = []metadata.ComputedField{{
				Name: "parent_trigger_count", Definition: metadata.ComputedFieldDefinition{
					Function: metadata.FunctionSource{
						Schema: "public",
						Name:   "parent_trigger_count",
					},
				},
			}}
			client := postgres.NewClient(pool)

			objects, err := client.Introspect(t.Context(), md)
			if err != nil {
				t.Fatal(err)
			}

			caps := schema.NewCapabilities(schema.KindPostgres, dialect.NewPostgresDialect())
			caps.SupportsComputedScalarSelection = true

			roots, _, err := queries.BuildRoots(objects, md, dialect.NewPostgresDialect(), caps)
			if err != nil {
				t.Fatal(err)
			}

			doc, parseErr := parser.ParseQuery(&ast.Source{Input: tt.query})
			if parseErr != nil {
				t.Fatal(parseErr)
			}

			ops, err := roots.BuildQuery(doc.Operations[0], doc.Fragments, nil, "admin", nil)
			if err != nil {
				t.Fatal(err)
			}

			results, err := client.ExecuteOperations(
				t.Context(),
				ops,
				slog.New(slog.DiscardHandler),
			)
			if err != nil {
				t.Fatal(err)
			}

			var response struct {
				ID    int `json:"id"`
				Count int `json:"parent_trigger_count"`
			}

			value, ok := results["insert_parent_one"].(jsontext.Value)
			if !ok {
				t.Fatalf("unexpected response type %T", results["insert_parent_one"])
			}

			if err := json.Unmarshal(value, &response); err != nil {
				t.Fatal(err)
			}

			if response.ID != 1 || response.Count != tt.wantCount {
				t.Errorf("computed returning=%+v, want count=%d", response, tt.wantCount)
			}

			var triggerCount, childCount int
			if err := pool.QueryRow(t.Context(), `SELECT (SELECT count(*) FROM trigger_child),(SELECT count(*) FROM child)`).
				Scan(&triggerCount, &childCount); err != nil {
				t.Fatal(err)
			}

			if triggerCount != 1 || childCount != tt.wantChild {
				t.Errorf(
					"persisted trigger/array=%d/%d, want 1/%d",
					triggerCount,
					childCount,
					tt.wantChild,
				)
			}
		})
	}
}
