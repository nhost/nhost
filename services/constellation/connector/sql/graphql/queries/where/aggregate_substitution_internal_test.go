package where

import (
	"sort"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

// newTestAggregateRelationshipFilter builds a bool_and aggregateRelationshipFilter
// whose target/join are driven by stubs. A bool aggregate is used so
// writeAggregateExpr renders the precomputed boolAggFunc string and never calls
// into the (nil) dialect, keeping these unit tests dialect-free.
func newTestAggregateRelationshipFilter(
	target *stubTable,
	rel *stubRelationship,
	filter Statement,
	role string,
) *aggregateRelationshipFilter {
	return &aggregateRelationshipFilter{
		relationship:     rel,
		target:           target,
		kind:             aggFuncBoolAnd,
		columns:          []*core.Column{newTestColumn("active", "boolean")},
		distinct:         false,
		boolAggFunc:      "bool_and",
		predicate:        &rawFilter{condition: `"aggs0"."__cs_agg" = true`},
		filter:           filter,
		role:             role,
		sessionVariables: nil,
		nestingLevel:     0,
		aliasPrefix:      "",
	}
}

func TestCollectSourceColumns_AggregateRelationshipFilter(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		filter   Statement
		expected []string
	}{
		{
			name: "single parent column",
			filter: newTestAggregateRelationshipFilter(
				&stubTable{tableFromClause: `"public"."posts"`},
				&stubRelationship{parentCols: []string{"author_id"}},
				nil,
				"",
			),
			expected: []string{"author_id"},
		},
		{
			name: "composite parent columns",
			filter: newTestAggregateRelationshipFilter(
				&stubTable{tableFromClause: `"public"."posts"`},
				&stubRelationship{parentCols: []string{"tenant_id", "author_id"}},
				nil,
				"",
			),
			expected: []string{"author_id", "tenant_id"},
		},
		{
			name: "nested inside or with relationship filter",
			filter: &orFilter{
				conditions: []Statement{
					newTestAggregateRelationshipFilter(
						&stubTable{tableFromClause: `"public"."posts"`},
						&stubRelationship{parentCols: []string{"author_id"}},
						nil,
						"",
					),
					newTestRelationshipFilter("workspace_id"),
				},
			},
			expected: []string{"author_id", "workspace_id"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := CollectSourceColumns(tc.filter)

			// CollectSourceColumns preserves walk order; sort both sides so the
			// assertion is order-independent like the sibling table-driven test.
			sort.Strings(got)
			sort.Strings(tc.expected)

			if diff := cmp.Diff(tc.expected, got); diff != "" {
				t.Errorf("CollectSourceColumns mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestAggregateRelationshipFilter_SubstitutedReadsCTE(t *testing.T) {
	t.Parallel()

	target := &stubTable{tableFromClause: `"public"."posts"`}
	rel := &stubRelationship{
		target:     target,
		parentCols: []string{"author_id"},
		joinWriter: defaultJoinWriter,
	}

	f := newTestAggregateRelationshipFilter(target, rel, nil, "")

	subs := TableSubstitutions{`"public"."posts"`: "mutation_result"}

	var b strings.Builder

	_, _, err := WriteConditionSubstituted(f, &b, `"parent"`, nil, 1, subs)
	if err != nil {
		t.Fatalf("WriteConditionSubstituted: %v", err)
	}

	sql := b.String()
	if !strings.Contains(sql, "FROM mutation_result ") {
		t.Errorf("expected substituted CTE source, got %q", sql)
	}

	if strings.Contains(sql, `"public"."posts"`) {
		t.Errorf("base target table must not appear when substituted, got %q", sql)
	}
}

func TestAggregateRelationshipFilter_SubstitutedSkipsRowLevelPermissions(t *testing.T) {
	t.Parallel()

	target := &stubTable{
		tableFromClause: `"public"."posts"`,
		hasRowLevelPerm: true,
		permWriter: func(_ *strings.Builder, _ []any, _ int) ([]any, int, error) {
			t.Fatal("row-level permissions must be skipped when the target is substituted")
			return nil, 0, nil
		},
	}
	rel := &stubRelationship{
		target:     target,
		parentCols: []string{"author_id"},
		joinWriter: defaultJoinWriter,
	}

	f := newTestAggregateRelationshipFilter(target, rel, nil, "user")

	subs := TableSubstitutions{`"public"."posts"`: "mutation_result"}

	var b strings.Builder

	if _, _, err := WriteConditionSubstituted(f, &b, `"parent"`, nil, 1, subs); err != nil {
		t.Fatalf("WriteConditionSubstituted: %v", err)
	}
}

func TestAggregateRelationshipFilter_UnsubstitutedAppliesRowLevelPermissions(t *testing.T) {
	t.Parallel()

	target := &stubTable{
		tableFromClause: `"public"."posts"`,
		hasRowLevelPerm: true,
		permWriter: func(b *strings.Builder, params []any, paramIndex int) ([]any, int, error) {
			b.WriteString(`"aggt0"."tenant_id" = $1`)
			return append(params, "t1"), paramIndex + 1, nil
		},
	}
	rel := &stubRelationship{
		target:     target,
		parentCols: []string{"author_id"},
		joinWriter: defaultJoinWriter,
	}

	f := newTestAggregateRelationshipFilter(target, rel, nil, "user")

	// A substitution for a different table must not match this target, so the
	// permission branch still applies and the base table is still read.
	subs := TableSubstitutions{`"public"."other"`: "other_cte"}

	var b strings.Builder

	params, _, err := WriteConditionSubstituted(f, &b, `"parent"`, nil, 1, subs)
	if err != nil {
		t.Fatalf("WriteConditionSubstituted: %v", err)
	}

	sql := b.String()
	if !strings.Contains(sql, `"aggt0"."tenant_id" = $1`) {
		t.Errorf("expected row-level permission predicate, got %q", sql)
	}

	if !strings.Contains(sql, `"public"."posts"`) {
		t.Errorf("expected base target table when not substituted, got %q", sql)
	}

	if len(params) != 1 || params[0] != "t1" {
		t.Errorf("expected permission to append session value, got %v", params)
	}
}

func TestAggregateRelationshipFilter_SubstitutedRecursesIntoNestedFilter(t *testing.T) {
	t.Parallel()

	target := &stubTable{tableFromClause: `"public"."posts"`}
	rel := &stubRelationship{
		target:     target,
		parentCols: []string{"author_id"},
		joinWriter: defaultJoinWriter,
	}

	// The nested filter is itself an aggregate-relationship filter over a
	// sibling table that is also being substituted. The outer writer must thread
	// subs into it so the inner correlated subquery reads its CTE too.
	innerTarget := &stubTable{tableFromClause: `"public"."comments"`}
	innerRel := &stubRelationship{
		target:     innerTarget,
		parentCols: []string{"post_id"},
		joinWriter: func(b *strings.Builder, parent, tgt string) {
			b.WriteString(parent)
			b.WriteString(".id = ")
			b.WriteString(tgt)
			b.WriteString(".post_id")
		},
	}
	inner := newTestAggregateRelationshipFilter(innerTarget, innerRel, nil, "")
	inner.nestingLevel = 1

	f := newTestAggregateRelationshipFilter(target, rel, inner, "")

	subs := TableSubstitutions{
		`"public"."posts"`:    "posts_cte",
		`"public"."comments"`: "comments_cte",
	}

	var b strings.Builder

	if _, _, err := WriteConditionSubstituted(f, &b, `"parent"`, nil, 1, subs); err != nil {
		t.Fatalf("WriteConditionSubstituted: %v", err)
	}

	sql := b.String()
	if !strings.Contains(sql, "FROM posts_cte ") {
		t.Errorf("expected outer CTE source, got %q", sql)
	}

	if !strings.Contains(sql, "FROM comments_cte ") {
		t.Errorf("expected nested filter to be rendered against its CTE, got %q", sql)
	}

	if strings.Contains(sql, `"public"."comments"`) {
		t.Errorf("nested base table must not appear when substituted, got %q", sql)
	}
}

func TestAggregateRelationshipFilter_NoSubsMatchesWriteCondition(t *testing.T) {
	t.Parallel()

	build := func(render func(f *aggregateRelationshipFilter, b *strings.Builder) error) string {
		target := &stubTable{tableFromClause: `"public"."posts"`}
		rel := &stubRelationship{
			target:     target,
			parentCols: []string{"author_id"},
			joinWriter: defaultJoinWriter,
		}
		f := newTestAggregateRelationshipFilter(
			target,
			rel,
			&rawFilter{condition: `"aggt0"."x" = 1`},
			"",
		)

		var b strings.Builder
		if err := render(f, &b); err != nil {
			t.Fatalf("render: %v", err)
		}

		return b.String()
	}

	base := build(func(f *aggregateRelationshipFilter, b *strings.Builder) error {
		_, _, err := f.WriteCondition(b, `"parent"`, nil, 1)
		return err
	})

	// An empty substitution map must render byte-identically to WriteCondition,
	// proving the substituted path is a faithful superset of the base render.
	subbed := build(func(f *aggregateRelationshipFilter, b *strings.Builder) error {
		_, _, err := WriteConditionSubstituted(f, b, `"parent"`, nil, 1, nil)
		return err
	})

	if base != subbed {
		t.Errorf(
			"empty-subs render diverged from WriteCondition:\nbase:  %q\nsubbed: %q",
			base,
			subbed,
		)
	}
}
