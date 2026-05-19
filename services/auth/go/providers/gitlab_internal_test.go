package providers

import (
	"encoding/json"
	"testing"
)

func TestGitlabProfileDecoding(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		body         string
		wantEmail    string
		wantVerified bool
	}{
		{
			name: "confirmed email",
			body: `{
				"id": 42,
				"name": "Jane",
				"email": "jane@gitlab.com",
				"confirmed_at": "2024-01-15T10:00:00Z"
			}`,
			wantEmail:    "jane@gitlab.com",
			wantVerified: true,
		},
		{
			name: "unconfirmed email must not be marked verified",
			body: `{
				"id": 42,
				"name": "Jane",
				"email": "victim@target.io",
				"confirmed_at": null
			}`,
			wantEmail:    "victim@target.io",
			wantVerified: false,
		},
		{
			name: "missing confirmed_at is treated as unverified",
			body: `{
				"id": 42,
				"name": "Jane",
				"email": "victim@target.io"
			}`,
			wantEmail:    "victim@target.io",
			wantVerified: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var profile gitlabUserProfile
			if err := json.Unmarshal([]byte(tc.body), &profile); err != nil {
				t.Fatalf("unmarshal failed: %v", err)
			}

			verified := profile.Email != "" && profile.ConfirmedAt != ""

			if profile.Email != tc.wantEmail {
				t.Errorf("email: got %q, want %q", profile.Email, tc.wantEmail)
			}

			if verified != tc.wantVerified {
				t.Errorf("verified: got %v, want %v", verified, tc.wantVerified)
			}
		})
	}
}
