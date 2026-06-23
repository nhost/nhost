package transform

import (
	"bytes"
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/nhost/nhost/internal/lib/jsontmpl"
)

// template is a compiled Hasura transform template. Hasura's transform
// templating language is Kriti; rendering is delegated to the jsontmpl engine
// (the Go Kriti port) rather than a bespoke evaluator. The compiled form is
// just the validated source: jsontmpl caches the parsed AST internally, keyed
// by source, so repeated renders skip re-parsing.
type template struct {
	source string
}

// parseJSONTemplate validates a JSON-context Kriti template (request/response
// body) and returns its compiled form. Syntax errors are reported here
// (metadata-application time), before any scope exists, mirroring Hasura's
// behaviour of rejecting malformed transforms when an action is created.
func parseJSONTemplate(source string) (*template, error) {
	if err := jsontmpl.Validate(source); err != nil {
		return nil, fmt.Errorf("invalid JSON template: %w", err)
	}

	return &template{source: source}, nil
}

// parseStringTemplate validates a string-context Kriti template (url, header
// values, query params, form fields). Hasura renders these by wrapping the raw
// template in double quotes so Kriti treats the whole thing as a string literal
// with `{{ }}` interpolation (graphql-engine's wrapUnescapedTemplate), rather
// than as a bare JSON value. The wrapped form is what gets rendered.
func parseStringTemplate(source string) (*template, error) {
	wrapped := `"` + source + `"`
	if err := jsontmpl.Validate(wrapped); err != nil {
		return nil, fmt.Errorf("invalid string template: %w", err)
	}

	return &template{source: wrapped}, nil
}

// scopeFromValues binds each template value as a `$name` Kriti variable. The
// keys mirror Hasura's transform context: body, base_url, session_variables,
// query_params and (for responses) response. It also registers the
// transform-specific `getSessionVariable` function Hasura adds to the Kriti
// environment (graphql-engine's sessionFunctions).
func scopeFromValues(values map[string]any) jsontmpl.Scope {
	scope := jsontmpl.New()
	for name, value := range values {
		scope = scope.WithVar("$"+name, value)
	}

	sessionVars, _ := values["session_variables"].(map[string]any)

	return scope.WithFunc("getSessionVariable", getSessionVariableFunc(sessionVars))
}

// getSessionVariableFunc implements Hasura's getSessionVariable Kriti function:
// a null argument yields null, a string name is looked up case-insensitively
// (sessionVars keys are already lower-cased by the caller) and errors when
// absent, and any other argument type is rejected.
func getSessionVariableFunc(sessionVars map[string]any) jsontmpl.Func {
	return func(arg jsontext.Value) (jsontext.Value, error) {
		var name any
		if err := json.Unmarshal(arg, &name); err != nil {
			return nil, fmt.Errorf("decoding getSessionVariable argument: %w", err)
		}

		switch typed := name.(type) {
		case nil:
			return jsontext.Value("null"), nil
		case string:
			value, ok := sessionVars[strings.ToLower(typed)]
			if !ok {
				//nolint:err113,staticcheck // Kriti-verbatim message; the Nhost console matches on it.
				return nil, fmt.Errorf(
					"Session variable %q not found",
					typed,
				)
			}

			return json.Marshal(value, json.Deterministic(true))
		default:
			//nolint:err113,staticcheck // Kriti-verbatim message; the Nhost console matches on it.
			return nil, errors.New(
				"Session variable name should be a string",
			)
		}
	}
}

// renderString renders the template to a string, coercing non-string results
// (numbers, bools, composites) the same way Hasura's string-context rendering
// does.
func (t *template) renderString(values map[string]any) (string, error) {
	decoded, err := t.renderValue(values)
	if err != nil {
		return "", err
	}

	return stringifyTemplateValue(decoded), nil
}

// renderNullableString renders the template, reporting isNull=true when the
// result is JSON null so callers can skip the header / query param / form field
// entirely (Hasura drops null-rendered fields).
func (t *template) renderNullableString(values map[string]any) (string, bool, error) {
	decoded, err := t.renderValue(values)
	if err != nil {
		return "", false, err
	}

	if decoded == nil {
		return "", true, nil
	}

	return stringifyTemplateValue(decoded), false, nil
}

// renderJSON renders the template and returns the raw JSON document. The
// jsontmpl engine always yields valid JSON; an empty render is rejected to
// match the previous evaluator's contract.
func (t *template) renderJSON(values map[string]any) ([]byte, error) {
	out, err := jsontmpl.Render(t.source, scopeFromValues(values))
	if err != nil {
		return nil, fmt.Errorf("rendering template: %w", err)
	}

	trimmed := bytes.TrimSpace(out)
	if len(trimmed) == 0 {
		return nil, errRenderedTemplateEmpty
	}

	return trimmed, nil
}

// renderValue renders the template and decodes the resulting JSON into a Go
// value for string coercion.
func (t *template) renderValue(values map[string]any) (any, error) {
	out, err := jsontmpl.Render(t.source, scopeFromValues(values))
	if err != nil {
		return nil, fmt.Errorf("rendering template: %w", err)
	}

	var decoded any
	if err := json.Unmarshal(out, &decoded); err != nil {
		return nil, fmt.Errorf("decoding rendered template: %w", err)
	}

	return decoded, nil
}

// stringifyTemplateValue coerces a rendered JSON value to its string form:
// strings verbatim, bools as true/false, numbers without a trailing fraction,
// null as empty, and composites as compact JSON.
func stringifyTemplateValue(value any) string {
	switch typed := value.(type) {
	case nil:
		return ""
	case string:
		return typed
	case bool:
		return strconv.FormatBool(typed)
	default:
		if number, ok := numberValue(value); ok {
			return strconv.FormatFloat(number, 'f', -1, 64)
		}

		encoded, err := json.Marshal(value)
		if err != nil {
			return ""
		}

		return string(encoded)
	}
}

// numberValue extracts a float64 from the numeric forms json decoding can
// produce into an any. encoding/json/v2 decodes every JSON number into a
// float64; the integer cases are defensive for values built in Go.
func numberValue(value any) (float64, bool) {
	switch typed := value.(type) {
	case float64:
		return typed, true
	case float32:
		return float64(typed), true
	case int:
		return float64(typed), true
	case int64:
		return float64(typed), true
	default:
		return 0, false
	}
}
