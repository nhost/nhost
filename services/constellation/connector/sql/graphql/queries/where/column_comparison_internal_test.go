package where

import (
	"errors"
	"sort"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/values"
)

func TestParseColumnReference(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		operand  any
		expected columnReference
		wantErr  bool
	}{
		{
			name:     "bare column",
			operand:  "club_id",
			expected: columnReference{column: "club_id", fromRoot: false},
		},
		{
			name:     "single element list",
			operand:  []any{"club_id"},
			expected: columnReference{column: "club_id", fromRoot: false},
		},
		{
			name:     "root table reference",
			operand:  []any{"$", "club_id"},
			expected: columnReference{column: "club_id", fromRoot: true},
		},
		{name: "empty list", operand: []any{}, wantErr: true},
		{name: "root marker alone", operand: []any{"$"}, wantErr: true},
		{name: "two columns without root marker", operand: []any{"a", "b"}, wantErr: true},
		{name: "too many elements", operand: []any{"$", "a", "b"}, wantErr: true},
		{name: "non-string element", operand: []any{"$", 1}, wantErr: true},
		{name: "number", operand: 1, wantErr: true},
		{name: "object", operand: map[string]any{"column": "a"}, wantErr: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			value, err := values.GoValueToAST(tc.operand)
			if err != nil {
				t.Fatalf("GoValueToAST: %v", err)
			}

			got, err := parseColumnReference(value)
			if tc.wantErr {
				if !errors.Is(err, errInvalidColumnReference) {
					t.Fatalf("expected errInvalidColumnReference, got %v", err)
				}

				return
			}

			if err != nil {
				t.Fatalf("parseColumnReference: %v", err)
			}

			if got != tc.expected {
				t.Errorf("got %+v, want %+v", got, tc.expected)
			}
		})
	}
}

func TestParseColumnReference_StringValue(t *testing.T) {
	t.Parallel()

	got, err := parseColumnReference(&ast.Value{Kind: ast.StringValue, Raw: "club_id"})
	if err != nil {
		t.Fatalf("parseColumnReference: %v", err)
	}

	if got != (columnReference{column: "club_id", fromRoot: false}) {
		t.Errorf("got %+v", got)
	}
}

func TestParseFieldComparison_ColumnComparisonOperators(t *testing.T) {
	t.Parallel()

	tests := []struct {
		operator string
		expected string
	}{
		{operator: "_ceq", expected: `"src"."club_id" = "src"."owner_club_id"`},
		{operator: "_cneq", expected: `"src"."club_id" != "src"."owner_club_id"`},
		{operator: "_cgt", expected: `"src"."club_id" > "src"."owner_club_id"`},
		{operator: "_cgte", expected: `"src"."club_id" >= "src"."owner_club_id"`},
		{operator: "_clt", expected: `"src"."club_id" < "src"."owner_club_id"`},
		{operator: "_clte", expected: `"src"."club_id" <= "src"."owner_club_id"`},
	}

	for _, tc := range tests {
		t.Run(tc.operator, func(t *testing.T) {
			t.Parallel()

			value, err := values.GoValueToAST(map[string]any{tc.operator: "owner_club_id"})
			if err != nil {
				t.Fatalf("GoValueToAST: %v", err)
			}

			stmt, err := parseFieldComparisonValue(
				newTestColumn("club_id", "uuid"), nil, value, nil, nil,
			)
			if err != nil {
				t.Fatalf("parseFieldComparisonValue: %v", err)
			}

			var b strings.Builder

			params, next, err := stmt.WriteCondition(&b, `"src"`, nil, 1)
			if err != nil {
				t.Fatalf("WriteCondition: %v", err)
			}

			if b.String() != tc.expected {
				t.Errorf("got %q, want %q", b.String(), tc.expected)
			}

			if len(params) != 0 || next != 1 {
				t.Errorf("column comparison must bind no params, got %v (next %d)", params, next)
			}
		})
	}
}

func TestParseFieldComparison_ColumnComparisonInvalidOperand(t *testing.T) {
	t.Parallel()

	value, err := values.GoValueToAST(map[string]any{"_ceq": []any{"a", "b"}})
	if err != nil {
		t.Fatalf("GoValueToAST: %v", err)
	}

	_, err = parseFieldComparisonValue(newTestColumn("club_id", "uuid"), nil, value, nil, nil)
	if !errors.Is(err, errInvalidColumnReference) {
		t.Fatalf("expected errInvalidColumnReference, got %v", err)
	}
}

// newRootComparison builds `<column> = $.<rootColumn>`.
func newRootComparison(column, rootColumn string) *columnComparisonFilter {
	return &columnComparisonFilter{
		column:   newTestColumn(column, "uuid"),
		target:   nil,
		operator: " = ",
		ref:      columnReference{column: rootColumn, fromRoot: true},
	}
}

func newRelationshipTo(table string, conditions Statement, nestingLevel int) *relationshipFilter {
	return &relationshipFilter{
		relationship: &stubRelationship{
			target:     &stubTable{tableFromClause: table},
			parentCols: []string{"water_id"},
			joinWriter: defaultJoinWriter,
		},
		conditions:   conditions,
		nestingLevel: nestingLevel,
		aliasPrefix:  "g",
	}
}

func TestColumnComparisonFilter_RootReferenceUsesOutermostSource(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		stmt     Statement
		subs     TableSubstitutions
		expected string
	}{
		{
			name:     "top level",
			stmt:     Clause{newRootComparison("club_id", "club_id")},
			expected: `"data"."club_id" = "data"."club_id"`,
		},
		{
			// The case from nhost/nhost#5113: an insert check on
			// club_stocking_plans requiring water.club_id = $.club_id.
			name: "inside relationship",
			stmt: Clause{
				newRelationshipTo(`"public"."waters"`, newRootComparison("club_id", "club_id"), 0),
			},
			expected: `EXISTS (SELECT 1 FROM "public"."waters" g WHERE "data".pk = g.fk` +
				` AND g."club_id" = "data"."club_id")`,
		},
		{
			name: "two relationships deep under _or and _not",
			stmt: &orFilter{conditions: []Statement{
				&notFilter{condition: newRelationshipTo(
					`"public"."waters"`,
					newRelationshipTo(`"public"."clubs"`, newRootComparison("id", "club_id"), 1),
					0,
				)},
			}},
			expected: `(NOT (EXISTS (SELECT 1 FROM "public"."waters" g WHERE "data".pk = g.fk` +
				` AND EXISTS (SELECT 1 FROM "public"."clubs" "g1" WHERE g.pk = "g1".fk` +
				` AND "g1"."id" = "data"."club_id"))))`,
		},
		{
			name: "inside _exists",
			stmt: &existsFilter{
				targetTable:  &stubTable{tableFromClause: `"public"."clubs"`},
				conditions:   Clause{newRootComparison("id", "club_id")},
				nestingLevel: 0,
				aliasPrefix:  "h",
			},
			expected: `EXISTS (SELECT 1 FROM "public"."clubs" h WHERE h."id" = "data"."club_id")`,
		},
		{
			name: "inside substituted relationship",
			stmt: Clause{
				newRelationshipTo(`"public"."waters"`, newRootComparison("club_id", "club_id"), 0),
			},
			subs: TableSubstitutions{`"public"."waters"`: "mutation_result"},
			expected: `EXISTS (SELECT 1 FROM mutation_result g WHERE "data".pk = g.fk` +
				` AND g."club_id" = "data"."club_id")`,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var b strings.Builder

			_, _, err := WriteConditionSubstituted(tc.stmt, &b, `"data"`, nil, 1, tc.subs)
			if err != nil {
				t.Fatalf("WriteConditionSubstituted: %v", err)
			}

			if b.String() != tc.expected {
				t.Errorf("got\n  %s\nwant\n  %s", b.String(), tc.expected)
			}
		})
	}
}

func TestCollectSourceColumns_ColumnComparison(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		stmt     Statement
		expected []string
	}{
		{
			name: "same-table reference reads both columns",
			stmt: &columnComparisonFilter{
				column:   newTestColumn("a", "int"),
				operator: " = ",
				ref:      columnReference{column: "b", fromRoot: false},
			},
			expected: []string{"a", "b"},
		},
		{
			name:     "top-level root reference",
			stmt:     newRootComparison("a", "b"),
			expected: []string{"a", "b"},
		},
		{
			name: "root reference inside relationship",
			stmt: Clause{
				newRelationshipTo(`"public"."waters"`, newRootComparison("club_id", "club_id"), 0),
			},
			expected: []string{"club_id", "water_id"},
		},
		{
			name: "same-table reference inside relationship reads target columns only",
			stmt: newRelationshipTo(`"public"."waters"`, &columnComparisonFilter{
				column:   newTestColumn("a", "int"),
				operator: " = ",
				ref:      columnReference{column: "b", fromRoot: false},
			}, 0),
			expected: []string{"water_id"},
		},
		{
			name: "root reference inside _exists",
			stmt: &existsFilter{
				targetTable: &stubTable{tableFromClause: `"public"."clubs"`},
				conditions:  Clause{newRootComparison("id", "club_id")},
				aliasPrefix: "h",
			},
			expected: []string{"club_id"},
		},
		{
			name: "root reference inside aggregate filter",
			stmt: newTestAggregateRelationshipFilter(
				&stubTable{tableFromClause: `"public"."posts"`},
				&stubRelationship{parentCols: []string{"author_id"}},
				newRootComparison("tenant_id", "tenant_id"),
				"",
			),
			expected: []string{"author_id", "tenant_id"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := CollectSourceColumns(tc.stmt)
			sort.Strings(got)
			sort.Strings(tc.expected)

			if diff := cmp.Diff(tc.expected, got); diff != "" {
				t.Errorf("CollectSourceColumns mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
