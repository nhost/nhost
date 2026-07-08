package graphql_test

import (
	"context"
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
