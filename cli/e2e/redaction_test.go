//go:build e2e

package e2e_test

import (
	"strings"
	"testing"
)

func TestRedactResponseBody(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		body        string
		contentType string
		want        string
	}{
		{
			name: "nested JSON",
			body: `{"accessToken":"jwt","profile":{"email":"person@example.com",` +
				`"clientSecret":"secret"},"items":[{"apiKEY":"key"}],"status":"ok"}`,
			contentType: "application/json",
			want: `{"accessToken":"[REDACTED]","items":[{"apiKEY":"[REDACTED]"}],` +
				`"profile":{"clientSecret":"[REDACTED]","email":"person@example.com"},"status":"ok"}`,
		},
		{
			name:        "bare JWT string",
			body:        `"eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.SECRETSIG"`,
			contentType: "application/json",
			want:        `"[REDACTED jwt len=46]"`,
		},
		{
			name:        "JWT string in array",
			body:        `["eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.SECRETSIG"]`,
			contentType: "application/json",
			want:        `["[REDACTED jwt len=46]"]`,
		},
		{
			name:        "new sensitive key",
			body:        `{"mfa":{"ticket":"ticket-value"}}`,
			contentType: "application/json",
			want:        `{"mfa":{"ticket":"[REDACTED]"}}`,
		},
		{
			name:        "bare non-JWT string",
			body:        `"ordinary response"`,
			contentType: "application/json",
			want:        `"ordinary response"`,
		},
		{
			name:        "plain text",
			body:        "secret response text",
			contentType: "text/plain; charset=utf-8",
			want:        `body omitted (len=20 content-type="text/plain; charset=utf-8")`,
		},
		{
			name: "empty body",
			body: "",
			want: "body omitted (len=0)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := redactResponseBody([]byte(tt.body), tt.contentType); got != tt.want {
				t.Errorf("redactResponseBody() = %q; want %q", got, tt.want)
			}
		})
	}
}

func TestRedactResponseBodyDoesNotExposeSensitiveValues(t *testing.T) {
	t.Parallel()

	body := []byte(`{"Authorization":"Bearer exposed","passwordHint":"exposed hint"}`)
	got := redactResponseBody(body, "application/json")

	if strings.Contains(got, "exposed") {
		t.Fatal("redactResponseBody() exposed a sensitive value")
	}
}
