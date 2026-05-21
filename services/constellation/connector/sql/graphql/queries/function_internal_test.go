package queries

import (
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
)

// TestBuildFunctionFromClauseEscapesAlias guards against second-order SQL
// injection via a DDL-named function: the derived alias `_fn_<functionName>`
// must double any embedded double quote in both the AS alias and sourceRef so
// the identifier cannot break out of its quoted context.
func TestBuildFunctionFromClauseEscapesAlias(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name           string
		functionName   string
		wantSourceRef  string
		wantAliasInSQL string
	}{
		{
			name:           "plain function name",
			functionName:   "get_users",
			wantSourceRef:  `"_fn_get_users"`,
			wantAliasInSQL: `AS "_fn_get_users"`,
		},
		{
			name:           "function name with embedded double quote",
			functionName:   `x") FROM secret;--`,
			wantSourceRef:  `"_fn_x"") FROM secret;--"`,
			wantAliasInSQL: `AS "_fn_x"") FROM secret;--"`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			f := newFunction("public", tt.functionName, dialect.NewPostgresDialect())

			result, err := f.buildFunctionFromClause(
				map[string]any{},
				map[string]any{},
				nil,
				1,
			)
			if err != nil {
				t.Fatalf("buildFunctionFromClause returned error: %v", err)
			}

			if result.sourceRef != tt.wantSourceRef {
				t.Errorf("sourceRef = %q, want %q", result.sourceRef, tt.wantSourceRef)
			}

			if !strings.Contains(result.fromClause, tt.wantAliasInSQL) {
				t.Errorf("fromClause = %q, want it to contain %q",
					result.fromClause, tt.wantAliasInSQL)
			}
		})
	}
}
