package resolver

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/vektah/gqlparser/v2/ast"
)

// Table-driven test for schemaResolver.BuildOperation. The per-case check
// closures push cognitive complexity above the linter threshold even though
// each branch is straightforward — the nolint is targeted to that.
func TestSchemaResolverBuildOperation(t *testing.T) { //nolint:gocognit,gocyclo,cyclop,maintidx
	t.Parallel()

	makeSelectionSet := func(fields ...string) ast.SelectionSet {
		ss := make(ast.SelectionSet, 0, len(fields))
		for _, f := range fields {
			ss = append(ss, &ast.Field{Name: f})
		}

		return ss
	}

	defaultPath := []metadata.RemoteFieldPathEntry{
		{
			FieldName: "teamByDepartment",
			Arguments: map[string]string{"departmentId": "$id"},
		},
	}
	filteredPath := []metadata.RemoteFieldPathEntry{
		{
			FieldName: "teamByDepartmentFiltered",
			Arguments: map[string]string{"departmentId": "$id"},
		},
	}

	tests := []struct {
		name            string
		remoteFieldPath []metadata.RemoteFieldPathEntry
		joinArguments   []*remoteJoinArgument
		sourceField     *ast.Field
		check           func(t *testing.T, op *ast.OperationDefinition)
	}{
		{
			name:            "empty join arguments returns nil",
			remoteFieldPath: defaultPath,
			joinArguments:   []*remoteJoinArgument{},
			sourceField: &ast.Field{
				Name:         "team",
				SelectionSet: makeSelectionSet("name"),
			},
			check: func(t *testing.T, op *ast.OperationDefinition) {
				t.Helper()

				if op != nil {
					t.Errorf("expected nil operation for empty join arguments, got %v", op)
				}
			},
		},
		{
			name:            "empty remote field path returns nil",
			remoteFieldPath: []metadata.RemoteFieldPathEntry{},
			joinArguments: []*remoteJoinArgument{
				newRemoteJoinArgument(map[string]any{"id": "abc"}),
			},
			sourceField: &ast.Field{
				Name:         "team",
				SelectionSet: makeSelectionSet("name"),
			},
			check: func(t *testing.T, op *ast.OperationDefinition) {
				t.Helper()

				if op != nil {
					t.Errorf("expected nil operation for empty remote field path, got %v", op)
				}
			},
		},
		{
			name:            "no user arguments baseline",
			remoteFieldPath: defaultPath,
			joinArguments: []*remoteJoinArgument{
				newRemoteJoinArgument(map[string]any{"id": "dept-1"}),
			},
			sourceField: &ast.Field{
				Name:         "team",
				Arguments:    nil,
				SelectionSet: makeSelectionSet("name"),
			},
			check: func(t *testing.T, op *ast.OperationDefinition) {
				t.Helper()

				if op == nil {
					t.Fatal("expected non-nil operation")
				}

				if len(op.SelectionSet) != 1 {
					t.Fatalf("expected 1 field, got %d", len(op.SelectionSet))
				}

				field, ok := op.SelectionSet[0].(*ast.Field)
				if !ok {
					t.Fatal("expected *ast.Field")
				}

				if field.Alias != "_0" {
					t.Errorf("expected alias _0, got %s", field.Alias)
				}

				if field.Name != "teamByDepartment" {
					t.Errorf("expected name teamByDepartment, got %s", field.Name)
				}

				if len(field.Arguments) != 1 {
					t.Fatalf("expected 1 argument, got %d", len(field.Arguments))
				}

				if field.Arguments[0].Name != "departmentId" {
					t.Errorf("expected argument departmentId, got %s", field.Arguments[0].Name)
				}

				if field.Arguments[0].Value.Raw != "dept-1" {
					t.Errorf("expected argument value dept-1, got %s", field.Arguments[0].Value.Raw)
				}
			},
		},
		{
			name:            "user arguments forwarded alongside metadata arguments",
			remoteFieldPath: filteredPath,
			joinArguments: []*remoteJoinArgument{
				newRemoteJoinArgument(map[string]any{"id": "dept-1"}),
			},
			sourceField: &ast.Field{
				Name: "teamFiltered",
				Arguments: ast.ArgumentList{
					{
						Name:  "includeStats",
						Value: &ast.Value{Kind: ast.BooleanValue, Raw: "false"},
					},
				},
				SelectionSet: makeSelectionSet("name", "wins"),
			},
			check: func(t *testing.T, op *ast.OperationDefinition) {
				t.Helper()

				if op == nil {
					t.Fatal("expected non-nil operation")
				}

				field, ok := op.SelectionSet[0].(*ast.Field)
				if !ok {
					t.Fatal("expected *ast.Field")
				}

				if len(field.Arguments) != 2 {
					t.Fatalf(
						"expected 2 arguments (metadata + user), got %d",
						len(field.Arguments),
					)
				}

				argNames := map[string]string{}
				for _, arg := range field.Arguments {
					argNames[arg.Name] = arg.Value.Raw
				}

				if v, ok := argNames["departmentId"]; !ok || v != "dept-1" {
					t.Errorf("expected departmentId=dept-1, got %v", argNames["departmentId"])
				}

				if v, ok := argNames["includeStats"]; !ok || v != "false" {
					t.Errorf("expected includeStats=false, got %v", argNames["includeStats"])
				}
			},
		},
		{
			name:            "metadata arguments take precedence over user arguments with same name",
			remoteFieldPath: defaultPath,
			joinArguments: []*remoteJoinArgument{
				newRemoteJoinArgument(map[string]any{"id": "dept-1"}),
			},
			sourceField: &ast.Field{
				Name: "team",
				Arguments: ast.ArgumentList{
					// User tries to override departmentId - should be ignored
					{
						Name:  "departmentId",
						Value: &ast.Value{Kind: ast.StringValue, Raw: "user-override"},
					},
				},
				SelectionSet: makeSelectionSet("name"),
			},
			check: func(t *testing.T, op *ast.OperationDefinition) {
				t.Helper()

				if op == nil {
					t.Fatal("expected non-nil operation")
				}

				field, ok := op.SelectionSet[0].(*ast.Field)
				if !ok {
					t.Fatal("expected *ast.Field")
				}

				if len(field.Arguments) != 1 {
					t.Fatalf("expected 1 argument (metadata wins), got %d", len(field.Arguments))
				}

				if field.Arguments[0].Value.Raw != "dept-1" {
					t.Errorf("expected metadata value dept-1, got %s", field.Arguments[0].Value.Raw)
				}
			},
		},
		{
			name:            "multiple user arguments forwarded",
			remoteFieldPath: filteredPath,
			joinArguments: []*remoteJoinArgument{
				newRemoteJoinArgument(map[string]any{"id": "dept-1"}),
			},
			sourceField: &ast.Field{
				Name: "teamFiltered",
				Arguments: ast.ArgumentList{
					{
						Name:  "includeStats",
						Value: &ast.Value{Kind: ast.BooleanValue, Raw: "true"},
					},
					{
						Name:  "limit",
						Value: &ast.Value{Kind: ast.IntValue, Raw: "10"},
					},
				},
				SelectionSet: makeSelectionSet("name"),
			},
			check: func(t *testing.T, op *ast.OperationDefinition) {
				t.Helper()

				if op == nil {
					t.Fatal("expected non-nil operation")
				}

				field, ok := op.SelectionSet[0].(*ast.Field)
				if !ok {
					t.Fatal("expected *ast.Field")
				}

				if len(field.Arguments) != 3 {
					t.Fatalf(
						"expected 3 arguments (1 metadata + 2 user), got %d",
						len(field.Arguments),
					)
				}

				argNames := map[string]string{}
				for _, arg := range field.Arguments {
					argNames[arg.Name] = arg.Value.Raw
				}

				if _, ok := argNames["departmentId"]; !ok {
					t.Error("missing departmentId argument")
				}

				if _, ok := argNames["includeStats"]; !ok {
					t.Error("missing includeStats argument")
				}

				if _, ok := argNames["limit"]; !ok {
					t.Error("missing limit argument")
				}
			},
		},
		{
			name:            "user arguments forwarded to each aliased batch entry",
			remoteFieldPath: filteredPath,
			joinArguments: []*remoteJoinArgument{
				newRemoteJoinArgument(map[string]any{"id": "dept-1"}),
				newRemoteJoinArgument(map[string]any{"id": "dept-2"}),
				newRemoteJoinArgument(map[string]any{"id": "dept-3"}),
			},
			sourceField: &ast.Field{
				Name: "teamFiltered",
				Arguments: ast.ArgumentList{
					{
						Name:  "includeStats",
						Value: &ast.Value{Kind: ast.BooleanValue, Raw: "false"},
					},
				},
				SelectionSet: makeSelectionSet("name", "wins"),
			},
			check: func(t *testing.T, op *ast.OperationDefinition) {
				t.Helper()

				if op == nil {
					t.Fatal("expected non-nil operation")
				}

				if len(op.SelectionSet) != 3 {
					t.Fatalf("expected 3 aliased fields, got %d", len(op.SelectionSet))
				}

				for i, sel := range op.SelectionSet {
					field, ok := sel.(*ast.Field)
					if !ok {
						t.Fatalf("entry %d: expected *ast.Field", i)
					}

					if field.Alias != "_"+string(rune('0'+i)) {
						t.Errorf("entry %d: expected alias _%d, got %s", i, i, field.Alias)
					}

					if len(field.Arguments) != 2 {
						t.Errorf(
							"entry %d: expected 2 arguments, got %d",
							i,
							len(field.Arguments),
						)
					}

					hasIncludeStats := false
					for _, arg := range field.Arguments {
						if arg.Name == "includeStats" && arg.Value.Raw == "false" {
							hasIncludeStats = true
						}
					}

					if !hasIncludeStats {
						t.Errorf("entry %d: missing includeStats=false argument", i)
					}
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			sr := newSchemaResolver([]string{"id"}, tt.remoteFieldPath)
			rq := &remoteQuery{
				targetConnector:     "",
				alias:               "",
				isArray:             false,
				joinArguments:       tt.joinArguments,
				sourceField:         tt.sourceField,
				fragments:           nil,
				parentPath:          nil,
				localPhantomFields:  nil,
				remotePhantomFields: nil,
				resolver:            sr,
				aggregateInfo:       nil,
			}

			tt.check(t, sr.BuildOperation(rq))
		})
	}
}

func TestMergeSourceFieldArguments(t *testing.T) {
	t.Parallel()

	t.Run("merges non-overlapping arguments", func(t *testing.T) {
		t.Parallel()

		remoteField := &ast.Field{
			Name: "teamByDepartmentFiltered",
			Arguments: ast.ArgumentList{
				{Name: "departmentId", Value: &ast.Value{Kind: ast.StringValue, Raw: "dept-1"}},
			},
		}

		sourceArgs := ast.ArgumentList{
			{Name: "includeStats", Value: &ast.Value{Kind: ast.BooleanValue, Raw: "false"}},
		}

		mergeSourceFieldArguments(remoteField, sourceArgs)

		if len(remoteField.Arguments) != 2 {
			t.Fatalf("expected 2 arguments, got %d", len(remoteField.Arguments))
		}

		want := map[string]string{"departmentId": "dept-1", "includeStats": "false"}
		got := map[string]string{}

		for _, arg := range remoteField.Arguments {
			got[arg.Name] = arg.Value.Raw
		}

		if diff := cmp.Diff(want, got); diff != "" {
			t.Errorf("arguments mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("skips arguments already set", func(t *testing.T) {
		t.Parallel()

		remoteField := &ast.Field{
			Name: "teamByDepartment",
			Arguments: ast.ArgumentList{
				{
					Name:  "departmentId",
					Value: &ast.Value{Kind: ast.StringValue, Raw: "metadata-value"},
				},
			},
		}

		sourceArgs := ast.ArgumentList{
			{Name: "departmentId", Value: &ast.Value{Kind: ast.StringValue, Raw: "user-value"}},
		}

		mergeSourceFieldArguments(remoteField, sourceArgs)

		if len(remoteField.Arguments) != 1 {
			t.Fatalf("expected 1 argument (no duplicate), got %d", len(remoteField.Arguments))
		}

		if remoteField.Arguments[0].Value.Raw != "metadata-value" {
			t.Errorf("expected metadata-value, got %s", remoteField.Arguments[0].Value.Raw)
		}
	})

	t.Run("handles nil source arguments", func(t *testing.T) {
		t.Parallel()

		remoteField := &ast.Field{
			Name: "teamByDepartment",
			Arguments: ast.ArgumentList{
				{Name: "departmentId", Value: &ast.Value{Kind: ast.StringValue, Raw: "dept-1"}},
			},
		}

		mergeSourceFieldArguments(remoteField, nil)

		if len(remoteField.Arguments) != 1 {
			t.Fatalf("expected 1 argument unchanged, got %d", len(remoteField.Arguments))
		}
	})

	t.Run("handles empty remote field arguments", func(t *testing.T) {
		t.Parallel()

		remoteField := &ast.Field{
			Name:      "someField",
			Arguments: nil,
		}

		sourceArgs := ast.ArgumentList{
			{Name: "arg1", Value: &ast.Value{Kind: ast.StringValue, Raw: "val1"}},
			{Name: "arg2", Value: &ast.Value{Kind: ast.IntValue, Raw: "42"}},
		}

		mergeSourceFieldArguments(remoteField, sourceArgs)

		if len(remoteField.Arguments) != 2 {
			t.Fatalf("expected 2 arguments, got %d", len(remoteField.Arguments))
		}

		want := map[string]string{"arg1": "val1", "arg2": "42"}
		got := map[string]string{}

		for _, arg := range remoteField.Arguments {
			got[arg.Name] = arg.Value.Raw
		}

		if diff := cmp.Diff(want, got); diff != "" {
			t.Errorf("arguments mismatch (-want +got):\n%s", diff)
		}
	})
}
