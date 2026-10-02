package agents

import (
	"testing"

	"github.com/nhost/nhost/services/ai/agents/provider"
	providermock "github.com/nhost/nhost/services/ai/agents/provider/mock"
	"go.uber.org/mock/gomock"
)

func TestNewServiceAllowsEmptyRegistryAndClonesConfiguredRegistry(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	configured := providermock.NewMockProvider(ctrl)
	input := provider.Registry{"configured": configured}

	service := NewService(
		nil,
		nil,
		input,
		ToolConfig{BraveKey: "", TavilyKey: ""},
		"http://ai.test",
		"admin-secret",
		"http://hasura.test/v1/graphql",
	)
	if service == nil {
		t.Fatal("NewService() returned nil for a configured registry")
	}

	delete(input, "configured")

	if service.providers["configured"] != configured {
		t.Fatal("service registry changed when the caller mutated its input")
	}

	emptyService := NewService(
		nil,
		nil,
		nil,
		ToolConfig{BraveKey: "", TavilyKey: ""},
		"http://ai.test",
		"admin-secret",
		"http://hasura.test/v1/graphql",
	)
	if emptyService == nil {
		t.Fatal("NewService() returned nil for an empty registry")
	}

	if len(emptyService.providers) != 0 {
		t.Fatalf("empty service registry length = %d, want 0", len(emptyService.providers))
	}
}
