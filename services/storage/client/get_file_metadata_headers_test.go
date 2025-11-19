package client_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/uuid"
	"github.com/nhost/nhost/services/storage/client"
)

func TestGetFileMetadataHeaders(t *testing.T) { //nolint:maintidx
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
		params             *client.GetFileMetadataHeadersParams
		interceptor        func(ctx context.Context, req *http.Request) error
		expectedStatusCode int
		expectedHeaders    http.Header
	}{
		{
			name:               "simple get",
			id:                 id1,
			params:             nil,
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusOK,
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
			params: &client.GetFileMetadataHeadersParams{
				IfMatch: ptr(`"65a8e27d8879283831b664bd8b7f0ad4"`),
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusOK,
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
			params: &client.GetFileMetadataHeadersParams{
				IfMatch: ptr(`"85a8e27d8879283831b664bd8b7f0ad4"`),
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusPreconditionFailed,
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
			name: "IfNoneMatch matches",
			id:   id1,
			params: &client.GetFileMetadataHeadersParams{
				IfNoneMatch: ptr(`"65a8e27d8879283831b664bd8b7f0ad4"`),
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusNotModified,
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
			params: &client.GetFileMetadataHeadersParams{
				IfNoneMatch: ptr(`"85a8e27d8879283831b664bd8b7f0ad4"`),
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusOK,
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
			params: &client.GetFileMetadataHeadersParams{
				IfModifiedSince: ptr(client.NewTime(time.Now().Add(-time.Hour))),
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusOK,
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
			params: &client.GetFileMetadataHeadersParams{
				IfModifiedSince: ptr(client.NewTime(time.Now().Add(time.Hour))),
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusNotModified,
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
			params: &client.GetFileMetadataHeadersParams{
				IfUnmodifiedSince: ptr(client.NewTime(time.Now().Add(-time.Hour))),
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusPreconditionFailed,
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
			name: "IfUnmodifiedSince does not match",
			id:   id1,
			params: &client.GetFileMetadataHeadersParams{
				IfUnmodifiedSince: ptr(client.NewTime(time.Now().Add(time.Hour))),
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusOK,
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
			expectedHeaders: http.Header{
				"Date":    {"Mon, 21 Jul 2025 13:44:26 GMT"},
				"X-Error": {"you are not authorized"},
			},
		},
		{
			name:               "unauthenticated request",
			id:                 id1,
			params:             nil,
			interceptor:        nil,
			expectedStatusCode: http.StatusForbidden,
			expectedHeaders: http.Header{
				"Date":    {"Mon, 21 Jul 2025 13:44:26 GMT"},
				"X-Error": {"you are not authorized"},
			},
		},
		{
			name:               "image",
			id:                 id2,
			params:             nil,
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusOK,
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
			params: &client.GetFileMetadataHeadersParams{
				Q: ptr(80),
				H: ptr(100),
				W: ptr(100),
				B: ptr(float32(0.10)),
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusOK,
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

			resp, err := cl.GetFileMetadataHeadersWithResponse(
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
