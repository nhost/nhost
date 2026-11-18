// Package sdl formats GraphQL schemas with safely escaped descriptions.
package sdl

import (
	"bytes"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/formatter"
)

// FormatSchemaDocument formats a document with two-space indentation, preserving
// definition order and leaving the input untouched.
func FormatSchemaDocument(doc *ast.SchemaDocument) []byte {
	copyDoc := *doc
	copyDoc.Definitions = escapeDefinitions(doc.Definitions)
	copyDoc.Directives = escapeDirectiveDefinitions(doc.Directives)

	var buf bytes.Buffer
	formatter.NewFormatter(&buf, formatter.WithIndent("  ")).FormatSchemaDocument(&copyDoc)

	return buf.Bytes()
}

// FormatSchema formats a validated schema with two-space indentation and types
// sorted by name, leaving the input untouched.
func FormatSchema(schema *ast.Schema) []byte {
	copySchema := *schema
	copySchema.Types = make(map[string]*ast.Definition, len(schema.Types))
	copySchema.Directives = make(map[string]*ast.DirectiveDefinition, len(schema.Directives))

	for name, def := range schema.Types {
		copySchema.Types[name] = escapeDefinition(def)
	}

	for name, def := range schema.Directives {
		copySchema.Directives[name] = escapeDirectiveDefinition(def)
	}

	var buf bytes.Buffer
	formatter.NewFormatter(&buf, formatter.WithIndent("  ")).FormatSchema(&copySchema)

	return buf.Bytes()
}

func escapeDescription(description string) string {
	// gqlparser writes descriptions as block strings without escaping their delimiter.
	return strings.ReplaceAll(description, `"""`, `\"""`)
}

func escapeDefinitions(defs ast.DefinitionList) ast.DefinitionList {
	result := make(ast.DefinitionList, len(defs))
	for i, def := range defs {
		result[i] = escapeDefinition(def)
	}

	return result
}

func escapeDefinition(def *ast.Definition) *ast.Definition {
	copyDef := *def
	copyDef.Description = escapeDescription(def.Description)
	copyDef.Fields = make(ast.FieldList, len(def.Fields))
	copyDef.EnumValues = make(ast.EnumValueList, len(def.EnumValues))

	for i, field := range def.Fields {
		copyField := *field
		copyField.Description = escapeDescription(field.Description)
		copyField.Arguments = escapeArguments(field.Arguments)
		copyDef.Fields[i] = &copyField
	}

	for i, value := range def.EnumValues {
		copyValue := *value
		copyValue.Description = escapeDescription(value.Description)
		copyDef.EnumValues[i] = &copyValue
	}

	return &copyDef
}

func escapeArguments(args ast.ArgumentDefinitionList) ast.ArgumentDefinitionList {
	result := make(ast.ArgumentDefinitionList, len(args))
	for i, arg := range args {
		copyArg := *arg
		copyArg.Description = escapeDescription(arg.Description)
		result[i] = &copyArg
	}

	return result
}

func escapeDirectiveDefinitions(defs ast.DirectiveDefinitionList) ast.DirectiveDefinitionList {
	result := make(ast.DirectiveDefinitionList, len(defs))
	for i, def := range defs {
		result[i] = escapeDirectiveDefinition(def)
	}

	return result
}

func escapeDirectiveDefinition(def *ast.DirectiveDefinition) *ast.DirectiveDefinition {
	copyDef := *def
	copyDef.Description = escapeDescription(def.Description)
	copyDef.Arguments = escapeArguments(def.Arguments)

	return &copyDef
}
