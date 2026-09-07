// Package python implements a codegen Plugin that renders an async, pydantic v2
// based Python client from an OpenAPI document. It follows the same thin-plugin
// approach as the typescript plugin: naming/type mapping live here, everything
// else lives in the templates.
package python

import (
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"maps"
	"slices"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/nhost/nhost/tools/codegen/format"
	"github.com/nhost/nhost/tools/codegen/processor"
	"github.com/pb33f/libopenapi/datamodel/high/base"
)

const (
	extCustomType                  = "x-python-type"
	extSensitive                   = "x-nhost-sensitive"
	pythonContinuationIndentation  = 4
	pythonFieldArgumentIndentation = 8
	pythonLineLength               = 100
	pythonMethodBodyIndentation    = 8
	pythonMinErrorStatus           = 300
	pythonMediaApplicationJSON     = "application/json"
	pyAny                          = "Any"
	// pyNone is the Python literal for the absence of a value, used both as the
	// runtime return type for void results and as the enum value for a JSON null.
	pyNone = "None"
)

var (
	errUnsupportedQuerySerialization      = errors.New("unsupported query serialization")
	errUnsupportedHeaderSerialization     = errors.New("unsupported header serialization")
	errUnsupportedRedirectHeaderParameter = errors.New("unsupported redirect header parameter")
)

//go:embed templates/*.tmpl
var templatesFS embed.FS

// Python is the code generation plugin for the Python SDK.
type Python struct{}

func (p *Python) GetTemplates() fs.FS {
	return templatesFS
}

// pythonKeywords contains Python's hard keywords. Collisions get a trailing
// underscore and rely on the pydantic alias to preserve the wire name.
var pythonKeywords = map[string]struct{}{ //nolint:gochecknoglobals
	"False": {}, "None": {}, "True": {}, "and": {}, "as": {}, "assert": {},
	"async": {}, "await": {}, "break": {}, "class": {}, "continue": {},
	"def": {}, "del": {}, "elif": {}, "else": {}, "except": {}, "finally": {},
	"for": {}, "from": {}, "global": {}, "if": {}, "import": {}, "in": {},
	"is": {}, "lambda": {}, "nonlocal": {}, "not": {}, "or": {}, "pass": {},
	"raise": {}, "return": {}, "try": {}, "while": {}, "with": {}, "yield": {},
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
			if underscoreBeforeUpper(runes, i) {
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

// underscoreBeforeUpper reports whether a snake_case underscore should be
// inserted before the uppercase rune at index i, marking a camelCase or
// PascalCase word boundary without doubling an underscore that a preceding
// separator already emits.
func underscoreBeforeUpper(runes []rune, i int) bool {
	if i == 0 {
		return false
	}

	prev := runes[i-1]
	if prev == '-' || prev == ' ' || prev == '.' {
		return false
	}

	prevBoundary := unicode.IsLower(prev) || unicode.IsDigit(prev)
	nextLower := i+1 < len(runes) && unicode.IsLower(runes[i+1])

	return prevBoundary || nextLower
}

// isBinarySchema reports whether a schema is a binary string (string,
// format: binary), which maps to Python bytes and a multipart file part.
func isBinarySchema(schema *base.SchemaProxy) bool {
	if schema == nil || schema.Schema() == nil {
		return false
	}

	s := schema.Schema()

	return len(s.Type) > 0 && s.Type[0] == "string" && s.Format == "binary"
}

func safeIdentifier(name string) string {
	switch {
	case name == "":
		return "field"
	case unicode.IsDigit([]rune(name)[0]):
		return "field_" + name
	case strings.HasPrefix(name, "model_"):
		return name + "_"
	}

	if _, ok := pythonKeywords[name]; ok {
		return name + "_"
	}

	return name
}

func toPascal(name string) string {
	parts := strings.Split(name, "_")
	for i := range parts {
		parts[i] = format.Title(parts[i])
	}

	return strings.Join(parts, "")
}

// pythonTypeName removes OpenAPI word separators without case-folding existing
// letters, preserving acronym spellings such as JWK and S256 in public types.
func pythonTypeName(name string) string {
	return toPascal(format.ToCamelCase(name))
}

// pythonDocstringLiteral returns value as a safe Python triple-quoted string.
// strconv.Quote escapes every delimiter, backslash, control character, and
// newline before the outer quotes are replaced, so specification text cannot
// terminate the generated literal or become executable Python.
func pythonDocstringLiteral(value string) string {
	quoted := strconv.Quote(value)

	return `"""` + quoted[1:len(quoted)-1] + `"""`
}

// pythonStringLiteral follows Ruff's quote normalization by using single
// quotes only when doing so reduces the number of escaped delimiters.
func pythonStringLiteral(value string) string {
	literal := strconv.Quote(value)
	if strings.Count(value, `"`) <= strings.Count(value, "'") {
		return literal
	}

	body := literal[1 : len(literal)-1]
	body = strings.ReplaceAll(body, "'", `\'`)
	body = strings.ReplaceAll(body, `\"`, `"`)

	return "'" + body + "'"
}

// splitPythonLiterals divides value only at UTF-8 rune boundaries, preferring
// whitespace boundaries, so adjacent Python literals recreate the exact value.
func splitPythonLiterals(
	value string,
	maxLiteralLength int,
	render func(string) string,
) []string {
	var literals []string
	for value != "" {
		bestEnd := 0
		whitespaceEnd := 0

		for start, r := range value {
			_, size := utf8.DecodeRuneInString(value[start:])

			end := start + size
			if len(render(value[:end])) > maxLiteralLength {
				break
			}

			bestEnd = end
			if unicode.IsSpace(r) {
				whitespaceEnd = end
			}
		}

		if bestEnd == len(value) {
			literals = append(literals, render(value))

			break
		}

		if whitespaceEnd > 0 {
			bestEnd = whitespaceEnd
		}

		if bestEnd == 0 {
			_, bestEnd = utf8.DecodeRuneInString(value)
		}

		literals = append(literals, render(value[:bestEnd]))
		value = value[bestEnd:]
	}

	return literals
}

// pythonStringExpression renders a literal directly when it fits, otherwise as
// adjacent literals in parentheses. Python concatenates the fragments without
// changing the runtime string value.
func pythonStringExpression(
	value string,
	indentation, prefixLength int,
	render func(string) string,
) string {
	literal := render(value)
	if indentation+prefixLength+len(literal) <= pythonLineLength {
		return literal
	}

	literalIndentation := indentation + pythonContinuationIndentation
	literals := splitPythonLiterals(
		value,
		pythonLineLength-literalIndentation,
		render,
	)

	var expression strings.Builder
	expression.WriteString("(\n")

	for _, fragment := range literals {
		expression.WriteString(strings.Repeat(" ", literalIndentation))
		expression.WriteString(fragment)
		expression.WriteByte('\n')
	}

	expression.WriteString(strings.Repeat(" ", indentation))
	expression.WriteByte(')')

	return expression.String()
}

func pythonDocstringExpression(value string, indentation int) string {
	return pythonStringExpression(value, indentation, 0, pythonDocstringLiteral)
}

func documentationText(description, example, pattern, schemaFormat string) string {
	var parts []string
	if description != "" {
		parts = append(parts, description)
	}

	for _, attribute := range []struct {
		label string
		value string
	}{
		{label: "Example", value: example},
		{label: "Pattern", value: pattern},
		{label: "Format", value: schemaFormat},
	} {
		if attribute.value != "" {
			parts = append(parts, attribute.label+": "+attribute.value)
		}
	}

	return strings.Join(parts, "\n\n")
}

func parameterDocumentation(
	description, schemaDescription, example, pattern, schemaFormat string,
) string {
	if schemaDescription != "" && schemaDescription != description {
		if description == "" {
			description = schemaDescription
		} else {
			description += "\n\n" + schemaDescription
		}
	}

	return documentationText(description, example, pattern, schemaFormat)
}

// fieldDefinition renders a single pydantic field line "name: type[ = default]",
// wiring Field arguments for aliases, defaults, documentation, and
// sensitive-value repr redaction.
func fieldDefinition(
	name, rawName, typeName, description string,
	optional, missable, sensitive bool,
) string {
	if optional {
		typeName += " | None"
	}

	var fieldArgs []string
	if missable && (name != rawName || sensitive || description != "") {
		fieldArgs = append(fieldArgs, "default=None")
	}

	if name != rawName {
		fieldArgs = append(fieldArgs, fmt.Sprintf("alias=%q", rawName))
	}

	if sensitive {
		fieldArgs = append(fieldArgs, "repr=False")
	}

	if description != "" {
		fieldArgs = append(
			fieldArgs,
			"description="+pythonStringExpression(
				description,
				pythonFieldArgumentIndentation,
				len("description="),
				pythonStringLiteral,
			),
		)
	}

	var suffix string
	switch {
	case description != "":
		suffix = " = Field(\n        " + strings.Join(fieldArgs, ",\n        ") + ",\n    )"
	case len(fieldArgs) > 0:
		suffix = " = Field(" + strings.Join(fieldArgs, ", ") + ")"
	case missable:
		suffix = " = None"
	}

	return fmt.Sprintf("%s: %s%s", name, typeName, suffix)
}

// sensitiveFieldName deliberately uses a conservative built-in vocabulary so
// generated credential types are safe even when an OpenAPI author forgets the
// explicit x-nhost-sensitive marker. Unusual names can opt in with the marker.
func sensitiveFieldName(name string) bool {
	name = toSnakeCase(name)

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

func explicitlySensitive(typ processor.Type) bool {
	schema := typ.Schema()
	if schema == nil || schema.Schema() == nil {
		return false
	}

	extension, ok := schema.Schema().Extensions.Get(extSensitive)
	if !ok {
		return false
	}

	var sensitive bool
	if err := extension.Decode(&sensitive); err != nil {
		// Extension validation runs before rendering. Fail closed if this helper is
		// called independently so malformed input can never expose a marked value.
		return true
	}

	return sensitive
}

func canContainSensitiveValue(typ processor.Type) bool {
	schema := typ.Schema()
	if schema == nil || schema.Schema() == nil || len(schema.Schema().Type) != 1 {
		return true
	}

	switch schema.Schema().Type[0] {
	case "boolean", "integer", "number":
		return false
	default:
		return true
	}
}

func isSensitiveProperty(prop *processor.Property) bool {
	return explicitlySensitive(prop.Type) ||
		(canContainSensitiveValue(prop.Type) && sensitiveFieldName(prop.RawName()))
}

func isSensitiveParameter(param *processor.Parameter) bool {
	return explicitlySensitive(param.Type) ||
		(canContainSensitiveValue(param.Type) && sensitiveFieldName(param.RawName()))
}

type rawNamer interface {
	RawName() string
}

func pythonRawTypeName(typ processor.Type) string {
	if named, ok := typ.(rawNamer); ok {
		return named.RawName()
	}

	return typ.Name()
}

func validPythonIdentifier(identifier string) bool {
	if identifier == "" {
		return false
	}

	runes := []rune(identifier)
	if runes[0] != '_' && !unicode.IsLetter(runes[0]) {
		return false
	}

	for _, r := range runes[1:] {
		if r != '_' && !unicode.IsLetter(r) && !unicode.IsDigit(r) {
			return false
		}
	}

	_, keyword := pythonKeywords[identifier]

	return !keyword
}

func isReservedPythonDunder(identifier string) bool {
	return strings.HasPrefix(identifier, "__") && strings.HasSuffix(identifier, "__")
}

func registerPythonIdentifier(
	seen map[string]string, identifier, source, domain string,
) error {
	if !validPythonIdentifier(identifier) {
		return fmt.Errorf(
			"%w: Python %s contains invalid identifier %q generated by %s",
			processor.ErrUnsupportedFeature,
			domain,
			identifier,
			source,
		)
	}

	if isReservedPythonDunder(identifier) {
		return fmt.Errorf(
			"%w: Python %s contains reserved dunder identifier %q generated by %s",
			processor.ErrUnsupportedFeature,
			domain,
			identifier,
			source,
		)
	}

	if previous, exists := seen[identifier]; exists {
		return fmt.Errorf(
			"%w: Python %s collision: %s and %s both generate identifier %q",
			processor.ErrUnsupportedFeature,
			domain,
			previous,
			source,
			identifier,
		)
	}

	seen[identifier] = source

	return nil
}

func validatePythonFieldNames(object *processor.TypeObject) error {
	seen := map[string]string{
		"model_config": `generated pydantic field "model_config"`,
	}
	for _, property := range object.Properties() {
		if err := registerPythonIdentifier(
			seen,
			property.Name(),
			fmt.Sprintf("property %q", property.RawName()),
			fmt.Sprintf("field namespace for type %q", object.RawName()),
		); err != nil {
			return err
		}
	}

	return nil
}

func validatePythonParameterFields(method *processor.Method) error {
	seen := map[string]string{
		"model_config": `generated pydantic field "model_config"`,
	}
	for _, parameter := range method.QueryParameters() {
		if err := registerPythonIdentifier(
			seen,
			parameter.Name(),
			fmt.Sprintf("query parameter %q", parameter.RawName()),
			fmt.Sprintf("parameter model for operation %q", method.RawName()),
		); err != nil {
			return err
		}
	}

	if !method.IsRedirect() {
		for _, parameter := range method.HeaderParameters() {
			if err := registerPythonIdentifier(
				seen,
				parameter.Name(),
				fmt.Sprintf("header parameter %q", parameter.RawName()),
				fmt.Sprintf("parameter model for operation %q", method.RawName()),
			); err != nil {
				return err
			}
		}
	}

	return nil
}

func methodHasRenderedBody(method *processor.Method) bool {
	return method.RequestJSON() != nil || method.RequestFormData() != nil ||
		method.RequestFormURLEncoded() != nil
}

func pythonRedirectMethodBindingNames(method *processor.Method) map[string]string {
	seen := map[string]string{
		"self": "generated Client receiver",
		"url":  "generated request URL local",
	}
	if method.HasQueryParameters() {
		seen["params"] = "generated request parameters argument"
		seen["query"] = "generated query local"
	}

	return seen
}

func pythonRequestMethodBindingNames(method *processor.Method) map[string]string {
	seen := map[string]string{
		"headers":  "generated request headers argument",
		"payload":  "generated response payload local",
		"query":    "generated query local",
		"request":  "generated request local",
		"response": "generated response local",
		"self":     "generated Client receiver",
		"url":      "generated request URL local",
	}
	if hasRequestParameters(method) {
		seen["params"] = "generated request parameters argument"
	}

	if methodHasRenderedBody(method) {
		seen["body"] = "generated request body argument"
	}

	return seen
}

func validatePythonMethodBindings(method *processor.Method) error {
	seen := pythonRequestMethodBindingNames(method)
	if method.IsRedirect() {
		seen = pythonRedirectMethodBindingNames(method)
	}

	for _, parameter := range method.PathParameters() {
		if err := registerPythonIdentifier(
			seen,
			parameter.Name(),
			fmt.Sprintf("path parameter %q", parameter.RawName()),
			fmt.Sprintf("method bindings for operation %q", method.RawName()),
		); err != nil {
			return err
		}
	}

	return nil
}

func pythonModuleNames(
	types []processor.Type,
	methods []*processor.Method,
) map[string]string {
	names := map[string]string{
		"BaseModel":             `generated import "BaseModel"`,
		"Client":                `generated type "Client"`,
		"ConfigDict":            `generated import "ConfigDict"`,
		"Middleware":            `generated import "Middleware"`,
		"Sequence":              `generated import "Sequence"`,
		"UUID":                  `generated import "UUID"`,
		"_MIN_ERROR_STATUS":     "generated HTTP status constant",
		"create_fetch_pipeline": `generated import "create_fetch_pipeline"`,
		"date":                  `generated import "date"`,
		"datetime":              `generated import "datetime"`,
		"httpx":                 `generated import "httpx"`,
	}
	addPythonImportNames(names, types, methods)

	if hasPathParameters(methods) {
		names["quote"] = `generated import "quote"`
		names["_escape_path"] = "generated path escaping helper"
	}

	if hasQueryParameters(methods) || hasHeaderParameters(methods) {
		names["_parameter_scalar"] = "generated parameter scalar helper"
	}

	if hasQueryParameters(methods) {
		names["_query_parameter"] = "generated query serialization helper"
	}

	if hasHeaderParameters(methods) {
		names["_header_value"] = "generated header serialization helper"
	}

	if hasMultipartMethods(methods) {
		names["_MultipartFileParts"] = "generated multipart file-parts container"
	}

	return names
}

func addPythonImportNames(
	names map[string]string,
	types []processor.Type,
	methods []*processor.Method,
) {
	imports := []struct {
		name string
		used bool
	}{
		{name: "Any", used: usesAny(types, methods)},
		{name: "Literal", used: usesLiteral(types, methods)},
		{name: "Field", used: usesField(types, methods)},
		{name: "Mapping", used: hasNonRedirectMethods(methods)},
		{name: "FetchResponse", used: hasNonRedirectMethods(methods)},
		{name: "HTTPError", used: hasNonRedirectMethods(methods)},
		{name: "UploadFile", used: usesBinary(types, methods)},
		{name: "to_file_part", used: hasMultipartMethods(methods)},
		{name: "decode_json", used: usesDecodeJSON(methods)},
		{name: "to_json", used: usesToJSON(methods)},
		{name: "to_jsonable", used: usesToJSONable(methods)},
	}

	for _, pythonImport := range imports {
		if pythonImport.used {
			names[pythonImport.name] = fmt.Sprintf(`generated import %q`, pythonImport.name)
		}
	}
}

func validatePythonNames(types []processor.Type, methods []*processor.Method) (string, error) {
	typeNames := pythonModuleNames(types, methods)
	if err := validatePythonTypeNames(types, typeNames); err != nil {
		return "", err
	}

	methodNames := map[string]string{
		"__aenter__":          `generated Client method "__aenter__"`,
		"__aexit__":           `generated Client method "__aexit__"`,
		"__init__":            `generated Client method "__init__"`,
		"_chain_functions":    `generated Client attribute "_chain_functions"`,
		"_fetch":              `generated Client attribute "_fetch"`,
		"_http":               `generated Client attribute "_http"`,
		"_owns_http_client":   `generated Client attribute "_owns_http_client"`,
		"aclose":              `generated Client method "aclose"`,
		"base_url":            `generated Client attribute "base_url"`,
		"push_chain_function": `generated Client method "push_chain_function"`,
	}
	for _, method := range methods {
		methodName := method.Name()
		if method.IsRedirect() {
			methodName += "_url"
		}

		if err := registerPythonIdentifier(
			methodNames,
			methodName,
			fmt.Sprintf("operation %q", method.RawName()),
			"Client namespace",
		); err != nil {
			return "", err
		}

		if hasRequestParameters(method) {
			if err := registerPythonIdentifier(
				typeNames,
				toPascal(method.Name())+"Params",
				fmt.Sprintf("parameter model for operation %q", method.RawName()),
				"module namespace",
			); err != nil {
				return "", err
			}

			if err := validatePythonParameterFields(method); err != nil {
				return "", err
			}
		}

		if err := validatePythonMethodBindings(method); err != nil {
			return "", err
		}
	}

	return "", nil
}

func validatePythonTypeNames(types []processor.Type, typeNames map[string]string) error {
	for _, typ := range types {
		rawName := pythonRawTypeName(typ)
		if isReservedPythonDunder(rawName) {
			return fmt.Errorf(
				"%w: Python module namespace contains reserved dunder identifier %q generated by type %q",
				processor.ErrUnsupportedFeature,
				rawName,
				rawName,
			)
		}

		if err := registerPythonIdentifier(
			typeNames,
			typ.Name(),
			fmt.Sprintf("type %q", rawName),
			"module namespace",
		); err != nil {
			return err
		}

		if object, ok := typ.(*processor.TypeObject); ok {
			if err := validatePythonFieldNames(object); err != nil {
				return err
			}
		}
	}

	return nil
}

func validateSensitiveExtension(typ processor.Type, source string) error {
	schema := typ.Schema()
	if schema == nil || schema.Schema() == nil {
		return nil
	}

	extension, ok := schema.Schema().Extensions.Get(extSensitive)
	if !ok {
		return nil
	}

	var sensitive bool
	if err := extension.Decode(&sensitive); err != nil {
		return fmt.Errorf(
			"%w: %s on %s must be the boolean true: %w",
			processor.ErrUnsupportedFeature,
			extSensitive,
			source,
			err,
		)
	}

	if !sensitive {
		return fmt.Errorf(
			"%w: %s on %s must be true; remove the extension when the value is not sensitive",
			processor.ErrUnsupportedFeature,
			extSensitive,
			source,
		)
	}

	return nil
}

func validateSensitiveType(
	typ processor.Type, source string, visited map[*base.SchemaProxy]struct{},
) error {
	schema := typ.Schema()
	if schema == nil {
		return nil
	}

	if _, ok := visited[schema]; ok {
		return nil
	}

	visited[schema] = struct{}{}

	if err := validateSensitiveExtension(typ, source); err != nil {
		return err
	}

	switch concrete := typ.(type) {
	case *processor.TypeArray:
		return validateSensitiveType(concrete.Item, source+" array item", visited)
	case *processor.TypeAlias:
		return validateSensitiveType(concrete.Alias(), source, visited)
	case *processor.TypeObject:
		for _, prop := range concrete.Properties() {
			if err := validateSensitiveType(
				prop.Type,
				fmt.Sprintf("property %q of type %q", prop.RawName(), concrete.RawName()),
				visited,
			); err != nil {
				return err
			}
		}
	}

	return nil
}

func validateSensitiveExtensions(
	types []processor.Type, methods []*processor.Method,
) (string, error) {
	visited := make(map[*base.SchemaProxy]struct{})
	for _, typ := range types {
		if err := validateSensitiveType(
			typ, fmt.Sprintf("type %q", pythonRawTypeName(typ)), visited,
		); err != nil {
			return "", err
		}
	}

	for _, method := range methods {
		for _, param := range method.Parameters {
			if err := validateSensitiveType(
				param.Type,
				fmt.Sprintf(
					"%s parameter %q of operation %q",
					param.Parameter.In,
					param.RawName(),
					method.RawName(),
				),
				visited,
			); err != nil {
				return "", err
			}
		}
	}

	return "", nil
}

func validatePythonTypeExtension(typ processor.Type, source string) error {
	schema := typ.Schema()
	if schema == nil || schema.Schema() == nil {
		return nil
	}

	extension, ok := schema.Schema().Extensions.Get(extCustomType)
	if !ok {
		return nil
	}

	if extension.Tag != "!!str" {
		return fmt.Errorf(
			"%w: %s on %s must be a string",
			processor.ErrUnsupportedFeature,
			extCustomType,
			source,
		)
	}

	if strings.TrimSpace(extension.Value) == "" {
		return fmt.Errorf(
			"%w: %s on %s must be a non-empty string",
			processor.ErrUnsupportedFeature,
			extCustomType,
			source,
		)
	}

	return nil
}

func validatePythonExtensions(
	types []processor.Type, methods []*processor.Method,
) (string, error) {
	var validationErr error
	visitPythonTypes(types, methods, func(typ processor.Type, source string) {
		if validationErr == nil {
			validationErr = validatePythonTypeExtension(typ, source)
		}
	})

	return "", validationErr
}

func validateParameters(methods []*processor.Method) (string, error) {
	for _, method := range methods {
		if err := validateQueryParameters(method); err != nil {
			return "", err
		}

		if err := validateRedirectHeaderParameters(method); err != nil {
			return "", err
		}

		if method.IsRedirect() {
			continue
		}

		for _, parameter := range method.HeaderParameters() {
			if !parameter.HasContent() && parameter.Style() != "simple" {
				return "", fmt.Errorf(
					"%w: header parameter %q on method %q uses unsupported style %q",
					errUnsupportedHeaderSerialization,
					parameter.RawName(),
					method.RawName(),
					parameter.Style(),
				)
			}
		}
	}

	return "", nil
}

func validateRedirectHeaderParameters(method *processor.Method) error {
	if !method.IsRedirect() {
		return nil
	}

	for _, parameter := range method.HeaderParameters() {
		if parameter.Required() {
			return fmt.Errorf(
				"%w: required header parameter %q on redirect operation %q cannot be represented by a URL builder",
				errUnsupportedRedirectHeaderParameter,
				parameter.RawName(),
				method.RawName(),
			)
		}
	}

	return nil
}

func validateQueryParameters(method *processor.Method) error {
	for _, parameter := range method.QueryParameters() {
		if parameter.HasContent() {
			continue
		}

		switch parameter.Style() {
		case "form":
			continue
		case "deepObject":
			if !parameter.Explode() {
				return fmt.Errorf(
					"%w: query parameter %q on method %q uses deepObject with explode=false",
					errUnsupportedQuerySerialization,
					parameter.RawName(),
					method.RawName(),
				)
			}

			kind := parameter.Type.Kind()
			if kind != processor.KindIdentifierMap && kind != processor.KindIdentifierObject {
				return fmt.Errorf(
					"%w: query parameter %q on method %q uses deepObject with unsupported %s type",
					errUnsupportedQuerySerialization,
					parameter.RawName(),
					method.RawName(),
					kind,
				)
			}
		default:
			return fmt.Errorf(
				"%w: query parameter %q on method %q uses unsupported style %q",
				errUnsupportedQuerySerialization,
				parameter.RawName(),
				method.RawName(),
				parameter.Style(),
			)
		}
	}

	return nil
}

func visitPythonType(
	typ processor.Type,
	source string,
	visited map[*base.SchemaProxy]struct{},
	visit func(processor.Type, string),
) {
	if typ == nil || typ.Schema() == nil {
		return
	}

	if _, ok := visited[typ.Schema()]; ok {
		return
	}

	visited[typ.Schema()] = struct{}{}
	visit(typ, source)

	switch concrete := typ.(type) {
	case *processor.TypeAlias:
		visitPythonType(concrete.Alias(), source, visited, visit)
	case *processor.TypeArray:
		visitPythonType(concrete.Item, source+" array item", visited, visit)
	case *processor.TypeObject:
		for _, property := range concrete.Properties() {
			propertySource := fmt.Sprintf(
				"property %q of type %q", property.RawName(), concrete.RawName(),
			)
			if concrete.RawName() == "" {
				propertySource = fmt.Sprintf("%s property %q", source, property.RawName())
			}

			visitPythonType(property.Type, propertySource, visited, visit)
		}
	}
}

func visitPythonTypes(
	types []processor.Type,
	methods []*processor.Method,
	visit func(processor.Type, string),
) {
	visited := make(map[*base.SchemaProxy]struct{})
	for _, typ := range types {
		visitPythonType(
			typ,
			fmt.Sprintf("type %q", pythonRawTypeName(typ)),
			visited,
			visit,
		)
	}

	for _, method := range methods {
		visitPythonType(
			methodBody(method),
			fmt.Sprintf("request body of operation %q", method.RawName()),
			visited,
			visit,
		)

		for _, parameter := range method.Parameters {
			visitPythonType(
				parameter.Type,
				fmt.Sprintf(
					"%s parameter %q of operation %q",
					parameter.Parameter.In,
					parameter.RawName(),
					method.RawName(),
				),
				visited,
				visit,
			)
		}

		for status, responsesByMediaType := range method.Responses {
			statusCode, err := strconv.Atoi(status)
			if err != nil {
				panic(fmt.Sprintf("invalid response code %s: %v", status, err))
			}

			if statusCode >= pythonMinErrorStatus {
				continue
			}

			responseType, ok := responsesByMediaType[pythonMediaApplicationJSON]
			if !ok {
				continue
			}

			visitPythonType(
				responseType,
				fmt.Sprintf(
					"%s response %q schema of operation %q",
					status,
					pythonMediaApplicationJSON,
					method.RawName(),
				),
				visited,
				visit,
			)
		}
	}
}

func usesPythonType(
	types []processor.Type,
	methods []*processor.Method,
	match func(processor.Type) bool,
) bool {
	found := false
	visitPythonTypes(types, methods, func(typ processor.Type, _ string) {
		if match(typ) {
			found = true
		}
	})

	return found
}

func usesSchemaFormat(
	types []processor.Type,
	methods []*processor.Method,
	formats ...string,
) bool {
	wanted := make(map[string]struct{}, len(formats))
	for _, schemaFormat := range formats {
		wanted[schemaFormat] = struct{}{}
	}

	return usesPythonType(types, methods, func(typ processor.Type) bool {
		schema := typ.Schema()
		if schema == nil || schema.Schema() == nil {
			return false
		}

		_, ok := wanted[schema.Schema().Format]

		return ok
	})
}

func usesBinary(types []processor.Type, methods []*processor.Method) bool {
	return usesPythonType(types, methods, func(typ processor.Type) bool {
		return isBinarySchema(typ.Schema())
	})
}

func usesLiteral(types []processor.Type, methods []*processor.Method) bool {
	return usesPythonType(types, methods, func(typ processor.Type) bool {
		return typ.Kind() == processor.KindIdentifierEnum
	})
}

func usesAny(types []processor.Type, methods []*processor.Method) bool {
	if hasQueryParameters(methods) || hasHeaderParameters(methods) ||
		hasMultipartMethods(methods) {
		return true
	}

	return usesPythonType(types, methods, func(typ processor.Type) bool {
		switch concrete := typ.(type) {
		case *processor.TypeMap:
			return concrete.Name() == "dict[str, Any]"
		case *processor.TypeScalar:
			return concrete.Name() == pyAny
		case *processor.TypeAlias:
			return concrete.Alias().Name() == pyAny
		default:
			return false
		}
	})
}

func typeHasFieldDocumentation(typ processor.Type) bool {
	if typ == nil || typ.Schema() == nil || typ.Schema().Schema() == nil {
		return false
	}

	schema := typ.Schema().Schema()

	return schema.Description != "" || schema.Example != nil || schema.Pattern != "" ||
		schema.Format != ""
}

func usesField(types []processor.Type, methods []*processor.Method) bool {
	if usesPythonType(types, methods, func(typ processor.Type) bool {
		object, ok := typ.(*processor.TypeObject)
		if !ok {
			return false
		}

		for _, property := range object.Properties() {
			if property.Name() != property.RawName() || isSensitiveProperty(property) ||
				typeHasFieldDocumentation(property.Type) {
				return true
			}
		}

		return false
	}) {
		return true
	}

	for _, method := range methods {
		if slices.ContainsFunc(method.QueryParameters(), parameterUsesField) {
			return true
		}

		if !method.IsRedirect() && slices.ContainsFunc(
			method.HeaderParameters(),
			parameterUsesField,
		) {
			return true
		}
	}

	return false
}

func parameterUsesField(parameter *processor.Parameter) bool {
	return parameter.Name() != parameter.RawName() || isSensitiveParameter(parameter) ||
		parameter.Parameter.Description != "" || typeHasFieldDocumentation(parameter.Type)
}

func hasNonRedirectMethods(methods []*processor.Method) bool {
	for _, method := range methods {
		if !method.IsRedirect() {
			return true
		}
	}

	return false
}

func usesDecodeJSON(methods []*processor.Method) bool {
	for _, method := range methods {
		if !method.IsRedirect() && method.ResponseJSON() {
			return true
		}
	}

	return false
}

func usesToJSON(methods []*processor.Method) bool {
	for _, method := range methods {
		if slices.ContainsFunc(method.QueryParameters(), (*processor.Parameter).HasContent) {
			return true
		}

		if !method.IsRedirect() && slices.ContainsFunc(
			method.HeaderParameters(),
			(*processor.Parameter).HasContent,
		) {
			return true
		}

		multipart, ok := method.RequestFormData().(*processor.TypeObject)
		if !ok {
			continue
		}

		for _, property := range multipart.Properties() {
			switch typ := property.Type.(type) {
			case *processor.TypeScalar:
				continue
			case *processor.TypeArray:
				if typ.Item.Kind() != processor.KindIdentifierScalar {
					return true
				}
			default:
				return true
			}
		}
	}

	return false
}

func multipartUsesToJSONable(method *processor.Method) bool {
	multipart, ok := method.RequestFormData().(*processor.TypeObject)
	if !ok {
		return false
	}

	for _, property := range multipart.Properties() {
		switch typ := property.Type.(type) {
		case *processor.TypeScalar:
			if !isBinarySchema(typ.Schema()) {
				return true
			}
		case *processor.TypeArray:
			if typ.Item.Kind() == processor.KindIdentifierScalar &&
				!isBinarySchema(typ.Item.Schema()) {
				return true
			}
		}
	}

	return false
}

func usesToJSONable(methods []*processor.Method) bool {
	for _, method := range methods {
		if method.HasQueryParameters() ||
			(!method.IsRedirect() && method.HasHeaderParameters()) ||
			method.RequestJSON() != nil || method.RequestFormURLEncoded() != nil ||
			multipartUsesToJSONable(method) {
			return true
		}
	}

	return false
}

func hasRequestParameters(method *processor.Method) bool {
	return method.HasQueryParameters() || (!method.IsRedirect() && method.HasHeaderParameters())
}

func hasRequiredRequestParameters(method *processor.Method) bool {
	return method.HasRequiredQueryParameters() ||
		(!method.IsRedirect() && method.HasRequiredHeaderParameters())
}

func hasQueryParameters(methods []*processor.Method) bool {
	for _, method := range methods {
		if method.HasQueryParameters() {
			return true
		}
	}

	return false
}

func hasPathParameters(methods []*processor.Method) bool {
	for _, method := range methods {
		if len(method.PathParameters()) > 0 {
			return true
		}
	}

	return false
}

func hasMultipartMethods(methods []*processor.Method) bool {
	for _, method := range methods {
		if method.RequestFormData() != nil {
			return true
		}
	}

	return false
}

func hasHeaderParameters(methods []*processor.Method) bool {
	for _, method := range methods {
		if !method.IsRedirect() && method.HasHeaderParameters() {
			return true
		}
	}

	return false
}

func pythonReturnType(typeName string) string {
	if typeName == "" {
		return pyNone
	}

	parts := strings.Split(typeName, " | ")
	for i, part := range parts {
		if part == "" || part == "void" {
			parts[i] = pyNone
		}
	}

	return strings.Join(parts, " | ")
}

func methodOperationDocumentation(method *processor.Method) []string {
	if method.Operation == nil {
		return nil
	}

	var sections []string
	if method.Operation.Summary != "" {
		sections = append(sections, method.Operation.Summary)
	}

	if method.Operation.Description != "" &&
		method.Operation.Description != method.Operation.Summary {
		sections = append(sections, method.Operation.Description)
	}

	return sections
}

func pathParameterDocumentation(parameter *processor.Parameter) string {
	description := parameter.Parameter.Description
	if description == "" && parameter.Type.Schema() != nil &&
		parameter.Type.Schema().Schema() != nil {
		description = parameter.Type.Schema().Schema().Description
	}

	if description == "" {
		description = "Path parameter."
	}

	return fmt.Sprintf(
		"    %s (%s): %s", parameter.Name(), parameter.Type.Name(), description,
	)
}

func methodBody(method *processor.Method) processor.Type { //nolint:ireturn
	switch {
	case method.RequestJSON() != nil:
		return method.RequestJSON()
	case method.RequestFormData() != nil:
		return method.RequestFormData()
	case method.RequestFormURLEncoded() != nil:
		return method.RequestFormURLEncoded()
	default:
		return nil
	}
}

func methodArgumentsDocumentation(method *processor.Method) string {
	args := make([]string, 0, len(method.PathParameters()))
	for _, parameter := range method.PathParameters() {
		args = append(args, pathParameterDocumentation(parameter))
	}

	if !method.IsRedirect() {
		if body := methodBody(method); body != nil {
			args = append(args, fmt.Sprintf("    body (%s): Request body.", body.Name()))
		}
	}

	if hasRequestParameters(method) {
		args = append(args, fmt.Sprintf(
			"    params (%sParams): Query and header parameters.", toPascal(method.Name()),
		))
	}

	if !method.IsRedirect() {
		args = append(args, "    headers (Mapping[str, str] | None): Additional request headers.")
	}

	if len(args) == 0 {
		return ""
	}

	return "Args:\n" + strings.Join(args, "\n")
}

func methodReturnDocumentation(method *processor.Method) string {
	if method.IsRedirect() {
		return "Returns:\n    str: The redirect URL."
	}

	return fmt.Sprintf(
		"Returns:\n    FetchResponse[%s]: The HTTP response.",
		pythonReturnType(method.ReturnType()),
	)
}

func methodDocumentation(method *processor.Method) string {
	sections := methodOperationDocumentation(method)
	if args := methodArgumentsDocumentation(method); args != "" {
		sections = append(sections, args)
	}

	sections = append(sections, methodReturnDocumentation(method))

	return pythonDocstringExpression(
		strings.Join(sections, "\n\n"),
		pythonMethodBodyIndentation,
	)
}

func pythonImportUsageFuncMap() map[string]any {
	return map[string]any{
		"pyHasNonRedirectMethods": hasNonRedirectMethods,
		"pyUsesAny":               usesAny,
		"pyUsesBinary":            usesBinary,
		"pyUsesDecodeJSON":        usesDecodeJSON,
		"pyUsesField":             usesField,
		"pyUsesLiteral":           usesLiteral,
		"pyUsesToJSON":            usesToJSON,
		"pyUsesToJSONable":        usesToJSONable,
		"pyUsesDate": func(types []processor.Type, methods []*processor.Method) bool {
			return usesSchemaFormat(types, methods, "date")
		},
		"pyUsesDateTime": func(types []processor.Type, methods []*processor.Method) bool {
			return usesSchemaFormat(types, methods, "date-time")
		},
		"pyUsesUUID": func(types []processor.Type, methods []*processor.Method) bool {
			return usesSchemaFormat(types, methods, "uuid")
		},
	}
}

func (p *Python) GetFuncMap() map[string]any {
	funcMap := map[string]any{
		"pyValidateExtensions":           validatePythonExtensions,
		"pyValidateSensitiveExtensions":  validateSensitiveExtensions,
		"pyValidateNames":                validatePythonNames,
		"pyValidateParameters":           validateParameters,
		"pyHasRequestParameters":         hasRequestParameters,
		"pyHasRequiredRequestParameters": hasRequiredRequestParameters,
		"pyAnyQueryParameters":           hasQueryParameters,
		"pyAnyPathParameters":            hasPathParameters,
		"pyAnyHeaderParameters":          hasHeaderParameters,
		"pyAnyMultipartMethods":          hasMultipartMethods,
		"pyMinErrorStatus":               func() int { return pythonMinErrorStatus },
		// pyReturnType turns the shared IR return type expression into a valid
		// runtime Python type expression usable inside a pydantic TypeAdapter.
		// Method.ReturnType() joins multiple 2xx media/void results with " | ",
		// so the "void" sentinel is mapped token-wise to leave real type names
		// that merely contain the substring "void" untouched.
		"pyReturnType": pythonReturnType,
		"pyDoc": func(
			description, example, pattern, schemaFormat string,
			indentation int,
		) string {
			return pythonDocstringExpression(
				documentationText(description, example, pattern, schemaFormat),
				indentation,
			)
		},
		"pyMethodDoc": methodDocumentation,
		// pyStr renders a Go string as a Python string literal, escaping like the
		// pydantic alias rendering (%q) so wire names / content types interpolated
		// into emitted code are always valid Python.
		"pyStr": func(s string) string {
			return fmt.Sprintf("%q", s)
		},
		// pyIsBinary reports whether a type is a binary-format scalar (string,
		// format: binary -> bytes), which must be sent as a multipart file part
		// rather than a plain form value.
		"pyIsBinary": func(t processor.Type) bool {
			return isBinarySchema(t.Schema())
		},
		// pascal converts a snake_case method name into a PascalCase class prefix
		// (used for the per-method query Params model name).
		"pascal": toPascal,
		"pyField": func(
			prop *processor.Property,
			description, example, pattern, schemaFormat string,
		) string {
			return fieldDefinition(
				prop.Name(), prop.RawName(), prop.Type.Name(),
				documentationText(description, example, pattern, schemaFormat),
				prop.Optional(), !prop.Required(), isSensitiveProperty(prop),
			)
		},
		"pyParamField": func(
			param *processor.Parameter,
			description, schemaDescription, example, pattern, schemaFormat string,
		) string {
			return fieldDefinition(
				param.Name(), param.RawName(), param.Type.Name(),
				parameterDocumentation(
					description, schemaDescription, example, pattern, schemaFormat,
				),
				!param.Required(), !param.Required(), isSensitiveParameter(param),
			)
		},
	}

	maps.Copy(funcMap, pythonImportUsageFuncMap())

	return funcMap
}

func (p *Python) TypeObjectName(name string) string {
	return pythonTypeName(name)
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
		switch schema.Format {
		case "binary":
			// Binary request-body parts accept raw bytes or an UploadFile that
			// carries an explicit filename and media type.
			return "bytes | UploadFile"
		case "date":
			return "date"
		case "date-time":
			return "datetime"
		case "uuid":
			return "UUID"
		default:
			return "str"
		}
	}

	return pyAny
}

func (p *Python) TypeArrayName(array *processor.TypeArray) string {
	if processor.SchemaNullable(array.Item.Schema()) {
		return "list[" + array.Item.Name() + " | None]"
	}

	return "list[" + array.Item.Name() + "]"
}

func (p *Python) TypeEnumName(name string) string {
	return pythonTypeName(name)
}

func (p *Python) TypeEnumValues(values []any) []string {
	enumValues := make([]string, len(values))
	for i, v := range values {
		switch val := v.(type) {
		case string:
			enumValues[i] = fmt.Sprintf("%q", val)
		case bool:
			if val {
				enumValues[i] = "True"
			} else {
				enumValues[i] = "False"
			}
		case nil:
			enumValues[i] = pyNone
		default:
			enumValues[i] = fmt.Sprintf("%v", val)
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
// braces escape the snake_cased parameter names as individual path segments.
func (p *Python) MethodPath(name string) string {
	var b strings.Builder

	for {
		open := strings.IndexByte(name, '{')
		if open < 0 {
			b.WriteString(name)

			break
		}

		end := strings.IndexByte(name[open:], '}')
		if end < 0 {
			b.WriteString(name)

			break
		}

		end += open
		b.WriteString(name[:open])
		b.WriteString("{_escape_path(")
		b.WriteString(safeIdentifier(toSnakeCase(name[open+1 : end])))
		b.WriteString(")}")

		name = name[end+1:]
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
