package client_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/nhost/hasura-storage/client"
)

func TestDeleteFile(t *testing.T) {
	t.Parallel()

	cl, err := client.NewClientWithResponses(testBaseURL)
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	id1 := uuid.NewString()
	id2 := uuid.NewString()

	uploadInitialFile(t, cl, id1, id2)

	cases := []struct {
		name               string
		id                 string
		interceptor        func(ctx context.Context, req *http.Request) error
		expectedStatusCode int
		expectedHeader     http.Header
		expectedCmpOpts    []cmp.Option
		expectedErr        *client.ErrorResponse
	}{
		{
			name:               "simple delete",
			id:                 id1,
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusNoContent,
			expectedHeader: http.Header{
				"Date": {"Mon, 21 Jul 2025 14:45:00 GMT"},
			},
			expectedCmpOpts: []cmp.Option{
				cmpopts.IgnoreFields(client.FileMetadata{}, "Id"),
			},
			expectedErr: nil,
		},
		{
			name:               "wrong id",
			id:                 uuid.NewString(),
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusNotFound,
			expectedHeader: http.Header{
				"Content-Length": {"51"},
				"Content-Type":   {"application/json"},
				"Date":           {"Mon, 21 Jul 2025 14:45:00 GMT"},
				"X-Error":        {"file not found"},
			},
			expectedCmpOpts: []cmp.Option{
				cmpopts.IgnoreFields(client.FileMetadata{}, "Id"),
			},
			expectedErr: &client.ErrorResponse{
				Error: &struct {
					Data    *map[string]any `json:"data,omitempty"`
					Message string          `json:"message"`
				}{
					Data:    nil,
					Message: "file not found",
				},
			},
		},
		{
			name:               "no permissions",
			id:                 uuid.NewString(),
			interceptor:        nil,
			expectedStatusCode: http.StatusForbidden,
			expectedHeader: http.Header{
				"Content-Length": {"59"},
				"Content-Type":   {"application/json"},
				"Date":           {"Mon, 21 Jul 2025 14:45:00 GMT"},
				"X-Error":        {"you are not authorized"},
			},
			expectedCmpOpts: []cmp.Option{
				cmpopts.IgnoreFields(client.FileMetadata{}, "Id"),
			},
			expectedErr: &client.ErrorResponse{
				Error: &struct {
					Data    *map[string]any `json:"data,omitempty"`
					Message string          `json:"message"`
				}{
					Data:    nil,
					Message: "you are not authorized",
				},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var interceptor []client.RequestEditorFn
			if tc.interceptor != nil {
				interceptor = []client.RequestEditorFn{
					tc.interceptor,
				}
			}

			resp, err := cl.DeleteFileWithResponse(
				t.Context(),
				tc.id,
				interceptor...,
			)
			if err != nil {
				t.Fatalf("failed to delete file: %v", err)
			}

			if resp.StatusCode() != tc.expectedStatusCode {
				t.Errorf(
					"expected status code %d, got %d", tc.expectedStatusCode, resp.StatusCode(),
				)
			}

			opts := append(
				cmp.Options{
					cmpopts.IgnoreFields(client.FileMetadata{}, "CreatedAt", "UpdatedAt"),
				},
				tc.expectedCmpOpts...,
			)

			if diff := cmp.Diff(resp.JSONDefault, tc.expectedErr, opts); diff != "" {
				t.Errorf("unexpected error response: %s", diff)
			}

			if diff := cmp.Diff(
				resp.HTTPResponse.Header,
				tc.expectedHeader,
				IgnoreResponseHeaders(),
			); diff != "" {
				t.Errorf("unexpected headers: %s", diff)
			}
		})
	}
}
