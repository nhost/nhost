package metadata_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/nhost/nhost/services/storage/metadata"
)

func TestGetFileByIDErrorResponses(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		status     int
		response   string
		wantStatus int
	}{
		{
			name:       "proxy failure with HTML body",
			status:     http.StatusBadGateway,
			response:   "<html>Bad Gateway</html>",
			wantStatus: http.StatusInternalServerError,
		},
		{
			name:       "empty GraphQL errors",
			status:     http.StatusInternalServerError,
			response:   `{"errors":[]}`,
			wantStatus: http.StatusInternalServerError,
		},
		{
			name:       "non-GraphQL JSON error",
			status:     http.StatusNotFound,
			response:   `{"code":"not-found","error":"resource does not exist","path":"$"}`,
			wantStatus: http.StatusInternalServerError,
		},
		{
			name:       "access denied",
			status:     http.StatusOK,
			response:   `{"errors":[{"message":"denied","extensions":{"code":"access-denied"}}]}`,
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "validation failed",
			status:     http.StatusOK,
			response:   `{"errors":[{"message":"denied","extensions":{"code":"validation-failed"}}]}`,
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "permission error",
			status:     http.StatusOK,
			response:   `{"errors":[{"message":"denied","extensions":{"code":"permission-error"}}]}`,
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "data exception",
			status:     http.StatusOK,
			response:   `{"errors":[{"message":"bad data","extensions":{"code":"data-exception"}}]}`,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "constraint violation",
			status:     http.StatusOK,
			response:   `{"errors":[{"message":"bad data","extensions":{"code":"constraint-violation"}}]}`,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "unknown GraphQL code",
			status:     http.StatusOK,
			response:   `{"errors":[{"message":"unavailable","extensions":{"code":"unexpected"}}]}`,
			wantStatus: http.StatusInternalServerError,
		},
		{
			name:       "missing GraphQL code",
			status:     http.StatusOK,
			response:   `{"errors":[{"message":"unavailable"}]}`,
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			server := httptest.NewServer(
				http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(tt.status)

					if _, err := w.Write([]byte(tt.response)); err != nil {
						t.Errorf("write response: %v", err)
					}
				}),
			)
			defer server.Close()

			_, apiErr := metadata.NewHasura(server.URL).GetFileByID(
				t.Context(), "00000000-0000-0000-0000-000000000001", nil,
			)
			if apiErr == nil {
				t.Fatal("GetFileByID() succeeded, want API error")
			}

			if apiErr.StatusCode() != tt.wantStatus {
				t.Errorf("GetFileByID() status = %d, want %d", apiErr.StatusCode(), tt.wantStatus)
			}
		})
	}
}
