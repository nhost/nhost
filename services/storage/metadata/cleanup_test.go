package metadata_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/storage/controller"
	"github.com/nhost/nhost/services/storage/metadata"
)

func checkCleanupAdminHeader(t *testing.T, r *http.Request) {
	t.Helper()

	if r.Header.Get("x-hasura-admin-secret") != "admin-secret" {
		t.Error("cleanup request is missing admin credentials")
	}
}

func TestListFilesToDelete(t *testing.T) {
	t.Parallel()

	before := time.Date(2026, time.January, 2, 0, 0, 0, 0, time.UTC)

	const fileID = "00000000-0000-0000-0000-000000000001"

	tests := []struct {
		name      string
		after     string
		response  string
		want      []controller.FileToDelete
		wantError bool
	}{
		{
			name:     "first page includes zero UUID and uses age filter",
			response: `{"data":{"filesToDelete":[{"id":"` + fileID + `","deletedAt":"2026-01-01T00:00:00Z"}]}}`,
			want: []controller.FileToDelete{{
				ID: fileID, DeletedAt: before.Add(-24 * time.Hour),
			}},
		},
		{
			name:     "next page uses exclusive ID cursor",
			after:    fileID,
			response: `{"data":{"filesToDelete":[]}}`,
			want:     []controller.FileToDelete{},
		},
		{
			name:      "GraphQL failure",
			response:  `{"errors":[{"message":"unavailable","extensions":{"code":"unexpected"}}]}`,
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			wantCursor := map[string]string{}
			if tt.after != "" {
				wantCursor["_gt"] = tt.after
			}

			server := httptest.NewServer(
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					checkCleanupAdminHeader(t, r)

					var request struct {
						OperationName string `json:"operationName"`
						Variables     struct {
							Before time.Time         `json:"before"`
							After  map[string]string `json:"after"`
							Limit  int               `json:"limit"`
						} `json:"variables"`
					}
					if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
						t.Errorf("decode request: %v", err)
						return
					}

					if request.OperationName != "ListFilesToDelete" ||
						!request.Variables.Before.Equal(before) ||
						request.Variables.Limit != 100 {
						t.Errorf("unexpected cleanup request: %+v", request)
					}

					if diff := cmp.Diff(wantCursor, request.Variables.After); diff != "" {
						t.Errorf("cursor mismatch (-want +got):\n%s", diff)
					}

					w.Header().Set("Content-Type", "application/json")

					if _, err := w.Write([]byte(tt.response)); err != nil {
						t.Errorf("write response: %v", err)
					}
				}),
			)
			defer server.Close()

			got, apiErr := metadata.NewHasura(server.URL).ListFilesToDelete(
				t.Context(), before, tt.after, 100,
				http.Header{"x-hasura-admin-secret": []string{"admin-secret"}},
			)
			if (apiErr != nil) != tt.wantError {
				t.Fatalf("ListFilesToDelete() error = %v, want error %t", apiErr, tt.wantError)
			}

			if diff := cmp.Diff(tt.want, got); diff != "" {
				t.Errorf("ListFilesToDelete() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestRemoveFileFromCleanup(t *testing.T) {
	t.Parallel()

	before := time.Date(2026, time.January, 2, 0, 0, 0, 0, time.UTC)

	const fileID = "00000000-0000-0000-0000-000000000001"

	tests := []struct {
		name      string
		response  string
		wantError bool
	}{
		{
			name:     "removes eligible entry",
			response: `{"data":{"delete_filesToDelete":{"affected_rows":1}}}`,
		},
		{
			name:     "already removed entry is successful",
			response: `{"data":{"delete_filesToDelete":{"affected_rows":0}}}`,
		},
		{
			name:      "GraphQL failure",
			response:  `{"errors":[{"message":"unavailable","extensions":{"code":"unexpected"}}]}`,
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			server := httptest.NewServer(
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					checkCleanupAdminHeader(t, r)

					var request struct {
						OperationName string `json:"operationName"`
						Variables     struct {
							ID     string    `json:"id"`
							Before time.Time `json:"before"`
						} `json:"variables"`
					}
					if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
						t.Errorf("decode request: %v", err)
						return
					}

					if request.OperationName != "RemoveFileFromCleanup" ||
						request.Variables.ID != fileID ||
						!request.Variables.Before.Equal(before) {
						t.Errorf("unexpected cleanup request: %+v", request)
					}

					w.Header().Set("Content-Type", "application/json")

					if _, err := w.Write([]byte(tt.response)); err != nil {
						t.Errorf("write response: %v", err)
					}
				}),
			)
			defer server.Close()

			apiErr := metadata.NewHasura(server.URL).RemoveFileFromCleanup(
				t.Context(), fileID, before,
				http.Header{"x-hasura-admin-secret": []string{"admin-secret"}},
			)
			if (apiErr != nil) != tt.wantError {
				t.Fatalf("RemoveFileFromCleanup() error = %v, want error %t", apiErr, tt.wantError)
			}
		})
	}
}
