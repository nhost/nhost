package where

import (
	"sort"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

// fakeRelationshipForTest is a minimal Relationship implementation used to
// drive relationshipFilter.sourceColumns without standing up gomock.
type fakeRelationshipForTest struct {
	parentColumns []string
}

func (f *fakeRelationshipForTest) Target() Table           { return nil }
func (f *fakeRelationshipForTest) ParentColumns() []string { return f.parentColumns }
func (f *fakeRelationshipForTest) WriteJoinConditionAliased(
	_ *strings.Builder, _, _ string,
) {
}

func newTestColumn(sqlName, sqlType string) *core.Column {
	return &core.Column{
		SQLName:     sqlName,
		GraphqlName: sqlName,
		SQLType:     sqlType,
		IsArray:     false,
	}
}

func newTestRelationshipFilter(parentColumn string) *relationshipFilter {
	return &relationshipFilter{
		relationship: &fakeRelationshipForTest{parentColumns: []string{parentColumn}},
	}
}

func TestCollectSourceColumns(t *testing.T) {
	t.Parallel()

	colA := newTestColumn("col_a", "uuid")
	colB := newTestColumn("col_b", "text")
	colC := newTestColumn("col_c", "integer")

	tests := []struct {
		name     string
		filter   Statement
		expected []string
	}{
		{
			name:     "nil returns nil",
			filter:   nil,
			expected: nil,
		},
		{
			name: "equals filter returns column",
			filter: &equalsFilter{
				column: colA,
			},
			expected: []string{"col_a"},
		},
		{
			name: "or filter collects from all branches",
			filter: &orFilter{
				conditions: []Statement{
					&equalsFilter{column: colA},
					&equalsFilter{column: colB},
				},
			},
			expected: []string{"col_a", "col_b"},
		},
		{
			name: "and filter collects from all branches",
			filter: &andFilter{
				conditions: []Statement{
					&equalsFilter{column: colA},
					&inFilter{column: colC},
				},
			},
			expected: []string{"col_a", "col_c"},
		},
		{
			name: "not filter collects from inner condition",
			filter: &notFilter{
				condition: &equalsFilter{column: colB},
			},
			expected: []string{"col_b"},
		},
		{
			name: "where clause collects from all statements",
			filter: Clause{
				&equalsFilter{column: colA},
				&notEqualsFilter{column: colB},
			},
			expected: []string{"col_a", "col_b"},
		},
		{
			name:     "relationship filter returns parent column",
			filter:   newTestRelationshipFilter("workspace_id"),
			expected: []string{"workspace_id"},
		},
		{
			name: "nested or with relationship filters",
			filter: &orFilter{
				conditions: []Statement{
					newTestRelationshipFilter("workspace_id"),
					newTestRelationshipFilter("organization_id"),
				},
			},
			expected: []string{"organization_id", "workspace_id"},
		},
		{
			name: "is null filter returns column",
			filter: &isNullFilter{
				column: "deleted_at",
			},
			expected: []string{"deleted_at"},
		},
		{
			name:     "exists filter contributes no source columns",
			filter:   &existsFilter{},
			expected: nil,
		},
		{
			name:     "raw filter contributes no source columns",
			filter:   &rawFilter{},
			expected: nil,
		},
		{
			name: "nested not(and(...)) recurses through both layers",
			filter: &notFilter{
				condition: &andFilter{
					conditions: []Statement{
						&equalsFilter{column: colA},
						&inFilter{column: colB},
					},
				},
			},
			expected: []string{"col_a", "col_b"},
		},
		{
			name:     "not equals filter returns column",
			filter:   &notEqualsFilter{column: colA},
			expected: []string{"col_a"},
		},
		{
			name:     "in filter returns column",
			filter:   &inFilter{column: colA},
			expected: []string{"col_a"},
		},
		{
			name:     "not in filter returns column",
			filter:   &notInFilter{column: colB},
			expected: []string{"col_b"},
		},
		{
			name:     "greater than filter returns column",
			filter:   &greaterThanFilter{column: colA},
			expected: []string{"col_a"},
		},
		{
			name:     "greater than or equal filter returns column",
			filter:   &greaterThanOrEqualFilter{column: colA},
			expected: []string{"col_a"},
		},
		{
			name:     "less than filter returns column",
			filter:   &lessThanFilter{column: colC},
			expected: []string{"col_c"},
		},
		{
			name:     "less than or equal filter returns column",
			filter:   &lessThanOrEqualFilter{column: colC},
			expected: []string{"col_c"},
		},
		{
			name:     "like filter returns column",
			filter:   &likeFilter{column: "name"},
			expected: []string{"name"},
		},
		{
			name:     "not like filter returns column",
			filter:   &notLikeFilter{column: "name"},
			expected: []string{"name"},
		},
		{
			name:     "regex filter returns column",
			filter:   &regexFilter{column: "code"},
			expected: []string{"code"},
		},
		{
			name:     "not regex filter returns column",
			filter:   &notRegexFilter{column: "code"},
			expected: []string{"code"},
		},
		{
			name:     "array contains filter returns column",
			filter:   &arrayContainsFilter{column: "tags"},
			expected: []string{"tags"},
		},
		{
			name:     "array contained in filter returns column",
			filter:   &arrayContainedInFilter{column: "tags"},
			expected: []string{"tags"},
		},
		{
			name:     "jsonb contains filter returns column",
			filter:   &jsonbContainsFilter{column: "data"},
			expected: []string{"data"},
		},
		{
			name:     "jsonb contained in filter returns column",
			filter:   &jsonbContainedInFilter{column: "data"},
			expected: []string{"data"},
		},
		{
			name:     "jsonb has key filter returns column",
			filter:   &jsonbHasKeyFilter{column: "data"},
			expected: []string{"data"},
		},
		{
			name:     "jsonb has keys all filter returns column",
			filter:   &jsonbHasKeysAllFilter{column: "data"},
			expected: []string{"data"},
		},
		{
			name:     "jsonb has keys any filter returns column",
			filter:   &jsonbHasKeysAnyFilter{column: "data"},
			expected: []string{"data"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := CollectSourceColumns(tc.filter)
			sort.Strings(got)
			sort.Strings(tc.expected)

			if diff := cmp.Diff(tc.expected, got); diff != "" {
				t.Errorf("CollectSourceColumns mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
