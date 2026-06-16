package remoteschema

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
)

// These white-box tests cover introspectRaw, the unexported worker behind
// IntrospectRawFromMeta. They assert the two behaviours the controller depends
// on: the raw `data` document is returned verbatim on success, and every
// failure mode (transport error, 200-with-GraphQL-errors, malformed 200 body)
// is wrapped in ErrIntrospection so classifyMutationError maps it to
// remote-schema-error — matching the validator (New) path.

// fakeDoer is a minimal HTTPDoer returning a canned response/error, driving
// introspectRaw's branches without a live server.
type fakeDoer struct {
	resp *http.Response
	err  error
}

func (f fakeDoer) Do(*http.Request) (*http.Response, error) { return f.resp, f.err }

func okResponse(body string) *http.Response {
	return &http.Response{ //nolint:exhaustruct
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}

func TestIntrospectRaw_ReturnsRawDataVerbatim(t *testing.T) {
	t.Parallel()

	const data = `{"__schema":{"queryType":{"name":"Query"}}}`

	doer := fakeDoer{resp: okResponse(`{"data":` + data + `,"errors":null}`), err: nil}

	raw, err := introspectRaw(context.Background(), "http://example.com", nil, doer)
	if err != nil {
		t.Fatalf("introspectRaw() error: %v", err)
	}

	if string(raw) != data {
		t.Errorf("raw data = %s, want %s", raw, data)
	}
}

func TestIntrospectRaw_TransportErrorWrapsErrIntrospection(t *testing.T) {
	t.Parallel()

	doer := fakeDoer{resp: nil, err: errors.New("connection refused")}

	_, err := introspectRaw(context.Background(), "http://example.com", nil, doer)
	if !errors.Is(err, ErrIntrospection) {
		t.Errorf("expected ErrIntrospection, got: %v", err)
	}
}

func TestIntrospectRaw_GraphQLErrorsWrapErrIntrospection(t *testing.T) {
	t.Parallel()

	doer := fakeDoer{
		resp: okResponse(`{"data":null,"errors":[{"message":"introspection disabled"}]}`),
		err:  nil,
	}

	_, err := introspectRaw(context.Background(), "http://example.com", nil, doer)
	if !errors.Is(err, ErrIntrospection) {
		t.Errorf("expected ErrIntrospection, got: %v", err)
	}

	if !errors.Is(err, ErrIntrospectionResponse) {
		t.Errorf("expected ErrIntrospectionResponse, got: %v", err)
	}
}

func TestIntrospectRaw_MalformedResponseWrapsErrIntrospection(t *testing.T) {
	t.Parallel()

	doer := fakeDoer{resp: okResponse(`this is not json`), err: nil}

	_, err := introspectRaw(context.Background(), "http://example.com", nil, doer)
	if !errors.Is(err, ErrIntrospection) {
		t.Errorf("expected ErrIntrospection on malformed 200, got: %v", err)
	}
}
