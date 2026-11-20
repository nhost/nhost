package controller_test

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/controller"
	"github.com/nhost/nhost/services/storage/controller/mock"
	"github.com/nhost/nhost/services/storage/metadata"
	gomock "go.uber.org/mock/gomock"
)

type cleanupLogWriter chan string

func (w cleanupLogWriter) Write(p []byte) (int, error) {
	w <- string(p)
	return len(p), nil
}

func TestRunCleanupHasuraNonGraphQLErrors(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		operation string
		wantLog   string
	}{
		{
			name:      "listing failure",
			operation: "ListFilesToDelete",
			wantLog:   "problem listing file cleanup queue",
		},
		{
			name:      "metadata lookup fails closed",
			operation: "GetFile",
			wantLog:   "problem getting file metadata",
		},
		{
			name:      "queue acknowledgment failure",
			operation: "RemoveFileFromCleanup",
			wantLog:   "problem removing file from cleanup queue",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			for _, response := range cleanupNonGraphQLErrors() {
				t.Run(response.name, func(t *testing.T) {
					t.Parallel()

					const fileID = "00000000-0000-0000-0000-000000000001"

					server := newCleanupErrorServer(t, response, tt.operation, map[string]string{
						"ListFilesToDelete": `{"data":{"filesToDelete":[{"id":"` + fileID + `","deletedAt":"2020-01-01T00:00:00Z"}]}}`,
						"GetFile":           `{"data":{"file":null}}`,
					})
					defer server.Close()

					contentStorage := mock.NewMockContentStorage(gomock.NewController(t))
					if tt.operation == "RemoveFileFromCleanup" {
						contentStorage.EXPECT().DeleteFile(gomock.Any(), fileID).Return(nil)
					}

					logged := make(cleanupLogWriter, 1)
					ctrl := controller.New(
						"",
						"",
						"admin-secret",
						metadata.NewHasura(server.URL),
						contentStorage,
						nil,
						nil,
						slog.New(slog.NewTextHandler(logged, nil)),
					)

					deadline, stop := context.WithTimeout(t.Context(), 5*time.Second)
					defer stop()

					ctx, cancel := context.WithCancel(deadline)
					defer cancel()

					done := make(chan struct{})
					go func() {
						ctrl.RunCleanup(ctx)
						close(done)
					}()

					select {
					case message := <-logged:
						if !strings.Contains(message, tt.wantLog) {
							t.Errorf("cleanup log = %q, want %q", message, tt.wantLog)
						}
					case <-deadline.Done():
						t.Fatal("worker did not log the metadata failure")
					}

					cancel()

					select {
					case <-done:
					case <-deadline.Done():
						t.Fatal("worker did not stop after cancellation")
					}
				})
			}
		})
	}
}

func TestDeleteFileCleanupHasuraNonGraphQLErrors(t *testing.T) {
	t.Parallel()

	for _, tt := range cleanupNonGraphQLErrors() {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			const fileID = "00000000-0000-0000-0000-000000000001"

			server := newCleanupErrorServer(t, tt, "RemoveFileFromCleanup", map[string]string{
				"DeleteFile": `{"data":{"deleteFile":{"id":"` + fileID + `"}}}`,
			})
			defer server.Close()

			contentStorage := mock.NewMockContentStorage(gomock.NewController(t))
			contentStorage.EXPECT().DeleteFile(gomock.Any(), fileID).Return(nil)

			ctrl := controller.New(
				"",
				"",
				"admin-secret",
				metadata.NewHasura(server.URL),
				contentStorage,
				nil,
				nil,
				slog.New(slog.DiscardHandler),
			)

			response, err := ctrl.DeleteFile(t.Context(), api.DeleteFileRequestObject{Id: fileID})
			if err != nil {
				t.Fatalf("DeleteFile() error = %v", err)
			}

			if _, ok := response.(api.DeleteFile204Response); !ok {
				t.Errorf("DeleteFile() response = %v, want 204", response)
			}
		})
	}
}

type cleanupErrorResponse struct {
	name   string
	status int
	body   string
}

func newCleanupErrorServer(
	t *testing.T, response cleanupErrorResponse, operation string, success map[string]string,
) *httptest.Server {
	t.Helper()

	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request struct {
			OperationName string `json:"operationName"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Errorf("decode request: %v", err)
			return
		}

		body := response.body

		w.Header().Set("Content-Type", "application/json")

		if request.OperationName == operation {
			w.WriteHeader(response.status)
		} else {
			var ok bool

			body, ok = success[request.OperationName]
			if !ok {
				t.Errorf("unexpected operation: %s", request.OperationName)
			}
		}

		if _, err := w.Write([]byte(body)); err != nil {
			t.Errorf("write response: %v", err)
		}
	}))
}

func cleanupNonGraphQLErrors() []cleanupErrorResponse {
	return []cleanupErrorResponse{
		{
			name:   "proxy failure with HTML body",
			status: http.StatusBadGateway,
			body:   "<html>Bad Gateway</html>",
		},
		{
			name:   "empty GraphQL errors",
			status: http.StatusInternalServerError,
			body:   `{"errors":[]}`,
		},
		{
			name:   "non-GraphQL JSON error",
			status: http.StatusNotFound,
			body:   `{"code":"not-found","error":"resource does not exist","path":"$"}`,
		},
	}
}
