package tokenpurpose_test

import (
	"testing"

	"github.com/nhost/nhost/services/auth/go/tokenpurpose"
)

func TestPurposeMatches(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		purpose tokenpurpose.Purpose
		typ     string
		want    bool
	}{
		{
			name:    "session exact",
			purpose: tokenpurpose.Session,
			typ:     "nhost-session+jwt",
			want:    true,
		},
		{
			name:    "access token exact",
			purpose: tokenpurpose.OAuth2AccessToken,
			typ:     "at+jwt",
			want:    true,
		},
		{
			name:    "access token with application prefix",
			purpose: tokenpurpose.OAuth2AccessToken,
			typ:     "application/at+jwt",
			want:    true,
		},
		{
			name:    "access token mixed case",
			purpose: tokenpurpose.OAuth2AccessToken,
			typ:     "Application/AT+JWT",
			want:    true,
		},
		{
			name:    "id token",
			purpose: tokenpurpose.OIDCIDToken,
			typ:     "JWT",
			want:    true,
		},
		{
			name:    "session rejects id token type",
			purpose: tokenpurpose.Session,
			typ:     "JWT",
			want:    false,
		},
		{
			name:    "session rejects access token type",
			purpose: tokenpurpose.Session,
			typ:     "at+jwt",
			want:    false,
		},
		{
			name:    "access token rejects session type",
			purpose: tokenpurpose.OAuth2AccessToken,
			typ:     "nhost-session+jwt",
			want:    false,
		},
		{
			name:    "session rejects provider state type",
			purpose: tokenpurpose.Session,
			typ:     "nhost-provider-state+jwt",
			want:    false,
		},
		{
			name:    "empty type",
			purpose: tokenpurpose.Session,
			typ:     "",
			want:    false,
		},
		{
			name:    "prefix is not stripped from the purpose side",
			purpose: tokenpurpose.OAuth2AccessToken,
			typ:     "application/application/at+jwt",
			want:    false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := tc.purpose.Matches(tc.typ); got != tc.want {
				t.Errorf("%q.Matches(%q) = %v, want %v", tc.purpose, tc.typ, got, tc.want)
			}
		})
	}
}
