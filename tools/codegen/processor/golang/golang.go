// Package golang implements a codegen Plugin that renders an idiomatic Go
// client from an OpenAPI document. Like the typescript and python plugins it is
// a thin plugin: naming/type mapping live here, everything else lives in the
// templates. The generated client integrates with the hand-written fetch
// middleware chain in packages/nhost-go/fetch.
package golang

import (
	"embed"
	"fmt"
	"io/fs"
	"strings"
	"unicode"

	"github.com/nhost/nhost/tools/codegen/format"
	"github.com/nhost/nhost/tools/codegen/processor"
)

const extCustomType = "x-go-type"

//go:embed templates/*.tmpl
var templatesFS embed.FS

// Golang is the code generation plugin for the Go SDK. Package is the Go
// package name emitted in the generated file (e.g. "auth", "storage").
type Golang struct {
	Package string
}

func (p *Golang) GetTemplates() fs.FS {
	return templatesFS
}

// initialisms are word fragments the Go community capitalizes wholesale so the
// generated identifiers pass stylecheck/revive var-naming without churn.
var initialisms = map[string]string{ //nolint:gochecknoglobals
	"id": "ID", "url": "URL", "uri": "URI", "json": "JSON", "api": "API",
	"http": "HTTP", "https": "HTTPS", "html": "HTML", "uuid": "UUID",
	"jwt": "JWT", "sms": "SMS", "otp": "OTP", "mfa": "MFA", "pat": "PAT",
	"totp": "TOTP", "ttl": "TTL", "ip": "IP", "ok": "OK", "sql": "SQL",
	"webauthn": "WebAuthn",
}

// splitWords breaks a camelCase/PascalCase/kebab/snake identifier into its
// lowercase word fragments.
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

// toExported renders an exported Go identifier (PascalCase with initialisms).
func toExported(s string) string {
	var b strings.Builder

	for _, w := range splitWords(s) {
		if up, ok := initialisms[w]; ok {
			b.WriteString(up)

			continue
		}

		b.WriteString(format.Title(w))
	}

	out := b.String()
	if out == "" {
		return "Field"
	}

	if unicode.IsDigit(rune(out[0])) {
		return "F" + out
	}

	return out
}

// goFieldType wraps a mapped type in a pointer when the field is optional so
// absence (JSON omission / null) is representable and omitempty behaves.
func goFieldType(typeName string, optional bool) string {
	if optional && !strings.HasPrefix(typeName, "*") {
		return "*" + typeName
	}

	return typeName
}

// fieldLine renders a struct field. pointer controls whether the mapped type is
// wrapped in a pointer (so absence/null is representable); omitempty controls
// the json tag. They are decoupled because a required-but-nullable field needs
// a pointer (to round-trip null) yet must NOT carry omitempty, or a nil value
// silently disappears instead of serializing as JSON null.
func fieldLine(name, rawName, typeName string, pointer, omitempty bool) string {
	tag := rawName
	if omitempty {
		tag += ",omitempty"
	}

	return fmt.Sprintf("%s %s `json:%q`", name, goFieldType(typeName, pointer), tag)
}

func (p *Golang) GetFuncMap() map[string]any {
	return map[string]any{
		// goReturnType maps the shared IR return expression to a single Go type.
		// void/empty and multi-type unions collapse to json.RawMessage.
		"goReturnType": func(t string) string {
			if t == "" || t == "void" || strings.Contains(t, " | ") {
				return "json.RawMessage"
			}

			return t
		},
		"goFieldType": goFieldType,
		"exported":    toExported,
		"packageName": func() string {
			if p.Package == "" {
				return "client"
			}

			return p.Package
		},
		"goField": func(prop *processor.Property) string {
			// Pointer when optional (absent OR nullable); omitempty only when the
			// field is genuinely optional (not required), so required-nullable
			// fields keep the pointer but always serialize (as null when nil).
			return fieldLine(
				prop.Name(), prop.RawName(), prop.Type.Name(),
				prop.Optional(), !prop.Required(),
			)
		},
		"goParamField": func(param *processor.Parameter) string {
			return fieldLine(
				param.Name(), param.RawName(), param.Type.Name(),
				!param.Required(), !param.Required(),
			)
		},
		"unexported": unexported,
	}
}

func (p *Golang) TypeObjectName(name string) string {
	return toExported(name)
}

func (p *Golang) TypeScalarName(scalar *processor.TypeScalar) string {
	schema := scalar.Schema().Schema()

	switch schema.Type[0] {
	case "integer":
		return "int"
	case "number":
		return "float64"
	case "boolean":
		return "bool"
	case "string":
		if schema.Format == "binary" {
			return "[]byte"
		}

		return "string"
	}

	return "any"
}

func (p *Golang) TypeArrayName(array *processor.TypeArray) string {
	return "[]" + array.Item.Name()
}

func (p *Golang) TypeEnumName(name string) string {
	return toExported(name)
}

func (p *Golang) TypeEnumValues(values []any) []string {
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

func (p *Golang) TypeMapName(mapType *processor.TypeMap) string {
	if v, ok := mapType.Schema().Schema().Extensions.Get(extCustomType); ok {
		return v.Value
	}

	return "map[string]any"
}

func (p *Golang) MethodName(name string) string {
	return toExported(name)
}

// MethodPath rewrites OpenAPI path templates (e.g. "/files/{file-id}") so the
// braces reference the exported parameter identifiers the client renders,
// letting the template interpolate them with fmt.Sprintf-style "%s" markers.
func (p *Golang) MethodPath(name string) string {
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
		b.WriteString("%s")

		name = name[closeIdx+1:]
	}

	return b.String()
}

func (p *Golang) ParameterName(name string) string {
	// Exported so query-parameter structs marshal; path parameters are
	// lowercased to local arg names in the template via `unexported`.
	return toExported(name)
}

func (p *Golang) PropertyName(name string) string {
	return toExported(name)
}

func (p *Golang) BinaryType() string {
	return "[]byte"
}

// unexported lowercases the leading run of an exported identifier so it is a
// valid unexported (local variable / parameter) name.
func unexported(s string) string {
	if s == "" {
		return s
	}

	runes := []rune(s)

	i := 0
	for i < len(runes) && unicode.IsUpper(runes[i]) {
		// Keep the last uppercase letter of a leading acronym as the start of
		// the next word (e.g. "URLValue" -> "urlValue", "ID" -> "id").
		if i+1 < len(runes) && unicode.IsLower(runes[i+1]) && i > 0 {
			break
		}

		runes[i] = unicode.ToLower(runes[i])
		i++
	}

	out := string(runes)
	if isGoKeyword(out) {
		return out + "_"
	}

	return out
}

func isGoKeyword(s string) bool {
	switch s {
	case "break", "case", "chan", "const", "continue", "default", "defer",
		"else", "fallthrough", "for", "func", "go", "goto", "if", "import",
		"interface", "map", "package", "range", "return", "select", "struct",
		"switch", "type", "var":
		return true
	default:
		return false
	}
}
