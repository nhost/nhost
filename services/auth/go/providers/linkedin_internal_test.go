package providers

import (
	"encoding/json"
	"testing"
)

func TestLinkedInProfileDecoding(t *testing.T) {
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
				"sub": "123",
				"email": "jane@example.com",
				"email_verified": true,
				"given_name": "Jane",
				"family_name": "Doe"
			}`,
			expectedEmail:    "jane@example.com",
			expectedVerified: true,
		},
		{
			name: "unverified email must not be marked verified",
			body: `{
				"sub": "123",
				"email": "victim@target.io",
				"email_verified": false
			}`,
			expectedEmail:    "victim@target.io",
			expectedVerified: false,
		},
		{
			name: "missing email_verified defaults to false (safe)",
			body: `{
				"sub": "123",
				"email": "victim@target.io"
			}`,
			expectedEmail:    "victim@target.io",
			expectedVerified: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var profile linkedInUserInfoProfile
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
