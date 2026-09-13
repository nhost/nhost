package e2e_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"regexp"
	"slices"
	"sort"
	"strings"
	"sync"
	"testing"
)

const minScrubbedSecretLength = 8

var (
	jwtSubstringPattern = regexp.MustCompile(
		`[A-Za-z0-9_-]{8,}={0,2}\.[A-Za-z0-9_-]{8,}={0,2}\.[A-Za-z0-9_-]{8,}={0,2}`,
	)
	// The e2e process shares known secrets across CLI, HTTP, and cleanup output paths.
	outputScrubber scrubber //nolint:gochecknoglobals
)

func TestRedactResponseBody(t *testing.T) {
	t.Parallel()

	const (
		jwt       = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.SECRETSIG"
		paddedJWT = jwt + "=="
	)

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
			body:        `"` + jwt + `"`,
			contentType: "application/json",
			want:        `"[REDACTED jwt len=46]"`,
		},
		{
			name:        "JWT string in array",
			body:        `["` + jwt + `"]`,
			contentType: "application/json",
			want:        `["[REDACTED jwt len=46]"]`,
		},
		{
			name:        "JWT embedded in message",
			body:        `{"message":"invalid token ` + jwt + `","status":401}`,
			contentType: "application/json",
			want:        `{"message":"invalid token [REDACTED jwt len=46]","status":401}`,
		},
		{
			name:        "JWT in URL value",
			body:        `{"url":"https://example.test/v1/files/x?tokenValue=` + jwt + `"}`,
			contentType: "application/json",
			want:        `{"url":"https://example.test/v1/files/x?tokenValue=[REDACTED jwt len=46]"}`,
		},
		{
			name:        "bearer-prefixed JWT",
			body:        `{"header":"Bearer ` + jwt + `"}`,
			contentType: "application/json",
			want:        `{"header":"Bearer [REDACTED jwt len=46]"}`,
		},
		{
			name:        "JWT in GraphQL error",
			body:        `{"errors":[{"extensions":{"code":"x"},"message":"unexpected ` + jwt + `"}]}`,
			contentType: "application/json",
			want:        `{"errors":[{"extensions":{"code":"x"},"message":"unexpected [REDACTED jwt len=46]"}]}`,
		},
		{
			name:        "padded JWT",
			body:        `"` + paddedJWT + `"`,
			contentType: "application/json",
			want:        `"[REDACTED jwt len=48]"`,
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

	const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.SECRETSIG"

	body := []byte(`{"detail":"request rejected for ` + jwt + `"}`)
	got := redactResponseBody(body, "application/json")

	if strings.Contains(got, jwt) {
		t.Fatal("redactResponseBody() exposed a JWT under a non-sensitive key")
	}
}

func TestRegisteredSecretsAreScrubbedFromOrdinaryValues(t *testing.T) {
	t.Parallel()

	const secret = "opaque-admin-secret-for-redaction-test"

	outputScrubber.add(secret)
	got := redactResponseBody(
		[]byte(`{"error":"invalid x-hasura-admin-secret: `+secret+`"}`),
		"application/json",
	)

	if strings.Contains(got, secret) {
		t.Fatal("redactResponseBody() exposed a registered secret under a non-sensitive key")
	}

	if !strings.Contains(got, "[REDACTED secret]") {
		t.Fatalf("redactResponseBody() did not mark the registered secret as redacted: %s", got)
	}
}

func TestScrubberIgnoresShortValues(t *testing.T) {
	t.Parallel()

	var s scrubber
	s.add("")
	s.add("short")

	const input = "short values remain useful"
	if got := s.scrub(input); got != input {
		t.Fatalf(
			"scrubber changed output after registering short values: got %q, want %q",
			got,
			input,
		)
	}
}

func TestRedactOutputScrubsRawCLIAndServiceLogs(t *testing.T) {
	t.Parallel()

	const (
		secret = "opaque-service-secret-for-redaction-test"
		jwt    = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.SECRETSIG=="
	)

	outputScrubber.add(secret)

	got := redactOutput([]byte("config ordinary=" + secret + "\nauthorization: Bearer " + jwt))
	for _, sensitive := range []string{secret, jwt} {
		if strings.Contains(got, sensitive) {
			t.Fatalf("redactOutput() exposed %q in %q", sensitive, got)
		}
	}
}

func TestRedactingLineWriterScrubsValuesSplitAcrossWrites(t *testing.T) {
	t.Parallel()

	const secret = "split-write-secret-for-redaction-test"

	outputScrubber.add(secret)

	var output bytes.Buffer

	writer := newRedactingLineWriter(&output)
	for _, chunk := range []string{"prefix split-write-", "secret-for-redaction-test suffix", "\n"} {
		if _, err := writer.Write([]byte(chunk)); err != nil {
			t.Fatalf("write chunk: %v", err)
		}
	}

	if err := writer.Flush(); err != nil {
		t.Fatalf("flush writer: %v", err)
	}

	if strings.Contains(output.String(), secret) {
		t.Fatalf("redactingLineWriter exposed split secret: %q", output.String())
	}

	if !strings.Contains(output.String(), "[REDACTED secret]") {
		t.Fatalf("redactingLineWriter did not mark secret as redacted: %q", output.String())
	}
}

func TestRedactedBoundedTailCapsOutput(t *testing.T) {
	t.Parallel()

	got := redactedBoundedTail([]byte(strings.Repeat("x", 100)), 10, 20)
	if !strings.HasSuffix(got, strings.Repeat("x", 20)) {
		t.Fatalf("redactedBoundedTail() = %q, want final 20 output bytes", got)
	}

	if !strings.Contains(got, "80 redacted output bytes omitted") {
		t.Fatalf("redactedBoundedTail() did not report omitted bytes: %q", got)
	}
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

	return outputScrubber.scrub(string(redacted))
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
		return redactJWTSubstrings(value)
	}

	return value
}

func redactJWTSubstrings(value string) string {
	return jwtSubstringPattern.ReplaceAllStringFunc(value, func(jwt string) string {
		return fmt.Sprintf("[REDACTED jwt len=%d]", len(jwt))
	})
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

type scrubber struct {
	mu     sync.RWMutex
	values []string
}

func (s *scrubber) add(value string) {
	candidates := append([]string{value}, strings.Split(value, "\n")...)

	s.mu.Lock()
	defer s.mu.Unlock()

	for _, candidate := range candidates {
		candidate = strings.TrimSpace(candidate)
		if len(candidate) < minScrubbedSecretLength || slicesContains(s.values, candidate) {
			continue
		}

		s.values = append(s.values, candidate)
	}

	// Replace longer values first so a registered substring cannot leave the
	// remainder of a longer secret visible.
	sort.Slice(s.values, func(i, j int) bool {
		return len(s.values[i]) > len(s.values[j])
	})
}

func (s *scrubber) scrub(value string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, secret := range s.values {
		value = strings.ReplaceAll(value, secret, "[REDACTED secret]")
	}

	return value
}

func slicesContains(values []string, target string) bool {
	return slices.Contains(values, target)
}

func redactOutput(output []byte) string {
	return outputScrubber.scrub(redactJWTSubstrings(string(output)))
}

func tail(output []byte, lines int) string {
	parts := strings.Split(strings.TrimRight(string(output), "\n"), "\n")
	if len(parts) > lines {
		parts = parts[len(parts)-lines:]
	}

	return strings.Join(parts, "\n")
}

func redactedTail(output []byte, lines int) string {
	return tail([]byte(redactOutput(output)), lines)
}

func redactedBoundedTail(output []byte, lines, maxBytes int) string {
	redacted := redactedTail(output, lines)
	if len(redacted) <= maxBytes {
		return redacted
	}

	return fmt.Sprintf(
		"[... %d redacted output bytes omitted ...]\n%s",
		len(redacted)-maxBytes,
		redacted[len(redacted)-maxBytes:],
	)
}

type redactingLineWriter struct {
	mu      sync.Mutex
	writer  io.Writer
	pending []byte
}

func newRedactingLineWriter(writer io.Writer) *redactingLineWriter {
	return &redactingLineWriter{writer: writer}
}

func (w *redactingLineWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	w.pending = append(w.pending, p...)
	for {
		newline := bytes.IndexByte(w.pending, '\n')
		if newline < 0 {
			return len(p), nil
		}

		line := w.pending[:newline+1]
		if _, err := io.WriteString(w.writer, redactOutput(line)); err != nil {
			return len(p), fmt.Errorf("writing redacted output: %w", err)
		}

		w.pending = w.pending[newline+1:]
	}
}

func (w *redactingLineWriter) Flush() error {
	w.mu.Lock()
	defer w.mu.Unlock()

	if len(w.pending) == 0 {
		return nil
	}

	if _, err := io.WriteString(w.writer, redactOutput(w.pending)); err != nil {
		return fmt.Errorf("flushing redacted output: %w", err)
	}

	w.pending = nil

	return nil
}
