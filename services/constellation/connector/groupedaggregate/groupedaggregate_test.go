package groupedaggregate_test

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/groupedaggregate"
	"github.com/nhost/nhost/services/constellation/connector/groupedaggregate/mock"
	"github.com/vektah/gqlparser/v2/ast"
)

// Interface-conformance assertion: the generated MockExecutor must implement
// groupedaggregate.Executor. This guards against silent drift between the
// interface and its generated mock when the contract evolves, and ensures the
// mock has at least one consumer in the codebase.
var _ groupedaggregate.Executor = (*mock.MockExecutor)(nil)

// TestRequest_FieldsRoundTrip verifies that Request preserves the exact
// values passed into a named-field struct literal. The package is data-only,
// but this guards against a future field rename or reordering propagating
// silently into the two production call sites
// (controller/resolver/aggregate_resolver.go and
// connector/sql/grouped_aggregate.go).
func TestRequest_FieldsRoundTrip(t *testing.T) {
	t.Parallel()

	field := &ast.Field{Name: "users_aggregate"}
	fragments := ast.FragmentDefinitionList{{Name: "UserFields"}}
	variables := map[string]any{"limit": 10}
	joinValues := []any{"u1", "u2", "u3"}

	req := groupedaggregate.Request{
		TableSchema:       "public",
		TableName:         "users",
		JoinColumnSQLName: "owner_id",
		JoinValues:        joinValues,
		Field:             field,
		Fragments:         fragments,
		Variables:         variables,
	}

	if req.TableSchema != "public" {
		t.Errorf("TableSchema: got %q, want %q", req.TableSchema, "public")
	}

	if req.TableName != "users" {
		t.Errorf("TableName: got %q, want %q", req.TableName, "users")
	}

	if req.JoinColumnSQLName != "owner_id" {
		t.Errorf("JoinColumnSQLName: got %q, want %q", req.JoinColumnSQLName, "owner_id")
	}

	if len(req.JoinValues) != len(joinValues) {
		t.Fatalf("JoinValues: got len %d, want %d", len(req.JoinValues), len(joinValues))
	}

	for i, v := range joinValues {
		if req.JoinValues[i] != v {
			t.Errorf("JoinValues[%d]: got %v, want %v", i, req.JoinValues[i], v)
		}
	}

	if req.Field != field {
		t.Errorf("Field: got %p, want %p", req.Field, field)
	}

	if len(req.Fragments) != 1 || req.Fragments[0].Name != "UserFields" {
		t.Errorf("Fragments: got %+v, want one fragment named UserFields", req.Fragments)
	}

	if got, ok := req.Variables["limit"].(int); !ok || got != 10 {
		t.Errorf("Variables[limit]: got %v, want 10", req.Variables["limit"])
	}
}
