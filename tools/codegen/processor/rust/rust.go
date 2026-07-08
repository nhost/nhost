// Package rust implements a codegen Plugin that renders an idiomatic async Rust
// client (reqwest + serde) from an OpenAPI document. Like the other plugins it
// is thin: naming/type mapping live here, everything else lives in the
// templates. The generated client integrates with the hand-written fetch
// middleware chain in the nhost crate's fetch module.
package rust

import (
	"embed"
	"fmt"
	"io/fs"
	"strings"
	"unicode"

	"github.com/nhost/nhost/tools/codegen/format"
	"github.com/nhost/nhost/tools/codegen/processor"
)

const extCustomType = "x-rust-type"

// rustValueType is the fallback Rust type for void/empty returns and multi-type
// unions that cannot be expressed as a single concrete type.
const rustValueType = "serde_json::Value"

//go:embed templates/*.tmpl
var templatesFS embed.FS

// Rust is the code generation plugin for the Rust SDK.
type Rust struct{}

func (p *Rust) GetTemplates() fs.FS {
	return templatesFS
}

// rustKeywords are reserved words that cannot be used as identifiers; a field
// or parameter colliding with one gets a trailing underscore and relies on a
// serde rename to preserve the wire name.
var rustKeywords = map[string]struct{}{ //nolint:gochecknoglobals
	"as": {}, "break": {}, "const": {}, "continue": {}, "crate": {}, "dyn": {},
	"else": {}, "enum": {}, "extern": {}, "false": {}, "fn": {}, "for": {},
	"if": {}, "impl": {}, "in": {}, "let": {}, "loop": {}, "match": {},
	"mod": {}, "move": {}, "mut": {}, "pub": {}, "ref": {}, "return": {},
	"self": {}, "Self": {}, "static": {}, "struct": {}, "super": {},
	"trait": {}, "true": {}, "type": {}, "unsafe": {}, "use": {}, "where": {},
	"while": {}, "async": {}, "await": {}, "abstract": {}, "become": {},
	"box": {}, "do": {}, "final": {}, "macro": {}, "override": {}, "priv": {},
	"typeof": {}, "unsized": {}, "virtual": {}, "yield": {}, "try": {},
}

func splitWords(s string) []string {
	var (
		words []string
		cur   strings.Builder
	)

	flush := func() {
		if cur.Len() > 0 {
			words = append(words, strings.ToLower(cur.String()))
			cur.Reset()
		}
	}

	runes := []rune(s)
	for i, r := range runes {
		switch {
		case r == '-' || r == '_' || r == ' ' || r == '.':
			flush()
		case unicode.IsUpper(r):
			if wordBoundaryBeforeUpper(runes, i, cur.Len()) {
				flush()
			}

			cur.WriteRune(r)
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			cur.WriteRune(r)
		default:
			flush()
		}
	}

	flush()

	return words
}

// wordBoundaryBeforeUpper reports whether the uppercase rune at index i begins a
// new word fragment: it follows a lowercase rune (camelCase) or precedes one
// while a fragment is already in progress (an acronym giving way to a word).
func wordBoundaryBeforeUpper(runes []rune, i, curLen int) bool {
	prevLower := i > 0 && unicode.IsLower(runes[i-1])
	nextLower := i+1 < len(runes) && unicode.IsLower(runes[i+1])

	return prevLower || (curLen > 0 && nextLower)
}

// toPascal renders a PascalCase type name. Acronyms are title-cased (Json, Id,
// Url) rather than kept upper, matching clippy's upper_case_acronyms lint.
func toPascal(s string) string {
	var b strings.Builder

	for _, w := range splitWords(s) {
		b.WriteString(format.Title(w))
	}

	out := b.String()
	if out == "" {
		return "Type"
	}

	if unicode.IsDigit(rune(out[0])) {
		return "T" + out
	}

	return out
}

func toSnake(s string) string {
	out := strings.Join(splitWords(s), "_")
	if out == "" {
		return "field"
	}

	if unicode.IsDigit(rune(out[0])) {
		out = "f" + out
	}

	if _, ok := rustKeywords[out]; ok {
		return out + "_"
	}

	return out
}

func optionalWrap(typeName string, optional bool) string {
	if optional {
		return "Option<" + typeName + ">"
	}

	return typeName
}

// fieldLines renders a struct field with its serde attributes.
func fieldLines(name, rawName, typeName string, optional bool) string {
	var attrs []string
	if name != rawName {
		attrs = append(attrs, fmt.Sprintf("rename = %q", rawName))
	}

	if optional {
		attrs = append(attrs, `skip_serializing_if = "Option::is_none"`, "default")
	}

	var b strings.Builder
	if len(attrs) > 0 {
		fmt.Fprintf(&b, "#[serde(%s)]\n", strings.Join(attrs, ", "))
	}

	fmt.Fprintf(&b, "pub %s: %s,", name, optionalWrap(typeName, optional))

	return b.String()
}

func (p *Rust) GetFuncMap() map[string]any {
	return map[string]any{
		// rustReturnType maps the shared IR return expression to a single Rust
		// type. void/empty and multi-type unions collapse to serde_json::Value.
		"rustReturnType": func(t string) string {
			if t == "" || t == "void" || strings.Contains(t, " | ") {
				return rustValueType
			}

			return t
		},
		"optionalWrap": optionalWrap,
		"pascal":       toPascal,
		"rustField": func(prop *processor.Property) string {
			return fieldLines(prop.Name(), prop.RawName(), prop.Type.Name(), prop.Optional())
		},
		"rustParamField": func(param *processor.Parameter) string {
			return fieldLines(param.Name(), param.RawName(), param.Type.Name(), !param.Required())
		},
	}
}

func (p *Rust) TypeObjectName(name string) string {
	return toPascal(name)
}

func (p *Rust) TypeScalarName(scalar *processor.TypeScalar) string {
	schema := scalar.Schema().Schema()

	switch schema.Type[0] {
	case "integer":
		return "i64"
	case "number":
		return "f64"
	case "boolean":
		return "bool"
	case "string":
		if schema.Format == "binary" {
			return "Vec<u8>"
		}

		return "String"
	}

	return rustValueType
}

func (p *Rust) TypeArrayName(array *processor.TypeArray) string {
	return "Vec<" + array.Item.Name() + ">"
}

func (p *Rust) TypeEnumName(name string) string {
	return toPascal(name)
}

func (p *Rust) TypeEnumValues(values []any) []string {
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

func (p *Rust) TypeMapName(mapType *processor.TypeMap) string {
	if v, ok := mapType.Schema().Schema().Extensions.Get(extCustomType); ok {
		return v.Value
	}

	return rustValueType
}

func (p *Rust) MethodName(name string) string {
	return toSnake(name)
}

// MethodPath rewrites OpenAPI path templates so braces reference the snake_cased
// parameter identifiers the client renders, letting the template interpolate
// them with format!.
func (p *Rust) MethodPath(name string) string {
	var b strings.Builder

	for {
		open := strings.IndexByte(name, '{')
		if open < 0 {
			b.WriteString(name)

			break
		}

		closeIdx := strings.IndexByte(name[open:], '}')
		if closeIdx < 0 {
			b.WriteString(name)

			break
		}

		closeIdx += open
		b.WriteString(name[:open])
		b.WriteByte('{')
		b.WriteString(toSnake(name[open+1 : closeIdx]))
		b.WriteByte('}')

		name = name[closeIdx+1:]
	}

	return b.String()
}

func (p *Rust) ParameterName(name string) string {
	return toSnake(name)
}

func (p *Rust) PropertyName(name string) string {
	return toSnake(name)
}

func (p *Rust) BinaryType() string {
	return "Vec<u8>"
}
