package controller

import (
	"errors"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/controller/planner"
	"github.com/nhost/nhost/services/constellation/internal/jsonpath"
	"github.com/vektah/gqlparser/v2/ast"
)

func TestRemoteTargetValidationUsesGraphQLNames(t *testing.T) {
	t.Parallel()

	rqp := &planner.RemoteQueryPlan{
		SourcePath: jsonpath.Path{"u", "r"}, SourceNamePath: jsonpath.Path{"users", "roles"},
		OutputField: "d", Selection: &ast.Field{Name: "department", Alias: "d"},
	}

	clientPath := remoteQueryArgumentPath(rqp)
	if clientPath != "users.selectionSet.roles.selectionSet.department" {
		t.Fatalf("client path = %q", clientPath)
	}

	tests := []struct {
		name string
		err  interface {
			error
			AsMap() map[string]any
		}
	}{
		{
			name: "validation", err: func() *arguments.QueryValidationError {
				_, _, _, err := arguments.ParseQuery(nil, ast.ArgumentList{
					&ast.Argument{Name: "limit", Value: &ast.Value{Kind: ast.IntValue, Raw: "-1"}},
				}, nil, "admin", nil, "")

				var validation *arguments.QueryValidationError
				if !errors.As(err, &validation) {
					t.Fatalf("expected validation error: %v", err)
				}

				validation.StampArgumentPath("departments")

				return validation
			}(),
		},
		{
			name: "computed omission", err: arguments.NewComputedOmissionError("departments"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if err := remapRemoteValidationArgumentPath(
				tt.err,
				"departments",
				clientPath,
			); !errors.Is(err, tt.err) {
				t.Fatalf("remapping error changed it: %v", err)
			}

			envelope := tt.err.AsMap()

			extensions, ok := envelope["extensions"].(map[string]any)
			if !ok {
				t.Fatalf("missing extensions: %#v", envelope)
			}

			got := extensions["path"]

			want := "$.selectionSet." + clientPath + ".args"
			if tt.name == "validation" {
				want += ".limit"
			} else {
				want += ".args"
			}

			if got != want {
				t.Fatalf("error path = %q, want %q", got, want)
			}
		})
	}
}
