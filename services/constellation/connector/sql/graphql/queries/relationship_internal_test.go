package queries

import (
	"strings"
	"testing"
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

			joinCondition, _, parentColumns, targetColumns, isReversed := buildManualJoinCondition(
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

			// Verify the join condition template produces correct SQL via writeJoinConditionAliased
			rel := &relationship{
				parentColumns:  parentColumns,
				targetColumns:  targetColumns,
				joinIsReversed: isReversed,
				joinCondition:  joinCondition,
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

	joinCondition, _, _, _, _ := buildManualJoinCondition(mapping, false) //nolint:dogsled

	// The join condition must reference BOTH columns.
	// With the current bug, only one column is included.
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

	joinCondition, _, parentColumns, targetColumns, isReversed := buildManualJoinCondition(
		mapping, false,
	)

	rel := &relationship{
		parentColumns:  parentColumns,
		targetColumns:  targetColumns,
		joinIsReversed: isReversed,
		joinCondition:  joinCondition,
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

	joinCondition, _, parentColumns, targetColumns, isReversed := buildManualJoinCondition(
		mapping, true,
	)

	rel := &relationship{
		parentColumns:  parentColumns,
		targetColumns:  targetColumns,
		joinIsReversed: isReversed,
		joinCondition:  joinCondition,
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
