// Package swift renders Swift source from the shared OpenAPI intermediate representation.
package swift

import (
	"embed"
	"fmt"
	"io/fs"
	"math"
	"reflect"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/nhost/nhost/tools/codegen/processor"
)

const (
	extSwiftType       = "x-swift-type"
	swiftRawTypeInt    = "Int"
	swiftRawTypeString = "String"
)

//go:embed templates/*.tmpl
var templatesFS embed.FS

// Swift is the Swift code generation plugin.
type Swift struct {
	// Namespace is an optional prefix applied to generated model types.
	Namespace string
	// ClientName is the optional generated client type name used by later phases.
	ClientName string
}

func (s *Swift) GetTemplates() fs.FS {
	return templatesFS
}

func (s *Swift) GetFuncMap() map[string]any {
	return map[string]any{
		"swiftClientName":      s.swiftClientName,
		"swiftCodingKey":       swiftCodingKey,
		"swiftDoc":             swiftDoc,
		"swiftEnumCases":       swiftEnumCases,
		"swiftEnumRawType":     swiftEnumRawType,
		"swiftIsLastProperty":  swiftIsLastProperty,
		"swiftNamespace":       s.swiftNamespace,
		"swiftNeedsCodingKeys": swiftNeedsCodingKeys,
	}
}

func (s *Swift) TypeObjectName(name string) string {
	return s.typeName(name)
}

func (s *Swift) TypeScalarName(scalar *processor.TypeScalar) string {
	schema := scalar.Schema().Schema()

	switch schema.Type[0] {
	case "integer":
		return swiftRawTypeInt
	case "number":
		return "Double"
	case "boolean":
		return "Bool"
	case "string":
		switch schema.Format {
		case "binary":
			return "Data"
		case "date-time":
			return "Date"
		default:
			return swiftRawTypeString
		}
	default:
		return swiftIdentifier(schema.Type[0], true)
	}
}

func (s *Swift) TypeArrayName(array *processor.TypeArray) string {
	return "[" + array.Item.Name() + "]"
}

func (s *Swift) TypeEnumName(name string) string {
	return s.typeName(name)
}

func (s *Swift) TypeEnumValues(values []any) []string {
	cases, err := swiftEnumCaseDeclarations(values)
	if err != nil {
		// Plugin.TypeEnumValues cannot return an error for legacy templates. Swift templates
		// should use the error-propagating FuncMap helpers instead.
		return nil
	}

	return cases
}

func (s *Swift) TypeMapName(mapType *processor.TypeMap) string {
	if value, ok := mapType.Schema().Schema().Extensions.Get(extSwiftType); ok {
		return value.Value
	}

	return "[String: JSONValue]"
}

func (s *Swift) MethodName(name string) string {
	return swiftIdentifier(name, false)
}

func (s *Swift) MethodPath(name string) string {
	return name
}

func (s *Swift) ParameterName(name string) string {
	return swiftIdentifier(name, false)
}

func (s *Swift) PropertyName(name string) string {
	return swiftIdentifier(name, false)
}

func (s *Swift) BinaryType() string {
	return "Data"
}

func (s *Swift) typeName(name string) string {
	if s.Namespace == "" {
		return swiftIdentifier(name, true)
	}

	return escapeSwiftKeyword(
		swiftIdentifierBare(s.Namespace, true) + swiftIdentifierBare(name, true),
	)
}

func (s *Swift) swiftNamespace() string {
	if s.Namespace == "" {
		return ""
	}

	return swiftIdentifier(s.Namespace, true)
}

func (s *Swift) swiftClientName() string {
	if s.ClientName == "" {
		return "APIClient"
	}

	return swiftIdentifier(s.ClientName, true)
}

func swiftDoc(description string) []string {
	description = strings.TrimSpace(strings.ReplaceAll(description, "\r\n", "\n"))
	if description == "" {
		return nil
	}

	lines := strings.Split(description, "\n")
	for i := range lines {
		lines[i] = strings.TrimSpace(lines[i])
	}

	return lines
}

func swiftNeedsCodingKeys(obj *processor.TypeObject) bool {
	for _, property := range obj.Properties() {
		if property.RawName() != swiftIdentifierBare(property.RawName(), false) {
			return true
		}
	}

	return false
}

func swiftCodingKey(property *processor.Property) string {
	name := property.Name()
	if property.RawName() == swiftIdentifierBare(property.RawName(), false) {
		return "case " + name
	}

	return "case " + name + " = " + swiftStringLiteral(property.RawName())
}

func swiftIsLastProperty(index int, properties []*processor.Property) bool {
	return index == len(properties)-1
}

func swiftEnumRawType(enumType *processor.TypeEnum) (string, error) {
	return swiftEnumRawTypeForValues(enumType.RawValues())
}

func swiftEnumCases(enumType *processor.TypeEnum) ([]string, error) {
	return swiftEnumCaseDeclarations(enumType.RawValues())
}

type enumValueKind uint8

const (
	enumValueKindString enumValueKind = iota
	enumValueKindInteger
)

func swiftEnumRawTypeForValues(values []any) (string, error) {
	if len(values) == 0 {
		return swiftRawTypeString, nil
	}

	var kind enumValueKind
	for i, value := range values {
		valueKind, err := swiftEnumValueKind(value)
		if err != nil {
			return "", err
		}

		if i == 0 {
			kind = valueKind
			continue
		}

		if valueKind != kind {
			return "", fmt.Errorf(
				"%w: Swift enums require all raw values to be strings or all raw values to be integers",
				processor.ErrUnsupportedFeature,
			)
		}
	}

	switch kind {
	case enumValueKindString:
		return swiftRawTypeString, nil
	case enumValueKindInteger:
		return swiftRawTypeInt, nil
	default:
		return "", fmt.Errorf(
			"%w: unsupported Swift enum raw value kind",
			processor.ErrUnsupportedFeature,
		)
	}
}

func swiftEnumValueKind(value any) (enumValueKind, error) {
	if _, ok := value.(string); ok {
		return enumValueKindString, nil
	}

	if _, err := swiftIntegerLiteral(value); err == nil {
		return enumValueKindInteger, nil
	}

	return 0, fmt.Errorf(
		"%w: Swift enums support only string and integer raw values, got %T",
		processor.ErrUnsupportedFeature,
		value,
	)
}

func swiftEnumCaseDeclarations(values []any) ([]string, error) {
	rawType, err := swiftEnumRawTypeForValues(values)
	if err != nil {
		return nil, err
	}

	cases := make([]string, 0, len(values))
	seen := make(map[string]int, len(values))

	for _, value := range values {
		bareName := swiftEnumCaseBareName(value)

		seen[bareName]++
		if seen[bareName] > 1 {
			bareName += strconv.Itoa(seen[bareName])
		}

		rawValue, err := swiftEnumRawValue(rawType, value)
		if err != nil {
			return nil, err
		}

		cases = append(cases, "case "+escapeSwiftKeyword(bareName)+" = "+rawValue)
	}

	return cases, nil
}

func swiftEnumCaseBareName(value any) string {
	switch typedValue := value.(type) {
	case string:
		return swiftIdentifierBare(typedValue, false)
	default:
		literal, err := swiftIntegerLiteral(typedValue)
		if err != nil {
			return "value"
		}

		return swiftIdentifierBare("value "+literal, false)
	}
}

func swiftEnumRawValue(rawType string, value any) (string, error) {
	switch rawType {
	case swiftRawTypeString:
		stringValue, ok := value.(string)
		if !ok {
			return "", fmt.Errorf(
				"%w: expected string enum raw value, got %T",
				processor.ErrUnsupportedFeature,
				value,
			)
		}

		return swiftStringLiteral(stringValue), nil
	case swiftRawTypeInt:
		return swiftIntegerLiteral(value)
	default:
		return "", fmt.Errorf(
			"%w: unsupported Swift enum raw type %s",
			processor.ErrUnsupportedFeature,
			rawType,
		)
	}
}

func swiftIntegerLiteral(value any) (string, error) {
	reflectValue := reflect.ValueOf(value)

	switch reflectValue.Kind() { //nolint:exhaustive
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return strconv.FormatInt(reflectValue.Int(), 10), nil
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return strconv.FormatUint(reflectValue.Uint(), 10), nil
	case reflect.Float32, reflect.Float64:
		floatValue := reflectValue.Float()
		if math.Trunc(floatValue) == floatValue {
			return strconv.FormatInt(int64(floatValue), 10), nil
		}
	}

	return "", fmt.Errorf(
		"%w: expected integer enum raw value, got %T",
		processor.ErrUnsupportedFeature,
		value,
	)
}

func swiftIdentifier(value string, upperCamel bool) string {
	return escapeSwiftKeyword(swiftIdentifierBare(value, upperCamel))
}

func swiftIdentifierBare(value string, upperCamel bool) string {
	words := splitIdentifierWords(value)
	if len(words) == 0 {
		words = []string{"value"}
	}

	var builder strings.Builder
	for i, word := range words {
		if i == 0 && !upperCamel {
			builder.WriteString(lowerIdentifierWord(word))
			continue
		}

		builder.WriteString(upperIdentifierWord(word))
	}

	identifier := builder.String()
	if identifier == "" {
		identifier = "value"
	}

	first, _ := utf8.DecodeRuneInString(identifier)
	if unicode.IsDigit(first) {
		if upperCamel {
			identifier = "Value" + identifier
		} else {
			identifier = "value" + identifier
		}
	}

	return identifier
}

func splitIdentifierWords(value string) []string {
	segments := make([][]rune, 0, 4) //nolint:mnd
	current := make([]rune, 0, len(value))

	flushCurrent := func() {
		if len(current) == 0 {
			return
		}

		segment := make([]rune, len(current))
		copy(segment, current)
		segments = append(segments, segment)
		current = current[:0]
	}

	for _, char := range value {
		if unicode.IsLetter(char) || unicode.IsDigit(char) {
			current = append(current, char)
			continue
		}

		flushCurrent()
	}

	flushCurrent()

	words := make([]string, 0, len(segments))
	for _, segment := range segments {
		words = append(words, splitCamelSegment(segment)...)
	}

	return words
}

func splitCamelSegment(segment []rune) []string {
	if len(segment) == 0 {
		return nil
	}

	words := make([]string, 0, 2) //nolint:mnd
	start := 0

	for i := 1; i < len(segment); i++ {
		previous := segment[i-1]
		current := segment[i]

		if unicode.IsUpper(current) && (unicode.IsLower(previous) || unicode.IsDigit(previous)) {
			words = append(words, string(segment[start:i]))
			start = i

			continue
		}

		if i+1 < len(segment) && unicode.IsUpper(previous) && unicode.IsUpper(current) &&
			unicode.IsLower(segment[i+1]) {
			words = append(words, string(segment[start:i]))
			start = i
		}
	}

	words = append(words, string(segment[start:]))

	return words
}

func lowerIdentifierWord(word string) string {
	return strings.ToLower(word)
}

func upperIdentifierWord(word string) string {
	word = strings.ToLower(word)
	if word == "" {
		return word
	}

	runes := []rune(word)
	runes[0] = unicode.ToUpper(runes[0])

	return string(runes)
}

func escapeSwiftKeyword(identifier string) string {
	if _, ok := swiftKeywords[identifier]; ok {
		return "`" + identifier + "`"
	}

	return identifier
}

//nolint:gochecknoglobals
var swiftKeywords = map[string]struct{}{
	"Any":            {},
	"Self":           {},
	"Type":           {},
	"associatedtype": {},
	"associativity":  {},
	"break":          {},
	"case":           {},
	"catch":          {},
	"class":          {},
	"continue":       {},
	"convenience":    {},
	"default":        {},
	"defer":          {},
	"deinit":         {},
	"didSet":         {},
	"do":             {},
	"dynamic":        {},
	"else":           {},
	"enum":           {},
	"extension":      {},
	"fallthrough":    {},
	"false":          {},
	"fileprivate":    {},
	"final":          {},
	"for":            {},
	"func":           {},
	"get":            {},
	"guard":          {},
	"if":             {},
	"import":         {},
	"in":             {},
	"indirect":       {},
	"infix":          {},
	"init":           {},
	"inout":          {},
	"internal":       {},
	"is":             {},
	"lazy":           {},
	"left":           {},
	"let":            {},
	"mutating":       {},
	"nil":            {},
	"none":           {},
	"nonmutating":    {},
	"open":           {},
	"operator":       {},
	"optional":       {},
	"override":       {},
	"postfix":        {},
	"precedence":     {},
	"prefix":         {},
	"private":        {},
	"protocol":       {},
	"public":         {},
	"repeat":         {},
	"required":       {},
	"rethrows":       {},
	"return":         {},
	"right":          {},
	"safe":           {},
	"self":           {},
	"set":            {},
	"some":           {},
	"static":         {},
	"struct":         {},
	"subscript":      {},
	"super":          {},
	"switch":         {},
	"throw":          {},
	"throws":         {},
	"true":           {},
	"try":            {},
	"unowned":        {},
	"var":            {},
	"weak":           {},
	"where":          {},
	"while":          {},
	"willSet":        {},
}

func swiftStringLiteral(value string) string {
	var builder strings.Builder
	builder.WriteByte('"')

	for _, char := range value {
		switch char {
		case '\\':
			builder.WriteString("\\\\")
		case '"':
			builder.WriteString("\\\"")
		case '\n':
			builder.WriteString("\\n")
		case '\r':
			builder.WriteString("\\r")
		case '\t':
			builder.WriteString("\\t")
		default:
			if char < ' ' {
				builder.WriteString("\\u{")
				builder.WriteString(strconv.FormatInt(int64(char), 16))
				builder.WriteByte('}')

				continue
			}

			builder.WriteRune(char)
		}
	}

	builder.WriteByte('"')

	return builder.String()
}
