package provider_test

import (
	"testing"

	"github.com/nhost/nhost/services/ai/agents/provider"
)

func TestNewProvider(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		provider provider.Name
		apiKey   string
		model    string
		wantErr  bool
	}{
		{
			name:     "anthropic",
			provider: provider.ProviderAnthropic,
			apiKey:   "test-key",
			model:    "claude-sonnet-4-20250514",
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

			p, err := provider.NewProvider(t.Context(), tc.provider, tc.apiKey, tc.model)
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

func TestUnknownProviderError(t *testing.T) {
	t.Parallel()

	err := provider.UnknownProviderError{Provider: "foobar"}
	if err.Error() != "unknown provider: foobar" {
		t.Errorf("unexpected error message: %s", err.Error())
	}
}
