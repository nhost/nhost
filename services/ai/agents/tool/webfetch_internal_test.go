package tool

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/nhost/nhost/services/ai/internal/httpsafe"
)

// TestWebFetchSSRFProtection is the integration-level proof that the wired-up
// WebFetch refuses to dial loopback. The unit-level checks for the SSRF
// dialer and the IP allowlist live in internal/httpsafe.
func TestWebFetchSSRFProtection(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("secret data"))
	}))
	defer srv.Close()

	wf := NewWebFetch()

	_, err := wf.Execute(
		context.Background(),
		`{"url":"`+srv.URL+`"}`,
		slog.Default(),
	)
	if err == nil {
		t.Fatal("expected error for loopback address, got nil")
	}

	var ssrfErr httpsafe.ErrPrivateIPAccessError
	if !errors.As(err, &ssrfErr) {
		t.Logf("error did not unwrap to ErrPrivateIPAccess: %v", err)
	}
}

func TestWebFetchExecuteRejectsBadSchemes(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		url  string
	}{
		{name: "file", url: "file:///etc/passwd"},
		{name: "gopher", url: "gopher://example.com/"},
		{name: "protocol-relative", url: "//evil.com/x"},
	}

	wf := NewWebFetch()

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			args := `{"url":"` + tc.url + `"}`

			_, err := wf.Execute(context.Background(), args, slog.Default())
			if err == nil {
				t.Fatalf("expected error for %q, got nil", tc.url)
			}

			if !errors.Is(err, httpsafe.ErrInvalidScheme) &&
				!errors.Is(err, httpsafe.ErrInvalidURL) {
				t.Errorf("expected scheme/url validation error, got %v", err)
			}
		})
	}
}

func TestConvertBody(t *testing.T) {
	t.Parallel()

	wf := NewWebFetch()

	cases := []struct {
		name        string
		body        []byte
		contentType string
		wantExact   string // empty means: just assert non-empty and not equal to body
	}{
		{
			name:        "html to markdown",
			body:        []byte("<h1>Title</h1><p>Hello world</p>"),
			contentType: "text/html; charset=utf-8",
		},
		{
			name:        "plain text passthrough",
			body:        []byte("just plain text"),
			contentType: "text/plain",
			wantExact:   "just plain text",
		},
		{
			name:        "json passthrough",
			body:        []byte(`{"key":"value"}`),
			contentType: "application/json",
			wantExact:   `{"key":"value"}`,
		},
		{
			name:        "xhtml converted",
			body:        []byte("<p>xhtml content</p>"),
			contentType: "application/xhtml+xml",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			result, err := wf.convertBody(tc.body, tc.contentType)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if tc.wantExact != "" {
				if result != tc.wantExact {
					t.Errorf("expected %q, got %q", tc.wantExact, result)
				}

				return
			}

			if result == "" {
				t.Fatal("expected non-empty result")
			}

			if result == string(tc.body) {
				t.Error("expected body to be converted, got same string back")
			}
		})
	}
}

func TestWebFetchRejectsUnsafeRedirects(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		location string
	}{
		{name: "redirect to file scheme", location: "file:///etc/passwd"},
		{name: "redirect to gopher scheme", location: "gopher://example.com/"},
		{name: "redirect to data scheme", location: "data:text/plain,hello"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			redirector := httptest.NewServer(http.HandlerFunc(
				func(w http.ResponseWriter, _ *http.Request) {
					http.Redirect(w, &http.Request{}, tc.location, http.StatusFound)
				},
			))
			defer redirector.Close()

			// Drop the SSRF dialer for the *initial* hop so we can reach the
			// loopback redirector; the redirect-time validation under test
			// runs purely against the Location URL.
			wf := &WebFetch{
				client: &http.Client{
					Timeout:       webFetchTimeout,
					CheckRedirect: NewWebFetch().client.CheckRedirect,
				},
			}

			_, _, err := wf.doFetch(context.Background(), redirector.URL)
			if err == nil {
				t.Fatalf("expected redirect to %q to be rejected, got nil", tc.location)
			}

			if !errors.Is(err, httpsafe.ErrInvalidScheme) {
				t.Errorf("expected ErrInvalidScheme, got %v", err)
			}
		})
	}
}

func TestWebFetchExecuteInvalidArgs(t *testing.T) {
	t.Parallel()

	wf := NewWebFetch()

	_, err := wf.Execute(context.Background(), "not json", slog.Default())
	if err == nil {
		t.Fatal("expected error for invalid JSON arguments")
	}
}

func TestWebFetchDoFetchNonOKStatus(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	// Use a WebFetch with a plain transport (no SSRF check) so we can reach the test server.
	wf := &WebFetch{
		client: &http.Client{Timeout: webFetchTimeout},
	}

	body, _, err := wf.doFetch(context.Background(), srv.URL)
	if err == nil {
		t.Fatal("expected error for non-OK status")
	}

	if !errors.Is(err, errHTTPFetchFailed) {
		t.Errorf("expected errHTTPFetchFailed, got %v", err)
	}

	if body != nil {
		t.Errorf("expected nil body, got %v", body)
	}
}

func TestWebFetchDoFetchSuccess(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("hello"))
	}))
	defer srv.Close()

	wf := &WebFetch{
		client: &http.Client{Timeout: webFetchTimeout},
	}

	body, contentType, err := wf.doFetch(context.Background(), srv.URL)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if string(body) != "hello" {
		t.Errorf("expected 'hello', got %q", string(body))
	}

	if contentType != "text/plain" {
		t.Errorf("expected 'text/plain', got %q", contentType)
	}
}

func TestTruncateOutput(t *testing.T) {
	t.Parallel()

	// 3-byte UTF-8 rune (U+4E16). Built from bytes to avoid embedding non-ASCII source.
	multibyte := string([]byte{0xE4, 0xB8, 0x96})

	cases := []struct {
		name  string
		build func() string
	}{
		{
			name: "below limit returns input unchanged",
			build: func() string {
				return strings.Repeat("a", webFetchMaxOutputSize-10) + multibyte
			},
		},
		{
			name: "cut lands mid-rune (1 byte into multibyte)",
			build: func() string {
				// Pad so the multibyte rune straddles the cut: rune starts at
				// webFetchMaxOutputSize-1, so byte at index webFetchMaxOutputSize
				// is the second byte of a 3-byte rune.
				return strings.Repeat("a", webFetchMaxOutputSize-1) +
					multibyte +
					strings.Repeat("b", 1024)
			},
		},
		{
			name: "cut lands mid-rune (2 bytes into multibyte)",
			build: func() string {
				return strings.Repeat("a", webFetchMaxOutputSize-2) +
					multibyte +
					strings.Repeat("b", 1024)
			},
		},
		{
			name: "cut lands on rune boundary",
			build: func() string {
				return strings.Repeat("a", webFetchMaxOutputSize) +
					multibyte +
					strings.Repeat("b", 1024)
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			input := tc.build()
			got := truncateOutput(input)

			if !utf8.ValidString(got) {
				t.Errorf("truncateOutput produced invalid UTF-8")
			}

			if len(input) <= webFetchMaxOutputSize {
				if got != input {
					t.Errorf("expected input returned unchanged when below limit")
				}

				return
			}

			if !strings.HasSuffix(got, truncatedMarkdownTag) {
				t.Errorf("expected truncation marker suffix, got %q", got[len(got)-32:])
			}

			if len(got) > webFetchMaxOutputSize+len(truncatedMarkdownTag) {
				t.Errorf(
					"truncated output too long: got %d, max %d",
					len(got),
					webFetchMaxOutputSize+len(truncatedMarkdownTag),
				)
			}
		})
	}
}

func TestWebFetchDefinition(t *testing.T) {
	t.Parallel()

	wf := NewWebFetch()
	def := wf.Definition()

	if def.Name != "web_fetch" {
		t.Errorf("expected name 'web_fetch', got %q", def.Name)
	}

	if def.Description == "" {
		t.Error("expected non-empty description")
	}

	props, ok := def.Parameters["properties"]
	if !ok {
		t.Fatal("expected 'properties' in parameters")
	}

	propsMap, ok := props.(map[string]any)
	if !ok {
		t.Fatal("expected properties to be a map")
	}

	if _, ok := propsMap["url"]; !ok {
		t.Error("expected 'url' property")
	}
}
