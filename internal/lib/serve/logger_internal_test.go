package serve

import "testing"

func TestIsSecret(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		want bool
	}{
		{"admin-secret", true},
		{"jwt-secret", true},
		{"hasura-graphql-jwt-secret", true},
		{"password", true},
		{"db-password", true},
		{"api-token", true},
		{"refresh-token", true},
		{"api-key", true},
		{"private-key", true},
		{"license", true},
		{"license-key", true},
		{"postgres-url", true},
		{"client-id", true},
		{"client-secret", true},
		{"metadata-database-url", true},
		{"database-url", true},
		{"migrations-database-url", true},
		{"bind-address", false},
		{"debug", false},
		{"log-format-text", false},
		{"enable-playground", false},
		{"subscription-poll-interval", false},
		{"profile-address", false},
		{"metadata-path", false},
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := isSecret(tt.name); got != tt.want {
				t.Errorf("isSecret(%q) = %v; want %v", tt.name, got, tt.want)
			}
		})
	}
}
