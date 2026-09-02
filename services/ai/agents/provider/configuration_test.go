package provider_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/ai/agents/provider"
)

func TestBuildConfiguredProvidersPublicContract(t *testing.T) {
	t.Parallel()

	raw := `[
		{"name":"anthropic","type":"anthropic_messages","configuration":{"base_url":"https://api.anthropic.com","headers":{"x-api-key":"anthropic-secret"}}},
		{"name":"google","type":"google_gemini","configuration":{"base_url":"https://generativelanguage.googleapis.com","headers":{"x-goog-api-key":"google-secret"}}},
		{"name":"openai","type":"openai_chat_completions","configuration":{"base_url":"https://api.openai.com/v1","headers":{"Authorization":"Bearer openai-secret"}}},
		{"name":"openai-responses","type":"openai_responses","configuration":{"base_url":"https://api.openai.com/v1","headers":{"Authorization":"Bearer responses-secret"}}}
	]`

	registry, typesByName, err := provider.BuildConfiguredProviders(t.Context(), raw)
	if err != nil {
		t.Fatalf("BuildConfiguredProviders() error = %v", err)
	}

	wantTypes := map[string]string{
		"anthropic":        "anthropic_messages",
		"google":           "google_gemini",
		"openai":           "openai_chat_completions",
		"openai-responses": "openai_responses",
	}
	if diff := cmp.Diff(wantTypes, typesByName); diff != "" {
		t.Errorf("provider metadata mismatch (-want +got):\n%s", diff)
	}

	for name := range wantTypes {
		configuredProvider := registry[name]
		if configuredProvider == nil {
			t.Errorf("registry provider %q is nil", name)

			continue
		}

		events := configuredProvider.StreamResponse(t.Context(), provider.StreamRequest{
			Model:        "",
			SystemPrompt: "",
			Messages:     nil,
			Tools:        nil,
		})

		event, ok := <-events
		if !ok || !errors.Is(event.Error, provider.ErrEmptyModel) {
			t.Errorf("provider %q empty-model event = %#v", name, event)
		}

		if _, ok := <-events; ok {
			t.Errorf("provider %q returned more than one empty-model event", name)
		}
	}
}

func TestBuildConfiguredProvidersFailureIsAtomicAndSecretSafe(t *testing.T) {
	t.Parallel()

	const secretMarker = "CONFIGURATION-SECRET-MARKER"

	raw := `[
		{"name":"valid","type":"openai_chat_completions","configuration":{"base_url":"https://api.openai.com/v1"}},
		{"name":"invalid","type":"openai_chat_completions","configuration":{"base_url":"https://example.com/` + secretMarker + `","headers":{"Host":"` + secretMarker + `"}}}
	]`

	registry, typesByName, err := provider.BuildConfiguredProviders(t.Context(), raw)
	if err == nil {
		t.Fatal("BuildConfiguredProviders() returned no error")
	}

	if registry != nil || typesByName != nil {
		t.Fatalf("partial result = %#v, %#v; want nil results", registry, typesByName)
	}

	if strings.Contains(err.Error(), secretMarker) || strings.Contains(err.Error(), raw) {
		t.Fatalf("configuration error exposed raw input: %v", err)
	}
}
