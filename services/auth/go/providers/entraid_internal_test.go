package providers

import (
	"encoding/json"
	"testing"
)

func TestEntraIDProfileDecoding(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name             string
		body             string
		expectedEmail    string
		expectedVerified bool
	}{
		{
			name: "verified email",
			body: `{
				"sub": "00000000-0000-0000-66f3-3332eca7ea81",
				"givenname": "Jane",
				"familyname": "Doe",
				"email": "jane@contoso.com",
				"email_verified": true
			}`,
			expectedEmail:    "jane@contoso.com",
			expectedVerified: true,
		},
		{
			name: "email present but not verified must be rejected",
			body: `{
				"sub": "00000000-0000-0000-66f3-3332eca7ea81",
				"email": "victim@target.io",
				"email_verified": false
			}`,
			expectedEmail:    "victim@target.io",
			expectedVerified: false,
		},
		{
			name: "missing email_verified defaults to false (safe)",
			body: `{
				"sub": "00000000-0000-0000-66f3-3332eca7ea81",
				"email": "victim@target.io"
			}`,
			expectedEmail:    "victim@target.io",
			expectedVerified: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var profile entraidUser
			if err := json.Unmarshal([]byte(tc.body), &profile); err != nil {
				t.Fatalf("unmarshal failed: %v", err)
			}

			if profile.Email != tc.expectedEmail {
				t.Errorf("email: got %q, want %q", profile.Email, tc.expectedEmail)
			}

			if profile.EmailVerified != tc.expectedVerified {
				t.Errorf(
					"email_verified: got %v, want %v",
					profile.EmailVerified,
					tc.expectedVerified,
				)
			}
		})
	}
}
