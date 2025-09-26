package controller_test

import (
	"net/http"
	"testing"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/storage/controller"
)

func TestGetUserSession(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		headers  http.Header
		expected map[string]any
	}{
		{
			name: "access token + hasura headers",
			headers: http.Header{
				//nolint:lll
				"Authorization": []string{
					"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjIwMDc2MzMyNDMsImh0dHBzOi8vaGFzdXJhLmlvL2p3dC9jbGFpbXMiOnsieC1oYXN1cmEtYWxsb3dlZC1yb2xlcyI6WyJhZG1pbiJdLCJ4LWhhc3VyYS1kZWZhdWx0LXJvbGUiOiJhZG1pbiIsIngtaGFzdXJhLXVzZXItaWQiOiJhYjViYTU4ZS05MzJhLTQwZGMtODdlOC03MzM5OTg3OTRlYzIiLCJ4LWhhc3VyYS11c2VyLWlzQW5vbnltb3VzIjoiZmFsc2UifSwiaWF0IjoxNjkyMjczMjQzLCJpc3MiOiJoYXN1cmEtYXV0aCIsInN1YiI6ImFiNWJhNThlLTkzMmEtNDBkYy04N2U4LTczMzk5ODc5NGVjMiJ9.uUzQJskim7TgCNtEIGfwl57pxrgb73gVdCN574qkYoQ",
				},
				"X-Hasura-Role": []string{"admin"},
			},
			expected: map[string]any{
				"access_token_claims": jwt.MapClaims{
					"exp": float64(2.007633243e+09),
					"https://hasura.io/jwt/claims": map[string]any{
						"x-hasura-allowed-roles":    []any{"admin"},
						"x-hasura-default-role":     "admin",
						"x-hasura-user-id":          "ab5ba58e-932a-40dc-87e8-733998794ec2",
						"x-hasura-user-isAnonymous": "false",
					},
					"iat": 1.692273243e+09,
					"iss": "hasura-auth",
					"sub": "ab5ba58e-932a-40dc-87e8-733998794ec2",
				},
				"hasura_headers": map[string]any{
					"X-Hasura-Role": []string{"admin"},
				},
			},
		},

		{
			name: "hasura headers",
			headers: http.Header{
				"X-Hasura-Admin-Secret": []string{"secret"},
				"X-Hasura-Role":         []string{"admin"},
			},
			expected: map[string]any{
				"access_token_claims": map[string]any{},
				"hasura_headers": map[string]any{
					"X-Hasura-Admin-Secret-Present": bool(true),
					"X-Hasura-Role":                 []string{"admin"},
				},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			session := controller.GetUserSession(tc.headers)
			if diff := cmp.Diff(tc.expected, session); diff != "" {
				t.Errorf("mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
