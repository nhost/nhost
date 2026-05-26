package resolver

import (
	"slices"
	"sort"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/vektah/gqlparser/v2/ast"
)

func TestDatabaseResolverBuildOperation(t *testing.T) {
	t.Parallel()

	joinCols := map[string]string{"id": "userId"}

	tests := []struct {
		name        string
		joinArgs    []*remoteJoinArgument
		sourceField *ast.Field
		check       func(t *testing.T, op *ast.OperationDefinition, rq *remoteQuery)
	}{
		{
			name:     "empty join args returns nil operation",
			joinArgs: nil,
			sourceField: &ast.Field{
				Name:         "orders",
				SelectionSet: ast.SelectionSet{&ast.Field{Name: "id"}},
			},
			check: func(t *testing.T, op *ast.OperationDefinition, _ *remoteQuery) {
				t.Helper()

				if op != nil {
					t.Errorf("expected nil operation, got %+v", op)
				}
			},
		},
		{
			name: "injects phantom join column when absent",
			joinArgs: []*remoteJoinArgument{
				newRemoteJoinArgument(map[string]any{"id": "u1"}),
				newRemoteJoinArgument(map[string]any{"id": "u2"}),
			},
			sourceField: &ast.Field{
				Name:         "orders",
				SelectionSet: ast.SelectionSet{&ast.Field{Name: "product"}},
			},
			check: func(t *testing.T, op *ast.OperationDefinition, rq *remoteQuery) {
				t.Helper()

				if op == nil {
					t.Fatal("expected non-nil operation")
				}

				if len(op.SelectionSet) != 1 {
					t.Fatalf("expected 1 root field, got %d", len(op.SelectionSet))
				}

				field, ok := op.SelectionSet[0].(*ast.Field)
				if !ok {
					t.Fatal("expected *ast.Field")
				}

				if field.Name != "orders" {
					t.Errorf("expected field name 'orders', got %q", field.Name)
				}

				names := selectionFieldNames(field.SelectionSet)
				want := []string{"product", "userId"}

				sort.Strings(names)
				sort.Strings(want)

				if diff := cmp.Diff(want, names); diff != "" {
					t.Errorf("selection mismatch (-want +got):\n%s", diff)
				}

				if diff := cmp.Diff([]string{"userId"}, rq.remotePhantomFields); diff != "" {
					t.Errorf("remote phantom fields mismatch (-want +got):\n%s", diff)
				}
			},
		},
		{
			name: "skips injection when join column already selected",
			joinArgs: []*remoteJoinArgument{
				newRemoteJoinArgument(map[string]any{"id": "u1"}),
			},
			sourceField: &ast.Field{
				Name: "orders",
				SelectionSet: ast.SelectionSet{
					&ast.Field{Name: "userId"},
					&ast.Field{Name: "product"},
				},
			},
			check: func(t *testing.T, op *ast.OperationDefinition, rq *remoteQuery) {
				t.Helper()

				if op == nil {
					t.Fatal("expected non-nil operation")
				}

				if len(rq.remotePhantomFields) != 0 {
					t.Errorf("expected no phantom fields, got %v", rq.remotePhantomFields)
				}
			},
		},
		{
			name: "forwards user arguments but discards user where",
			joinArgs: []*remoteJoinArgument{
				newRemoteJoinArgument(map[string]any{"id": "u1"}),
			},
			sourceField: &ast.Field{
				Name: "orders",
				Arguments: ast.ArgumentList{
					{Name: "limit", Value: &ast.Value{Kind: ast.IntValue, Raw: "10"}},
					// User-supplied "where" must be discarded — databaseResolver builds its own.
					{Name: "where", Value: &ast.Value{Kind: ast.ObjectValue}},
				},
				SelectionSet: ast.SelectionSet{&ast.Field{Name: "id"}},
			},
			check: func(t *testing.T, op *ast.OperationDefinition, _ *remoteQuery) {
				t.Helper()

				if op == nil {
					t.Fatal("expected non-nil operation")
				}

				field, _ := op.SelectionSet[0].(*ast.Field)

				argNames := argumentNames(field.Arguments)

				if countOccurrences(argNames, "where") != 1 {
					t.Errorf("expected exactly one 'where' (the generated one), got %v", argNames)
				}

				if !slices.Contains(argNames, "limit") {
					t.Errorf("expected user 'limit' argument forwarded, got %v", argNames)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			dr := newDatabaseResolver(joinCols, "orders")
			rq := &remoteQuery{
				targetConnector:     "db2",
				alias:               "orders",
				isArray:             true,
				joinArguments:       tt.joinArgs,
				sourceField:         tt.sourceField,
				fragments:           nil,
				parentPath:          nil,
				localPhantomFields:  nil,
				remotePhantomFields: nil,
				resolver:            dr,
				aggregateInfo:       nil,
			}

			op := dr.BuildOperation(rq)
			tt.check(t, op, rq)
		})
	}
}

func argumentNames(args ast.ArgumentList) []string {
	out := make([]string, 0, len(args))
	for _, a := range args {
		out = append(out, a.Name)
	}

	return out
}

func countOccurrences(xs []string, target string) int {
	n := 0

	for _, x := range xs {
		if x == target {
			n++
		}
	}

	return n
}

func TestDatabaseResolverExtractResults(t *testing.T) {
	t.Parallel()

	dr := newDatabaseResolver(map[string]string{"id": "userId"}, "orders")
	rq := &remoteQuery{resolver: dr}

	t.Run("array result", func(t *testing.T) {
		t.Parallel()

		got := dr.ExtractResults(rq, map[string]any{
			"orders": []any{
				map[string]any{"id": "o1"},
				map[string]any{"id": "o2"},
			},
		})

		want := []any{
			map[string]any{"id": "o1"},
			map[string]any{"id": "o2"},
		}
		if diff := cmp.Diff(want, got); diff != "" {
			t.Errorf("results mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("object result wraps to single-element slice", func(t *testing.T) {
		t.Parallel()

		got := dr.ExtractResults(rq, map[string]any{
			"orders": map[string]any{"id": "o1"},
		})

		want := []any{map[string]any{"id": "o1"}}
		if diff := cmp.Diff(want, got); diff != "" {
			t.Errorf("results mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("missing target table key returns nil", func(t *testing.T) {
		t.Parallel()

		got := dr.ExtractResults(rq, map[string]any{"other": "stuff"})
		if got != nil {
			t.Errorf("expected nil, got %+v", got)
		}
	})

	t.Run("non-map response returns nil", func(t *testing.T) {
		t.Parallel()

		got := dr.ExtractResults(rq, "not a map")
		if got != nil {
			t.Errorf("expected nil, got %+v", got)
		}
	})
}

func TestDatabaseResolverBuildResultLookupAndJoinKey(t *testing.T) {
	t.Parallel()

	dr := newDatabaseResolver(map[string]string{"id": "userId"}, "orders")

	rq := &remoteQuery{
		resolver: dr,
		sourceField: &ast.Field{
			SelectionSet: ast.SelectionSet{&ast.Field{Name: "product"}},
		},
	}

	t.Run("lookup keyed by remote join column", func(t *testing.T) {
		t.Parallel()

		results := []any{
			map[string]any{"userId": "u1", "product": "Widget"},
			map[string]any{"userId": "u1", "product": "Gadget"},
			map[string]any{"userId": "u2", "product": "Doohickey"},
		}

		got := dr.BuildResultLookup(rq, results)

		if len(got["u1"]) != 2 {
			t.Errorf("expected 2 results under key 'u1', got %d", len(got["u1"]))
		}

		if len(got["u2"]) != 1 {
			t.Errorf("expected 1 result under key 'u2', got %d", len(got["u2"]))
		}
	})

	t.Run("parent join key matches lookup key", func(t *testing.T) {
		t.Parallel()

		key := dr.GetJoinKeyFromParent(rq, map[string]any{"id": "u1"})
		if key != "u1" {
			t.Errorf("expected key 'u1', got %q", key)
		}
	})

	t.Run("alias is honoured when building lookup", func(t *testing.T) {
		t.Parallel()

		// User aliased the join column as "uid: userId" in their selection.
		rqAliased := &remoteQuery{
			resolver: dr,
			sourceField: &ast.Field{
				SelectionSet: ast.SelectionSet{
					&ast.Field{Name: "userId", Alias: "uid"},
					&ast.Field{Name: "product"},
				},
			},
		}

		results := []any{
			map[string]any{"uid": "u1", "product": "Widget"},
		}

		got := dr.BuildResultLookup(rqAliased, results)
		if len(got["u1"]) != 1 {
			t.Errorf(
				"expected 1 result under alias-lookup key 'u1', got %d (lookup=%v)",
				len(got["u1"]),
				got,
			)
		}
	})
}

func TestSchemaResolverExtractResults(t *testing.T) {
	t.Parallel()

	sr := newSchemaResolver([]string{"id"}, nil)

	rq := &remoteQuery{
		resolver: sr,
		joinArguments: []*remoteJoinArgument{
			newRemoteJoinArgument(map[string]any{"id": "a"}),
			newRemoteJoinArgument(map[string]any{"id": "b"}),
		},
	}

	t.Run("results aligned by alias order", func(t *testing.T) {
		t.Parallel()

		response := map[string]any{
			"_0": map[string]any{"name": "First"},
			"_1": map[string]any{"name": "Second"},
		}

		got := sr.ExtractResults(rq, response)

		want := []any{
			map[string]any{"name": "First"},
			map[string]any{"name": "Second"},
		}
		if diff := cmp.Diff(want, got); diff != "" {
			t.Errorf("results mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("non-map response returns nil", func(t *testing.T) {
		t.Parallel()

		if got := sr.ExtractResults(rq, "not a map"); got != nil {
			t.Errorf("expected nil, got %+v", got)
		}
	})

	t.Run("missing alias returns nil entry", func(t *testing.T) {
		t.Parallel()

		response := map[string]any{
			"_0": map[string]any{"name": "Only"},
		}

		got := sr.ExtractResults(rq, response)
		if len(got) != 2 {
			t.Fatalf("expected 2 entries, got %d", len(got))
		}

		if got[1] != nil {
			t.Errorf("expected nil for missing _1, got %+v", got[1])
		}
	})
}

func TestSchemaResolverBuildResultLookupAndJoinKey(t *testing.T) {
	t.Parallel()

	sr := newSchemaResolver([]string{"id"}, nil)

	rq := &remoteQuery{
		resolver: sr,
		joinArguments: []*remoteJoinArgument{
			newRemoteJoinArgument(map[string]any{"id": "u1"}),
			newRemoteJoinArgument(map[string]any{"id": "u2"}),
		},
	}

	t.Run("lookup keyed by join argument value", func(t *testing.T) {
		t.Parallel()

		results := []any{
			map[string]any{"name": "Alice"},
			map[string]any{"name": "Bob"},
		}

		got := sr.BuildResultLookup(rq, results)

		assertSingleNamedResult(t, got, "u1", "Alice")
		assertSingleNamedResult(t, got, "u2", "Bob")
	})

	t.Run("nil result entry is skipped", func(t *testing.T) {
		t.Parallel()

		results := []any{
			map[string]any{"name": "Alice"},
			nil,
		}

		got := sr.BuildResultLookup(rq, results)
		if _, exists := got["u2"]; exists {
			t.Error("expected no entry under 'u2' when result is nil")
		}
	})

	t.Run("parent join key matches lookup key", func(t *testing.T) {
		t.Parallel()

		key := sr.GetJoinKeyFromParent(rq, map[string]any{"id": "u1"})
		if key != "u1" {
			t.Errorf("expected 'u1', got %q", key)
		}
	})
}

func selectionFieldNames(set ast.SelectionSet) []string {
	out := make([]string, 0, len(set))

	for _, sel := range set {
		if f, ok := sel.(*ast.Field); ok {
			out = append(out, f.Name)
		}
	}

	return out
}

// assertSingleNamedResult checks that lookup[key] contains exactly one
// result map whose "name" field equals wantName.
func assertSingleNamedResult(t *testing.T, lookup map[string][]any, key, wantName string) {
	t.Helper()

	entries, ok := lookup[key]
	if !ok || len(entries) != 1 {
		t.Errorf("expected single entry under %q, got %+v", key, entries)
		return
	}

	row, ok := entries[0].(map[string]any)
	if !ok {
		t.Errorf("expected entry under %q to be map, got %T", key, entries[0])
		return
	}

	if row["name"] != wantName {
		t.Errorf("expected name %q under %q, got %v", wantName, key, row["name"])
	}
}
