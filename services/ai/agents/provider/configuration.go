package provider

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"unicode/utf8"
)

const (
	providerTypeAnthropicMessages     = "anthropic_messages"
	providerTypeOpenAIChatCompletions = "openai_chat_completions"
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
	newProvider      func(endpointConfiguration) Provider
}

type decodedProviderDeclaration struct {
	name          string
	providerType  string
	configuration decodedProviderConfiguration
}

type decodedProviderConfiguration struct {
	baseURL string
	headers map[string]string
}

type agentProviderConfigurationError struct {
	declarationIndex int
	providerName     string
	rule             string
}

func (e *agentProviderConfigurationError) Error() string {
	if e.declarationIndex < 0 {
		return fmt.Sprintf("%s: %s", errInvalidAgentProviderConfiguration, e.rule)
	}

	if e.providerName == "" {
		return fmt.Sprintf(
			"%s: declaration %d: %s",
			errInvalidAgentProviderConfiguration,
			e.declarationIndex,
			e.rule,
		)
	}

	return fmt.Sprintf(
		"%s: declaration %d (%s): %s",
		errInvalidAgentProviderConfiguration,
		e.declarationIndex,
		e.providerName,
		e.rule,
	)
}

func (*agentProviderConfigurationError) Unwrap() error {
	return errInvalidAgentProviderConfiguration
}

func newAgentProviderConfigurationError(
	declarationIndex int,
	providerName string,
	rule string,
) error {
	return &agentProviderConfigurationError{
		declarationIndex: declarationIndex,
		providerName:     providerName,
		rule:             rule,
	}
}

// buildConfiguredProviders is staged privately until the aggregate provider
// configuration becomes the service's runtime contract. It returns only
// configuration-free metadata alongside the atomic registry.
func buildConfiguredProviders(raw string) (Registry, map[string]string, error) {
	declarations, err := parseProviderDeclarations(raw)
	if err != nil {
		return nil, nil, err
	}

	return buildProviderRegistry(declarations)
}

func buildProviderRegistry(
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

		registry[declaration.name] = declaration.typeDescriptor.newProvider(
			declaration.configuration,
		)
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
			newProvider: func(configuration endpointConfiguration) Provider {
				return newAnthropicMessages(configuration)
			},
		}, true
	case providerTypeOpenAIChatCompletions:
		return &providerTypeDescriptor{
			name:             providerTypeOpenAIChatCompletions,
			newConfiguration: newOpenAIChatCompletionsConfiguration,
			newProvider: func(configuration endpointConfiguration) Provider {
				return newOpenAIChatCompletions(configuration)
			},
		}, true
	default:
		return nil, false
	}
}

func parseProviderDeclarations(raw string) ([]providerDeclaration, error) {
	if strings.TrimSpace(raw) == "" {
		return []providerDeclaration{}, nil
	}

	if !utf8.ValidString(raw) {
		return nil, newAgentProviderConfigurationError(-1, "", "input must be valid UTF-8")
	}

	decoder := json.NewDecoder(strings.NewReader(raw))

	decoded, err := decodeProviderArray(decoder)
	if err != nil {
		return nil, err
	}

	trailing, err := decoder.Token()
	if !errors.Is(err, io.EOF) || trailing != nil {
		return nil, newAgentProviderConfigurationError(-1, "", "one JSON document is required")
	}

	return validateProviderDeclarations(decoded)
}

func decodeProviderArray(decoder *json.Decoder) ([]decodedProviderDeclaration, error) {
	opening, err := decoder.Token()
	if err != nil {
		return nil, newAgentProviderConfigurationError(-1, "", "invalid JSON")
	}

	openingDelimiter, ok := opening.(json.Delim)
	if !ok || openingDelimiter != '[' {
		return nil, newAgentProviderConfigurationError(-1, "", "array root is required")
	}

	declarations := make([]decodedProviderDeclaration, 0)
	for decoder.More() {
		declarationIndex := len(declarations)

		declaration, err := decodeProviderDeclaration(decoder, declarationIndex)
		if err != nil {
			return nil, err
		}

		declarations = append(declarations, declaration)
	}

	closing, err := decoder.Token()
	if err != nil {
		return nil, newAgentProviderConfigurationError(-1, "", "invalid JSON array")
	}

	closingDelimiter, ok := closing.(json.Delim)
	if !ok || closingDelimiter != ']' {
		return nil, newAgentProviderConfigurationError(-1, "", "invalid JSON array")
	}

	return declarations, nil
}

func decodeProviderDeclaration(
	decoder *json.Decoder,
	declarationIndex int,
) (decodedProviderDeclaration, error) {
	if err := expectObjectStart(
		decoder,
		declarationIndex,
		"declaration object is required",
	); err != nil {
		return decodedProviderDeclaration{}, err
	}

	var declaration decodedProviderDeclaration

	seen := make(map[string]struct{})

	for decoder.More() {
		field, err := decodeObjectField(decoder, declarationIndex, seen, "declaration")
		if err != nil {
			return decodedProviderDeclaration{}, err
		}

		switch field {
		case "name":
			declaration.name, err = decodeString(
				decoder,
				declarationIndex,
				"name must be a string",
			)
		case "type":
			declaration.providerType, err = decodeString(
				decoder,
				declarationIndex,
				"type must be a string",
			)
		case "configuration":
			declaration.configuration, err = decodeProviderConfiguration(
				decoder,
				declarationIndex,
			)
		default:
			return decodedProviderDeclaration{}, newAgentProviderConfigurationError(
				declarationIndex,
				"",
				"unknown declaration field",
			)
		}

		if err != nil {
			return decodedProviderDeclaration{}, err
		}
	}

	if err := expectObjectEnd(decoder, declarationIndex, "invalid declaration object"); err != nil {
		return decodedProviderDeclaration{}, err
	}

	if err := validateRequiredDeclarationFields(seen, declarationIndex); err != nil {
		return decodedProviderDeclaration{}, err
	}

	return declaration, nil
}

func validateRequiredDeclarationFields(
	seen map[string]struct{},
	declarationIndex int,
) error {
	for _, required := range []string{"name", "type", "configuration"} {
		if _, ok := seen[required]; !ok {
			return newAgentProviderConfigurationError(
				declarationIndex,
				"",
				"missing required declaration field",
			)
		}
	}

	return nil
}

func decodeProviderConfiguration(
	decoder *json.Decoder,
	declarationIndex int,
) (decodedProviderConfiguration, error) {
	if err := expectObjectStart(
		decoder,
		declarationIndex,
		"configuration object is required",
	); err != nil {
		return decodedProviderConfiguration{}, err
	}

	configuration := decodedProviderConfiguration{
		baseURL: "",
		headers: map[string]string{},
	}
	seen := make(map[string]struct{})

	for decoder.More() {
		field, err := decodeObjectField(decoder, declarationIndex, seen, "configuration")
		if err != nil {
			return decodedProviderConfiguration{}, err
		}

		switch field {
		case "base_url":
			configuration.baseURL, err = decodeString(
				decoder,
				declarationIndex,
				"base_url must be a string",
			)
		case "headers":
			configuration.headers, err = decodeProviderHeaders(decoder, declarationIndex)
		default:
			return decodedProviderConfiguration{}, newAgentProviderConfigurationError(
				declarationIndex,
				"",
				"unknown configuration field",
			)
		}

		if err != nil {
			return decodedProviderConfiguration{}, err
		}
	}

	if err := expectObjectEnd(
		decoder,
		declarationIndex,
		"invalid configuration object",
	); err != nil {
		return decodedProviderConfiguration{}, err
	}

	if _, ok := seen["base_url"]; !ok {
		return decodedProviderConfiguration{}, newAgentProviderConfigurationError(
			declarationIndex,
			"",
			"missing required base_url",
		)
	}

	return configuration, nil
}

func decodeProviderHeaders(
	decoder *json.Decoder,
	declarationIndex int,
) (map[string]string, error) {
	if err := expectObjectStart(
		decoder,
		declarationIndex,
		"headers object is required",
	); err != nil {
		return nil, err
	}

	headers := make(map[string]string)
	seen := make(map[string]struct{})

	for decoder.More() {
		nameToken, err := decoder.Token()
		if err != nil {
			return nil, newAgentProviderConfigurationError(
				declarationIndex,
				"",
				"invalid header name",
			)
		}

		name, ok := nameToken.(string)
		if !ok {
			return nil, newAgentProviderConfigurationError(
				declarationIndex,
				"",
				"invalid header name",
			)
		}

		foldedName := strings.ToLower(name)
		if _, ok := seen[foldedName]; ok {
			return nil, newAgentProviderConfigurationError(
				declarationIndex,
				"",
				"duplicate header name",
			)
		}

		seen[foldedName] = struct{}{}

		value, err := decodeString(
			decoder,
			declarationIndex,
			"header values must be strings",
		)
		if err != nil {
			return nil, err
		}

		headers[name] = value
	}

	if err := expectObjectEnd(decoder, declarationIndex, "invalid headers object"); err != nil {
		return nil, err
	}

	return headers, nil
}

func decodeObjectField(
	decoder *json.Decoder,
	declarationIndex int,
	seen map[string]struct{},
	objectName string,
) (string, error) {
	fieldToken, err := decoder.Token()
	if err != nil {
		return "", newAgentProviderConfigurationError(
			declarationIndex,
			"",
			"invalid "+objectName+" field",
		)
	}

	field, ok := fieldToken.(string)
	if !ok {
		return "", newAgentProviderConfigurationError(
			declarationIndex,
			"",
			"invalid "+objectName+" field",
		)
	}

	if _, ok := seen[field]; ok {
		return "", newAgentProviderConfigurationError(
			declarationIndex,
			"",
			"duplicate "+objectName+" field",
		)
	}

	seen[field] = struct{}{}

	return field, nil
}

func decodeString(
	decoder *json.Decoder,
	declarationIndex int,
	rule string,
) (string, error) {
	valueToken, err := decoder.Token()
	if err != nil {
		return "", newAgentProviderConfigurationError(declarationIndex, "", rule)
	}

	value, ok := valueToken.(string)
	if !ok {
		return "", newAgentProviderConfigurationError(declarationIndex, "", rule)
	}

	return value, nil
}

func expectObjectStart(
	decoder *json.Decoder,
	declarationIndex int,
	rule string,
) error {
	opening, err := decoder.Token()
	if err != nil {
		return newAgentProviderConfigurationError(declarationIndex, "", rule)
	}

	openingDelimiter, ok := opening.(json.Delim)
	if !ok || openingDelimiter != '{' {
		return newAgentProviderConfigurationError(declarationIndex, "", rule)
	}

	return nil
}

func expectObjectEnd(
	decoder *json.Decoder,
	declarationIndex int,
	rule string,
) error {
	closing, err := decoder.Token()
	if err != nil {
		return newAgentProviderConfigurationError(declarationIndex, "", rule)
	}

	closingDelimiter, ok := closing.(json.Delim)
	if !ok || closingDelimiter != '}' {
		return newAgentProviderConfigurationError(declarationIndex, "", rule)
	}

	return nil
}

func validateProviderDeclarations(
	decoded []decodedProviderDeclaration,
) ([]providerDeclaration, error) {
	declarations := make([]providerDeclaration, 0, len(decoded))
	seenNames := make(map[string]struct{}, len(decoded))

	for declarationIndex, declaration := range decoded {
		if !validProviderName(declaration.name) {
			return nil, newAgentProviderConfigurationError(
				declarationIndex,
				"",
				"invalid provider name",
			)
		}

		if _, ok := seenNames[declaration.name]; ok {
			return nil, newAgentProviderConfigurationError(
				declarationIndex,
				declaration.name,
				"duplicate provider name",
			)
		}

		seenNames[declaration.name] = struct{}{}

		typeDescriptor, ok := lookupProviderTypeDescriptor(declaration.providerType)
		if !ok {
			return nil, newAgentProviderConfigurationError(
				declarationIndex,
				declaration.name,
				"unknown provider type",
			)
		}

		configuration, err := typeDescriptor.newConfiguration(
			declaration.configuration.baseURL,
			declaration.configuration.headers,
		)
		if err != nil {
			rule := "invalid provider configuration"
			if errors.Is(err, errInvalidProviderBaseURL) {
				rule = "invalid base_url"
			} else if errors.Is(err, errInvalidProviderHeaders) {
				rule = "invalid headers"
			}

			return nil, newAgentProviderConfigurationError(
				declarationIndex,
				declaration.name,
				rule,
			)
		}

		declarations = append(declarations, providerDeclaration{
			name:           declaration.name,
			typeDescriptor: typeDescriptor,
			configuration:  configuration,
		})
	}

	return declarations, nil
}

func validProviderName(name string) bool {
	if len(name) == 0 || len(name) > 63 {
		return false
	}

	expectAlphaNumeric := true
	for index := range len(name) {
		char := name[index]

		alphaNumeric := ('a' <= char && char <= 'z') || ('0' <= char && char <= '9')
		if expectAlphaNumeric {
			if !alphaNumeric {
				return false
			}

			expectAlphaNumeric = false

			continue
		}

		if alphaNumeric {
			continue
		}

		if char != '.' && char != '_' && char != '-' {
			return false
		}

		expectAlphaNumeric = true
	}

	return !expectAlphaNumeric
}
