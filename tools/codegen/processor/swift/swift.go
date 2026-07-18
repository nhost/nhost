// Package swift renders Swift source from the shared OpenAPI intermediate representation.
package swift

import (
	"embed"
	"fmt"
	"io/fs"
	"math"
	"reflect"
	"slices"
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
		"swiftClientName":            s.swiftClientName,
		"swiftCodingKey":             swiftCodingKey,
		"swiftDecodeProperty":        swiftDecodeProperty,
		"swiftDoc":                   swiftDoc,
		"swiftEncodeProperty":        swiftEncodeProperty,
		"swiftEnumCases":             swiftEnumCases,
		"swiftEnumRawType":           swiftEnumRawType,
		"swiftIsLastProperty":        swiftIsLastProperty,
		"swiftMethod":                s.swiftMethod,
		"swiftMethodParameterTypes":  s.swiftMethodParameterTypes,
		"swiftNamespace":             s.swiftNamespace,
		"swiftNeedsCodingKeys":       swiftNeedsCodingKeys,
		"swiftNeedsCustomDecoder":    swiftNeedsCustomDecoder,
		"swiftNeedsCustomEncoder":    swiftNeedsCustomEncoder,
		"swiftValidatePropertyNames": swiftValidatePropertyNames,
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
		// Plugin.TypeEnumValues cannot return an error for legacy templates. The Swift
		// templates use the error-propagating FuncMap helpers instead, so this is only
		// reachable from a future template calling Type.Values() directly; fail fast
		// instead of silently rendering an empty enum.
		panic(fmt.Errorf("swift enum values: %w", err))
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

	return swiftNeedsCustomDecoder(obj) || swiftNeedsCustomEncoder(obj)
}

func swiftValidatePropertyNames(obj *processor.TypeObject) (string, error) {
	seen := make(map[string]string, len(obj.Properties()))

	for _, property := range obj.Properties() {
		name := property.Name()
		if previousRawName, ok := seen[name]; ok {
			return "", fmt.Errorf(
				"%w: Swift object %s properties %q and %q normalize to identifier %q",
				processor.ErrUnsupportedFeature,
				obj.Name(),
				previousRawName,
				property.RawName(),
				name,
			)
		}

		seen[name] = property.RawName()
	}

	return "", nil
}

func swiftNeedsCustomDecoder(obj *processor.TypeObject) bool {
	return slices.ContainsFunc(obj.Properties(), swiftDecodesMissingOrNullAsEmpty)
}

func swiftNeedsCustomEncoder(obj *processor.TypeObject) bool {
	return slices.ContainsFunc(obj.Properties(), func(property *processor.Property) bool {
		return property.Required() && property.Nullable()
	})
}

func swiftDecodesMissingOrNullAsEmpty(property *processor.Property) bool {
	return property.Required() && !property.Nullable() && slices.Contains(
		[]processor.KindIdentifier{
			processor.KindIdentifierArray,
			processor.KindIdentifierMap,
		},
		property.Type.Kind(),
	)
}

func swiftDecodeProperty(property *processor.Property) string {
	name := property.Name()
	decode := fmt.Sprintf(
		"try container.decode(%s.self, forKey: .%s)",
		property.Type.Name(),
		name,
	)

	if property.Optional() {
		decode = fmt.Sprintf(
			"try container.decodeIfPresent(%s.self, forKey: .%s)",
			property.Type.Name(),
			name,
		)
	}

	if swiftDecodesMissingOrNullAsEmpty(property) {
		emptyLiteral := "[]"
		if property.Type.Kind() == processor.KindIdentifierMap {
			emptyLiteral = "[:]"
		}

		decode = fmt.Sprintf(
			"try container.decodeIfPresent(%s.self, forKey: .%s) ?? %s",
			property.Type.Name(),
			name,
			emptyLiteral,
		)
	}

	return fmt.Sprintf("%s = %s", name, decode)
}

func swiftEncodeProperty(property *processor.Property) string {
	method := "encodeIfPresent"
	if property.Required() {
		method = "encode"
	}

	return fmt.Sprintf(
		"try container.%s(%s, forKey: .%s)",
		method,
		property.Name(),
		property.Name(),
	)
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

const (
	swiftStatusSuccessMin  = 200
	swiftStatusSuccessMax  = 300
	swiftStatusRedirectMin = 300
	swiftStatusRedirectMax = 400

	swiftMediaApplicationJSON        = "application/json"
	swiftMediaApplicationOctetStream = "application/octet-stream"
	swiftMediaFormURLEncoded         = "application/x-www-form-urlencoded"
	swiftMediaMultipartFormData      = "multipart/form-data"
)

type swiftRequestBodyKind string

const (
	swiftRequestBodyKindNone      swiftRequestBodyKind = "none"
	swiftRequestBodyKindJSON      swiftRequestBodyKind = "json"
	swiftRequestBodyKindForm      swiftRequestBodyKind = "form"
	swiftRequestBodyKindMultipart swiftRequestBodyKind = "multipart"
)

type swiftRequestBody struct {
	kind      swiftRequestBodyKind
	mediaType string
	typ       processor.Type
}

type swiftSuccessKind string

const (
	swiftSuccessKindJSON   swiftSuccessKind = "json"
	swiftSuccessKindBinary swiftSuccessKind = "binary"
	swiftSuccessKindEmpty  swiftSuccessKind = "empty"
)

type swiftSuccessResponse struct {
	kind     swiftSuccessKind
	bodyType string
}

func (s *Swift) swiftMethodParameterTypes(method *processor.Method) (string, error) {
	sections := make([]string, 0, 2) //nolint:mnd

	if params := swiftSortedParametersByLocation(method.Parameters, "query"); len(params) > 0 {
		sections = append(sections, s.swiftParameterGroup(method, "Query", params))
	}

	if params := swiftSortedParametersByLocation(method.Parameters, "header"); len(params) > 0 {
		sections = append(sections, s.swiftParameterGroup(method, "Headers", params))
	}

	return strings.Join(sections, "\n\n"), nil
}

func (s *Swift) swiftParameterGroup(
	method *processor.Method,
	suffix string,
	params []*processor.Parameter,
) string {
	var builder strings.Builder

	builder.WriteString("public struct ")
	builder.WriteString(s.swiftParameterGroupName(method, suffix))
	builder.WriteString(": Sendable {\n")

	for _, param := range params {
		builder.WriteString("    public let ")
		builder.WriteString(param.Name())
		builder.WriteString(": ")
		builder.WriteString(param.Type.Name())

		if !param.Required() {
			builder.WriteByte('?')
		}

		builder.WriteByte('\n')
	}

	builder.WriteString("\n    public init(\n")

	for index, param := range params {
		builder.WriteString("        ")
		builder.WriteString(param.Name())
		builder.WriteString(": ")
		builder.WriteString(param.Type.Name())

		if !param.Required() {
			builder.WriteString("? = nil")
		}

		if index != len(params)-1 {
			builder.WriteByte(',')
		}

		builder.WriteByte('\n')
	}

	builder.WriteString("    ) {\n")

	for _, param := range params {
		builder.WriteString("        self.")
		builder.WriteString(param.Name())
		builder.WriteString(" = ")
		builder.WriteString(param.Name())
		builder.WriteByte('\n')
	}

	builder.WriteString("    }\n")
	builder.WriteString("}")

	return builder.String()
}

func (s *Swift) swiftMethod(method *processor.Method) (string, error) {
	if swiftIsRedirectMethod(method) {
		return s.swiftRedirectMethod(method)
	}

	success, err := swiftSelectSuccessResponse(method)
	if err != nil {
		return "", err
	}

	body, err := swiftRequestBodyForMethod(method)
	if err != nil {
		return "", err
	}

	params := s.swiftMethodParameters(method, body, false)

	var builder strings.Builder
	builder.WriteString("    public func ")
	builder.WriteString(method.Name())
	builder.WriteString("(")

	if len(params) == 0 {
		builder.WriteString(") async throws -> ")
		builder.WriteString(success.responseType())
		builder.WriteString(" {\n")
	} else {
		builder.WriteByte('\n')

		for index, param := range params {
			builder.WriteString("        ")
			builder.WriteString(param)

			if index != len(params)-1 {
				builder.WriteByte(',')
			}

			builder.WriteByte('\n')
		}

		builder.WriteString("    ) async throws -> ")
		builder.WriteString(success.responseType())
		builder.WriteString(" {\n")
	}

	if err := s.writeSwiftRequestSetup(&builder, method, body, success); err != nil {
		return "", err
	}

	builder.WriteString("        let request = NhostRequest(\n")
	builder.WriteString("            method: ")
	builder.WriteString(swiftStringLiteral(method.Method()))
	builder.WriteString(",\n")
	builder.WriteString("            url: url,\n")
	builder.WriteString("            headers: requestHeaders,\n")
	builder.WriteString("            body: requestBody\n")
	builder.WriteString("        )\n")
	builder.WriteString("        let response = try await fetch(request)\n\n")
	builder.WriteString("        ")
	builder.WriteString(success.returnStatement())
	builder.WriteString("\n")
	builder.WriteString("    }")

	return builder.String(), nil
}

func (s *Swift) swiftRedirectMethod(method *processor.Method) (string, error) {
	body, err := swiftRequestBodyForMethod(method)
	if err != nil {
		return "", err
	}

	if len(swiftSortedParametersByLocation(method.Parameters, "header")) > 0 {
		return "", fmt.Errorf(
			"%w: Swift redirect helper %s cannot use header parameters because it only returns a URL",
			processor.ErrUnsupportedFeature,
			method.Name(),
		)
	}

	redirectBody, err := swiftRedirectBodyObject(method, body)
	if err != nil {
		return "", err
	}

	params := s.swiftMethodParameters(method, body, true)

	var builder strings.Builder
	builder.WriteString("    public func ")
	builder.WriteString(swiftMethodNameWithSuffix(method.Name(), "URL"))
	builder.WriteString("(")

	if len(params) == 0 {
		builder.WriteString(") throws -> URL {\n")
	} else {
		builder.WriteByte('\n')

		for index, param := range params {
			builder.WriteString("        ")
			builder.WriteString(param)

			if index != len(params)-1 {
				builder.WriteByte(',')
			}

			builder.WriteByte('\n')
		}

		builder.WriteString("    ) throws -> URL {\n")
	}

	s.writeSwiftPathSetup(&builder, method)
	s.writeSwiftQuerySetup(&builder, method)
	s.writeSwiftRedirectBodyQuerySetup(&builder, method, redirectBody)

	if swiftRedirectNeedsQueryItems(method, body) {
		builder.WriteString(
			"        return NhostURLBuilder.redirectURL(baseURL: baseURL, path: path, query: queryItems)\n",
		)
	} else {
		builder.WriteString(
			"        return NhostURLBuilder.redirectURL(baseURL: baseURL, path: path)\n",
		)
	}

	builder.WriteString("    }")

	return builder.String(), nil
}

func (s *Swift) swiftMethodParameters(
	method *processor.Method,
	body *swiftRequestBody,
	redirect bool,
) []string {
	params := make([]string, 0, len(method.Parameters)+3) //nolint:mnd

	for _, param := range method.PathParameters() {
		params = append(params, param.Name()+": "+param.Type.Name())
	}

	if body.kind != swiftRequestBodyKindNone &&
		(!redirect || body.kind == swiftRequestBodyKindForm) {
		bodyType := body.typ.Name()
		if method.BodyRequired {
			params = append(params, "body: "+bodyType)
		} else {
			params = append(params, "body: "+bodyType+"? = nil")
		}
	}

	if queryParams := swiftSortedParametersByLocation(
		method.Parameters,
		"query",
	); len(
		queryParams,
	) > 0 {
		groupName := s.swiftParameterGroupName(method, "Query")
		if swiftHasRequiredParameters(queryParams) {
			params = append(params, "query: "+groupName)
		} else {
			params = append(params, "query: "+groupName+"? = nil")
		}
	}

	if !redirect {
		if headerParams := swiftSortedParametersByLocation(
			method.Parameters,
			"header",
		); len(
			headerParams,
		) > 0 {
			groupName := s.swiftParameterGroupName(method, "Headers")
			if swiftHasRequiredParameters(headerParams) {
				params = append(params, "headers: "+groupName)
			} else {
				params = append(params, "headers: "+groupName+"? = nil")
			}
		}

		// Mirrors the per-request options every nhost-js client method accepts:
		// callers can add or override headers on a single call (per-call roles,
		// idempotency keys, a pre-set Authorization, ...).
		params = append(params, "extraHeaders: [String: String] = [:]")
	}

	return params
}

func (s *Swift) writeSwiftRequestSetup(
	builder *strings.Builder,
	method *processor.Method,
	body *swiftRequestBody,
	success *swiftSuccessResponse,
) error {
	s.writeSwiftPathSetup(builder, method)
	s.writeSwiftQuerySetup(builder, method)

	if len(swiftSortedParametersByLocation(method.Parameters, "query")) > 0 {
		builder.WriteString(
			"        let url = NhostURLBuilder.url(baseURL: baseURL, path: path, query: queryItems)\n",
		)
	} else {
		builder.WriteString("        let url = NhostURLBuilder.url(baseURL: baseURL, path: path)\n")
	}

	builder.WriteString("        var requestHeaders = [\n")
	builder.WriteString("            \"accept\": ")
	builder.WriteString(swiftStringLiteral(success.acceptHeader()))
	builder.WriteString(",\n")
	builder.WriteString("        ]\n")

	if err := s.writeSwiftBodySetup(builder, method, body); err != nil {
		return err
	}

	s.writeSwiftHeaderSetup(builder, method)

	builder.WriteString(
		"        requestHeaders = NhostHeaderEncoder.merge(base: requestHeaders, overrides: extraHeaders)\n",
	)

	return nil
}

func (s *Swift) writeSwiftPathSetup(builder *strings.Builder, method *processor.Method) {
	for _, param := range method.PathParameters() {
		localName := swiftLocalName(param.Name(), "path")

		builder.WriteString("        let ")
		builder.WriteString(localName)
		builder.WriteString(
			" = try NhostURLBuilder.percentEncodePathSegment(NhostWireEncoder.string(",
		)
		builder.WriteString(param.Name())
		builder.WriteString("))\n")
	}

	builder.WriteString("        let path = ")
	builder.WriteString(swiftPathStringLiteral(method.Path(), method.PathParameters()))
	builder.WriteString("\n")
}

func (s *Swift) writeSwiftQuerySetup(builder *strings.Builder, method *processor.Method) {
	params := swiftSortedParametersByLocation(method.Parameters, "query")
	if len(params) == 0 {
		return
	}

	builder.WriteString("        var queryItems: [String: JSONValue?] = [:]\n")

	if swiftHasRequiredParameters(params) {
		for _, param := range params {
			s.writeSwiftQueryParameter(builder, param, "query."+param.Name(), "        ")
		}

		return
	}

	builder.WriteString("        if let query {\n")

	for _, param := range params {
		s.writeSwiftQueryParameter(builder, param, "query."+param.Name(), "            ")
	}

	builder.WriteString("        }\n")
}

func (s *Swift) writeSwiftRedirectBodyQuerySetup(
	builder *strings.Builder,
	method *processor.Method,
	body *processor.TypeObject,
) {
	if body == nil {
		return
	}

	if len(swiftSortedParametersByLocation(method.Parameters, "query")) == 0 {
		builder.WriteString("        var queryItems: [String: JSONValue?] = [:]\n")
	}

	if method.BodyRequired {
		s.writeSwiftExplodedObjectQueryProperties(builder, body, "body", "        ")

		return
	}

	builder.WriteString("        if let body {\n")
	s.writeSwiftExplodedObjectQueryProperties(builder, body, "body", "            ")
	builder.WriteString("        }\n")
}

func (s *Swift) writeSwiftQueryParameter(
	builder *strings.Builder,
	param *processor.Parameter,
	access string,
	indent string,
) {
	isJSONContent := param.ContentMediaType() == swiftMediaApplicationJSON
	if obj, ok := swiftObjectType(param.Type); ok && param.Explode() && !isJSONContent {
		if param.Required() {
			builder.WriteString(indent)
			builder.WriteString("do {\n")
			builder.WriteString(indent)
			builder.WriteString("    let value = ")
			builder.WriteString(access)
			builder.WriteByte('\n')
			s.writeSwiftExplodedObjectQueryProperties(builder, obj, "value", indent+"    ")
			builder.WriteString(indent)
			builder.WriteString("}\n")

			return
		}

		builder.WriteString(indent)
		builder.WriteString("if let value = ")
		builder.WriteString(access)
		builder.WriteString(" {\n")
		s.writeSwiftExplodedObjectQueryProperties(builder, obj, "value", indent+"    ")
		builder.WriteString(indent)
		builder.WriteString("}\n")

		return
	}

	fieldName := swiftStringLiteral(param.RawName())
	valueExpression, optionalValueExpression := swiftQueryValueExpressions(param, access)

	if param.Required() {
		builder.WriteString(indent)
		builder.WriteString("queryItems[")
		builder.WriteString(fieldName)
		builder.WriteString("] = ")
		builder.WriteString(valueExpression)
		builder.WriteByte('\n')

		return
	}

	builder.WriteString(indent)
	builder.WriteString("queryItems[")
	builder.WriteString(fieldName)
	builder.WriteString("] = ")
	builder.WriteString(optionalValueExpression)
	builder.WriteByte('\n')
}

func (s *Swift) writeSwiftExplodedObjectQueryProperties(
	builder *strings.Builder,
	obj *processor.TypeObject,
	valueName string,
	indent string,
) {
	for _, property := range swiftSortedProperties(obj) {
		fieldName := swiftStringLiteral(property.RawName())
		access := valueName + "." + property.Name()

		builder.WriteString(indent)
		builder.WriteString("queryItems[")
		builder.WriteString(fieldName)
		builder.WriteString("] = ")

		if property.Optional() {
			builder.WriteString(swiftOptionalJSONValueExpression(access, property.Type, true))
		} else {
			builder.WriteString(swiftJSONValueExpression(access, property.Type, true))
		}

		builder.WriteByte('\n')
	}
}

func (s *Swift) writeSwiftHeaderSetup(builder *strings.Builder, method *processor.Method) {
	params := swiftSortedParametersByLocation(method.Parameters, "header")
	if len(params) == 0 {
		return
	}

	builder.WriteString("        var headerValues: [String: JSONValue?] = [:]\n")

	if swiftHasRequiredParameters(params) {
		for _, param := range params {
			s.writeSwiftHeaderParameter(builder, param, "headers."+param.Name(), "        ")
		}
	} else {
		builder.WriteString("        if let headers {\n")

		for _, param := range params {
			s.writeSwiftHeaderParameter(builder, param, "headers."+param.Name(), "            ")
		}

		builder.WriteString("        }\n")
	}

	builder.WriteString(
		"        requestHeaders = NhostHeaderEncoder.merge(base: requestHeaders, values: headerValues)\n",
	)
}

func (s *Swift) writeSwiftHeaderParameter(
	builder *strings.Builder,
	param *processor.Parameter,
	access string,
	indent string,
) {
	fieldName := swiftStringLiteral(param.RawName())

	builder.WriteString(indent)
	builder.WriteString("headerValues[")
	builder.WriteString(fieldName)
	builder.WriteString("] = ")

	if param.Required() {
		builder.WriteString(swiftJSONValueExpression(access, param.Type, true))
	} else {
		builder.WriteString(swiftOptionalJSONValueExpression(access, param.Type, true))
	}

	builder.WriteByte('\n')
}

func (s *Swift) writeSwiftBodySetup(
	builder *strings.Builder,
	method *processor.Method,
	body *swiftRequestBody,
) error {
	switch body.kind {
	case swiftRequestBodyKindNone:
		builder.WriteString("        let requestBody: Data? = nil\n")
	case swiftRequestBodyKindJSON:
		s.writeSwiftJSONBodySetup(builder, method)
	case swiftRequestBodyKindForm:
		return s.writeSwiftFormBodySetup(builder, method, body.typ)
	case swiftRequestBodyKindMultipart:
		return s.writeSwiftMultipartBodySetup(builder, method, body.typ)
	default:
		return fmt.Errorf(
			"%w: Swift generator does not support request body kind %s for %s",
			processor.ErrUnsupportedFeature,
			body.kind,
			method.Name(),
		)
	}

	return nil
}

func (s *Swift) writeSwiftJSONBodySetup(builder *strings.Builder, method *processor.Method) {
	if method.BodyRequired {
		builder.WriteString("        requestHeaders[\"content-type\"] = \"application/json\"\n")
		builder.WriteString("        let requestBody = try NhostJSON.restEncoder.encode(body)\n")

		return
	}

	builder.WriteString(
		"        let requestBody = try body.map { try NhostJSON.restEncoder.encode($0) }\n",
	)
	builder.WriteString("        if requestBody != nil {\n")
	builder.WriteString("            requestHeaders[\"content-type\"] = \"application/json\"\n")
	builder.WriteString("        }\n")
}

func (s *Swift) writeSwiftFormBodySetup(
	builder *strings.Builder,
	method *processor.Method,
	typ processor.Type,
) error {
	obj, err := swiftFormBodyObject(
		method,
		typ,
		"Swift application/x-www-form-urlencoded body",
	)
	if err != nil {
		return err
	}

	if method.BodyRequired {
		builder.WriteString(
			"        requestHeaders[\"content-type\"] = NhostURLEncodedFormEncoder.contentType\n",
		)
		builder.WriteString("        let formFields: [String: JSONValue?] = [\n")
		s.writeSwiftFormFields(builder, obj, "body", "            ")
		builder.WriteString("        ]\n")
		builder.WriteString(
			"        let requestBody = NhostURLEncodedFormEncoder.encode(formFields)\n",
		)

		return nil
	}

	builder.WriteString("        var requestBody: Data?\n")
	builder.WriteString("        if let body {\n")
	builder.WriteString(
		"            requestHeaders[\"content-type\"] = NhostURLEncodedFormEncoder.contentType\n",
	)
	builder.WriteString("            let formFields: [String: JSONValue?] = [\n")
	s.writeSwiftFormFields(builder, obj, "body", "                ")
	builder.WriteString("            ]\n")
	builder.WriteString("            requestBody = NhostURLEncodedFormEncoder.encode(formFields)\n")
	builder.WriteString("        }\n")

	return nil
}

func (s *Swift) writeSwiftFormFields(
	builder *strings.Builder,
	obj *processor.TypeObject,
	access string,
	indent string,
) {
	properties := swiftSortedProperties(obj)
	for index, property := range properties {
		builder.WriteString(indent)
		builder.WriteString(swiftStringLiteral(property.RawName()))
		builder.WriteString(": ")

		fieldAccess := access + "." + property.Name()
		if property.Optional() {
			builder.WriteString(swiftOptionalJSONValueExpression(fieldAccess, property.Type, true))
		} else {
			builder.WriteString(swiftJSONValueExpression(fieldAccess, property.Type, true))
		}

		if index != len(properties)-1 {
			builder.WriteByte(',')
		}

		builder.WriteByte('\n')
	}
}

func (s *Swift) writeSwiftMultipartBodySetup(
	builder *strings.Builder,
	method *processor.Method,
	typ processor.Type,
) error {
	obj, ok := swiftObjectType(typ)
	if !ok {
		return fmt.Errorf(
			"%w: Swift multipart/form-data body for %s must be an object schema",
			processor.ErrUnsupportedFeature,
			method.Name(),
		)
	}

	if method.BodyRequired {
		builder.WriteString("        var parts: [NhostMultipartPart] = []\n")

		if err := s.writeSwiftMultipartParts(builder, method, obj, "body", "        "); err != nil {
			return err
		}

		builder.WriteString(
			"        let multipartBody = try NhostMultipartEncoder.encode(parts: parts)\n",
		)
		builder.WriteString(
			"        requestHeaders[\"content-type\"] = multipartBody.contentType\n",
		)
		builder.WriteString("        let requestBody = multipartBody.body\n")

		return nil
	}

	builder.WriteString("        var requestBody: Data?\n")
	builder.WriteString("        if let body {\n")
	builder.WriteString("            var parts: [NhostMultipartPart] = []\n")

	if err := s.writeSwiftMultipartParts(builder, method, obj, "body", "            "); err != nil {
		return err
	}

	builder.WriteString(
		"            let multipartBody = try NhostMultipartEncoder.encode(parts: parts)\n",
	)
	builder.WriteString(
		"            requestHeaders[\"content-type\"] = multipartBody.contentType\n",
	)
	builder.WriteString("            requestBody = multipartBody.body\n")
	builder.WriteString("        }\n")

	return nil
}

func (s *Swift) writeSwiftMultipartParts(
	builder *strings.Builder,
	method *processor.Method,
	obj *processor.TypeObject,
	access string,
	indent string,
) error {
	for _, property := range swiftSortedProperties(obj) {
		fieldAccess := access + "." + property.Name()
		if property.Optional() {
			builder.WriteString(indent)
			builder.WriteString("if let value = ")
			builder.WriteString(fieldAccess)
			builder.WriteString(" {\n")

			if err := s.writeSwiftMultipartValue(
				builder,
				method,
				property.RawName(),
				property.Type,
				"value",
				indent+"    ",
			); err != nil {
				return err
			}

			builder.WriteString(indent)
			builder.WriteString("}\n")

			continue
		}

		if err := s.writeSwiftMultipartValue(
			builder,
			method,
			property.RawName(),
			property.Type,
			fieldAccess,
			indent,
		); err != nil {
			return err
		}
	}

	return nil
}

func (s *Swift) writeSwiftMultipartValue(
	builder *strings.Builder,
	method *processor.Method,
	wireName string,
	typ processor.Type,
	valueExpr string,
	indent string,
) error {
	typ = swiftUnderlyingType(typ)
	if array, ok := typ.(*processor.TypeArray); ok {
		itemType := swiftUnderlyingType(array.Item)
		if _, nested := itemType.(*processor.TypeArray); nested {
			return fmt.Errorf(
				"%w: Swift multipart/form-data body for %s field %s cannot contain nested arrays",
				processor.ErrUnsupportedFeature,
				method.Name(),
				wireName,
			)
		}

		builder.WriteString(indent)
		builder.WriteString("for item in ")
		builder.WriteString(valueExpr)
		builder.WriteString(" {\n")

		if err := s.writeSwiftMultipartSinglePart(
			builder,
			method,
			wireName,
			itemType,
			"item",
			indent+"    ",
		); err != nil {
			return err
		}

		builder.WriteString(indent)
		builder.WriteString("}\n")

		return nil
	}

	return s.writeSwiftMultipartSinglePart(builder, method, wireName, typ, valueExpr, indent)
}

func (s *Swift) writeSwiftMultipartSinglePart(
	builder *strings.Builder,
	method *processor.Method,
	wireName string,
	typ processor.Type,
	valueExpr string,
	indent string,
) error {
	typ = swiftUnderlyingType(typ)

	builder.WriteString(indent)
	builder.WriteString("parts.append(")

	switch typed := typ.(type) {
	case *processor.TypeScalar:
		if swiftIsBinaryType(typed) {
			builder.WriteString("NhostMultipartPart.file(name: ")
			builder.WriteString(swiftStringLiteral(wireName))
			builder.WriteString(
				", filename: \"blob\", contentType: NhostBinaryBody.contentType, data: ",
			)
			builder.WriteString(valueExpr)
			builder.WriteString(")")
		} else {
			builder.WriteString(".formField(name: ")
			builder.WriteString(swiftStringLiteral(wireName))
			builder.WriteString(", value: try NhostWireEncoder.jsonValue(")
			builder.WriteString(valueExpr)
			builder.WriteString("))")
		}
	case *processor.TypeEnum:
		builder.WriteString(".formField(name: ")
		builder.WriteString(swiftStringLiteral(wireName))
		builder.WriteString(", value: try NhostWireEncoder.jsonValue(")
		builder.WriteString(valueExpr)
		builder.WriteString("))")
	case *processor.TypeObject, *processor.TypeMap:
		builder.WriteString("NhostMultipartPart(name: ")
		builder.WriteString(swiftStringLiteral(wireName))
		builder.WriteString(
			", contentType: \"application/json\", body: try NhostJSON.restEncoder.encode(",
		)
		builder.WriteString(valueExpr)
		builder.WriteString("))")
	default:
		return fmt.Errorf(
			"%w: Swift multipart/form-data body for %s field %s has unsupported type kind %s",
			processor.ErrUnsupportedFeature,
			method.Name(),
			wireName,
			typ.Kind(),
		)
	}

	builder.WriteString(")\n")

	return nil
}

func (s *Swift) swiftParameterGroupName(method *processor.Method, suffix string) string {
	return s.typeName(method.Name() + suffix)
}

func (r *swiftSuccessResponse) responseType() string {
	return "NhostResponse<" + r.bodyType + ">"
}

func (r *swiftSuccessResponse) acceptHeader() string {
	switch r.kind {
	case swiftSuccessKindJSON:
		return swiftMediaApplicationJSON
	case swiftSuccessKindBinary:
		return swiftMediaApplicationOctetStream
	case swiftSuccessKindEmpty:
		return swiftMediaApplicationJSON
	default:
		return swiftMediaApplicationJSON
	}
}

func (r *swiftSuccessResponse) returnStatement() string {
	switch r.kind {
	case swiftSuccessKindJSON:
		return "return try NhostHTTP.decodeResponse(" + r.bodyType + ".self, from: response)"
	case swiftSuccessKindBinary:
		return "return try NhostHTTP.binaryResponse(from: response)"
	case swiftSuccessKindEmpty:
		return "return try NhostHTTP.emptyResponse(from: response)"
	default:
		return "return try NhostHTTP.emptyResponse(from: response)"
	}
}

func swiftRedirectBodyObject(
	method *processor.Method,
	body *swiftRequestBody,
) (*processor.TypeObject, error) {
	switch body.kind {
	case swiftRequestBodyKindNone:
		return nil, nil //nolint:nilnil // nil object means "no redirect body"; the writer skips it.
	case swiftRequestBodyKindForm:
		return swiftFormBodyObject(
			method,
			body.typ,
			"Swift redirect application/x-www-form-urlencoded body",
		)
	case swiftRequestBodyKindJSON, swiftRequestBodyKindMultipart:
		return nil, fmt.Errorf(
			"%w: Swift redirect helper %s only supports application/x-www-form-urlencoded "+
				"request bodies; got %s, which cannot be safely represented as URL query parameters",
			processor.ErrUnsupportedFeature,
			method.Name(),
			body.mediaType,
		)
	default:
		return nil, fmt.Errorf(
			"%w: Swift redirect helper %s does not support request body kind %s",
			processor.ErrUnsupportedFeature,
			method.Name(),
			body.kind,
		)
	}
}

func swiftRedirectNeedsQueryItems(method *processor.Method, body *swiftRequestBody) bool {
	return body.kind != swiftRequestBodyKindNone ||
		len(swiftSortedParametersByLocation(method.Parameters, "query")) > 0
}

func swiftFormBodyObject(
	method *processor.Method,
	typ processor.Type,
	context string,
) (*processor.TypeObject, error) {
	obj, ok := swiftObjectType(typ)
	if !ok {
		return nil, fmt.Errorf(
			"%w: %s for %s must be an object schema",
			processor.ErrUnsupportedFeature,
			context,
			method.Name(),
		)
	}

	for _, property := range swiftSortedProperties(obj) {
		if swiftContainsBinary(property.Type) {
			return nil, fmt.Errorf(
				"%w: %s for %s field %s cannot contain binary data",
				processor.ErrUnsupportedFeature,
				context,
				method.Name(),
				property.RawName(),
			)
		}
	}

	return obj, nil
}

func swiftRequestBodyForMethod(method *processor.Method) (*swiftRequestBody, error) {
	if len(method.Bodies) == 0 {
		return &swiftRequestBody{
			kind:      swiftRequestBodyKindNone,
			mediaType: "",
			typ:       nil,
		}, nil
	}

	mediaTypes := swiftSortedMapKeys(method.Bodies)
	if len(mediaTypes) > 1 {
		return nil, fmt.Errorf(
			"%w: Swift method %s has multiple request body media types (%s); "+
				"split the operation or add generator support for explicit content negotiation",
			processor.ErrUnsupportedFeature,
			method.Name(),
			strings.Join(mediaTypes, ", "),
		)
	}

	mediaType := mediaTypes[0]
	body := &swiftRequestBody{
		kind:      swiftRequestBodyKindNone,
		mediaType: mediaType,
		typ:       method.Bodies[mediaType],
	}

	switch mediaType {
	case swiftMediaApplicationJSON:
		body.kind = swiftRequestBodyKindJSON
	case swiftMediaFormURLEncoded:
		body.kind = swiftRequestBodyKindForm
	case swiftMediaMultipartFormData:
		body.kind = swiftRequestBodyKindMultipart
	default:
		return nil, fmt.Errorf(
			"%w: Swift method %s has unsupported request body media type %s; supported media types "+
				"are application/json, application/x-www-form-urlencoded, and multipart/form-data",
			processor.ErrUnsupportedFeature,
			method.Name(),
			mediaType,
		)
	}

	if body.typ == nil {
		return nil, fmt.Errorf(
			"%w: Swift method %s request body media type %s has no schema",
			processor.ErrUnsupportedFeature,
			method.Name(),
			mediaType,
		)
	}

	return body, nil
}

func swiftSelectSuccessResponse(method *processor.Method) (*swiftSuccessResponse, error) {
	responses := make([]*swiftSuccessResponse, 0, len(method.Responses))

	for _, code := range swiftSortedMapKeys(method.Responses) {
		status, ok := swiftStatusCode(code)
		if !ok || status < swiftStatusSuccessMin || status >= swiftStatusSuccessMax {
			continue
		}

		response, err := swiftSuccessResponseForCode(method, code, method.Responses[code])
		if err != nil {
			return nil, err
		}

		responses = append(responses, response)
	}

	if len(responses) == 0 {
		return nil, fmt.Errorf(
			"%w: Swift method %s has no deterministic 2xx success response; "+
				"add a 2xx response or model the operation as a redirect",
			processor.ErrUnsupportedFeature,
			method.Name(),
		)
	}

	selected := responses[0]
	for _, response := range responses[1:] {
		if response.kind == selected.kind && response.bodyType == selected.bodyType {
			continue
		}

		return nil, fmt.Errorf(
			"%w: Swift method %s has incompatible multiple 2xx success response shapes "+
				"(%s %s vs %s %s); use one JSON model, one binary body, or only no-body successes",
			processor.ErrUnsupportedFeature,
			method.Name(),
			selected.kind,
			selected.bodyType,
			response.kind,
			response.bodyType,
		)
	}

	return selected, nil
}

func swiftSuccessResponseForCode(
	method *processor.Method,
	code string,
	mediaTypes map[string]processor.Type,
) (*swiftSuccessResponse, error) {
	if len(mediaTypes) == 0 {
		return &swiftSuccessResponse{
			kind:     swiftSuccessKindEmpty,
			bodyType: "Void",
		}, nil
	}

	mediaKeys := swiftSortedMapKeys(mediaTypes)
	if len(mediaKeys) > 1 {
		return nil, fmt.Errorf(
			"%w: Swift method %s response %s has multiple media types (%s); "+
				"choose one success media type or split the operation",
			processor.ErrUnsupportedFeature,
			method.Name(),
			code,
			strings.Join(mediaKeys, ", "),
		)
	}

	mediaType := mediaKeys[0]
	switch mediaType {
	case swiftMediaApplicationJSON:
		typ := mediaTypes[mediaType]
		if typ == nil {
			return nil, fmt.Errorf(
				"%w: Swift method %s response %s application/json has no schema",
				processor.ErrUnsupportedFeature,
				method.Name(),
				code,
			)
		}

		return &swiftSuccessResponse{
			kind:     swiftSuccessKindJSON,
			bodyType: typ.Name(),
		}, nil
	case swiftMediaApplicationOctetStream:
		return &swiftSuccessResponse{
			kind:     swiftSuccessKindBinary,
			bodyType: "Data",
		}, nil
	default:
		return nil, fmt.Errorf(
			"%w: Swift method %s response %s has unsupported success media type %s; "+
				"supported success media types are application/json and application/octet-stream",
			processor.ErrUnsupportedFeature,
			method.Name(),
			code,
			mediaType,
		)
	}
}

func swiftIsRedirectMethod(method *processor.Method) bool {
	hasRedirect := false

	for _, code := range swiftSortedMapKeys(method.Responses) {
		status, ok := swiftStatusCode(code)
		if !ok {
			continue
		}

		if status >= swiftStatusSuccessMin && status < swiftStatusSuccessMax {
			return false
		}

		if status >= swiftStatusRedirectMin && status < swiftStatusRedirectMax {
			hasRedirect = true
		}
	}

	return hasRedirect
}

func swiftStatusCode(code string) (int, bool) {
	status, err := strconv.Atoi(code)
	if err != nil {
		return 0, false
	}

	return status, true
}

func swiftSortedParametersByLocation(
	params []*processor.Parameter,
	location string,
) []*processor.Parameter {
	filtered := make([]*processor.Parameter, 0, len(params))
	for _, param := range params {
		if param.Parameter.In == location {
			filtered = append(filtered, param)
		}
	}

	slices.SortFunc(filtered, func(a *processor.Parameter, b *processor.Parameter) int {
		return strings.Compare(a.RawName(), b.RawName())
	})

	return filtered
}

func swiftHasRequiredParameters(params []*processor.Parameter) bool {
	return slices.ContainsFunc(params, func(param *processor.Parameter) bool {
		return param.Required()
	})
}

func swiftSortedProperties(obj *processor.TypeObject) []*processor.Property {
	properties := slices.Clone(obj.Properties())
	slices.SortFunc(properties, func(a *processor.Property, b *processor.Property) int {
		return strings.Compare(a.RawName(), b.RawName())
	})

	return properties
}

func swiftSortedMapKeys[T any](values map[string]T) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}

	slices.Sort(keys)

	return keys
}

func swiftPathStringLiteral(path string, params []*processor.Parameter) string {
	literal := swiftStringLiteral(path)
	for _, param := range params {
		literal = strings.ReplaceAll(
			literal,
			"{"+param.RawName()+"}",
			"\\("+swiftLocalName(param.Name(), "path")+")",
		)
	}

	return literal
}

func swiftLocalName(name string, suffix string) string {
	return escapeSwiftKeyword(swiftIdentifierBare(strings.Trim(name, "`")+" "+suffix, false))
}

func swiftMethodNameWithSuffix(name string, suffix string) string {
	return escapeSwiftKeyword(strings.Trim(name, "`") + suffix)
}

func swiftJSONValueExpression(valueExpr string, typ processor.Type, explode bool) string {
	typ = swiftUnderlyingType(typ)

	if !explode {
		switch typ.(type) {
		case *processor.TypeArray:
			return "JSONValue.string(try NhostWireEncoder.commaSeparated(" + valueExpr + "))"
		case *processor.TypeObject, *processor.TypeMap:
			return "JSONValue.string(try NhostWireEncoder.string(" + valueExpr + "))"
		}
	}

	return "try NhostWireEncoder.jsonValue(" + valueExpr + ")"
}

func swiftOptionalJSONValueExpression(valueExpr string, typ processor.Type, explode bool) string {
	return "try " + valueExpr + ".map { " + swiftJSONValueExpression("$0", typ, explode) + " }"
}

func swiftJSONContentValueExpression(valueExpr string) string {
	return "JSONValue.string(try NhostWireEncoder.jsonString(" + valueExpr + "))"
}

func swiftQueryValueExpressions(param *processor.Parameter, access string) (string, string) {
	if param.ContentMediaType() == swiftMediaApplicationJSON {
		return swiftJSONContentValueExpression(access),
			"try " + access + ".map { " + swiftJSONContentValueExpression("$0") + " }"
	}

	return swiftJSONValueExpression(access, param.Type, param.Explode()),
		swiftOptionalJSONValueExpression(access, param.Type, param.Explode())
}

//nolint:ireturn // Keeps the concrete processor.Type while unwrapping aliases for type switches.
func swiftUnderlyingType(typ processor.Type) processor.Type {
	for {
		alias, ok := typ.(*processor.TypeAlias)
		if !ok {
			return typ
		}

		typ = alias.Alias()
	}
}

func swiftObjectType(typ processor.Type) (*processor.TypeObject, bool) {
	obj, ok := swiftUnderlyingType(typ).(*processor.TypeObject)
	return obj, ok
}

func swiftContainsBinary(typ processor.Type) bool {
	typ = swiftUnderlyingType(typ)

	switch typed := typ.(type) {
	case *processor.TypeScalar:
		return swiftIsBinaryType(typed)
	case *processor.TypeArray:
		return swiftContainsBinary(typed.Item)
	default:
		return false
	}
}

func swiftIsBinaryType(scalar *processor.TypeScalar) bool {
	schema := scalar.Schema().Schema()
	return len(schema.Type) > 0 && schema.Type[0] == "string" && schema.Format == "binary"
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
	usedNames := make(map[string]struct{}, len(values))
	nextSuffixes := make(map[string]int, len(values))

	for _, value := range values {
		bareName := swiftUniqueEnumCaseBareName(
			swiftEnumCaseBareName(value),
			usedNames,
			nextSuffixes,
		)

		rawValue, err := swiftEnumRawValue(rawType, value)
		if err != nil {
			return nil, err
		}

		cases = append(cases, "case "+escapeSwiftKeyword(bareName)+" = "+rawValue)
	}

	return cases, nil
}

func swiftUniqueEnumCaseBareName(
	bareName string,
	usedNames map[string]struct{},
	nextSuffixes map[string]int,
) string {
	const initialSuffix = 2

	if _, exists := usedNames[bareName]; !exists {
		usedNames[bareName] = struct{}{}
		return bareName
	}

	suffix := max(nextSuffixes[bareName], initialSuffix)
	for {
		candidate := bareName + strconv.Itoa(suffix)
		suffix++

		if _, exists := usedNames[candidate]; exists {
			continue
		}

		usedNames[candidate] = struct{}{}
		nextSuffixes[bareName] = suffix

		return candidate
	}
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
			if swiftIsPluralAcronymTail(segment, i+1) {
				continue
			}

			words = append(words, string(segment[start:i]))
			start = i
		}
	}

	words = append(words, string(segment[start:]))

	return words
}

// swiftIsPluralAcronymTail reports whether the lowercase run starting at index is a
// bare plural 's' terminating an all-caps run (the "s" in "JWKs"), in which case the
// run is kept as a single word instead of splitting before its last capital.
func swiftIsPluralAcronymTail(segment []rune, index int) bool {
	if segment[index] != 's' {
		return false
	}

	return index+1 == len(segment) || !unicode.IsLower(segment[index+1])
}

func lowerIdentifierWord(word string) string {
	return strings.ToLower(word)
}

func upperIdentifierWord(word string) string {
	if isAcronymWord(word) {
		return word
	}

	word = strings.ToLower(word)
	if word == "" {
		return word
	}

	runes := []rune(word)
	runes[0] = unicode.ToUpper(runes[0])

	return string(runes)
}

// isAcronymWord reports whether word is an all-caps acronym (optionally with a plural
// trailing 's', e.g. "JWKs") whose casing is preserved instead of title-cased. This
// matches the Swift API Design Guidelines and keeps generated names (getJWKs,
// createPAT, signInOTPEmail) aligned with the TypeScript SDK, whose method names come
// from the same operation ids.
func isAcronymWord(word string) bool {
	runes := []rune(word)
	if len(runes) > 0 && runes[len(runes)-1] == 's' {
		runes = runes[:len(runes)-1]
	}

	if len(runes) < 2 { //nolint:mnd
		return false
	}

	hasUpper := false

	for _, char := range runes {
		switch {
		case unicode.IsUpper(char):
			hasUpper = true
		case unicode.IsDigit(char):
		default:
			return false
		}
	}

	return hasUpper
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
