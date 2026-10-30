package queries_test

import (
	"strings"
	"testing"
)

func TestDependentInsertRecursiveStatementSnapshots(t *testing.T) {
	t.Parallel()

	ddl := dependentInsertDDL + `
ALTER TABLE child ADD COLUMN label text;
CREATE FUNCTION no_magic_parent() RETURNS boolean LANGUAGE sql STABLE
AS $$ SELECT NOT EXISTS(SELECT 1 FROM parent WHERE label='magic') $$;
CREATE FUNCTION no_magic_child() RETURNS boolean LANGUAGE sql STABLE
AS $$ SELECT NOT EXISTS(SELECT 1 FROM child WHERE label='magic') $$;
ALTER TABLE parent ADD CONSTRAINT parent_sibling_snapshot CHECK (label='magic' OR no_magic_parent());
ALTER TABLE child ADD CONSTRAINT child_sibling_snapshot CHECK (label='magic' OR no_magic_child());`

	tests := []struct {
		name, query                                  string
		wantError                                    bool
		wantParents, wantChildren, wantGrandchildren int
	}{
		{
			name:        "relationship-free roots share statement snapshot",
			query:       `mutation {insert_parent(objects:[{id:1,label:"magic"},{id:2,label:"ordinary"},{id:3,label:"ordinary"}]){affected_rows}}`,
			wantParents: 3,
		},
		{
			name:      "third related root splits preceding plain roots",
			query:     `mutation {insert_parent(objects:[{id:1,label:"magic"},{id:2,label:"ordinary"},{id:3,label:"ordinary",rel_arr_00000:{data:[{id:10,label:"magic"}]}}]){affected_rows}}`,
			wantError: true,
		},
		{
			name:         "relationship-free child level batches",
			query:        `mutation {insert_parent(objects:[{id:1,label:"parent",rel_arr_00000:{data:[{id:10,label:"magic"},{id:11,label:"ordinary"}]}}]){affected_rows}}`,
			wantParents:  1,
			wantChildren: 2,
		},
		{
			name:      "deep relation splits all child siblings",
			query:     `mutation {insert_parent(objects:[{id:1,label:"parent",rel_arr_00000:{data:[{id:10,label:"magic",rel_arr_00000:{data:[{id:20}]}},{id:11,label:"ordinary"}]}}]){affected_rows}}`,
			wantError: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			pool, value, err := executeDependentCase(t, ddl, "", tt.query)
			if tt.wantError {
				if err == nil || !strings.Contains(err.Error(), "violates check constraint") {
					t.Fatalf("error = %v", err)
				}
			} else if err != nil || value == nil {
				t.Fatalf("result = %s, error = %v", value, err)
			}

			var parents, children, grand int
			if err := pool.QueryRow(t.Context(), `SELECT (SELECT count(*) FROM parent),(SELECT count(*) FROM child),(SELECT count(*) FROM grandchild)`).
				Scan(&parents, &children, &grand); err != nil {
				t.Fatal(err)
			}

			if parents != tt.wantParents || children != tt.wantChildren ||
				grand != tt.wantGrandchildren {
				t.Errorf(
					"stored parent/child/grandchild = %d/%d/%d; want %d/%d/%d",
					parents,
					children,
					grand,
					tt.wantParents,
					tt.wantChildren,
					tt.wantGrandchildren,
				)
			}
		})
	}
}
