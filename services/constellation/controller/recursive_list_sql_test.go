package controller_test

import (
	"context"
	"fmt"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nhost/nhost/services/constellation/controller"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

//nolint:paralleltest,tparallel // Warm-cache reads and restored mutations share a controller and pools within the testdb connection budget.
func TestRecursiveListVariablesSQL(t *testing.T) {
	t.Parallel()

	const seed = `INSERT INTO contract_items VALUES
 (1,1,ARRAY['a'],false),(2,1,ARRAY['b'],false),
 (3,1,ARRAY['a','b'],false),(4,1,ARRAY['{a,b}'],false),(5,2,ARRAY['a'],false);`

	pool := testdb.NewPostgres(t, `
CREATE TABLE list_parents (id integer PRIMARY KEY);
INSERT INTO list_parents VALUES (1),(2);
CREATE TABLE contract_items (id integer PRIMARY KEY, owner integer, tags text[], changed boolean);
`+seed)

	md := &metadata.Metadata{Databases: []metadata.DatabaseMetadata{
		{Name: "source", Kind: "postgres", Tables: []metadata.TableMetadata{{
			Table: metadata.TableSource{Schema: "public", Name: "list_parents"},
			RemoteRelationships: []metadata.RemoteRelationship{{
				Name: "items", Definition: metadata.RemoteRelationshipDef{
					ToSource: &metadata.ToSourceRelationship{
						Source: "target",
						Table: metadata.TableSource{
							Schema: "public",
							Name:   "contract_items",
						},
						RelationshipType: metadata.RelationshipTypeArray,
						FieldMapping:     map[string]string{"id": "owner"},
					},
				},
			}},
		}}},
		{Name: "target", Kind: "postgres", Tables: []metadata.TableMetadata{{
			Table: metadata.TableSource{Schema: "public", Name: "contract_items"},
		}}},
	}}
	for i := range md.Databases {
		md.Databases[i].Configuration.ConnectionInfo.DatabaseURL = metadata.EnvString(
			pool.Config().ConnConfig.ConnString(),
		)
	}

	ctrl, err := newComputedController(t, md, false)
	if err != nil {
		t.Fatal(err)
	}

	if inconsistencies := ctrl.Inconsistencies(); len(inconsistencies) != 0 {
		t.Fatalf("inconsistencies: %+v", inconsistencies)
	}

	router := newTestRouter(t, ctrl)

	inputs := []struct {
		name, definition, variables string
	}{
		{"explicit", "!", `{"xs":[["{a,b}"]]}`},
		{"flat", "!", `{"xs":["{a,b}"]}`},
		{"scalar", "!", `{"xs":"{a,b}"}`},
		{"default", `!="{a,b}"`, `{}`},
	}

	reads := []string{
		`contract_items(where:{tags:{_in:%s}},order_by:{id:asc}){id}`,
		`list_parents(where:{id:{_eq:1}}){id items(where:{tags:{_in:%s}},order_by:{id:asc}){id}}`,
		`list_parents(order_by:{id:asc}){id items(where:{tags:{_in:%s}},limit:1,order_by:{id:asc}){id}}`,
		`list_parents(order_by:{id:asc}){id items_aggregate(where:{tags:{_in:%s}}){aggregate{count} nodes{id}}}`,
	}
	for _, input := range inputs {
		t.Run(input.name, func(t *testing.T) {
			variables := decodeCoercionVariables(t, input.variables)
			for i, read := range reads {
				t.Run(fmt.Sprintf("read/%d", i), func(t *testing.T) {
					literal := arrayPermissionResponse(
						t,
						router,
						"admin",
						controller.GraphQLRequest{
							Query: "{" + fmt.Sprintf(read, `[["{a,b}"]]`) + "}",
						},
					)

					got := arrayPermissionResponse(t, router, "admin", controller.GraphQLRequest{
						Query: "query($xs:[[String!]!]" + input.definition + "){" + fmt.Sprintf(
							read,
							"$xs",
						) + "}",
						Variables: variables,
					})
					if literal["errors"] != nil || literal["data"] == nil {
						t.Fatalf("literal failed: %+v", literal)
					}

					if diff := cmp.Diff(literal, got); diff != "" {
						t.Fatalf("SQL response (-literal +variables):\n%s", diff)
					}
				})
			}

			for _, mutation := range []struct{ name, field string }{
				{"update", `update_contract_items(where:{tags:{_in:$xs}},_set:{changed:true})`},
				{"delete", `delete_contract_items(where:{tags:{_in:$xs}})`},
			} {
				t.Run(mutation.name, func(t *testing.T) {
					t.Cleanup(func() {
						if _, err := pool.Exec(
							context.WithoutCancel(t.Context()),
							"TRUNCATE contract_items;"+seed,
						); err != nil {
							t.Errorf("restoring fixture: %v", err)
						}
					})
					got := arrayPermissionResponse(t, router, "admin", controller.GraphQLRequest{
						Query:     "mutation($xs:[[String!]!]" + input.definition + "){result:" + mutation.field + "{affected_rows returning{id}}}",
						Variables: variables,
					})
					assertArrayPermissionIDs(t, got, []int{4}, true)

					assertRecursiveMutationRows(t, pool, mutation.name == "delete")
				})
			}
		})
	}
}

func assertRecursiveMutationRows(t *testing.T, pool *pgxpool.Pool, deleted bool) {
	t.Helper()

	var original, target bool
	if err := pool.QueryRow(t.Context(), `SELECT
 EXISTS(SELECT 1 FROM contract_items WHERE id=3 AND NOT changed),
 EXISTS(SELECT 1 FROM contract_items WHERE id=4 AND changed)`).Scan(&original, &target); err != nil {
		t.Fatal(err)
	}

	if !original || target == deleted {
		t.Fatalf(
			"persisted selector mismatch: original unchanged=%v, target changed=%v",
			original,
			target,
		)
	}

	var count int
	if err := pool.QueryRow(t.Context(), "SELECT count(*) FROM contract_items WHERE id=4").
		Scan(&count); err != nil {
		t.Fatal(err)
	}

	if (count == 0) != deleted {
		t.Fatalf("target persisted rows=%d, deleted=%v", count, deleted)
	}
}
