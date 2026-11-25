package cmd

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gqlgo/gqlgenc/clientv2"
	"github.com/nhost/nhost/services/ai/autoai"
	"github.com/nhost/nhost/services/ai/autoai/embedder"
	autoaimock "github.com/nhost/nhost/services/ai/autoai/mock"
	"github.com/nhost/nhost/services/ai/hasura"
	"go.uber.org/mock/gomock"
)

func TestDeployWebhookSafeErrorsAndStaleEvents(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name           string
		stale, invalid bool
		status         int
	}{
		{name: "SQL error", status: http.StatusInternalServerError},
		{name: "validation failure", invalid: true, status: http.StatusUnprocessableEntity},
		{name: "deleted row retry", stale: true, status: http.StatusOK},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			ctrl := gomock.NewController(t)
			catalog := autoaimock.NewMockCatalog(ctrl)
			client := autoaimock.NewMockHasuraClient(ctrl)
			config := &hasura.AiAutoEmbeddingsConfigurationFragment{
				ID:         "11111111-1111-1111-1111-111111111111",
				Name:       "documents",
				SchemaName: "public",
				TableName:  "documents",
				ColumnName: "embedding",
				Provider:   "local",
				Dimensions: 2,
				Model:      "local",
			}

			var persisted string
			if !tt.stale {
				if tt.invalid {
					config.Provider = "absent"
				} else {
					catalog.EXPECT().
						PrimaryKey(gomock.Any(), "public", "documents").
						Return([]hasura.PKInformation{{ColumnName: "id", DataType: "integer"}}, nil)
					catalog.EXPECT().
						VectorColumn(gomock.Any(), "public", "documents", "embedding").
						Return("vector", 2, nil)
					client.EXPECT().
						RunSQL(gomock.Any(), gomock.Any(), false).
						Return(nil, &hasura.RequestError{StatusCode: 400, Body: []byte(`{"code":"postgres-error","internal":{"statement":"CREATE FUNCTION private rendered SQL webhook-private-secret"}}`)})
				}

				client.EXPECT().
					SetAiAutoEmbeddingsConfigurationLastError(gomock.Any(), config.ID, gomock.Any()).
					DoAndReturn(func(_ context.Context, _ string, message *string, _ ...clientv2.RequestInterceptor) (*hasura.SetAiAutoEmbeddingsConfigurationLastError, error) {
						persisted = *message

						return &hasura.SetAiAutoEmbeddingsConfigurationLastError{
							UpdateAiAutoEmbeddingsConfiguration: nil,
						}, nil
					})
			}

			ai := autoai.NewAutoAI(
				client,
				catalog,
				embedder.Registry{"local": nil},
				"http://ai",
				"webhook-private-secret",
			)
			handler := &webhookHandler{
				autoAI:     ai,
				embeddings: nil,
				hasura: autoEmbeddingsConfigurationGetterFunc(
					func(context.Context, string, ...clientv2.RequestInterceptor) (*hasura.GetAiAutoEmbeddingsConfiguration, error) {
						if tt.stale {
							return &hasura.GetAiAutoEmbeddingsConfiguration{
								AiAutoEmbeddingsConfiguration: nil,
							}, nil
						}

						return &hasura.GetAiAutoEmbeddingsConfiguration{
							AiAutoEmbeddingsConfiguration: config,
						}, nil
					},
				),
			}

			var logs bytes.Buffer

			router := setupRouter(
				"/v1",
				"test",
				"webhook-private-secret",
				[]string{"*"},
				handler,
				&agentHandlersStub{handleStreamMessage: nil, handleApproveTools: nil},
				slog.New(slog.NewTextHandler(&logs, &slog.HandlerOptions{Level: slog.LevelDebug})),
			)
			request := httptest.NewRequest(
				http.MethodPost,
				"/v1/webhooks/auto-embeddings-configuration",
				strings.NewReader(
					`{"event":{"op":"UPDATE","data":{"new":{"id":"11111111-1111-1111-1111-111111111111"}}}}`,
				),
			)
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("X-AI-Webhook-Secret", "webhook-private-secret")

			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)

			if response.Code != tt.status {
				t.Fatalf("status=%d want %d", response.Code, tt.status)
			}

			captured := logs.String() + persisted + response.Body.String()
			for _, forbidden := range []string{"webhook-private-secret", "private rendered SQL", "CREATE FUNCTION", "internal", "statement"} {
				if strings.Contains(captured, forbidden) {
					t.Errorf(
						"secret-bearing SQL escaped into request/deploy logs, status, or response: %q",
						forbidden,
					)
				}
			}

			if tt.stale {
				if !strings.Contains(logs.String(), "stale auto-embeddings event") {
					t.Error("stale retry not logged")
				}

				return
			}

			var body struct {
				Error string `json:"error"`
			}
			if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
				t.Fatal("response is not JSON")
			}

			if body.Error != persisted || !strings.HasPrefix(persisted, "deploy: ") {
				t.Error("public response and stored deploy status differ")
			}
		})
	}
}
