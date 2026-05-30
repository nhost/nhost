package queries_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

func TestRootsBuildQuery_NoRootsForOperation(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		roots     queries.Roots
		operation ast.Operation
	}{
		{
			name:      "query operation but Roots has no query map",
			roots:     queries.Roots{Operations: nil, StreamFields: nil},
			operation: ast.Query,
		},
		{
			name: "mutation operation but Roots has no mutation map",
			roots: queries.Roots{
				Operations: map[queries.OperationKind]map[string]core.Operation{
					queries.OperationQuery: {},
				},
				StreamFields: nil,
			},
			operation: ast.Mutation,
		},
		{
			name: "subscription operation but Roots has no subscription map",
			roots: queries.Roots{
				Operations: map[queries.OperationKind]map[string]core.Operation{
					queries.OperationQuery: {},
				},
				StreamFields: nil,
			},
			operation: ast.Subscription,
		},
		{
			name: "unknown operation kind",
			roots: queries.Roots{
				Operations: map[queries.OperationKind]map[string]core.Operation{
					queries.OperationQuery: {},
				},
				StreamFields: nil,
			},
			operation: ast.Operation("invalid"),
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			op := &ast.OperationDefinition{
				Operation:    tc.operation,
				SelectionSet: ast.SelectionSet{},
			}

			_, err := tc.roots.BuildQuery(op, nil, nil, "admin", nil)
			if !errors.Is(err, queries.ErrNoRootsForRole) {
				t.Fatalf("err = %v, want errors.Is ErrNoRootsForRole", err)
			}
		})
	}
}

func TestRootsBuildQuery_FieldNotRegistered(t *testing.T) {
	t.Parallel()

	r := queries.Roots{
		Operations: map[queries.OperationKind]map[string]core.Operation{
			queries.OperationQuery: {},
		},
		StreamFields: nil,
	}

	op := &ast.OperationDefinition{
		Operation: ast.Query,
		SelectionSet: ast.SelectionSet{
			&ast.Field{Name: "users"},
		},
	}

	_, err := r.BuildQuery(op, nil, nil, "admin", nil)
	if err == nil {
		t.Fatal("expected error for unregistered field, got nil")
	}

	if !strings.Contains(err.Error(), "users") {
		t.Errorf("error should mention the missing field, got: %v", err)
	}
}

func TestRootsBuildQuery_StampsQueryValidationError(t *testing.T) {
	t.Parallel()

	var stubOp core.Operation = func(
		_ *ast.Field,
		_ ast.FragmentDefinitionList,
		_ map[string]any,
		_ string,
		_ map[string]any,
		_ map[string]core.Operation,
	) (core.SQLOperation, error) {
		return core.SQLOperation{}, &arguments.QueryValidationError{
			Err:       arguments.ErrDistinctOnOrderByMismatch,
			RootField: "",
		}
	}

	r := queries.Roots{
		Operations: map[queries.OperationKind]map[string]core.Operation{
			queries.OperationQuery: {"users": stubOp},
		},
		StreamFields: nil,
	}

	op := &ast.OperationDefinition{
		Operation: ast.Query,
		SelectionSet: ast.SelectionSet{
			&ast.Field{Name: "users", Alias: "people"},
		},
	}

	_, err := r.BuildQuery(op, nil, nil, "admin", nil)
	if !errors.Is(err, arguments.ErrDistinctOnOrderByMismatch) {
		t.Fatalf("err = %v, want errors.Is ErrDistinctOnOrderByMismatch", err)
	}

	var vErr *arguments.QueryValidationError
	if !errors.As(err, &vErr) {
		t.Fatalf("err = %T, want *QueryValidationError", err)
	}

	if vErr.RootField != "people" {
		t.Fatalf("RootField = %q, want alias %q", vErr.RootField, "people")
	}
}

func TestRootsBuildQuery_DispatchSucceeds(t *testing.T) {
	t.Parallel()

	wantSQL := "SELECT 1"
	called := false

	var stubOp core.Operation = func(
		_ *ast.Field,
		_ ast.FragmentDefinitionList,
		_ map[string]any,
		_ string,
		_ map[string]any,
		_ map[string]core.Operation,
	) (core.SQLOperation, error) {
		called = true
		return core.SQLOperation{Name: "users", SQL: wantSQL}, nil
	}

	r := queries.Roots{
		Operations: map[queries.OperationKind]map[string]core.Operation{
			queries.OperationQuery: {"users": stubOp},
		},
		StreamFields: nil,
	}

	op := &ast.OperationDefinition{
		Operation: ast.Query,
		SelectionSet: ast.SelectionSet{
			&ast.Field{Name: "users"},
		},
	}

	ops, err := r.BuildQuery(op, nil, nil, "admin", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !called {
		t.Fatal("registered operation was not invoked")
	}

	if len(ops) != 1 || ops[0].SQL != wantSQL {
		t.Errorf("ops = %+v, want one op with SQL %q", ops, wantSQL)
	}
}

func TestRootsBuildQuery_SkipsNonFieldSelections(t *testing.T) {
	t.Parallel()

	r := queries.Roots{
		Operations: map[queries.OperationKind]map[string]core.Operation{
			queries.OperationQuery: {},
		},
		StreamFields: nil,
	}

	op := &ast.OperationDefinition{
		Operation: ast.Query,
		SelectionSet: ast.SelectionSet{
			&ast.FragmentSpread{Name: "Frag"},
		},
	}

	ops, err := r.BuildQuery(op, nil, nil, "admin", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(ops) != 0 {
		t.Errorf("ops = %v, want empty (fragment spreads are skipped)", ops)
	}
}

func TestBuildRoots_NilMetadata(t *testing.T) {
	t.Parallel()

	roots, ops, err := queries.BuildRoots(nil, nil, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if ops == nil {
		t.Fatal("expected non-nil grouped aggregate Ops")
	}

	if _, ok := roots.Operations[queries.OperationQuery]; !ok {
		t.Errorf("expected Roots to contain an empty query map, got: %v", roots)
	}
}

func TestRootsIsStreamSubscription(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		roots queries.Roots
		field *ast.Field
		want  bool
	}{
		{
			name: "nil field returns false",
			roots: queries.Roots{
				Operations: nil,
				StreamFields: map[string]struct{}{
					"users_stream": {},
				},
			},
			field: nil,
			want:  false,
		},
		{
			name: "field name absent from StreamFields returns false",
			roots: queries.Roots{
				Operations: nil,
				StreamFields: map[string]struct{}{
					"users_stream": {},
				},
			},
			field: &ast.Field{Name: "users"},
			want:  false,
		},
		{
			name: "field name present in StreamFields returns true",
			roots: queries.Roots{
				Operations: nil,
				StreamFields: map[string]struct{}{
					"users_stream": {},
				},
			},
			field: &ast.Field{Name: "users_stream"},
			want:  true,
		},
		{
			name: "nil StreamFields with non-nil field returns false",
			roots: queries.Roots{
				Operations:   nil,
				StreamFields: nil,
			},
			field: &ast.Field{Name: "users_stream"},
			want:  false,
		},
		{
			name: "empty StreamFields with non-nil field returns false",
			roots: queries.Roots{
				Operations:   nil,
				StreamFields: map[string]struct{}{},
			},
			field: &ast.Field{Name: "users_stream"},
			want:  false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := tc.roots.IsStreamSubscription(tc.field)
			if got != tc.want {
				t.Errorf("IsStreamSubscription = %v, want %v", got, tc.want)
			}
		})
	}
}

// TestOperationConstants pins the Roots operation-kind constants to the string
// values produced by gqlparser's ast.Operation type. BuildQuery dispatches on
// ast.Operation and looks up rootMap by these constants, so a drift between
// the two (e.g. renaming OperationQuery to "queries") would break the entire
// stack silently.
func TestOperationConstants(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		constant queries.OperationKind
		want     string
	}{
		{
			name:     "OperationQuery matches ast.Query",
			constant: queries.OperationQuery,
			want:     string(ast.Query),
		},
		{
			name:     "OperationMutation matches ast.Mutation",
			constant: queries.OperationMutation,
			want:     string(ast.Mutation),
		},
		{
			name:     "OperationSubscription matches ast.Subscription",
			constant: queries.OperationSubscription,
			want:     string(ast.Subscription),
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if string(tc.constant) != tc.want {
				t.Errorf("%s = %q, want %q", tc.name, tc.constant, tc.want)
			}
		})
	}
}
