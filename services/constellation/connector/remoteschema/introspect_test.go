package remoteschema_test

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/remoteschema"
	"github.com/nhost/nhost/services/constellation/connector/remoteschema/mock"
	"go.uber.org/mock/gomock"
)

// The TestIntrospect_* family covers the exported Introspect entry point
// directly: the happy path returning a populated graph.Schema, the error path
// when the remote endpoint surfaces top-level GraphQL errors, and the
// doer == nil default which substitutes http.DefaultClient. The
// connector_test.go suite only reaches introspectViaHTTP through
// remoteschema.New, so without these cases the new public API has no
// dedicated coverage and the nil-doer fallback in introspect.go is
// exercised only by accident.

func TestIntrospect_Success(t *testing.T) {
	t.Parallel()

	server := newTestServer(t)
	defer server.Close()

	schema, err := remoteschema.Introspect(
		context.Background(), server.URL, nil, nil,
	)
	if err != nil {
		t.Fatalf("Introspect() error: %v", err)
	}

	if schema == nil {
		t.Fatal("expected non-nil schema")
	}

	if schema.QueryType == nil || *schema.QueryType != "Query" {
		t.Errorf("expected QueryType=Query, got %v", schema.QueryType)
	}

	// At least one of the introspected types from testIntrospectionResponse
	// must survive the conversion; otherwise the success path returned a
	// hollow schema and the assertion above would still pass.
	if len(schema.Types) == 0 {
		t.Error("expected at least one object type")
	}
}

func TestIntrospect_ForwardsConfiguredHeaders(t *testing.T) {
	t.Parallel()

	var receivedAPIKey string

	server := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			receivedAPIKey = r.Header.Get("X-Api-Key")

			w.Header().Set("Content-Type", "application/json")
			writeOrFail(t, w, []byte(testIntrospectionResponse))
		},
	))
	defer server.Close()

	headers := map[string]string{"X-Api-Key": "secret-token"}

	if _, err := remoteschema.Introspect(
		context.Background(), server.URL, headers, nil,
	); err != nil {
		t.Fatalf("Introspect() error: %v", err)
	}

	if receivedAPIKey != "secret-token" {
		t.Errorf("expected configured header on outgoing request, got %q", receivedAPIKey)
	}
}

func TestIntrospect_NonOKStatus(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			writeOrFail(t, w, []byte("boom"))
		},
	))
	defer server.Close()

	_, err := remoteschema.Introspect(
		context.Background(), server.URL, nil, nil,
	)
	if err == nil {
		t.Fatal("expected error on non-200 status")
	}

	if !errors.Is(err, remoteschema.ErrRemoteStatus) {
		t.Errorf("expected ErrRemoteStatus, got: %v", err)
	}
}

func TestIntrospect_GraphQLErrors(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	mockDoer := mock.NewMockHTTPDoer(ctrl)

	mockDoer.EXPECT().Do(gomock.Any()).Return(&http.Response{
		StatusCode: http.StatusOK,
		Body: io.NopCloser(strings.NewReader(
			`{"data":null,"errors":[{"message":"introspection disabled"}]}`,
		)),
	}, nil)

	_, err := remoteschema.Introspect(
		context.Background(), "http://example.com", nil, mockDoer,
	)
	if err == nil {
		t.Fatal("expected error when introspection returns GraphQL errors")
	}

	if !errors.Is(err, remoteschema.ErrIntrospectionResponse) {
		t.Errorf("expected ErrIntrospectionResponse, got: %v", err)
	}

	if !strings.Contains(err.Error(), "introspection disabled") {
		t.Errorf("expected upstream message in error, got: %v", err)
	}
}

// TestIntrospectRawFromMeta_* cover the exported entry point used by the
// metadata API's introspect_remote_schema / reload_remote_schema handlers:
// success returns the raw `data` document, and a non-http(s) URL is rejected by
// validateRemoteURL before any request is made.

func TestIntrospectRawFromMeta_Success(t *testing.T) {
	t.Parallel()

	server := newTestServer(t)
	defer server.Close()

	raw, err := remoteschema.IntrospectRawFromMeta(
		context.Background(), newTestMetadata(server.URL, nil), nil,
	)
	if err != nil {
		t.Fatalf("IntrospectRawFromMeta() error: %v", err)
	}

	// The raw document is the GraphQL response's `data` object, i.e. the
	// { "__schema": { ... } } payload echoed verbatim.
	if !strings.Contains(string(raw), `"__schema"`) {
		t.Errorf("expected raw __schema document, got: %s", raw)
	}
}

func TestIntrospectRawFromMeta_RejectsNonHTTPURL(t *testing.T) {
	t.Parallel()

	_, err := remoteschema.IntrospectRawFromMeta(
		context.Background(), newTestMetadata("ftp://example.com/graphql", nil), nil,
	)
	if !errors.Is(err, remoteschema.ErrUnsupportedURLScheme) {
		t.Errorf("expected ErrUnsupportedURLScheme, got: %v", err)
	}
}

func TestIntrospect_NilDoerUsesDefaultClient(t *testing.T) {
	t.Parallel()

	// A real httptest.Server is the only way to exercise the
	// http.DefaultClient fallback without injecting state into the package
	// under test. Hitting the server proves the default client was wired
	// up correctly when doer == nil.
	var hits int

	server := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, _ *http.Request) {
			hits++

			w.Header().Set("Content-Type", "application/json")
			writeOrFail(t, w, []byte(testIntrospectionResponse))
		},
	))
	defer server.Close()

	schema, err := remoteschema.Introspect(
		context.Background(), server.URL, nil, nil,
	)
	if err != nil {
		t.Fatalf("Introspect() error: %v", err)
	}

	if hits != 1 {
		t.Errorf("expected exactly one upstream request via DefaultClient, got %d", hits)
	}

	if schema == nil {
		t.Fatal("expected non-nil schema from DefaultClient path")
	}
}
