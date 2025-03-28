package openapi3filter

import (
	"archive/zip"
	"bytes"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/url"
	"reflect"
	"regexp"
	"strconv"
	"strings"

	"github.com/oasdiff/yaml3"

	"github.com/getkin/kin-openapi/openapi3"
)

// ParseErrorKind describes a kind of ParseError.
// The type simplifies comparison of errors.
type ParseErrorKind int

const (
	// KindOther describes an untyped parsing error.
	KindOther ParseErrorKind = iota
	// KindUnsupportedFormat describes an error that happens when a value has an unsupported format.
	KindUnsupportedFormat
	// KindInvalidFormat describes an error that happens when a value does not conform a format
	// that is required by a serialization method.
	KindInvalidFormat
)

// ParseError describes errors which happens while parse operation's parameters, requestBody, or response.
type ParseError struct {
	Kind   ParseErrorKind
	Value  any
	Reason string
	Cause  error

	path []any
}

var _ interface{ Unwrap() error } = ParseError{}

func (e *ParseError) Error() string {
	var msg []string
	if p := e.Path(); len(p) > 0 {
		var arr []string
		for _, v := range p {
			arr = append(arr, fmt.Sprintf("%v", v))
		}
		msg = append(msg, fmt.Sprintf("path %v", strings.Join(arr, ".")))
	}
	msg = append(msg, e.innerError())
	return strings.Join(msg, ": ")
}

func (e *ParseError) innerError() string {
	var msg []string
	if e.Value != nil {
		msg = append(msg, fmt.Sprintf("value %v", e.Value))
	}
	if e.Reason != "" {
		msg = append(msg, e.Reason)
	}
	if e.Cause != nil {
		if v, ok := e.Cause.(*ParseError); ok {
			msg = append(msg, v.innerError())
		} else {
			msg = append(msg, e.Cause.Error())
		}
	}
	return strings.Join(msg, ": ")
}

// RootCause returns a root cause of ParseError.
func (e *ParseError) RootCause() error {
	if v, ok := e.Cause.(*ParseError); ok {
		return v.RootCause()
	}
	return e.Cause
}

func (e ParseError) Unwrap() error {
	return e.Cause
}

// Path returns a path to the root cause.
func (e *ParseError) Path() []any {
	var path []any
	if v, ok := e.Cause.(*ParseError); ok {
		p := v.Path()
		if len(p) > 0 {
			path = append(path, p...)
		}
	}
	if len(e.path) > 0 {
		path = append(path, e.path...)
	}
	return path
}

func invalidSerializationMethodErr(sm *openapi3.SerializationMethod) error {
	return fmt.Errorf("invalid serialization method: style=%q, explode=%v", sm.Style, sm.Explode)
}

// Decodes a parameter defined via the content property as an object. It uses
// the user specified decoder, or our build-in decoder for application/json
func decodeContentParameter(param *openapi3.Parameter, input *RequestValidationInput) (
	value any,
	schema *openapi3.Schema,
	found bool,
	err error,
) {
	var paramValues []string
	switch param.In {
	case openapi3.ParameterInPath:
		var paramValue string
		if paramValue, found = input.PathParams[param.Name]; found {
			paramValues = []string{paramValue}
		}
	case openapi3.ParameterInQuery:
		paramValues, found = input.GetQueryParams()[param.Name]
	case openapi3.ParameterInHeader:
		var headerValues []string
		if headerValues, found = input.Request.Header[http.CanonicalHeaderKey(param.Name)]; found {
			paramValues = headerValues
		}
	case openapi3.ParameterInCookie:
		var cookie *http.Cookie
		if cookie, err = input.Request.Cookie(param.Name); err == http.ErrNoCookie {
			found = false
		} else if err != nil {
			return
		} else {
			paramValues = []string{cookie.Value}
			found = true
		}
	default:
		err = fmt.Errorf("unsupported parameter.in: %q", param.In)
		return
	}

	if !found {
		if param.Required {
			err = fmt.Errorf("parameter %q is required, but missing", param.Name)
		}
		return
	}

	decoder := input.ParamDecoder
	if decoder == nil {
		decoder = defaultContentParameterDecoder
	}

	value, schema, err = decoder(param, paramValues)
	return
}

func defaultContentParameterDecoder(param *openapi3.Parameter, values []string) (
	outValue any,
	outSchema *openapi3.Schema,
	err error,
) {
	// Only query parameters can have multiple values.
	if len(values) > 1 && param.In != openapi3.ParameterInQuery {
		err = fmt.Errorf("%s parameter %q cannot have multiple values", param.In, param.Name)
		return
	}

	content := param.Content
	if content == nil {
		err = fmt.Errorf("parameter %q expected to have content", param.Name)
		return
	}
	// We only know how to decode a parameter if it has one content, application/json
	if len(content) != 1 {
		err = fmt.Errorf("multiple content types for parameter %q", param.Name)
		return
	}

	mt := content.Get("application/json")
	if mt == nil {
		err = fmt.Errorf("parameter %q has no content schema", param.Name)
		return
	}
	outSchema = mt.Schema.Value

	unmarshal := func(encoded string, paramSchema *openapi3.SchemaRef) (decoded any, err error) {
		if err = json.Unmarshal([]byte(encoded), &decoded); err != nil {
			if paramSchema != nil && !paramSchema.Value.Type.Is("object") {
				decoded, err = encoded, nil
			}
		}
		return
	}

	if len(values) == 1 {
		if outValue, err = unmarshal(values[0], mt.Schema); err != nil {
			err = fmt.Errorf("error unmarshaling parameter %q", param.Name)
			return
		}
	} else {
		outArray := make([]any, 0, len(values))
		for _, v := range values {
			var item any
			if item, err = unmarshal(v, outSchema.Items); err != nil {
				err = fmt.Errorf("error unmarshaling parameter %q", param.Name)
				return
			}
			outArray = append(outArray, item)
		}
		outValue = outArray
	}
	return
}

type valueDecoder interface {
	DecodePrimitive(param string, sm *openapi3.SerializationMethod, schema *openapi3.SchemaRef) (any, bool, error)
	DecodeArray(param string, sm *openapi3.SerializationMethod, schema *openapi3.SchemaRef) ([]any, bool, error)
	DecodeObject(param string, sm *openapi3.SerializationMethod, schema *openapi3.SchemaRef) (map[string]any, bool, error)
}

// decodeStyledParameter returns a value of an operation's parameter from HTTP request for
// parameters defined using the style format, and whether the parameter is supplied in the input.
// The function returns ParseError when HTTP request contains an invalid value of a parameter.
func decodeStyledParameter(param *openapi3.Parameter, input *RequestValidationInput) (any, bool, error) {
	sm, err := param.SerializationMethod()
	if err != nil {
		return nil, false, err
	}

	var dec valueDecoder
	switch param.In {
	case openapi3.ParameterInPath:
		if len(input.PathParams) == 0 {
			return nil, false, nil
		}
		dec = &pathParamDecoder{pathParams: input.PathParams}
	case openapi3.ParameterInQuery:
		if len(input.GetQueryParams()) == 0 {
			return nil, false, nil
		}
		dec = &urlValuesDecoder{values: input.GetQueryParams()}
	case openapi3.ParameterInHeader:
		dec = &headerParamDecoder{header: input.Request.Header}
	case openapi3.ParameterInCookie:
		dec = &cookieParamDecoder{req: input.Request}
	default:
		return nil, false, fmt.Errorf("unsupported parameter's 'in': %s", param.In)
	}

	return decodeValue(dec, param.Name, sm, param.Schema, param.Required)
}

func decodeValue(dec valueDecoder, param string, sm *openapi3.SerializationMethod, schema *openapi3.SchemaRef, required bool) (any, bool, error) {
	var found bool

	if len(schema.Value.AllOf) > 0 {
		var value any
		var err error
		for _, sr := range schema.Value.AllOf {
			var f bool
			value, f, err = decodeValue(dec, param, sm, sr, required)
			found = found || f
			if value == nil || err != nil {
				break
			}
		}
		return value, found, err
	}

	if len(schema.Value.AnyOf) > 0 {
		for _, sr := range schema.Value.AnyOf {
			value, f, _ := decodeValue(dec, param, sm, sr, required)
			found = found || f
			if value != nil {
				return value, found, nil
			}
		}
		if required {
			return nil, found, fmt.Errorf("decoding anyOf for parameter %q failed", param)
		}
		return nil, found, nil
	}

	if len(schema.Value.OneOf) > 0 {
		isMatched := 0
		var value any
		for _, sr := range schema.Value.OneOf {
			v, f, _ := decodeValue(dec, param, sm, sr, required)
			found = found || f
			if v != nil {
				value = v
				isMatched++
			}
		}
		if isMatched >= 1 {
			return value, found, nil
		}
		if required {
			return nil, found, fmt.Errorf("decoding oneOf failed: %q is required", param)
		}
		return nil, found, nil
	}

	if schema.Value.Not != nil {
		// TODO(decode not): handle decoding "not" JSON Schema
		return nil, found, errors.New("not implemented: decoding 'not'")
	}

	if schema.Value.Type != nil {
		var decodeFn func(param string, sm *openapi3.SerializationMethod, schema *openapi3.SchemaRef) (any, bool, error)
		switch {
		case schema.Value.Type.Is("array"):
			decodeFn = func(param string, sm *openapi3.SerializationMethod, schema *openapi3.SchemaRef) (any, bool, error) {
				res, b, e := dec.DecodeArray(param, sm, schema)
				if len(res) == 0 {
					return nil, b, e
				}
				return res, b, e
			}
		case schema.Value.Type.Is("object"):
			decodeFn = func(param string, sm *openapi3.SerializationMethod, schema *openapi3.SchemaRef) (any, bool, error) {
				return dec.DecodeObject(param, sm, schema)
			}
		default:
			decodeFn = dec.DecodePrimitive
		}
		return decodeFn(param, sm, schema)
	}
	switch vDecoder := dec.(type) {
	case *pathParamDecoder:
		_, found = vDecoder.pathParams[param]
	case *urlValuesDecoder:
		if schema.Value.Pattern != "" {
			return dec.DecodePrimitive(param, sm, schema)
		}
		_, found = vDecoder.values[param]
	case *headerParamDecoder:
		_, found = vDecoder.header[http.CanonicalHeaderKey(param)]
	case *cookieParamDecoder:
		_, err := vDecoder.req.Cookie(param)
		found = err != http.ErrNoCookie
	default:
		return nil, found, errors.New("unsupported decoder")
	}
	return nil, found, nil
}

// pathParamDecoder decodes values of path parameters.
type pathParamDecoder struct {
	pathParams map[string]string
}

func (d *pathParamDecoder) DecodePrimitive(param string, sm *openapi3.SerializationMethod, schema *openapi3.SchemaRef) (any, bool, error) {
	var prefix string
	switch sm.Style {
	case "simple":
		// A prefix is empty for style "simple".
	case "label":
		prefix = "."
	case "matrix":
		prefix = ";" + param + "="
	default:
		return nil, false, invalidSerializationMethodErr(sm)
	}

	if d.pathParams == nil {
		// HTTP request does not contains a value of the target path parameter.
		return nil, false, nil
	}
	raw, ok := d.pathParams[param]
	if !ok || raw == "" {
		// HTTP request does not contains a value of the target path parameter.
		return nil, false, nil
	}
	src, err := cutPrefix(raw, prefix)
	if err != nil {
		return nil, ok, err
	}
	val, err := parsePrimitive(src, schema)
	return val, ok, err
}

func (d *pathParamDecoder) DecodeArray(param string, sm *openapi3.SerializationMethod, schema *openapi3.SchemaRef) ([]any, bool, error) {
	var prefix, delim string
	switch {
	case sm.Style == "simple":
		delim = ","
	case sm.Style == "label" && !sm.Explode:
		prefix = "."
		delim = ","
	case sm.Style == "label" && sm.Explode:
		prefix = "."
		delim = "."
	case sm.Style == "matrix" && !sm.Explode:
		prefix = ";" + param + "="
		delim = ","
	case sm.Style == "matrix" && sm.Explode:
		prefix = ";" + param + "="
		delim = ";" + param + "="
	default:
		return nil, false, invalidSerializationMethodErr(sm)
	}

	if d.pathParams == nil {
		// HTTP request does not contains a value of the target path parameter.
		return nil, false, nil
	}
	raw, ok := d.pathParams[param]
	if !ok || raw == "" {
		// HTTP request does not contains a value of the target path parameter.
		return nil, false, nil
	}
	src, err := cutPrefix(raw, prefix)
	if err != nil {
		return nil, ok, err
	}
	val, err := parseArray(strings.Split(src, delim), schema)
	return val, ok, err
}

func (d *pathParamDecoder) DecodeObject(param string, sm *openapi3.SerializationMethod, schema *openapi3.SchemaRef) (map[string]any, bool, error) {
	var prefix, propsDelim, valueDelim string
	switch {
	case sm.Style == "simple" && !sm.Explode:
		propsDelim = ","
		valueDelim = ","
	case sm.Style == "simple" && sm.Explode:
		propsDelim = ","
		valueDelim = "="
	case sm.Style == "label" && !sm.Explode:
		prefix = "."
		propsDelim = ","
		valueDelim = ","
	case sm.Style == "label" && sm.Explode:
		prefix = "."
		propsDelim = "."
		valueDelim = "="
	case sm.Style == "matrix" && !sm.Explode:
		prefix = ";" + param + "="
		propsDelim = ","
		valueDelim = ","
	case sm.Style == "matrix" && sm.Explode:
		prefix = ";"
		propsDelim = ";"
		valueDelim = "="
	default:
		return nil, false, invalidSerializationMethodErr(sm)
	}

	if d.pathParams == nil {
		// HTTP request does not contains a value of the target path parameter.
		return nil, false, nil
	}
	raw, ok := d.pathParams[param]
	if !ok || raw == "" {
		// HTTP request does not contains a value of the target path parameter.
		return nil, false, nil
	}
	src, err := cutPrefix(raw, prefix)
	if err != nil {
		return nil, ok, err
	}
	props, err := propsFromString(src, propsDelim, valueDelim)
	if err != nil {
		return nil, ok, err
	}

	val, err := makeObject(props, schema)
	return val, ok, err
}

// cutPrefix validates that a raw value of a path parameter has the specified prefix,
// and returns a raw value without the prefix.
func cutPrefix(raw, prefix string) (string, error) {
	if prefix == "" {
		return raw, nil
	}
	if len(raw) < len(prefix) || raw[:len(prefix)] != prefix {
		return "", &ParseError{
			Kind:   KindInvalidFormat,
			Value:  raw,
			Reason: fmt.Sprintf("a value must be prefixed with %q", prefix),
		}
	}
	return raw[len(prefix):], nil
}

// urlValuesDecoder decodes values of query parameters.
type urlValuesDecoder struct {
	values url.Values
}

func (d *urlValuesDecoder) DecodePrimitive(param string, sm *openapi3.SerializationMethod, schema *openapi3.SchemaRef) (any, bool, error) {
	if sm.Style != "form" {
		return nil, false, invalidSerializationMethodErr(sm)
	}

	values, ok := d.values[param]
	if len(values) == 0 {
		// HTTP request does not contain a value of the target query parameter.
		return nil, ok, nil
	}

	if schema.Value.Type == nil && schema.Value.Pattern != "" {
		return values[0], ok, nil
	}
	val, err := parsePrimitive(values[0], schema)
	return val, ok, err
}

func (d *urlValuesDecoder) DecodeArray(param string, sm *openapi3.SerializationMethod, schema *openapi3.SchemaRef) ([]any, bool, error) {
	if sm.Style == "deepObject" {
		return nil, false, invalidSerializationMethodErr(sm)
	}

	values, ok := d.values[param]
	if len(values) == 0 {
		// HTTP request does not contain a value of the target query parameter.
		return nil, ok, nil
	}
	if !sm.Explode {
		var delim string
		switch sm.Style {
		case "form":
			delim = ","
		case "spaceDelimited":
			delim = " "
		case "pipeDelimited":
			delim = "|"
		}
		values = strings.Split(values[0], delim)
	}
	val, err := d.parseArray(values, sm, schema)
	return val, ok, err
}

// parseArray returns an array that contains items from a raw array.
// Every item is parsed as a primitive value.
// The function returns an error when an error happened while parse array's items.
func (d *urlValuesDecoder) parseArray(raw []string, sm *openapi3.SerializationMethod, schemaRef *openapi3.SchemaRef) ([]any, error) {
	var value []any

	for i, v := range raw {
		item, err := d.parseValue(v, schemaRef.Value.Items)
		if err != nil {
			if v, ok := err.(*ParseError); ok {
				return nil, &ParseError{path: []any{i}, Cause: v}
			}
			return nil, fmt.Errorf("item %d: %w", i, err)
		}

		// If the items are nil, then the array is nil. There shouldn't be case where some values are actual primitive
		// values and some are nil values.
		if item == nil {
			return nil, nil
		}
		value = append(value, item)
	}
	return value, nil
}

func (d *urlValuesDecoder) parseValue(v string, schema *openapi3.SchemaRef) (any, error) {
	if len(schema.Value.AllOf) > 0 {
		var value any
		var err error
		for _, sr := range schema.Value.AllOf {
			value, err = d.parseValue(v, sr)
			if value == nil || err != nil {
				break
			}
		}
		return value, err
	}

	if len(schema.Value.AnyOf) > 0 {
		var value any
		var err error
		for _, sr := range schema.Value.AnyOf {
			if value, err = d.parseValue(v, sr); err == nil {
				return value, nil
			}
		}

		return nil, err
	}

	if len(schema.Value.OneOf) > 0 {
		isMatched := 0
		var value any
		var err error
		for _, sr := range schema.Value.OneOf {
			result, err := d.parseValue(v, sr)
			if err == nil {
				value = result
				isMatched++
			}
		}
		if isMatched == 1 {
			return value, nil
		} else if isMatched > 1 {
			return nil, fmt.Errorf("decoding oneOf failed: %d schemas matched", isMatched)
		} else if isMatched == 0 {
			return nil, fmt.Errorf("decoding oneOf failed: %d schemas matched", isMatched)
		}

		return nil, err
	}

	if schema.Value.Not != nil {
		// TODO(decode not): handle decoding "not" JSON Schema
		return nil, errors.New("not implemented: decoding 'not'")
	}

	return parsePrimitive(v, schema)
}

const (
	urlDecoderDelimiter = "\x1F" // should not conflict with URL characters
)

func (d *urlValuesDecoder) DecodeObject(param string, sm *openapi3.SerializationMethod, schema *openapi3.SchemaRef) (map[string]any, bool, error) {
	var propsFn func(url.Values) (map[string]string, error)
	switch sm.Style {
	case "form":
		propsFn = func(params url.Values) (map[string]string, error) {
			if len(params) == 0 {
				// HTTP request does not contain query parameters.
				return nil, nil
			}
			if sm.Explode {
				props := make(map[string]string)
				for key, values := range params {
					props[key] = values[0]
				}
				return props, nil
			}
			values := params[param]
			if len(values) == 0 {
				// HTTP request does not contain a value of the target query parameter.
				return nil, nil
			}
			return propsFromString(values[0], ",", ",")
		}
	case "deepObject":
		propsFn = func(params url.Values) (map[string]string, error) {
			props := make(map[string]string)
			for key, values := range params {
				if !regexp.MustCompile(fmt.Sprintf(`^%s\[`, regexp.QuoteMeta(param))).MatchString(key) {
					continue
				}

				matches := regexp.MustCompile(`\[(.*?)\]`).FindAllStringSubmatch(key, -1)
				switch l := len(matches); {
				case l == 0:
					// A query parameter's name does not match the required format, so skip it.
					continue
				case l >= 1:
					kk := []string{}
					for _, m := range matches {
						kk = append(kk, m[1])
					}
					props[strings.Join(kk, urlDecoderDelimiter)] = strings.Join(values, urlDecoderDelimiter)
				}
			}
			if len(props) == 0 {
				// HTTP request does not contain query parameters encoded by rules of style "deepObject".
				return nil, nil
			}
			return props, nil
		}
	default:
		return nil, false, invalidSerializationMethodErr(sm)
	}
	props, err := propsFn(d.values)
	if err != nil {
		return nil, false, err
	}
	if props == nil {
		return nil, false, nil
	}
	val, err := makeObject(props, schema)
	if err != nil {
		return nil, false, err
	}

	found := false
	for propName := range schema.Value.Properties {
		if _, ok := props[propName]; ok {
			found = true
			break
		}

		if schema.Value.Type.Permits("array") || schema.Value.Type.Permits("object") {
			for k := range props {
				path := strings.Split(k, urlDecoderDelimiter)
				if _, ok := deepGet(val, path...); ok {
					found = true
					break
				}
			}
		}
	}

	return val, found, nil
}

// headerParamDecoder decodes values of header parameters.
type headerParamDecoder struct {
	header http.Header
}

func (d *headerParamDecoder) DecodePrimitive(param string, sm *openapi3.SerializationMethod, schema *openapi3.SchemaRef) (any, bool, error) {
	if sm.Style != "simple" {
		return nil, false, invalidSerializationMethodErr(sm)
	}

	raw, ok := d.header[http.CanonicalHeaderKey(param)]
	if !ok || len(raw) == 0 {
		// HTTP request does not contains a corresponding header or has the empty value
		return nil, ok, nil
	}

	val, err := parsePrimitive(raw[0], schema)
	return val, ok, err
}

func (d *headerParamDecoder) DecodeArray(param string, sm *openapi3.SerializationMethod, schema *openapi3.SchemaRef) ([]any, bool, error) {
	if sm.Style != "simple" {
		return nil, false, invalidSerializationMethodErr(sm)
	}

	raw, ok := d.header[http.CanonicalHeaderKey(param)]
	if !ok || len(raw) == 0 {
		// HTTP request does not contains a corresponding header
		return nil, ok, nil
	}

	val, err := parseArray(strings.Split(raw[0], ","), schema)
	return val, ok, err
}

func (d *headerParamDecoder) DecodeObject(param string, sm *openapi3.SerializationMethod, schema *openapi3.SchemaRef) (map[string]any, bool, error) {
	if sm.Style != "simple" {
		return nil, false, invalidSerializationMethodErr(sm)
	}
	valueDelim := ","
	if sm.Explode {
		valueDelim = "="
	}

	raw, ok := d.header[http.CanonicalHeaderKey(param)]
	if !ok || len(raw) == 0 {
		// HTTP request does not contain a corresponding header.
		return nil, ok, nil
	}
	props, err := propsFromString(raw[0], ",", valueDelim)
	if err != nil {
		return nil, ok, err
	}
	val, err := makeObject(props, schema)
	return val, ok, err
}

// cookieParamDecoder decodes values of cookie parameters.
type cookieParamDecoder struct {
	req *http.Request
}

func (d *cookieParamDecoder) DecodePrimitive(param string, sm *openapi3.SerializationMethod, schema *openapi3.SchemaRef) (any, bool, error) {
	if sm.Style != "form" {
		return nil, false, invalidSerializationMethodErr(sm)
	}

	cookie, err := d.req.Cookie(param)
	found := err != http.ErrNoCookie
	if !found {
		// HTTP request does not contain a corresponding cookie.
		return nil, found, nil
	}
	if err != nil {
		return nil, found, fmt.Errorf("decoding param %q: %w", param, err)
	}

	val, err := parsePrimitive(cookie.Value, schema)
	return val, found, err
}

func (d *cookieParamDecoder) DecodeArray(param string, sm *openapi3.SerializationMethod, schema *openapi3.SchemaRef) ([]any, bool, error) {
	if sm.Style != "form" || sm.Explode {
		return nil, false, invalidSerializationMethodErr(sm)
	}

	cookie, err := d.req.Cookie(param)
	found := err != http.ErrNoCookie
	if !found {
		// HTTP request does not contain a corresponding cookie.
		return nil, found, nil
	}
	if err != nil {
		return nil, found, fmt.Errorf("decoding param %q: %w", param, err)
	}
	val, err := parseArray(strings.Split(cookie.Value, ","), schema)
	return val, found, err
}

func (d *cookieParamDecoder) DecodeObject(param string, sm *openapi3.SerializationMethod, schema *openapi3.SchemaRef) (map[string]any, bool, error) {
	if sm.Style != "form" || sm.Explode {
		return nil, false, invalidSerializationMethodErr(sm)
	}

	cookie, err := d.req.Cookie(param)
	found := err != http.ErrNoCookie
	if !found {
		// HTTP request does not contain a corresponding cookie.
		return nil, found, nil
	}
	if err != nil {
		return nil, found, fmt.Errorf("decoding param %q: %w", param, err)
	}
	props, err := propsFromString(cookie.Value, ",", ",")
	if err != nil {
		return nil, found, err
	}
	val, err := makeObject(props, schema)
	return val, found, err
}

// propsFromString returns a properties map that is created by splitting a source string by propDelim and valueDelim.
// The source string must have a valid format: pairs <propName><valueDelim><propValue> separated by <propDelim>.
// The function returns an error when the source string has an invalid format.
func propsFromString(src, propDelim, valueDelim string) (map[string]string, error) {
	props := make(map[string]string)
	pairs := strings.Split(src, propDelim)

	// When propDelim and valueDelim is equal the source string follow the next rule:
	// every even item of pairs is a properties's name, and the subsequent odd item is a property's value.
	if propDelim == valueDelim {
		// Taking into account the rule above, a valid source string must be splitted by propDelim
		// to an array with an even number of items.
		if len(pairs)%2 != 0 {
			return nil, &ParseError{
				Kind:   KindInvalidFormat,
				Value:  src,
				Reason: fmt.Sprintf("a value must be a list of object's properties in format \"name%svalue\" separated by %s", valueDelim, propDelim),
			}
		}
		for i := 0; i < len(pairs)/2; i++ {
			props[pairs[i*2]] = pairs[i*2+1]
		}
		return props, nil
	}

	// When propDelim and valueDelim is not equal the source string follow the next rule:
	// every item of pairs is a string that follows format <propName><valueDelim><propValue>.
	for _, pair := range pairs {
		prop := strings.Split(pair, valueDelim)
		if len(prop) != 2 {
			return nil, &ParseError{
				Kind:   KindInvalidFormat,
				Value:  src,
				Reason: fmt.Sprintf("a value must be a list of object's properties in format \"name%svalue\" separated by %s", valueDelim, propDelim),
			}
		}
		props[prop[0]] = prop[1]
	}
	return props, nil
}

func deepGet(m map[string]any, keys ...string) (any, bool) {
	for _, key := range keys {
		val, ok := m[key]
		if !ok {
			return nil, false
		}
		if m, ok = val.(map[string]any); !ok {
			return val, true
		}
	}
	return m, true
}

func deepSet(m map[string]any, keys []string, value any) {
	for i := 0; i < len(keys)-1; i++ {
		key := keys[i]
		if _, ok := m[key]; !ok {
			m[key] = make(map[string]any)
		}
		m = m[key].(map[string]any)
	}
	m[keys[len(keys)-1]] = value
}

func findNestedSchema(parentSchema *openapi3.SchemaRef, keys []string) (*openapi3.SchemaRef, error) {
	currentSchema := parentSchema
	for _, key := range keys {
		if currentSchema.Value.Type.Includes(openapi3.TypeArray) {
			currentSchema = currentSchema.Value.Items
		} else {
			propertySchema, ok := currentSchema.Value.Properties[key]
			if !ok {
				if currentSchema.Value.AdditionalProperties.Schema == nil {
					return nil, fmt.Errorf("nested schema for key %q not found", key)
				}
				currentSchema = currentSchema.Value.AdditionalProperties.Schema
				continue
			}
			currentSchema = propertySchema
		}
	}
	return currentSchema, nil
}

// makeObject returns an object that contains properties from props.
func makeObject(props map[string]string, schema *openapi3.SchemaRef) (map[string]any, error) {
	mobj := make(map[string]any)

	for kk, value := range props {
		keys := strings.Split(kk, urlDecoderDelimiter)
		if strings.Contains(value, urlDecoderDelimiter) {
			// don't support implicit array indexes anymore
			p := pathFromKeys(keys)
			return nil, &ParseError{path: p, Kind: KindInvalidFormat, Reason: "array items must be set with indexes"}
		}
		deepSet(mobj, keys, value)
	}
	r, err := buildResObj(mobj, nil, "", schema)
	if err != nil {
		return nil, err
	}
	result, ok := r.(map[string]any)
	if !ok {
		return nil, &ParseError{Kind: KindOther, Reason: "invalid param object", Value: result}
	}

	return result, nil
}

// example: map[0:map[key:true] 1:map[key:false]] -> [map[key:true] map[key:false]]
func sliceMapToSlice(m map[string]any) ([]any, error) {
	var result []any

	keys := make([]int, 0, len(m))
	for k := range m {
		key, err := strconv.Atoi(k)
		if err != nil {
			return nil, fmt.Errorf("array indexes must be integers: %w", err)
		}
		keys = append(keys, key)
	}
	max := -1
	for _, k := range keys {
		if k > max {
			max = k
		}
	}
	for i := 0; i <= max; i++ {
		val, ok := m[strconv.Itoa(i)]
		if !ok {
			result = append(result, nil)
			continue
		}
		result = append(result, val)
	}
	return result, nil
}

// buildResObj constructs an object based on a given schema and param values
func buildResObj(params map[string]any, parentKeys []string, key string, schema *openapi3.SchemaRef) (any, error) {
	mapKeys := parentKeys
	if key != "" {
		mapKeys = append(mapKeys, key)
	}

	switch {
	case schema.Value.Type.Is("array"):
		paramArr, ok := deepGet(params, mapKeys...)
		if !ok {
			return nil, nil
		}
		t, isMap := paramArr.(map[string]any)
		if !isMap {
			return nil, &ParseError{path: pathFromKeys(mapKeys), Kind: KindInvalidFormat, Reason: "array items must be set with indexes"}
		}
		// intermediate arrays have to be instantiated
		arr, err := sliceMapToSlice(t)
		if err != nil {
			return nil, &ParseError{path: pathFromKeys(mapKeys), Kind: KindInvalidFormat, Reason: fmt.Sprintf("could not convert value map to array: %v", err)}
		}
		resultArr := make([]any /*not 0,*/, len(arr))
		for i := range arr {
			r, err := buildResObj(params, mapKeys, strconv.Itoa(i), schema.Value.Items)
			if err != nil {
				return nil, err
			}
			if r != nil {
				resultArr[i] = r
			}
		}
		return resultArr, nil
	case schema.Value.Type.Is("object"):
		resultMap := make(map[string]any)
		additPropsSchema := schema.Value.AdditionalProperties.Schema
		pp, _ := deepGet(params, mapKeys...)
		objectParams, ok := pp.(map[string]any)
		if !ok {
			// not the expected type, but return it either way and leave validation up to ValidateParameter
			return pp, nil
		}
		for k, propSchema := range schema.Value.Properties {
			r, err := buildResObj(params, mapKeys, k, propSchema)
			if err != nil {
				return nil, err
			}
			if r != nil {
				resultMap[k] = r
			}
		}
		if additPropsSchema != nil {
			// dynamic creation of possibly nested objects
			for k := range objectParams {
				r, err := buildResObj(params, mapKeys, k, additPropsSchema)
				if err != nil {
					return nil, err
				}
				if r != nil {
					resultMap[k] = r
				}
			}
		}

		return resultMap, nil
	case len(schema.Value.AnyOf) > 0:
		return buildFromSchemas(schema.Value.AnyOf, params, parentKeys, key)
	case len(schema.Value.OneOf) > 0:
		return buildFromSchemas(schema.Value.OneOf, params, parentKeys, key)
	case len(schema.Value.AllOf) > 0:
		return buildFromSchemas(schema.Value.AllOf, params, parentKeys, key)
	default:
		val, ok := deepGet(params, mapKeys...)
		if !ok {
			// leave validation up to ValidateParameter. here there really is not parameter set
			return nil, nil
		}
		v, ok := val.(string)
		if !ok {
			return nil, &ParseError{path: pathFromKeys(mapKeys), Kind: KindInvalidFormat, Value: val, Reason: "path is not convertible to primitive"}
		}
		prim, err := parsePrimitive(v, schema)
		if err != nil {
			return nil, handlePropParseError(mapKeys, err)
		}

		return prim, nil
	}
}

// buildFromSchemas decodes params with anyOf, oneOf, allOf schemas.
func buildFromSchemas(schemas openapi3.SchemaRefs, params map[string]any, mapKeys []string, key string) (any, error) {
	resultMap := make(map[string]any)
	for _, s := range schemas {
		val, err := buildResObj(params, mapKeys, key, s)
		if err == nil && val != nil {

			if m, ok := val.(map[string]any); ok {
				for k, v := range m {
					resultMap[k] = v
				}
				continue
			}

			if a, ok := val.([]any); ok {
				if len(a) > 0 {
					return a, nil
				}
				continue
			}

			// if its a primitive and not nil just return that and let it be validated
			return val, nil
		}
	}

	if len(resultMap) > 0 {
		return resultMap, nil
	}

	return nil, nil
}

func handlePropParseError(path []string, err error) error {
	if v, ok := err.(*ParseError); ok {
		return &ParseError{path: pathFromKeys(path), Cause: v}
	}
	return fmt.Errorf("property %q: %w", strings.Join(path, "."), err)
}

func pathFromKeys(kk []string) []any {
	path := make([]any, 0, len(kk))
	for _, v := range kk {
		path = append(path, v)
	}
	return path
}

// parseArray returns an array that contains items from a raw array.
// Every item is parsed as a primitive value.
// The function returns an error when an error happened while parse array's items.
func parseArray(raw []string, schemaRef *openapi3.SchemaRef) ([]any, error) {
	var value []any
	for i, v := range raw {
		item, err := parsePrimitive(v, schemaRef.Value.Items)
		if err != nil {
			if v, ok := err.(*ParseError); ok {
				return nil, &ParseError{path: []any{i}, Cause: v}
			}
			return nil, fmt.Errorf("item %d: %w", i, err)
		}

		// If the items are nil, then the array is nil. There shouldn't be case where some values are actual primitive
		// values and some are nil values.
		if item == nil {
			return nil, nil
		}
		value = append(value, item)
	}
	return value, nil
}

// parsePrimitive returns a value that is created by parsing a source string to a primitive type
// that is specified by a schema. The function returns nil when the source string is empty.
// The function panics when a schema has a non-primitive type.
func parsePrimitive(raw string, schema *openapi3.SchemaRef) (v any, err error) {
	if raw == "" {
		return nil, nil
	}
	for _, typ := range schema.Value.Type.Slice() {
		if v, err = parsePrimitiveCase(raw, schema, typ); err == nil {
			return
		}
	}
	return
}

func parsePrimitiveCase(raw string, schema *openapi3.SchemaRef, typ string) (any, error) {
	switch typ {
	case "integer":
		if schema.Value.Format == "int32" {
			v, err := strconv.ParseInt(raw, 0, 32)
			if err != nil {
				return nil, &ParseError{Kind: KindInvalidFormat, Value: raw, Reason: "an invalid " + typ, Cause: err.(*strconv.NumError).Err}
			}
			return int32(v), nil
		}
		v, err := strconv.ParseInt(raw, 0, 64)
		if err != nil {
			return nil, &ParseError{Kind: KindInvalidFormat, Value: raw, Reason: "an invalid " + typ, Cause: err.(*strconv.NumError).Err}
		}
		return v, nil
	case "number":
		v, err := strconv.ParseFloat(raw, 64)
		if err != nil {
			return nil, &ParseError{Kind: KindInvalidFormat, Value: raw, Reason: "an invalid " + typ, Cause: err.(*strconv.NumError).Err}
		}
		return v, nil
	case "boolean":
		v, err := strconv.ParseBool(raw)
		if err != nil {
			return nil, &ParseError{Kind: KindInvalidFormat, Value: raw, Reason: "an invalid " + typ, Cause: err.(*strconv.NumError).Err}
		}
		return v, nil
	case "string":
		return raw, nil
	default:
		return nil, &ParseError{Kind: KindOther, Value: raw, Reason: "schema has non primitive type " + typ}
	}
}

// EncodingFn is a function that returns an encoding of a request body's part.
type EncodingFn func(partName string) *openapi3.Encoding

// BodyDecoder is an interface to decode a body of a request or response.
// An implementation must return a value that is a primitive, []any, or map[string]any.
type BodyDecoder func(io.Reader, http.Header, *openapi3.SchemaRef, EncodingFn) (any, error)

// bodyDecoders contains decoders for supported content types of a body.
// By default, there is content type "application/json" is supported only.
var bodyDecoders = make(map[string]BodyDecoder)

// RegisteredBodyDecoder returns the registered body decoder for the given content type.
//
// If no decoder was registered for the given content type, nil is returned.
// This call is not thread-safe: body decoders should not be created/destroyed by multiple goroutines.
func RegisteredBodyDecoder(contentType string) BodyDecoder {
	return bodyDecoders[contentType]
}

// RegisterBodyDecoder registers a request body's decoder for a content type.
//
// If a decoder for the specified content type already exists, the function replaces
// it with the specified decoder.
// This call is not thread-safe: body decoders should not be created/destroyed by multiple goroutines.
func RegisterBodyDecoder(contentType string, decoder BodyDecoder) {
	if contentType == "" {
		panic("contentType is empty")
	}
	if decoder == nil {
		panic("decoder is not defined")
	}
	bodyDecoders[contentType] = decoder
}

// UnregisterBodyDecoder dissociates a body decoder from a content type.
//
// Decoding this content type will result in an error.
// This call is not thread-safe: body decoders should not be created/destroyed by multiple goroutines.
func UnregisterBodyDecoder(contentType string) {
	if contentType == "" {
		panic("contentType is empty")
	}
	delete(bodyDecoders, contentType)
}

var headerCT = http.CanonicalHeaderKey("Content-Type")

const prefixUnsupportedCT = "unsupported content type"

// decodeBody returns a decoded body.
// The function returns ParseError when a body is invalid.
func decodeBody(body io.Reader, header http.Header, schema *openapi3.SchemaRef, encFn EncodingFn) (
	string,
	any,
	error,
) {
	contentType := header.Get(headerCT)
	if contentType == "" {
		if _, ok := body.(*multipart.Part); ok {
			contentType = "text/plain"
		}
	}
	mediaType := parseMediaType(contentType)
	decoder, ok := bodyDecoders[mediaType]
	if !ok {
		return "", nil, &ParseError{
			Kind:   KindUnsupportedFormat,
			Reason: fmt.Sprintf("%s %q", prefixUnsupportedCT, mediaType),
		}
	}
	value, err := decoder(body, header, schema, encFn)
	if err != nil {
		return "", nil, err
	}
	return mediaType, value, nil
}

func init() {
	RegisterBodyDecoder("application/json", JSONBodyDecoder)
	RegisterBodyDecoder("application/json-patch+json", JSONBodyDecoder)
	RegisterBodyDecoder("application/ld+json", JSONBodyDecoder)
	RegisterBodyDecoder("application/hal+json", JSONBodyDecoder)
	RegisterBodyDecoder("application/vnd.api+json", JSONBodyDecoder)
	RegisterBodyDecoder("application/octet-stream", FileBodyDecoder)
	RegisterBodyDecoder("application/problem+json", JSONBodyDecoder)
	RegisterBodyDecoder("application/x-www-form-urlencoded", UrlencodedBodyDecoder)
	RegisterBodyDecoder("application/x-yaml", YamlBodyDecoder)
	RegisterBodyDecoder("application/yaml", YamlBodyDecoder)
	RegisterBodyDecoder("multipart/form-data", MultipartBodyDecoder)
	RegisterBodyDecoder("text/csv", CsvBodyDecoder)
	RegisterBodyDecoder("text/plain", PlainBodyDecoder)
}

func PlainBodyDecoder(body io.Reader, header http.Header, schema *openapi3.SchemaRef, encFn EncodingFn) (any, error) {
	data, err := io.ReadAll(body)
	if err != nil {
		return nil, &ParseError{Kind: KindInvalidFormat, Cause: err}
	}
	return string(data), nil
}

// JSONBodyDecoder decodes a JSON formatted body. It is public so that is easy
// to register additional JSON based formats.
func JSONBodyDecoder(body io.Reader, header http.Header, schema *openapi3.SchemaRef, encFn EncodingFn) (any, error) {
	var value any
	dec := json.NewDecoder(body)
	dec.UseNumber()
	if err := dec.Decode(&value); err != nil {
		return nil, &ParseError{Kind: KindInvalidFormat, Cause: err}
	}
	return value, nil
}

func YamlBodyDecoder(body io.Reader, header http.Header, schema *openapi3.SchemaRef, encFn EncodingFn) (any, error) {
	var value any
	if err := yaml.NewDecoder(body).Decode(&value); err != nil {
		return nil, &ParseError{Kind: KindInvalidFormat, Cause: err}
	}
	return value, nil
}

func UrlencodedBodyDecoder(body io.Reader, header http.Header, schema *openapi3.SchemaRef, encFn EncodingFn) (any, error) {
	// Validate schema of request body.
	// By the OpenAPI 3 specification request body's schema must have type "object".
	// Properties of the schema describes individual parts of request body.
	if !schema.Value.Type.Is("object") {
		return nil, errors.New("unsupported schema of request body")
	}
	for propName, propSchema := range schema.Value.Properties {
		propType := propSchema.Value.Type
		switch {
		case propType.Is("object"):
			return nil, fmt.Errorf("unsupported schema of request body's property %q", propName)
		case propType.Is("array"):
			items := propSchema.Value.Items.Value
			if !(items.Type.Is("string") || items.Type.Is("integer") || items.Type.Is("number") || items.Type.Is("boolean")) {
				return nil, fmt.Errorf("unsupported schema of request body's property %q", propName)
			}
		}
	}

	// Parse form.
	b, err := io.ReadAll(body)
	if err != nil {
		return nil, err
	}
	values, err := url.ParseQuery(string(b))
	if err != nil {
		return nil, err
	}

	// Make an object value from form values.
	obj := make(map[string]any)
	dec := &urlValuesDecoder{values: values}

	if err := decodeSchemaConstructs(dec, []*openapi3.SchemaRef{schema}, obj, encFn); err != nil {
		return nil, err
	}

	return obj, nil
}

// decodeSchemaConstructs tries to decode properties based on provided schemas.
// This function is for decoding purposes only and not for validation.
func decodeSchemaConstructs(dec *urlValuesDecoder, schemas []*openapi3.SchemaRef, obj map[string]any, encFn EncodingFn) error {
	for _, schemaRef := range schemas {

		// Decode schema constructs (allOf, anyOf, oneOf)
		if err := decodeSchemaConstructs(dec, schemaRef.Value.AllOf, obj, encFn); err != nil {
			return err
		}
		if err := decodeSchemaConstructs(dec, schemaRef.Value.AnyOf, obj, encFn); err != nil {
			return err
		}
		if err := decodeSchemaConstructs(dec, schemaRef.Value.OneOf, obj, encFn); err != nil {
			return err
		}

		for name, prop := range schemaRef.Value.Properties {
			value, _, err := decodeProperty(dec, name, prop, encFn)
			if err != nil {
				continue
			}
			if existingValue, exists := obj[name]; exists && !isEqual(existingValue, value) {
				return fmt.Errorf("conflicting values for property %q", name)
			}
			obj[name] = value
		}
	}

	return nil
}

func isEqual(value1, value2 any) bool {
	return reflect.DeepEqual(value1, value2)
}

func decodeProperty(dec valueDecoder, name string, prop *openapi3.SchemaRef, encFn EncodingFn) (any, bool, error) {
	var enc *openapi3.Encoding
	if encFn != nil {
		enc = encFn(name)
	}
	sm := enc.SerializationMethod()
	return decodeValue(dec, name, sm, prop, false)
}

func MultipartBodyDecoder(body io.Reader, header http.Header, schema *openapi3.SchemaRef, encFn EncodingFn) (any, error) {
	if !schema.Value.Type.Is("object") {
		return nil, errors.New("unsupported schema of request body")
	}

	// Parse form.
	values := make(map[string][]any)
	contentType := header.Get(headerCT)
	_, params, err := mime.ParseMediaType(contentType)
	if err != nil {
		return nil, err
	}
	mr := multipart.NewReader(body, params["boundary"])
	for {
		var part *multipart.Part
		if part, err = mr.NextPart(); err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}

		var (
			name = part.FormName()
			enc  *openapi3.Encoding
		)
		if encFn != nil {
			enc = encFn(name)
		}
		subEncFn := func(string) *openapi3.Encoding { return enc }

		var valueSchema *openapi3.SchemaRef
		if len(schema.Value.AllOf) > 0 {
			var exists bool
			for _, sr := range schema.Value.AllOf {
				if valueSchema, exists = sr.Value.Properties[name]; exists {
					break
				}
			}
			if !exists {
				return nil, &ParseError{Kind: KindOther, Cause: fmt.Errorf("part %s: undefined", name)}
			}
		} else {
			// If the property's schema has type "array" it is means that the form contains a few parts with the same name.
			// Every such part has a type that is defined by an items schema in the property's schema.
			var exists bool
			if valueSchema, exists = schema.Value.Properties[name]; !exists {
				if anyProperties := schema.Value.AdditionalProperties.Has; anyProperties != nil {
					switch *anyProperties {
					case true:
						// additionalProperties: true
						continue
					default:
						// additionalProperties: false
						return nil, &ParseError{Kind: KindOther, Cause: fmt.Errorf("part %s: undefined", name)}
					}
				}
				if schema.Value.AdditionalProperties.Schema == nil {
					return nil, &ParseError{Kind: KindOther, Cause: fmt.Errorf("part %s: undefined", name)}
				}
				if valueSchema, exists = schema.Value.AdditionalProperties.Schema.Value.Properties[name]; !exists {
					return nil, &ParseError{Kind: KindOther, Cause: fmt.Errorf("part %s: undefined", name)}
				}
			}
			if valueSchema.Value.Type.Is("array") {
				valueSchema = valueSchema.Value.Items
			}
		}

		var value any
		if _, value, err = decodeBody(part, http.Header(part.Header), valueSchema, subEncFn); err != nil {
			if v, ok := err.(*ParseError); ok {
				return nil, &ParseError{path: []any{name}, Cause: v}
			}
			return nil, fmt.Errorf("part %s: %w", name, err)
		}
		values[name] = append(values[name], value)
	}

	allTheProperties := make(map[string]*openapi3.SchemaRef)
	if len(schema.Value.AllOf) > 0 {
		for _, sr := range schema.Value.AllOf {
			for k, v := range sr.Value.Properties {
				allTheProperties[k] = v
			}
			if addProps := sr.Value.AdditionalProperties.Schema; addProps != nil {
				for k, v := range addProps.Value.Properties {
					allTheProperties[k] = v
				}
			}
		}
	} else {
		for k, v := range schema.Value.Properties {
			allTheProperties[k] = v
		}
		if addProps := schema.Value.AdditionalProperties.Schema; addProps != nil {
			for k, v := range addProps.Value.Properties {
				allTheProperties[k] = v
			}
		}
	}

	// Make an object value from form values.
	obj := make(map[string]any)
	for name, prop := range allTheProperties {
		vv := values[name]
		if len(vv) == 0 {
			continue
		}
		if prop.Value.Type.Is("array") {
			obj[name] = vv
		} else {
			obj[name] = vv[0]
		}
	}

	return obj, nil
}

// FileBodyDecoder is a body decoder that decodes a file body to a string.
func FileBodyDecoder(body io.Reader, header http.Header, schema *openapi3.SchemaRef, encFn EncodingFn) (any, error) {
	data, err := io.ReadAll(body)
	if err != nil {
		return nil, err
	}
	return string(data), nil
}

// ZipFileBodyDecoder is a body decoder that decodes a zip file body to a string.
// Use with caution as this implementation may be susceptible to a zip bomb attack.
func ZipFileBodyDecoder(body io.Reader, header http.Header, schema *openapi3.SchemaRef, encFn EncodingFn) (any, error) {
	buff := bytes.NewBuffer([]byte{})
	size, err := io.Copy(buff, body)
	if err != nil {
		return nil, err
	}

	zr, err := zip.NewReader(bytes.NewReader(buff.Bytes()), size)
	if err != nil {
		return nil, err
	}

	const bufferSize = 256
	content := make([]byte, 0, bufferSize*len(zr.File))
	buffer := make([]byte /*0,*/, bufferSize)

	for _, f := range zr.File {
		err := func() error {
			rc, err := f.Open()
			if err != nil {
				return err
			}
			defer func() {
				_ = rc.Close()
			}()

			for {
				n, err := rc.Read(buffer)
				if 0 < n {
					content = append(content, buffer...)
				}
				if err == io.EOF {
					break
				}
				if err != nil {
					return err
				}
			}

			return nil
		}()
		if err != nil {
			return nil, err
		}
	}

	return string(content), nil
}

// CsvBodyDecoder is a body decoder that decodes a csv body to a string.
func CsvBodyDecoder(body io.Reader, header http.Header, schema *openapi3.SchemaRef, encFn EncodingFn) (any, error) {
	r := csv.NewReader(body)

	var sb strings.Builder
	for {
		record, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}

		sb.WriteString(strings.Join(record, ","))
		sb.WriteString("\n")
	}

	return sb.String(), nil
}
