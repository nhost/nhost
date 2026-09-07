package graphql_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/nhost/nhost/packages/nhost-go/graphql"
	"github.com/nhost/nhost/packages/nhost-go/transport"
)

func writeResponse(t *testing.T, writer io.Writer, body string) {
	t.Helper()

	if _, err := io.WriteString(writer, body); err != nil {
		t.Errorf("write response: %v", err)
	}
}

func assertPartialData(t *testing.T, raw json.RawMessage) {
	t.Helper()

	var partialData map[string]any
	if err := json.Unmarshal(raw, &partialData); err != nil {
		t.Fatalf("decode raw partial data: %v", err)
	}

	user, ok := partialData["user"].(map[string]any)
	if !ok || user["id"] != "u1" {
		t.Fatalf("raw partial data = %+v", partialData)
	}
}

func TestRequestTypedDecode(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		writeResponse(t, w, `{"data":{"user":{"id":"u1","name":"Ada"}}}`)
	}))
	defer srv.Close()

	type data struct {
		User struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"user"`
	}

	var result data

	client := graphql.NewClient(srv.URL, srv.Client())

	response, err := client.Request(context.Background(), "query { user }", nil, &result)
	if err != nil {
		t.Fatalf("request: %v", err)
	}

	if result.User.ID != "u1" || result.User.Name != "Ada" {
		t.Fatalf("decoded = %+v", result.User)
	}

	if response.Status != http.StatusOK {
		t.Fatalf("status = %d", response.Status)
	}
}

func TestRequestGraphQLErrorsDecodePartialData(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("X-Request-ID", "request-1")
		writeResponse(t, w, `{
			"data":{"user":{"id":"u1"}},
			"errors":[{
				"message":"name resolver failed",
				"locations":[{"line":3,"column":5}],
				"path":["user","name"],
				"extensions":{"code":"unexpected"}
			}]
		}`)
	}))
	defer srv.Close()

	type data struct {
		User struct {
			ID string `json:"id"`
		} `json:"user"`
	}

	var result data

	client := graphql.NewClient(srv.URL, srv.Client())

	response, err := client.Request(context.Background(), "query { user }", nil, &result)

	var responseErr *graphql.ResponseError
	if !errors.As(err, &responseErr) {
		t.Fatalf("expected *graphql.ResponseError, got %T (%v)", err, err)
	}

	if result.User.ID != "u1" {
		t.Fatalf("partial data = %+v", result)
	}

	if response.Status != http.StatusOK || response.Headers.Get("X-Request-ID") != "request-1" {
		t.Fatalf("response = %+v", response)
	}

	if responseErr.Status != http.StatusOK ||
		responseErr.Headers.Get("X-Request-ID") != "request-1" {
		t.Fatalf("response error metadata = %+v", responseErr)
	}

	if responseErr.Error() != "name resolver failed" {
		t.Fatalf("message = %q", responseErr.Error())
	}

	if len(responseErr.Errors) != 1 {
		t.Fatalf("errors = %+v", responseErr.Errors)
	}

	item := responseErr.Errors[0]
	if item.Locations[0].Line != 3 || item.Locations[0].Column != 5 {
		t.Fatalf("locations = %+v", item.Locations)
	}

	if item.Path[0] != "user" || item.Path[1] != "name" {
		t.Fatalf("path = %+v", item.Path)
	}

	if item.Extensions["code"] != "unexpected" {
		t.Fatalf("extensions = %+v", item.Extensions)
	}

	assertPartialData(t, responseErr.Data)
}

func TestResponseErrorWrapsPartialDataDecodeError(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		writeResponse(
			t,
			w,
			`{"data":{"count":"not-an-integer"},"errors":[{"message":"partial failure"}]}`,
		)
	}))
	defer srv.Close()

	var result struct {
		Count int `json:"count"`
	}

	client := graphql.NewClient(srv.URL, srv.Client())
	_, err := client.Request(context.Background(), "query { count }", nil, &result)

	var responseErr *graphql.ResponseError
	if !errors.As(err, &responseErr) {
		t.Fatalf("expected *graphql.ResponseError, got %T (%v)", err, err)
	}

	var decodeErr *graphql.DecodeError
	if !errors.As(err, &decodeErr) {
		t.Fatalf("expected wrapped *graphql.DecodeError, got %T (%v)", err, err)
	}
}

func TestExecuteTypedDecode(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		writeResponse(t, w, `{"data":{"user":{"id":"u1","name":"Ada"}}}`)
	}))
	defer srv.Close()

	type data struct {
		User struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"user"`
	}

	client := graphql.NewClient(srv.URL, srv.Client())

	result, response, err := graphql.Execute[data](
		context.Background(),
		client,
		"query { user }",
		nil,
	)
	if err != nil {
		t.Fatalf("execute: %v", err)
	}

	if result.User.ID != "u1" || result.User.Name != "Ada" {
		t.Fatalf("decoded = %+v", result.User)
	}

	if response.Status != http.StatusOK {
		t.Fatalf("status = %d", response.Status)
	}
}

func TestRequestConstruction(t *testing.T) {
	t.Parallel()

	type variables struct {
		Limit int `json:"limit"`
	}

	type gqlRequest struct {
		Query         string    `json:"query"`
		Variables     variables `json:"variables"`
		OperationName string    `json:"operationName"`
	}

	var (
		got         gqlRequest
		gotHeader   string
		contentType string
	)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Errorf("read request: %v", err)
			return
		}

		if err := json.Unmarshal(body, &got); err != nil {
			t.Errorf("decode request: %v", err)
			return
		}

		gotHeader = r.Header.Get("X-Custom")
		contentType = r.Header.Get("Content-Type")

		writeResponse(t, w, `{"data":{}}`)
	}))
	defer srv.Close()

	client := graphql.NewClient(srv.URL, srv.Client())

	var result struct{}

	_, err := client.Request(
		context.Background(),
		"query Q($limit: Int!) { users(limit: $limit) { id } }",
		variables{Limit: 5},
		&result,
		graphql.WithOperationName("Q"),
		graphql.WithHeaders(http.Header{"X-Custom": {"abc"}}),
	)
	if err != nil {
		t.Fatalf("request: %v", err)
	}

	if got.Query != "query Q($limit: Int!) { users(limit: $limit) { id } }" {
		t.Fatalf("query = %q", got.Query)
	}

	if got.OperationName != "Q" {
		t.Fatalf("operationName = %q", got.OperationName)
	}

	if got.Variables.Limit != 5 {
		t.Fatalf("variables = %+v", got.Variables)
	}

	if gotHeader != "abc" {
		t.Fatalf("X-Custom = %q", gotHeader)
	}

	if contentType != "application/json" {
		t.Fatalf("Content-Type = %q", contentType)
	}
}

func TestRequestDecodeError(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		writeResponse(t, w, `{"data":{"count":"not-an-integer"}}`)
	}))
	defer srv.Close()

	var result struct {
		Count int `json:"count"`
	}

	client := graphql.NewClient(srv.URL, srv.Client())
	response, err := client.Request(context.Background(), "query { count }", nil, &result)

	var decodeErr *graphql.DecodeError
	if !errors.As(err, &decodeErr) {
		t.Fatalf("expected *graphql.DecodeError, got %T (%v)", err, err)
	}

	if response.Status != http.StatusOK {
		t.Fatalf("status = %d", response.Status)
	}

	var typeErr *json.UnmarshalTypeError
	if !errors.As(err, &typeErr) {
		t.Fatalf("expected wrapped *json.UnmarshalTypeError, got %T (%v)", err, err)
	}
}

func TestRequestNonSuccessfulResponse(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		contentType string
		body        string
		wantMessage string
	}{
		{
			name:        "JSON",
			contentType: "application/json",
			body:        `{"error":"unauthorized","code":"401"}`,
			wantMessage: "unauthorized",
		},
		{
			name:        "plain text",
			contentType: "text/plain",
			body:        "gateway unavailable",
			wantMessage: "gateway unavailable",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			srv := httptest.NewServer(
				http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					w.Header().Set("Content-Type", tt.contentType)
					w.WriteHeader(http.StatusUnauthorized)
					writeResponse(t, w, tt.body)
				}),
			)
			defer srv.Close()

			client := graphql.NewClient(srv.URL, srv.Client())
			response, err := client.Request(context.Background(), "query { me }", nil, nil)

			var apiErr *transport.APIError
			if !errors.As(err, &apiErr) {
				t.Fatalf("expected *transport.APIError, got %T (%v)", err, err)
			}

			if apiErr.Status != http.StatusUnauthorized || apiErr.Error() != tt.wantMessage {
				t.Fatalf("API error = %+v (%q)", apiErr, apiErr.Error())
			}

			if response.Status != http.StatusUnauthorized {
				t.Fatalf("status = %d", response.Status)
			}
		})
	}
}
