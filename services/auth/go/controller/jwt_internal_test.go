package controller

import (
	"testing"

	"github.com/golang-jwt/jwt/v5"
)

func TestVerifiedTokenLogAttrs(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name   string
		claims jwt.MapClaims
		want   []string
	}{
		{name: "session identifiers", claims: jwt.MapClaims{"sid": "session-id", "jti": "token-id"}, want: []string{"sid=session-id", "jti=token-id"}},
		{name: "oauth client", claims: jwt.MapClaims{"client_id": "client-id"}, want: []string{"client_id=client-id"}},
		{name: "malformed and absent", claims: jwt.MapClaims{"sid": 123, "jti": nil}, want: []string{}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			token := jwt.NewWithClaims(jwt.SigningMethodHS256, tc.claims)

			attrs := verifiedTokenLogAttrs(token)
			if len(attrs) != len(tc.want) {
				t.Fatalf("attribute count = %d, want %d", len(attrs), len(tc.want))
			}

			for i, attr := range attrs {
				got := attr.Key + "=" + attr.Value.String()
				if got != tc.want[i] {
					t.Errorf("attribute = %q, want %q", got, tc.want[i])
				}
			}
		})
	}
}
