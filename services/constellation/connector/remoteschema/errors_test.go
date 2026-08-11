package remoteschema_test

import (
	"reflect"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/remoteschema"
)

func TestGraphQLError_Error(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		errors []remoteschema.RemoteError
		want   string
	}{
		{
			name:   "empty errors list",
			errors: nil,
			want:   "graphql errors",
		},
		{
			name: "first error message",
			errors: []remoteschema.RemoteError{
				{Message: "field not found"},
				{Message: "ignored second error"},
			},
			want: "graphql error: field not found",
		},
		{
			name: "empty message renders blank",
			errors: []remoteschema.RemoteError{
				{Path: []any{"users"}},
			},
			want: "graphql error: ",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			err := remoteschema.NewGraphQLError(tt.errors)
			if got := err.Error(); got != tt.want {
				t.Errorf("expected %q, got %q", tt.want, got)
			}
		})
	}
}

func TestRemoteError_AsMap(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		err  remoteschema.RemoteError
		want map[string]any
	}{
		{
			name: "message only",
			err:  remoteschema.RemoteError{Message: "boom"},
			want: map[string]any{"message": "boom"},
		},
		{
			name: "omits empty optional fields",
			err:  remoteschema.RemoteError{Message: "boom", Path: []any{}},
			want: map[string]any{"message": "boom"},
		},
		{
			name: "all wire fields populated",
			err: remoteschema.RemoteError{
				Message:    "denied",
				Path:       []any{"users", 0, "email"},
				Locations:  []remoteschema.RemoteErrorLocation{{Line: 2, Column: 5}},
				Extensions: map[string]any{"code": "FORBIDDEN"},
			},
			want: map[string]any{
				"message":    "denied",
				"path":       []any{"users", 0, "email"},
				"locations":  []remoteschema.RemoteErrorLocation{{Line: 2, Column: 5}},
				"extensions": map[string]any{"code": "FORBIDDEN"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := tt.err.AsMap(); !reflect.DeepEqual(got, tt.want) {
				t.Errorf("expected %v, got %v", tt.want, got)
			}
		})
	}
}
