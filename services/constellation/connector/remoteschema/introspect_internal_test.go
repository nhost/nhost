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

// errStubTransport is a static stand-in for a transport-layer failure (e.g. a
// refused dial), kept package-level to satisfy err113's wrapped-static-error
// rule.
var errStubTransport = errors.New("connection refused")

// okDoer wraps a canned 200 body in a fakeDoer. The body is a NopCloser (no
// resource to close); returning a fakeDoer rather than a *http.Response also
// keeps bodyclose from tracking a response whose lifecycle the interface
// consumer (introspectRaw -> httpClient.do) owns.
func okDoer(body string) fakeDoer {
	return fakeDoer{
		resp: &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(strings.NewReader(body)),
		},
		err: nil,
	}
}

func TestIntrospectRaw_ReturnsRawDataVerbatim(t *testing.T) {
	t.Parallel()

	const data = `{"__schema":{"queryType":{"name":"Query"}}}`

	doer := okDoer(`{"data":` + data + `,"errors":null}`)

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

	doer := fakeDoer{resp: nil, err: errStubTransport}

	_, err := introspectRaw(context.Background(), "http://example.com", nil, doer)
	if !errors.Is(err, ErrIntrospection) {
		t.Errorf("expected ErrIntrospection, got: %v", err)
	}
}

func TestIntrospectRaw_GraphQLErrorsWrapErrIntrospection(t *testing.T) {
	t.Parallel()

	doer := okDoer(`{"data":null,"errors":[{"message":"introspection disabled"}]}`)

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

	doer := okDoer(`this is not json`)

	_, err := introspectRaw(context.Background(), "http://example.com", nil, doer)
	if !errors.Is(err, ErrIntrospection) {
		t.Errorf("expected ErrIntrospection on malformed 200, got: %v", err)
	}
}

// A spec-noncompliant upstream can answer 200 with no errors and empty/null
// data; both shapes must classify as ErrIntrospection rather than yielding a
// degenerate "null" document or an empty RawMessage that fails downstream.
func TestIntrospectRaw_NullDataWrapsErrIntrospection(t *testing.T) {
	t.Parallel()

	doer := okDoer(`{"data":null,"errors":null}`)

	_, err := introspectRaw(context.Background(), "http://example.com", nil, doer)
	if !errors.Is(err, ErrIntrospection) {
		t.Errorf("expected ErrIntrospection on data:null, got: %v", err)
	}
}

func TestIntrospectRaw_AbsentDataWrapsErrIntrospection(t *testing.T) {
	t.Parallel()

	doer := okDoer(`{"errors":null}`)

	_, err := introspectRaw(context.Background(), "http://example.com", nil, doer)
	if !errors.Is(err, ErrIntrospection) {
		t.Errorf("expected ErrIntrospection on absent data, got: %v", err)
	}
}
