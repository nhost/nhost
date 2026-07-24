package graphql_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/nhost/nhost/packages/nhost-go/fetch"
	"github.com/nhost/nhost/packages/nhost-go/graphql"
)

func TestRequestSuccess(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, `{"data":{"__typename":"query_root"}}`)
	}))
	defer srv.Close()

	c := graphql.NewClient(srv.URL, nil, srv.Client())

	resp, err := c.Request(context.Background(), "query { __typename }", nil, "", nil)
	if err != nil {
		t.Fatalf("request: %v", err)
	}

	if resp.Body.Data["__typename"] != "query_root" {
		t.Fatalf("data = %v", resp.Body.Data)
	}
}

func TestRequestGraphQLErrors(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, `{"errors":[{"message":"field not found"}]}`)
	}))
	defer srv.Close()

	c := graphql.NewClient(srv.URL, nil, srv.Client())

	_, err := c.Request(context.Background(), "query { nope }", nil, "", nil)

	var ferr *fetch.FetchError
	if !errors.As(err, &ferr) {
		t.Fatalf("expected *fetch.FetchError, got %T", err)
	}

	if ferr.Error() != "field not found" {
		t.Fatalf("message = %q", ferr.Error())
	}
}

func TestExecuteTypedDecode(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, `{"data":{"user":{"id":"u1","name":"Ada"}}}`)
	}))
	defer srv.Close()

	type data struct {
		User struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"user"`
	}

	c := graphql.NewClient(srv.URL, nil, srv.Client())

	resp, err := graphql.Execute[data](context.Background(), c, "query { user }", nil, "", nil)
	if err != nil {
		t.Fatalf("execute: %v", err)
	}

	if resp.Body.Data.User.ID != "u1" || resp.Body.Data.User.Name != "Ada" {
		t.Fatalf("decoded = %+v", resp.Body.Data.User)
	}
}

func TestRequestConstruction(t *testing.T) {
	t.Parallel()

	type gqlReq struct {
		Query         string         `json:"query"`
		Variables     map[string]any `json:"variables"`
		OperationName string         `json:"operationName"`
	}

	var (
		got        gqlReq
		gotHeader  string
		contentTyp string
	)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &got)
		gotHeader = r.Header.Get("X-Custom")
		contentTyp = r.Header.Get("Content-Type")
		_, _ = io.WriteString(w, `{"data":{}}`)
	}))
	defer srv.Close()

	c := graphql.NewClient(srv.URL, nil, srv.Client())

	_, err := c.Request(
		context.Background(),
		"query Q { __typename }",
		graphql.Variables{"limit": float64(5)},
		"Q",
		http.Header{"X-Custom": {"abc"}},
	)
	if err != nil {
		t.Fatalf("request: %v", err)
	}

	if got.Query != "query Q { __typename }" {
		t.Fatalf("query = %q", got.Query)
	}

	if got.OperationName != "Q" {
		t.Fatalf("operationName = %q", got.OperationName)
	}

	if got.Variables["limit"] != float64(5) {
		t.Fatalf("variables = %v", got.Variables)
	}

	if gotHeader != "abc" {
		t.Fatalf("X-Custom = %q", gotHeader)
	}

	if contentTyp != "application/json" {
		t.Fatalf("Content-Type = %q", contentTyp)
	}
}

func TestExecuteNon2xxWithoutGraphQLErrors(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = io.WriteString(w, `{"error":"unauthorized","code":"401"}`)
	}))
	defer srv.Close()

	c := graphql.NewClient(srv.URL, nil, srv.Client())

	_, err := c.Request(context.Background(), "query { me }", nil, "", nil)

	var ferr *fetch.FetchError
	if !errors.As(err, &ferr) {
		t.Fatalf("expected *fetch.FetchError, got %T (%v)", err, err)
	}

	if ferr.Status != http.StatusUnauthorized {
		t.Fatalf("status = %d", ferr.Status)
	}
}
