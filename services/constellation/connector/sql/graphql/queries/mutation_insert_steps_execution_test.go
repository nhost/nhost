package queries_test

import (
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"log/slog"
	"slices"
	"strings"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

const dependentInsertDDL = `
CREATE TABLE event_log(seq bigserial primary key, tag text not null);
CREATE TABLE obj_before(id integer primary key, tag text);
CREATE TABLE parent(id integer primary key, label text, before_id integer references obj_before(id));
CREATE TABLE obj_after(id integer primary key, parent_id integer not null unique references parent(id));
CREATE TABLE child(id integer primary key, parent_id integer references parent(id), before_id integer references obj_before(id));
CREATE TABLE grandchild(id integer primary key, child_id integer references child(id));
CREATE FUNCTION log_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN INSERT INTO event_log(tag) VALUES(TG_TABLE_NAME || ':' || NEW.id::text); RETURN NEW; END $$;
CREATE TRIGGER log_before AFTER INSERT ON obj_before FOR EACH ROW EXECUTE FUNCTION log_insert();
CREATE TRIGGER log_parent AFTER INSERT ON parent FOR EACH ROW EXECUTE FUNCTION log_insert();
CREATE TRIGGER log_after AFTER INSERT ON obj_after FOR EACH ROW EXECUTE FUNCTION log_insert();
CREATE TRIGGER log_child AFTER INSERT ON child FOR EACH ROW EXECUTE FUNCTION log_insert();
CREATE TRIGGER log_grandchild AFTER INSERT ON grandchild FOR EACH ROW EXECUTE FUNCTION log_insert();
`

func dependentInsertMetadata() *metadata.DatabaseMetadata {
	before := metadata.ObjectRelationship{
		Name:  "obj_rel_0001",
		Using: metadata.RelationshipUsing{ForeignKeyColumns: []string{"before_id"}},
	}
	array := func(name, column, target string) metadata.ArrayRelationship {
		return metadata.ArrayRelationship{
			Name: name, Using: metadata.RelationshipUsing{
				ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
					Columns: []string{
						column,
					},
					Table: metadata.TableSource{Schema: "public", Name: target},
				},
			},
		}
	}

	return &metadata.DatabaseMetadata{
		Name: "default", Kind: "postgres",
		Tables: []metadata.TableMetadata{
			{
				Table: metadata.TableSource{Schema: "public", Name: "parent"},
				ObjectRelationships: []metadata.ObjectRelationship{
					before,
					{
						Name: "obj_rel_0000", Using: metadata.RelationshipUsing{
							ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
								Columns: []string{
									"parent_id",
								},
								Table: metadata.TableSource{Schema: "public", Name: "obj_after"},
							},
						},
					},
				},
				ArrayRelationships: []metadata.ArrayRelationship{
					array("rel_arr_00000", "parent_id", "child"),
				},
			},
			{Table: metadata.TableSource{Schema: "public", Name: "obj_before"}},
			{Table: metadata.TableSource{Schema: "public", Name: "obj_after"}},
			{
				Table:               metadata.TableSource{Schema: "public", Name: "child"},
				ObjectRelationships: []metadata.ObjectRelationship{before},
				ArrayRelationships: []metadata.ArrayRelationship{
					array("rel_arr_00000", "child_id", "grandchild"),
				},
			},
			{Table: metadata.TableSource{Schema: "public", Name: "grandchild"}},
		},
	}
}

//nolint:cyclop // Full response and persisted event sequence share one fixture.
func TestDependentInsertPostgresOrderAndReturning(
	t *testing.T,
) {
	t.Parallel()
	seed := testdb.NewPostgres(t, dependentInsertDDL)

	pool, err := postgres.Open(t.Context(), seed.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatalf("Open: %v", err)
	}

	t.Cleanup(pool.Close)
	client := postgres.NewClient(pool)
	md := dependentInsertMetadata()

	objects, err := client.Introspect(t.Context(), md)
	if err != nil {
		t.Fatalf("Introspect: %v", err)
	}

	roots, _, err := queries.BuildRoots(objects, md, dialect.NewPostgresDialect())
	if err != nil {
		t.Fatalf("BuildRoots: %v", err)
	}

	// Input places after-parent objects before columns and arrays. Metadata,
	// not GraphQL field position, determines execution timing at both levels.
	query := `mutation {
	  insert_parent(objects: [
	    { obj_rel_0000: {data: {id: 30}}, obj_rel_0001: {data: {id: 10}},
	      rel_arr_00000: {data: [
	        {id: 10, obj_rel_0001: {data: {id: 11}},
	          rel_arr_00000: {data: [{id: 20}]}}, {id: 12}
	      ]}, id: 1, label: "first" }, {id: 2, label: "second"}
	  ]) { affected_rows returning { id label obj_rel_0001 {id} obj_rel_0000 {id} rel_arr_00000(order_by: {id: asc}) {id rel_arr_00000 {id}} } }
	}`

	doc, parseErr := parser.ParseQuery(&ast.Source{Input: query})
	if parseErr != nil {
		t.Fatalf("ParseQuery: %v", parseErr)
	}

	ops, err := roots.BuildQuery(doc.Operations[0], doc.Fragments, nil, "admin", nil)
	if err != nil {
		t.Fatalf("BuildQuery: %v", err)
	}

	if len(ops) != 1 || ops[0].Insert == nil {
		t.Fatalf("dependent plan missing: %#v", ops)
	}

	results, err := client.ExecuteOperations(t.Context(), ops, slog.New(slog.DiscardHandler))
	if err != nil {
		t.Fatalf("ExecuteOperations: %v", err)
	}

	result, ok := results["insert_parent"].(jsontext.Value)
	if !ok {
		t.Fatalf("result type = %T", results["insert_parent"])
	}

	var payload struct {
		AffectedRows int `json:"affected_rows"`
		Returning    []struct {
			ID     int `json:"id"`
			Before *struct {
				ID int `json:"id"`
			} `json:"obj_rel_0001"`
			After *struct {
				ID int `json:"id"`
			} `json:"obj_rel_0000"`
			Children []struct {
				ID            int `json:"id"`
				Grandchildren []struct {
					ID int `json:"id"`
				} `json:"rel_arr_00000"`
			} `json:"rel_arr_00000"`
		} `json:"returning"`
	}
	if err := json.Unmarshal(result, &payload); err != nil {
		t.Fatalf("decode result: %v", err)
	}

	if payload.AffectedRows != 8 || len(payload.Returning) != 2 ||
		payload.Returning[0].Before == nil ||
		payload.Returning[0].Before.ID != 10 ||
		payload.Returning[0].After == nil ||
		payload.Returning[0].After.ID != 30 ||
		len(payload.Returning[0].Children) != 2 ||
		len(payload.Returning[0].Children[0].Grandchildren) != 1 ||
		len(payload.Returning[0].Children[1].Grandchildren) != 0 {
		t.Fatalf("unexpected response: %s", result)
	}

	rows, err := pool.Query(t.Context(), `SELECT tag FROM event_log ORDER BY seq`)
	if err != nil {
		t.Fatalf("events query: %v", err)
	}
	defer rows.Close()

	var events []string
	for rows.Next() {
		var tag string
		if err := rows.Scan(&tag); err != nil {
			t.Fatalf("event scan: %v", err)
		}

		events = append(events, tag)
	}

	if err := rows.Err(); err != nil {
		t.Fatalf("event iteration: %v", err)
	}

	want := []string{
		"obj_before:10",
		"parent:1",
		"obj_before:11",
		"child:10",
		"grandchild:20",
		"child:12",
		"obj_after:30",
		"parent:2",
	}
	if !slices.Equal(events, want) {
		t.Errorf("events = %s, want %s", strings.Join(events, ","), strings.Join(want, ","))
	}
}
