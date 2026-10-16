package where

import (
	"strings"
	"testing"
)

// TestWriteConditionSubstituted_MatchesWriteCondition pins the single render
// path: rendering with a substitution map that matches nothing must produce
// exactly what WriteCondition produces, including the degenerate forms that
// the substituted path used to render differently.
func TestWriteConditionSubstituted_MatchesWriteCondition(t *testing.T) {
	t.Parallel()

	target := &stubTable{tableFromClause: `"public"."authors"`}
	rel := &stubRelationship{target: target, joinWriter: defaultJoinWriter}

	tests := []struct {
		name     string
		stmt     Statement
		expected string
	}{
		{
			name:     "empty or",
			stmt:     &orFilter{conditions: nil},
			expected: "false",
		},
		{
			name: "or inside not",
			stmt: &notFilter{condition: &orFilter{conditions: []Statement{
				&rawFilter{condition: "a"}, &rawFilter{condition: "b"},
			}}},
			expected: "NOT ((a OR b))",
		},
		{
			name: "relationship inside and",
			stmt: Clause{
				&rawFilter{condition: "a"},
				&relationshipFilter{
					relationship: rel,
					conditions:   &orFilter{conditions: nil},
					aliasPrefix:  "g",
				},
			},
			expected: `a AND EXISTS (SELECT 1 FROM "public"."authors" g WHERE "src".pk = g.fk AND false)`,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var plain strings.Builder

			if _, _, err := tc.stmt.WriteCondition(&plain, `"src"`, nil, 1); err != nil {
				t.Fatalf("WriteCondition: %v", err)
			}

			var substituted strings.Builder

			subs := TableSubstitutions{`"public"."unrelated"`: "mutation_result"}
			if _, _, err := WriteConditionSubstituted(
				tc.stmt, &substituted, `"src"`, nil, 1, subs,
			); err != nil {
				t.Fatalf("WriteConditionSubstituted: %v", err)
			}

			if plain.String() != tc.expected {
				t.Errorf("WriteCondition = %q, want %q", plain.String(), tc.expected)
			}

			if substituted.String() != tc.expected {
				t.Errorf("WriteConditionSubstituted = %q, want %q", substituted.String(), tc.expected)
			}
		})
	}
}
