// Package providerconfig validates trusted startup provider declarations and
// endpoints, and supplies credential-safe logging and no-redirect HTTP clients.
package providerconfig

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"unicode/utf8"
)

type decodedProviderDeclaration struct {
	name          string
	providerType  string
	configuration decodedProviderConfiguration
}

type decodedProviderConfiguration struct {
	baseURL string
	headers map[string]string
}

type configurationError struct {
	sentinel         error
	declarationIndex int
	providerName     string
	rule             string
}

func (e *configurationError) Error() string {
	if e.declarationIndex < 0 {
		return fmt.Sprintf("%s: %s", e.sentinel, e.rule)
	}

	if e.providerName == "" {
		return fmt.Sprintf(
			"%s: declaration %d: %s",
			e.sentinel,
			e.declarationIndex,
			e.rule,
		)
	}

	return fmt.Sprintf(
		"%s: declaration %d (%s): %s",
		e.sentinel,
		e.declarationIndex,
		e.providerName,
		e.rule,
	)
}

func (e *configurationError) Unwrap() error {
	return e.sentinel
}

// NewError constructs an attributable, sanitized configuration error wrapping sentinel.
// The caller must supply only safe provider names and fixed rule text.
func NewError(sentinel error, declarationIndex int, providerName, rule string) error {
	return &configurationError{
		sentinel:         sentinel,
		declarationIndex: declarationIndex,
		providerName:     providerName,
		rule:             rule,
	}
}

type parser struct{ sentinel error }

func (p parser) newError(index int, name, rule string) error {
	return NewError(p.sentinel, index, name, rule)
}

// Declaration is a validated provider identity and its adapter-owned configuration.
type Declaration[T any] struct {
	Name          string
	Type          string
	Configuration T
}

// Parse strictly decodes declarations and validates each identity before invoking
// the adapter configuration constructor returned by lookupType. All failures
// wrap sentinel and omit raw configuration values.
func Parse[T any](
	raw string,
	sentinel error,
	lookupType func(string) (func(string, map[string]string) (T, error), bool),
) ([]Declaration[T], error) {
	p := parser{sentinel: sentinel}

	if strings.TrimSpace(raw) == "" {
		return []Declaration[T]{}, nil
	}

	if !utf8.ValidString(raw) {
		return nil, p.newError(-1, "", "input must be valid UTF-8")
	}

	decoder := json.NewDecoder(strings.NewReader(raw))

	decoded, err := p.decodeProviderArray(decoder)
	if err != nil {
		return nil, err
	}

	trailing, err := decoder.Token()
	if !errors.Is(err, io.EOF) || trailing != nil {
		return nil, p.newError(-1, "", "one JSON document is required")
	}

	return validateProviderDeclarations(p, decoded, lookupType)
}

func (p parser) decodeProviderArray(decoder *json.Decoder) ([]decodedProviderDeclaration, error) {
	opening, err := decoder.Token()
	if err != nil {
		return nil, p.newError(-1, "", "invalid JSON")
	}

	openingDelimiter, ok := opening.(json.Delim)
	if !ok || openingDelimiter != '[' {
		return nil, p.newError(-1, "", "array root is required")
	}

	declarations := make([]decodedProviderDeclaration, 0)
	for decoder.More() {
		declarationIndex := len(declarations)

		declaration, err := p.decodeProviderDeclaration(decoder, declarationIndex)
		if err != nil {
			return nil, err
		}

		declarations = append(declarations, declaration)
	}

	closing, err := decoder.Token()
	if err != nil {
		return nil, p.newError(-1, "", "invalid JSON array")
	}

	closingDelimiter, ok := closing.(json.Delim)
	if !ok || closingDelimiter != ']' {
		return nil, p.newError(-1, "", "invalid JSON array")
	}

	return declarations, nil
}

func (p parser) decodeProviderDeclaration(
	decoder *json.Decoder,
	declarationIndex int,
) (decodedProviderDeclaration, error) {
	if err := p.expectObjectStart(
		decoder,
		declarationIndex,
		"declaration object is required",
	); err != nil {
		return decodedProviderDeclaration{}, err
	}

	var declaration decodedProviderDeclaration

	seen := make(map[string]struct{})

	for decoder.More() {
		field, err := p.decodeObjectField(decoder, declarationIndex, seen, "declaration")
		if err != nil {
			return decodedProviderDeclaration{}, err
		}

		switch field {
		case "name":
			declaration.name, err = p.decodeString(
				decoder,
				declarationIndex,
				"name must be a string",
			)
		case "type":
			declaration.providerType, err = p.decodeString(
				decoder,
				declarationIndex,
				"type must be a string",
			)
		case "configuration":
			declaration.configuration, err = p.decodeProviderConfiguration(
				decoder,
				declarationIndex,
			)
		default:
			return decodedProviderDeclaration{}, p.newError(
				declarationIndex,
				"",
				"unknown declaration field",
			)
		}

		if err != nil {
			return decodedProviderDeclaration{}, err
		}
	}

	if err := p.expectObjectEnd(
		decoder,
		declarationIndex,
		"invalid declaration object",
	); err != nil {
		return decodedProviderDeclaration{}, err
	}

	if err := p.validateRequiredDeclarationFields(seen, declarationIndex); err != nil {
		return decodedProviderDeclaration{}, err
	}

	return declaration, nil
}

func (p parser) validateRequiredDeclarationFields(
	seen map[string]struct{},
	declarationIndex int,
) error {
	for _, required := range []string{"name", "type", "configuration"} {
		if _, ok := seen[required]; !ok {
			return p.newError(
				declarationIndex,
				"",
				"missing required declaration field",
			)
		}
	}

	return nil
}

func (p parser) decodeProviderConfiguration(
	decoder *json.Decoder,
	declarationIndex int,
) (decodedProviderConfiguration, error) {
	if err := p.expectObjectStart(
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
		field, err := p.decodeObjectField(decoder, declarationIndex, seen, "configuration")
		if err != nil {
			return decodedProviderConfiguration{}, err
		}

		switch field {
		case "base_url":
			configuration.baseURL, err = p.decodeString(
				decoder,
				declarationIndex,
				"base_url must be a string",
			)
		case "headers":
			configuration.headers, err = p.decodeProviderHeaders(decoder, declarationIndex)
		default:
			return decodedProviderConfiguration{}, p.newError(
				declarationIndex,
				"",
				"unknown configuration field",
			)
		}

		if err != nil {
			return decodedProviderConfiguration{}, err
		}
	}

	if err := p.expectObjectEnd(
		decoder,
		declarationIndex,
		"invalid configuration object",
	); err != nil {
		return decodedProviderConfiguration{}, err
	}

	if _, ok := seen["base_url"]; !ok {
		return decodedProviderConfiguration{}, p.newError(
			declarationIndex,
			"",
			"missing required base_url",
		)
	}

	return configuration, nil
}

func (p parser) decodeProviderHeaders(
	decoder *json.Decoder,
	declarationIndex int,
) (map[string]string, error) {
	if err := p.expectObjectStart(
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
			return nil, p.newError(
				declarationIndex,
				"",
				"invalid header name",
			)
		}

		name, ok := nameToken.(string)
		if !ok {
			return nil, p.newError(
				declarationIndex,
				"",
				"invalid header name",
			)
		}

		foldedName := strings.ToLower(name)
		if _, ok := seen[foldedName]; ok {
			return nil, p.newError(
				declarationIndex,
				"",
				"duplicate header name",
			)
		}

		seen[foldedName] = struct{}{}

		value, err := p.decodeString(
			decoder,
			declarationIndex,
			"header values must be strings",
		)
		if err != nil {
			return nil, err
		}

		headers[name] = value
	}

	if err := p.expectObjectEnd(decoder, declarationIndex, "invalid headers object"); err != nil {
		return nil, err
	}

	return headers, nil
}

func (p parser) decodeObjectField(
	decoder *json.Decoder,
	declarationIndex int,
	seen map[string]struct{},
	objectName string,
) (string, error) {
	fieldToken, err := decoder.Token()
	if err != nil {
		return "", p.newError(
			declarationIndex,
			"",
			"invalid "+objectName+" field",
		)
	}

	field, ok := fieldToken.(string)
	if !ok {
		return "", p.newError(
			declarationIndex,
			"",
			"invalid "+objectName+" field",
		)
	}

	if _, ok := seen[field]; ok {
		return "", p.newError(
			declarationIndex,
			"",
			"duplicate "+objectName+" field",
		)
	}

	seen[field] = struct{}{}

	return field, nil
}

func (p parser) decodeString(
	decoder *json.Decoder,
	declarationIndex int,
	rule string,
) (string, error) {
	valueToken, err := decoder.Token()
	if err != nil {
		return "", p.newError(declarationIndex, "", rule)
	}

	value, ok := valueToken.(string)
	if !ok {
		return "", p.newError(declarationIndex, "", rule)
	}

	return value, nil
}

func (p parser) expectObjectStart(
	decoder *json.Decoder,
	declarationIndex int,
	rule string,
) error {
	opening, err := decoder.Token()
	if err != nil {
		return p.newError(declarationIndex, "", rule)
	}

	openingDelimiter, ok := opening.(json.Delim)
	if !ok || openingDelimiter != '{' {
		return p.newError(declarationIndex, "", rule)
	}

	return nil
}

func (p parser) expectObjectEnd(
	decoder *json.Decoder,
	declarationIndex int,
	rule string,
) error {
	closing, err := decoder.Token()
	if err != nil {
		return p.newError(declarationIndex, "", rule)
	}

	closingDelimiter, ok := closing.(json.Delim)
	if !ok || closingDelimiter != '}' {
		return p.newError(declarationIndex, "", rule)
	}

	return nil
}

func validateProviderDeclarations[T any](
	p parser,
	decoded []decodedProviderDeclaration,
	lookupType func(string) (func(string, map[string]string) (T, error), bool),
) ([]Declaration[T], error) {
	declarations := make([]Declaration[T], 0, len(decoded))
	seenNames := make(map[string]struct{}, len(decoded))

	for declarationIndex, declaration := range decoded {
		if !validProviderName(declaration.name) {
			return nil, p.newError(
				declarationIndex,
				"",
				"invalid provider name",
			)
		}

		if _, ok := seenNames[declaration.name]; ok {
			return nil, p.newError(
				declarationIndex,
				declaration.name,
				"duplicate provider name",
			)
		}

		seenNames[declaration.name] = struct{}{}

		typeDescriptor, ok := lookupType(declaration.providerType)
		if !ok {
			return nil, p.newError(
				declarationIndex,
				declaration.name,
				"unknown provider type",
			)
		}

		configuration, err := typeDescriptor(
			declaration.configuration.baseURL,
			declaration.configuration.headers,
		)
		if err != nil {
			rule := "invalid provider configuration"
			if errors.Is(err, ErrInvalidBaseURL) {
				rule = "invalid base_url"
			} else if errors.Is(err, ErrInvalidHeaders) {
				rule = "invalid headers"
			}

			return nil, p.newError(
				declarationIndex,
				declaration.name,
				rule,
			)
		}

		declarations = append(declarations, Declaration[T]{
			Name: declaration.name, Type: declaration.providerType, Configuration: configuration,
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
