package nhostclient_test

import (
	"bytes"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/nhost/nhost/internal/lib/nhostclient"
)

type mockDoer struct {
	calls    int
	failFor  int
	err      error
	response *http.Response
	bodies   []string
}

func (m *mockDoer) Do(req *http.Request) (*http.Response, error) {
	m.calls++

	if req.Body != nil {
		b, _ := io.ReadAll(req.Body)
		req.Body.Close()
		m.bodies = append(m.bodies, string(b))
	}

	if m.calls <= m.failFor {
		return nil, m.err
	}

	return m.response, nil
}

func (m *mockDoer) Post(_, _ string, _ io.Reader) (*http.Response, error) {
	m.calls++
	if m.calls <= m.failFor {
		return nil, m.err
	}

	return m.response, nil
}

var errTransient = errors.New("connection reset")

func TestRetryDoer_SuccessFirstTry(t *testing.T) {
	t.Parallel()

	mock := &mockDoer{
		failFor:  0,
		response: &http.Response{StatusCode: http.StatusOK}, //nolint:exhaustruct
	}

	doer := nhostclient.NewRetryDoer(mock, nhostclient.WithBaseDelay(time.Millisecond))

	resp, err := doer.Do(&http.Request{}) //nolint:exhaustruct
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	if mock.calls != 1 {
		t.Fatalf("expected 1 call, got %d", mock.calls)
	}
}

func TestRetryDoer_SuccessAfterRetries(t *testing.T) {
	t.Parallel()

	mock := &mockDoer{
		failFor:  2,
		err:      errTransient,
		response: &http.Response{StatusCode: http.StatusOK}, //nolint:exhaustruct
	}

	doer := nhostclient.NewRetryDoer(
		mock,
		nhostclient.WithMaxRetries(3),
		nhostclient.WithBaseDelay(time.Millisecond),
	)

	resp, err := doer.Do(&http.Request{}) //nolint:exhaustruct
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	if mock.calls != 3 {
		t.Fatalf("expected 3 calls, got %d", mock.calls)
	}
}

func TestRetryDoer_ExhaustsRetries(t *testing.T) {
	t.Parallel()

	mock := &mockDoer{
		failFor: 100,
		err:     errTransient,
	}

	doer := nhostclient.NewRetryDoer(
		mock,
		nhostclient.WithMaxRetries(2),
		nhostclient.WithBaseDelay(time.Millisecond),
	)

	_, err := doer.Do(&http.Request{}) //nolint:exhaustruct
	if !errors.Is(err, errTransient) {
		t.Fatalf("expected errTransient, got: %v", err)
	}

	// 1 initial + 2 retries = 3
	if mock.calls != 3 {
		t.Fatalf("expected 3 calls, got %d", mock.calls)
	}
}

func TestRetryDoer_RetriesPreserveRequestBody(t *testing.T) {
	t.Parallel()

	const body = `{"email":"test@example.com"}`

	mock := &mockDoer{
		failFor:  2,
		err:      errTransient,
		response: &http.Response{StatusCode: http.StatusOK}, //nolint:exhaustruct
	}

	doer := nhostclient.NewRetryDoer(
		mock,
		nhostclient.WithMaxRetries(3),
		nhostclient.WithBaseDelay(time.Millisecond),
	)

	req, err := http.NewRequest( //nolint:noctx
		http.MethodPost,
		"http://localhost/test",
		strings.NewReader(body),
	)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	resp, err := doer.Do(req)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	if mock.calls != 3 {
		t.Fatalf("expected 3 calls, got %d", mock.calls)
	}

	for i, got := range mock.bodies {
		if got != body {
			t.Fatalf("call %d: expected body %q, got %q", i+1, body, got)
		}
	}
}

func TestRetryDoer_RetriesPreserveRequestBodyBytesReader(t *testing.T) {
	t.Parallel()

	const body = `{"token":"abc123"}`

	mock := &mockDoer{
		failFor:  1,
		err:      errTransient,
		response: &http.Response{StatusCode: http.StatusOK}, //nolint:exhaustruct
	}

	doer := nhostclient.NewRetryDoer(
		mock,
		nhostclient.WithMaxRetries(2),
		nhostclient.WithBaseDelay(time.Millisecond),
	)

	req, err := http.NewRequest( //nolint:noctx
		http.MethodPost,
		"http://localhost/test",
		bytes.NewReader([]byte(body)),
	)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	resp, err := doer.Do(req)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	if mock.calls != 2 {
		t.Fatalf("expected 2 calls, got %d", mock.calls)
	}

	for i, got := range mock.bodies {
		if got != body {
			t.Fatalf("call %d: expected body %q, got %q", i+1, body, got)
		}
	}
}

func TestRetryDoer_DefaultsToHTTPDefaultClient(t *testing.T) {
	t.Parallel()

	doer := nhostclient.NewRetryDoer(nil)
	if doer == nil {
		t.Fatal("expected non-nil doer")
	}
}
