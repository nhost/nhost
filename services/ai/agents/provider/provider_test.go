package provider_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/nhost/nhost/services/ai/agents/provider"
)

func TestNewProvider(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name        string
		provider    provider.Name
		apiKey      string
		model       string
		workspaceID string
		wantErr     bool
	}{
		{
			name:        "anthropic",
			provider:    provider.ProviderAnthropic,
			apiKey:      "test-key",
			model:       "claude-sonnet-4-20250514",
			workspaceID: "workspace-id",
		},
		{
			name:     "openai",
			provider: provider.ProviderOpenAI,
			apiKey:   "test-key",
			model:    "gpt-4o",
		},
		{
			name:     "google",
			provider: provider.ProviderGoogle,
			apiKey:   "test-key",
			model:    "gemini-2.0-flash",
		},
		{
			name:     "unknown provider",
			provider: "unknown",
			apiKey:   "test-key",
			model:    "some-model",
			wantErr:  true,
		},
		{
			name:     "empty provider",
			provider: "",
			apiKey:   "test-key",
			model:    "some-model",
			wantErr:  true,
		},
		{
			name:     "empty model",
			provider: provider.ProviderAnthropic,
			apiKey:   "test-key",
			model:    "",
			wantErr:  true,
		},
		{
			name:     "empty apiKey anthropic",
			provider: provider.ProviderAnthropic,
			apiKey:   "",
			model:    "claude-sonnet-4-20250514",
			wantErr:  true,
		},
		{
			name:     "empty apiKey openai",
			provider: provider.ProviderOpenAI,
			apiKey:   "",
			model:    "gpt-4o",
			wantErr:  true,
		},
		{
			name:     "empty apiKey google",
			provider: provider.ProviderGoogle,
			apiKey:   "",
			model:    "gemini-2.0-flash",
			wantErr:  true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			p, err := provider.NewProvider(
				t.Context(), tc.provider, tc.apiKey, tc.model, tc.workspaceID,
			)
			if tc.wantErr { //nolint:nestif
				if err == nil {
					t.Error("expected error, got nil")
				}

				if p != nil {
					t.Error("expected nil provider on error")
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}

				if p == nil {
					t.Error("expected non-nil provider")
				}
			}
		})
	}
}

func TestNewAnthropicWorkspaceIDHeader(t *testing.T) {
	requestHeaders := make(chan http.Header, 2)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestHeaders <- r.Header.Clone()

		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(server.Close)
	t.Setenv("ANTHROPIC_BASE_URL", server.URL)

	cases := []struct {
		name        string
		workspaceID string
		wantHeader  bool
	}{
		{name: "configured", workspaceID: "workspace-id", wantHeader: true},
		{name: "not configured", workspaceID: "", wantHeader: false},
	}

	for _, tc := range cases { //nolint:paralleltest // Subtests share the process-wide base URL.
		t.Run(tc.name, func(t *testing.T) {
			p := provider.NewAnthropic("test-key", "test-model", tc.workspaceID)
			messages := []provider.Message{
				{
					Role:       provider.RoleUser,
					Content:    "hello",
					ToolCalls:  nil,
					ToolCallID: "",
					ToolName:   "",
				},
			}

			for event := range p.StreamResponse(t.Context(), "", messages, nil) {
				if event.Error != nil {
					t.Fatalf("StreamResponse() returned an error: %v", event.Error)
				}
			}

			headers := <-requestHeaders

			values, hasHeader := headers[http.CanonicalHeaderKey("anthropic-workspace-id")]
			if hasHeader != tc.wantHeader {
				t.Fatalf(
					"anthropic-workspace-id header presence = %t, want %t",
					hasHeader,
					tc.wantHeader,
				)
			}

			if tc.wantHeader && (len(values) != 1 || values[0] != tc.workspaceID) {
				t.Errorf("anthropic-workspace-id header = %q, want %q", values, tc.workspaceID)
			}
		})
	}
}

func TestUnknownProviderError(t *testing.T) {
	t.Parallel()

	err := provider.UnknownProviderError{Provider: "foobar"}
	if err.Error() != "unknown provider: foobar" {
		t.Errorf("unexpected error message: %s", err.Error())
	}
}
