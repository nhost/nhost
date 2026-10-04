package sql_test

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/metadata"
)

// The same isolation applies inside multi-row nested arrays with object
// relationships: object CTEs are emitted first, but checks are per row.
func verifyNestedMultiRowObjectCheckOrder(t *testing.T) {
	t.Helper()

	for _, tc := range []struct {
		name            string
		field           string
		negated, denied bool
	}{
		{"plain positive", "label", false, true},
		{"computed positive", "grp_label", false, true},
		{"plain negated", "label", true, false},
		{"computed negated", "grp_label", true, false},
	} {
		runPermissionCase(t, tc.name, func(t *testing.T) {
			t.Helper()

			exists := map[string]any{"_exists": map[string]any{
				"_table": map[string]any{"schema": "cf_select", "name": "grp"},
				"_where": map[string]any{tc.field: map[string]any{"_eq": "magic"}},
			}}
			if tc.negated {
				exists = map[string]any{"_not": exists}
			}

			check := map[string]any{"_or": []any{
				map[string]any{"id": map[string]any{"_eq": 2}}, exists,
			}}
			ddl := `CREATE TABLE cf_select.grp (id integer PRIMARY KEY, label text NOT NULL);
CREATE TABLE cf_select.member (id integer PRIMARY KEY, grp_id integer REFERENCES cf_select.grp(id), carrier_id integer);
CREATE TABLE cf_select.carrier (id integer PRIMARY KEY);
ALTER TABLE cf_select.member ADD CONSTRAINT member_carrier_fk FOREIGN KEY(carrier_id) REFERENCES cf_select.carrier(id);
CREATE FUNCTION cf_select.grp_label(g cf_select.grp) RETURNS text LANGUAGE sql STABLE AS $$ SELECT g.label $$;`
			tables := []metadata.TableMetadata{
				nestedReviewTable("grp", []string{"id", "label"}, nil, nil,
					map[string]string{"grp_label": "grp_label"}, nil),
				nestedReviewTable("member", []string{"id", "carrier_id", "grp_id"},
					map[string]string{"grp": "grp_id"}, nil, nil, check),
				nestedReviewTable("carrier", []string{"id"}, nil,
					[]nestedReviewArray{{"members", "member", "carrier_id"}}, nil, nil),
			}
			query := `mutation { insert_cf_select_carrier_one(object:{id:1,members:{data:[` +
				`{id:1,grp:{data:{id:1,label:"plain"}}},` +
				`{id:2,grp:{data:{id:2,label:"magic"}}}` +
				`]}}) { id } }`
			_, count, err := nestedReviewRun(t, ddl, tables, query)
			assertNestedReviewPermission(t, err, tc.denied)

			want := 5 // Two groups, two members and one carrier.
			if tc.denied {
				want = 0
			}

			if n := count("SELECT count(*) FROM cf_select.grp") +
				count("SELECT count(*) FROM cf_select.member") +
				count("SELECT count(*) FROM cf_select.carrier"); n != want {
				t.Fatalf("persisted rows = %d, want %d", n, want)
			}
		})
	}
}
