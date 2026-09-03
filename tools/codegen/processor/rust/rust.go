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
	"reflect"
	"slices"
	"strconv"
	"strings"
	"unicode"

	"github.com/nhost/nhost/tools/codegen/format"
	"github.com/nhost/nhost/tools/codegen/processor"
	"github.com/pb33f/libopenapi/datamodel/high/base"
)

const (
	extCustomType     = "x-rust-type"
	extSensitive      = "x-nhost-sensitive"
	rustValueType     = "serde_json::Value"
	schemaTypeBoolean = "boolean"
	schemaTypeInteger = "integer"
	schemaTypeNumber  = "number"
	schemaTypeString  = "string"
)

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

// rustReservedTypeNames are identifiers occupied by the generated module's
// imports and client definition. Self is Rust's only PascalCase keyword.
var rustReservedTypeNames = map[string]struct{}{ //nolint:gochecknoglobals
	"Arc":            {},
	"Client":         {},
	"Deserialize":    {},
	"Error":          {},
	"FilePart":       {},
	"HashMap":        {},
	"HeaderPriority": {},
	"Response":       {},
	"Self":           {},
	"Serialize":      {},
	"SessionStorage": {},
	"SetHeaders":     {},
	"SetRole":        {},
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
		out = "T" + out
	}

	for candidate := out; ; candidate = strings.TrimSuffix(candidate, "Type") {
		if _, ok := rustReservedTypeNames[candidate]; ok {
			return out + "Type"
		}

		if !strings.HasSuffix(candidate, "Type") {
			return out
		}
	}
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

// rustPrimitiveType maps OpenAPI integer, number, boolean, and string
// primitives to Rust types, returning an empty string when unsupported.
func rustPrimitiveType(schemaType, formatName string) string {
	switch schemaType {
	case schemaTypeInteger:
		return "i64"
	case schemaTypeNumber:
		return "f64"
	case schemaTypeBoolean:
		return "bool"
	case schemaTypeString:
		if formatName == "binary" {
			return "Vec<u8>"
		}

		return "String"
	default:
		return ""
	}
}

// rustSchemaType maps primitive, referenced, array, and typed-map schemas to
// Rust types. It falls back to serde_json::Value for absent, ambiguous,
// free-form, or unsupported schemas.
func rustSchemaType(schema *base.SchemaProxy) string {
	if schema == nil || schema.Schema() == nil {
		return rustValueType
	}

	if v, ok := schema.Schema().Extensions.Get(extCustomType); ok {
		return v.Value
	}

	if schema.IsReference() {
		return toPascal(format.GetNameFromComponentRef(schema.GetReference()))
	}

	s := schema.Schema()
	if len(s.Type) != 1 {
		return rustValueType
	}

	if primitiveType := rustPrimitiveType(s.Type[0], s.Format); primitiveType != "" {
		return primitiveType
	}

	if s.Type[0] == "array" && s.Items != nil && s.Items.A != nil {
		return "Vec<" + rustSchemaType(s.Items.A) + ">"
	}

	if s.Type[0] == "object" {
		if ap := s.AdditionalProperties; ap != nil && ap.A != nil {
			return "HashMap<String, " + rustSchemaType(ap.A) + ">"
		}
	}

	return rustValueType
}

// enumValueKind returns the OpenAPI primitive kind of a decoded enum value,
// or an empty string for nil and unsupported values.
func enumValueKind(v any) string {
	valueType := reflect.TypeOf(v)
	if valueType == nil {
		return ""
	}

	switch valueType.Kind() { //nolint:exhaustive
	case reflect.Bool:
		return schemaTypeBoolean
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return schemaTypeInteger
	case reflect.Float32, reflect.Float64:
		return schemaTypeNumber
	case reflect.String:
		return schemaTypeString
	default:
		return ""
	}
}

// rustEnumType maps a homogeneous enum to its declared Rust scalar type. String
// enums remain open String aliases for forward compatibility. It falls back to
// serde_json::Value for ambiguous, heterogeneous, or mismatched kinds, except
// integer values declared as number.
func rustEnumType(enum *processor.TypeEnum) string {
	schema := enum.Schema()
	if schema == nil || schema.Schema() == nil || len(schema.Schema().Type) != 1 {
		return rustValueType
	}

	declaredKind := schema.Schema().Type[0]
	valueKind := ""

	for _, node := range schema.Schema().Enum {
		var value any
		if err := node.Decode(&value); err != nil {
			return rustValueType
		}

		kind := enumValueKind(value)
		if kind == "" || (valueKind != "" && kind != valueKind) {
			return rustValueType
		}

		valueKind = kind
	}

	if valueKind != "" && valueKind != declaredKind &&
		(declaredKind != schemaTypeNumber || valueKind != schemaTypeInteger) {
		return rustValueType
	}

	return rustSchemaType(schema)
}

// fieldLines renders a struct field with its serde attributes. Optional controls
// whether the Rust type accepts null, while omittable controls whether serde may
// omit the field entirely.
func fieldLines(name, rawName, typeName string, optional, omittable bool) string {
	var attrs []string
	if name != rawName {
		attrs = append(attrs, fmt.Sprintf("rename = %q", rawName))
	}

	if omittable {
		attrs = append(attrs, `skip_serializing_if = "Option::is_none"`, "default")
	}

	var b strings.Builder
	if len(attrs) > 0 {
		fmt.Fprintf(&b, "#[serde(%s)]\n    ", strings.Join(attrs, ", "))
	}

	fmt.Fprintf(&b, "pub %s: %s,", name, optionalWrap(typeName, optional))

	return b.String()
}

// sensitiveFieldName deliberately uses a conservative built-in vocabulary so
// generated credential types are safe even when an OpenAPI author forgets the
// explicit x-nhost-sensitive marker. Unusual names can opt in with the marker.
func sensitiveFieldName(name string) bool {
	name = toSnake(name)

	switch name {
	case "api_key", "authorization", "code", "code_verifier", "cookie", "credential",
		"otp", "password", "private_key", "secret", "signature", "ticket", "token":
		return true
	}

	for _, suffix := range []string{
		"_api_key", "_code_verifier", "_otp", "_password", "_private_key",
		"_secret", "_signature", "_ticket", "_token",
	} {
		if strings.HasSuffix(name, suffix) {
			return true
		}
	}

	return false
}

func explicitlySensitive(t processor.Type) bool {
	schema := t.Schema()
	if schema == nil || schema.Schema() == nil {
		return false
	}

	_, ok := schema.Schema().Extensions.Get(extSensitive)

	return ok
}

func canContainSensitiveValue(t processor.Type) bool {
	schema := t.Schema()
	if schema == nil || schema.Schema() == nil || len(schema.Schema().Type) != 1 {
		return true
	}

	switch schema.Schema().Type[0] {
	case schemaTypeBoolean, schemaTypeInteger, schemaTypeNumber:
		return false
	default:
		return true
	}
}

func isSensitiveProperty(prop *processor.Property) bool {
	return explicitlySensitive(prop.Type) ||
		(canContainSensitiveValue(prop.Type) && sensitiveFieldName(prop.RawName()))
}

func objectHasSensitiveFields(object *processor.TypeObject) bool {
	return slices.ContainsFunc(object.Properties(), isSensitiveProperty)
}

func isSensitiveParameter(param *processor.Parameter) bool {
	return explicitlySensitive(param.Type) ||
		(canContainSensitiveValue(param.Type) && sensitiveFieldName(param.RawName()))
}

func methodHasSensitiveRequestParameters(method *processor.Method) bool {
	return slices.ContainsFunc(method.QueryParameters(), isSensitiveParameter) ||
		slices.ContainsFunc(method.HeaderParameters(), isSensitiveParameter)
}

// isMultipartFileProperty reports whether prop is a scalar or array-valued
// multipart file property with the OpenAPI binary format.
func isMultipartFileProperty(prop *processor.Property) bool {
	typ := prop.Type
	if array, ok := typ.(*processor.TypeArray); ok {
		typ = array.Item
	}

	schema := typ.Schema()

	return typ.Kind() == processor.KindIdentifierScalar && schema != nil &&
		schema.Schema() != nil && schema.Schema().Format == "binary"
}

// hasMultipartFile reports whether any method has a binary file property in
// its multipart form-data request body.
func hasMultipartFile(methods []*processor.Method) bool {
	for _, method := range methods {
		body, ok := method.RequestFormData().(*processor.TypeObject)
		if !ok {
			continue
		}

		if slices.ContainsFunc(body.Properties(), isMultipartFileProperty) {
			return true
		}
	}

	return false
}

func hasHeaderParameters(methods []*processor.Method) bool {
	return slices.ContainsFunc(methods, func(method *processor.Method) bool {
		return method.HasHeaderParameters()
	})
}

// multipartFieldType returns the Rust field type for prop. It maps the exact
// property node from a multipart form-data body to FilePart or Vec<FilePart>
// when that property has the OpenAPI binary format.
func multipartFieldType(prop *processor.Property, methods []*processor.Method) string {
	for _, method := range methods {
		body, ok := method.RequestFormData().(*processor.TypeObject)
		if !ok {
			continue
		}

		for _, multipartProp := range body.Properties() {
			if multipartProp != prop || !isMultipartFileProperty(prop) {
				continue
			}

			if prop.Type.Kind() == processor.KindIdentifierArray {
				return "Vec<FilePart>"
			}

			return "FilePart"
		}
	}

	return prop.Type.Name()
}

type rustObjectContext struct {
	Object  *processor.TypeObject
	Methods []*processor.Method
}

func newRustObjectContext(
	object *processor.TypeObject, methods []*processor.Method,
) rustObjectContext {
	return rustObjectContext{Object: object, Methods: methods}
}

func (p *Rust) GetFuncMap() map[string]any {
	return map[string]any{
		// rustReturnType maps the shared IR return expression to a single Rust
		// type. void/empty responses become the unit type `()`; multi-type
		// unions that cannot be expressed concretely collapse to
		// serde_json::Value.
		"rustReturnType": func(t string) string {
			if t == "" || t == "void" {
				return "()"
			}

			if strings.Contains(t, " | ") {
				return rustValueType
			}

			return t
		},
		"hasHeaderParameters":                 hasHeaderParameters,
		"hasMultipartFile":                    hasMultipartFile,
		"isMultipartFile":                     isMultipartFileProperty,
		"isSensitiveParameter":                isSensitiveParameter,
		"isSensitiveProperty":                 isSensitiveProperty,
		"methodHasSensitiveRequestParameters": methodHasSensitiveRequestParameters,
		"objectHasSensitiveFields":            objectHasSensitiveFields,
		"optionalWrap":                        optionalWrap,
		"pascal":                              toPascal,
		"rustEnumType":                        rustEnumType,
		"rustObjectContext":                   newRustObjectContext,
		"rustEnumUsesJSON": func(t processor.Type) bool {
			enum, ok := t.(*processor.TypeEnum)

			return ok && rustEnumType(enum) == rustValueType
		},
		"rustField": func(
			prop *processor.Property, methods []*processor.Method,
		) string {
			return fieldLines(
				prop.Name(), prop.RawName(), multipartFieldType(prop, methods),
				prop.Optional(), !prop.Required(),
			)
		},
		"rustParamField": func(param *processor.Parameter) string {
			optional := !param.Required()

			return fieldLines(param.Name(), param.RawName(), param.Type.Name(), optional, optional)
		},
		"rustPathSegments": rustPathSegments,
	}
}

func (p *Rust) TypeObjectName(name string) string {
	return toPascal(name)
}

func (p *Rust) TypeScalarName(scalar *processor.TypeScalar) string {
	return rustSchemaType(scalar.Schema())
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
	schema := mapType.Schema()
	if schema == nil || schema.Schema() == nil {
		return rustValueType
	}

	if v, ok := schema.Schema().Extensions.Get(extCustomType); ok {
		return v.Value
	}

	if ap := schema.Schema().AdditionalProperties; ap != nil && ap.A != nil {
		return "HashMap<String, " + rustSchemaType(ap.A) + ">"
	}

	return rustValueType
}

func (p *Rust) MethodName(name string) string {
	return toSnake(name)
}

// rustPathSegments turns a rewritten OpenAPI path into Rust expressions passed
// one-by-one to url::Url::path_segments_mut. Path parameters remain identifiers;
// static segments become quoted literals.
func rustPathSegments(path string) string {
	path = strings.TrimPrefix(path, "/")
	if path == "" {
		return ""
	}

	segments := strings.Split(path, "/")
	for i, segment := range segments {
		if strings.HasPrefix(segment, "{") && strings.HasSuffix(segment, "}") {
			segments[i] = strings.TrimSuffix(strings.TrimPrefix(segment, "{"), "}")

			continue
		}

		segments[i] = strconv.Quote(segment)
	}

	return strings.Join(segments, ", ")
}

// MethodPath rewrites OpenAPI path templates so braces reference the snake_cased
// parameter identifiers the client renders.
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
	return "bytes::Bytes"
}
