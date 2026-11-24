package mcp

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
)

// Standard MCP HTTP header names.
//
// Protocol version 2026-07-28 requires Mcp-Method and Mcp-Name on Streamable
// HTTP POST requests so that gateways, rate limiters, and WAFs can route and
// meter on headers instead of parsing JSON bodies (SEP-2243).
const (
	// HeaderProtocolVersion carries the MCP protocol version of a request.
	HeaderProtocolVersion = "Mcp-Protocol-Version"

	// HeaderSessionID carries a protocol-level session identifier.
	//
	// Removed in protocol version 2026-07-28 (SEP-2567): servers serving that
	// version ignore it and never mint or echo session IDs.
	HeaderSessionID = "Mcp-Session-Id"

	// HeaderLastEventID requests replay of a broken SSE stream.
	//
	// Stream resumability was removed in protocol version 2026-07-28
	// (SEP-2575): a broken stream loses the in-flight request, and the client
	// must re-issue it with a new request ID.
	HeaderLastEventID = "Last-Event-ID"

	// HeaderMethod mirrors the JSON-RPC method of the request body.
	HeaderMethod = "Mcp-Method"

	// HeaderName mirrors params.name (tools/call, prompts/get) or params.uri
	// (resources/read) from the request body.
	HeaderName = "Mcp-Name"

	// HeaderParamPrefix is prepended to the x-mcp-header annotation value to
	// form the header carrying a tool parameter.
	HeaderParamPrefix = "Mcp-Param-"
)

// Base64 sentinel wrapper used to carry header values that cannot be
// represented safely as plain ASCII (SEP-2243).
const (
	base64HeaderPrefix = "=?base64?"
	base64HeaderSuffix = "?="
)

// maxSafeInteger and minSafeInteger bound the integer values that can be
// faithfully represented as IEEE-754 double-precision floats.
const (
	maxSafeInteger = 1<<53 - 1
	minSafeInteger = -(1<<53 - 1)
)

// RequiresStandardHeaders reports whether requests using the given protocol
// version must carry the standard Mcp-Method and Mcp-Name headers.
func RequiresStandardHeaders(protocolVersion string) bool {
	return IsModernProtocol(protocolVersion)
}

// MethodRequiresNameHeader reports whether the Mcp-Name header is required for
// the given method.
func MethodRequiresNameHeader(method MCPMethod) bool {
	switch method {
	case MethodToolsCall, MethodResourcesRead, MethodPromptsGet:
		return true
	default:
		return false
	}
}

// ExtractHeaderName returns the value that belongs in the Mcp-Name header for
// the given method and raw params: params.name for tools/call and prompts/get,
// params.uri for resources/read. It reports false when the method does not
// carry a name.
func ExtractHeaderName(method MCPMethod, params json.RawMessage) (string, bool) {
	switch method {
	case MethodToolsCall:
		var p struct {
			Name string `json:"name"`
		}
		if json.Unmarshal(params, &p) == nil {
			return p.Name, true
		}
	case MethodPromptsGet:
		var p struct {
			Name string `json:"name"`
		}
		if json.Unmarshal(params, &p) == nil {
			return p.Name, true
		}
	case MethodResourcesRead:
		var p struct {
			URI string `json:"uri"`
		}
		if json.Unmarshal(params, &p) == nil {
			return p.URI, true
		}
	}
	return "", false
}

// EncodeHeaderValue converts a tool parameter value to an HTTP header-safe
// string per the SEP-2243 encoding rules:
//
//   - string: used as-is when it is safe ASCII, otherwise Base64 encoded
//   - int64:  decimal representation
//   - bool:   "true" or "false"
//
// Values containing non-ASCII characters, control characters, or
// leading/trailing whitespace are Base64 encoded with the =?base64?...?=
// wrapper. It reports false when the value is not a supported primitive.
func EncodeHeaderValue(value any) (string, bool) {
	s, ok := primitiveToHeaderString(value)
	if !ok {
		return "", false
	}
	if requiresBase64Encoding(s) {
		return base64HeaderPrefix + base64.StdEncoding.EncodeToString([]byte(s)) + base64HeaderSuffix, true
	}
	return s, true
}

// DecodeHeaderValue decodes a header value that may be wrapped in the
// =?base64?...?= sentinel. It reports false when the wrapper is present but
// the payload is not valid Base64.
func DecodeHeaderValue(value string) (string, bool) {
	if value == "" {
		return value, true
	}
	if encoded, ok := strings.CutPrefix(value, base64HeaderPrefix); ok {
		if encoded, ok = strings.CutSuffix(encoded, base64HeaderSuffix); ok {
			decoded, err := base64.StdEncoding.DecodeString(encoded)
			if err != nil {
				return "", false
			}
			return string(decoded), true
		}
	}
	return value, true
}

func requiresBase64Encoding(s string) bool {
	if s == "" {
		return false
	}
	if s[0] == ' ' || s[0] == '\t' || s[len(s)-1] == ' ' || s[len(s)-1] == '\t' {
		return true
	}
	for _, c := range s {
		if c < 0x20 || c > 0x7E {
			return true
		}
	}
	// Plain-ASCII values that look like the sentinel must also be encoded, to
	// avoid ambiguity with genuinely encoded values.
	if strings.HasPrefix(s, base64HeaderPrefix) && strings.HasSuffix(s, base64HeaderSuffix) {
		return true
	}
	return false
}

// primitiveToHeaderString formats a permitted x-mcp-header value in its
// canonical header representation.
func primitiveToHeaderString(value any) (string, bool) {
	switch v := value.(type) {
	case string:
		return v, true
	case bool:
		return strconv.FormatBool(v), true
	case int64:
		return strconv.FormatInt(v, 10), true
	case int:
		return strconv.Itoa(v), true
	default:
		return "", false
	}
}

// unmarshalHeaderPrimitive decodes a JSON value into the Go representation
// used for x-mcp-header processing: string, bool, or int64.
//
// Non-integer numbers and integers outside the JavaScript safe range are
// rejected, because the JSON Schema "number" type is not permitted for
// x-mcp-header parameters.
func unmarshalHeaderPrimitive(raw json.RawMessage) any {
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return nil
	}
	switch v := value.(type) {
	case string, bool:
		return v
	case float64:
		if math.IsNaN(v) || math.IsInf(v, 0) || v != math.Trunc(v) {
			return nil
		}
		if v < minSafeInteger || v > maxSafeInteger {
			return nil
		}
		return int64(v)
	default:
		return nil
	}
}

// headerPrimitiveEqual reports whether a decoded header string equals the
// JSON-derived body value.
func headerPrimitiveEqual(headerValue string, bodyValue any) bool {
	if bodyInt, ok := bodyValue.(int64); ok {
		headerNum, err := strconv.ParseFloat(headerValue, 64)
		if err != nil {
			return false
		}
		if math.IsNaN(headerNum) || math.IsInf(headerNum, 0) || headerNum != math.Trunc(headerNum) {
			return false
		}
		if headerNum < minSafeInteger || headerNum > maxSafeInteger {
			return false
		}
		return int64(headerNum) == bodyInt
	}
	expected, ok := primitiveToHeaderString(bodyValue)
	if !ok {
		return false
	}
	return headerValue == expected
}

// ParamHeaderBinding maps a (possibly nested) input-schema property to the
// HTTP header it travels in, as declared by an x-mcp-header annotation.
type ParamHeaderBinding struct {
	// Path is the property-name path from the root of the arguments object.
	Path []string
	// Header is the x-mcp-header annotation value, without the Mcp-Param-
	// prefix.
	Header string
}

// HeaderName returns the full HTTP header name for the binding.
func (b ParamHeaderBinding) HeaderName() string {
	return HeaderParamPrefix + b.Header
}

// headerSchemaProperty captures the subset of a JSON Schema needed for
// x-mcp-header processing.
//
// Type is kept raw because JSON Schema permits either a single type name or an
// array of them, and protocol version 2026-07-28 widened input schemas to the
// full JSON Schema 2020-12 vocabulary. Decoding it into a string would fail the
// whole schema, silently disabling both header generation and annotation
// validation for the tool.
type headerSchemaProperty struct {
	Type       json.RawMessage                 `json:"type"`
	XMCPHeader json.RawMessage                 `json:"x-mcp-header,omitempty"`
	Properties map[string]headerSchemaProperty `json:"properties,omitempty"`
}

// typeNames returns the type names declared by the property, accepting both
// the scalar and array forms.
func (p headerSchemaProperty) typeNames() []string {
	if len(p.Type) == 0 {
		return nil
	}
	var single string
	if err := json.Unmarshal(p.Type, &single); err == nil {
		return []string{single}
	}
	var multiple []string
	if err := json.Unmarshal(p.Type, &multiple); err == nil {
		return multiple
	}
	return nil
}

// isHeaderPrimitive reports whether every declared type is one x-mcp-header
// permits. A property with no declared type is not accepted, because the value
// could then be of any shape.
func (p headerSchemaProperty) isHeaderPrimitive() bool {
	names := p.typeNames()
	if len(names) == 0 {
		return false
	}
	for _, name := range names {
		switch name {
		case "string", "integer", "boolean":
		default:
			return false
		}
	}
	return true
}

// schemaHeaderProperties normalizes any input-schema representation (a typed
// schema struct, map[string]any, or json.RawMessage) into the subset of fields
// needed for x-mcp-header processing.
//
// The error is reported separately from an absent schema so that callers which
// must fail closed, such as annotation validation, can tell a schema with no
// annotations apart from one that could not be read.
func schemaHeaderProperties(schema any) (map[string]headerSchemaProperty, error) {
	if schema == nil {
		return nil, nil
	}
	var s headerSchemaProperty
	if err := remarshal(schema, &s); err != nil {
		return nil, fmt.Errorf("reading input schema: %w", err)
	}
	return s.Properties, nil
}

// ExtractParamHeaderBindings returns a binding for every property in the
// tool's input schema carrying an x-mcp-header annotation, at any nesting
// depth.
func ExtractParamHeaderBindings(tool *Tool) []ParamHeaderBinding {
	if tool == nil {
		return nil
	}
	props, err := schemaHeaderProperties(toolInputSchema(tool))
	if err != nil || len(props) == 0 {
		return nil
	}
	bindings := collectParamHeaderBindings(props, nil, nil)
	if len(bindings) == 0 {
		return nil
	}
	return bindings
}

func collectParamHeaderBindings(props map[string]headerSchemaProperty, prefix []string, out []ParamHeaderBinding) []ParamHeaderBinding {
	for name, prop := range props {
		path := make([]string, len(prefix)+1)
		copy(path, prefix)
		path[len(prefix)] = name

		var header string
		if json.Unmarshal(prop.XMCPHeader, &header) == nil && header != "" {
			out = append(out, ParamHeaderBinding{Path: path, Header: header})
		}
		if len(prop.Properties) > 0 {
			out = collectParamHeaderBindings(prop.Properties, path, out)
		}
	}
	return out
}

// ValidateParamHeaderAnnotations checks that every x-mcp-header annotation in
// the tool's input schema is well formed: applied only to primitive types, a
// non-empty valid HTTP token, and case-insensitively unique across the whole
// schema.
//
// Servers MUST reject tool definitions that violate these constraints.
func ValidateParamHeaderAnnotations(tool *Tool) error {
	if tool == nil {
		return nil
	}
	props, err := schemaHeaderProperties(toolInputSchema(tool))
	if err != nil {
		// A structurally unreadable schema is tolerated rather than rejected,
		// matching this package's existing policy for schemas that fail to
		// compile. It is not a way to smuggle bad annotations past this check:
		// the same decode failure leaves ExtractParamHeaderBindings empty, so
		// no Mcp-Param-* header is ever generated from it.
		return nil
	}
	if len(props) == 0 {
		return nil
	}
	return validateParamHeadersIn(props, "", make(map[string]bool))
}

func validateParamHeadersIn(props map[string]headerSchemaProperty, prefix string, seen map[string]bool) error {
	for name, prop := range props {
		path := name
		if prefix != "" {
			path = prefix + "." + name
		}
		if prop.XMCPHeader != nil {
			if !prop.isHeaderPrimitive() {
				return fmt.Errorf(
					"property %q: x-mcp-header can only be applied to primitive types (integer, string, boolean), got %s",
					path, describeSchemaType(prop))
			}
			var header string
			if err := json.Unmarshal(prop.XMCPHeader, &header); err != nil || header == "" {
				return fmt.Errorf("property %q: x-mcp-header must be a non-empty string", path)
			}
			if err := validateHeaderToken(header); err != nil {
				return fmt.Errorf("property %q: %w", path, err)
			}
			lower := strings.ToLower(header)
			if seen[lower] {
				return fmt.Errorf("property %q: duplicate x-mcp-header value %q (case-insensitive)", path, header)
			}
			seen[lower] = true
		}
		if len(prop.Properties) > 0 {
			if err := validateParamHeadersIn(prop.Properties, path, seen); err != nil {
				return err
			}
		}
	}
	return nil
}

// describeSchemaType renders a property's declared type for an error message.
func describeSchemaType(prop headerSchemaProperty) string {
	names := prop.typeNames()
	if len(names) == 0 {
		if len(prop.Type) == 0 {
			return "no declared type"
		}
		return string(prop.Type)
	}
	if len(names) == 1 {
		return strconv.Quote(names[0])
	}
	return "[" + strings.Join(names, ", ") + "]"
}

// validateHeaderToken checks that name matches the HTTP field-name token
// syntax (1*tchar).
func validateHeaderToken(name string) error {
	if name == "" {
		return fmt.Errorf("x-mcp-header value must be a non-empty string")
	}
	for _, c := range name {
		if !isTChar(c) {
			return fmt.Errorf("x-mcp-header value %q contains invalid character %q", name, c)
		}
	}
	return nil
}

// isTChar reports whether c is a valid HTTP token character:
//
//	tchar = "!" / "#" / "$" / "%" / "&" / "'" / "*" / "+" / "-" / "." /
//	        "^" / "_" / "`" / "|" / "~" / DIGIT / ALPHA
func isTChar(c rune) bool {
	switch {
	case c >= '0' && c <= '9', c >= 'A' && c <= 'Z', c >= 'a' && c <= 'z':
		return true
	}
	switch c {
	case '!', '#', '$', '%', '&', '\'', '*', '+', '-', '.', '^', '_', '`', '|', '~':
		return true
	}
	return false
}

// lookupArgument navigates an arguments object along a property-name path and
// returns the raw JSON value found there.
func lookupArgument(args map[string]json.RawMessage, path []string) (json.RawMessage, bool) {
	if len(path) == 0 {
		return nil, false
	}
	current, ok := args[path[0]]
	if !ok {
		return nil, false
	}
	for _, part := range path[1:] {
		var obj map[string]json.RawMessage
		if err := json.Unmarshal(current, &obj); err != nil {
			return nil, false
		}
		current, ok = obj[part]
		if !ok {
			return nil, false
		}
	}
	return current, true
}

// GenerateParamHeaders returns the Mcp-Param-* headers a client must mirror
// onto a tools/call request, derived from the tool's x-mcp-header annotations
// and the raw params of the call.
func GenerateParamHeaders(tool *Tool, params json.RawMessage) map[string]string {
	bindings := ExtractParamHeaderBindings(tool)
	if len(bindings) == 0 {
		return nil
	}
	args, ok := rawCallArguments(params)
	if !ok {
		return nil
	}

	headers := make(map[string]string, len(bindings))
	for _, binding := range bindings {
		raw, ok := lookupArgument(args, binding.Path)
		if !ok || string(raw) == "null" {
			continue
		}
		value := unmarshalHeaderPrimitive(raw)
		if value == nil {
			continue
		}
		encoded, ok := EncodeHeaderValue(value)
		if !ok {
			continue
		}
		headers[binding.HeaderName()] = encoded
	}
	if len(headers) == 0 {
		return nil
	}
	return headers
}

// ValidateParamHeaders checks that every Mcp-Param-* header on a tools/call
// request agrees with the corresponding argument in the request body.
//
// getHeader returns the value of a header, or "" when absent. That cannot tell
// a header sent with an empty value from a missing one, so an empty string
// argument is always reported as a missing header. Use
// [ValidateParamHeadersLookup] when header presence is known.
func ValidateParamHeaders(getHeader func(string) string, tool *Tool, params json.RawMessage) error {
	return ValidateParamHeadersLookup(func(name string) (string, bool) {
		value := getHeader(name)
		return value, value != ""
	}, tool, params)
}

// ValidateParamHeadersLookup is like [ValidateParamHeaders], but lookupHeader
// also reports whether the header is present at all. An empty string argument
// is sent as a header with an empty value, and it matches only when that
// header is present. For an absent or null argument only a header with a
// value is a mismatch, as in ValidateParamHeaders.
func ValidateParamHeadersLookup(lookupHeader func(string) (string, bool), tool *Tool, params json.RawMessage) error {
	return ValidateParamHeadersWithBindings(lookupHeader, ExtractParamHeaderBindings(tool), params)
}

// ValidateParamHeadersWithBindings is [ValidateParamHeadersLookup] for bindings
// already extracted with ExtractParamHeaderBindings, so a server that
// registers a tool once can validate every call against it without
// re-reading the schema.
func ValidateParamHeadersWithBindings(lookupHeader func(string) (string, bool), bindings []ParamHeaderBinding, params json.RawMessage) error {
	if len(bindings) == 0 {
		return nil
	}
	args, ok := rawCallArguments(params)
	if !ok {
		return nil
	}

	for _, binding := range bindings {
		name := binding.HeaderName()
		headerValue, headerPresent := lookupHeader(name)
		raw, exists := lookupArgument(args, binding.Path)

		if !exists || string(raw) == "null" {
			if headerValue != "" {
				return HeaderMismatchError{
					Header: name,
					Reason: fmt.Sprintf("unexpected header for absent or null parameter %q", strings.Join(binding.Path, ".")),
				}
			}
			continue
		}

		if !headerPresent {
			return HeaderMismatchError{
				Header: name,
				Reason: fmt.Sprintf("missing header for parameter %q", strings.Join(binding.Path, ".")),
			}
		}

		decoded, ok := DecodeHeaderValue(headerValue)
		if !ok {
			return HeaderMismatchError{Header: name, Reason: "invalid Base64 encoding"}
		}

		bodyValue := unmarshalHeaderPrimitive(raw)
		if bodyValue == nil {
			return HeaderMismatchError{
				Header: name,
				Reason: fmt.Sprintf("body parameter %q is not a primitive type", strings.Join(binding.Path, ".")),
			}
		}

		if !headerPrimitiveEqual(decoded, bodyValue) {
			return HeaderMismatchError{
				Header: name,
				Reason: fmt.Sprintf("header value %q does not match body value", headerValue),
			}
		}
	}
	return nil
}

// ValidateStandardHeaders checks the Mcp-Method and Mcp-Name headers against
// the method and params of the request body, per SEP-2243.
//
// It is a no-op for protocol versions earlier than 2026-07-28, which did not
// define these headers. getHeader returns the value of a header, or "" when
// absent.
func ValidateStandardHeaders(getHeader func(string) string, protocolVersion string, method MCPMethod, params json.RawMessage) error {
	return ValidateStandardHeadersFunc(getHeader, protocolVersion, method, func() (string, bool) {
		return ExtractHeaderName(method, params)
	})
}

// ValidateStandardHeadersFunc is ValidateStandardHeaders for a caller that
// reads the body name itself. bodyName returns what ExtractHeaderName would
// return for the request params, and is called only when the method requires
// an Mcp-Name header.
func ValidateStandardHeadersFunc(getHeader func(string) string, protocolVersion string, method MCPMethod, bodyName func() (string, bool)) error {
	if !RequiresStandardHeaders(protocolVersion) {
		return nil
	}

	headerMethod := getHeader(HeaderMethod)
	if headerMethod == "" {
		return HeaderMismatchError{Header: HeaderMethod, Reason: "missing required header"}
	}
	if headerMethod != string(method) {
		return HeaderMismatchError{
			Header: HeaderMethod,
			Reason: fmt.Sprintf("header value %q does not match body value %q", headerMethod, method),
		}
	}

	if !MethodRequiresNameHeader(method) {
		return nil
	}

	headerName := getHeader(HeaderName)
	if headerName == "" {
		return HeaderMismatchError{
			Header: HeaderName,
			Reason: fmt.Sprintf("missing required header for method %q", method),
		}
	}
	decoded, ok := DecodeHeaderValue(headerName)
	if !ok {
		return HeaderMismatchError{Header: HeaderName, Reason: "invalid Base64 encoding"}
	}
	name, ok := bodyName()
	if !ok {
		return HeaderMismatchError{
			Header: HeaderName,
			Reason: fmt.Sprintf("failed to extract name from parameters for method %q", method),
		}
	}
	if decoded != name {
		return HeaderMismatchError{
			Header: HeaderName,
			Reason: fmt.Sprintf("header value %q does not match body value %q", decoded, name),
		}
	}
	return nil
}

// StandardHeaders returns the standard MCP headers a client must set on a
// Streamable HTTP POST request carrying the given method and params.
//
// It returns nil for protocol versions earlier than 2026-07-28.
func StandardHeaders(protocolVersion string, method MCPMethod, params json.RawMessage) map[string]string {
	if !RequiresStandardHeaders(protocolVersion) {
		return nil
	}
	headers := map[string]string{HeaderMethod: string(method)}
	if name, ok := ExtractHeaderName(method, params); ok {
		if encoded, ok := EncodeHeaderValue(name); ok {
			headers[HeaderName] = encoded
		}
	}
	return headers
}

// rawCallArguments extracts the raw arguments object from tools/call params.
func rawCallArguments(params json.RawMessage) (map[string]json.RawMessage, bool) {
	var raw struct {
		Arguments map[string]json.RawMessage `json:"arguments"`
	}
	if err := json.Unmarshal(params, &raw); err != nil || raw.Arguments == nil {
		return nil, false
	}
	return raw.Arguments, true
}

// toolInputSchema returns the tool's input schema in whichever form it was
// supplied, preferring the raw JSON schema when set.
func toolInputSchema(tool *Tool) any {
	if len(tool.RawInputSchema) > 0 {
		return tool.RawInputSchema
	}
	return tool.InputSchema
}
