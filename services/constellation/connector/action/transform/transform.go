//nolint:cyclop,err113,funlen,mnd,nilnil // dynamic metadata diagnostics; nil means optional section absent
package transform

import (
	"bytes"
	json "encoding/json/v2"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"

	"golang.org/x/net/http/httpguts"
)

const (
	contentTypeJSON           = "application/json"
	contentTypeFormURLEncoded = "application/x-www-form-urlencoded"
	templateEngineKriti       = "Kriti"
	// nullRenderedString is what a null interpolation renders to in a
	// quote-wrapped string-context template. Hasura drops query params and form
	// fields whose rendered value equals this literal (QueryParams: `value ==
	// Just "null"`; Body.foldFormEncoded: `v /= "null"`). Headers are NOT dropped.
	nullRenderedString = "null"
)

var transformHeadersBlocked = map[string]struct{}{ //nolint:gochecknoglobals
	"Connection":        {},
	"Content-Length":    {},
	"Host":              {},
	"Transfer-Encoding": {},
	"Upgrade":           {},
}

var errRenderedTemplateEmpty = errors.New("rendered template is empty")

// RequestContext contains the values visible to an action request transform.
type RequestContext struct {
	Body             any
	BaseURL          string
	SessionVariables map[string]any
}

// ResponseContext contains the values visible to an action response transform.
type ResponseContext struct {
	BaseURL          string
	SessionVariables map[string]any
	Status           int
	Headers          http.Header
}

// OutgoingRequest is the mutable HTTP request model transformed before dispatch.
type OutgoingRequest struct {
	Method string
	URL    string
	Header http.Header
	Body   []byte
}

// Request is a compiled Hasura Action request transform.
type Request struct {
	method      string
	url         *template
	contentType string
	headers     *headerTransform
	queryParams *queryParamsTransform
	body        *requestBodyTransform
}

// Response is a compiled Hasura Action response transform.
type Response struct {
	body *responseBodyTransform
}

type headerTransform struct {
	remove []string
	add    map[string]*template
}

type queryParamsTransform struct {
	raw    *template
	values map[string]*template
}

type requestBodyTransform struct {
	action       bodyAction
	template     *template
	formTemplate map[string]*template
}

type responseBodyTransform struct {
	template *template
}

type bodyAction string

const (
	bodyActionTransform      bodyAction = "transform"
	bodyActionRemove         bodyAction = "remove"
	bodyActionFormURLEncoded bodyAction = "x_www_form_urlencoded"
)

// CompileRequest validates and compiles a Hasura Action request_transform map.
func CompileRequest(raw map[string]any) (*Request, error) {
	if len(raw) == 0 {
		return nil, nil
	}

	if err := rejectUnknownKeys(raw, map[string]struct{}{
		"version":         {},
		"method":          {},
		"url":             {},
		"content_type":    {},
		"request_headers": {},
		"query_params":    {},
		"template_engine": {},
		"body":            {},
	}); err != nil {
		return nil, err
	}

	if err := validateTemplateEngine(raw["template_engine"]); err != nil {
		return nil, err
	}

	version, err := optionalVersion(raw["version"], 1)
	if err != nil {
		return nil, fmt.Errorf("invalid request transform version: %w", err)
	}

	if version != 1 && version != 2 {
		return nil, fmt.Errorf("unsupported request transform version %d", version)
	}

	request := &Request{
		method:      "",
		url:         nil,
		contentType: "",
		headers:     nil,
		queryParams: nil,
		body:        nil,
	}
	if method, ok, err := optionalString(raw["method"]); err != nil {
		return nil, fmt.Errorf("invalid request method: %w", err)
	} else if ok {
		if !allowedMethod(method) {
			return nil, fmt.Errorf("unsupported request method %q", method)
		}

		request.method = method
	}

	if rawURL, ok, err := optionalString(raw["url"]); err != nil {
		return nil, fmt.Errorf("invalid request URL template: %w", err)
	} else if ok {
		compiled, err := compileStringTemplate(rawURL)
		if err != nil {
			return nil, fmt.Errorf("compiling request URL template: %w", err)
		}

		request.url = compiled
	}

	if contentType, ok, err := optionalString(raw["content_type"]); err != nil {
		return nil, fmt.Errorf("invalid content_type: %w", err)
	} else if ok {
		switch strings.ToLower(contentType) {
		case contentTypeJSON:
			request.contentType = contentTypeJSON
		case contentTypeFormURLEncoded:
			request.contentType = contentTypeFormURLEncoded
		default:
			return nil, fmt.Errorf("unsupported content_type %q", contentType)
		}
	}

	headers, err := compileHeaderTransform(raw["request_headers"])
	if err != nil {
		return nil, fmt.Errorf("compiling request_headers: %w", err)
	}

	request.headers = headers

	queryParams, err := compileQueryParams(raw["query_params"])
	if err != nil {
		return nil, fmt.Errorf("compiling query_params: %w", err)
	}

	request.queryParams = queryParams

	body, err := compileRequestBody(raw["body"], version)
	if err != nil {
		return nil, fmt.Errorf("compiling request body: %w", err)
	}

	request.body = body

	return request, nil
}

// CompileResponse validates and compiles a Hasura Action response_transform map.
func CompileResponse(raw map[string]any) (*Response, error) {
	if len(raw) == 0 {
		return nil, nil
	}

	if err := rejectUnknownKeys(raw, map[string]struct{}{
		"version":         {},
		"body":            {},
		"template_engine": {},
	}); err != nil {
		return nil, err
	}

	if err := validateTemplateEngine(raw["template_engine"]); err != nil {
		return nil, err
	}

	version, err := optionalVersion(raw["version"], 1)
	if err != nil {
		return nil, fmt.Errorf("invalid response transform version: %w", err)
	}

	if version != 1 && version != 2 {
		return nil, fmt.Errorf("unsupported response transform version %d", version)
	}

	body, err := compileResponseBody(raw["body"], version)
	if err != nil {
		return nil, fmt.Errorf("compiling response body: %w", err)
	}

	return &Response{body: body}, nil
}

// Apply mutates req according to the compiled request transform.
func (r *Request) Apply(ctx RequestContext, req *OutgoingRequest) error {
	if r == nil {
		return nil
	}

	values, err := requestTemplateValues(ctx)
	if err != nil {
		return err
	}

	if r.method != "" {
		req.Method = r.method
	}

	if r.url != nil {
		rendered, err := r.url.renderString(values)
		if err != nil {
			return fmt.Errorf("rendering request URL: %w", err)
		}

		req.URL = rendered
	}

	if r.queryParams != nil {
		if err := r.queryParams.apply(values, req); err != nil {
			return err
		}
	}

	if r.contentType != "" {
		req.Header.Set("Content-Type", r.contentType)
	}

	if r.body != nil {
		if err := r.body.apply(values, req); err != nil {
			return err
		}

		if r.contentType == "" && r.body.action == bodyActionFormURLEncoded {
			req.Header.Set("Content-Type", contentTypeFormURLEncoded)
		}
	}

	if r.headers != nil {
		if err := r.headers.apply(values, req.Header); err != nil {
			return err
		}
	}

	return nil
}

// Apply returns the response body after applying the compiled response transform.
func (r *Response) Apply(ctx ResponseContext, body []byte) ([]byte, error) {
	if r == nil || r.body == nil {
		return body, nil
	}

	var decodedBody any
	if len(bytes.TrimSpace(body)) > 0 {
		if err := json.Unmarshal(body, &decodedBody); err != nil {
			return nil, fmt.Errorf("decoding response body for transform: %w", err)
		}
	}

	values := responseTemplateValues(ctx, decodedBody)

	out, err := r.body.template.renderJSON(values)
	if err != nil {
		return nil, fmt.Errorf("rendering response body: %w", err)
	}

	return out, nil
}

// compileTemplate compiles a JSON-context template (request/response body).
func compileTemplate(source string) (*template, error) {
	compiled, err := parseJSONTemplate(source)
	if err != nil {
		return nil, fmt.Errorf("parsing Kriti template: %w", err)
	}

	return compiled, nil
}

// compileStringTemplate compiles a string-context template (url, header
// values, query params, form fields), which Kriti renders as a quoted string
// literal with interpolation.
func compileStringTemplate(source string) (*template, error) {
	compiled, err := parseStringTemplate(source)
	if err != nil {
		return nil, fmt.Errorf("parsing Kriti template: %w", err)
	}

	return compiled, nil
}

func validateTemplateEngine(raw any) error {
	engine, ok, err := optionalString(raw)
	if err != nil {
		return err
	}

	if ok && engine != templateEngineKriti {
		return fmt.Errorf("unsupported template_engine %q", engine)
	}

	return nil
}

func compileHeaderTransform(raw any) (*headerTransform, error) {
	if raw == nil {
		return nil, nil
	}

	object, ok := raw.(map[string]any)
	if !ok {
		return nil, errors.New("must be an object")
	}

	if err := rejectUnknownKeys(object, map[string]struct{}{
		"add_headers":    {},
		"remove_headers": {},
	}); err != nil {
		return nil, err
	}

	out := &headerTransform{
		remove: nil,
		add:    nil,
	}

	remove, err := optionalStringList(object["remove_headers"])
	if err != nil {
		return nil, fmt.Errorf("invalid remove_headers: %w", err)
	}

	for _, name := range remove {
		if err := validateTransformHeaderName(name); err != nil {
			return nil, fmt.Errorf("invalid remove header name %q: %w", name, err)
		}

		out.remove = append(out.remove, name)
	}

	addHeaders, err := optionalStringTemplateMap(object["add_headers"])
	if err != nil {
		return nil, fmt.Errorf("invalid add_headers: %w", err)
	}

	for name, compiled := range addHeaders {
		if err := validateTransformHeaderName(name); err != nil {
			return nil, fmt.Errorf("invalid add header name %q: %w", name, err)
		}

		if out.add == nil {
			out.add = make(map[string]*template, len(addHeaders))
		}

		out.add[name] = compiled
	}

	if len(out.remove) == 0 && len(out.add) == 0 {
		return nil, nil
	}

	return out, nil
}

func compileQueryParams(raw any) (*queryParamsTransform, error) {
	if raw == nil {
		return nil, nil
	}

	if source, ok := raw.(string); ok {
		compiled, err := compileStringTemplate(source)
		if err != nil {
			return nil, err
		}

		return &queryParamsTransform{raw: compiled, values: nil}, nil
	}

	values, err := optionalStringTemplateMap(raw)
	if err != nil {
		return nil, err
	}

	return &queryParamsTransform{raw: nil, values: values}, nil
}

func compileRequestBody(raw any, version int) (*requestBodyTransform, error) {
	if raw == nil {
		return nil, nil
	}

	if source, ok := raw.(string); ok {
		compiled, err := compileTemplate(source)
		if err != nil {
			return nil, err
		}

		return &requestBodyTransform{
			action:       bodyActionTransform,
			template:     compiled,
			formTemplate: nil,
		}, nil
	}

	if version != 2 {
		return nil, errors.New("object body requires version 2")
	}

	object, ok := raw.(map[string]any)
	if !ok {
		return nil, errors.New("body must be a string or object")
	}

	if err := rejectUnknownKeys(object, map[string]struct{}{
		"action":        {},
		"template":      {},
		"form_template": {},
	}); err != nil {
		return nil, err
	}

	action, ok, err := optionalString(object["action"])
	if err != nil {
		return nil, fmt.Errorf("invalid body action: %w", err)
	}

	if !ok {
		return nil, errors.New("body action is required")
	}

	switch bodyAction(action) {
	case bodyActionRemove:
		return &requestBodyTransform{
			action:       bodyActionRemove,
			template:     nil,
			formTemplate: nil,
		}, nil
	case bodyActionTransform:
		source, ok, err := optionalString(object["template"])
		if err != nil {
			return nil, fmt.Errorf("invalid template: %w", err)
		}

		if !ok {
			return nil, errors.New("template is required for transform body action")
		}

		compiled, err := compileTemplate(source)
		if err != nil {
			return nil, err
		}

		return &requestBodyTransform{
			action:       bodyActionTransform,
			template:     compiled,
			formTemplate: nil,
		}, nil
	case bodyActionFormURLEncoded:
		formTemplate, err := optionalStringTemplateMap(object["form_template"])
		if err != nil {
			return nil, fmt.Errorf("invalid form_template: %w", err)
		}

		if len(formTemplate) == 0 {
			return nil, errors.New(
				"form_template is required for x_www_form_urlencoded body action",
			)
		}

		return &requestBodyTransform{
			action:       bodyActionFormURLEncoded,
			template:     nil,
			formTemplate: formTemplate,
		}, nil
	default:
		return nil, fmt.Errorf("unsupported body action %q", action)
	}
}

func compileResponseBody(raw any, version int) (*responseBodyTransform, error) {
	if raw == nil {
		return nil, nil
	}

	if source, ok := raw.(string); ok {
		compiled, err := compileTemplate(source)
		if err != nil {
			return nil, err
		}

		return &responseBodyTransform{template: compiled}, nil
	}

	if version != 2 {
		return nil, errors.New("object body requires version 2")
	}

	object, ok := raw.(map[string]any)
	if !ok {
		return nil, errors.New("body must be a string or object")
	}

	if err := rejectUnknownKeys(object, map[string]struct{}{
		"action":   {},
		"template": {},
	}); err != nil {
		return nil, err
	}

	action, ok, err := optionalString(object["action"])
	if err != nil {
		return nil, fmt.Errorf("invalid body action: %w", err)
	}

	if !ok {
		return nil, errors.New("body action is required")
	}

	if bodyAction(action) != bodyActionTransform {
		return nil, errors.New("response body only supports transform action")
	}

	source, ok, err := optionalString(object["template"])
	if err != nil {
		return nil, fmt.Errorf("invalid template: %w", err)
	}

	if !ok {
		return nil, errors.New("template is required for response body transform")
	}

	compiled, err := compileTemplate(source)
	if err != nil {
		return nil, err
	}

	return &responseBodyTransform{template: compiled}, nil
}

func (t *queryParamsTransform) apply(values map[string]any, req *OutgoingRequest) error {
	parsed, err := url.Parse(req.URL)
	if err != nil {
		return fmt.Errorf("parsing transformed request URL: %w", err)
	}

	if t.raw != nil {
		rendered, err := t.raw.renderString(values)
		if err != nil {
			return fmt.Errorf("rendering query_params: %w", err)
		}

		if err := validateRawQuery(rendered); err != nil {
			return fmt.Errorf("rendering query_params: %w", err)
		}

		parsed.RawQuery = rendered
		req.URL = parsed.String()

		return nil
	}

	query := url.Values{}

	keys := make([]string, 0, len(t.values))
	for key := range t.values {
		keys = append(keys, key)
	}

	slices.Sort(keys)

	for _, key := range keys {
		value, isNull, err := t.values[key].renderNullableString(values)
		if err != nil {
			return fmt.Errorf("rendering query param %q: %w", key, err)
		}

		// Hasura drops a query param whose template renders to null. Because
		// string-context templates are quote-wrapped, a null interpolation renders
		// as the literal string "null"; Hasura's QueryParams transform drops on
		// exactly `value == "null"`, which is what we mirror here.
		if isNull || value == nullRenderedString {
			continue
		}

		query.Set(key, value)
	}

	parsed.RawQuery = query.Encode()
	req.URL = parsed.String()

	return nil
}

func (t *headerTransform) apply(values map[string]any, headers http.Header) error {
	for _, name := range t.remove {
		headers.Del(name)
	}

	keys := make([]string, 0, len(t.add))
	for key := range t.add {
		keys = append(keys, key)
	}

	slices.Sort(keys)

	for _, key := range keys {
		value, isNull, err := t.add[key].renderNullableString(values)
		if err != nil {
			return fmt.Errorf("rendering header %q: %w", key, err)
		}

		if isNull {
			continue
		}

		if !httpguts.ValidHeaderFieldValue(value) {
			return fmt.Errorf("invalid value for header %q", key)
		}

		headers.Set(key, value)
	}

	return nil
}

func (t *requestBodyTransform) apply(values map[string]any, req *OutgoingRequest) error {
	switch t.action {
	case bodyActionRemove:
		req.Body = nil
	case bodyActionTransform:
		body, err := t.template.renderJSON(values)
		if err != nil {
			return fmt.Errorf("rendering request body: %w", err)
		}

		req.Body = body
	case bodyActionFormURLEncoded:
		form := url.Values{}

		keys := make([]string, 0, len(t.formTemplate))
		for key := range t.formTemplate {
			keys = append(keys, key)
		}

		slices.Sort(keys)

		for _, key := range keys {
			value, isNull, err := t.formTemplate[key].renderNullableString(values)
			if err != nil {
				return fmt.Errorf("rendering form field %q: %w", key, err)
			}

			// Hasura's foldFormEncoded drops a form field whose rendered value is
			// the literal string "null" (`v /= "null"`); mirror that here.
			if isNull || value == nullRenderedString {
				continue
			}

			form.Set(key, value)
		}

		req.Body = []byte(form.Encode())
	default:
		return fmt.Errorf("unsupported body action %q", t.action)
	}

	return nil
}

func requestTemplateValues(ctx RequestContext) (map[string]any, error) {
	body, err := normalizeJSONValue(ctx.Body)
	if err != nil {
		return nil, fmt.Errorf("normalizing request body for transform: %w", err)
	}

	return baseTemplateValues(ctx.BaseURL, body, ctx.SessionVariables), nil
}

func responseTemplateValues(ctx ResponseContext, body any) map[string]any {
	values := baseTemplateValues(ctx.BaseURL, body, ctx.SessionVariables)
	values["response"] = map[string]any{
		"status":  float64(ctx.Status),
		"body":    body,
		"headers": headersTemplateMap(ctx.Headers),
	}

	return values
}

func baseTemplateValues(baseURL string, body any, sessionVariables map[string]any) map[string]any {
	return map[string]any{
		"body":              body,
		"base_url":          baseURL,
		"session_variables": normalizeSessionVariables(sessionVariables),
		"query_params":      queryParamsTemplatePairs(baseURL),
	}
}

func normalizeJSONValue(value any) (any, error) {
	if value == nil {
		return nil, nil
	}

	data, err := json.Marshal(value)
	if err != nil {
		return nil, fmt.Errorf("marshaling value as JSON: %w", err)
	}

	var out any
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, fmt.Errorf("unmarshaling normalized JSON value: %w", err)
	}

	return out, nil
}

func normalizeSessionVariables(sessionVariables map[string]any) map[string]any {
	out := make(map[string]any, len(sessionVariables))
	for key, value := range sessionVariables {
		out[strings.ToLower(key)] = value
	}

	return out
}

// queryParamsTemplatePairs binds $query_params as a JSON array of
// [key, value-or-null] two-element pairs, matching Hasura's RequestTransformCtx
// (graphql-engine server/src-lib/Hasura/RQL/DDL/Webhook/Transform/Request.hs:
// mkReqTransformCtx encodes HTTP.queryParams, a [(key, Maybe val)] list, via
// J.toJSON). The ordered pair-array preserves order and repeated keys and is
// the shape fromPairs/toPairs operate on, so admin templates that use
// {{ fromPairs($query_params) }} port from Hasura unchanged. A valueless param
// (e.g. "?flag") binds value null; an empty value ("?flag=") binds "".
func queryParamsTemplatePairs(rawURL string) []any {
	parsed, err := url.Parse(rawURL)
	if err != nil || parsed.RawQuery == "" {
		return []any{}
	}

	segments := strings.Split(parsed.RawQuery, "&")
	pairs := make([]any, 0, len(segments))

	for _, segment := range segments {
		if segment == "" {
			continue
		}

		key := segment

		var value any // null when the param has no '=' (mirrors Maybe val)

		if eq := strings.IndexByte(segment, '='); eq >= 0 {
			key = segment[:eq]
			value = decodeQueryComponent(segment[eq+1:])
		}

		pairs = append(pairs, []any{decodeQueryComponent(key), value})
	}

	return pairs
}

// decodeQueryComponent percent-decodes a raw query key or value, falling back
// to the raw text when it is not valid percent-encoding (url.QueryUnescape is
// strict; an admin-authored URL should not fail rendering over a stray '%').
func decodeQueryComponent(raw string) string {
	if decoded, err := url.QueryUnescape(raw); err == nil {
		return decoded
	}

	return raw
}

func headersTemplateMap(headers http.Header) map[string]any {
	out := make(map[string]any, len(headers))
	for key, values := range headers {
		lowerKey := strings.ToLower(key)
		if len(values) == 1 {
			out[lowerKey] = values[0]
			out[http.CanonicalHeaderKey(key)] = values[0]

			continue
		}

		items := make([]any, 0, len(values))
		for _, value := range values {
			items = append(items, value)
		}

		out[lowerKey] = items
		out[http.CanonicalHeaderKey(key)] = items
	}

	return out
}

func validateTransformHeaderName(name string) error {
	if !httpguts.ValidHeaderFieldName(name) {
		return errors.New("invalid header name")
	}

	if _, blocked := transformHeadersBlocked[http.CanonicalHeaderKey(name)]; blocked {
		return errors.New("header cannot be transformed")
	}

	return nil
}

func validateRawQuery(raw string) error {
	if strings.Contains(raw, "#") {
		return errors.New("raw query contains fragment separator")
	}

	if strings.ContainsFunc(raw, func(r rune) bool {
		return r < ' ' || r == 0x7f
	}) {
		return errors.New("raw query contains control character")
	}

	return nil
}

func rejectUnknownKeys(raw map[string]any, allowed map[string]struct{}) error {
	for key := range raw {
		if _, ok := allowed[key]; !ok {
			return fmt.Errorf("unsupported field %q", key)
		}
	}

	return nil
}

func optionalVersion(raw any, defaultValue int) (int, error) {
	if raw == nil {
		return defaultValue, nil
	}

	switch typed := raw.(type) {
	case int:
		return typed, nil
	case int64:
		return int(typed), nil
	case float64:
		if typed != float64(int(typed)) {
			return 0, errors.New("version must be an integer")
		}

		return int(typed), nil
	case string:
		value, err := strconv.Atoi(typed)
		if err != nil {
			return 0, fmt.Errorf("parsing version: %w", err)
		}

		return value, nil
	default:
		return 0, fmt.Errorf("version must be a number or string, got %T", raw)
	}
}

func optionalString(raw any) (string, bool, error) {
	if raw == nil {
		return "", false, nil
	}

	value, ok := raw.(string)
	if !ok {
		return "", false, fmt.Errorf("must be a string, got %T", raw)
	}

	if value == "" {
		return "", false, nil
	}

	return value, true, nil
}

func optionalStringList(raw any) ([]string, error) {
	if raw == nil {
		return nil, nil
	}

	items, ok := raw.([]any)
	if !ok {
		return nil, fmt.Errorf("must be an array, got %T", raw)
	}

	out := make([]string, 0, len(items))
	for _, item := range items {
		value, ok := item.(string)
		if !ok {
			return nil, fmt.Errorf("array item must be a string, got %T", item)
		}

		out = append(out, value)
	}

	return out, nil
}

func optionalStringTemplateMap(raw any) (map[string]*template, error) {
	if raw == nil {
		return nil, nil
	}

	object, ok := raw.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("must be an object, got %T", raw)
	}

	out := make(map[string]*template, len(object))
	for key, rawValue := range object {
		value, ok := rawValue.(string)
		if !ok {
			return nil, fmt.Errorf("value for %q must be a string, got %T", key, rawValue)
		}

		compiled, err := compileStringTemplate(value)
		if err != nil {
			return nil, fmt.Errorf("compiling template for %q: %w", key, err)
		}

		out[key] = compiled
	}

	return out, nil
}

func allowedMethod(method string) bool {
	switch method {
	case http.MethodPost, http.MethodGet, http.MethodPut, http.MethodDelete, http.MethodPatch:
		return true
	default:
		return false
	}
}
