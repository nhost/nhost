package openapi3

import (
	"context"
	"encoding/json"
	"maps"
	"strconv"
)

// Responses is specified by OpenAPI/Swagger 3.0 standard.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#responses-object
type Responses struct {
	Extensions map[string]any `json:"-" yaml:"-"`
	Origin     *Origin        `json:"-" yaml:"-"`

	m map[string]*ResponseRef

	explicitlyNull bool
}

// NewResponses builds a responses object with response objects in insertion order.
// Given no arguments, NewResponses returns an empty responses object.
func NewResponses(opts ...NewResponsesOption) *Responses {
	responses := NewResponsesWithCapacity(len(opts))
	for _, opt := range opts {
		opt(responses)
	}
	return responses
}

func (responses *Responses) isExplicitlyNull() bool {
	return responses != nil && responses.explicitlyNull && responses.m == nil && len(responses.Extensions) == 0
}

// NewResponsesOption describes options to NewResponses func
type NewResponsesOption func(*Responses)

// WithStatus adds a status code keyed ResponseRef
func WithStatus(status int, responseRef *ResponseRef) NewResponsesOption {
	return func(responses *Responses) {
		if r := responseRef; r != nil {
			code := strconv.FormatInt(int64(status), 10)
			responses.Set(code, r)
		}
	}
}

// WithName adds a name-keyed Response
func WithName(name string, response *Response) NewResponsesOption {
	return func(responses *Responses) {
		if r := response; r != nil && name != "" {
			responses.Set(name, &ResponseRef{Value: r})
		}
	}
}

// Default returns the default response
func (responses *Responses) Default() *ResponseRef {
	return responses.Value("default")
}

// Status returns a ResponseRef for the given status
// If an exact match isn't initially found a patterned field is checked using
// the first digit to determine the range (eg: 201 to 2XX)
// See https://spec.openapis.org/oas/v3.0.3#patterned-fields-0
func (responses *Responses) Status(status int) *ResponseRef {
	st := strconv.FormatInt(int64(status), 10)
	if rref := responses.Value(st); rref != nil {
		return rref
	}
	if 99 < status && status < 600 {
		st = string(st[0]) + "XX"
		switch st {
		case "1XX", "2XX", "3XX", "4XX", "5XX":
			return responses.Value(st)
		}
	}
	return nil
}

// Validate returns an error if Responses does not comply with the OpenAPI spec.
func (responses *Responses) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)
	me := newErrCollector(ctx)

	if responses.Len() == 0 {
		if err := me.emit(newResponsesNonEmptyRequired(responses.Origin)); err != nil {
			return err
		}
		// Fall through so validateExtensions still runs and any extension
		// errors aggregate with the empty-responses finding under multi mode.
	}

	for _, key := range responses.Keys() {
		v := responses.Value(key)
		if err := me.emit(v.Validate(ctx)); err != nil {
			return err
		}
	}

	return me.finalize(validateExtensions(ctx, responses.Extensions, responses.Origin))
}

// Response is specified by OpenAPI/Swagger 3.0 standard.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#response-object
type Response struct {
	Extensions map[string]any `json:"-" yaml:"-"`
	Origin     *Origin        `json:"-" yaml:"-"`

	Description *string `json:"description,omitempty" yaml:"description,omitempty"`
	Headers     Headers `json:"headers,omitempty" yaml:"headers,omitempty"`
	Content     Content `json:"content,omitempty" yaml:"content,omitempty"`
	Links       Links   `json:"links,omitempty" yaml:"links,omitempty"`
}

func NewResponse() *Response {
	return &Response{}
}

func (response *Response) WithDescription(value string) *Response {
	response.Description = &value
	return response
}

func (response *Response) WithContent(content Content) *Response {
	response.Content = content
	return response
}

func (response *Response) WithJSONSchema(schema *Schema) *Response {
	response.Content = NewContentWithJSONSchema(schema)
	return response
}

func (response *Response) WithJSONSchemaRef(schema *SchemaRef) *Response {
	response.Content = NewContentWithJSONSchemaRef(schema)
	return response
}

// MarshalJSON returns the JSON encoding of Response.
func (response Response) MarshalJSON() ([]byte, error) {
	x, err := response.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return json.Marshal(x)
}

// MarshalYAML returns the YAML encoding of Response.
func (response Response) MarshalYAML() (any, error) {
	m := make(map[string]any, 4+len(response.Extensions))
	maps.Copy(m, response.Extensions)
	if x := response.Description; x != nil {
		m["description"] = x
	}
	if x := response.Headers; len(x) != 0 {
		m["headers"] = x
	}
	if x := response.Content; len(x) != 0 {
		m["content"] = x
	}
	if x := response.Links; len(x) != 0 {
		m["links"] = x
	}
	return m, nil
}

// UnmarshalJSON sets Response to a copy of data.
func (response *Response) UnmarshalJSON(data []byte) error {
	type ResponseBis Response
	var x ResponseBis
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	_ = json.Unmarshal(data, &x.Extensions)
	delete(x.Extensions, "description")
	delete(x.Extensions, "headers")
	delete(x.Extensions, "content")
	delete(x.Extensions, "links")
	if len(x.Extensions) == 0 {
		x.Extensions = nil
	}
	*response = Response(x)
	return nil
}

// Validate returns an error if Response does not comply with the OpenAPI spec.
func (response *Response) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)

	if response.Description == nil {
		return newResponseDescriptionRequired(response.Origin)
	}
	if vo := getValidationOptions(ctx); !vo.examplesValidationDisabled {
		vo.examplesValidationAsReq, vo.examplesValidationAsRes = false, true
	}

	if content := response.Content; content != nil {
		if err := content.Validate(ctx); err != nil {
			return err
		}
	}

	for _, name := range componentNames(response.Headers) {
		header := response.Headers[name]
		if err := header.Validate(ctx); err != nil {
			return err
		}
	}

	for _, name := range componentNames(response.Links) {
		link := response.Links[name]
		if err := link.Validate(ctx); err != nil {
			return err
		}
	}

	return validateExtensions(ctx, response.Extensions, response.Origin)
}
