package embedder_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/ai/autoai/embedder"
)

func declaration(name, adapter, base string, headers map[string]string) string {
	if headers == nil {
		headers = map[string]string{}
	}

	encoded, err := json.Marshal([]map[string]any{{
		"name":          name,
		"type":          adapter,
		"configuration": map[string]any{"base_url": base, "headers": headers},
	}})
	if err != nil {
		panic(err)
	}

	return string(encoded)
}

func build(t *testing.T, adapter, base string, headers map[string]string) embedder.Embedder {
	t.Helper()

	result, err := embedder.BuildConfiguredEmbedders(
		declaration("test", adapter, base, headers),
		nil,
	)
	if err != nil {
		t.Fatal(err)
	}

	return result.Registry["test"]
}

// serve answers every request with status and body.
func serve(t *testing.T, status int, body string) string {
	t.Helper()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(status)

		if _, err := io.WriteString(w, body); err != nil {
			t.Error(err)
		}
	}))
	t.Cleanup(server.Close)

	return server.URL
}

func request(inputs ...string) embedder.Request {
	return embedder.Request{
		Model:      "model",
		Inputs:     inputs,
		Dimensions: 2,
		Kind:       embedder.Document,
	}
}

func requireClass(t *testing.T, err error, want embedder.ErrorClass) {
	t.Helper()

	var status *embedder.StatusError
	if !errors.As(err, &status) {
		t.Fatalf("expected classified error, got %v", err)
	}

	if diff := cmp.Diff(want, status.Class); diff != "" {
		t.Fatal(diff)
	}
}

func TestConfiguration(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name, raw            string
		legacy               *embedder.LegacyOpenAI
		synthesized, ignored bool
		want                 map[string]string
		invalid              bool
	}{
		{name: "empty", want: map[string]string{}},
		{
			name: "declared",
			raw:  declaration("local", "openai_embeddings", "http://ollama:11434/v1", nil),
			want: map[string]string{"local": "openai_embeddings"},
		},
		{
			name:        "legacy key",
			legacy:      &embedder.LegacyOpenAI{APIKey: "key"},
			synthesized: true,
			want:        map[string]string{"openai": "openai_embeddings"},
		},
		{
			name:    "declared openai wins over legacy key",
			raw:     declaration("openai", "voyage_embeddings", "http://local", nil),
			legacy:  &embedder.LegacyOpenAI{APIKey: "key"},
			ignored: true,
			want:    map[string]string{"openai": "voyage_embeddings"},
		},
		{
			name:    "unknown type",
			raw:     declaration("a", "unknown", "http://local", nil),
			invalid: true,
		},
		{
			name:    "openai base with path",
			raw:     declaration("a", "openai_embeddings", "http://local/v1/embeddings", nil),
			invalid: true,
		},
		{
			name:    "voyage base with version",
			raw:     declaration("a", "voyage_embeddings", "http://local/v1", nil),
			invalid: true,
		},
		{
			name:    "gemini base with version",
			raw:     declaration("a", "google_gemini_embeddings", "http://local/v1beta", nil),
			invalid: true,
		},
		{
			name: "gemini forbidden header",
			raw: declaration(
				"a", "google_gemini_embeddings", "http://local",
				map[string]string{"X-Goog-Api-Client": "ambient"},
			),
			invalid: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			result, err := embedder.BuildConfiguredEmbedders(tt.raw, tt.legacy)
			if tt.invalid {
				if !errors.Is(err, embedder.ErrInvalidConfiguration) {
					t.Fatalf("error = %v, want invalid configuration", err)
				}

				return
			}

			if err != nil {
				t.Fatal(err)
			}

			if diff := cmp.Diff(tt.want, result.Types); diff != "" {
				t.Error(diff)
			}

			if result.LegacySynthesized != tt.synthesized || result.LegacyIgnored != tt.ignored {
				t.Errorf("legacy = %v/%v", result.LegacySynthesized, result.LegacyIgnored)
			}
		})
	}
}

func TestAdapters(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name, adapter, model, path, response, wantBody string
		headers                                        map[string]string
	}{
		{
			name:     "openai sends dimensions for text-embedding-3",
			adapter:  "openai_embeddings",
			model:    "text-embedding-3-small",
			path:     "/embeddings",
			response: `{"data":[{"index":1,"embedding":[3,4]},{"index":0,"embedding":[1,2]}]}`,
			wantBody: `{"model":"text-embedding-3-small","input":["one","two"],"encoding_format":"float","dimensions":2}`,
		},
		{
			name:     "openai-compatible without indexes",
			adapter:  "openai_embeddings",
			model:    "nomic-embed-text",
			path:     "/embeddings",
			response: `{"data":[{"embedding":[1,2]},{"embedding":[3,4]}]}`,
			wantBody: `{"model":"nomic-embed-text","input":["one","two"],"encoding_format":"float"}`,
		},
		{
			name:     "voyage flexible dimensions",
			adapter:  "voyage_embeddings",
			model:    "voyage-3.5",
			path:     "/v1/embeddings",
			response: `{"data":[{"index":0,"embedding":[1,2]},{"index":1,"embedding":[3,4]}]}`,
			wantBody: `{"model":"voyage-3.5","input":["one","two"],"input_type":"document","output_dimension":2}`,
		},
		{
			name:     "voyage fixed dimensions",
			adapter:  "voyage_embeddings",
			model:    "voyage-law-2",
			path:     "/v1/embeddings",
			response: `{"data":[{"index":0,"embedding":[1,2]},{"index":1,"embedding":[3,4]}]}`,
			wantBody: `{"model":"voyage-law-2","input":["one","two"],"input_type":"document"}`,
		},
		{
			name:     "gemini",
			adapter:  "google_gemini_embeddings",
			model:    "models/gemini-embedding-001",
			path:     "/v1beta/models/gemini-embedding-001:batchEmbedContents",
			response: `{"embeddings":[{"values":[1,2]},{"values":[3,4]}]}`,
			wantBody: `{"requests":[` +
				`{"model":"models/gemini-embedding-001","content":{"parts":[{"text":"one"}]},"taskType":"RETRIEVAL_DOCUMENT","outputDimensionality":2},` +
				`{"model":"models/gemini-embedding-001","content":{"parts":[{"text":"two"}]},"taskType":"RETRIEVAL_DOCUMENT","outputDimensionality":2}]}`,
			headers: map[string]string{"x-goog-api-key": "declared-key"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			server := httptest.NewServer(
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					if diff := cmp.Diff(tt.path, r.URL.EscapedPath()); diff != "" {
						t.Error(diff)
					}

					for name, value := range tt.headers {
						if r.Header.Get(name) != value {
							t.Errorf("header %s not sent", name)
						}
					}

					if r.Header.Get("User-Agent") != "nhost-ai" {
						t.Errorf("User-Agent = %q", r.Header.Get("User-Agent"))
					}

					var got, want any
					if err := json.NewDecoder(r.Body).Decode(&got); err != nil {
						t.Error(err)
					}

					if err := json.Unmarshal([]byte(tt.wantBody), &want); err != nil {
						t.Error(err)
					}

					if diff := cmp.Diff(want, got); diff != "" {
						t.Error(diff)
					}

					if _, err := io.WriteString(w, tt.response); err != nil {
						t.Error(err)
					}
				}),
			)
			defer server.Close()

			req := request("one", "two")
			req.Model = tt.model

			got, err := build(t, tt.adapter, server.URL, tt.headers).Embed(t.Context(), req)
			if err != nil {
				t.Fatal(err)
			}

			if diff := cmp.Diff([][]float32{{1, 2}, {3, 4}}, got); diff != "" {
				t.Error(diff)
			}
		})
	}
}

func TestMalformedResponses(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name, adapter, response string
	}{
		{"invalid json", "openai_embeddings", `not json`},
		{"wrong count", "openai_embeddings", `{"data":[{"embedding":[1,2]}]}`},
		{
			"duplicate indexes",
			"openai_embeddings",
			`{"data":[{"index":0,"embedding":[1,2]},{"index":0,"embedding":[3,4]}]}`,
		},
		{
			"voyage requires indexes",
			"voyage_embeddings",
			`{"data":[{"embedding":[1,2]},{"embedding":[3,4]}]}`,
		},
		{"gemini wrong count", "google_gemini_embeddings", `{"embeddings":[{"values":[1,2]}]}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			_, err := build(t, tt.adapter, serve(t, http.StatusOK, tt.response), nil).
				Embed(t.Context(), request("a", "b"))
			requireClass(t, err, embedder.Configuration)
		})
	}
}

func TestHTTPErrors(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name, adapter, body string
		status              int
		class               embedder.ErrorClass
		message             string
	}{
		{
			"bad request",
			"openai_embeddings",
			"",
			400,
			embedder.Configuration,
			"provider rejected request",
		},
		{"timeout", "openai_embeddings", "", 408, embedder.Transient, "provider rejected request"},
		{"too large", "openai_embeddings", "", 413, embedder.Input, "provider rejected request"},
		{
			"rate limited",
			"openai_embeddings",
			"",
			429,
			embedder.Transient,
			"provider rejected request",
		},
		{
			"server error",
			"openai_embeddings",
			"",
			500,
			embedder.Transient,
			"provider rejected request",
		},
		{
			"quota",
			"openai_embeddings",
			`{"error":{"code":"insufficient_quota"}}`,
			429,
			embedder.Configuration,
			"provider quota exhausted",
		},
		{
			"context length",
			"openai_embeddings",
			`{"error":{"message":"This model's maximum context length is 8192 tokens","code":null}}`,
			400,
			embedder.Input,
			"input exceeds model context length",
		},
		{
			"top-level batch token limit",
			"openai_embeddings",
			`{"object":"error","message":"Too many tokens overall, split into more batches.","type":"invalid_request_error","param":null,"code":null}`,
			400,
			embedder.Input,
			"batch exceeds provider token limit",
		},
		{
			"nested batch token limit is match-only",
			"openai_embeddings",
			`{"error":{"message":"Too many tokens overall: Bearer secret"}}`,
			400,
			embedder.Input,
			"batch exceeds provider token limit",
		},
		{
			"batch splitting instruction",
			"openai_embeddings",
			`{"message":"SPLIT INTO MORE BATCHES: Bearer secret"}`,
			422,
			embedder.Input,
			"batch exceeds provider token limit",
		},
		{
			"batch text does not override server failure",
			"openai_embeddings",
			`{"message":"Too many tokens overall, split into more batches."}`,
			500,
			embedder.Transient,
			"provider rejected request",
		},
		{
			"unrecognized top-level text is never echoed",
			"openai_embeddings",
			`{"message":"Bearer secret"}`,
			400,
			embedder.Configuration,
			"provider rejected request",
		},
		{
			"gemini invalid key",
			"google_gemini_embeddings",
			`{"error":{"details":[{"@type":"type.googleapis.com/google.rpc.ErrorInfo","reason":"API_KEY_INVALID"}]}}`,
			400,
			embedder.Configuration,
			"API key is invalid",
		},
		{
			"provider text is never echoed",
			"openai_embeddings",
			`{"error":{"code":"Bearer secret","message":"Bearer secret","type":"secret"}}`,
			400,
			embedder.Configuration,
			"provider rejected request",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			_, err := build(t, tt.adapter, serve(t, tt.status, tt.body), nil).
				Embed(t.Context(), request("a"))
			requireClass(t, err, tt.class)

			want := fmt.Sprintf("embedding request: HTTP status %d: %s", tt.status, tt.message)
			if diff := cmp.Diff(want, err.Error()); diff != "" {
				t.Error(diff)
			}
		})
	}
}

func TestRequestRejections(t *testing.T) {
	t.Parallel()

	destination := serve(t, http.StatusOK, "")

	redirect := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, destination, http.StatusTemporaryRedirect)
	}))
	defer redirect.Close()

	client := build(t, "openai_embeddings", redirect.URL, nil)

	_, err := client.Embed(t.Context(), request("a"))
	requireClass(t, err, embedder.Configuration)

	_, err = client.Embed(t.Context(), request("a", " "))
	requireClass(t, err, embedder.Input)

	ctx, cancel := context.WithCancel(t.Context())
	cancel()

	_, err = client.Embed(ctx, request("a"))
	requireClass(t, err, embedder.Canceled)
}

func TestLegacyOpenAI(t *testing.T) {
	t.Parallel()

	transport := roundTripFunc(func(req *http.Request) (*http.Response, error) {
		if req.URL.String() != "https://api.openai.com/v1/embeddings" ||
			req.Header.Get("Authorization") != "Bearer legacy-key" ||
			req.Header.Get("OpenAI-Organization") != "legacy-org" {
			t.Errorf("unexpected request %s %v", req.URL, req.Header)
		}

		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     make(http.Header),
			Body:       io.NopCloser(strings.NewReader(`{"data":[{"embedding":[1,2]}]}`)),
		}, nil
	})

	result, err := embedder.BuildConfiguredEmbedders(
		"",
		&embedder.LegacyOpenAI{APIKey: "legacy-key", Organization: "legacy-org"},
		embedder.WithTransport(transport),
	)
	if err != nil {
		t.Fatal(err)
	}

	got, err := result.Registry["openai"].Embed(t.Context(), request("text"))
	if err != nil {
		t.Fatal(err)
	}

	if diff := cmp.Diff([][]float32{{1, 2}}, got); diff != "" {
		t.Error(diff)
	}
}

func TestBatchLimits(t *testing.T) {
	t.Parallel()

	for adapter, maxInputs := range map[string]int{
		"openai_embeddings":        100,
		"voyage_embeddings":        1000,
		"google_gemini_embeddings": 100,
	} {
		got := build(t, adapter, "http://local", nil).BatchLimits()
		if diff := cmp.Diff(
			embedder.Limits{MaxInputs: maxInputs, MaxBytes: 256 * 1024},
			got,
		); diff != "" {
			t.Errorf("%s: %s", adapter, diff)
		}
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) { return f(req) }

func TestSplit(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		inputs []string
		limits embedder.Limits
		want   [][]string
	}{
		{"unlimited", []string{"a", "b"}, embedder.Limits{}, [][]string{{"a", "b"}}},
		{
			"count",
			[]string{"a", "b", "c"},
			embedder.Limits{MaxInputs: 2},
			[][]string{{"a", "b"}, {"c"}},
		},
		{
			"oversized input goes alone",
			[]string{"a", "oversized", "b"},
			embedder.Limits{MaxBytes: 2},
			[][]string{{"a"}, {"oversized"}, {"b"}},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var got [][]string
			for _, batch := range embedder.Split(request(tt.inputs...), tt.limits) {
				got = append(got, batch.Inputs)
			}

			if diff := cmp.Diff(tt.want, got); diff != "" {
				t.Error(diff)
			}
		})
	}
}

func TestValidate(t *testing.T) {
	t.Parallel()

	if err := embedder.Validate([][]float32{{1, 2}}, request("a")); err != nil {
		t.Fatal(err)
	}

	for _, vectors := range [][][]float32{
		nil,
		{{1}},
		{{float32(math.NaN()), 1}},
	} {
		requireClass(t, embedder.Validate(vectors, request("a")), embedder.Configuration)
	}
}

type fakeClock struct {
	now    time.Time
	waits  []time.Duration
	cancel context.CancelFunc
}

func (c *fakeClock) Now() time.Time { return c.now }

func (c *fakeClock) Sleep(ctx context.Context, d time.Duration) error {
	c.waits = append(c.waits, d)

	c.now = c.now.Add(d)
	if c.cancel != nil {
		c.cancel()
		return fmt.Errorf("fake sleep: %w", ctx.Err())
	}

	return nil
}

func TestRetry(t *testing.T) {
	t.Parallel()

	rateLimited := &embedder.StatusError{
		Class:      embedder.Transient,
		StatusCode: 429,
		RetryAfter: "3",
	}

	// failures < 0 means every call fails.
	tests := []struct {
		name      string
		err       error
		failures  int
		policy    embedder.RetryPolicy
		cancel    bool
		wantCalls int
		wantWaits []time.Duration
		wantClass embedder.ErrorClass // empty means success
	}{
		{
			name:      "zero policy tries once",
			err:       http.ErrServerClosed,
			failures:  -1,
			wantCalls: 1,
			wantClass: embedder.Transient,
		},
		{
			name:      "backoff until success",
			err:       http.ErrServerClosed,
			failures:  2,
			policy:    embedder.RetryPolicy{MaxAttempts: 3},
			wantCalls: 3,
			wantWaits: []time.Duration{time.Second, 2 * time.Second},
		},
		{
			name:      "wrapped deadline with live context is retried",
			err:       fmt.Errorf("transport timeout: %w", context.DeadlineExceeded),
			failures:  -1,
			policy:    embedder.RetryPolicy{MaxAttempts: 3},
			wantCalls: 3,
			wantWaits: []time.Duration{time.Second, 2 * time.Second},
			wantClass: embedder.Transient,
		},
		{
			name:      "wrapped cancellation with live context is retried",
			err:       fmt.Errorf("transport canceled: %w", context.Canceled),
			failures:  -1,
			policy:    embedder.RetryPolicy{MaxAttempts: 3},
			wantCalls: 3,
			wantWaits: []time.Duration{time.Second, 2 * time.Second},
			wantClass: embedder.Transient,
		},
		{
			name:      "honours Retry-After",
			err:       rateLimited,
			failures:  -1,
			policy:    embedder.RetryPolicy{MaxAttempts: 2},
			wantCalls: 2,
			wantWaits: []time.Duration{3 * time.Second},
			wantClass: embedder.Transient,
		},
		{
			name:      "non-transient not retried",
			err:       &embedder.StatusError{Class: embedder.Input, StatusCode: 413},
			failures:  -1,
			policy:    embedder.RetryPolicy{MaxAttempts: 3},
			wantCalls: 1,
			wantClass: embedder.Input,
		},
		{
			name:      "wait budget",
			err:       http.ErrServerClosed,
			failures:  -1,
			policy:    embedder.RetryPolicy{MaxAttempts: 10, MaxWait: 2 * time.Second},
			wantCalls: 2,
			wantWaits: []time.Duration{time.Second},
			wantClass: embedder.Transient,
		},
		{
			name:      "canceled while waiting",
			err:       http.ErrServerClosed,
			failures:  -1,
			policy:    embedder.RetryPolicy{MaxAttempts: 3},
			cancel:    true,
			wantCalls: 1,
			wantWaits: []time.Duration{time.Second},
			wantClass: embedder.Canceled,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctx, cancel := context.WithCancel(t.Context())
			defer cancel()

			clock := &fakeClock{now: time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC)}
			if tt.cancel {
				clock.cancel = cancel
			}

			policy := tt.policy
			if policy.MaxAttempts > 0 {
				policy.Clock = clock
				policy.Jitter = func(time.Duration) time.Duration { return 0 }
			}

			calls := 0
			err := embedder.WithRetry(ctx, policy, func() error {
				calls++
				if tt.failures < 0 || calls <= tt.failures {
					return tt.err
				}

				return nil
			})

			if tt.wantClass == "" {
				if err != nil {
					t.Fatal(err)
				}
			} else {
				requireClass(t, err, tt.wantClass)
			}

			if calls != tt.wantCalls {
				t.Errorf("calls = %d, want %d", calls, tt.wantCalls)
			}

			if diff := cmp.Diff(tt.wantWaits, clock.waits); diff != "" {
				t.Error(diff)
			}
		})
	}
}
