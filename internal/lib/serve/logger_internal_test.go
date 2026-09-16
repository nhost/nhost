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
		// Named individually in isSecret; these are real flags whose names
		// contain no generic secret term.
		{"database-url", true},
		{"migrations-database-url", true},
		{"metadata-database-url", true},
		{"sms-generic-headers", true},
		{"postgres", true},
		{"postgres-migrations", true},
		{"postgres-migrations-source", true},
		{"bind-address", false},
		{"debug", false},
		{"log-format-text", false},
		{"enable-playground", false},
		{"subscription-poll-interval", false},
		{"profile-address", false},
		{"metadata-path", false},
		{"", false},
		// Deliberately NOT redacted: this would be caught by widening
		// "sms-generic-headers" to "headers". No such flag exists today, and
		// a future one would not necessarily carry a secret, so the specific
		// name is used instead.
		{"headers", false},
		// smtp-api-header is SendGrid's X-SMTPAPI value (categories,
		// substitutions, filters), not a credential, so it stays visible.
		{"smtp-api-header", false},
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
