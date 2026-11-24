// Package server provides MCP (Model Context Protocol) server implementations.
package server

import (
	"bytes"
	"encoding/json"
	"fmt"

	"github.com/santhosh-tekuri/jsonschema/v6"

	"github.com/mark3labs/mcp-go/mcp"
)

// outputSchemaValidator validates a tool's StructuredContent return value
// against the tool's declared output schema. It reuses a compiledSchemaCache
// to amortize the cost of JSON Schema compilation across calls.
//
// The cache is independent from the input schema cache so that input and
// output schemas registered for the same tool name do not collide on lookup.
type outputSchemaValidator struct {
	*compiledSchemaCache
}

// newOutputSchemaValidator returns a fresh validator with an empty cache.
func newOutputSchemaValidator() *outputSchemaValidator {
	return &outputSchemaValidator{compiledSchemaCache: newCompiledSchemaCache()}
}

// invalidate drops cached compilations for the given tool names. Safe to
// call on a nil receiver so callers do not need a separate guard when
// validation is disabled.
func (v *outputSchemaValidator) invalidate(names ...string) {
	if v == nil {
		return
	}
	v.compiledSchemaCache.invalidate(names...)
}

// invalidateAll drops the entire cache. Safe to call on a nil receiver.
func (v *outputSchemaValidator) invalidateAll() {
	if v == nil {
		return
	}
	v.compiledSchemaCache.invalidateAll()
}

// validate checks the tool result against the tool's declared output schema.
// The boolean return reports whether validation actually ran; the error is
// set only when validation ran and the structured content did not satisfy
// the schema.
//
// Validation is skipped (and reported as not-run) when:
//   - the tool declares no output schema
//   - the result is nil or carries IsError = true (error results are not
//     required to conform to the success-shape schema)
//   - the result has no StructuredContent (mcp-go does not synthesise
//     structured output from text content; tools without structured output
//     are passed through to preserve back-compat)
//   - the schema fails to compile (matches input validator behaviour: a
//     broken schema must not make tool calls unexpectedly fail)
func (v *outputSchemaValidator) validate(tool mcp.Tool, result *mcp.CallToolResult) (bool, error) {
	if v == nil || result == nil {
		return false, nil
	}
	structured := result.StructuredContent
	if trimmed := bytes.TrimSpace(result.RawStructuredContent); len(trimmed) > 0 && !bytes.Equal(trimmed, []byte("null")) {
		structured = result.RawStructuredContent
	}
	return v.validateStructured(tool, structured, result.IsError)
}

// validateCreateTaskResult is the *mcp.CreateTaskResult counterpart to
// validate. Task-augmented tool calls produce a CreateTaskResult whose
// StructuredContent carries the structured payload that will eventually be
// surfaced to the client via tasks/result; validating it before the result
// is persisted to the task entry keeps the task path consistent with the
// synchronous path's WithOutputSchemaValidation contract.
func (v *outputSchemaValidator) validateCreateTaskResult(tool mcp.Tool, result *mcp.CreateTaskResult) (bool, error) {
	if v == nil || result == nil {
		return false, nil
	}
	return v.validateStructured(tool, result.StructuredContent, result.IsError)
}

// validateStructured runs the actual schema check against the structured
// content and IsError flag extracted from a tool result. Both *CallToolResult
// and *CreateTaskResult delegate here so the skip rules and error formatting
// stay in one place.
func (v *outputSchemaValidator) validateStructured(tool mcp.Tool, structured any, isError bool) (bool, error) {
	// Error results carry diagnostic content that need not match the
	// declared output schema.
	if isError {
		return false, nil
	}
	if structured == nil {
		return false, nil
	}
	schemaJSON, ok := outputSchemaJSONFor(tool)
	if !ok {
		return false, nil
	}

	compiled, err := v.lookupOrCompile(tool.Name, schemaJSON)
	if err != nil {
		return false, nil
	}

	value, err := normalizeStructuredContentForValidation(structured)
	if err != nil {
		return true, fmt.Errorf("invalid structured content: %w", err)
	}

	if err := compiled.Validate(value); err != nil {
		return true, formatOutputValidationError(err)
	}
	return true, nil
}

// outputSchemaJSONFor returns the JSON representation of the tool's output
// schema. It prefers RawOutputSchema when set, otherwise marshals the
// structured OutputSchema. The boolean return is false when the tool
// declares no usable output schema.
func outputSchemaJSONFor(tool mcp.Tool) ([]byte, bool) {
	if len(tool.RawOutputSchema) > 0 {
		return tool.RawOutputSchema, true
	}
	if tool.OutputSchema.Type == "" && tool.OutputSchema.Types == nil && len(tool.OutputSchema.Properties) == 0 && len(tool.OutputSchema.Required) == 0 {
		return nil, false
	}
	data, err := json.Marshal(tool.OutputSchema)
	if err != nil {
		return nil, false
	}
	return data, true
}

// normalizeStructuredContentForValidation converts the structured content
// (which may already be a decoded map/slice/scalar or a typed Go struct)
// into the loosely-typed representation that the JSON Schema validator
// expects. We round-trip through JSON so that struct field tags and custom
// MarshalJSON implementations are honoured during validation.
func normalizeStructuredContentForValidation(structured any) (any, error) {
	if structured == nil {
		return nil, nil
	}
	if raw, ok := structured.(json.RawMessage); ok {
		if len(bytes.TrimSpace(raw)) == 0 {
			return nil, nil
		}
		return jsonschema.UnmarshalJSON(bytes.NewReader(raw))
	}
	encoded, err := json.Marshal(structured)
	if err != nil {
		return nil, err
	}
	return jsonschema.UnmarshalJSON(bytes.NewReader(encoded))
}

// formatOutputValidationError shapes a validator error as a single flat
// message suitable for surfacing to the client. The message is prefixed
// with "output schema validation failed" so callers can distinguish it
// from input validation failures.
func formatOutputValidationError(err error) error {
	formatted := formatValidationError(err)
	// formatValidationError wraps with "input schema validation failed:";
	// rewrite the prefix so output errors are identifiable.
	msg := formatted.Error()
	const inputPrefix = "input schema validation failed: "
	const outputPrefix = "output schema validation failed: "
	if len(msg) >= len(inputPrefix) && msg[:len(inputPrefix)] == inputPrefix {
		return fmt.Errorf("%s%s", outputPrefix, msg[len(inputPrefix):])
	}
	return fmt.Errorf("output schema validation failed: %w", err)
}
