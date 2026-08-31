package agents

import (
	"testing"

	"github.com/nhost/nhost/services/ai/agents/provider"
	providermock "github.com/nhost/nhost/services/ai/agents/provider/mock"
	"go.uber.org/mock/gomock"
)

func TestNewServiceClonesProviderRegistry(t *testing.T) {
	t.Parallel()

	configuredProvider := providermock.NewMockProvider(gomock.NewController(t))
	providers := provider.Registry{
		provider.ProviderOpenAI: configuredProvider,
	}

	service := NewService(
		nil,
		nil,
		providers,
		ToolConfig{BraveKey: "", TavilyKey: ""},
		"",
		"",
		"http://hasura.test/v1/graphql",
	)
	if service == nil {
		t.Fatal("NewService() returned nil for a configured provider")
	}

	delete(providers, provider.ProviderOpenAI)

	gotProvider, ok := service.providers[provider.ProviderOpenAI]
	if !ok {
		t.Fatal("NewService() provider registry changed when the input registry was mutated")
	}

	if gotProvider != configuredProvider {
		t.Error("NewService() stored an unexpected provider")
	}
}
