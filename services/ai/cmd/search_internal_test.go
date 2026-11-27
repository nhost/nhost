package cmd

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gqlgo/gqlgenc/clientv2"
	"github.com/nhost/nhost/services/ai/autoai/embedder"
	"github.com/nhost/nhost/services/ai/hasura"
)

var errPrivateLookup = errors.New("private lookup detail")

func TestSearchContract(t *testing.T) {
	t.Parallel()

	const id = "11111111-1111-1111-1111-111111111111"

	request := `{"configuration_id":"` + id + `","query":"hello"}`

	tests := []struct {
		name, body, provider string
		lookupErr, missing   bool
		want                 int
		message              string // empty means success
	}{
		{name: "success", body: request, provider: "selected", want: 200},
		{name: "malformed", body: "{", want: 400, message: "invalid request JSON"},
		{
			name:    "invalid id",
			body:    `{"configuration_id":"bad"}`,
			want:    400,
			message: "invalid configuration_id",
		},
		{
			name:    "pre-upgrade function",
			body:    `{"query":"hello","model":"old-model"}`,
			want:    400,
			message: "search function was deployed by an older ai service; restart the service to redeploy it and check the configuration's last_error",
		},
		{
			name:      "lookup failure",
			body:      request,
			lookupErr: true,
			want:      502,
			message:   "configuration lookup failed",
		},
		{
			name:    "unknown configuration",
			body:    request,
			missing: true,
			want:    404,
			message: "configuration not found",
		},
		{
			name:     "undeclared provider",
			body:     request,
			provider: "absent",
			want:     422,
			message:  "embedding provider is not declared",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			h := &webhookHandler{
				autoAI: nil,
				embeddings: embedder.Registry{
					"selected": embedderFunc(
						func(ctx context.Context, req embedder.Request) ([][]float32, error) {
							// The embedding space comes from the configuration row.
							if _, ok := ctx.Deadline(); !ok || req.Model != "configured-model" ||
								req.Dimensions != 2 || req.Kind != embedder.Query {
								t.Error("request did not use the configuration under a deadline")
							}

							return [][]float32{{1, 0}}, nil
						},
					),
				},
				hasura: autoEmbeddingsConfigurationGetterFunc(
					func(_ context.Context, got string, _ ...clientv2.RequestInterceptor) (*hasura.GetAiAutoEmbeddingsConfiguration, error) {
						switch {
						case got != id:
							t.Error("lookup id differs")
						case tt.lookupErr:
							return nil, errPrivateLookup
						case tt.missing:
							return &hasura.GetAiAutoEmbeddingsConfiguration{
								AiAutoEmbeddingsConfiguration: nil,
							}, nil
						}

						return &hasura.GetAiAutoEmbeddingsConfiguration{
							AiAutoEmbeddingsConfiguration: &hasura.AiAutoEmbeddingsConfigurationFragment{
								Provider:   tt.provider,
								Model:      "configured-model",
								Dimensions: 2,
							},
						}, nil
					},
				),
			}

			var logs bytes.Buffer

			router := setupRouter(
				"/v1",
				"test",
				"secret",
				[]string{"*"},
				h,
				&agentHandlersStub{},
				slog.New(slog.NewTextHandler(&logs, nil)),
			)
			r := httptest.NewRequest(
				http.MethodPost,
				"/v1/webhooks/generate-embeddings",
				strings.NewReader(tt.body),
			)
			r.Header.Set("X-AI-Webhook-Secret", "secret")

			w := httptest.NewRecorder()
			router.ServeHTTP(w, r)

			want := `{"embeddings":[1,0]}`
			if tt.message != "" {
				b, err := json.Marshal(map[string]string{"error": tt.message})
				if err != nil {
					t.Fatal(err)
				}

				want = string(b)
			}

			if w.Code != tt.want || w.Body.String() != want {
				t.Errorf("got %d %s, want %d %s", w.Code, w.Body.String(), tt.want, want)
			}

			if strings.Contains(logs.String(), errPrivateLookup.Error()) {
				t.Error("search log leaked the lookup error")
			}
		})
	}
}

func TestGenerateSearchEmbedding(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		class     embedder.ErrorClass
		failures  int
		wantCalls int
		wantErr   bool
	}{
		{name: "transient error is retried", class: embedder.Transient, failures: 1, wantCalls: 2},
		{
			name:      "input error is not retried",
			class:     embedder.Input,
			failures:  1,
			wantCalls: 1,
			wantErr:   true,
		},
		{
			name:      "persistent failure is sanitized",
			class:     embedder.Transient,
			failures:  searchRetryAttempts,
			wantCalls: searchRetryAttempts,
			wantErr:   true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			calls := 0
			provider := embedderFunc(func(context.Context, embedder.Request) ([][]float32, error) {
				calls++
				if calls <= tt.failures {
					return nil, &embedder.StatusError{
						Class:      tt.class,
						StatusCode: http.StatusTooManyRequests,
						RetryAfter: "",
						Message:    "provider rejected request",
					}
				}

				return [][]float32{{1, 0}}, nil
			})

			var logs bytes.Buffer

			ctx := context.WithValue(
				t.Context(),
				loggerContextKey{},
				slog.New(slog.NewTextHandler(&logs, nil)),
			)
			config := &hasura.AiAutoEmbeddingsConfigurationFragment{
				ID:         "config-id",
				Model:      "m",
				Dimensions: 2,
			}

			_, err := generateSearchEmbedding(ctx, provider, config, "hello")
			if calls != tt.wantCalls || (err != nil) != tt.wantErr {
				t.Fatalf("err = %v after %d calls", err, calls)
			}

			if tt.wantErr && (!errors.Is(err, errEmbeddingProviderRequest) ||
				!strings.Contains(logs.String(), "configuration_id=config-id")) {
				t.Errorf("failure not sanitized and logged: %v %s", err, logs.String())
			}
		})
	}
}
