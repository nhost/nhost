// Package python implements a codegen Plugin that renders an async, pydantic v2
// based Python client from an OpenAPI document. It follows the same thin-plugin
// approach as the typescript plugin: naming/type mapping live here, everything
// else lives in the templates.
package python

import (
	"embed"
	"fmt"
	"io/fs"
	"strings"
	"unicode"

	"github.com/nhost/nhost/tools/codegen/format"
	"github.com/nhost/nhost/tools/codegen/processor"
)

const extCustomType = "x-python-type"

//go:embed templates/*.tmpl
var templatesFS embed.FS

// Python is the code generation plugin for the Python SDK.
type Python struct{}

func (p *Python) GetTemplates() fs.FS {
	return templatesFS
}

// pythonKeywords are reserved words (and a few builtins worth avoiding) that
// cannot be used as identifiers; collisions get a trailing underscore and rely
// on the pydantic alias to preserve the wire name.
var pythonKeywords = map[string]struct{}{ //nolint:gochecknoglobals
	"False": {}, "None": {}, "True": {}, "and": {}, "as": {}, "assert": {},
	"async": {}, "await": {}, "break": {}, "class": {}, "continue": {},
	"def": {}, "del": {}, "elif": {}, "else": {}, "except": {}, "finally": {},
	"for": {}, "from": {}, "global": {}, "if": {}, "import": {}, "in": {},
	"is": {}, "lambda": {}, "nonlocal": {}, "not": {}, "or": {}, "pass": {},
	"raise": {}, "return": {}, "try": {}, "while": {}, "with": {}, "yield": {},
	"match": {}, "case": {},
}

// toSnakeCase converts camelCase, PascalCase, kebab-case and space separated
// identifiers into snake_case, keeping acronyms readable
// (e.g. "clientDataJSON" -> "client_data_json").
func toSnakeCase(s string) string {
	var b strings.Builder

	runes := []rune(s)
	for i, r := range runes {
		switch {
		case r == '-' || r == ' ' || r == '.':
			b.WriteRune('_')
		case unicode.IsUpper(r):
			prevLower := i > 0 && (unicode.IsLower(runes[i-1]) || unicode.IsDigit(runes[i-1]))
			nextLower := i+1 < len(runes) && unicode.IsLower(runes[i+1])
			if i > 0 && (prevLower || nextLower) && runes[i-1] != '-' &&
				runes[i-1] != ' ' && runes[i-1] != '.' {
				b.WriteByte('_')
			}

			b.WriteRune(unicode.ToLower(r))
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			b.WriteRune(r)
		default:
			// Any other character (e.g. the trailing "[]" on multipart array
			// fields) is treated as a separator; duplicates are collapsed below.
			b.WriteByte('_')
		}
	}

	out := b.String()
	for strings.Contains(out, "__") {
		out = strings.ReplaceAll(out, "__", "_")
	}

	out = strings.Trim(out, "_")

	return out
}

func safeIdentifier(name string) string {
	if _, ok := pythonKeywords[name]; ok {
		return name + "_"
	}

	return name
}

// fieldDefinition renders a single pydantic field line "name: type[ = default]",
// wiring a Field(alias=...) whenever the Python name diverges from the wire name.
func fieldDefinition(name, rawName, typeName string, optional, missable bool) string {
	if optional {
		typeName += " | None"
	}

	aliased := name != rawName

	var suffix string

	switch {
	case aliased && missable:
		suffix = fmt.Sprintf(" = Field(default=None, alias=%q)", rawName)
	case aliased:
		suffix = fmt.Sprintf(" = Field(alias=%q)", rawName)
	case missable:
		suffix = " = None"
	}

	return fmt.Sprintf("%s: %s%s", name, typeName, suffix)
}

func (p *Python) GetFuncMap() map[string]any {
	return map[string]any{
		// pyReturnType turns the shared IR return type expression into a valid
		// runtime Python type expression usable inside a pydantic TypeAdapter.
		"pyReturnType": func(t string) string {
			if t == "" || t == "void" {
				return "None"
			}

			return strings.ReplaceAll(t, "void", "None")
		},
		// pascal converts a snake_case method name into a PascalCase class prefix
		// (used for the per-method query Params model name).
		"pascal": func(s string) string {
			parts := strings.Split(s, "_")
			for i := range parts {
				parts[i] = format.Title(parts[i])
			}

			return strings.Join(parts, "")
		},
		"pyField": func(prop *processor.Property) string {
			return fieldDefinition(
				prop.Name(), prop.RawName(), prop.Type.Name(),
				prop.Optional(), !prop.Required(),
			)
		},
		"pyParamField": func(param *processor.Parameter) string {
			return fieldDefinition(
				param.Name(), param.RawName(), param.Type.Name(),
				!param.Required(), !param.Required(),
			)
		},
	}
}

func (p *Python) TypeObjectName(name string) string {
	return format.ToCamelCase(name)
}

func (p *Python) TypeScalarName(scalar *processor.TypeScalar) string {
	schema := scalar.Schema().Schema()

	switch schema.Type[0] {
	case "integer":
		return "int"
	case "number":
		return "float"
	case "boolean":
		return "bool"
	case "string":
		if schema.Format == "binary" {
			return "bytes"
		}

		return "str"
	}

	return "Any"
}

func (p *Python) TypeArrayName(array *processor.TypeArray) string {
	return "list[" + array.Item.Name() + "]"
}

func (p *Python) TypeEnumName(name string) string {
	return format.ToCamelCase(name)
}

func (p *Python) TypeEnumValues(values []any) []string {
	enumValues := make([]string, len(values))
	for i, v := range values {
		if s, ok := v.(string); ok {
			enumValues[i] = fmt.Sprintf("%q", s)
		} else {
			enumValues[i] = fmt.Sprintf("%v", v)
		}
	}

	return enumValues
}

func (p *Python) TypeMapName(mapType *processor.TypeMap) string {
	if v, ok := mapType.Schema().Schema().Extensions.Get(extCustomType); ok {
		return v.Value
	}

	return "dict[str, Any]"
}

func (p *Python) MethodName(name string) string {
	return safeIdentifier(toSnakeCase(name))
}

// MethodPath rewrites OpenAPI path templates (e.g. "/files/{file_id}") so the
// braces reference the snake_cased parameter names the client renders, letting
// the template interpolate them directly with an f-string.
func (p *Python) MethodPath(name string) string {
	var b strings.Builder

	for {
		open := strings.IndexByte(name, '{')
		if open < 0 {
			b.WriteString(name)

			break
		}

		close := strings.IndexByte(name[open:], '}')
		if close < 0 {
			b.WriteString(name)

			break
		}

		close += open
		b.WriteString(name[:open])
		b.WriteByte('{')
		b.WriteString(safeIdentifier(toSnakeCase(name[open+1 : close])))
		b.WriteByte('}')
		name = name[close+1:]
	}

	return b.String()
}

func (p *Python) ParameterName(name string) string {
	return safeIdentifier(toSnakeCase(name))
}

func (p *Python) PropertyName(name string) string {
	return safeIdentifier(toSnakeCase(name))
}

func (p *Python) BinaryType() string {
	return "bytes"
}
