package client_test

import (
	"context"
	"io"
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/nhost/nhost/services/storage/client"
)

func compareContentLength() cmp.Option {
	return cmp.FilterPath(
		func(p cmp.Path) bool {
			return p.Last().String() == `["Content-Length"]`
		},
		cmp.Comparer(func(a, b []string) bool {
			if len(a) != 1 || len(b) != 1 {
				return false
			}

			if a[0] == b[0] {
				return true
			}

			x, _ := strconv.Atoi(a[0])
			y, _ := strconv.Atoi(b[0])

			if y-3 <= x && x <= y+3 {
				return true
			}

			return false
		}),
	)
}

func TestUploadFiles(t *testing.T) { //nolint:cyclop,maintidx,gocognit
	t.Parallel()

	cl, err := client.NewClientWithResponses(testBaseURL)
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	id1 := uuid.NewString()
	id2 := uuid.NewString()

	cases := []struct {
		name        string
		requestBody func(t *testing.T) (io.Reader, string)
		interceptor func(ctx context.Context, req *http.Request) error
		expected    *struct {
			ProcessedFiles []client.FileMetadata `json:"processedFiles"`
		}
		expectedStatusCode int
		expectedHeader     http.Header
		expectedCmpOpts    []cmp.Option
		expectedErr        *client.ErrorResponseWithProcessedFiles
	}{
		{
			name: "simple upload",
			requestBody: func(t *testing.T) (io.Reader, string) {
				t.Helper()

				body, contentType, err := client.CreateUploadMultiForm(
					"default",
					client.NewFile("testfile.txt", strings.NewReader("Hello, World!"), nil),
				)
				if err != nil {
					t.Fatalf("failed to create upload multi-form: %v", err)
				}

				return body, contentType
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusCreated,
			expected: &struct {
				ProcessedFiles []client.FileMetadata `json:"processedFiles"`
			}{
				ProcessedFiles: []client.FileMetadata{
					{
						BucketId:   "default",
						CreatedAt:  time.Time{},
						Etag:       `"65a8e27d8879283831b664bd8b7f0ad4"`,
						Id:         "69045896-4b8e-4bd1-a87b-e1386cb7",
						IsUploaded: true,
						Metadata:   nil,
						Name:       "testfile.txt",
						MimeType:   "text/plain; charset=utf-8",
						Size:       13,
					},
				},
			},
			expectedHeader: http.Header{
				"Content-Length": {"323"},
				"Content-Type":   {"application/json"},
				"Date":           {"Mon, 21 Jul 2025 14:45:00 GMT"},
			},
			expectedCmpOpts: []cmp.Option{
				cmpopts.IgnoreFields(client.FileMetadata{}, "Id"),
			},
			expectedErr: nil,
		},
		{
			name: "multi-upload",
			requestBody: func(t *testing.T) (io.Reader, string) {
				t.Helper()

				body, contentType, err := client.CreateUploadMultiForm(
					"default",
					client.NewFile("testfile.txt", strings.NewReader("Hello, World!"), nil),
					client.NewFile("morefiles.txt", strings.NewReader("More content"), nil),
				)
				if err != nil {
					t.Fatalf("failed to create upload multi-form: %v", err)
				}

				return body, contentType
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusCreated,
			expected: &struct {
				ProcessedFiles []client.FileMetadata `json:"processedFiles"`
			}{
				ProcessedFiles: []client.FileMetadata{
					{
						BucketId:   "default",
						CreatedAt:  time.Time{},
						Etag:       `"65a8e27d8879283831b664bd8b7f0ad4"`,
						Id:         "69045896-4b8e-4bd1-a87b-e1386cb7",
						IsUploaded: true,
						Metadata:   nil,
						Name:       "testfile.txt",
						MimeType:   "text/plain; charset=utf-8",
						Size:       13,
					},
					{
						BucketId:   "default",
						CreatedAt:  time.Time{},
						Etag:       `"2562b24d9ca6633770dec8cbb190cca8"`,
						Id:         "69045896-4b8e-4bd1-a87b-e1386cb7",
						IsUploaded: true,
						Metadata:   nil,
						Name:       "morefiles.txt",
						MimeType:   "text/plain; charset=utf-8",
						Size:       12,
					},
				},
			},
			expectedHeader: http.Header{
				"Content-Length": {"626"},
				"Content-Type":   {"application/json"},
				"Date":           {"Mon, 21 Jul 2025 14:45:00 GMT"},
			},
			expectedCmpOpts: []cmp.Option{
				cmpopts.IgnoreFields(client.FileMetadata{}, "Id"),
			},
			expectedErr: nil,
		},
		{
			name: "with metadata",
			requestBody: func(t *testing.T) (io.Reader, string) {
				t.Helper()

				body, contentType, err := client.CreateUploadMultiForm(
					"default",
					client.NewFile(
						"testfile.txt",
						strings.NewReader("Hello, World!"),
						&client.UploadFileMetadata{
							Id:       ptr(id1),
							Metadata: ptr(map[string]any{"key": "value"}),
							Name:     ptr("Custom Name.txt"),
						},
					),
					client.NewFile(
						"morefiles.txt",
						strings.NewReader("More content"),
						&client.UploadFileMetadata{
							Id:       ptr(id2),
							Metadata: nil,
							Name:     nil,
						},
					),
				)
				if err != nil {
					t.Fatalf("failed to create upload multi-form: %v", err)
				}

				return body, contentType
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusCreated,
			expected: &struct {
				ProcessedFiles []client.FileMetadata `json:"processedFiles"`
			}{
				ProcessedFiles: []client.FileMetadata{
					{
						BucketId:   "default",
						CreatedAt:  time.Time{},
						Etag:       `"65a8e27d8879283831b664bd8b7f0ad4"`,
						Id:         id1,
						IsUploaded: true,
						Metadata:   ptr(map[string]any{"key": "value"}),
						Name:       "Custom Name.txt",
						MimeType:   "text/plain; charset=utf-8",
						Size:       13,
					},
					{
						BucketId:   "default",
						CreatedAt:  time.Time{},
						Etag:       `"2562b24d9ca6633770dec8cbb190cca8"`,
						Id:         id2,
						IsUploaded: true,
						Metadata:   nil,
						Name:       "morefiles.txt",
						MimeType:   "text/plain; charset=utf-8",
						Size:       12,
					},
				},
			},
			expectedHeader: http.Header{
				"Content-Length": {"640"},
				"Content-Type":   {"application/json"},
				"Date":           {"Mon, 21 Jul 2025 14:45:00 GMT"},
			},
			expectedCmpOpts: []cmp.Option{},
			expectedErr:     nil,
		},
		{
			name: "wrong bucket",
			requestBody: func(t *testing.T) (io.Reader, string) {
				t.Helper()

				body, contentType, err := client.CreateUploadMultiForm(
					"wrong-bucket",
					client.NewFile("testfile.txt", strings.NewReader("Hello, World!"), nil),
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
				"Content-Length": {"75"},
				"Content-Type":   {"application/json"},
				"Date":           {"Mon, 21 Jul 2025 14:45:00 GMT"},
			},
			expectedCmpOpts: []cmp.Option{},
			expectedErr: &client.ErrorResponseWithProcessedFiles{
				ProcessedFiles: nil,
				Error: &struct {
					Data    *map[string]any `json:"data,omitempty"`
					Message string          `json:"message"`
				}{
					Data:    nil,
					Message: "bucket not found",
				},
			},
		},
		{
			name: "with virus",
			requestBody: func(t *testing.T) (io.Reader, string) {
				t.Helper()

				body, contentType, err := client.CreateUploadMultiForm(
					"default",
					client.NewFile("testfile.txt", strings.NewReader("Hello, World!"), nil),
					client.NewFile("morefiles.txt", strings.NewReader("More content"), nil),
					client.NewFile("blah.txt", strings.NewReader(eicarTestFile), nil),
				)
				if err != nil {
					t.Fatalf("failed to create upload multi-form: %v", err)
				}

				return body, contentType
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expected:           nil,
			expectedStatusCode: http.StatusForbidden,
			expectedHeader: http.Header{
				"Content-Length": {"740"},
				"Content-Type":   {"application/json"},
				"Date":           {"Mon, 21 Jul 2025 14:45:00 GMT"},
			},
			expectedCmpOpts: []cmp.Option{
				cmpopts.IgnoreFields(client.FileMetadata{}, "Id"),
			},
			expectedErr: &client.ErrorResponseWithProcessedFiles{
				Error: &struct {
					Data    *map[string]any `json:"data,omitempty"`
					Message string          `json:"message"`
				}{
					Data:    &map[string]any{"file": "blah.txt", "virus": "Eicar-Test-Signature"},
					Message: "virus found: Eicar-Test-Signature",
				},
				ProcessedFiles: &[]client.FileMetadata{
					{
						BucketId:   "default",
						CreatedAt:  time.Time{},
						Etag:       `"65a8e27d8879283831b664bd8b7f0ad4"`,
						Id:         "69045896-4b8e-4bd1-a87b-e1386cb7",
						IsUploaded: true,
						Metadata:   nil,
						Name:       "testfile.txt",
						MimeType:   "text/plain; charset=utf-8",
						Size:       13,
					},
					{
						BucketId:   "default",
						CreatedAt:  time.Time{},
						Etag:       `"2562b24d9ca6633770dec8cbb190cca8"`,
						Id:         "69045896-4b8e-4bd1-a87b-e1386cb7",
						IsUploaded: true,
						Metadata:   nil,
						Name:       "morefiles.txt",
						MimeType:   "text/plain; charset=utf-8",
						Size:       12,
					},
				},
			},
		},
		{
			name: "unauthorized",
			requestBody: func(t *testing.T) (io.Reader, string) {
				t.Helper()

				body, contentType, err := client.CreateUploadMultiForm(
					"default",
					client.NewFile("testfile.txt", strings.NewReader("Hello, World!"), nil),
					client.NewFile("morefiles.txt", strings.NewReader("More content"), nil),
					client.NewFile("blah.txt", strings.NewReader(eicarTestFile), nil),
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
				"Content-Length": {"79"},
				"Content-Type":   {"application/json"},
				"Date":           {"Mon, 21 Jul 2025 14:45:00 GMT"},
			},
			expectedCmpOpts: []cmp.Option{
				cmpopts.IgnoreFields(client.FileMetadata{}, "Id"),
			},
			expectedErr: &client.ErrorResponseWithProcessedFiles{
				Error: &struct {
					Data    *map[string]any `json:"data,omitempty"`
					Message string          `json:"message"`
				}{
					Data:    nil,
					Message: "you are not authorized",
				},
				ProcessedFiles: &[]client.FileMetadata{},
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

			resp, err := cl.UploadFilesWithBodyWithResponse(
				t.Context(),
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

			if diff := cmp.Diff(resp.JSON201, tc.expected, opts...); diff != "" {
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
