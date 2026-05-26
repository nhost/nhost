package queries

import (
	"errors"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestBuildManualJoinCondition(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name              string
		columnMapping     map[string]string
		isArray           bool
		wantParentColumns []string
		wantTargetColumns []string
		wantReversed      bool
	}{
		{
			name:              "object relationship with non-PK column mapping",
			columnMapping:     map[string]string{"email": "email"},
			isArray:           false,
			wantParentColumns: []string{"email"},
			wantTargetColumns: []string{"email"},
			wantReversed:      false,
		},
		{
			name:              "object relationship mapping to PK",
			columnMapping:     map[string]string{"email": "id"},
			isArray:           false,
			wantParentColumns: []string{"email"},
			wantTargetColumns: []string{"id"},
			wantReversed:      false,
		},
		{
			name:              "array relationship with manual config",
			columnMapping:     map[string]string{"id": "org_id"},
			isArray:           true,
			wantParentColumns: []string{"id"},
			wantTargetColumns: []string{"org_id"},
			wantReversed:      true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			_, parentColumns, targetColumns, isReversed := buildManualJoinCondition(
				tc.columnMapping,
				tc.isArray,
			)

			if len(parentColumns) != len(tc.wantParentColumns) {
				t.Fatalf(
					"parentColumns length = %d, want %d",
					len(parentColumns),
					len(tc.wantParentColumns),
				)
			}

			for i := range parentColumns {
				if parentColumns[i] != tc.wantParentColumns[i] {
					t.Errorf(
						"parentColumns[%d] = %q, want %q",
						i,
						parentColumns[i],
						tc.wantParentColumns[i],
					)
				}
			}

			if len(targetColumns) != len(tc.wantTargetColumns) {
				t.Fatalf(
					"targetColumns length = %d, want %d",
					len(targetColumns),
					len(tc.wantTargetColumns),
				)
			}

			for i := range targetColumns {
				if targetColumns[i] != tc.wantTargetColumns[i] {
					t.Errorf(
						"targetColumns[%d] = %q, want %q",
						i,
						targetColumns[i],
						tc.wantTargetColumns[i],
					)
				}
			}

			if isReversed != tc.wantReversed {
				t.Errorf("isReversed = %v, want %v", isReversed, tc.wantReversed)
			}

			// Verify writeJoinConditionAliased renders the join correctly from
			// the structured columns.
			rel := &relationship{
				parentColumns:  parentColumns,
				targetColumns:  targetColumns,
				joinIsReversed: isReversed,
			}

			var b strings.Builder
			rel.writeJoinConditionAliased(&b, "parent", "target")
			got := b.String()

			wantJoin := `parent."` + tc.wantParentColumns[0] + `" = target."` + tc.wantTargetColumns[0] + `"`
			if isReversed {
				wantJoin = `target."` + tc.wantTargetColumns[0] +
					`" = parent."` + tc.wantParentColumns[0] + `"`
			}

			if got != wantJoin {
				t.Errorf("writeJoinConditionAliased = %q, want %q", got, wantJoin)
			}
		})
	}
}

func TestBuildManualJoinConditionMultiColumn(t *testing.T) {
	t.Parallel()

	// A multi-column manual relationship should produce a compound join condition
	// with AND-joined column pairs. Currently buildManualJoinCondition breaks after
	// the first map entry, silently dropping additional columns.
	mapping := map[string]string{
		"user_id": "user_id",
		"org_id":  "org_id",
	}

	_, parentColumns, targetColumns, isReversed := buildManualJoinCondition(mapping, false)

	rel := &relationship{
		parentColumns:  parentColumns,
		targetColumns:  targetColumns,
		joinIsReversed: isReversed,
	}

	joinCondition := rel.buildJoinConditionForSelection("p")

	// The join condition must reference BOTH columns.
	if !strings.Contains(joinCondition, "user_id") || !strings.Contains(joinCondition, "org_id") {
		t.Errorf(
			"multi-column join condition should reference all columns, got %q",
			joinCondition,
		)
	}
}

func TestWriteJoinConditionAliasedMultiColumn(t *testing.T) {
	t.Parallel()

	// writeJoinConditionAliased uses single parentColumn/targetColumn fields,
	// so a multi-column manual relationship only gets one column in the ON clause.
	// This test shows the Relationship struct itself can't represent multi-column joins.
	mapping := map[string]string{
		"user_id": "user_id",
		"org_id":  "org_id",
	}

	_, parentColumns, targetColumns, isReversed := buildManualJoinCondition(
		mapping, false,
	)

	rel := &relationship{
		parentColumns:  parentColumns,
		targetColumns:  targetColumns,
		joinIsReversed: isReversed,
	}

	var b strings.Builder
	rel.writeJoinConditionAliased(&b, "p", "t")
	got := b.String()

	// A correct multi-column join must have both pairs AND-joined.
	if !strings.Contains(got, "user_id") || !strings.Contains(got, "org_id") {
		t.Errorf(
			"writeJoinConditionAliased should reference all columns, got %q",
			got,
		)
	}

	// Verify AND-joined structure
	want := `p."org_id" = t."org_id" AND p."user_id" = t."user_id"`
	if got != want {
		t.Errorf("writeJoinConditionAliased = %q, want %q", got, want)
	}
}

func TestWriteJoinConditionAliasedMultiColumnArray(t *testing.T) {
	t.Parallel()

	mapping := map[string]string{
		"user_id": "uid",
		"org_id":  "oid",
	}

	_, parentColumns, targetColumns, isReversed := buildManualJoinCondition(
		mapping, true,
	)

	rel := &relationship{
		parentColumns:  parentColumns,
		targetColumns:  targetColumns,
		joinIsReversed: isReversed,
	}

	var b strings.Builder
	rel.writeJoinConditionAliased(&b, "p", "t")
	got := b.String()

	// Array relationship: reversed, so target.fk = parent.pk
	want := `t."oid" = p."org_id" AND t."uid" = p."user_id"`
	if got != want {
		t.Errorf("writeJoinConditionAliased = %q, want %q", got, want)
	}
}

// TestBuildReverseJoinUnmatchedColumn covers the metadata/introspection
// mismatch case: ForeignKeyConstraint.Columns names a column the introspected
// target table has no foreign key for. Emitting an empty parent column would
// render as `"alias".""` and fail at execution time; the helper now surfaces
// errRelationshipReverseFKColumnUnmatched so reconcile can drop the
// relationship instead.
func TestBuildReverseJoinUnmatchedColumn(t *testing.T) {
	t.Parallel()

	objects := introspection.NewObjects()
	objects.Schemas["public"] = &introspection.Schema{
		Tables: map[string]*introspection.Table{
			"orders": {
				Schema:                   "public",
				Name:                     "orders",
				Comment:                  nil,
				Columns:                  nil,
				PrimaryKeys:              nil,
				PrimaryKeyConstraintName: "",
				// Note: no ForeignKey entry for "user_id".
				ForeignKeys: []introspection.ForeignKey{
					{
						ColumnName:        "other_col",
						ForeignSchema:     "public",
						ForeignTable:      "users",
						ForeignColumnName: "id",
					},
				},
				UniqueConstraints: nil,
				IsView:            false,
				IsInsertable:      true,
				IsUpdatable:       true,
			},
		},
	}

	using := metadata.RelationshipUsing{
		ForeignKeyColumns: nil,
		ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
			Columns: []string{"user_id"},
			Table: metadata.TableSource{
				Schema: "public",
				Name:   "orders",
			},
		},
		ManualConfiguration: nil,
	}

	fk, parentCols, targetCols, _, err := buildReverseJoin(
		using, []string{"user_id"}, objects,
	)
	if err == nil {
		t.Fatal("buildReverseJoin: expected error for unmatched column, got nil")
	}

	if !errors.Is(err, errRelationshipReverseFKColumnUnmatched) {
		t.Errorf(
			"buildReverseJoin: expected errRelationshipReverseFKColumnUnmatched, got %v",
			err,
		)
	}

	// On error, all column slices must be nil so callers never observe a
	// partial result with an empty-string column identifier.
	if fk != nil || parentCols != nil || targetCols != nil {
		t.Errorf(
			"buildReverseJoin: expected nil column slices on error, got fk=%v parent=%v target=%v",
			fk, parentCols, targetCols,
		)
	}
}

// TestBuildReverseJoinMatchedColumn confirms the happy path still returns
// the paired columns.
func TestBuildReverseJoinMatchedColumn(t *testing.T) {
	t.Parallel()

	objects := introspection.NewObjects()
	objects.Schemas["public"] = &introspection.Schema{
		Tables: map[string]*introspection.Table{
			"orders": {
				Schema:                   "public",
				Name:                     "orders",
				Comment:                  nil,
				Columns:                  nil,
				PrimaryKeys:              nil,
				PrimaryKeyConstraintName: "",
				ForeignKeys: []introspection.ForeignKey{
					{
						ColumnName:        "user_id",
						ForeignSchema:     "public",
						ForeignTable:      "users",
						ForeignColumnName: "id",
					},
				},
				UniqueConstraints: nil,
				IsView:            false,
				IsInsertable:      true,
				IsUpdatable:       true,
			},
		},
	}

	using := metadata.RelationshipUsing{
		ForeignKeyColumns: nil,
		ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
			Columns: []string{"user_id"},
			Table: metadata.TableSource{
				Schema: "public",
				Name:   "orders",
			},
		},
		ManualConfiguration: nil,
	}

	_, parentCols, targetCols, isReversed, err := buildReverseJoin(
		using, []string{"user_id"}, objects,
	)
	if err != nil {
		t.Fatalf("buildReverseJoin: unexpected error: %v", err)
	}

	if !isReversed {
		t.Error("buildReverseJoin: expected isReversed=true")
	}

	if len(parentCols) != 1 || parentCols[0] != "id" {
		t.Errorf("buildReverseJoin: parentCols = %v, want [id]", parentCols)
	}

	if len(targetCols) != 1 || targetCols[0] != "user_id" {
		t.Errorf("buildReverseJoin: targetCols = %v, want [user_id]", targetCols)
	}
}

// TestBuildJoinConditionForSelection_PercentInColumnName is a regression test
// for a templated-Sprintf hazard that existed when the join condition was
// stored as a fmt.Sprintf template on the relationship. A column name
// containing a `%` (legal inside a double-quoted SQL identifier — e.g.
// `CREATE TABLE t ("a%b" int)`) would have been interpreted as a format verb
// by the downstream Sprintf step, producing `%!s(MISSING)` artefacts or
// misaligned positional arguments. The current renderer writes columns
// directly into a strings.Builder so a `%` survives verbatim.
func TestBuildJoinConditionForSelection_PercentInColumnName(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name           string
		parentColumns  []string
		targetColumns  []string
		joinIsReversed bool
		parentAlias    string
		want           string
	}{
		{
			name:           "forward join, parent column with %",
			parentColumns:  []string{"a%b"},
			targetColumns:  []string{"id"},
			joinIsReversed: false,
			parentAlias:    "parent",
			want:           `"parent"."a%b" = "id"`,
		},
		{
			name:           "forward join, target column with %",
			parentColumns:  []string{"fk"},
			targetColumns:  []string{"x%y"},
			joinIsReversed: false,
			parentAlias:    "parent",
			want:           `"parent"."fk" = "x%y"`,
		},
		{
			name:           "array/reverse join, target column with %",
			parentColumns:  []string{"pk"},
			targetColumns:  []string{"a%b"},
			joinIsReversed: true,
			parentAlias:    "parent",
			want:           `"a%b" = "parent"."pk"`,
		},
		{
			name: "multi-column, both sides contain %",
			parentColumns: []string{
				"first%col",
				"second%col",
			},
			targetColumns: []string{
				"tgt%1",
				"tgt%2",
			},
			joinIsReversed: false,
			parentAlias:    "p",
			want:           `"p"."first%col" = "tgt%1" AND "p"."second%col" = "tgt%2"`,
		},
		{
			name:           "no columns yields TRUE",
			parentColumns:  nil,
			targetColumns:  nil,
			joinIsReversed: false,
			parentAlias:    "p",
			want:           "TRUE",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			rel := &relationship{
				parentColumns:  tc.parentColumns,
				targetColumns:  tc.targetColumns,
				joinIsReversed: tc.joinIsReversed,
			}

			got := rel.buildJoinConditionForSelection(tc.parentAlias)

			if got != tc.want {
				t.Errorf("buildJoinConditionForSelection = %q, want %q", got, tc.want)
			}

			// Belt-and-braces: no fmt.Sprintf MISSING/verb artefacts must
			// appear, regardless of column content.
			if strings.Contains(got, "%!") {
				t.Errorf(
					"buildJoinConditionForSelection produced fmt.Sprintf artefact: %q",
					got,
				)
			}
		})
	}
}
