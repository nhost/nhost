package provider_test

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/nhost/nhost/services/ai/agents/provider"
)

func TestProviderConstructors(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name        string
		newProvider func(context.Context) (provider.Provider, error)
		wantErr     error
	}{
		{
			name: "anthropic",
			newProvider: func(_ context.Context) (provider.Provider, error) {
				return provider.NewAnthropic(provider.AnthropicConfig{
					APIKey:      "test-key",
					WorkspaceID: "workspace-id",
				})
			},
			wantErr: nil,
		},
		{
			name: "openai",
			newProvider: func(_ context.Context) (provider.Provider, error) {
				return provider.NewOpenAI(provider.OpenAIConfig{APIKey: "test-key"})
			},
			wantErr: nil,
		},
		{
			name: "google",
			newProvider: func(ctx context.Context) (provider.Provider, error) {
				return provider.NewGoogle(ctx, provider.GoogleConfig{APIKey: "test-key"})
			},
			wantErr: nil,
		},
		{
			name: "anthropic rejects empty API key",
			newProvider: func(_ context.Context) (provider.Provider, error) {
				return provider.NewAnthropic(provider.AnthropicConfig{
					APIKey:      "",
					WorkspaceID: "",
				})
			},
			wantErr: provider.ErrEmptyAPIKey,
		},
		{
			name: "openai rejects empty API key",
			newProvider: func(_ context.Context) (provider.Provider, error) {
				return provider.NewOpenAI(provider.OpenAIConfig{APIKey: ""})
			},
			wantErr: provider.ErrEmptyAPIKey,
		},
		{
			name: "google rejects empty API key",
			newProvider: func(ctx context.Context) (provider.Provider, error) {
				return provider.NewGoogle(ctx, provider.GoogleConfig{APIKey: ""})
			},
			wantErr: provider.ErrEmptyAPIKey,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			p, err := tc.newProvider(t.Context())
			if tc.wantErr != nil {
				if !errors.Is(err, tc.wantErr) {
					t.Fatalf("error = %v, want %v", err, tc.wantErr)
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if p == nil {
				t.Error("expected non-nil provider")
			}
		})
	}
}

type capturedRequest struct {
	path   string
	body   string
	header http.Header
}

func TestProvidersConcurrentRequests(t *testing.T) {
	requests := []provider.StreamRequest{
		{
			Model:        "model-a",
			SystemPrompt: "prompt-a",
			Messages: []provider.Message{
				{
					Role:       provider.RoleUser,
					Content:    "message-a",
					ToolCalls:  nil,
					ToolCallID: "",
					ToolName:   "",
				},
			},
			Tools: nil,
		},
		{
			Model:        "model-b",
			SystemPrompt: "prompt-b",
			Messages: []provider.Message{
				{
					Role:       provider.RoleUser,
					Content:    "message-b",
					ToolCalls:  nil,
					ToolCallID: "",
					ToolName:   "",
				},
			},
			Tools: nil,
		},
	}

	cases := []struct {
		name          string
		baseURLEnv    string
		baseURL       func(string) string
		newProvider   func(context.Context) (provider.Provider, error)
		wantWorkspace bool
	}{
		{
			name:       "anthropic",
			baseURLEnv: "ANTHROPIC_BASE_URL",
			baseURL:    func(url string) string { return url },
			newProvider: func(_ context.Context) (provider.Provider, error) {
				return provider.NewAnthropic(provider.AnthropicConfig{
					APIKey:      "test-key",
					WorkspaceID: "workspace-id",
				})
			},
			wantWorkspace: true,
		},
		{
			name:       "openai",
			baseURLEnv: "OPENAI_BASE_URL",
			baseURL:    func(url string) string { return url + "/" },
			newProvider: func(_ context.Context) (provider.Provider, error) {
				return provider.NewOpenAI(provider.OpenAIConfig{APIKey: "test-key"})
			},
			wantWorkspace: false,
		},
		{
			name:       "google",
			baseURLEnv: "GOOGLE_GEMINI_BASE_URL",
			baseURL:    func(url string) string { return url },
			newProvider: func(ctx context.Context) (provider.Provider, error) {
				return provider.NewGoogle(ctx, provider.GoogleConfig{APIKey: "test-key"})
			},
			wantWorkspace: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			captured := make(chan capturedRequest, len(requests))
			server := httptest.NewServer(
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					body, err := io.ReadAll(r.Body)
					if err != nil {
						t.Errorf("read request body: %v", err)
					}

					captured <- capturedRequest{
						path:   r.URL.Path,
						body:   string(body),
						header: r.Header.Clone(),
					}

					w.Header().Set("Content-Type", "text/event-stream")
					w.WriteHeader(http.StatusOK)
				}),
			)
			t.Cleanup(server.Close)
			t.Setenv(tc.baseURLEnv, tc.baseURL(server.URL))

			p, err := tc.newProvider(t.Context())
			if err != nil {
				t.Fatalf("construct provider: %v", err)
			}

			streamConcurrently(t, p, requests)
			close(captured)

			got := make([]capturedRequest, 0, len(requests))
			for request := range captured {
				got = append(got, request)
			}

			if len(got) != len(requests) {
				t.Fatalf("captured %d requests, want %d", len(got), len(requests))
			}

			assertConcurrentRequests(t, got, requests, tc.wantWorkspace)
		})
	}
}

func streamConcurrently(
	t *testing.T,
	p provider.Provider,
	requests []provider.StreamRequest,
) {
	t.Helper()

	errs := make(chan error, len(requests))

	var wg sync.WaitGroup

	for _, request := range requests {
		wg.Go(func() {
			for event := range p.StreamResponse(t.Context(), request) {
				if event.Error != nil {
					errs <- event.Error

					return
				}
			}

			errs <- nil
		})
	}

	wg.Wait()
	close(errs)

	for err := range errs {
		if err != nil {
			t.Errorf("StreamResponse() returned an error: %v", err)
		}
	}
}

func assertConcurrentRequests(
	t *testing.T,
	got []capturedRequest,
	want []provider.StreamRequest,
	wantWorkspace bool,
) {
	t.Helper()

	for _, request := range want {
		var matching *capturedRequest
		for idx := range got {
			payload := got[idx].path + "\n" + got[idx].body
			if strings.Contains(payload, request.Model) {
				matching = &got[idx]

				break
			}
		}

		if matching == nil {
			t.Errorf("no outgoing request contains model %q", request.Model)

			continue
		}

		payload := matching.path + "\n" + matching.body
		for _, value := range []string{request.SystemPrompt, request.Messages[0].Content} {
			if !strings.Contains(payload, value) {
				t.Errorf(
					"request for model %q does not contain %q: %s",
					request.Model,
					value,
					payload,
				)
			}
		}

		workspaceID := matching.header.Get("anthropic-workspace-id")
		if wantWorkspace && workspaceID != "workspace-id" {
			t.Errorf("workspace header = %q, want %q", workspaceID, "workspace-id")
		}

		if !wantWorkspace && workspaceID != "" {
			t.Errorf("unexpected workspace header %q", workspaceID)
		}
	}
}

func TestProvidersRejectEmptyModel(t *testing.T) {
	t.Parallel()

	anthropic, err := provider.NewAnthropic(provider.AnthropicConfig{
		APIKey:      "test-key",
		WorkspaceID: "",
	})
	if err != nil {
		t.Fatalf("NewAnthropic() returned an error: %v", err)
	}

	openAI, err := provider.NewOpenAI(provider.OpenAIConfig{APIKey: "test-key"})
	if err != nil {
		t.Fatalf("NewOpenAI() returned an error: %v", err)
	}

	google, err := provider.NewGoogle(t.Context(), provider.GoogleConfig{APIKey: "test-key"})
	if err != nil {
		t.Fatalf("NewGoogle() returned an error: %v", err)
	}

	providers := map[provider.Name]provider.Provider{
		provider.ProviderAnthropic: anthropic,
		provider.ProviderOpenAI:    openAI,
		provider.ProviderGoogle:    google,
	}

	for name, p := range providers {
		t.Run(string(name), func(t *testing.T) {
			t.Parallel()

			eventCh := p.StreamResponse(t.Context(), provider.StreamRequest{
				Model:        "",
				SystemPrompt: "",
				Messages:     nil,
				Tools:        nil,
			})

			event, ok := <-eventCh
			if !ok {
				t.Fatal("StreamResponse() returned no error event")
			}

			if !errors.Is(event.Error, provider.ErrEmptyModel) {
				t.Errorf("error = %v, want %v", event.Error, provider.ErrEmptyModel)
			}

			if _, ok := <-eventCh; ok {
				t.Error("StreamResponse() returned more than one event")
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
			p, err := provider.NewAnthropic(provider.AnthropicConfig{
				APIKey:      "test-key",
				WorkspaceID: tc.workspaceID,
			})
			if err != nil {
				t.Fatalf("NewAnthropic() returned an error: %v", err)
			}

			request := provider.StreamRequest{
				Model:        "test-model",
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
			}

			for event := range p.StreamResponse(t.Context(), request) {
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
