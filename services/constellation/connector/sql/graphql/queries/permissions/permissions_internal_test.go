package permissions

import (
	"errors"
	"strconv"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// fakeTable is a stub permissions.Table used by the FixColumns / FixExists
// tests. It exposes column / relationship / sibling-table lookups against
// fixed maps so test cases can declare expected shape inline without dragging
// in the parent package's *table.
//
// parseWhere is an optional override for the ParseWhere delegate; when nil,
// ParseWhere returns (nil, nil) so column-fix tests don't need to care.
type fakeTable struct {
	name          string
	columns       map[string]*core.Column
	relationships map[string]*fakeRelationship
	siblings      map[string]*fakeTable
	parseWhere    func(*ast.Value) (where.Clause, error)
}

func (f *fakeTable) Name() string { return f.name }

func (f *fakeTable) ColumnFromSQLName(name string) *core.Column {
	return f.columns[name]
}

func (f *fakeTable) LookupRelationship(name string) Relationship {
	r, ok := f.relationships[name]
	if !ok {
		return nil
	}

	return r
}

func (f *fakeTable) SiblingTable(schema, name string) Table {
	other, ok := f.siblings[schema+"."+name]
	if !ok {
		return nil
	}

	return other
}

func (f *fakeTable) ParseWhere(
	v *ast.Value,
	_ map[string]any,
	_ string,
	_ map[string]any,
	_ int,
	_ where.Aliases,
) (where.Clause, error) {
	if f.parseWhere == nil {
		return nil, nil
	}

	return f.parseWhere(v)
}

type fakeRelationship struct {
	name   string
	target *fakeTable
}

func (r *fakeRelationship) Name() string { return r.name }

func (r *fakeRelationship) LookupTarget() Table {
	if r.target == nil {
		return nil
	}

	return r.target
}

func TestSubstituteSessionVariable(t *testing.T) {
	t.Parallel()

	sessionVars := map[string]any{
		"x-hasura-user-id": "42",
		"x-hasura-role":    "user",
	}

	tests := []struct {
		name    string
		in      any
		want    any
		wantErr error
	}{
		{
			name: "literal string passthrough",
			in:   "plain-string",
			want: "plain-string",
		},
		{
			name: "session variable substituted",
			in:   "x-hasura-user-id",
			want: "42",
		},
		{
			name:    "mixed case is recognised by prefix but lookup uses raw key",
			in:      "X-Hasura-User-Id",
			wantErr: ErrSessionVariableNotFound,
		},
		{
			name:    "missing session variable returns error",
			in:      "x-hasura-missing",
			wantErr: ErrSessionVariableNotFound,
		},
		{
			name: "non-string passthrough int",
			in:   123,
			want: 123,
		},
		{
			name: "slice flattens to substituted scalar when match found",
			in:   []any{"x-hasura-user-id"},
			want: "42",
		},
		{
			name: "slice without session vars stays as slice",
			in:   []any{"a", "b"},
			want: []any{"a", "b"},
		},
		{
			// Regression for the silent-literal-drop bug: a multi-element
			// slice mixing a session-variable marker and a literal must
			// substitute the marker in place and keep the literal.
			name: "multi-element slice mixes session var and literal",
			in:   []any{"x-hasura-user-id", "alice"},
			want: []any{"42", "alice"},
		},
		{
			// Regression for the uncomparable-interface panic: a []any
			// containing nested []any elements must not panic. Each nested
			// slice recurses element-wise and stays a slice.
			name: "slice of nested slices does not panic",
			in:   []any{[]any{"a", "b"}, []any{"c"}},
			want: []any{[]any{"a", "b"}, []any{"c"}},
		},
		{
			// Single-element outer slice whose lone element is itself a
			// []any: the outer slice must not flatten because the element
			// is not a session-variable marker string. The inner slice
			// flattens on its own recursion to the scalar "42".
			name: "single-element slice of nested slice substitutes in place",
			in:   []any{[]any{"x-hasura-user-id"}},
			want: []any{"42"},
		},
		{
			// Multi-element slice of session-variable markers must
			// substitute every element rather than flatten to the first.
			name: "multi-element slice of session vars substitutes every element",
			in:   []any{"x-hasura-user-id", "x-hasura-role"},
			want: []any{"42", "user"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := SubstituteSessionVariable(tc.in, sessionVars)
			if tc.wantErr != nil {
				if !errors.Is(err, tc.wantErr) {
					t.Fatalf("err = %v, want errors.Is %v", err, tc.wantErr)
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if diff := cmp.Diff(tc.want, got); diff != "" {
				t.Errorf("SubstituteSessionVariable mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestNormalizePresets(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		in   map[string]any
		want map[string]any
	}{
		{
			name: "empty",
			in:   map[string]any{},
			want: map[string]any{},
		},
		{
			name: "lowers x-hasura prefix in values",
			in:   map[string]any{"user_id": "X-Hasura-User-Id", "role": "X-HASURA-ROLE"},
			want: map[string]any{"user_id": "x-hasura-user-id", "role": "x-hasura-role"},
		},
		{
			name: "preserves literal non-session values",
			in:   map[string]any{"flag": true, "count": 7, "name": "plain"},
			want: map[string]any{"flag": true, "count": 7, "name": "plain"},
		},
		{
			name: "mixed literals and session variables",
			in:   map[string]any{"user_id": "X-Hasura-User-Id", "active": true},
			want: map[string]any{"user_id": "x-hasura-user-id", "active": true},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := normalizePresets(tc.in)
			if diff := cmp.Diff(tc.want, got); diff != "" {
				t.Errorf("normalizePresets mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestFixValue(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		in   any
		want any
	}{
		{
			name: "string with x-hasura prefix is lowered",
			in:   "X-Hasura-User-Id",
			want: "x-hasura-user-id",
		},
		{
			name: "plain string passthrough",
			in:   "alice",
			want: "alice",
		},
		{
			name: "non-string passthrough",
			in:   42,
			want: 42,
		},
		{
			name: "nested map: session var lowered in place",
			in:   map[string]any{"_eq": "X-Hasura-User-Id"},
			want: map[string]any{"_eq": "x-hasura-user-id"},
		},
		{
			name: "slice: session var lowered in place",
			in:   []any{"X-Hasura-User-Id", "plain"},
			want: []any{"x-hasura-user-id", "plain"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := fixValue(tc.in)
			if diff := cmp.Diff(tc.want, got); diff != "" {
				t.Errorf("fixValue mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestFixColumns_ColumnNotFound(t *testing.T) {
	t.Parallel()

	tr := &fakeTable{name: "users"}

	_, err := fixColumns(tr, map[string]any{"unknown": map[string]any{"_eq": 1}})
	if err == nil {
		t.Fatal("expected error for unknown column, got nil")
	}
}

func TestFixColumns_RenamesSQLToGraphQL(t *testing.T) {
	t.Parallel()

	tr := &fakeTable{
		name: "users",
		columns: map[string]*core.Column{
			"user_id": {SQLName: "user_id", GraphqlName: "userID", SQLType: "uuid"},
		},
	}

	got, err := fixColumns(tr, map[string]any{
		"user_id": map[string]any{"_eq": "X-Hasura-User-Id"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	want := map[string]any{
		"userID": map[string]any{"_eq": "x-hasura-user-id"},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("fixColumns mismatch (-want +got):\n%s", diff)
	}
}

// TestFixColumns_TopLevelComparison exercises fixComparison via the
// fixColumns dispatch table. The helper is reached when a permission map's
// top-level key is itself a comparison operator (e.g. an _and child whose
// shape is {"_eq": "<value>"} rather than {"col": {"_eq": "<value>"}}). Its
// only side effect is lowercasing an "x-hasura-*" RHS string; literals pass
// through untouched.
func TestFixColumns_TopLevelComparison(t *testing.T) {
	t.Parallel()

	tr := &fakeTable{name: "users"}

	tests := []struct {
		name string
		in   map[string]any
		want map[string]any
	}{
		{
			name: "x-hasura RHS lowercased",
			in:   map[string]any{"_eq": "X-Hasura-User-Id"},
			want: map[string]any{"_eq": "x-hasura-user-id"},
		},
		{
			name: "literal RHS passthrough",
			in:   map[string]any{"_neq": "alice"},
			want: map[string]any{"_neq": "alice"},
		},
		{
			name: "non-string RHS passthrough",
			in:   map[string]any{"_gt": 42},
			want: map[string]any{"_gt": 42},
		},
		{
			name: "non-x-hasura-prefixed string passthrough",
			in:   map[string]any{"_like": "x-other-marker"},
			want: map[string]any{"_like": "x-other-marker"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := fixColumns(tr, tc.in)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if diff := cmp.Diff(tc.want, got); diff != "" {
				t.Errorf("fixColumns mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

// TestFixColumns_Relationship exercises fixRelationship via the fixColumns
// dispatch table. A relationship key dispatches to fixRelationship, which
// recursively fixes the nested permission map against the target table's
// columns and rewrites SQL→GraphQL names.
func TestFixColumns_Relationship(t *testing.T) {
	t.Parallel()

	target := &fakeTable{
		name: "posts",
		columns: map[string]*core.Column{
			"author_id": {SQLName: "author_id", GraphqlName: "authorID", SQLType: "uuid"},
		},
	}

	t.Run("happy path: nested where rewritten against relationship target", func(t *testing.T) {
		t.Parallel()

		tr := &fakeTable{
			name: "users",
			relationships: map[string]*fakeRelationship{
				"posts": {name: "posts", target: target},
			},
		}

		got, err := fixColumns(tr, map[string]any{
			"posts": map[string]any{
				"author_id": map[string]any{"_eq": "X-Hasura-User-Id"},
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		want := map[string]any{
			"posts": map[string]any{
				"authorID": map[string]any{"_eq": "x-hasura-user-id"},
			},
		}
		if diff := cmp.Diff(want, got); diff != "" {
			t.Errorf("fixColumns mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("non-map relationship value errors", func(t *testing.T) {
		t.Parallel()

		tr := &fakeTable{
			name: "users",
			relationships: map[string]*fakeRelationship{
				"posts": {name: "posts", target: target},
			},
		}

		_, err := fixColumns(tr, map[string]any{"posts": "not-a-map"})
		if err == nil {
			t.Fatal("expected error for non-map relationship value, got nil")
		}

		if !strings.Contains(err.Error(), "expected map for relationship permission posts") {
			t.Errorf("error missing relationship-name context: %v", err)
		}
	})

	t.Run("nil LookupTarget errors", func(t *testing.T) {
		t.Parallel()

		tr := &fakeTable{
			name: "users",
			relationships: map[string]*fakeRelationship{
				// target nil -> LookupTarget returns nil Table interface
				"remote_posts": {name: "remote_posts", target: nil},
			},
		}

		_, err := fixColumns(tr, map[string]any{
			"remote_posts": map[string]any{},
		})
		if err == nil {
			t.Fatal("expected error for nil relationship target, got nil")
		}

		if !strings.Contains(err.Error(), "relationship remote_posts has no local target table") {
			t.Errorf("error missing nil-target context: %v", err)
		}
	})

	t.Run("nested fix error wrapped with relationship name", func(t *testing.T) {
		t.Parallel()

		tr := &fakeTable{
			name: "users",
			relationships: map[string]*fakeRelationship{
				"posts": {name: "posts", target: target},
			},
		}

		// "unknown" is not a column on the posts target, so fixColumns inside
		// fixRelationship fails and the error is wrapped with the
		// relationship name.
		_, err := fixColumns(tr, map[string]any{
			"posts": map[string]any{"unknown": map[string]any{"_eq": 1}},
		})
		if err == nil {
			t.Fatal("expected error for unknown column in relationship, got nil")
		}

		if !strings.Contains(err.Error(),
			"failed to fix permission columns for relationship posts") {
			t.Errorf("error missing relationship-name wrap: %v", err)
		}
	})
}

// TestFixColumns_ExistsEntry exercises fixExistsEntry via fixColumns. The
// helper is a thin wrapper over fixExists that re-keys the result under
// "_exists" and adds wrapping on error.
func TestFixColumns_ExistsEntry(t *testing.T) {
	t.Parallel()

	sibling := &fakeTable{
		name: "posts",
		columns: map[string]*core.Column{
			"author_id": {SQLName: "author_id", GraphqlName: "authorID", SQLType: "uuid"},
		},
	}

	t.Run("happy path: _exists nested where rewritten and re-keyed", func(t *testing.T) {
		t.Parallel()

		tr := &fakeTable{
			name:     "users",
			siblings: map[string]*fakeTable{"public.posts": sibling},
		}

		got, err := fixColumns(tr, map[string]any{
			"_exists": map[string]any{
				"_table": map[string]any{"schema": "public", "name": "posts"},
				"_where": map[string]any{
					"author_id": map[string]any{"_eq": "X-Hasura-User-Id"},
				},
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		want := map[string]any{
			"_exists": map[string]any{
				"_table": map[string]any{"schema": "public", "name": "posts"},
				"_where": map[string]any{
					"authorID": map[string]any{"_eq": "x-hasura-user-id"},
				},
			},
		}
		if diff := cmp.Diff(want, got); diff != "" {
			t.Errorf("fixColumns mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("nested fix error wrapped with _exists prefix", func(t *testing.T) {
		t.Parallel()

		tr := &fakeTable{name: "users"} // no siblings configured

		_, err := fixColumns(tr, map[string]any{
			"_exists": map[string]any{
				"_table": map[string]any{"schema": "public", "name": "ghosts"},
				"_where": map[string]any{},
			},
		})
		if err == nil {
			t.Fatal("expected error for missing sibling, got nil")
		}

		if !strings.Contains(err.Error(), "failed to fix _exists permission columns") {
			t.Errorf("error missing _exists wrap prefix: %v", err)
		}
	})
}

func TestFixColumns_LogicalOperators(t *testing.T) {
	t.Parallel()

	tr := &fakeTable{
		name: "users",
		columns: map[string]*core.Column{
			"id": {SQLName: "id", GraphqlName: "id", SQLType: "uuid"},
		},
	}

	t.Run("_and with valid leaf", func(t *testing.T) {
		t.Parallel()

		_, err := fixColumns(tr, map[string]any{
			"_and": []any{
				map[string]any{"id": map[string]any{"_eq": "X-Hasura-User-Id"}},
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})

	t.Run("_or with non-list value errors", func(t *testing.T) {
		t.Parallel()

		_, err := fixColumns(tr, map[string]any{"_or": "not-a-list"})
		if err == nil {
			t.Fatal("expected error for non-list _or, got nil")
		}
	})

	t.Run("_not with non-map value errors", func(t *testing.T) {
		t.Parallel()

		_, err := fixColumns(tr, map[string]any{"_not": "not-a-map"})
		if err == nil {
			t.Fatal("expected error for non-map _not, got nil")
		}
	})
}

func TestReferencesGeneratedColumns(t *testing.T) {
	t.Parallel()

	lookup := func(name string) *core.Column {
		switch name {
		case "id":
			return &core.Column{SQLName: "id", IsGenerated: true}
		case "user_id":
			return &core.Column{SQLName: "user_id", IsGenerated: false}
		default:
			return nil
		}
	}

	t.Run("no insert permission for role", func(t *testing.T) {
		t.Parallel()

		s := NewStore()
		if s.ReferencesGeneratedColumns("user", lookup) {
			t.Fatal("expected false when role has no insert permission")
		}
	})
}

func TestExtendInsertColumns_NoPermission(t *testing.T) {
	t.Parallel()

	lookup := func(string) *core.Column { return nil }

	s := NewStore()
	in := []string{"a", "b"}

	got := s.ExtendInsertColumns(in, "user", lookup)
	if diff := cmp.Diff(in, got); diff != "" {
		t.Errorf(
			"ExtendInsertColumns should return input unchanged when no permission (-want +got):\n%s",
			diff,
		)
	}
}

func TestMissingInsertColumns_NoPermission(t *testing.T) {
	t.Parallel()

	s := NewStore()

	got := s.MissingInsertColumns(
		"user",
		map[string]struct{}{},
		func(string) *core.Column { return nil },
	)
	if got != nil {
		t.Errorf("MissingInsertColumns should return nil when no permission, got %v", got)
	}
}

func TestStoreWriteRowLevel_NoPermission(t *testing.T) {
	t.Parallel()

	s := NewStore()

	params, paramIndex, err := s.WriteRowLevel(nil, []any{"keep"}, 1, "user", nil, "src")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if paramIndex != 1 {
		t.Errorf("paramIndex = %d, want 1", paramIndex)
	}

	if diff := cmp.Diff([]any{"keep"}, params); diff != "" {
		t.Errorf("params mismatch (-want +got):\n%s", diff)
	}
}

func TestStoreWriteUpdateFilter_NoPermission_ReturnsFalse(t *testing.T) {
	t.Parallel()

	s := NewStore()

	_, _, written, err := s.WriteUpdateFilter(nil, nil, 0, "user", nil, "src")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if written {
		t.Error("expected written=false when role has no update permission")
	}
}

func TestStoreWriteDeleteFilter_NoPermission_ReturnsFalse(t *testing.T) {
	t.Parallel()

	s := NewStore()

	_, _, written, err := s.WriteDeleteFilter(nil, nil, 0, "user", nil, "src")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if written {
		t.Error("expected written=false when role has no delete permission")
	}
}

// stubStatement is a where.Statement whose WriteCondition is configured per
// test. It lets the Write{RowLevel,UpdateFilter,DeleteFilter,InsertCheck}
// with-permission tests drive a known SQL fragment and exercise the
// session-variable substitution that runs *after* WriteCondition.
type stubStatement struct {
	write func(*strings.Builder, string, []any, int) ([]any, int, error)
}

func (s *stubStatement) WriteCondition(
	b *strings.Builder, source string, params []any, paramIndex int,
) ([]any, int, error) {
	return s.write(b, source, params, paramIndex)
}

// appendParamStatement returns a stubStatement that writes
// `<source>.col = $<paramIndex>` and appends value to params. It's the
// simplest "real-shaped" statement we can drop into a Clause for the Write*
// tests without dragging in dialect plumbing.
func appendParamStatement(col string, value any) *stubStatement {
	return &stubStatement{
		write: func(
			b *strings.Builder, source string, params []any, paramIndex int,
		) ([]any, int, error) {
			b.WriteString(source)
			b.WriteString(".")
			b.WriteString(col)
			b.WriteString(" = $")
			b.WriteString(strconv.Itoa(paramIndex))

			return append(params, value), paramIndex + 1, nil
		},
	}
}

// errStatement is the failure counterpart to stubStatement: WriteCondition
// always returns the given error. Used to exercise the Write{RowLevel,
// UpdateFilter,DeleteFilter,InsertCheck} clause-error wrap paths.
func errStatement(err error) *stubStatement {
	return &stubStatement{
		write: func(
			*strings.Builder, string, []any, int,
		) ([]any, int, error) {
			return nil, 0, err
		},
	}
}

func TestFixExists(t *testing.T) {
	t.Parallel()

	sibling := &fakeTable{
		name: "posts",
		columns: map[string]*core.Column{
			"author_id": {SQLName: "author_id", GraphqlName: "authorID", SQLType: "uuid"},
		},
	}

	t.Run("happy path: nested where is fixed against sibling table", func(t *testing.T) {
		t.Parallel()

		tr := &fakeTable{
			name:     "users",
			siblings: map[string]*fakeTable{"public.posts": sibling},
		}

		got, err := fixExists(tr, map[string]any{
			"_table": map[string]any{"schema": "public", "name": "posts"},
			"_where": map[string]any{
				"author_id": map[string]any{"_eq": "X-Hasura-User-Id"},
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		want := map[string]any{
			"_table": map[string]any{"schema": "public", "name": "posts"},
			"_where": map[string]any{
				"authorID": map[string]any{"_eq": "x-hasura-user-id"},
			},
		}
		if diff := cmp.Diff(want, got); diff != "" {
			t.Errorf("fixExists mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("non-map value errors", func(t *testing.T) {
		t.Parallel()

		_, err := fixExists(&fakeTable{}, "not-a-map")
		if err == nil {
			t.Fatal("expected error for non-map _exists value, got nil")
		}
	})

	t.Run("missing _table errors", func(t *testing.T) {
		t.Parallel()

		_, err := fixExists(&fakeTable{}, map[string]any{
			"_where": map[string]any{},
		})
		if err == nil {
			t.Fatal("expected error for missing _table, got nil")
		}
	})

	t.Run("non-string schema errors", func(t *testing.T) {
		t.Parallel()

		_, err := fixExists(&fakeTable{}, map[string]any{
			"_table": map[string]any{"schema": 1, "name": "posts"},
			"_where": map[string]any{},
		})
		if err == nil {
			t.Fatal("expected error for non-string schema, got nil")
		}
	})

	t.Run("non-string name errors", func(t *testing.T) {
		t.Parallel()

		_, err := fixExists(&fakeTable{}, map[string]any{
			"_table": map[string]any{"schema": "public", "name": 1},
			"_where": map[string]any{},
		})
		if err == nil {
			t.Fatal("expected error for non-string name, got nil")
		}
	})

	t.Run("missing _where errors", func(t *testing.T) {
		t.Parallel()

		_, err := fixExists(&fakeTable{}, map[string]any{
			"_table": map[string]any{"schema": "public", "name": "posts"},
		})
		if err == nil {
			t.Fatal("expected error for missing _where, got nil")
		}
	})

	t.Run("sibling table not found errors", func(t *testing.T) {
		t.Parallel()

		tr := &fakeTable{name: "users"}

		_, err := fixExists(tr, map[string]any{
			"_table": map[string]any{"schema": "public", "name": "ghosts"},
			"_where": map[string]any{},
		})
		if err == nil {
			t.Fatal("expected error for missing sibling table, got nil")
		}
	})

	t.Run("unknown column in _where propagates error", func(t *testing.T) {
		t.Parallel()

		tr := &fakeTable{
			name:     "users",
			siblings: map[string]*fakeTable{"public.posts": sibling},
		}

		_, err := fixExists(tr, map[string]any{
			"_table": map[string]any{"schema": "public", "name": "posts"},
			"_where": map[string]any{"unknown": map[string]any{"_eq": 1}},
		})
		if err == nil {
			t.Fatal("expected error for unknown column in _where, got nil")
		}
	})
}

// TestInitialize covers Initialize end-to-end: that fixColumns + ParseWhere
// run for each kind, that the returned clause lands in the right map under
// the right role, and that Set presets are normalised into
// Insert/UpdatePresets.
func TestInitialize(t *testing.T) {
	t.Parallel()

	selectClause := where.Clause{appendParamStatement("user_id", "x-hasura-user-id")}
	insertClause := where.Clause{appendParamStatement("user_id", "x-hasura-user-id")}
	updateClause := where.Clause{appendParamStatement("user_id", "x-hasura-user-id")}
	updateCheckClause := where.Clause{appendParamStatement("user_id", "x-hasura-user-id")}
	deleteClause := where.Clause{appendParamStatement("user_id", "x-hasura-user-id")}

	parseCalls := []*ast.Value{}

	// Returned clauses are picked by call order so each kind ends up in its
	// own Store map and we can assert per-map identity below. Initialize parses
	// the update filter and the update check separately, so the update kind
	// consumes two entries here (filter then check).
	clauses := []where.Clause{
		selectClause,
		insertClause,
		updateClause,
		updateCheckClause,
		deleteClause,
	}

	tr := &fakeTable{
		name: "users",
		columns: map[string]*core.Column{
			"user_id": {SQLName: "user_id", GraphqlName: "userID", SQLType: "uuid"},
		},
		parseWhere: func(v *ast.Value) (where.Clause, error) {
			parseCalls = append(parseCalls, v)
			c := clauses[0]
			clauses = clauses[1:]

			return c, nil
		},
	}

	md := metadata.TableMetadata{
		SelectPermissions: []metadata.SelectPermission{
			{
				Role: "user",
				Permission: metadata.SelectPermissionConfig{
					Filter: map[string]any{
						"user_id": map[string]any{"_eq": "X-Hasura-User-Id"},
					},
				},
			},
		},
		InsertPermissions: []metadata.InsertPermission{
			{
				Role: "user",
				Permission: metadata.InsertPermissionConfig{
					Check: map[string]any{
						"user_id": map[string]any{"_eq": "X-Hasura-User-Id"},
					},
					Set: map[string]any{"user_id": "X-Hasura-User-Id"},
				},
			},
		},
		UpdatePermissions: []metadata.UpdatePermission{
			{
				Role: "user",
				Permission: metadata.UpdatePermissionConfig{
					Filter: map[string]any{
						"user_id": map[string]any{"_eq": "X-Hasura-User-Id"},
					},
					Check: map[string]any{
						"user_id": map[string]any{"_eq": "X-Hasura-User-Id"},
					},
					Set: map[string]any{"user_id": "X-Hasura-User-Id"},
				},
			},
		},
		DeletePermissions: []metadata.DeletePermission{
			{
				Role: "user",
				Permission: metadata.DeletePermissionConfig{
					Filter: map[string]any{
						"user_id": map[string]any{"_eq": "X-Hasura-User-Id"},
					},
				},
			},
		},
	}

	s := NewStore()
	if err := Initialize(tr, s, md); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(parseCalls) != 5 {
		t.Fatalf("ParseWhere called %d times, want 5", len(parseCalls))
	}

	if got, want := len(s.Select["user"]), len(selectClause); got != want {
		t.Errorf("Select[user] length = %d, want %d", got, want)
	}

	if got, want := len(s.Insert["user"]), len(insertClause); got != want {
		t.Errorf("Insert[user] length = %d, want %d", got, want)
	}

	if got, want := len(s.Update["user"]), len(updateClause); got != want {
		t.Errorf("Update[user] length = %d, want %d", got, want)
	}

	if got, want := len(s.UpdateCheck["user"]), len(updateCheckClause); got != want {
		t.Errorf("UpdateCheck[user] length = %d, want %d", got, want)
	}

	if got, want := len(s.Delete["user"]), len(deleteClause); got != want {
		t.Errorf("Delete[user] length = %d, want %d", got, want)
	}

	wantPresets := map[string]any{"user_id": "x-hasura-user-id"}
	if diff := cmp.Diff(wantPresets, s.InsertPresets["user"]); diff != "" {
		t.Errorf("InsertPresets mismatch (-want +got):\n%s", diff)
	}

	if diff := cmp.Diff(wantPresets, s.UpdatePresets["user"]); diff != "" {
		t.Errorf("UpdatePresets mismatch (-want +got):\n%s", diff)
	}
}

func TestInitialize_NoSetSkipsPresets(t *testing.T) {
	t.Parallel()

	tr := &fakeTable{
		name:    "users",
		columns: map[string]*core.Column{"id": {SQLName: "id", GraphqlName: "id"}},
		parseWhere: func(_ *ast.Value) (where.Clause, error) {
			return where.Clause{appendParamStatement("id", 1)}, nil
		},
	}

	md := metadata.TableMetadata{
		InsertPermissions: []metadata.InsertPermission{
			{
				Role:       "user",
				Permission: metadata.InsertPermissionConfig{Check: map[string]any{}},
			},
		},
		UpdatePermissions: []metadata.UpdatePermission{
			{
				Role:       "user",
				Permission: metadata.UpdatePermissionConfig{Filter: map[string]any{}},
			},
		},
	}

	s := NewStore()
	if err := Initialize(tr, s, md); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if _, ok := s.InsertPresets["user"]; ok {
		t.Errorf("InsertPresets[user] set when Set was empty")
	}

	if _, ok := s.UpdatePresets["user"]; ok {
		t.Errorf("UpdatePresets[user] set when Set was empty")
	}
}

// mdForKind builds a TableMetadata with a single permission entry of the
// given kind, role, and filter map. The tests below use it to keep one copy
// of the four-kind cross-product instead of repeating the per-kind struct
// literal in every wrap-path test.
func mdForKind(kind, role string, filter map[string]any) metadata.TableMetadata {
	switch kind {
	case "select":
		return metadata.TableMetadata{
			SelectPermissions: []metadata.SelectPermission{{
				Role:       role,
				Permission: metadata.SelectPermissionConfig{Filter: filter},
			}},
		}
	case "insert":
		return metadata.TableMetadata{
			InsertPermissions: []metadata.InsertPermission{{
				Role:       role,
				Permission: metadata.InsertPermissionConfig{Check: filter},
			}},
		}
	case "update":
		return metadata.TableMetadata{
			UpdatePermissions: []metadata.UpdatePermission{{
				Role:       role,
				Permission: metadata.UpdatePermissionConfig{Filter: filter},
			}},
		}
	case "delete":
		return metadata.TableMetadata{
			DeletePermissions: []metadata.DeletePermission{{
				Role:       role,
				Permission: metadata.DeletePermissionConfig{Filter: filter},
			}},
		}
	default:
		panic("unknown permission kind: " + kind)
	}
}

func TestInitialize_ErrorsAreWrappedPerKind(t *testing.T) {
	t.Parallel()

	// Unknown column triggers fixColumns to fail, which is wrapped with the
	// kind name. We check the wrapping for each kind so a future change to
	// parsePermissionFilter that drops the kind interpolation would surface
	// here.
	for _, kind := range []string{"select", "insert", "update", "delete"} {
		t.Run(kind, func(t *testing.T) {
			t.Parallel()

			tr := &fakeTable{name: "users"}
			md := mdForKind(kind, "user", map[string]any{
				"unknown": map[string]any{"_eq": 1},
			})

			err := Initialize(tr, NewStore(), md)
			if err == nil {
				t.Fatal("expected error, got nil")
			}

			if !strings.Contains(err.Error(), kind+" permission columns") ||
				!strings.Contains(err.Error(), "role user") {
				t.Errorf(
					"error missing kind %q or role context: %v", kind, err,
				)
			}
		})
	}
}

// TestInitialize_GoValueToASTErrorsAreWrappedPerKind forces the
// values.GoValueToAST branch of parsePermissionFilter by feeding an
// unsupported Go value type (chan int) as a column leaf. fixColumns/fixValue
// pass scalars through unchanged, so the unsupported type survives until
// GoValueToAST rejects it. Each kind must wrap with
// "failed to convert <kind> permission filter to AST for role <role>" so a
// refactor that drops the kind/role interpolation surfaces here.
func TestInitialize_GoValueToASTErrorsAreWrappedPerKind(t *testing.T) {
	t.Parallel()

	for _, kind := range []string{"select", "insert", "update", "delete"} {
		t.Run(kind, func(t *testing.T) {
			t.Parallel()

			tr := &fakeTable{
				name: "users",
				columns: map[string]*core.Column{
					"user_id": {SQLName: "user_id", GraphqlName: "userID", SQLType: "uuid"},
				},
			}
			md := mdForKind(kind, "user", map[string]any{
				// chan int is an unsupported Go value type for GoValueToAST,
				// but fixColumns/fixValue pass scalars through unchanged so it
				// reaches the AST conversion step intact.
				"user_id": map[string]any{"_eq": make(chan int)},
			})

			err := Initialize(tr, NewStore(), md)
			if err == nil {
				t.Fatal("expected error, got nil")
			}

			wantPrefix := "failed to convert " + kind + " permission filter to AST"
			if !strings.Contains(err.Error(), wantPrefix) ||
				!strings.Contains(err.Error(), "role user") {
				t.Errorf(
					"error missing AST-conversion prefix or role context for kind %q: %v",
					kind, err,
				)
			}
		})
	}
}

// TestInitialize_ParseWhereErrorsAreWrappedPerKind stubs out
// fakeTable.parseWhere so it returns an error, forcing parsePermissionFilter
// into the third (and last) wrap branch. The wrapping must carry the kind and
// role.
func TestInitialize_ParseWhereErrorsAreWrappedPerKind(t *testing.T) {
	t.Parallel()

	sentinel := errors.New("boom") //nolint:err113 // test sentinel

	for _, kind := range []string{"select", "insert", "update", "delete"} {
		t.Run(kind, func(t *testing.T) {
			t.Parallel()

			tr := &fakeTable{
				name: "users",
				columns: map[string]*core.Column{
					"user_id": {SQLName: "user_id", GraphqlName: "userID", SQLType: "uuid"},
				},
				parseWhere: func(*ast.Value) (where.Clause, error) { return nil, sentinel },
			}
			md := mdForKind(kind, "user", map[string]any{
				"user_id": map[string]any{"_eq": "X-Hasura-User-Id"},
			})

			err := Initialize(tr, NewStore(), md)
			if err == nil {
				t.Fatal("expected error, got nil")
			}

			if !errors.Is(err, sentinel) {
				t.Errorf("expected wrapped sentinel error, got %v", err)
			}

			wantPrefix := "failed to parse " + kind + " permission filter for role user"
			if !strings.Contains(err.Error(), wantPrefix) {
				t.Errorf(
					"error missing parse prefix/role for kind %q: %v", kind, err,
				)
			}
		})
	}
}

func TestStoreWriteInsertCheck_NoPermission_WritesTrue(t *testing.T) {
	t.Parallel()

	s := NewStore()

	var b strings.Builder

	params, paramIndex, hasCheck, err := s.WriteInsertCheck(
		&b, "user", nil, []any{"keep"}, 7, "src",
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if hasCheck {
		t.Error("expected hasCheck=false when role has no insert permission")
	}

	if b.String() != "true" {
		t.Errorf("builder = %q, want \"true\"", b.String())
	}

	if paramIndex != 7 {
		t.Errorf("paramIndex = %d, want 7 (unchanged)", paramIndex)
	}

	if diff := cmp.Diff([]any{"keep"}, params); diff != "" {
		t.Errorf("params mismatch (-want +got):\n%s", diff)
	}
}

func TestStoreWriteInsertCheck_WithPermission_RendersClause(t *testing.T) {
	t.Parallel()

	s := NewStore()
	s.Insert["user"] = where.Clause{appendParamStatement("user_id", "x-hasura-user-id")}

	var b strings.Builder

	sessionVars := map[string]any{"x-hasura-user-id": "42"}

	params, paramIndex, hasCheck, err := s.WriteInsertCheck(
		&b, "user", sessionVars, nil, 1, "data",
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !hasCheck {
		t.Fatal("expected hasCheck=true when role has insert permission")
	}

	if b.String() != "data.user_id = $1" {
		t.Errorf("builder = %q, want \"data.user_id = $1\"", b.String())
	}

	if paramIndex != 2 {
		t.Errorf("paramIndex = %d, want 2", paramIndex)
	}

	// Session-variable substitution happens *after* WriteCondition, so the
	// "x-hasura-user-id" marker placed in params should now be the resolved
	// session value.
	if diff := cmp.Diff([]any{"42"}, params); diff != "" {
		t.Errorf("params mismatch (-want +got):\n%s", diff)
	}
}

func TestStoreWriteInsertCheck_MissingSessionVariableErrors(t *testing.T) {
	t.Parallel()

	s := NewStore()
	s.Insert["user"] = where.Clause{appendParamStatement("user_id", "x-hasura-missing")}

	params, paramIndex, hasCheck, err := s.WriteInsertCheck(
		&strings.Builder{}, "user", map[string]any{}, nil, 1, "data",
	)
	if !errors.Is(err, ErrSessionVariableNotFound) {
		t.Fatalf("expected ErrSessionVariableNotFound, got %v", err)
	}

	if params != nil || paramIndex != 0 || hasCheck {
		t.Errorf(
			"on session-variable error want zero return values, got params=%v paramIndex=%d hasCheck=%v",
			params,
			paramIndex,
			hasCheck,
		)
	}
}

func TestStoreWriteUpdateCheck_NoPermission_WritesTrue(t *testing.T) {
	t.Parallel()

	s := NewStore()

	var b strings.Builder

	params, paramIndex, hasCheck, err := s.WriteUpdateCheck(
		&b, "user", nil, []any{"keep"}, 7, "src",
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if hasCheck {
		t.Error("expected hasCheck=false when role has no update check")
	}

	if b.String() != "true" {
		t.Errorf("builder = %q, want \"true\"", b.String())
	}

	if paramIndex != 7 {
		t.Errorf("paramIndex = %d, want 7 (unchanged)", paramIndex)
	}

	if diff := cmp.Diff([]any{"keep"}, params); diff != "" {
		t.Errorf("params mismatch (-want +got):\n%s", diff)
	}
}

func TestStoreWriteUpdateCheck_EmptyClause_WritesTrue(t *testing.T) {
	t.Parallel()

	// An empty clause (Hasura's `check: {}` / `check: null`) is treated as "no
	// post-update constraint": WriteUpdateCheck writes "true" and reports
	// hasCheck=false so callers skip the all-or-nothing CTE rather than emit an
	// empty WHERE.
	s := NewStore()
	s.UpdateCheck["user"] = where.Clause{}

	var b strings.Builder

	_, _, hasCheck, err := s.WriteUpdateCheck(&b, "user", nil, nil, 1, "src")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if hasCheck {
		t.Error("expected hasCheck=false for an empty update-check clause")
	}

	if b.String() != "true" {
		t.Errorf("builder = %q, want \"true\"", b.String())
	}
}

func TestStoreWriteUpdateCheck_WithPermission_RendersClause(t *testing.T) {
	t.Parallel()

	s := NewStore()
	s.UpdateCheck["user"] = where.Clause{appendParamStatement("user_id", "x-hasura-user-id")}

	var b strings.Builder

	sessionVars := map[string]any{"x-hasura-user-id": "42"}

	params, paramIndex, hasCheck, err := s.WriteUpdateCheck(
		&b, "user", sessionVars, nil, 1, "_mutation_result",
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !hasCheck {
		t.Fatal("expected hasCheck=true when role has a non-empty update check")
	}

	if b.String() != "_mutation_result.user_id = $1" {
		t.Errorf("builder = %q, want \"_mutation_result.user_id = $1\"", b.String())
	}

	if paramIndex != 2 {
		t.Errorf("paramIndex = %d, want 2", paramIndex)
	}

	// Session-variable substitution happens after WriteCondition, so the
	// "x-hasura-user-id" marker placed in params should now be the resolved
	// session value.
	if diff := cmp.Diff([]any{"42"}, params); diff != "" {
		t.Errorf("params mismatch (-want +got):\n%s", diff)
	}
}

func TestStoreWriteUpdateCheck_MissingSessionVariableErrors(t *testing.T) {
	t.Parallel()

	s := NewStore()
	s.UpdateCheck["user"] = where.Clause{appendParamStatement("user_id", "x-hasura-missing")}

	params, paramIndex, hasCheck, err := s.WriteUpdateCheck(
		&strings.Builder{}, "user", map[string]any{}, nil, 1, "_mutation_result",
	)
	if !errors.Is(err, ErrSessionVariableNotFound) {
		t.Fatalf("expected ErrSessionVariableNotFound, got %v", err)
	}

	if params != nil || paramIndex != 0 || hasCheck {
		t.Errorf(
			"on session-variable error want zero return values, got params=%v paramIndex=%d hasCheck=%v",
			params,
			paramIndex,
			hasCheck,
		)
	}
}

func TestStoreWriteUpdateCheck_ClauseError(t *testing.T) {
	t.Parallel()

	sentinel := errors.New("boom") //nolint:err113 // test sentinel

	s := NewStore()
	s.UpdateCheck["user"] = where.Clause{errStatement(sentinel)}

	params, paramIndex, hasCheck, err := s.WriteUpdateCheck(
		&strings.Builder{}, "user", nil, nil, 1, "_mutation_result",
	)
	if !errors.Is(err, sentinel) {
		t.Fatalf("expected wrapped sentinel error, got %v", err)
	}

	if params != nil || paramIndex != 0 || hasCheck {
		t.Errorf(
			"on clause error want zero return values, got params=%v paramIndex=%d hasCheck=%v",
			params,
			paramIndex,
			hasCheck,
		)
	}
}

func TestStoreWriteRowLevel_ClauseError(t *testing.T) {
	t.Parallel()

	sentinel := errors.New("boom") //nolint:err113 // test sentinel

	s := NewStore()
	s.Select["user"] = where.Clause{errStatement(sentinel)}

	params, paramIndex, err := s.WriteRowLevel(
		&strings.Builder{}, []any{"keep"}, 1, "user", nil, "t",
	)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	if !errors.Is(err, sentinel) {
		t.Errorf("expected wrapped sentinel error, got %v", err)
	}

	if !strings.Contains(err.Error(), "writing row-level permission clause") {
		t.Errorf("expected wrap prefix in error, got %v", err)
	}

	if params != nil || paramIndex != 0 {
		t.Errorf(
			"on clause error want zero return values, got params=%v paramIndex=%d",
			params, paramIndex,
		)
	}
}

func TestStoreWriteRowLevel_MissingSessionVariableErrors(t *testing.T) {
	t.Parallel()

	s := NewStore()
	s.Select["user"] = where.Clause{appendParamStatement("user_id", "x-hasura-missing")}

	params, paramIndex, err := s.WriteRowLevel(
		&strings.Builder{}, nil, 1, "user", map[string]any{}, "t",
	)
	if !errors.Is(err, ErrSessionVariableNotFound) {
		t.Fatalf("expected ErrSessionVariableNotFound, got %v", err)
	}

	if params != nil || paramIndex != 0 {
		t.Errorf(
			"on session-variable error want zero return values, got params=%v paramIndex=%d",
			params, paramIndex,
		)
	}
}

func TestStoreWriteRowLevel_WithPermission(t *testing.T) {
	t.Parallel()

	s := NewStore()
	s.Select["user"] = where.Clause{appendParamStatement("user_id", "x-hasura-user-id")}

	var b strings.Builder

	sessionVars := map[string]any{"x-hasura-user-id": "42"}

	params, paramIndex, err := s.WriteRowLevel(&b, nil, 1, "user", sessionVars, "t")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if b.String() != "t.user_id = $1" {
		t.Errorf("builder = %q, want \"t.user_id = $1\"", b.String())
	}

	if paramIndex != 2 {
		t.Errorf("paramIndex = %d, want 2", paramIndex)
	}

	if diff := cmp.Diff([]any{"42"}, params); diff != "" {
		t.Errorf("params mismatch (-want +got):\n%s", diff)
	}
}

func TestStoreWriteUpdateFilter_ClauseError(t *testing.T) {
	t.Parallel()

	sentinel := errors.New("boom") //nolint:err113 // test sentinel

	s := NewStore()
	s.Update["user"] = where.Clause{errStatement(sentinel)}

	params, paramIndex, written, err := s.WriteUpdateFilter(
		&strings.Builder{}, []any{"keep"}, 1, "user", nil, "t",
	)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	if !errors.Is(err, sentinel) {
		t.Errorf("expected wrapped sentinel error, got %v", err)
	}

	if !strings.Contains(err.Error(), "writing update permission clause") {
		t.Errorf("expected wrap prefix in error, got %v", err)
	}

	if params != nil || paramIndex != 0 || written {
		t.Errorf(
			"on clause error want zero return values, got params=%v paramIndex=%d written=%v",
			params, paramIndex, written,
		)
	}
}

func TestStoreWriteUpdateFilter_MissingSessionVariableErrors(t *testing.T) {
	t.Parallel()

	s := NewStore()
	s.Update["user"] = where.Clause{appendParamStatement("user_id", "x-hasura-missing")}

	params, paramIndex, written, err := s.WriteUpdateFilter(
		&strings.Builder{}, nil, 1, "user", map[string]any{}, "t",
	)
	if !errors.Is(err, ErrSessionVariableNotFound) {
		t.Fatalf("expected ErrSessionVariableNotFound, got %v", err)
	}

	if params != nil || paramIndex != 0 || written {
		t.Errorf(
			"on session-variable error want zero return values, got params=%v paramIndex=%d written=%v",
			params,
			paramIndex,
			written,
		)
	}
}

func TestStoreWriteUpdateFilter_WithPermission(t *testing.T) {
	t.Parallel()

	s := NewStore()
	s.Update["user"] = where.Clause{appendParamStatement("user_id", "x-hasura-user-id")}

	var b strings.Builder

	sessionVars := map[string]any{"x-hasura-user-id": "42"}

	params, paramIndex, written, err := s.WriteUpdateFilter(&b, nil, 1, "user", sessionVars, "t")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !written {
		t.Fatal("expected written=true when role has update permission")
	}

	if b.String() != "t.user_id = $1" {
		t.Errorf("builder = %q, want \"t.user_id = $1\"", b.String())
	}

	if paramIndex != 2 {
		t.Errorf("paramIndex = %d, want 2", paramIndex)
	}

	if diff := cmp.Diff([]any{"42"}, params); diff != "" {
		t.Errorf("params mismatch (-want +got):\n%s", diff)
	}
}

func TestStoreWriteDeleteFilter_ClauseError(t *testing.T) {
	t.Parallel()

	sentinel := errors.New("boom") //nolint:err113 // test sentinel

	s := NewStore()
	s.Delete["user"] = where.Clause{errStatement(sentinel)}

	params, paramIndex, written, err := s.WriteDeleteFilter(
		&strings.Builder{}, []any{"keep"}, 1, "user", nil, "t",
	)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	if !errors.Is(err, sentinel) {
		t.Errorf("expected wrapped sentinel error, got %v", err)
	}

	if !strings.Contains(err.Error(), "writing delete permission clause") {
		t.Errorf("expected wrap prefix in error, got %v", err)
	}

	if params != nil || paramIndex != 0 || written {
		t.Errorf(
			"on clause error want zero return values, got params=%v paramIndex=%d written=%v",
			params, paramIndex, written,
		)
	}
}

func TestStoreWriteDeleteFilter_MissingSessionVariableErrors(t *testing.T) {
	t.Parallel()

	s := NewStore()
	s.Delete["user"] = where.Clause{appendParamStatement("user_id", "x-hasura-missing")}

	params, paramIndex, written, err := s.WriteDeleteFilter(
		&strings.Builder{}, nil, 1, "user", map[string]any{}, "t",
	)
	if !errors.Is(err, ErrSessionVariableNotFound) {
		t.Fatalf("expected ErrSessionVariableNotFound, got %v", err)
	}

	if params != nil || paramIndex != 0 || written {
		t.Errorf(
			"on session-variable error want zero return values, got params=%v paramIndex=%d written=%v",
			params,
			paramIndex,
			written,
		)
	}
}

func TestStoreWriteInsertCheck_ClauseError(t *testing.T) {
	t.Parallel()

	sentinel := errors.New("boom") //nolint:err113 // test sentinel

	s := NewStore()
	s.Insert["user"] = where.Clause{errStatement(sentinel)}

	params, paramIndex, hasCheck, err := s.WriteInsertCheck(
		&strings.Builder{}, "user", nil, []any{"keep"}, 1, "data",
	)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	if !errors.Is(err, sentinel) {
		t.Errorf("expected wrapped sentinel error, got %v", err)
	}

	if !strings.Contains(err.Error(), "failed to apply insert permission check") {
		t.Errorf("expected wrap prefix in error, got %v", err)
	}

	if params != nil || paramIndex != 0 || hasCheck {
		t.Errorf(
			"on clause error want zero return values, got params=%v paramIndex=%d hasCheck=%v",
			params, paramIndex, hasCheck,
		)
	}
}

func TestStoreWriteDeleteFilter_WithPermission(t *testing.T) {
	t.Parallel()

	s := NewStore()
	s.Delete["user"] = where.Clause{appendParamStatement("user_id", "x-hasura-user-id")}

	var b strings.Builder

	sessionVars := map[string]any{"x-hasura-user-id": "42"}

	params, paramIndex, written, err := s.WriteDeleteFilter(&b, nil, 1, "user", sessionVars, "t")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !written {
		t.Fatal("expected written=true when role has delete permission")
	}

	if b.String() != "t.user_id = $1" {
		t.Errorf("builder = %q, want \"t.user_id = $1\"", b.String())
	}

	if paramIndex != 2 {
		t.Errorf("paramIndex = %d, want 2", paramIndex)
	}

	if diff := cmp.Diff([]any{"42"}, params); diff != "" {
		t.Errorf("params mismatch (-want +got):\n%s", diff)
	}
}

func TestExtendInsertColumns_WithPermission_AppendsMissingNonGenerated(t *testing.T) {
	t.Parallel()

	s := NewStore()
	s.Insert["user"] = where.Clause{
		where.NewEqualsFilter(&core.Column{SQLName: "tenant_id"}, nil, nil),
		where.NewEqualsFilter(&core.Column{SQLName: "id"}, nil, nil),
		where.NewEqualsFilter(&core.Column{SQLName: "user_id"}, nil, nil),
	}

	lookup := func(name string) *core.Column {
		switch name {
		case "tenant_id":
			return &core.Column{SQLName: "tenant_id", IsGenerated: false}
		case "id":
			return &core.Column{SQLName: "id", IsGenerated: true}
		case "user_id":
			return &core.Column{SQLName: "user_id", IsGenerated: false}
		default:
			return nil
		}
	}

	got := s.ExtendInsertColumns([]string{"tenant_id"}, "user", lookup)

	// tenant_id already present (kept once); id is generated (skipped);
	// user_id is appended.
	want := []string{"tenant_id", "user_id"}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("ExtendInsertColumns mismatch (-want +got):\n%s", diff)
	}
}

func TestMissingInsertColumns_WithPermission(t *testing.T) {
	t.Parallel()

	s := NewStore()
	s.Insert["user"] = where.Clause{
		where.NewEqualsFilter(&core.Column{SQLName: "tenant_id"}, nil, nil),
		where.NewEqualsFilter(&core.Column{SQLName: "tenant_id"}, nil, nil), // dup
		where.NewEqualsFilter(&core.Column{SQLName: "id"}, nil, nil),        // generated
		where.NewEqualsFilter(&core.Column{SQLName: "user_id"}, nil, nil),   // present
		where.NewEqualsFilter(&core.Column{SQLName: "team_id"}, nil, nil),   // missing
	}

	lookup := func(name string) *core.Column {
		switch name {
		case "tenant_id":
			return &core.Column{SQLName: "tenant_id", IsGenerated: false}
		case "id":
			return &core.Column{SQLName: "id", IsGenerated: true}
		case "user_id":
			return &core.Column{SQLName: "user_id", IsGenerated: false}
		case "team_id":
			return &core.Column{SQLName: "team_id", IsGenerated: false}
		default:
			return nil
		}
	}

	present := map[string]struct{}{"user_id": {}}

	got := s.MissingInsertColumns("user", present, lookup)

	wantNames := []string{"tenant_id", "team_id"}
	gotNames := make([]string, len(got))

	for i, col := range got {
		gotNames[i] = col.SQLName
	}

	if diff := cmp.Diff(wantNames, gotNames); diff != "" {
		t.Errorf("MissingInsertColumns names mismatch (-want +got):\n%s", diff)
	}
}

func TestReferencesGeneratedColumns_WithPermission(t *testing.T) {
	t.Parallel()

	gen := func(name string, generated bool) *core.Column {
		return &core.Column{SQLName: name, IsGenerated: generated}
	}

	lookup := func(name string) *core.Column {
		switch name {
		case "id":
			return gen("id", true)
		case "user_id":
			return gen("user_id", false)
		default:
			return nil
		}
	}

	t.Run("returns true when a generated column is referenced", func(t *testing.T) {
		t.Parallel()

		s := NewStore()
		s.Insert["user"] = where.Clause{
			where.NewEqualsFilter(&core.Column{SQLName: "user_id"}, nil, nil),
			where.NewEqualsFilter(&core.Column{SQLName: "id"}, nil, nil),
		}

		if !s.ReferencesGeneratedColumns("user", lookup) {
			t.Fatal("expected true when insert filter references a generated column")
		}
	})

	t.Run("returns false when no referenced column is generated", func(t *testing.T) {
		t.Parallel()

		s := NewStore()
		s.Insert["user"] = where.Clause{
			where.NewEqualsFilter(&core.Column{SQLName: "user_id"}, nil, nil),
		}

		if s.ReferencesGeneratedColumns("user", lookup) {
			t.Fatal("expected false when no referenced column is generated")
		}
	})
}

func TestRequiresPostInsertCheck(t *testing.T) {
	t.Parallel()

	makeCol := func(name string, generated, hasDefault bool) *core.Column {
		return &core.Column{
			SQLName:     name,
			IsGenerated: generated,
			HasDefault:  hasDefault,
		}
	}

	lookup := func(name string) *core.Column {
		switch name {
		case "id":
			return makeCol("id", true, false) // generated
		case "parent_kind":
			return makeCol("parent_kind", false, true) // DB default
		case "parent_id":
			return makeCol("parent_id", false, false)
		case "user_id":
			return makeCol("user_id", false, false)
		default:
			return nil
		}
	}

	insertCheck := func(cols ...string) where.Clause {
		clause := where.Clause{}
		for _, c := range cols {
			clause = append(
				clause,
				where.NewEqualsFilter(&core.Column{SQLName: c}, nil, nil),
			)
		}

		return clause
	}

	t.Run("generated column always triggers post-check", func(t *testing.T) {
		t.Parallel()

		s := NewStore()
		s.Insert["user"] = insertCheck("id")

		// Even if "id" were somehow "present" in the payload, generated
		// columns can't be supplied — post-check is unconditional.
		if !s.RequiresPostInsertCheck("user", map[string]struct{}{"id": {}}, lookup) {
			t.Fatal("expected post-check when check references a generated column")
		}
	})

	t.Run("defaulted column absent from payload triggers post-check", func(t *testing.T) {
		t.Parallel()

		s := NewStore()
		s.Insert["user"] = insertCheck("parent_kind")

		if !s.RequiresPostInsertCheck("user", map[string]struct{}{"parent_id": {}}, lookup) {
			t.Fatal("expected post-check when defaulted check column is absent")
		}
	})

	t.Run("defaulted column present in payload stays on pre-check", func(t *testing.T) {
		t.Parallel()

		s := NewStore()
		s.Insert["user"] = insertCheck("parent_kind")

		present := map[string]struct{}{"parent_id": {}, "parent_kind": {}}
		if s.RequiresPostInsertCheck("user", present, lookup) {
			t.Fatal("expected pre-check when defaulted check column is supplied")
		}
	})

	t.Run("plain column referenced by check stays on pre-check", func(t *testing.T) {
		t.Parallel()

		s := NewStore()
		s.Insert["user"] = insertCheck("user_id")

		if s.RequiresPostInsertCheck("user", map[string]struct{}{}, lookup) {
			t.Fatal("expected pre-check for non-generated, non-defaulted column")
		}
	})

	t.Run("unknown column (lookup nil) is ignored", func(t *testing.T) {
		t.Parallel()

		s := NewStore()
		s.Insert["user"] = insertCheck("ghost_column")

		if s.RequiresPostInsertCheck("user", map[string]struct{}{}, lookup) {
			t.Fatal("expected pre-check when referenced column isn't in the lookup")
		}
	})

	t.Run("no insert clause for role is pre-check", func(t *testing.T) {
		t.Parallel()

		s := NewStore()

		if s.RequiresPostInsertCheck("user", map[string]struct{}{}, lookup) {
			t.Fatal("expected pre-check when role has no insert clause")
		}
	})

	t.Run("multiple referenced columns: one defaulted-absent is enough", func(t *testing.T) {
		t.Parallel()

		s := NewStore()
		s.Insert["user"] = insertCheck("user_id", "parent_kind")

		// user_id present (would be pre-check on its own); parent_kind defaulted-absent.
		present := map[string]struct{}{"user_id": {}}
		if !s.RequiresPostInsertCheck("user", present, lookup) {
			t.Fatal("expected post-check when any check column is defaulted-absent")
		}
	})
}

func TestStoreHasAccessors(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name             string
		setup            func(*Store)
		role             string
		wantRowLevel     bool
		wantInsertCheck  bool
		wantUpdateFilter bool
		wantUpdateCheck  bool
		wantDeleteFilter bool
	}{
		{
			name:  "empty store, missing role",
			setup: func(_ *Store) {},
			role:  "user",
		},
		{
			name: "select role with non-empty clause",
			setup: func(s *Store) {
				s.Select["user"] = where.Clause{
					where.NewEqualsFilter(&core.Column{SQLName: "tenant_id"}, nil, nil),
				}
			},
			role:         "user",
			wantRowLevel: true,
		},
		{
			name: "select role with empty clause counts as no row-level filter",
			setup: func(s *Store) {
				s.Select["user"] = where.Clause{}
			},
			role:         "user",
			wantRowLevel: false,
		},
		{
			name: "insert role present",
			setup: func(s *Store) {
				s.Insert["user"] = where.Clause{}
			},
			role:            "user",
			wantInsertCheck: true,
		},
		{
			name: "update role present",
			setup: func(s *Store) {
				s.Update["user"] = where.Clause{}
			},
			role:             "user",
			wantUpdateFilter: true,
		},
		{
			name: "update check with non-empty clause",
			setup: func(s *Store) {
				s.UpdateCheck["user"] = where.Clause{
					where.NewEqualsFilter(&core.Column{SQLName: "role"}, nil, nil),
				}
			},
			role:            "user",
			wantUpdateCheck: true,
		},
		{
			name: "update check with empty clause counts as no check",
			setup: func(s *Store) {
				s.UpdateCheck["user"] = where.Clause{}
			},
			role:            "user",
			wantUpdateCheck: false,
		},
		{
			name: "delete role present",
			setup: func(s *Store) {
				s.Delete["user"] = where.Clause{}
			},
			role:             "user",
			wantDeleteFilter: true,
		},
		{
			name: "other role isolated",
			setup: func(s *Store) {
				s.Select["admin"] = where.Clause{
					where.NewEqualsFilter(&core.Column{SQLName: "id"}, nil, nil),
				}
				s.Insert["admin"] = where.Clause{}
				s.Update["admin"] = where.Clause{}
				s.UpdateCheck["admin"] = where.Clause{
					where.NewEqualsFilter(&core.Column{SQLName: "role"}, nil, nil),
				}
				s.Delete["admin"] = where.Clause{}
			},
			role: "user",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			s := NewStore()
			tc.setup(s)

			if got := s.HasRowLevel(tc.role); got != tc.wantRowLevel {
				t.Errorf("HasRowLevel(%q) = %v, want %v", tc.role, got, tc.wantRowLevel)
			}

			if got := s.HasInsertCheck(tc.role); got != tc.wantInsertCheck {
				t.Errorf("HasInsertCheck(%q) = %v, want %v", tc.role, got, tc.wantInsertCheck)
			}

			if got := s.HasUpdateFilter(tc.role); got != tc.wantUpdateFilter {
				t.Errorf("HasUpdateFilter(%q) = %v, want %v", tc.role, got, tc.wantUpdateFilter)
			}

			if got := s.HasUpdateCheck(tc.role); got != tc.wantUpdateCheck {
				t.Errorf("HasUpdateCheck(%q) = %v, want %v", tc.role, got, tc.wantUpdateCheck)
			}

			if got := s.HasDeleteFilter(tc.role); got != tc.wantDeleteFilter {
				t.Errorf("HasDeleteFilter(%q) = %v, want %v", tc.role, got, tc.wantDeleteFilter)
			}
		})
	}
}
