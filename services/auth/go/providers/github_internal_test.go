package providers

import (
	"testing"
)

func TestSelectEmail(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		emails        gitHubEmail
		expectedEmail string
		expectedVer   bool
	}{
		{
			name: "single primary and verified",
			emails: gitHubEmail{
				{Email: "a@test.com", Verified: true, Primary: true},
			},
			expectedEmail: "a@test.com",
			expectedVer:   true,
		},
		{
			name: "primary verified among multiple",
			emails: gitHubEmail{
				{Email: "a@test.com", Verified: true, Primary: false},
				{Email: "b@test.com", Verified: true, Primary: true},
				{Email: "c@test.com", Verified: false, Primary: false},
			},
			expectedEmail: "b@test.com",
			expectedVer:   true,
		},
		{
			name: "no primary verified falls back to first verified",
			emails: gitHubEmail{
				{Email: "a@test.com", Verified: false, Primary: false},
				{Email: "b@test.com", Verified: true, Primary: false},
				{Email: "c@test.com", Verified: true, Primary: false},
			},
			expectedEmail: "b@test.com",
			expectedVer:   true,
		},
		{
			name: "no verified falls back to first email",
			emails: gitHubEmail{
				{Email: "a@test.com", Verified: false, Primary: false},
				{Email: "b@test.com", Verified: false, Primary: true},
			},
			expectedEmail: "a@test.com",
			expectedVer:   false,
		},
		{
			name: "primary unverified with verified alternative",
			emails: gitHubEmail{
				{Email: "a@test.com", Verified: false, Primary: true},
				{Email: "b@test.com", Verified: true, Primary: false},
			},
			expectedEmail: "b@test.com",
			expectedVer:   true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := selectEmail(tc.emails)

			if got.Email != tc.expectedEmail {
				t.Errorf("email: got %q, want %q", got.Email, tc.expectedEmail)
			}

			if got.Verified != tc.expectedVer {
				t.Errorf("verified: got %v, want %v", got.Verified, tc.expectedVer)
			}
		})
	}
}
