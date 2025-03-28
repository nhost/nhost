package clientv2

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"reflect"
	"strconv"
	"strings"

	"github.com/99designs/gqlgen/graphql"
	"github.com/Yamashou/gqlgenc/graphqljson"
	"github.com/vektah/gqlparser/v2/gqlerror"
)

type HttpClient interface {
	Do(req *http.Request) (*http.Response, error)
	Post(url, contentType string, body io.Reader) (*http.Response, error)
}

type GQLRequestInfo struct {
	Request *Request
}

func NewGQLRequestInfo(r *Request) *GQLRequestInfo {
	return &GQLRequestInfo{
		Request: r,
	}
}

type RequestInterceptorFunc func(ctx context.Context, req *http.Request, gqlInfo *GQLRequestInfo, res any) error

type RequestInterceptor func(ctx context.Context, req *http.Request, gqlInfo *GQLRequestInfo, res any, next RequestInterceptorFunc) error

func ChainInterceptor(interceptors ...RequestInterceptor) RequestInterceptor {
	n := len(interceptors)

	return func(ctx context.Context, req *http.Request, gqlInfo *GQLRequestInfo, res any, next RequestInterceptorFunc) error {
		chainer := func(currentInter RequestInterceptor, currentFunc RequestInterceptorFunc) RequestInterceptorFunc {
			return func(currentCtx context.Context, currentReq *http.Request, currentGqlInfo *GQLRequestInfo, currentRes any) error {
				return currentInter(currentCtx, currentReq, currentGqlInfo, currentRes, currentFunc)
			}
		}

		chainedHandler := next
		for i := n - 1; i >= 0; i-- {
			chainedHandler = chainer(interceptors[i], chainedHandler)
		}

		return chainedHandler(ctx, req, gqlInfo, res)
	}
}

func UnsafeChainInterceptor(interceptors ...RequestInterceptor) RequestInterceptor {
	n := len(interceptors)

	return func(ctx context.Context, req *http.Request, gqlInfo *GQLRequestInfo, res any, next RequestInterceptorFunc) error {
		chainer := func(currentInter RequestInterceptor, currentFunc RequestInterceptorFunc) RequestInterceptorFunc {
			return func(currentCtx context.Context, currentReq *http.Request, currentGqlInfo *GQLRequestInfo, currentRes any) error {
				return currentInter(currentCtx, currentReq, currentGqlInfo, currentRes, func(nextCtx context.Context, nextReq *http.Request, nextGqlInfo *GQLRequestInfo, nextRes any) error {
					return currentFunc(nextCtx, nextReq, nextGqlInfo, nextRes)
				})
			}
		}

		chainedHandler := next
		for i := n - 1; i >= 0; i-- {
			chainedHandler = chainer(interceptors[i], chainedHandler)
		}

		return chainedHandler(ctx, req, gqlInfo, res)
	}
}

// Client is the http client wrapper
type Client struct {
	Client                     HttpClient
	BaseURL                    string
	RequestInterceptor         RequestInterceptor
	CustomDo                   RequestInterceptorFunc
	ParseDataWhenErrors        bool
	IsUnsafeRequestInterceptor bool
}

// Request represents an outgoing GraphQL request
type Request struct {
	Query         string         `json:"query"`
	Variables     map[string]any `json:"variables,omitempty"`
	OperationName string         `json:"operationName,omitempty"`
}

// NewClient creates a new http client wrapper
func NewClient(client HttpClient, baseURL string, options *Options, interceptors ...RequestInterceptor) *Client {
	c := &Client{
		Client:  client,
		BaseURL: baseURL,
		RequestInterceptor: ChainInterceptor(append([]RequestInterceptor{func(ctx context.Context, requestSet *http.Request, gqlInfo *GQLRequestInfo, res any, next RequestInterceptorFunc) error {
			return next(ctx, requestSet, gqlInfo, res)
		}}, interceptors...)...),
	}

	if options != nil {
		c.ParseDataWhenErrors = options.ParseDataAlongWithErrors
	}

	return c
}

func NewClientWithUnsafeRequestInterceptor(client HttpClient, baseURL string, options *Options, interceptors ...RequestInterceptor) *Client {
	c := &Client{
		Client:  client,
		BaseURL: baseURL,
		RequestInterceptor: UnsafeChainInterceptor(append([]RequestInterceptor{func(ctx context.Context, requestSet *http.Request, gqlInfo *GQLRequestInfo, res any, next RequestInterceptorFunc) error {
			return next(ctx, requestSet, gqlInfo, res)
		}}, interceptors...)...),
		IsUnsafeRequestInterceptor: true,
	}

	if options != nil {
		c.ParseDataWhenErrors = options.ParseDataAlongWithErrors
	}

	return c
}

// Options is a struct that holds some client-specific options that can be passed to NewClient.
type Options struct {
	// ParseDataAlongWithErrors is a flag that indicates whether the client should try to parse and return the data along with error
	// when error appeared. So in the end you'll get list of gql errors and data.
	ParseDataAlongWithErrors bool
}

// GqlErrorList is the struct of a standard graphql error response
type GqlErrorList struct {
	Errors gqlerror.List `json:"errors"`
}

func (e *GqlErrorList) Error() string {
	return e.Errors.Error()
}

// HTTPError is the error when a GqlErrorList cannot be parsed
type HTTPError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// ErrorResponse represent an handled error
type ErrorResponse struct {
	// populated when http status code is not OK
	NetworkError *HTTPError `json:"networkErrors"`
	// populated when http status code is OK but the server returned at least one graphql error
	GqlErrors *gqlerror.List `json:"graphqlErrors"`
}

// HasErrors returns true when at least one error is declared
func (er *ErrorResponse) HasErrors() bool {
	return er.NetworkError != nil || er.GqlErrors != nil
}

func (er *ErrorResponse) Error() string {
	content, err := json.Marshal(er)
	if err != nil {
		return err.Error()
	}

	return string(content)
}

type MultipartFile struct {
	File  graphql.Upload
	Index int
}

type MultipartFilesGroup struct {
	Files      []MultipartFile
	IsMultiple bool
}

type FormField struct {
	Name  string
	Value any
}

type header struct {
	key, value string
}

// Post support send multipart form with files https://gqlgen.com/reference/file-upload/ https://github.com/jaydenseric/graphql-multipart-request-spec
func (c *Client) Post(ctx context.Context, operationName, query string, respData any, vars map[string]any, interceptors ...RequestInterceptor) error {
	multipartFilesGroups, mapping, vars := parseMultipartFiles(vars)

	r := &Request{
		Query:         query,
		Variables:     vars,
		OperationName: operationName,
	}

	gqlInfo := NewGQLRequestInfo(r)
	body := new(bytes.Buffer)

	var headers []header

	if len(multipartFilesGroups) > 0 {
		contentType, err := prepareMultipartFormBody(
			body,
			[]FormField{
				{
					Name:  "operations",
					Value: r,
				},
				{
					Name:  "map",
					Value: mapping,
				},
			},
			multipartFilesGroups,
		)
		if err != nil {
			return fmt.Errorf("failed to prepare form body: %w", err)
		}

		headers = append(headers, header{key: "Content-Type", value: contentType})
	} else {
		requestBody, err := MarshalJSON(ctx, r)
		if err != nil {
			return fmt.Errorf("encode: %w", err)
		}

		body = bytes.NewBuffer(requestBody)

		headers = append(headers, header{key: "Content-Type", value: "application/json; charset=utf-8"})
		headers = append(headers, header{key: "Accept", value: "application/json; charset=utf-8"})
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL, body)
	if err != nil {
		return fmt.Errorf("create request struct failed: %w", err)
	}

	for _, h := range headers {
		req.Header.Set(h.key, h.value)
	}

	f := ChainInterceptor(append([]RequestInterceptor{c.RequestInterceptor}, interceptors...)...)
	if c.IsUnsafeRequestInterceptor {
		f = UnsafeChainInterceptor(append([]RequestInterceptor{c.RequestInterceptor}, interceptors...)...)
	}

	// if custom do is set, use it instead of the default one
	if c.CustomDo != nil {
		return f(ctx, req, gqlInfo, respData, c.CustomDo)
	}

	return f(ctx, req, gqlInfo, respData, c.do)
}

func parseMultipartFiles(
	vars map[string]any,
) ([]MultipartFilesGroup, map[string][]string, map[string]any) {
	var (
		multipartFilesGroups []MultipartFilesGroup
		mapping              = map[string][]string{}
		i                    = 0
	)

	for k, v := range vars {
		switch item := v.(type) {
		case graphql.Upload:
			iStr := strconv.Itoa(i)
			vars[k] = nil
			mapping[iStr] = []string{fmt.Sprintf("variables.%s", k)}

			multipartFilesGroups = append(multipartFilesGroups, MultipartFilesGroup{
				Files: []MultipartFile{
					{
						Index: i,
						File:  item,
					},
				},
			})

			i++
		case *graphql.Upload:
			// continue if it is empty
			if item == nil {
				continue
			}

			iStr := strconv.Itoa(i)
			vars[k] = nil
			mapping[iStr] = []string{fmt.Sprintf("variables.%s", k)}

			multipartFilesGroups = append(multipartFilesGroups, MultipartFilesGroup{
				Files: []MultipartFile{
					{
						Index: i,
						File:  *item,
					},
				},
			})

			i++
		case []*graphql.Upload:
			vars[k] = make([]struct{}, len(item))
			var groupFiles []MultipartFile

			for itemI, itemV := range item {
				iStr := strconv.Itoa(i)
				mapping[iStr] = []string{fmt.Sprintf("variables.%s.%s", k, strconv.Itoa(itemI))}

				groupFiles = append(groupFiles, MultipartFile{
					Index: i,
					File:  *itemV,
				})

				i++
			}

			multipartFilesGroups = append(multipartFilesGroups, MultipartFilesGroup{
				Files:      groupFiles,
				IsMultiple: true,
			})
		}
	}

	return multipartFilesGroups, mapping, vars
}

func prepareMultipartFormBody(
	buffer *bytes.Buffer, formFields []FormField, files []MultipartFilesGroup,
) (string, error) {
	writer := multipart.NewWriter(buffer)
	defer writer.Close()

	// form fields
	for _, field := range formFields {
		fieldBody, err := json.Marshal(field.Value)
		if err != nil {
			return "", fmt.Errorf("encode %s: %w", field.Name, err)
		}

		err = writer.WriteField(field.Name, string(fieldBody))
		if err != nil {
			return "", fmt.Errorf("write %s: %w", field.Name, err)
		}
	}

	// files
	for _, filesGroup := range files {
		for _, file := range filesGroup.Files {
			part, err := writer.CreateFormFile(strconv.Itoa(file.Index), file.File.Filename)
			if err != nil {
				return "", fmt.Errorf("form file %w", err)
			}

			_, err = io.Copy(part, file.File.File)
			if err != nil {
				return "", fmt.Errorf("copy file %w", err)
			}
		}
	}

	if err := writer.Close(); err != nil {
		return "", fmt.Errorf("writer close %w", err)
	}

	return writer.FormDataContentType(), nil
}

func (c *Client) do(_ context.Context, req *http.Request, _ *GQLRequestInfo, res any) error {
	resp, err := c.Client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.Header.Get("Content-Encoding") == "gzip" {
		resp.Body, err = gzip.NewReader(resp.Body)
		if err != nil {
			return fmt.Errorf("gzip decode failed: %w", err)
		}
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	return c.parseResponse(body, resp.StatusCode, res)
}

func (c *Client) parseResponse(body []byte, httpCode int, result any) error {
	errResponse := &ErrorResponse{}
	isOKCode := httpCode < 200 || 299 < httpCode
	if isOKCode {
		errResponse.NetworkError = &HTTPError{
			Code:    httpCode,
			Message: fmt.Sprintf("Response body %s", string(body)),
		}
	}

	// some servers return a graphql error with a non OK http code, try anyway to parse the body
	if err := c.unmarshal(body, result); err != nil {
		var gqlErr *GqlErrorList
		if errors.As(err, &gqlErr) {
			errResponse.GqlErrors = &gqlErr.Errors
		} else if !isOKCode {
			return err
		}
	}

	if errResponse.HasErrors() {
		return errResponse
	}

	return nil
}

// response is a GraphQL layer response from a handler.
type response struct {
	Data   json.RawMessage `json:"data"`
	Errors json.RawMessage `json:"errors"`
}

func (c *Client) unmarshal(data []byte, res any) error {
	resp := response{}
	if err := json.Unmarshal(data, &resp); err != nil {
		return fmt.Errorf("failed to decode data %s: %w", string(data), err)
	}

	var err error
	if len(resp.Errors) > 0 {
		// try to parse standard graphql error
		err = &GqlErrorList{}
		if e := json.Unmarshal(data, err); e != nil {
			return fmt.Errorf("faild to parse graphql errors. Response content %s - %w", string(data), e)
		}

		// if ParseDataWhenErrors is true, try to parse data as well
		if !c.ParseDataWhenErrors {
			return err
		}
	}

	if errData := graphqljson.UnmarshalData(resp.Data, res); errData != nil {
		// if ParseDataWhenErrors is true, and we failed to unmarshal data, return the actual error
		if c.ParseDataWhenErrors {
			return err
		}

		return fmt.Errorf("failed to decode data into response %s: %w", string(data), errData)
	}

	return err
}

// contextKey is a type for context keys
type contextKey string

const (
	// EnableInputJsonOmitemptyTagKey is a context key for EnableInputJsonOmitemptyTag
	EnableInputJsonOmitemptyTagKey contextKey = "enable_input_json_omitempty_tag"
)

// WithEnableInputJsonOmitemptyTag returns a new context with EnableInputJsonOmitemptyTag value
func WithEnableInputJsonOmitemptyTag(ctx context.Context, enable bool) context.Context {
	return context.WithValue(ctx, EnableInputJsonOmitemptyTagKey, enable)
}

// getEnableInputJsonOmitemptyTagFromContext retrieves the EnableInputJsonOmitemptyTag value from context
func getEnableInputJsonOmitemptyTagFromContext(ctx context.Context) bool {
	enableClientJsonOmitemptyTag := true
	if ctx != nil {
		enable, ok := ctx.Value(EnableInputJsonOmitemptyTagKey).(bool)
		if ok {
			enableClientJsonOmitemptyTag = enable
		}
	}
	return enableClientJsonOmitemptyTag
}

func MarshalJSON(ctx context.Context, v any) ([]byte, error) {
	if v == nil {
		return []byte("null"), nil
	}

	val := reflect.ValueOf(v)
	if !val.IsValid() || (val.Kind() == reflect.Ptr && val.IsNil()) {
		return []byte("null"), nil
	}

	encoder := &Encoder{
		EnableInputJsonOmitemptyTag: getEnableInputJsonOmitemptyTagFromContext(ctx),
	}

	return encoder.Encode(val)
}

func checkImplements[I any](v reflect.Value) bool {
	t := v.Type()
	interfaceType := reflect.TypeOf((*I)(nil)).Elem()

	return t.Implements(interfaceType) || (t.Kind() == reflect.Ptr && reflect.PointerTo(t).Implements(interfaceType))
}

// Encoder is a struct for encoding GraphQL requests to JSON
type Encoder struct {
	EnableInputJsonOmitemptyTag bool
}

// fieldInfo holds field information of a struct
type fieldInfo struct {
	name      string       // field name
	jsonName  string       // field name in JSON
	omitempty bool         // omitempty flag
	typ       reflect.Type // field type
}

// Encode encodes any value to JSON
func (e *Encoder) Encode(v reflect.Value) ([]byte, error) {
	if !v.IsValid() || (v.Kind() == reflect.Ptr && v.IsNil()) {
		return []byte("null"), nil
	}

	if checkImplements[graphql.Marshaler](v) {
		return e.encodeGQLMarshaler(v.Interface())
	}

	if checkImplements[json.Marshaler](v) {
		return e.encodeJsonMarshaler(v.Interface())
	}

	if checkImplements[encoding.TextMarshaler](v) {
		return e.encodeTextMarshaler(v.Interface())
	}

	t := v.Type()

	switch t.Kind() {
	case reflect.Ptr:
		return e.encodePtr(v)
	case reflect.Struct:
		return e.encodeStruct(v)
	case reflect.Map:
		return e.encodeMap(v)
	case reflect.Slice:
		return e.encodeSlice(v)
	case reflect.Array:
		return e.encodeArray(v)
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return e.encodeInt(v)
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
		return e.encodeUint(v)
	case reflect.String:
		return e.encodeString(v)
	case reflect.Bool:
		return e.encodeBool(v)
	case reflect.Float32, reflect.Float64:
		return e.encodeFloat(v)
	case reflect.Interface:
		return e.encodeInterface(v)
	case reflect.Invalid, reflect.Complex64, reflect.Complex128, reflect.Chan, reflect.Func, reflect.UnsafePointer:
		panic(fmt.Sprintf("unsupported type: %s", t))
	default:
		panic(fmt.Sprintf("unsupported type: %s", t))
	}
}

// encodeGQLMarshaler encodes a value that implements graphql.Marshaler interface
func (e *Encoder) encodeGQLMarshaler(v any) ([]byte, error) {
	if v == nil {
		return []byte("null"), nil
	}

	var buf bytes.Buffer
	if val, ok := v.(graphql.Marshaler); ok {
		val.MarshalGQL(&buf)
	} else {
		return nil, fmt.Errorf("failed to encode graphql.Marshaler: %v", v)
	}

	return buf.Bytes(), nil
}

// encodeJsonMarshaler encodes a value that implements json.Marshaler interface
func (e *Encoder) encodeJsonMarshaler(v any) ([]byte, error) {
	if val, ok := v.(json.Marshaler); ok {
		return val.MarshalJSON()
	}
	return nil, fmt.Errorf("failed to encode json.Marshaler: %v", v)
}

// encodeTextMarshaler encodes a value that implements encoding.TextMarshaler interface
func (e *Encoder) encodeTextMarshaler(v any) ([]byte, error) {
	if _, ok := v.(encoding.TextMarshaler); ok {
		return json.Marshal(v)
	}
	return nil, fmt.Errorf("failed to encode encoding.TextMarshaler: %v", v)
}

// encodeBool encodes a boolean value
func (e *Encoder) encodeBool(v reflect.Value) ([]byte, error) {
	boolValue, err := json.Marshal(v.Bool())
	if err != nil {
		return nil, fmt.Errorf("failed to encode bool: %v", v)
	}
	return boolValue, nil
}

// encodeInt encodes an integer value
func (e *Encoder) encodeInt(v reflect.Value) ([]byte, error) {
	return []byte(fmt.Sprintf("%d", v.Int())), nil
}

// encodeUint encodes an unsigned integer value
func (e *Encoder) encodeUint(v reflect.Value) ([]byte, error) {
	return []byte(fmt.Sprintf("%d", v.Uint())), nil
}

// encodeFloat encodes a floating-point value
func (e *Encoder) encodeFloat(v reflect.Value) ([]byte, error) {
	return []byte(fmt.Sprintf("%f", v.Float())), nil
}

// encodeString encodes a string value
func (e *Encoder) encodeString(v reflect.Value) ([]byte, error) {
	stringValue, err := json.Marshal(v.String())
	if err != nil {
		return nil, fmt.Errorf("failed to encode string: %v", v)
	}
	return stringValue, nil
}

// trimQuotes removes double quotes from the beginning and end of a string
func (e *Encoder) trimQuotes(s string) string {
	if len(s) > 1 && s[0] == '"' && s[len(s)-1] == '"' {
		return s[1 : len(s)-1]
	}
	return s
}

func (e *Encoder) isSkipOmitemptyField(v reflect.Value, field fieldInfo) bool {
	if !e.EnableInputJsonOmitemptyTag {
		return false
	}

	if !field.omitempty {
		return false
	}

	if !v.IsValid() {
		return true
	}

	if v.Kind() == reflect.Ptr && v.IsNil() {
		return true
	}

	return v.IsZero()
}

// encodeStruct encodes a struct value
func (e *Encoder) encodeStruct(v reflect.Value) ([]byte, error) {
	fields := e.prepareFields(v.Type())
	result := make(map[string]json.RawMessage)
	for _, field := range fields {
		fieldValue := v.FieldByName(field.name)
		if e.isSkipOmitemptyField(fieldValue, field) {
			continue
		}

		encodedValue, err := e.Encode(fieldValue)
		if err != nil {
			return nil, err
		}
		result[field.jsonName] = encodedValue
	}
	return json.Marshal(result)
}

// encodeMap encodes a map value
func (e *Encoder) encodeMap(v reflect.Value) ([]byte, error) {
	if v.IsNil() {
		return []byte("null"), nil
	}

	result := make(map[string]json.RawMessage)
	for _, key := range v.MapKeys() {
		encodedKey, err := e.Encode(key)
		if err != nil {
			return nil, err
		}
		keyStr := string(encodedKey)
		keyStr = e.trimQuotes(keyStr)

		value := v.MapIndex(key)
		encodedValue, err := e.Encode(value)
		if err != nil {
			return nil, err
		}
		result[keyStr] = encodedValue
	}
	return json.Marshal(result)
}

// encodeSlice encodes a slice value
func (e *Encoder) encodeSlice(v reflect.Value) ([]byte, error) {
	if v.IsNil() {
		return []byte("null"), nil
	}

	result := make([]json.RawMessage, v.Len())
	for i := range v.Len() {
		encodedValue, err := e.Encode(v.Index(i))
		if err != nil {
			return nil, err
		}
		result[i] = encodedValue
	}
	return json.Marshal(result)
}

// encodeArray encodes an array value
func (e *Encoder) encodeArray(v reflect.Value) ([]byte, error) {
	result := make([]json.RawMessage, v.Len())
	for i := range v.Len() {
		encodedValue, err := e.Encode(v.Index(i))
		if err != nil {
			return nil, err
		}
		result[i] = encodedValue
	}
	return json.Marshal(result)
}

// encodePtr encodes a pointer value
func (e *Encoder) encodePtr(v reflect.Value) ([]byte, error) {
	if v.IsNil() {
		return []byte("null"), nil
	}
	return e.Encode(v.Elem())
}

// encodeInterface encodes an interface value
func (e *Encoder) encodeInterface(v reflect.Value) ([]byte, error) {
	if v.IsNil() {
		return []byte("null"), nil
	}
	return e.Encode(v.Elem())
}

// prepareFields collects field information from a struct type
func (e *Encoder) prepareFields(t reflect.Type) []fieldInfo {
	num := t.NumField()
	fields := make([]fieldInfo, 0, num)
	for i := range num {
		f := t.Field(i)
		if f.PkgPath != "" && !f.Anonymous {
			continue
		}
		jsonTag := f.Tag.Get("json")
		if jsonTag == "-" {
			continue
		}

		jsonName := f.Name
		if jsonTag != "" {
			parts := strings.Split(jsonTag, ",")
			jsonName = parts[0]
		}

		fi := fieldInfo{
			name:     f.Name,
			jsonName: jsonName,
			typ:      f.Type,
		}

		if strings.Contains(jsonTag, "omitempty") {
			fi.omitempty = true
		}

		fields = append(fields, fi)
	}

	return fields
}
