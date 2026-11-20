package arguments_test

import (
	"errors"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
)

func TestNewNullInputError(t *testing.T) {
	t.Parallel()

	tests := []struct{ name, path, wantPath string }{
		{name: "unstamped", path: "", wantPath: "$.selectionSet.args"},
		{
			name:     "mutation selector",
			path:     "delete_users",
			wantPath: "$.selectionSet.delete_users.args",
		},
		{
			name:     "nested argument",
			path:     "users.selectionSet.posts",
			wantPath: "$.selectionSet.users.selectionSet.posts.args",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			err := arguments.NewNullInputError()
			err.StampArgumentPath(tt.path)

			if !errors.Is(err, arguments.ErrInvalidArgument) {
				t.Fatalf("error does not wrap invalid argument: %v", err)
			}

			want := map[string]any{
				"message":    "unexpected null value for a non-null input",
				"extensions": map[string]any{"code": "validation-failed", "path": tt.wantPath},
			}
			if diff := cmp.Diff(want, err.AsMap()); diff != "" {
				t.Errorf("client validation error (-want +got):\n%s", diff)
			}
		})
	}
}
