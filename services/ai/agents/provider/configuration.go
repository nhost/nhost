package provider

import (
	"context"
	"errors"

	"github.com/nhost/nhost/services/ai/internal/providerconfig"
)

const (
	providerTypeAnthropicMessages     = "anthropic_messages"
	providerTypeGoogleGemini          = "google_gemini"
	providerTypeOpenAIChatCompletions = "openai_chat_completions"
	providerTypeOpenAIResponses       = "openai_responses"
)

var errInvalidAgentProviderConfiguration = errors.New("invalid agent provider configuration")

type providerDeclaration struct {
	name           string
	typeDescriptor *providerTypeDescriptor
	configuration  endpointConfiguration
}

type providerTypeDescriptor struct {
	name             string
	newConfiguration func(string, map[string]string) (endpointConfiguration, error)
	newProvider      func(context.Context, endpointConfiguration) (Provider, error)
}

// BuildConfiguredProviders strictly validates raw provider declarations and
// atomically constructs the configured registry. The returned metadata contains
// only provider names and adapter types; it is safe to use for startup summary
// logging.
func BuildConfiguredProviders(
	ctx context.Context,
	raw string,
) (Registry, map[string]string, error) {
	declarations, err := parseProviderDeclarations(raw)
	if err != nil {
		return nil, nil, err
	}

	return buildProviderRegistry(ctx, declarations)
}

func buildProviderRegistry(
	ctx context.Context,
	declarations []providerDeclaration,
) (Registry, map[string]string, error) {
	registry := make(Registry, len(declarations))
	typesByName := make(map[string]string, len(declarations))

	for declarationIndex, declaration := range declarations {
		if declaration.typeDescriptor == nil {
			return nil, nil, newAgentProviderConfigurationError(
				declarationIndex,
				declaration.name,
				"unsupported provider type",
			)
		}

		configuredProvider, err := declaration.typeDescriptor.newProvider(
			ctx,
			declaration.configuration,
		)
		if err != nil {
			return nil, nil, newAgentProviderConfigurationError(
				declarationIndex,
				declaration.name,
				"provider construction failed",
			)
		}

		registry[declaration.name] = configuredProvider
		typesByName[declaration.name] = declaration.typeDescriptor.name
	}

	return registry, typesByName, nil
}

func lookupProviderTypeDescriptor(providerType string) (*providerTypeDescriptor, bool) {
	switch providerType {
	case providerTypeAnthropicMessages:
		return &providerTypeDescriptor{
			name:             providerTypeAnthropicMessages,
			newConfiguration: newAnthropicMessagesConfiguration,
			newProvider: func(
				_ context.Context,
				configuration endpointConfiguration,
			) (Provider, error) {
				return newAnthropicMessages(configuration), nil
			},
		}, true
	case providerTypeGoogleGemini:
		return &providerTypeDescriptor{
			name:             providerTypeGoogleGemini,
			newConfiguration: newGoogleGeminiConfiguration,
			newProvider: func(
				ctx context.Context,
				configuration endpointConfiguration,
			) (Provider, error) {
				return newGoogleGemini(ctx, configuration)
			},
		}, true
	case providerTypeOpenAIChatCompletions:
		return &providerTypeDescriptor{
			name:             providerTypeOpenAIChatCompletions,
			newConfiguration: newOpenAIChatCompletionsConfiguration,
			newProvider: func(
				_ context.Context,
				configuration endpointConfiguration,
			) (Provider, error) {
				return newOpenAIChatCompletions(configuration), nil
			},
		}, true
	case providerTypeOpenAIResponses:
		return &providerTypeDescriptor{
			name:             providerTypeOpenAIResponses,
			newConfiguration: newOpenAIResponsesConfiguration,
			newProvider: func(
				_ context.Context,
				configuration endpointConfiguration,
			) (Provider, error) {
				return newOpenAIResponses(configuration), nil
			},
		}, true
	default:
		return nil, false
	}
}

func newAgentProviderConfigurationError(index int, name, rule string) error {
	//nolint:wrapcheck // The shared error already supplies the complete agent context and error-string contract.
	return providerconfig.NewError(
		errInvalidAgentProviderConfiguration,
		index,
		name,
		rule,
	)
}

func parseProviderDeclarations(raw string) ([]providerDeclaration, error) {
	declarations, err := providerconfig.Parse(
		raw,
		errInvalidAgentProviderConfiguration,
		func(providerType string) (func(string, map[string]string) (endpointConfiguration, error), bool) {
			descriptor, ok := lookupProviderTypeDescriptor(providerType)
			if !ok {
				return nil, false
			}

			return descriptor.newConfiguration, true
		},
	)
	if err != nil {
		return nil, err //nolint:wrapcheck // Preserve the shared parser's complete agent error-string contract.
	}

	result := make([]providerDeclaration, 0, len(declarations))
	for _, declaration := range declarations {
		descriptor, _ := lookupProviderTypeDescriptor(declaration.Type)
		result = append(
			result,
			providerDeclaration{
				name:           declaration.Name,
				typeDescriptor: descriptor,
				configuration:  declaration.Configuration,
			},
		)
	}

	return result, nil
}
