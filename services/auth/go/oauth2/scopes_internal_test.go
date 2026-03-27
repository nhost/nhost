package oauth2

import (
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestIsGraphQLRoleScope(t *testing.T) {
	t.Parallel()

	cases := []struct {
		scope string
		want  bool
	}{
		{"graphql:role:admin", true},
		{"graphql:role:user", true},
		{"graphql:role:user-editor", true},
		{"graphql:role:role_1", true},
		{"graphql:role:A", true},
		{"graphql:role:123", true},
		{"graphql:role:user:mcp", true},
		{"graphql:role:org:admin:read", true},
		{"graphql:role:my.role", true},
		{"graphql", false},
		{"graphql:role:", false},
		{"graphql:role: ", false},
		{"graphql:role:adm!n", false},
		{"graphql:role:admin editor", false},
		{"openid", false},
		{"", false},
	}

	for _, tc := range cases {
		t.Run(tc.scope, func(t *testing.T) {
			t.Parallel()

			if got := isGraphQLRoleScope(tc.scope); got != tc.want {
				t.Errorf("isGraphQLRoleScope(%q) = %v, want %v", tc.scope, got, tc.want)
			}
		})
	}
}

func TestExtractGraphQLRoles(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name   string
		scopes []string
		want   []string
	}{
		{
			name:   "no role scopes",
			scopes: []string{"openid", "graphql"},
			want:   nil,
		},
		{
			name:   "single role scope",
			scopes: []string{"openid", "graphql:role:admin"},
			want:   []string{"admin"},
		},
		{
			name:   "multiple role scopes preserves order",
			scopes: []string{"graphql:role:admin", "openid", "graphql:role:editor"},
			want:   []string{"admin", "editor"},
		},
		{
			name:   "role with colons",
			scopes: []string{"openid", "graphql:role:user:mcp"},
			want:   []string{"user:mcp"},
		},
		{
			name:   "empty scopes",
			scopes: nil,
			want:   nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := extractGraphQLRoles(tc.scopes)
			if diff := cmp.Diff(tc.want, got); diff != "" {
				t.Errorf("extractGraphQLRoles() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestValidateGraphQLScopeCombination(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		scopes  []string
		wantErr bool
	}{
		{
			name:    "graphql only - valid",
			scopes:  []string{"openid", "graphql"},
			wantErr: false,
		},
		{
			name:    "graphql:role only - valid",
			scopes:  []string{"openid", "graphql:role:admin"},
			wantErr: false,
		},
		{
			name:    "multiple graphql:role - valid",
			scopes:  []string{"openid", "graphql:role:admin", "graphql:role:editor"},
			wantErr: false,
		},
		{
			name:    "no graphql scopes - valid",
			scopes:  []string{"openid", "profile"},
			wantErr: false,
		},
		{
			name:    "graphql and graphql:role mixed - invalid",
			scopes:  []string{"openid", "graphql", "graphql:role:admin"},
			wantErr: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := validateGraphQLScopeCombination(tc.scopes)
			if tc.wantErr && got == "" {
				t.Error("expected error, got empty string")
			}

			if !tc.wantErr && got != "" {
				t.Errorf("expected no error, got %q", got)
			}
		})
	}
}
