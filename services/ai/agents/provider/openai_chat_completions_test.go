package provider_test

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/ai/agents/provider"
)

func TestNewOpenAIChatCompletions(t *testing.T) {
	t.Parallel()

	const model = "provider/request-scoped-model"

	requestModels := make(chan string, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request struct {
			Model string `json:"model"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Errorf("decode request: %v", err)
			w.WriteHeader(http.StatusBadRequest)

			return
		}

		requestModels <- request.Model

		w.Header().Set("Content-Type", "text/event-stream")

		if _, err := io.WriteString(w, "data: [DONE]\n\n"); err != nil {
			t.Errorf("write response: %v", err)
		}
	}))
	t.Cleanup(server.Close)

	config, err := provider.NewOpenAIChatCompletionsConfig(server.URL+"/v1", nil)
	if err != nil {
		t.Fatalf("create config: %v", err)
	}

	compatible, err := provider.NewOpenAIChatCompletions(config)
	if err != nil {
		t.Fatalf("create provider: %v", err)
	}

	events := compatible.StreamResponse(t.Context(), provider.StreamRequest{
		Model:        model,
		SystemPrompt: "",
		Messages: []provider.Message{
			{
				Role:       provider.RoleUser,
				Content:    "hello",
				ToolCalls:  nil,
				ToolCallID: "",
				ToolName:   "",
			},
		},
		Tools: nil,
	})
	for event := range events {
		if event.Type == provider.EventError {
			t.Fatalf("stream response: %v", event.Error)
		}
	}

	if got := <-requestModels; got != model {
		t.Errorf("request model = %q, want %q", got, model)
	}
}

func TestNewOpenAIChatCompletionsConfigBaseURLValidation(t *testing.T) {
	t.Parallel()

	invalidUTF8 := string([]byte{0xff})
	tests := []struct {
		name    string
		baseURL string
		wantErr bool
	}{
		{name: "missing scheme", baseURL: "//example.com/v1", wantErr: true},
		{name: "invalid utf8", baseURL: "https://example.com/" + invalidUTF8, wantErr: true},
		{name: "unsupported scheme", baseURL: "ftp://example.com/v1", wantErr: true},
		{name: "missing host", baseURL: "https:///v1", wantErr: true},
		{name: "opaque", baseURL: "https:example.com/v1", wantErr: true},
		{name: "userinfo", baseURL: "https://user:pass@example.com/v1", wantErr: true},
		{name: "query", baseURL: "https://example.com/v1?token=secret", wantErr: true},
		{name: "empty query", baseURL: "https://example.com/v1?", wantErr: true},
		{name: "fragment", baseURL: "https://example.com/v1#secret", wantErr: true},
		{name: "empty fragment", baseURL: "https://example.com/v1#", wantErr: true},
		{
			name:    "chat completions suffix",
			baseURL: "https://example.com/v1/chat/completions",
			wantErr: true,
		},
		{
			name:    "chat completions suffix with slash",
			baseURL: "https://example.com/v1/chat/completions/",
			wantErr: true,
		},
		{name: "bare host", baseURL: "localhost:11434/v1", wantErr: true},
		{name: "https root", baseURL: "https://example.com", wantErr: false},
		{name: "http local root", baseURL: "http://localhost:11434", wantErr: false},
		{name: "v1", baseURL: "http://localhost:11434/v1", wantErr: false},
		{name: "v1 slash", baseURL: "http://localhost:11434/v1/", wantErr: false},
		{name: "compat", baseURL: "https://example.com/compat", wantErr: false},
		{name: "compat slash", baseURL: "https://example.com/compat/", wantErr: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			config, err := provider.NewOpenAIChatCompletionsConfig(test.baseURL, nil)
			if test.wantErr {
				if err == nil {
					t.Fatal("expected an error")
				}

				if config != nil {
					t.Fatal("expected a nil config")
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if config == nil {
				t.Fatal("expected a config")
			}
		})
	}
}

func TestNewOpenAIChatCompletionsConfigBaseURLErrorIsSanitized(t *testing.T) {
	t.Parallel()

	const marker = "secret-url-marker"

	invalidURLs := []string{
		"://" + marker,
		"https://" + marker + "@example.com/v1",
		"https://example.com/v1?token=" + marker,
		"https://example.com/v1#" + marker,
	}

	var firstError string
	for _, baseURL := range invalidURLs {
		config, err := provider.NewOpenAIChatCompletionsConfig(baseURL, nil)
		if err == nil {
			t.Fatalf("expected %q to be rejected", baseURL)
		}

		if config != nil {
			t.Fatal("expected a nil config")
		}

		if strings.Contains(err.Error(), marker) || strings.Contains(err.Error(), baseURL) {
			t.Fatalf("error exposed rejected input: %v", err)
		}

		if firstError == "" {
			firstError = err.Error()
		} else if err.Error() != firstError {
			t.Fatalf("validation errors differ: %q != %q", err.Error(), firstError)
		}
	}
}

func TestNewOpenAIChatCompletionsConfigHeaderValidation(t *testing.T) {
	t.Parallel()

	invalidUTF8 := string([]byte{0xff})
	tests := []struct {
		name    string
		headers map[string]string
		wantErr bool
	}{
		{name: "nil", headers: nil, wantErr: false},
		{name: "empty", headers: map[string]string{}, wantErr: false},
		{
			name:    "authorization",
			headers: map[string]string{"Authorization": "Bearer explicit"},
			wantErr: false,
		},
		{
			name:    "custom",
			headers: map[string]string{"CF-AIG-Authorization": "Bearer gateway"},
			wantErr: false,
		},
		{
			name:    "case variant duplicate",
			headers: map[string]string{"X-Custom": "one", "x-custom": "two"},
			wantErr: true,
		},
		{name: "empty name", headers: map[string]string{"": "value"}, wantErr: true},
		{name: "space in name", headers: map[string]string{"X Bad": "value"}, wantErr: true},
		{name: "control in name", headers: map[string]string{"X\tBad": "value"}, wantErr: true},
		{name: "crlf in name", headers: map[string]string{"X\r\nBad": "value"}, wantErr: true},
		{name: "nul in name", headers: map[string]string{"X\x00Bad": "value"}, wantErr: true},
		{
			name:    "invalid utf8 name",
			headers: map[string]string{invalidUTF8: "value"},
			wantErr: true,
		},
		{name: "control in value", headers: map[string]string{"X-Test": "a\tb"}, wantErr: true},
		{name: "crlf in value", headers: map[string]string{"X-Test": "a\r\nb"}, wantErr: true},
		{name: "nul in value", headers: map[string]string{"X-Test": "a\x00b"}, wantErr: true},
		{
			name:    "invalid utf8 value",
			headers: map[string]string{"X-Test": invalidUTF8},
			wantErr: true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			config, err := provider.NewOpenAIChatCompletionsConfig(
				"https://example.com/v1",
				test.headers,
			)
			if test.wantErr {
				if err == nil {
					t.Fatal("expected an error")
				}

				if config != nil {
					t.Fatal("expected a nil config")
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if config == nil {
				t.Fatal("expected a config")
			}
		})
	}
}

func TestNewOpenAIChatCompletionsConfigRejectsReservedHeaders(t *testing.T) {
	t.Parallel()

	reserved := []string{
		"Host",
		"Content-Length",
		"Content-Type",
		"Accept",
		"Connection",
		"Keep-Alive",
		"Proxy-Authenticate",
		"Proxy-Authorization",
		"TE",
		"Trailer",
		"Transfer-Encoding",
		"Upgrade",
		"X-Stainless-Retry-Count",
		"x-stainless-custom",
	}

	for _, name := range reserved {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			config, err := provider.NewOpenAIChatCompletionsConfig(
				"https://example.com/v1",
				map[string]string{name: "secret-header-marker"},
			)
			if err == nil {
				t.Fatal("expected an error")
			}

			if config != nil {
				t.Fatal("expected a nil config")
			}

			if strings.Contains(err.Error(), name) ||
				strings.Contains(err.Error(), "secret-header-marker") {
				t.Fatalf("error exposed rejected input: %v", err)
			}
		})
	}
}
