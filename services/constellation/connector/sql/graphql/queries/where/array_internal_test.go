package where

import (
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
)

func TestArrayColumnMembershipExpression(t *testing.T) {
	t.Parallel()

	column := &core.Column{SQLName: "tags", SQLType: "text[]", IsArray: true}
	target := &comparisonTarget{
		sourceColumn: "tags", sqlType: "text[]",
		render: func(b *strings.Builder, _ string) { b.WriteString("array_identity($1::text[])") },
	}

	tests := []struct {
		name    string
		values  []any
		negated bool
		wantSQL string
	}{
		{
			name:    "in",
			values:  []any{[]any{"a", "b"}, []any{"b"}},
			wantSQL: "(array_identity($1::text[]) = $2::text[] OR array_identity($1::text[]) = $3::text[])",
		},
		{
			name:    "nin",
			values:  []any{[]any{"a", "b"}, []any{"b"}},
			negated: true,
			wantSQL: "(array_identity($1::text[]) != $2::text[] AND array_identity($1::text[]) != $3::text[])",
		},
		{name: "empty in", wantSQL: "(array_identity($1::text[]) IS NULL AND FALSE)"},
		{name: "empty nin", negated: true, wantSQL: "(array_identity($1::text[]) IS NULL OR TRUE)"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var sql strings.Builder

			initialParams := []any{[]any{"argument"}}

			params, next, err := writeArrayTargetComparison(
				&sql,
				`"t"`,
				column,
				target,
				tt.values,
				dialect.NewPostgresDialect(),
				initialParams,
				2,
				tt.negated,
			)
			if err != nil {
				t.Fatalf("writeArrayTargetComparison: %v", err)
			}

			if sql.String() != tt.wantSQL {
				t.Errorf("SQL = %s, want %s", sql.String(), tt.wantSQL)
			}

			if diff := cmp.Diff(append(initialParams, tt.values...), params); diff != "" {
				t.Errorf("parameters (-want +got):\n%s", diff)
			}

			if want := 2 + len(tt.values); next != want {
				t.Errorf("next parameter = %d, want %d", next, want)
			}
		})
	}
}
