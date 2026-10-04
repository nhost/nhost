package queries_test

import (
	"fmt"
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

func deepOrderedInsertMetadata() *metadata.DatabaseMetadata {
	md := dependentInsertMetadata()
	md.Tables[0].ObjectRelationships = append(md.Tables[0].ObjectRelationships,
		metadata.ObjectRelationship{Name: "obj_rel_0224", Using: metadata.RelationshipUsing{
			ForeignKeyColumns: []string{"before_2_id"},
		}},
		metadata.ObjectRelationship{Name: "obj_rel_0002", Using: metadata.RelationshipUsing{
			ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
				Table:   metadata.TableSource{Schema: "public", Name: "obj_after2"},
				Columns: []string{"parent_id"},
			},
		}},
	)
	md.Tables[0].ArrayRelationships = append(md.Tables[0].ArrayRelationships,
		metadata.ArrayRelationship{Name: "rel_arr_02120", Using: metadata.RelationshipUsing{
			ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
				Table:   metadata.TableSource{Schema: "public", Name: "child"},
				Columns: []string{"parent_id"},
			},
		}},
	)
	md.Tables[3].ObjectRelationships = append(md.Tables[3].ObjectRelationships,
		metadata.ObjectRelationship{Name: "obj_rel_0224", Using: metadata.RelationshipUsing{
			ForeignKeyColumns: []string{"before_2_id"},
		}},
		metadata.ObjectRelationship{Name: "obj_rel_0000", Using: metadata.RelationshipUsing{
			ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
				Table:   metadata.TableSource{Schema: "public", Name: "obj_child_after0"},
				Columns: []string{"child_id"},
			},
		}},
		metadata.ObjectRelationship{Name: "obj_rel_0002", Using: metadata.RelationshipUsing{
			ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
				Table:   metadata.TableSource{Schema: "public", Name: "obj_child_after2"},
				Columns: []string{"child_id"},
			},
		}},
	)
	md.Tables[3].ArrayRelationships = append(md.Tables[3].ArrayRelationships,
		metadata.ArrayRelationship{Name: "rel_arr_02120", Using: metadata.RelationshipUsing{
			ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
				Table:   metadata.TableSource{Schema: "public", Name: "grandchild"},
				Columns: []string{"child_id"},
			},
		}},
	)
	md.Tables = append(
		md.Tables,
		metadata.TableMetadata{Table: metadata.TableSource{Schema: "public", Name: "obj_after2"}},
		metadata.TableMetadata{
			Table: metadata.TableSource{Schema: "public", Name: "obj_child_after0"},
		},
		metadata.TableMetadata{
			Table: metadata.TableSource{Schema: "public", Name: "obj_child_after2"},
		},
	)

	return md
}

func deepOrderedInsertQuery(reverse bool) string {
	child := []string{
		`obj_rel_0002:{data:{id:31}}`, `rel_arr_00000:{data:[{id:21}]}`,
		`obj_rel_0224:{data:{id:4}}`, `id:10`, `obj_rel_0000:{data:{id:30}}`,
		`rel_arr_02120:{data:[{id:20}]}`, `obj_rel_0001:{data:{id:3}}`,
	}

	parent := []string{
		`obj_rel_0002:{data:{id:41}}`, `rel_arr_00000:{data:[{id:11}]}`,
		`obj_rel_0224:{data:{id:2}}`, `id:1`, `obj_rel_0000:{data:{id:40}}`,
		`rel_arr_02120:{data:[{` + strings.Join(child, ",") + `}]}`,
		`obj_rel_0001:{data:{id:1}}`,
	}
	if reverse {
		slices.Reverse(child)
		parent[5] = `rel_arr_02120:{data:[{` + strings.Join(child, ",") + `}]}`
		slices.Reverse(parent)
	}

	return `mutation{insert_parent(objects:[{` + strings.Join(
		parent,
		",",
	) + `}]){affected_rows returning{id}}}`
}

// TestDependentInsertDeepSiblingOrderThirteenEvents pins the prospective
// Step-0 after-parent oracle at both nesting levels, with input order reversed
// but metadata name hash order stable within each of the three categories.
//
//nolint:gocognit,cyclop,paralleltest,tparallel // Two orders reset and share one fixture for event and FK checks.
func TestDependentInsertDeepSiblingOrderThirteenEvents(
	t *testing.T,
) {
	t.Parallel()

	ddl := dependentInsertDDL + `ALTER TABLE parent ADD COLUMN before_2_id integer REFERENCES obj_before(id);
ALTER TABLE child ADD COLUMN before_2_id integer REFERENCES obj_before(id);
CREATE TABLE obj_after2(id integer primary key, parent_id integer references parent(id));
CREATE TABLE obj_child_after0(id integer primary key, child_id integer references child(id));
CREATE TABLE obj_child_after2(id integer primary key, child_id integer references child(id));
CREATE TRIGGER log_after2 AFTER INSERT ON obj_after2 FOR EACH ROW EXECUTE FUNCTION log_insert();
CREATE TRIGGER log_child_after0 AFTER INSERT ON obj_child_after0 FOR EACH ROW EXECUTE FUNCTION log_insert();
CREATE TRIGGER log_child_after2 AFTER INSERT ON obj_child_after2 FOR EACH ROW EXECUTE FUNCTION log_insert();`
	seed := testdb.NewPostgres(t, ddl)

	pool, err := postgres.Open(t.Context(), seed.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(pool.Close)

	md := deepOrderedInsertMetadata()
	client := postgres.NewClient(pool)

	objects, err := client.Introspect(t.Context(), md)
	if err != nil {
		t.Fatal(err)
	}

	roots, _, err := queries.BuildRoots(objects, md, dialect.NewPostgresDialect())
	if err != nil {
		t.Fatal(err)
	}

	want := []string{
		"obj_before:1", "obj_before:2", "parent:1", "obj_before:3", "obj_before:4",
		"child:10", "grandchild:20", "grandchild:21", "obj_child_after0:30",
		"obj_child_after2:31", "child:11", "obj_after:40", "obj_after2:41",
	}
	for _, reverse := range []bool{false, true} {
		name := "forward"
		if reverse {
			name = "reverse"
		}

		t.Run(name, func(t *testing.T) {
			if err := pool.Exec(
				t.Context(),
				`TRUNCATE event_log,obj_after,obj_after2,obj_child_after0,obj_child_after2,grandchild,child,parent,obj_before RESTART IDENTITY CASCADE`,
			); err != nil {
				t.Fatal(err)
			}

			doc, err := parser.ParseQuery(&ast.Source{Input: deepOrderedInsertQuery(reverse)})
			if err != nil {
				t.Fatal(err)
			}

			ops, err := roots.BuildQuery(doc.Operations[0], doc.Fragments, nil, "admin", nil)
			if err != nil {
				t.Fatal(err)
			}

			result, err := client.ExecuteOperations(t.Context(), ops, slog.New(slog.DiscardHandler))
			if err != nil {
				t.Fatal(err)
			}

			if !strings.Contains(
				strings.ReplaceAll(fmt.Sprint(result["insert_parent"]), " ", ""),
				`"affected_rows":13`,
			) {
				t.Fatalf("affected result = %v", result)
			}

			rows, err := pool.Query(t.Context(), `SELECT tag FROM event_log ORDER BY seq`)
			if err != nil {
				t.Fatal(err)
			}

			var got []string
			for rows.Next() {
				var tag string
				if err := rows.Scan(&tag); err != nil {
					rows.Close()
					t.Fatal(err)
				}

				got = append(got, tag)
			}

			if err := rows.Err(); err != nil {
				rows.Close()
				t.Fatal(err)
			}

			rows.Close()

			if !slices.Equal(got, want) {
				t.Fatalf("events = %v, want %v", got, want)
			}

			var childFK, deepFK, afterFK, deepAfterFK int
			if err := pool.QueryRow(t.Context(), `SELECT
(SELECT parent_id FROM child WHERE id=10), (SELECT child_id FROM grandchild WHERE id=20),
(SELECT parent_id FROM obj_after2 WHERE id=41), (SELECT child_id FROM obj_child_after2 WHERE id=31)`).
				Scan(&childFK, &deepFK, &afterFK, &deepAfterFK); err != nil {
				t.Fatal(err)
			}

			if childFK != 1 || deepFK != 10 || afterFK != 1 || deepAfterFK != 10 {
				t.Fatalf(
					"FKs child/deep/after/deepAfter = %d/%d/%d/%d",
					childFK,
					deepFK,
					afterFK,
					deepAfterFK,
				)
			}
		})
	}
}
