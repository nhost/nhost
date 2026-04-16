package providers

import (
	"encoding/json"
	"testing"
)

func TestDiscordProfileDecoding(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name             string
		body             string
		expectedEmail    string
		expectedVerified bool
	}{
		{
			name: "verified account",
			body: `{
				"id": "80351110224678912",
				"username": "Nelly",
				"discriminator": "1337",
				"email": "nelly@discord.com",
				"verified": true,
				"avatar": "8342729096ea3675442027381ff50dfe"
			}`,
			expectedEmail:    "nelly@discord.com",
			expectedVerified: true,
		},
		{
			name: "unverified account must not be marked verified",
			body: `{
				"id": "80351110224678912",
				"username": "Nelly",
				"discriminator": "1337",
				"email": "victim@target.io",
				"verified": false
			}`,
			expectedEmail:    "victim@target.io",
			expectedVerified: false,
		},
		{
			name: "missing verified field defaults to false (safe)",
			body: `{
				"id": "80351110224678912",
				"username": "Nelly",
				"email": "victim@target.io"
			}`,
			expectedEmail:    "victim@target.io",
			expectedVerified: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var profile discordUserProfile
			if err := json.Unmarshal([]byte(tc.body), &profile); err != nil {
				t.Fatalf("unmarshal failed: %v", err)
			}

			if profile.Email != tc.expectedEmail {
				t.Errorf("email: got %q, want %q", profile.Email, tc.expectedEmail)
			}

			if profile.Verified != tc.expectedVerified {
				t.Errorf("verified: got %v, want %v", profile.Verified, tc.expectedVerified)
			}
		})
	}
}
