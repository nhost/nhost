package e2e_test

import (
	"encoding/json"
	"fmt"
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

func looksLikeJWT(s string) bool {
	parts := strings.Split(s, ".")
	if len(parts) != 3 || len(s) <= 20 {
		return false
	}

	for _, part := range parts {
		if part == "" || strings.IndexFunc(part, isNotBase64URLCharacter) >= 0 {
			return false
		}
	}

	return true
}

func isNotBase64URLCharacter(r rune) bool {
	const base64URLAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"

	return !strings.ContainsRune(base64URLAlphabet, r)
}

func redactResponseBody(body []byte, contentType string) string {
	var payload any
	if err := json.Unmarshal(body, &payload); err != nil {
		return responseBodyMetadata(body, contentType)
	}

	payload = redactSensitiveJSON(payload)

	redacted, err := json.Marshal(payload)
	if err != nil {
		return responseBodyMetadata(body, contentType)
	}

	return string(redacted)
}

func redactSensitiveJSON(value any) any {
	switch value := value.(type) {
	case map[string]any:
		for key, child := range value {
			if isSensitiveJSONKey(key) {
				value[key] = "[REDACTED]"

				continue
			}

			value[key] = redactSensitiveJSON(child)
		}
	case []any:
		for i, child := range value {
			value[i] = redactSensitiveJSON(child)
		}
	case string:
		// Keep string detection deliberately narrow: redact only values with three
		// non-empty base64url-shaped JWT segments, leaving ordinary text useful.
		if looksLikeJWT(value) {
			return fmt.Sprintf("[REDACTED jwt len=%d]", len(value))
		}
	}

	return value
}

func isSensitiveJSONKey(key string) bool {
	key = strings.ToLower(key)
	for _, sensitivePart := range []string{
		"token", "secret", "password", "key", "authorization", "ticket", "jwt", "bearer", "credential",
	} {
		if strings.Contains(key, sensitivePart) {
			return true
		}
	}

	return false
}

func responseBodyMetadata(body []byte, contentType string) string {
	if contentType == "" {
		return fmt.Sprintf("body omitted (len=%d)", len(body))
	}

	return fmt.Sprintf("body omitted (len=%d content-type=%q)", len(body), contentType)
}
