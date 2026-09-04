// Package golang implements a codegen Plugin that renders an idiomatic Go
// client from an OpenAPI document. Like the typescript and python plugins it is
// a thin plugin: naming/type mapping live here, everything else lives in the
// templates. The generated client integrates with the hand-written HTTP
// middleware in packages/nhost-go/transport.
package golang

import (
	"bytes"
	"embed"
	"errors"
	"fmt"
	"go/ast"
	goformat "go/format"
	"go/parser"
	"go/token"
	"io/fs"
	"path"
	"slices"
	"strconv"
	"strings"
	"unicode"

	"github.com/nhost/nhost/tools/codegen/format"
	"github.com/nhost/nhost/tools/codegen/processor"
)

const (
	extCustomType     = "x-nhost-go-type"
	goBooleanType     = "bool"
	goIntegerType     = "int"
	goNumberType      = "float64"
	goRawMessageType  = "json.RawMessage"
	goStringType      = "string"
	schemaTypeBoolean = "boolean"
	schemaTypeInteger = "integer"
	schemaTypeNumber  = "number"
	schemaTypeString  = "string"
)

var (
	errInvalidPackageName            = errors.New("invalid Go package name")
	errUnsupportedJSONWireName       = errors.New("unsupported JSON wire name")
	errUnsupportedQuerySerialization = errors.New("unsupported query serialization")
)

//go:embed templates/*.tmpl
var templatesFS embed.FS

// Golang is the code generation plugin for the Go SDK.
type Golang struct {
	packageName string
}

// New constructs a Go SDK generator for the supplied package name.
func New(packageName string) (*Golang, error) {
	if packageName == "_" || !token.IsIdentifier(packageName) || token.IsKeyword(packageName) {
		return nil, fmt.Errorf("%w %q", errInvalidPackageName, packageName)
	}

	return &Golang{packageName: packageName}, nil
}

func (p *Golang) GetTemplates() fs.FS {
	return templatesFS
}

// ProcessSource formats generated Go and removes imports unused by the
// rendered API surface.
func (p *Golang) ProcessSource(source []byte) ([]byte, error) {
	fileSet := token.NewFileSet()

	file, err := parser.ParseFile(fileSet, "generated.go", source, parser.ParseComments)
	if err != nil {
		return nil, fmt.Errorf("parsing generated Go source: %w", err)
	}

	removeUnusedImports(fileSet, file)

	var printed bytes.Buffer
	if err := goformat.Node(&printed, fileSet, file); err != nil {
		return nil, fmt.Errorf("printing generated Go source: %w", err)
	}

	formatted, err := goformat.Source(printed.Bytes())
	if err != nil {
		return nil, fmt.Errorf("formatting generated Go source: %w", err)
	}

	return formatted, nil
}

// removeUnusedImports removes imports whose package identifier is unresolved
// everywhere in the parsed file. It intentionally uses ast.File.Unresolved,
// which is deprecated but distinguishes package qualifiers from local names
// without type-checking the generated source. Generated imports must use their
// conventional package name (the final path component) unless explicitly
// aliased; imports whose package name differs from their path base need an alias.
func removeUnusedImports(fileSet *token.FileSet, file *ast.File) {
	used := make(map[string]struct{}, len(file.Unresolved))
	for _, ident := range file.Unresolved {
		used[ident.Name] = struct{}{}
	}

	imports := file.Imports[:0]
	declarations := file.Decls[:0]

	for _, declaration := range file.Decls {
		genDecl, ok := declaration.(*ast.GenDecl)
		if !ok || genDecl.Tok != token.IMPORT {
			declarations = append(declarations, declaration)

			continue
		}

		groups, importGroups := collectImportGroups(fileSet, genDecl)
		groupOffsets := make([]int, len(groups))
		specs := genDecl.Specs[:0]

		for _, declarationSpec := range genDecl.Specs {
			importSpec, ok := declarationSpec.(*ast.ImportSpec)
			if !ok {
				specs = append(specs, declarationSpec)

				continue
			}

			if importUsed(importSpec, used) {
				group := importGroups[importSpec]
				position := groups[group][groupOffsets[group]]
				groupOffsets[group]++

				setImportPosition(importSpec, position)

				specs = append(specs, importSpec)
				imports = append(imports, importSpec)
			}
		}

		if len(specs) > 0 {
			genDecl.Lparen = token.NoPos
			genDecl.Rparen = token.NoPos
			genDecl.Specs = specs
			declarations = append(declarations, genDecl)
		}
	}

	file.Decls = declarations
	file.Imports = imports
}

type importGroupPositions []token.Pos

func collectImportGroups(
	fileSet *token.FileSet, declaration *ast.GenDecl,
) ([]importGroupPositions, map[*ast.ImportSpec]int) {
	groups := make([]importGroupPositions, 0, 2) //nolint:mnd
	importGroups := make(map[*ast.ImportSpec]int, len(declaration.Specs))
	previousLine := 0

	for _, declarationSpec := range declaration.Specs {
		importSpec, ok := declarationSpec.(*ast.ImportSpec)
		if !ok {
			continue
		}

		line := fileSet.Position(importSpec.Pos()).Line
		if len(groups) == 0 || line > previousLine+1 {
			groups = append(groups, nil)
		}

		group := len(groups) - 1
		groups[group] = append(groups[group], importSpec.Path.ValuePos)
		importGroups[importSpec] = group
		previousLine = fileSet.Position(importSpec.End()).Line
	}

	return groups, importGroups
}

func setImportPosition(importSpec *ast.ImportSpec, position token.Pos) {
	importSpec.EndPos = token.NoPos

	if importSpec.Name == nil {
		importSpec.Path.ValuePos = position

		return
	}

	importSpec.Name.NamePos = position
	importSpec.Path.ValuePos = position + token.Pos(len(importSpec.Name.Name)+1)
}

func importUsed(importSpec *ast.ImportSpec, used map[string]struct{}) bool {
	if importSpec.Name != nil {
		if importSpec.Name.Name == "_" || importSpec.Name.Name == "." {
			return true
		}

		_, ok := used[importSpec.Name.Name]

		return ok
	}

	importPath, err := strconv.Unquote(importSpec.Path.Value)
	if err != nil {
		return true
	}

	_, ok := used[path.Base(importPath)]

	return ok
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

	if strings.ContainsAny(tag, "`\"\\") {
		structTag := "json:" + strconv.Quote(tag)

		return fmt.Sprintf(
			"%s %s %s", name, goFieldType(typeName, pointer), strconv.Quote(structTag),
		)
	}

	return fmt.Sprintf("%s %s `json:%q`", name, goFieldType(typeName, pointer), tag)
}

func validateJSONWireNames(types []processor.Type, methods []*processor.Method) (string, error) {
	for _, typeDefinition := range types {
		object, ok := typeDefinition.(*processor.TypeObject)
		if !ok {
			continue
		}

		for _, property := range object.Properties() {
			if !validJSONTagName(property.RawName()) {
				return "", fmt.Errorf(
					"%w: property %q on type %q cannot be represented in an encoding/json struct tag",
					errUnsupportedJSONWireName,
					property.RawName(),
					object.RawName(),
				)
			}
		}
	}

	for _, method := range methods {
		for _, parameter := range method.QueryParameters() {
			if !validJSONTagName(parameter.RawName()) {
				return "", fmt.Errorf(
					"%w: query parameter %q on method %q cannot be represented in an encoding/json struct tag",
					errUnsupportedJSONWireName,
					parameter.RawName(),
					method.RawName(),
				)
			}
		}

		if !method.IsRedirect() {
			for _, parameter := range method.HeaderParameters() {
				if !validJSONTagName(parameter.RawName()) {
					return "", fmt.Errorf(
						"%w: header parameter %q on method %q cannot be represented in an encoding/json struct tag",
						errUnsupportedJSONWireName,
						parameter.RawName(),
						method.RawName(),
					)
				}
			}
		}
	}

	return "", nil
}

func validJSONTagName(name string) bool {
	if name == "" || name == "-" || strings.ContainsRune(name, ',') {
		return false
	}

	for _, character := range name {
		if strings.ContainsRune("!#$%&()*+-./:;<=>?@[]^_{|}~ ", character) {
			continue
		}

		if !unicode.IsLetter(character) && !unicode.IsDigit(character) {
			return false
		}
	}

	return true
}

func validateQueryParameters(methods []*processor.Method) (string, error) {
	for _, method := range methods {
		for _, parameter := range method.QueryParameters() {
			if parameter.JSONContent() {
				continue
			}

			switch parameter.Style() {
			case "form":
				continue
			case "deepObject":
				if !parameter.Explode() {
					return "", fmt.Errorf(
						"%w: query parameter %q on method %q uses deepObject with explode=false",
						errUnsupportedQuerySerialization, parameter.RawName(), method.RawName(),
					)
				}

				kind := parameter.Type.Kind()
				if kind != processor.KindIdentifierMap && kind != processor.KindIdentifierObject {
					return "", fmt.Errorf(
						"%w: query parameter %q on method %q uses deepObject with unsupported %s type",
						errUnsupportedQuerySerialization,
						parameter.RawName(),
						method.RawName(),
						kind,
					)
				}
			default:
				return "", fmt.Errorf(
					"%w: query parameter %q on method %q uses unsupported style %q",
					errUnsupportedQuerySerialization,
					parameter.RawName(), method.RawName(), parameter.Style(),
				)
			}
		}
	}

	return "", nil
}

type rawNamer interface {
	RawName() string
}

func goRawTypeName(typ processor.Type) string {
	if named, ok := typ.(rawNamer); ok {
		return named.RawName()
	}

	return typ.Name()
}

func registerGoIdentifier(
	seen map[string]string, identifier, source, domain string,
) error {
	if previous, exists := seen[identifier]; exists {
		return fmt.Errorf(
			"%w: Go %s collision: %s and %s both generate identifier %q",
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

func validateGoFieldNames(object *processor.TypeObject) error {
	seen := make(map[string]string, len(object.Properties()))
	for _, property := range object.Properties() {
		if err := registerGoIdentifier(
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

func validateGoParameterFields(method *processor.Method) error {
	seen := make(
		map[string]string,
		len(method.QueryParameters())+len(method.HeaderParameters()),
	)
	for _, parameter := range method.QueryParameters() {
		if err := registerGoIdentifier(
			seen,
			parameter.Name(),
			fmt.Sprintf("query parameter %q", parameter.RawName()),
			fmt.Sprintf("parameter struct for operation %q", method.RawName()),
		); err != nil {
			return err
		}
	}

	if !method.IsRedirect() {
		for _, parameter := range method.HeaderParameters() {
			if err := registerGoIdentifier(
				seen,
				parameter.Name(),
				fmt.Sprintf("header parameter %q", parameter.RawName()),
				fmt.Sprintf("parameter struct for operation %q", method.RawName()),
			); err != nil {
				return err
			}
		}
	}

	return nil
}

func goMethodBindingNames() map[string]string {
	return map[string]string{
		"c":           "generated Client receiver",
		"ctx":         "generated context argument",
		"body":        "generated request body argument",
		"params":      "generated request parameters argument",
		"headers":     "generated request headers argument",
		"payload":     "generated response payload local",
		"u":           "generated request URL local",
		"rawBody":     "generated encoded request body local",
		"req":         "generated HTTP request local",
		"resp":        "generated HTTP response local",
		"err":         "generated error local",
		"mErr":        "generated marshal error local",
		"form":        "generated form values local",
		"contentType": "generated content type local",
		"formBuf":     "generated multipart buffer local",
		"mw":          "generated multipart writer local",
		"i":           "generated multipart index local",
		"item":        "generated multipart item local",
		"fw":          "generated multipart file writer local",
		"jb":          "generated JSON body local",
		"ph":          "generated multipart header local",
		"pw":          "generated multipart part writer local",
		"k":           "generated header key local",
		"v":           "generated header value local",
		"vs":          "generated header values local",
		"q":           "generated query values local",
		"bytes":       `generated import "bytes"`,
		"context":     `generated import "context"`,
		"json":        `generated import "encoding/json"`,
		"fmt":         `generated import "fmt"`,
		"io":          `generated import "io"`,
		"multipart":   `generated import "mime/multipart"`,
		"http":        `generated import "net/http"`,
		"textproto":   `generated import "net/textproto"`,
		"url":         `generated import "net/url"`,
		"sort":        `generated import "sort"`,
		"strings":     `generated import "strings"`,
		"transport":   `generated import "github.com/nhost/nhost/packages/nhost-go/transport"`,
	}
}

func validateGoMethodBindings(method *processor.Method) error {
	seen := goMethodBindingNames()
	for _, parameter := range method.PathParameters() {
		if err := registerGoIdentifier(
			seen,
			unexported(parameter.Name()),
			fmt.Sprintf("path parameter %q", parameter.RawName()),
			fmt.Sprintf("argument list for operation %q", method.RawName()),
		); err != nil {
			return err
		}
	}

	return nil
}

func validateGoNames(types []processor.Type, methods []*processor.Method) (string, error) {
	typeNames := map[string]string{
		"Client":    `generated type "Client"`,
		"NewClient": `generated function "NewClient"`,
	}
	for _, typ := range types {
		if err := registerGoIdentifier(
			typeNames,
			typ.Name(),
			fmt.Sprintf("type %q", goRawTypeName(typ)),
			"type namespace",
		); err != nil {
			return "", err
		}

		if object, ok := typ.(*processor.TypeObject); ok {
			if err := validateGoFieldNames(object); err != nil {
				return "", err
			}
		}
	}

	methodNames := map[string]string{
		"BaseURL": `generated Client field "BaseURL"`,
	}
	for _, method := range methods {
		methodName := method.Name()
		if method.IsRedirect() {
			methodName += "URL"
		}

		if err := registerGoIdentifier(
			methodNames,
			methodName,
			fmt.Sprintf("operation %q", method.RawName()),
			"client method namespace",
		); err != nil {
			return "", err
		}

		if method.HasQueryParameters() || (!method.IsRedirect() && method.HasHeaderParameters()) {
			if err := registerGoIdentifier(
				typeNames,
				method.Name()+"Params",
				fmt.Sprintf("parameter struct for operation %q", method.RawName()),
				"type namespace",
			); err != nil {
				return "", err
			}

			if err := validateGoParameterFields(method); err != nil {
				return "", err
			}
		}

		if err := validateGoMethodBindings(method); err != nil {
			return "", err
		}
	}

	return "", nil
}

// enumValueKind returns the OpenAPI primitive kind of a decoded enum value,
// or an empty string for nil and unsupported values.
func enumValueKind(value any) string {
	switch value.(type) {
	case bool:
		return schemaTypeBoolean
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return schemaTypeInteger
	case float32, float64:
		return schemaTypeNumber
	case string:
		return schemaTypeString
	default:
		return ""
	}
}

func enumValuesMatchDeclaredKind(enum *processor.TypeEnum, declaredKind string) bool {
	valueKind := ""

	for _, node := range enum.Schema().Schema().Enum {
		var value any
		if err := node.Decode(&value); err != nil {
			return false
		}

		kind := enumValueKind(value)
		if kind == "" || (valueKind != "" && kind != valueKind) {
			return false
		}

		valueKind = kind
	}

	return valueKind == declaredKind ||
		(declaredKind == schemaTypeNumber && valueKind == schemaTypeInteger)
}

func goTypeForSchemaKind(kind string) string {
	switch kind {
	case schemaTypeBoolean:
		return goBooleanType
	case schemaTypeInteger:
		return goIntegerType
	case schemaTypeNumber:
		return goNumberType
	case schemaTypeString:
		return goStringType
	default:
		return goRawMessageType
	}
}

// goEnumType maps homogeneous enum values to the declared Go scalar type. It
// falls back to json.RawMessage when the values are heterogeneous, ambiguous,
// or inconsistent with the schema's declared type.
func goEnumType(enum *processor.TypeEnum) string {
	schema := enum.Schema()
	if schema == nil || schema.Schema() == nil || len(schema.Schema().Type) != 1 {
		return goRawMessageType
	}

	declaredKind := schema.Schema().Type[0]
	if !enumValuesMatchDeclaredKind(enum, declaredKind) {
		return goRawMessageType
	}

	return goTypeForSchemaKind(declaredKind)
}

// goEnumUsesJSON reports whether an enum uses json.RawMessage to preserve heterogeneous values.
func goEnumUsesJSON(typ processor.Type) bool {
	enum, ok := typ.(*processor.TypeEnum)
	if !ok || enum.Schema() == nil || enum.Schema().Schema() == nil ||
		len(enum.Schema().Schema().Enum) == 0 {
		return false
	}

	return goEnumType(enum) == goRawMessageType
}

func hasJSONEnums(types []processor.Type) bool {
	return slices.ContainsFunc(types, goEnumUsesJSON)
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
		"goEnumType":                goEnumType,
		"goEnumUsesJSON":            goEnumUsesJSON,
		"goFieldType":               goFieldType,
		"goValidateJSONWireNames":   validateJSONWireNames,
		"goValidateNames":           validateGoNames,
		"goValidateQueryParameters": validateQueryParameters,
		"exported":                  toExported,
		"hasJSONEnums":              hasJSONEnums,
		"hasPathParameters": func(methods []*processor.Method) bool {
			for _, method := range methods {
				if len(method.PathParameters()) > 0 {
					return true
				}
			}

			return false
		},
		"hasHeaderParameters": func(methods []*processor.Method) bool {
			for _, method := range methods {
				if !method.IsRedirect() && method.HasHeaderParameters() {
					return true
				}
			}

			return false
		},
		"packageName": func() string {
			return p.packageName
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
		return goIntegerType
	case "number":
		return goNumberType
	case "boolean":
		return goBooleanType
	case goStringType:
		if schema.Format == "binary" {
			return "[]byte"
		}

		return goStringType
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
			b.WriteString(escapeFormatString(name))

			break
		}

		closeIdx := strings.IndexByte(name[open:], '}')
		if closeIdx < 0 {
			b.WriteString(escapeFormatString(name))

			break
		}

		closeIdx += open
		b.WriteString(escapeFormatString(name[:open]))
		b.WriteString("%s")

		name = name[closeIdx+1:]
	}

	return b.String()
}

func escapeFormatString(value string) string {
	return strings.ReplaceAll(value, "%", "%%")
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
	if isGoReservedIdentifier(out) {
		return out + "_"
	}

	return out
}

func isGoReservedIdentifier(s string) bool {
	switch s {
	case "break", "case", "chan", "const", "continue", "default", "defer",
		"else", "fallthrough", "for", "func", "go", "goto", "if", "import",
		"interface", "map", "package", "range", "return", "select", "struct",
		"switch", "type", "var",
		"any", "bool", "byte", "comparable", "complex64", "complex128", "error",
		"float32", "float64", "int", "int8", "int16", "int32", "int64", "rune",
		goStringType, "uint", "uint8", "uint16", "uint32", "uint64", "uintptr",
		"true", "false", "iota", "nil",
		"append", "cap", "clear", "close", "complex", "copy", "delete", "imag",
		"len", "make", "max", "min", "new", "panic", "print", "println", "real",
		"recover":
		return true
	default:
		return false
	}
}
