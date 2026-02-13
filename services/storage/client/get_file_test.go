package client_test

import (
	"context"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/uuid"
	"github.com/nhost/nhost/services/storage/client"
)

func uploadInitialFile(t *testing.T, cl client.ClientWithResponsesInterface, id1, id2 string) {
	t.Helper()

	f, err := os.OpenFile("testdata/nhost.jpg", os.O_RDONLY, 0o644)
	if err != nil {
		t.Fatalf("failed to read test file: %v", err)
	}
	defer f.Close()

	body, contentType, err := client.CreateUploadMultiForm(
		"default",
		client.NewFile(
			"testfile.txt",
			strings.NewReader("Hello, World!"),
			&client.UploadFileMetadata{
				Id: new(id1),
			},
		),
		client.NewFile(
			"nhost.jpg",
			f,
			&client.UploadFileMetadata{
				Id: new(id2),
			},
		),
	)
	if err != nil {
		t.Fatalf("failed to create upload multi-form: %v", err)
	}

	resp, err := cl.UploadFilesWithBodyWithResponse(
		t.Context(),
		contentType,
		body,
		WithAccessToken(accessTokenValidUser),
	)
	if err != nil {
		t.Fatalf("failed to upload files: %v", err)
	}

	if resp.JSONDefault != nil {
		t.Fatalf("unexpected error response: %v", resp.JSONDefault)
	}

	if len(resp.JSON201.ProcessedFiles) == 0 {
		t.Fatal("no files were processed")
	}
}

func TestGetFile(t *testing.T) { //nolint:maintidx
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
		params             *client.GetFileParams
		interceptor        func(ctx context.Context, req *http.Request) error
		expectedStatusCode int
		expectedBody       string
		expectedHeaders    http.Header
	}{
		{
			name:               "simple get",
			id:                 id1,
			params:             nil,
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusOK,
			expectedBody:       "Hello, World!",
			expectedHeaders: http.Header{
				"Accept-Ranges":       []string{"bytes"},
				"Cache-Control":       []string{"max-age=3600"},
				"Content-Disposition": []string{`inline; filename="testfile.txt"`},
				"Content-Length":      []string{"13"},
				"Content-Type":        []string{"text/plain; charset=utf-8"},
				"Date":                []string{"Mon, 21 Jul 2025 13:24:53 GMT"},
				"Etag":                []string{`"65a8e27d8879283831b664bd8b7f0ad4"`},
				"Last-Modified":       []string{"2025-07-21 13:24:53.586273 +0000 +0000"},
				"Surrogate-Control":   []string{"max-age=3600"},
				"Surrogate-Key":       []string{"d505075a-ee28-4a02-b27a-5973fd2ea35f"},
			},
		},
		{
			name: "IfMatch matches",
			id:   id1,
			params: &client.GetFileParams{
				IfMatch: new(`"65a8e27d8879283831b664bd8b7f0ad4"`),
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusOK,
			expectedBody:       "Hello, World!",
			expectedHeaders: http.Header{
				"Accept-Ranges":       []string{"bytes"},
				"Cache-Control":       []string{"max-age=3600"},
				"Content-Disposition": []string{`inline; filename="testfile.txt"`},
				"Content-Length":      []string{"13"},
				"Content-Type":        []string{"text/plain; charset=utf-8"},
				"Date":                []string{"Mon, 21 Jul 2025 13:24:53 GMT"},
				"Etag":                []string{`"65a8e27d8879283831b664bd8b7f0ad4"`},
				"Last-Modified":       []string{"2025-07-21 13:24:53.586273 +0000 +0000"},
				"Surrogate-Control":   []string{"max-age=3600"},
				"Surrogate-Key":       []string{"d505075a-ee28-4a02-b27a-5973fd2ea35f"},
			},
		},
		{
			name: "IfMatch does not match",
			id:   id1,
			params: &client.GetFileParams{
				IfMatch: new(`"85a8e27d8879283831b664bd8b7f0ad4"`),
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusPreconditionFailed,
			expectedBody:       "",
			expectedHeaders: http.Header{
				"Cache-Control":     []string{"max-age=3600"},
				"Content-Length":    []string{"0"},
				"Date":              []string{"Mon, 21 Jul 2025 13:24:53 GMT"},
				"Etag":              []string{`"65a8e27d8879283831b664bd8b7f0ad4"`},
				"Last-Modified":     []string{"2025-07-21 13:24:53.586273 +0000 +0000"},
				"Surrogate-Control": []string{"max-age=3600"},
				"Surrogate-Key":     []string{"d505075a-ee28-4a02-b27a-5973fd2ea35f"},
			},
		},
		{
			name: "IfNoneMatch matches",
			id:   id1,
			params: &client.GetFileParams{
				IfNoneMatch: new(`"65a8e27d8879283831b664bd8b7f0ad4"`),
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusNotModified,
			expectedBody:       "",
			expectedHeaders: http.Header{
				"Cache-Control":     []string{"max-age=3600"},
				"Date":              []string{"Mon, 21 Jul 2025 13:24:53 GMT"},
				"Etag":              []string{`"65a8e27d8879283831b664bd8b7f0ad4"`},
				"Last-Modified":     []string{"2025-07-21 13:24:53.586273 +0000 +0000"},
				"Surrogate-Control": []string{"max-age=3600"},
				"Surrogate-Key":     []string{"d505075a-ee28-4a02-b27a-5973fd2ea35f"},
			},
		},
		{
			name: "IfNoneMatch does not match",
			id:   id1,
			params: &client.GetFileParams{
				IfNoneMatch: new(`"85a8e27d8879283831b664bd8b7f0ad4"`),
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusOK,
			expectedBody:       "Hello, World!",
			expectedHeaders: http.Header{
				"Accept-Ranges":       []string{"bytes"},
				"Cache-Control":       []string{"max-age=3600"},
				"Content-Disposition": []string{`inline; filename="testfile.txt"`},
				"Content-Length":      []string{"13"},
				"Content-Type":        []string{"text/plain; charset=utf-8"},
				"Date":                []string{"Mon, 21 Jul 2025 13:24:53 GMT"},
				"Etag":                []string{`"65a8e27d8879283831b664bd8b7f0ad4"`},
				"Last-Modified":       []string{"2025-07-21 13:24:53.586273 +0000 +0000"},
				"Surrogate-Control":   []string{"max-age=3600"},
				"Surrogate-Key":       []string{"d505075a-ee28-4a02-b27a-5973fd2ea35f"},
			},
		},
		{
			name: "IfModifiedSince matches",
			id:   id1,
			params: &client.GetFileParams{
				IfModifiedSince: new(client.NewTime(time.Now().Add(-time.Hour))),
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusOK,
			expectedBody:       "Hello, World!",
			expectedHeaders: http.Header{
				"Accept-Ranges":       []string{"bytes"},
				"Cache-Control":       []string{"max-age=3600"},
				"Content-Disposition": []string{`inline; filename="testfile.txt"`},
				"Content-Length":      []string{"13"},
				"Content-Type":        []string{"text/plain; charset=utf-8"},
				"Date":                []string{"Mon, 21 Jul 2025 13:24:53 GMT"},
				"Etag":                []string{`"65a8e27d8879283831b664bd8b7f0ad4"`},
				"Last-Modified":       []string{"2025-07-21 13:24:53.586273 +0000 +0000"},
				"Surrogate-Control":   []string{"max-age=3600"},
				"Surrogate-Key":       []string{"d505075a-ee28-4a02-b27a-5973fd2ea35f"},
			},
		},
		{
			name: "IfModifiedSince does not match",
			id:   id1,
			params: &client.GetFileParams{
				IfModifiedSince: new(client.NewTime(time.Now().Add(time.Hour))),
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusNotModified,
			expectedBody:       "",
			expectedHeaders: http.Header{
				"Cache-Control":     []string{"max-age=3600"},
				"Date":              []string{"Mon, 21 Jul 2025 13:24:53 GMT"},
				"Etag":              []string{`"65a8e27d8879283831b664bd8b7f0ad4"`},
				"Last-Modified":     []string{"2025-07-21 13:24:53.586273 +0000 +0000"},
				"Surrogate-Control": []string{"max-age=3600"},
				"Surrogate-Key":     []string{"d505075a-ee28-4a02-b27a-5973fd2ea35f"},
			},
		},
		{
			name: "IfUnmodifiedSince matches",
			id:   id1,
			params: &client.GetFileParams{
				IfUnmodifiedSince: new(client.NewTime(time.Now().Add(-time.Hour))),
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusPreconditionFailed,
			expectedBody:       "",
			expectedHeaders: http.Header{
				"Cache-Control":     []string{"max-age=3600"},
				"Content-Length":    []string{"0"},
				"Date":              []string{"Mon, 21 Jul 2025 13:24:53 GMT"},
				"Etag":              []string{`"65a8e27d8879283831b664bd8b7f0ad4"`},
				"Last-Modified":     []string{"2025-07-21 13:24:53.586273 +0000 +0000"},
				"Surrogate-Control": []string{"max-age=3600"},
				"Surrogate-Key":     []string{"d505075a-ee28-4a02-b27a-5973fd2ea35f"},
			},
		},
		{
			name: "IfUnmodifiedSince does not match",
			id:   id1,
			params: &client.GetFileParams{
				IfUnmodifiedSince: new(client.NewTime(time.Now().Add(time.Hour))),
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusOK,
			expectedBody:       "Hello, World!",
			expectedHeaders: http.Header{
				"Accept-Ranges":       []string{"bytes"},
				"Cache-Control":       []string{"max-age=3600"},
				"Content-Disposition": []string{`inline; filename="testfile.txt"`},
				"Content-Length":      []string{"13"},
				"Content-Type":        []string{"text/plain; charset=utf-8"},
				"Date":                []string{"Mon, 21 Jul 2025 13:24:53 GMT"},
				"Etag":                []string{`"65a8e27d8879283831b664bd8b7f0ad4"`},
				"Last-Modified":       []string{"2025-07-21 13:24:53.586273 +0000 +0000"},
				"Surrogate-Control":   []string{"max-age=3600"},
				"Surrogate-Key":       []string{"d505075a-ee28-4a02-b27a-5973fd2ea35f"},
			},
		},
		{
			name:   "x-hasura-admin-secret",
			id:     id1,
			params: nil,
			interceptor: WithHeaders(http.Header{
				"x-hasura-admin-secret": []string{"nhost-admin-secret"},
			}),
			expectedStatusCode: http.StatusOK,
			expectedBody:       "Hello, World!",
			expectedHeaders: http.Header{
				"Accept-Ranges":       []string{"bytes"},
				"Cache-Control":       []string{"max-age=3600"},
				"Content-Disposition": []string{`inline; filename="testfile.txt"`},
				"Content-Length":      []string{"13"},
				"Content-Type":        []string{"text/plain; charset=utf-8"},
				"Date":                []string{"Mon, 21 Jul 2025 13:24:53 GMT"},
				"Etag":                []string{`"65a8e27d8879283831b664bd8b7f0ad4"`},
				"Last-Modified":       []string{"2025-07-21 13:24:53.586273 +0000 +0000"},
				"Surrogate-Control":   []string{"max-age=3600"},
				"Surrogate-Key":       []string{"d505075a-ee28-4a02-b27a-5973fd2ea35f"},
			},
		},
		{
			name:   "x-hasura-role",
			id:     id1,
			params: nil,
			interceptor: WithHeaders(http.Header{
				"x-hasura-admin-secret": []string{"nhost-admin-secret"},
				"x-hasura-role":         []string{"user"},
			}),
			expectedStatusCode: http.StatusForbidden,
			expectedBody:       "{\"error\":{\"data\":null,\"message\":\"you are not authorized\"}}\n",
			expectedHeaders: http.Header{
				"Content-Length": {"59"},
				"Content-Type":   {"application/json"},
				"Date":           {"Mon, 21 Jul 2025 13:44:26 GMT"},
				"X-Error":        {"you are not authorized"},
			},
		},
		{
			name:               "unauthenticated request",
			id:                 id1,
			params:             nil,
			interceptor:        nil,
			expectedStatusCode: http.StatusForbidden,
			expectedBody:       "{\"error\":{\"data\":null,\"message\":\"you are not authorized\"}}\n",
			expectedHeaders: http.Header{
				"Content-Length": {"59"},
				"Content-Type":   {"application/json"},
				"Date":           {"Mon, 21 Jul 2025 13:44:26 GMT"},
				"X-Error":        {"you are not authorized"},
			},
		},
		{
			name: "range",
			id:   id1,
			params: &client.GetFileParams{
				Range: new("bytes=0-4"),
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusPartialContent,
			expectedBody:       "Hello",
			expectedHeaders: http.Header{
				"Cache-Control":       []string{"max-age=3600"},
				"Content-Disposition": []string{`inline; filename="testfile.txt"`},
				"Content-Length":      []string{"5"},
				"Content-Range":       []string{"bytes 0-4/13"},
				"Content-Type":        []string{"text/plain; charset=utf-8"},
				"Date":                []string{"Mon, 21 Jul 2025 13:24:53 GMT"},
				"Etag":                []string{`"65a8e27d8879283831b664bd8b7f0ad4"`},
				"Last-Modified":       []string{"2025-07-21 13:24:53.586273 +0000 +0000"},
				"Surrogate-Control":   []string{"max-age=3600"},
				"Surrogate-Key":       []string{"d505075a-ee28-4a02-b27a-5973fd2ea35f"},
			},
		},
		{
			name: "range middle",
			id:   id1,
			params: &client.GetFileParams{
				Range: new("bytes=2-8"),
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusPartialContent,
			expectedBody:       "llo, Wo",
			expectedHeaders: http.Header{
				"Cache-Control":       []string{"max-age=3600"},
				"Content-Disposition": []string{`inline; filename="testfile.txt"`},
				"Content-Length":      []string{"7"},
				"Content-Range":       []string{"bytes 2-8/13"},
				"Content-Type":        []string{"text/plain; charset=utf-8"},
				"Date":                []string{"Mon, 21 Jul 2025 13:24:53 GMT"},
				"Etag":                []string{`"65a8e27d8879283831b664bd8b7f0ad4"`},
				"Last-Modified":       []string{"2025-07-21 13:24:53.586273 +0000 +0000"},
				"Surrogate-Control":   []string{"max-age=3600"},
				"Surrogate-Key":       []string{"d505075a-ee28-4a02-b27a-5973fd2ea35f"},
			},
		},
		{
			name:               "image",
			id:                 id2,
			params:             nil,
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusOK,
			expectedBody:       "ignoreme",
			expectedHeaders: http.Header{
				"Accept-Ranges":       []string{"bytes"},
				"Cache-Control":       []string{"max-age=3600"},
				"Content-Disposition": []string{`inline; filename="nhost.jpg"`},
				"Content-Length":      []string{"33399"},
				"Content-Type":        []string{"image/jpeg"},
				"Date":                []string{"Mon, 21 Jul 2025 13:24:53 GMT"},
				"Etag":                []string{`"78b676e65ebc31f0bb1f2f0d05098572"`},
				"Last-Modified":       []string{"2025-07-21 13:24:53.586273 +0000 +0000"},
				"Surrogate-Control":   []string{"max-age=3600"},
				"Surrogate-Key":       []string{id2},
			},
		},
		{
			name: "image manipulation",
			id:   id2,
			params: &client.GetFileParams{
				Q: new(80),
				H: new(100),
				W: new(100),
				B: new(float32(0.10)),
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusOK,
			expectedBody:       "ignoreme",
			expectedHeaders: http.Header{
				"Accept-Ranges":       []string{"bytes"},
				"Cache-Control":       []string{"max-age=3600"},
				"Content-Disposition": []string{`inline; filename="nhost.jpg"`},
				"Content-Length":      []string{"8963"},
				"Content-Type":        []string{"image/jpeg"},
				"Date":                []string{"Mon, 21 Jul 2025 13:24:53 GMT"},
				"Etag":                []string{`"78b676e65ebc31f0bb1f2f0d05098572"`},
				"Last-Modified":       []string{"2025-07-21 13:24:53.586273 +0000 +0000"},
				"Surrogate-Control":   []string{"max-age=3600"},
				"Surrogate-Key":       []string{id2},
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

			resp, err := cl.GetFileWithResponse(
				t.Context(),
				tc.id,
				tc.params,
				interceptor...,
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if resp.StatusCode() != tc.expectedStatusCode {
				t.Errorf(
					"expected status code %d, got %d", tc.expectedStatusCode, resp.StatusCode(),
				)
			}

			if tc.expectedBody != "ignoreme" {
				if diff := cmp.Diff(string(resp.Body), tc.expectedBody); diff != "" {
					t.Errorf("unexpected response body: %s", diff)
				}
			}

			if diff := cmp.Diff(
				resp.HTTPResponse.Header,
				tc.expectedHeaders,
				IgnoreResponseHeaders(),
			); diff != "" {
				t.Errorf("unexpected response headers: %s", diff)
			}
		})
	}
}
