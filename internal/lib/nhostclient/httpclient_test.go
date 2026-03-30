package nhostclient_test

import (
	"errors"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/nhost/nhost/internal/lib/nhostclient"
)

type mockDoer struct {
	calls    int
	failFor  int
	err      error
	response *http.Response
}

func (m *mockDoer) Do(_ *http.Request) (*http.Response, error) {
	m.calls++
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

func TestRetryDoer_DefaultsToHTTPDefaultClient(t *testing.T) {
	t.Parallel()

	doer := nhostclient.NewRetryDoer(nil)
	if doer == nil {
		t.Fatal("expected non-nil doer")
	}
}
