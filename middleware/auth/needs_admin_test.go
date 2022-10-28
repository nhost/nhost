package auth //nolint: testpackage

import (
	"net/http"
	"testing"
)

func TestIsAdmin(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name      string
		reqHeader http.Header
		isAdmin   bool
	}{
		{
			name: "correct secret and empty role",
			reqHeader: http.Header{
				"X-Hasura-Admin-Secret": []string{"secret"},
			},
			isAdmin: true,
		},
		{
			name: "correct secret and role",
			reqHeader: http.Header{
				"X-Hasura-Admin-Secret": []string{"secret"},
				"X-Hasura-Role":         []string{"admin"},
			},
			isAdmin: true,
		},
		{
			name: "correct secret and wrong role",
			reqHeader: http.Header{
				"X-Hasura-Admin-Secret": []string{"secret"},
				"X-Hasura-Role":         []string{"user"},
			},
			isAdmin: false,
		},
		{
			name: "wrong secret and correct role",
			reqHeader: http.Header{
				"X-Hasura-Admin-Secret": []string{"woooo"},
				"X-Hasura-Role":         []string{"admin"},
			},
			isAdmin: false,
		},
		{
			name: "wrong secret and no role",
			reqHeader: http.Header{
				"X-Hasura-Admin-Secret": []string{"woooo"},
			},
			isAdmin: false,
		},
		{
			name:      "no headers",
			reqHeader: http.Header{},
			isAdmin:   false,
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			tc := tc

			got := isAdmin("secret", tc.reqHeader)
			if got != tc.isAdmin {
				t.Errorf("isAdmin() = %v, want %v", got, tc.isAdmin)
			}
		})
	}
}
