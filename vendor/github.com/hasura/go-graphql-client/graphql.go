package graphql

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"strings"

	"github.com/hasura/go-graphql-client/internal/jsonutil"
)

// This function allows you to tweak the HTTP request. It might be useful to set authentication
// headers  amongst other things
type RequestModifier func(*http.Request)

// Client is a GraphQL client.
type Client struct {
	url             string // GraphQL server URL.
	httpClient      *http.Client
	requestModifier RequestModifier
	debug           bool
}

// NewClient creates a GraphQL client targeting the specified GraphQL server URL.
// If httpClient is nil, then http.DefaultClient is used.
func NewClient(url string, httpClient *http.Client) *Client {
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	return &Client{
		url:             url,
		httpClient:      httpClient,
		requestModifier: nil,
	}
}

// Query executes a single GraphQL query request,
// with a query derived from q, populating the response into it.
// q should be a pointer to struct that corresponds to the GraphQL schema.
func (c *Client) Query(ctx context.Context, q interface{}, variables map[string]interface{}, options ...Option) error {
	return c.do(ctx, queryOperation, q, variables, options...)
}

// NamedQuery executes a single GraphQL query request, with operation name
//
// Deprecated: this is the shortcut of Query method, with NewOperationName option
func (c *Client) NamedQuery(ctx context.Context, name string, q interface{}, variables map[string]interface{}, options ...Option) error {
	return c.do(ctx, queryOperation, q, variables, append(options, OperationName(name))...)
}

// Mutate executes a single GraphQL mutation request,
// with a mutation derived from m, populating the response into it.
// m should be a pointer to struct that corresponds to the GraphQL schema.
func (c *Client) Mutate(ctx context.Context, m interface{}, variables map[string]interface{}, options ...Option) error {
	return c.do(ctx, mutationOperation, m, variables, options...)
}

// NamedMutate executes a single GraphQL mutation request, with operation name
//
// Deprecated: this is the shortcut of Mutate method, with NewOperationName option
func (c *Client) NamedMutate(ctx context.Context, name string, m interface{}, variables map[string]interface{}, options ...Option) error {
	return c.do(ctx, mutationOperation, m, variables, append(options, OperationName(name))...)
}

// Query executes a single GraphQL query request,
// with a query derived from q, populating the response into it.
// q should be a pointer to struct that corresponds to the GraphQL schema.
// return raw bytes message.
func (c *Client) QueryRaw(ctx context.Context, q interface{}, variables map[string]interface{}, options ...Option) (*json.RawMessage, error) {
	return c.doRaw(ctx, queryOperation, q, variables, options...)
}

// NamedQueryRaw executes a single GraphQL query request, with operation name
// return raw bytes message.
func (c *Client) NamedQueryRaw(ctx context.Context, name string, q interface{}, variables map[string]interface{}, options ...Option) (*json.RawMessage, error) {
	return c.doRaw(ctx, queryOperation, q, variables, append(options, OperationName(name))...)
}

// MutateRaw executes a single GraphQL mutation request,
// with a mutation derived from m, populating the response into it.
// m should be a pointer to struct that corresponds to the GraphQL schema.
// return raw bytes message.
func (c *Client) MutateRaw(ctx context.Context, m interface{}, variables map[string]interface{}, options ...Option) (*json.RawMessage, error) {
	return c.doRaw(ctx, mutationOperation, m, variables, options...)
}

// NamedMutateRaw executes a single GraphQL mutation request, with operation name
// return raw bytes message.
func (c *Client) NamedMutateRaw(ctx context.Context, name string, m interface{}, variables map[string]interface{}, options ...Option) (*json.RawMessage, error) {
	return c.doRaw(ctx, mutationOperation, m, variables, append(options, OperationName(name))...)
}

// buildAndRequest the common method that builds and send graphql request
func (c *Client) buildAndRequest(ctx context.Context, op operationType, v interface{}, variables map[string]interface{}, options ...Option) (*json.RawMessage, *http.Response, io.Reader, Errors) {
	var query string
	var err error
	switch op {
	case queryOperation:
		query, err = ConstructQuery(v, variables, options...)
	case mutationOperation:
		query, err = ConstructMutation(v, variables, options...)
	}

	if err != nil {
		return nil, nil, nil, Errors{newError(ErrGraphQLEncode, err)}
	}

	return c.request(ctx, query, variables, options...)
}

// Request the common method that send graphql request
func (c *Client) request(ctx context.Context, query string, variables map[string]interface{}, options ...Option) (*json.RawMessage, *http.Response, io.Reader, Errors) {
	in := struct {
		Query     string                 `json:"query"`
		Variables map[string]interface{} `json:"variables,omitempty"`
	}{
		Query:     query,
		Variables: variables,
	}
	var buf bytes.Buffer
	err := json.NewEncoder(&buf).Encode(in)
	if err != nil {
		return nil, nil, nil, Errors{newError(ErrGraphQLEncode, err)}
	}

	reqReader := bytes.NewReader(buf.Bytes())
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.url, reqReader)
	if err != nil {
		e := newError(ErrRequestError, fmt.Errorf("problem constructing request: %w", err))
		if c.debug {
			e = e.withRequest(request, reqReader)
		}
		return nil, nil, nil, Errors{e}
	}
	request.Header.Add("Content-Type", "application/json")

	if c.requestModifier != nil {
		c.requestModifier(request)
	}

	resp, err := c.httpClient.Do(request)

	if c.debug {
		reqReader.Seek(0, io.SeekStart)
	}

	if err != nil {
		e := newError(ErrRequestError, err)
		if c.debug {
			e = e.withRequest(request, reqReader)
		}
		return nil, nil, nil, Errors{e}
	}
	defer resp.Body.Close()

	r := resp.Body

	if resp.Header.Get("Content-Encoding") == "gzip" {
		gr, err := gzip.NewReader(r)
		if err != nil {
			return nil, nil, nil, Errors{newError(ErrJsonDecode, fmt.Errorf("problem trying to create gzip reader: %w", err))}
		}
		defer gr.Close()
		r = gr
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := ioutil.ReadAll(resp.Body)
		err := newError(ErrRequestError, fmt.Errorf("%v; body: %q", resp.Status, body))

		if c.debug {
			err = err.withRequest(request, reqReader)
		}
		return nil, nil, nil, Errors{err}
	}

	var out struct {
		Data   *json.RawMessage
		Errors Errors
	}

	// copy the response reader for debugging
	var respReader *bytes.Reader
	if c.debug {
		body, err := ioutil.ReadAll(resp.Body)
		if err != nil {
			return nil, nil, nil, Errors{newError(ErrJsonDecode, err)}
		}
		respReader = bytes.NewReader(body)
		r = io.NopCloser(respReader)
	}

	err = json.NewDecoder(r).Decode(&out)

	if c.debug {
		respReader.Seek(0, io.SeekStart)
	}

	if err != nil {
		we := newError(ErrJsonDecode, err)
		if c.debug {
			we = we.withRequest(request, reqReader).
				withResponse(resp, respReader)
		}
		return nil, nil, nil, Errors{we}
	}

	if len(out.Errors) > 0 {
		if c.debug && (out.Errors[0].Extensions == nil || out.Errors[0].Extensions["request"] == nil) {
			out.Errors[0] = out.Errors[0].
				withRequest(request, reqReader).
				withResponse(resp, respReader)
		}

		return out.Data, resp, respReader, out.Errors
	}

	return out.Data, resp, respReader, nil
}

// do executes a single GraphQL operation.
// return raw message and error
func (c *Client) doRaw(ctx context.Context, op operationType, v interface{}, variables map[string]interface{}, options ...Option) (*json.RawMessage, error) {
	data, _, _, err := c.buildAndRequest(ctx, op, v, variables, options...)
	if len(err) > 0 {
		return data, err
	}
	return data, nil
}

// do executes a single GraphQL operation and unmarshal json.
func (c *Client) do(ctx context.Context, op operationType, v interface{}, variables map[string]interface{}, options ...Option) error {
	data, resp, respBuf, errs := c.buildAndRequest(ctx, op, v, variables, options...)
	return c.processResponse(v, data, resp, respBuf, errs)
}

// Executes a pre-built query and unmarshals the response into v. Unlike the Query method you have to specify in the query the
// fields that you want to receive as they are not inferred from v. This method is useful if you need to build the query dynamically.
func (c *Client) Exec(ctx context.Context, query string, v interface{}, variables map[string]interface{}, options ...Option) error {
	data, resp, respBuf, errs := c.request(ctx, query, variables, options...)
	return c.processResponse(v, data, resp, respBuf, errs)
}

func (c *Client) processResponse(v interface{}, data *json.RawMessage, resp *http.Response, respBuf io.Reader, errs Errors) error {
	if data != nil {
		err := jsonutil.UnmarshalGraphQL(*data, v)
		if err != nil {
			we := newError(ErrGraphQLDecode, err)
			if c.debug {
				we = we.withResponse(resp, respBuf)
			}
			errs = append(errs, we)
		}
	}

	if len(errs) > 0 {
		return errs
	}

	return nil
}

// Returns a copy of the client with the request modifier set. This allows you to reuse the same
// TCP connection for multiple slightly different requests to the same server
// (i.e. different authentication headers for multitenant applications)
func (c *Client) WithRequestModifier(f RequestModifier) *Client {
	return &Client{
		url:             c.url,
		httpClient:      c.httpClient,
		requestModifier: f,
	}
}

// WithDebug enable debug mode to print internal error detail
func (c *Client) WithDebug(debug bool) *Client {
	return &Client{
		url:             c.url,
		httpClient:      c.httpClient,
		requestModifier: c.requestModifier,
		debug:           debug,
	}
}

// errors represents the "errors" array in a response from a GraphQL server.
// If returned via error interface, the slice is expected to contain at least 1 element.
//
// Specification: https://facebook.github.io/graphql/#sec-Errors.
type Errors []Error

type Error struct {
	Message    string                 `json:"message"`
	Extensions map[string]interface{} `json:"extensions"`
	Locations  []struct {
		Line   int `json:"line"`
		Column int `json:"column"`
	} `json:"locations"`
}

// Error implements error interface.
func (e Error) Error() string {
	return fmt.Sprintf("Message: %s, Locations: %+v", e.Message, e.Locations)
}

// Error implements error interface.
func (e Errors) Error() string {
	b := strings.Builder{}
	for _, err := range e {
		b.WriteString(err.Error())
	}
	return b.String()
}

func (e Error) getInternalExtension() map[string]interface{} {
	if e.Extensions == nil {
		return make(map[string]interface{})
	}

	if ex, ok := e.Extensions["internal"]; ok {
		return ex.(map[string]interface{})
	}

	return make(map[string]interface{})
}

func newError(code string, err error) Error {
	return Error{
		Message: err.Error(),
		Extensions: map[string]interface{}{
			"code": code,
		},
	}
}

func (e Error) withRequest(req *http.Request, bodyReader io.Reader) Error {
	internal := e.getInternalExtension()
	bodyBytes, err := ioutil.ReadAll(bodyReader)
	if err != nil {
		internal["error"] = err
	} else {
		internal["request"] = map[string]interface{}{
			"headers": req.Header,
			"body":    string(bodyBytes),
		}
	}

	if e.Extensions == nil {
		e.Extensions = make(map[string]interface{})
	}
	e.Extensions["internal"] = internal
	return e
}

func (e Error) withResponse(res *http.Response, bodyReader io.Reader) Error {
	internal := e.getInternalExtension()
	bodyBytes, err := ioutil.ReadAll(bodyReader)
	if err != nil {
		internal["error"] = err
	} else {
		internal["response"] = map[string]interface{}{
			"headers": res.Header,
			"body":    string(bodyBytes),
		}
	}

	e.Extensions["internal"] = internal
	return e
}

// UnmarshalGraphQL parses the JSON-encoded GraphQL response data and stores
// the result in the GraphQL query data structure pointed to by v.
//
// The implementation is created on top of the JSON tokenizer available
// in "encoding/json".Decoder.
// This function is re-exported from the internal package
func UnmarshalGraphQL(data []byte, v interface{}) error {
	return jsonutil.UnmarshalGraphQL(data, v)
}

type operationType uint8

const (
	queryOperation operationType = iota
	mutationOperation
	// subscriptionOperation // Unused.

	ErrRequestError  = "request_error"
	ErrJsonEncode    = "json_encode_error"
	ErrJsonDecode    = "json_decode_error"
	ErrGraphQLEncode = "graphql_encode_error"
	ErrGraphQLDecode = "graphql_decode_error"
)
