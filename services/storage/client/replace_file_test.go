package client_test

import (
	"context"
	"io"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/nhost/nhost/services/storage/client"
)

func TestReplaceFile(t *testing.T) { //nolint:cyclop,maintidx,gocognit
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
		requestBody        func(t *testing.T) (io.Reader, string)
		interceptor        func(ctx context.Context, req *http.Request) error
		expected           *client.FileMetadata
		expectedStatusCode int
		expectedHeader     http.Header
		expectedCmpOpts    []cmp.Option
		expectedErr        *client.ErrorResponse
	}{
		{
			name: "simple upload",
			id:   id1,
			requestBody: func(t *testing.T) (io.Reader, string) {
				t.Helper()

				f, err := os.OpenFile("testdata/nhost.jpg", os.O_RDONLY, 0o644)
				if err != nil {
					t.Fatalf("failed to read test file: %v", err)
				}
				defer f.Close()

				body, contentType, err := client.CreateUpdateMultiForm(
					client.NewFile("nhost.jpg", f, nil),
				)
				if err != nil {
					t.Fatalf("failed to create upload multi-form: %v", err)
				}

				return body, contentType
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusOK,
			expected: &client.FileMetadata{
				BucketId:   "default",
				CreatedAt:  time.Time{},
				Etag:       `"78b676e65ebc31f0bb1f2f0d05098572"`,
				Id:         "69045896-4b8e-4bd1-a87b-e1386cb7",
				IsUploaded: true,
				Metadata:   nil,
				Name:       "nhost.jpg",
				MimeType:   "image/jpeg",
				Size:       33399,
			},
			expectedHeader: http.Header{
				"Content-Length": {"287"},
				"Content-Type":   {"application/json"},
				"Date":           {"Mon, 21 Jul 2025 14:45:00 GMT"},
			},
			expectedCmpOpts: []cmp.Option{
				cmpopts.IgnoreFields(client.FileMetadata{}, "Id"),
			},
			expectedErr: nil,
		},
		{
			name: "simple upload",
			id:   id1,
			requestBody: func(t *testing.T) (io.Reader, string) {
				t.Helper()

				body, contentType, err := client.CreateUpdateMultiForm(
					client.NewFile("changedfile.txt", strings.NewReader("Bye, World!"), nil),
				)
				if err != nil {
					t.Fatalf("failed to create upload multi-form: %v", err)
				}

				return body, contentType
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusOK,
			expected: &client.FileMetadata{
				BucketId:   "default",
				CreatedAt:  time.Time{},
				Etag:       `"c247b0271b96b82c23c3acd525f9d159"`,
				Id:         "69045896-4b8e-4bd1-a87b-e1386cb7",
				IsUploaded: true,
				Metadata:   nil,
				Name:       "changedfile.txt",
				MimeType:   "text/plain; charset=utf-8",
				Size:       11,
			},
			expectedHeader: http.Header{
				"Content-Length": {"305"},
				"Content-Type":   {"application/json"},
				"Date":           {"Mon, 21 Jul 2025 14:45:00 GMT"},
			},
			expectedCmpOpts: []cmp.Option{
				cmpopts.IgnoreFields(client.FileMetadata{}, "Id"),
			},
			expectedErr: nil,
		},
		{
			name: "with virus",
			id:   id1,
			requestBody: func(t *testing.T) (io.Reader, string) {
				t.Helper()

				body, contentType, err := client.CreateUpdateMultiForm(
					client.NewFile("blah.txt", strings.NewReader(eicarTestFile), nil),
				)
				if err != nil {
					t.Fatalf("failed to create upload multi-form: %v", err)
				}

				return body, contentType
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusForbidden,
			expectedHeader: http.Header{
				"Content-Length": {"116"},
				"Content-Type":   {"application/json"},
				"Date":           {"Mon, 21 Jul 2025 14:45:00 GMT"},
				"X-Error":        {"virus found: Eicar-Test-Signature"},
			},
			expectedCmpOpts: []cmp.Option{
				cmpopts.IgnoreFields(client.FileMetadata{}, "Id"),
			},
			expectedErr: &client.ErrorResponse{
				Error: &struct {
					Data    *map[string]any `json:"data,omitempty"`
					Message string          `json:"message"`
				}{
					Data:    &map[string]any{"file": "blah.txt", "virus": "Eicar-Test-Signature"},
					Message: "virus found: Eicar-Test-Signature",
				},
			},
		},
		{
			name: "unknown file id",
			id:   uuid.NewString(),
			requestBody: func(t *testing.T) (io.Reader, string) {
				t.Helper()

				body, contentType, err := client.CreateUpdateMultiForm(
					client.NewFile("blah.txt", strings.NewReader("asd"), nil),
				)
				if err != nil {
					t.Fatalf("failed to create upload multi-form: %v", err)
				}

				return body, contentType
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expected:           nil,
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
			name: "no permission",
			id:   uuid.NewString(),
			requestBody: func(t *testing.T) (io.Reader, string) {
				t.Helper()

				body, contentType, err := client.CreateUpdateMultiForm(
					client.NewFile("blah.txt", strings.NewReader("asd"), nil),
				)
				if err != nil {
					t.Fatalf("failed to create upload multi-form: %v", err)
				}

				return body, contentType
			},
			interceptor:        nil,
			expected:           nil,
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

			body, contentType := tc.requestBody(t)

			resp, err := cl.ReplaceFileWithBodyWithResponse(
				t.Context(),
				tc.id,
				contentType,
				body,
				interceptor...,
			)
			if err != nil {
				t.Fatalf("failed to upload files: %v", err)
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

			if diff := cmp.Diff(resp.JSON200, tc.expected, opts...); diff != "" {
				t.Errorf("unexpected response: %s", diff)
			}

			if diff := cmp.Diff(resp.JSONDefault, tc.expectedErr, opts); diff != "" {
				t.Errorf("unexpected error response: %s", diff)
			}

			if diff := cmp.Diff(
				resp.HTTPResponse.Header,
				tc.expectedHeader,
				compareContentLength(),
				IgnoreResponseHeaders(),
			); diff != "" {
				t.Errorf("unexpected headers: %s", diff)
			}
		})
	}
}
