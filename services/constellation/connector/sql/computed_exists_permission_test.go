package sql_test

import (
	"reflect"
	"testing"

	"github.com/nhost/nhost/services/constellation/metadata"
)

// TestPermissionExistsPublicDefault exercises the metadata fixer and the
// reconciler through NewConnector, rather than just the user where parser.
//
//nolint:paralleltest,gocognit,cyclop // Security matrix checks both paths with closed per-case connectors on one testdb.
func TestPermissionExistsPublicDefault(t *testing.T) {
	md, db := permissionFixture(t)
	if _, err := db.Exec(
		t.Context(),
		`CREATE TABLE public.tags (id integer PRIMARY KEY, label text NOT NULL, public_note text NOT NULL);
INSERT INTO public.tags(id,label,public_note) VALUES (91,'public-only','public-note');
CREATE TABLE public.public_only_tags (id integer PRIMARY KEY, public_note text NOT NULL);
INSERT INTO public.public_only_tags(id,public_note) VALUES (92,'public-note')`,
	); err != nil {
		t.Fatal(err)
	}

	md.Tables = append(
		md.Tables,
		metadata.TableMetadata{Table: metadata.TableSource{Schema: "public", Name: "tags"}},
		metadata.TableMetadata{
			Table: metadata.TableSource{Schema: "public", Name: "public_only_tags"},
		},
	)

	for _, tc := range []struct {
		name, label  string
		ref          any
		want         []int
		revoked      bool
		invalidWhere bool
		publicNote   bool
	}{
		{name: "object defaults to public", label: "public-note", ref: map[string]any{"name": "tags"}, want: []int{1, 2}, publicNote: true},
		{name: "object defaults to public-only table", label: "public-note", ref: map[string]any{"name": "public_only_tags"}, want: []int{1, 2}, publicNote: true},
		{name: "null schema defaults to public", label: "public-note", ref: map[string]any{"schema": nil, "name": "tags"}, want: []int{1, 2}, publicNote: true},
		{name: "string defaults to public", label: "public-note", ref: "tags", want: []int{1, 2}, publicNote: true},
		{name: "explicit public", label: "public-only", ref: map[string]any{"schema": "public", "name": "tags"}, want: []int{1, 2}},
		{name: "explicit parent schema", label: "two", ref: map[string]any{"schema": "cf_select", "name": "tags"}, want: []int{1, 2}},
		{name: "default does not use parent schema", label: "two", ref: map[string]any{"name": "tags"}, want: []int{}},
		{name: "string does not use parent schema", label: "two", ref: "tags", want: []int{}},
		{name: "missing public table", label: "public-only", ref: "absent", revoked: true},
		{name: "wrong schema type", label: "public-only", ref: map[string]any{"schema": 42, "name": "tags"}, revoked: true},
		{name: "missing name", label: "public-only", ref: map[string]any{"schema": "public"}, revoked: true},
		{name: "wrong name type", label: "public-only", ref: map[string]any{"name": 42}, revoked: true},
		{name: "invalid table shape", label: "public-only", ref: []any{"tags"}, revoked: true},
		{name: "malformed where", label: "public-only", ref: "tags", revoked: true, invalidWhere: true},
	} {
		for _, nested := range []bool{false, true} {
			name := tc.name + "/ordinary"
			if nested {
				name = tc.name + "/computed-table"
			}

			t.Run(name, func(t *testing.T) {
				// Keep the ordinary branch entirely computed-free, including grants.
				caseMD := *md
				caseMD.Tables = append([]metadata.TableMetadata(nil), md.Tables...)

				caseMD.Tables[0].SelectPermissions = append(
					[]metadata.SelectPermission(nil), md.Tables[0].SelectPermissions...)
				if !nested {
					caseMD.Tables[0].ComputedFields = nil
					for i := range caseMD.Tables[0].SelectPermissions {
						caseMD.Tables[0].SelectPermissions[i].Permission.ComputedFields = nil
					}
				}

				whereColumn := "label"
				if tc.publicNote {
					whereColumn = "public_note"
				}

				where := any(map[string]any{whereColumn: map[string]any{"_eq": tc.label}})
				if tc.invalidWhere {
					where = 42
				}

				filter := map[string]any{"_exists": map[string]any{
					"_table": tc.ref, "_where": where,
				}}
				if nested {
					filter = map[string]any{"item_tags": filter}
				}

				caseMD.Tables[0].SelectPermissions = append(caseMD.Tables[0].SelectPermissions,
					metadata.SelectPermission{
						Role: "exists_guard", Permission: metadata.SelectPermissionConfig{
							Columns: []string{"id"}, Filter: filter,
						},
					})

				conn, inc := permissionConnector(t, &caseMD, db.Config().ConnString())
				if tc.revoked {
					if !hasPermissionInconsistency(inc, "cf_select.items.exists_guard") ||
						len(inc.Snapshot()) != 1 {
						t.Fatalf("expected only affected permission revoked: %+v", inc.Snapshot())
					}

					if got := permissionIDs(
						t,
						conn,
						"cf_reader",
						`query { cf_select_items(order_by:{id:asc}) { id } }`,
						"cf_select_items",
					); !reflect.DeepEqual(got, []int{1, 2}) {
						t.Fatalf("unaffected reader rows: %v", got)
					}

					return
				}

				if len(inc.Snapshot()) != 0 {
					t.Fatalf("valid _exists permission revoked: %+v", inc.Snapshot())
				}

				got := permissionIDs(t, conn, "exists_guard",
					`query { cf_select_items(order_by:{id:asc}) { id } }`, "cf_select_items")
				if !reflect.DeepEqual(got, tc.want) {
					t.Fatalf("rows: %v, want %v", got, tc.want)
				}
			})
		}
	}
}
