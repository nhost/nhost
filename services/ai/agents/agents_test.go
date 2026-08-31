package agents_test

import (
	"testing"

	"github.com/nhost/nhost/services/ai/agents"
	"github.com/nhost/nhost/services/ai/agents/provider"
	providermock "github.com/nhost/nhost/services/ai/agents/provider/mock"
	"go.uber.org/mock/gomock"
)

func TestNewService(t *testing.T) {
	t.Parallel()

	configuredProvider := providermock.NewMockProvider(gomock.NewController(t))
	tests := []struct {
		name      string
		providers provider.Registry
		wantNil   bool
	}{
		{
			name:      "nil registry",
			providers: nil,
			wantNil:   true,
		},
		{
			name:      "empty registry",
			providers: provider.Registry{},
			wantNil:   true,
		},
		{
			name: "configured provider",
			providers: provider.Registry{
				provider.ProviderOpenAI: configuredProvider,
			},
			wantNil: false,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			service := agents.NewService(
				nil,
				nil,
				test.providers,
				agents.ToolConfig{BraveKey: "", TavilyKey: ""},
				"",
				"",
				"http://hasura.test/v1/graphql",
			)
			if (service == nil) != test.wantNil {
				t.Errorf("NewService() nil = %t, want %t", service == nil, test.wantNil)
			}
		})
	}
}
