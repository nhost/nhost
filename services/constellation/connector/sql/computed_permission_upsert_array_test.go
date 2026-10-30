package sql_test

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/metadata"
)

// An upsert through a unique key must hide the old parent when the parent
// has no PK or changes its PK. Denial rolls back the parent and children.
//
//nolint:gocognit,gocyclo,cyclop,maintidx // This ordered security matrix asserts branch outcomes and physical rollback together.
func verifyNestedArrayUpsertWithoutParentPK(t *testing.T) {
	t.Helper()

	for _, tc := range []struct {
		name, check, parentCode                           string
		collection, twoParents, pkMoves, nested, accepted bool
	}{
		{"single positive old row", `{"np":{"np_label":{"_eq":"first"}}}`, "c1", false, false, false, false, false},
		{"single negative old row", `{"_not":{"np":{"np_label":{"_eq":"first"}}}}`, "c1", false, false, false, false, true},
		{"collection positive old row", `{"np":{"np_label":{"_eq":"first"}}}`, "c1", true, false, false, false, false},
		{"collection negative old row", `{"_not":{"np":{"np_label":{"_eq":"first"}}}}`, "c1", true, false, false, false, true},
		{"partitioned positive old row", `{"_or":[{"np":{"np_label":{"_eq":"first"}}},{"_and":[{"code":{"_eq":"c3"}},{"np":{"np_label":{"_eq":"changed"}}}]}]}`, "c1", true, true, false, false, false},
		{"partitioned negative old row", `{"_not":{"np":{"np_label":{"_eq":"first"}}}}`, "c1", true, true, false, false, true},
		{"changed PK positive old row", `{"np":{"np_label":{"_eq":"first"}}}`, "c1", false, false, true, false, false},
		{"changed PK negative old row", `{"_not":{"np":{"np_label":{"_eq":"first"}}}}`, "c1", false, false, true, false, true},
		{"nested positive old row", `{"np":{"np_label":{"_eq":"first"}}}`, "c1", false, false, false, true, false},
		{"nested negative old row", `{"_not":{"np":{"np_label":{"_eq":"first"}}}}`, "c1", false, false, false, true, true},
		{"other committed parent remains visible", `{"_and":[{"np":{"np_label":{"_eq":"changed"}}},{"_exists":{"_table":{"schema":"cf_select","name":"np"},"_where":{"code":{"_eq":"c2"},"np_label":{"_eq":"first"}}}}]}`, "c1", false, false, false, false, true},
		{"other committed parent defeats negation", `{"_not":{"_exists":{"_table":{"schema":"cf_select","name":"np"},"_where":{"code":{"_eq":"c2"},"np_label":{"_eq":"first"}}}}}`, "c1", false, false, false, false, false},
		{"ordinary insert sees parent", `{"np":{"np_label":{"_eq":"changed"}}}`, "fresh", false, false, false, false, true},
	} {
		runPermissionCase(t, tc.name, func(t *testing.T) {
			t.Helper()
			md, db := permissionFixture(t)
			pkColumn := ""
			seed := `INSERT INTO cf_select.np(code, label) VALUES ('c1', 'first'), ('c2', 'first');`
			parentColumns := []string{"code", "label"}
			updateColumns := "label"
			updateColumnNames := []string{"label"}

			parentID := ""
			if tc.pkMoves {
				pkColumn = "id integer PRIMARY KEY, "
				seed = `INSERT INTO cf_select.np(id, code, label) VALUES (1, 'c1', 'first'), (2, 'c2', 'first');`

				parentColumns = append(parentColumns, "id")
				updateColumns = "id,label"

				updateColumnNames = append(updateColumnNames, "id")
				parentID = "id:3,"
			}

			ddl := fmt.Sprintf(`
CREATE TABLE cf_select.np (%scode text NOT NULL CONSTRAINT np_code_key UNIQUE, label text NOT NULL);
CREATE TABLE cf_select.np_kids (id integer PRIMARY KEY, code text NOT NULL REFERENCES cf_select.np(code));
CREATE TABLE cf_select.np_wrapper (id integer PRIMARY KEY, code text NOT NULL REFERENCES cf_select.np(code));
CREATE FUNCTION cf_select.np_label(p cf_select.np) RETURNS text LANGUAGE sql STABLE AS $$ SELECT p.label $$;
%s`, pkColumn, seed)
			if _, err := db.Exec(t.Context(), ddl); err != nil {
				t.Fatal(err)
			}

			parent := metadata.TableSource{Schema: "cf_select", Name: "np"}
			child := metadata.TableSource{Schema: "cf_select", Name: "np_kids"}

			var check map[string]any
			if err := json.Unmarshal([]byte(tc.check), &check); err != nil {
				t.Fatal(err)
			}

			if tc.nested {
				md.Tables = append(md.Tables, metadata.TableMetadata{
					Table: metadata.TableSource{Schema: "cf_select", Name: "np_wrapper"},
					ObjectRelationships: []metadata.ObjectRelationship{
						{
							Name:  "np",
							Using: metadata.RelationshipUsing{ForeignKeyColumns: []string{"code"}},
						},
					},
					SelectPermissions: []metadata.SelectPermission{
						{
							Role: "phase9_guard",
							Permission: metadata.SelectPermissionConfig{
								Columns: []string{"id", "code"},
							},
						},
					},
					InsertPermissions: []metadata.InsertPermission{{
						Role: "phase9_guard", Permission: metadata.InsertPermissionConfig{
							Columns: []string{"id", "code"}, Check: map[string]any{},
						},
					}},
				})
			}

			md.Tables = append(md.Tables,
				metadata.TableMetadata{
					Table: parent,
					ArrayRelationships: []metadata.ArrayRelationship{
						{
							Name: "kids",
							Using: metadata.RelationshipUsing{
								ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
									Columns: []string{"code"}, Table: child,
								},
							},
						},
					},
					ComputedFields: []metadata.ComputedField{{
						Name: "np_label", Definition: metadata.ComputedFieldDefinition{
							Function: metadata.FunctionSource{
								Schema: "cf_select",
								Name:   "np_label",
							},
						},
					}},
					SelectPermissions: []metadata.SelectPermission{
						{
							Role:       "phase9_guard",
							Permission: metadata.SelectPermissionConfig{Columns: parentColumns},
						},
					},
					InsertPermissions: []metadata.InsertPermission{{
						Role: "phase9_guard", Permission: metadata.InsertPermissionConfig{
							Columns: parentColumns, Check: map[string]any{},
						},
					}},
					UpdatePermissions: []metadata.UpdatePermission{{
						Role: "phase9_guard", Permission: metadata.UpdatePermissionConfig{
							Columns: updateColumnNames,
							Filter:  map[string]any{},
							Check:   map[string]any{},
						},
					}},
				},
				metadata.TableMetadata{
					Table: child,
					ObjectRelationships: []metadata.ObjectRelationship{
						{
							Name:  "np",
							Using: metadata.RelationshipUsing{ForeignKeyColumns: []string{"code"}},
						},
					},
					SelectPermissions: []metadata.SelectPermission{
						{
							Role: "phase9_guard",
							Permission: metadata.SelectPermissionConfig{
								Columns: []string{"id", "code"},
							},
						},
					},
					InsertPermissions: []metadata.InsertPermission{{
						Role: "phase9_guard", Permission: metadata.InsertPermissionConfig{
							Columns: []string{"id", "code"}, Check: check,
						},
					}},
				},
			)

			conn, inc := permissionConnector(t, md, db.Config().ConnString())
			if len(inc.Snapshot()) > 0 {
				t.Fatalf("unexpected inconsistencies: %+v", inc.Snapshot())
			}

			parentObject := fmt.Sprintf(
				`{%scode:"%s",label:"changed",kids:{data:[{id:90091}]}}`,
				parentID,
				tc.parentCode,
			)

			conflict := ",on_conflict:{constraint:np_code_key,update_columns:[" + updateColumns + "]}"
			if tc.parentCode == "fresh" {
				conflict = ""
			}

			query := `mutation { insert_cf_select_np_one(object:` + parentObject + conflict + `) { code } }`
			if tc.collection {
				objects := parentObject
				if tc.twoParents {
					objects += `,{code:"c3",label:"changed",kids:{data:[{id:90092}]}}`
				}

				query = `mutation { insert_cf_select_np(objects:[` + objects + `]` + conflict + `) { affected_rows } }`
			}

			if tc.nested {
				query = `mutation { insert_cf_select_np_wrapper_one(object:{id:90091,np:{data:` +
					parentObject + conflict + `}}) { id } }`
			}

			doc, err := parser.ParseQuery(&ast.Source{Input: query})
			if err != nil {
				t.Fatal(err)
			}

			result, err := conn.Execute(t.Context(), doc.Operations[0], doc.Fragments,
				nil, "phase9_guard", nil, slog.Default())
			if tc.accepted != (err == nil) {
				t.Fatalf("accepted = %t, error = %v, result = %#v", tc.accepted, err, result)
			}

			var label string
			if err := db.QueryRow(t.Context(), `SELECT label FROM cf_select.np WHERE code = $1`, tc.parentCode).
				Scan(&label); err != nil {
				t.Fatal(err)
			}

			wantLabel := "first"
			if tc.accepted {
				wantLabel = "changed"
			}

			if label != wantLabel {
				t.Fatalf("parent label %s, want %s", label, wantLabel)
			}

			if tc.pkMoves {
				var id int
				if err := db.QueryRow(t.Context(), `SELECT id FROM cf_select.np WHERE code = 'c1'`).
					Scan(&id); err != nil {
					t.Fatal(err)
				}

				wantID := 1
				if tc.accepted {
					wantID = 3
				}

				if id != wantID {
					t.Fatalf("parent PK %d, want %d", id, wantID)
				}
			}

			var count int
			if err := db.QueryRow(t.Context(), `SELECT count(*) FROM cf_select.np_kids WHERE id = 90091`).
				Scan(&count); err != nil {
				t.Fatal(err)
			}

			wantCount := 0
			if tc.accepted {
				wantCount = 1
			}

			if count != wantCount {
				t.Fatalf(
					"children persisted %d, want %d (upsert must roll back on denial)",
					count,
					wantCount,
				)
			}

			if tc.nested {
				var wrappers int
				if err := db.QueryRow(t.Context(), `SELECT count(*) FROM cf_select.np_wrapper`).
					Scan(&wrappers); err != nil {
					t.Fatal(err)
				}

				if wrappers != wantCount {
					t.Fatalf("wrapper persisted %d, want %d", wrappers, wantCount)
				}
			}

			if tc.twoParents {
				var extra int
				if err := db.QueryRow(t.Context(),
					`SELECT count(*) FROM cf_select.np WHERE code = 'c3'`,
				).Scan(&extra); err != nil {
					t.Fatal(err)
				}

				if extra != wantCount {
					t.Fatalf("second parent persisted %d, want %d", extra, wantCount)
				}

				if err := db.QueryRow(t.Context(),
					`SELECT count(*) FROM cf_select.np_kids WHERE id = 90092`,
				).Scan(&extra); err != nil {
					t.Fatal(err)
				}

				if extra != wantCount {
					t.Fatalf("second child persisted %d, want %d", extra, wantCount)
				}
			}
		})
	}
}
