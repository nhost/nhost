package cmd

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"github.com/Yamashou/gqlgenc/clientv2"
	"github.com/gin-gonic/gin"
	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/ai/agents"
	"github.com/nhost/nhost/services/ai/hasura"
)

var (
	errTestHasuraUnavailable = errors.New("hasura unavailable")
	errTestDeploymentFailed  = errors.New("deployment failed")
	errTestOpenAIUnavailable = errors.New("OpenAI unavailable")
)

type route struct {
	method string
	path   string
}

type embeddingsGeneratorFunc func(
	ctx context.Context,
	input, embeddingsModel string,
) ([]float64, error)

func (f embeddingsGeneratorFunc) EmbeddingsGenerate(
	ctx context.Context,
	input, embeddingsModel string,
) ([]float64, error) {
	return f(ctx, input, embeddingsModel)
}

type autoEmbeddingsConfigurationGetterFunc func(
	ctx context.Context,
	id string,
	interceptors ...clientv2.RequestInterceptor,
) (*hasura.GetAiAutoEmbeddingsConfiguration, error)

func (f autoEmbeddingsConfigurationGetterFunc) GetAiAutoEmbeddingsConfiguration(
	ctx context.Context,
	id string,
	interceptors ...clientv2.RequestInterceptor,
) (*hasura.GetAiAutoEmbeddingsConfiguration, error) {
	return f(ctx, id, interceptors...)
}

type autoEmbeddingsSynchronizerFunc func(
	ctx context.Context,
	config *hasura.AiAutoEmbeddingsConfigurationFragment,
	remove bool,
	logger *slog.Logger,
) error

func (f autoEmbeddingsSynchronizerFunc) SynchAutoEmbeddingsConfiguration(
	ctx context.Context,
	config *hasura.AiAutoEmbeddingsConfigurationFragment,
	remove bool,
	logger *slog.Logger,
) error {
	return f(ctx, config, remove, logger)
}

func newAutoEmbeddingsUpsertWebhookHandler(
	t *testing.T,
	wantID string,
	synchronizeErr error,
) *webhookHandler {
	t.Helper()

	config := &hasura.AiAutoEmbeddingsConfigurationFragment{
		ID:         wantID,
		Name:       "configuration",
		SchemaName: "public",
		TableName:  "documents",
		ColumnName: "embedding",
		Model:      "model",
		Query:      nil,
		Mutation:   nil,
		LastRun:    nil,
	}
	getterCalls := 0
	synchronizerCalls := 0
	t.Cleanup(func() {
		if getterCalls != 1 {
			t.Errorf("configuration getter calls = %d, want 1", getterCalls)
		}

		if synchronizerCalls != 1 {
			t.Errorf("configuration synchronizer calls = %d, want 1", synchronizerCalls)
		}
	})

	return &webhookHandler{
		autoAI: autoEmbeddingsSynchronizerFunc(func(
			_ context.Context,
			gotConfig *hasura.AiAutoEmbeddingsConfigurationFragment,
			remove bool,
			logger *slog.Logger,
		) error {
			synchronizerCalls++

			if diff := cmp.Diff(config, gotConfig); diff != "" {
				t.Errorf("configuration mismatch (-want +got):\n%s", diff)
			}

			if remove {
				t.Error("remove = true, want false")
			}

			if logger == nil {
				t.Error("logger is nil")
			}

			return synchronizeErr
		}),
		embeddings: nil,
		hasura: autoEmbeddingsConfigurationGetterFunc(func(
			_ context.Context,
			id string,
			interceptors ...clientv2.RequestInterceptor,
		) (*hasura.GetAiAutoEmbeddingsConfiguration, error) {
			getterCalls++

			if id != wantID {
				t.Errorf("configuration ID = %q, want %q", id, wantID)
			}

			if len(interceptors) != 0 {
				t.Errorf("interceptors = %d, want 0", len(interceptors))
			}

			return &hasura.GetAiAutoEmbeddingsConfiguration{
				AiAutoEmbeddingsConfiguration: config,
			}, nil
		}),
	}
}

func newEmbeddingsWebhookHandler(
	t *testing.T,
	embeddings []float64,
	generateErr error,
) *webhookHandler {
	t.Helper()

	calls := 0
	t.Cleanup(func() {
		if calls != 1 {
			t.Errorf("embeddings generator calls = %d, want 1", calls)
		}
	})

	return &webhookHandler{
		autoAI: nil,
		embeddings: embeddingsGeneratorFunc(func(
			_ context.Context,
			input, model string,
		) ([]float64, error) {
			calls++

			if input != "hello" {
				t.Errorf("input = %q, want hello", input)
			}

			if model != "model" {
				t.Errorf("model = %q, want model", model)
			}

			return embeddings, generateErr
		}),
		hasura: nil,
	}
}

func TestSetupRouterRoutes(t *testing.T) {
	t.Parallel()

	router := setupRouter(
		"/v1",
		"test-version",
		"test-secret",
		[]string{"*"},
		&webhookHandler{},
		&agents.Service{},
		slog.New(slog.DiscardHandler),
	)

	got := make([]route, 0, len(router.Routes()))
	for _, routeInfo := range router.Routes() {
		got = append(got, route{method: routeInfo.Method, path: routeInfo.Path})
	}

	slices.SortFunc(got, func(a, b route) int {
		if result := strings.Compare(a.path, b.path); result != 0 {
			return result
		}

		return strings.Compare(a.method, b.method)
	})

	want := []route{
		{method: http.MethodGet, path: "/healthz"},
		{method: http.MethodPost, path: "/v1/agents/sessions/:sessionID/approve-tools"},
		{method: http.MethodPost, path: "/v1/agents/sessions/:sessionID/messages"},
		{method: http.MethodGet, path: "/v1/version"},
		{method: http.MethodPost, path: "/v1/webhooks/auto-embeddings-configuration"},
		{method: http.MethodPost, path: "/v1/webhooks/generate-embeddings"},
	}

	if diff := cmp.Diff(want, got, cmp.AllowUnexported(route{})); diff != "" {
		t.Errorf("routes mismatch (-want +got):\n%s", diff)
	}
}

//nolint:maintidx // One declarative table keeps all shared router response assertions consistent.
func TestSetupRouterResponses(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name       string
		method     string
		path       string
		body       string
		secret     string
		webhooks   func(*testing.T) *webhookHandler
		wantStatus int
		wantBody   string
	}{
		{
			name:       "health",
			method:     http.MethodGet,
			path:       "/healthz",
			body:       "",
			secret:     "",
			webhooks:   nil,
			wantStatus: http.StatusOK,
			wantBody:   `{"healthz":"ok"}`,
		},
		{
			name:       "malformed auto embeddings webhook JSON",
			method:     http.MethodPost,
			path:       "/v1/webhooks/auto-embeddings-configuration",
			body:       `{"event":`,
			secret:     "test-secret",
			webhooks:   nil,
			wantStatus: http.StatusBadRequest,
			wantBody:   `{"error":"unexpected EOF"}`,
		},
		{
			name:       "unknown auto embeddings operation",
			method:     http.MethodPost,
			path:       "/v1/webhooks/auto-embeddings-configuration",
			body:       `{"event":{"op":"UNKNOWN"}}`,
			secret:     "test-secret",
			webhooks:   nil,
			wantStatus: http.StatusBadRequest,
			wantBody: `{"error":"unknown auto-embeddings event operation: ` +
				`\"UNKNOWN\""}`,
		},
		{
			name:   "insert auto embeddings configuration",
			method: http.MethodPost,
			path:   "/v1/webhooks/auto-embeddings-configuration",
			body:   `{"event":{"op":"INSERT","data":{"new":{"id":"insert-id"}}}}`,
			secret: "test-secret",
			webhooks: func(t *testing.T) *webhookHandler {
				t.Helper()

				return newAutoEmbeddingsUpsertWebhookHandler(t, "insert-id", nil)
			},
			wantStatus: http.StatusOK,
			wantBody:   `{"message":"ok"}`,
		},
		{
			name:   "update auto embeddings configuration",
			method: http.MethodPost,
			path:   "/v1/webhooks/auto-embeddings-configuration",
			body:   `{"event":{"op":"UPDATE","data":{"new":{"id":"update-id"}}}}`,
			secret: "test-secret",
			webhooks: func(t *testing.T) *webhookHandler {
				t.Helper()

				return newAutoEmbeddingsUpsertWebhookHandler(t, "update-id", nil)
			},
			wantStatus: http.StatusOK,
			wantBody:   `{"message":"ok"}`,
		},
		{
			name:   "delete auto embeddings configuration",
			method: http.MethodPost,
			path:   "/v1/webhooks/auto-embeddings-configuration",
			body: `{"event":{"op":"DELETE","data":{"old":{` +
				`"id":"delete-id","name":"articles","model":"model",` +
				`"schema_name":"public","table_name":"articles",` +
				`"column_name":"embedding"}}}}`,
			secret: "test-secret",
			webhooks: func(t *testing.T) *webhookHandler {
				t.Helper()

				calls := 0
				t.Cleanup(func() {
					if calls != 1 {
						t.Errorf("configuration synchronizer calls = %d, want 1", calls)
					}
				})

				return &webhookHandler{
					autoAI: autoEmbeddingsSynchronizerFunc(func(
						_ context.Context,
						gotConfig *hasura.AiAutoEmbeddingsConfigurationFragment,
						remove bool,
						logger *slog.Logger,
					) error {
						calls++

						wantConfig := &hasura.AiAutoEmbeddingsConfigurationFragment{
							ID:         "delete-id",
							Name:       "articles",
							SchemaName: "public",
							TableName:  "articles",
							ColumnName: "embedding",
							Model:      "model",
							Query:      nil,
							Mutation:   nil,
							LastRun:    nil,
						}
						if diff := cmp.Diff(wantConfig, gotConfig); diff != "" {
							t.Errorf("configuration mismatch (-want +got):\n%s", diff)
						}

						if !remove {
							t.Error("remove = false, want true")
						}

						if logger == nil {
							t.Error("logger is nil")
						}

						return nil
					}),
					embeddings: nil,
					hasura:     nil,
				}
			},
			wantStatus: http.StatusOK,
			wantBody:   `{"message":"ok"}`,
		},
		{
			name:   "configuration getter failure",
			method: http.MethodPost,
			path:   "/v1/webhooks/auto-embeddings-configuration",
			body:   `{"event":{"op":"INSERT","data":{"new":{"id":"id"}}}}`,
			secret: "test-secret",
			webhooks: func(t *testing.T) *webhookHandler {
				t.Helper()

				calls := 0
				t.Cleanup(func() {
					if calls != 1 {
						t.Errorf("configuration getter calls = %d, want 1", calls)
					}
				})

				return &webhookHandler{
					autoAI:     nil,
					embeddings: nil,
					hasura: autoEmbeddingsConfigurationGetterFunc(func(
						_ context.Context,
						id string,
						interceptors ...clientv2.RequestInterceptor,
					) (*hasura.GetAiAutoEmbeddingsConfiguration, error) {
						calls++

						if id != "id" {
							t.Errorf("configuration ID = %q, want id", id)
						}

						if len(interceptors) != 0 {
							t.Errorf("interceptors = %d, want 0", len(interceptors))
						}

						return nil, errTestHasuraUnavailable
					}),
				}
			},
			wantStatus: http.StatusInternalServerError,
			wantBody: `{"error":"getting auto embeddings configuration: ` +
				`hasura unavailable"}`,
		},
		{
			name:   "configuration synchronizer failure",
			method: http.MethodPost,
			path:   "/v1/webhooks/auto-embeddings-configuration",
			body:   `{"event":{"op":"UPDATE","data":{"new":{"id":"id"}}}}`,
			secret: "test-secret",
			webhooks: func(t *testing.T) *webhookHandler {
				t.Helper()

				return newAutoEmbeddingsUpsertWebhookHandler(
					t,
					"id",
					errTestDeploymentFailed,
				)
			},
			wantStatus: http.StatusInternalServerError,
			wantBody: `{"error":"synchronizing auto embeddings configuration: ` +
				`deployment failed"}`,
		},
		{
			name:   "generate embeddings",
			method: http.MethodPost,
			path:   "/v1/webhooks/generate-embeddings",
			body:   `{"query":"hello","model":"model"}`,
			secret: "test-secret",
			webhooks: func(t *testing.T) *webhookHandler {
				t.Helper()

				return newEmbeddingsWebhookHandler(t, []float64{0.25, 0.5}, nil)
			},
			wantStatus: http.StatusOK,
			wantBody:   `{"embeddings":[0.25,0.5]}`,
		},
		{
			name:   "embeddings generator failure",
			method: http.MethodPost,
			path:   "/v1/webhooks/generate-embeddings",
			body:   `{"query":"hello","model":"model"}`,
			secret: "test-secret",
			webhooks: func(t *testing.T) *webhookHandler {
				t.Helper()

				return newEmbeddingsWebhookHandler(
					t,
					nil,
					errTestOpenAIUnavailable,
				)
			},
			wantStatus: http.StatusInternalServerError,
			wantBody:   `{"error":"generating embeddings: OpenAI unavailable"}`,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()

			webhooks := &webhookHandler{}
			if testCase.webhooks != nil {
				webhooks = testCase.webhooks(t)
			}

			router := setupRouter(
				"/v1",
				"test-version",
				"test-secret",
				[]string{"*"},
				webhooks,
				nil,
				slog.New(slog.DiscardHandler),
			)

			request := httptest.NewRequest(
				testCase.method,
				testCase.path,
				strings.NewReader(testCase.body),
			)
			if testCase.secret != "" {
				request.Header.Set("X-AI-Webhook-Secret", testCase.secret)
			}

			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)

			if response.Code != testCase.wantStatus {
				t.Errorf("status = %d, want %d", response.Code, testCase.wantStatus)
			}

			if got := response.Body.String(); got != testCase.wantBody {
				t.Errorf("body = %q, want %q", got, testCase.wantBody)
			}
		})
	}
}

func TestNeedsWebhookSecret(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name       string
		secret     string
		wantStatus int
	}{
		{name: "accepted", secret: "test-secret", wantStatus: http.StatusNoContent},
		{name: "rejected", secret: "wrong-secret", wantStatus: http.StatusUnauthorized},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()

			router := gin.New()
			router.Use(needsWebhookSecret("test-secret"))
			router.POST("/webhook", func(c *gin.Context) {
				c.Status(http.StatusNoContent)
			})

			request := httptest.NewRequest(http.MethodPost, "/webhook", nil)
			request.Header.Set("X-AI-Webhook-Secret", testCase.secret)

			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)

			if response.Code != testCase.wantStatus {
				t.Errorf("status = %d, want %d", response.Code, testCase.wantStatus)
			}
		})
	}
}
