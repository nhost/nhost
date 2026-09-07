package openapi3

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

// jsonSchemaValidator wraps the santhosh-tekuri/jsonschema validator
type jsonSchemaValidator struct {
	compiler *jsonschema.Compiler
	schema   *jsonschema.Schema
}

// newJSONSchemaValidator creates a new validator using JSON Schema 2020-12
func newJSONSchemaValidator(schema *Schema) (*jsonSchemaValidator, error) {
	// Convert OpenAPI Schema to JSON Schema format
	schemaBytes, err := json.Marshal(schema)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal schema: %w", err)
	}

	var schemaMap map[string]any
	if err := json.Unmarshal(schemaBytes, &schemaMap); err != nil {
		return nil, fmt.Errorf("failed to unmarshal schema: %w", err)
	}

	// OpenAPI 3.1 specific transformations
	transformOpenAPIToJSONSchema(schemaMap)

	// Create compiler
	compiler := jsonschema.NewCompiler()
	compiler.DefaultDraft(jsonschema.Draft2020)

	// Add the schema
	schemaURL := "https://example.com/schema.json"
	if err := compiler.AddResource(schemaURL, schemaMap); err != nil {
		return nil, fmt.Errorf("failed to add schema resource: %w", err)
	}

	// Compile the schema
	compiledSchema, err := compiler.Compile(schemaURL)
	if err != nil {
		return nil, fmt.Errorf("failed to compile schema: %w", err)
	}

	return &jsonSchemaValidator{
		compiler: compiler,
		schema:   compiledSchema,
	}, nil
}

// transformOpenAPIToJSONSchema converts OpenAPI 3.0/3.1 specific keywords to JSON Schema format
func transformOpenAPIToJSONSchema(schema map[string]any) {
	// Handle nullable - in OpenAPI 3.0, nullable is a boolean flag
	// In OpenAPI 3.1 / JSON Schema 2020-12, we use type arrays
	if nullable, ok := schema["nullable"].(bool); ok && nullable {
		if typeVal, ok := schema["type"].(string); ok {
			// Convert to type array with null
			schema["type"] = []string{typeVal, "null"}
		} else if _, hasType := schema["type"]; !hasType {
			// nullable: true without type - add "null" to allow null values
			schema["type"] = []string{"null"}
		}
		delete(schema, "nullable")
	}

	// Handle exclusiveMinimum/exclusiveMaximum
	// In OpenAPI 3.0, these are booleans alongside minimum/maximum
	// In JSON Schema 2020-12, they are numeric values
	if exclusiveMin, ok := schema["exclusiveMinimum"].(bool); ok {
		if exclusiveMin {
			if schemaMin, ok := schema["minimum"].(float64); ok {
				schema["exclusiveMinimum"] = schemaMin
				delete(schema, "minimum")
			} else {
				delete(schema, "exclusiveMinimum")
			}
		} else {
			// exclusiveMinimum: false means inclusive, which is the JSON Schema default
			delete(schema, "exclusiveMinimum")
		}
	}
	if exclusiveMax, ok := schema["exclusiveMaximum"].(bool); ok {
		if exclusiveMax {
			if schemaMax, ok := schema["maximum"].(float64); ok {
				schema["exclusiveMaximum"] = schemaMax
				delete(schema, "maximum")
			} else {
				delete(schema, "exclusiveMaximum")
			}
		} else {
			// exclusiveMaximum: false means inclusive, which is the JSON Schema default
			delete(schema, "exclusiveMaximum")
		}
	}

	// Remove OpenAPI-specific keywords that aren't in JSON Schema
	delete(schema, "discriminator")
	delete(schema, "xml")
	delete(schema, "externalDocs")
	delete(schema, "example") // Use "examples" in 2020-12

	// Recursively transform nested schemas (single schema fields)
	for _, key := range []string{
		"additionalProperties", "items", "not",
		// OpenAPI 3.1 / JSON Schema 2020-12 fields
		"contains", "propertyNames", "unevaluatedItems", "unevaluatedProperties",
		"if", "then", "else", "contentSchema",
	} {
		if val, ok := schema[key]; ok {
			if nestedSchema, ok := val.(map[string]any); ok {
				transformOpenAPIToJSONSchema(nestedSchema)
			}
		}
	}

	// Transform schema arrays (oneOf, anyOf, allOf, prefixItems)
	for _, key := range []string{"oneOf", "anyOf", "allOf", "prefixItems"} {
		if val, ok := schema[key].([]any); ok {
			for _, item := range val {
				if nestedSchema, ok := item.(map[string]any); ok {
					transformOpenAPIToJSONSchema(nestedSchema)
				}
			}
		}
	}

	// Transform schema maps (properties, patternProperties, dependentSchemas, $defs)
	for _, key := range []string{"properties", "patternProperties", "dependentSchemas", "$defs"} {
		if props, ok := schema[key].(map[string]any); ok {
			for _, propVal := range props {
				if propSchema, ok := propVal.(map[string]any); ok {
					transformOpenAPIToJSONSchema(propSchema)
				}
			}
		}
	}
}

// validate validates a value against the compiled JSON Schema
func (v *jsonSchemaValidator) validate(value any) error {
	if err := v.schema.Validate(value); err != nil {
		// Convert jsonschema error to SchemaError
		return convertJSONSchemaError(err)
	}
	return nil
}

// convertJSONSchemaError converts a jsonschema validation error to OpenAPI SchemaError format
func convertJSONSchemaError(err error) error {
	// TODO: Go 1.26
	// if err, ok := errors.AsType[*jsonschema.ValidationError](err); ok {
	// 	return formatValidationError(err, "")
	var validationErr *jsonschema.ValidationError
	if errors.As(err, &validationErr) {
		return formatValidationError(validationErr, "")
	}
	return err
}

// formatValidationError recursively formats validation errors
func formatValidationError(verr *jsonschema.ValidationError, parentPath string) error {
	// Build the path from InstanceLocation slice
	path := "/" + strings.Join(verr.InstanceLocation, "/")
	if parentPath != "" && path != "/" {
		path = parentPath + path
	} else if path == "/" {
		path = parentPath
	}

	// Build error message using the Error() method
	var msg strings.Builder
	if path != "" {
		fmt.Fprintf(&msg, `error at "%s": `, path)
	}
	msg.WriteString(verr.Error())

	// If there are sub-errors, format them too
	if len(verr.Causes) > 0 {
		var subErrors MultiError
		for _, cause := range verr.Causes {
			if subErr := formatValidationError(cause, path); subErr != nil {
				subErrors = append(subErrors, subErr)
			}
		}
		if len(subErrors) > 0 {
			return &SchemaError{
				Reason: msg.String(),
				Origin: fmt.Errorf("validation failed due to: %w", subErrors),
			}
		}
	}

	return &SchemaError{
		Reason: msg.String(),
	}
}

// useJSONSchema2020 validates using the JSON Schema 2020-12 validator
func (schema *Schema) useJSONSchema2020(settings *schemaValidationSettings, value any) error {
	validator, err := newJSONSchemaValidator(schema)
	if err != nil {
		// Fall back to built-in validator if compilation fails
		return schema.visitJSON(settings, value)
	}

	return validator.validate(value)
}
