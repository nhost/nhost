package client_test

import (
	"context"
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/uuid"
	"github.com/nhost/nhost/services/storage/client"
)

func compareCacheControlMaxAge() cmp.Option { //nolint:cyclop
	return cmp.FilterPath(
		func(p cmp.Path) bool {
			return p.Last().String() == `["Cache-Control"]` ||
				p.Last().String() == `["Surrogate-Control"]`
		},
		cmp.Comparer(func(a, b []string) bool {
			if len(a) != 1 || len(b) != 1 {
				return false
			}

			// Accept max-age values from 27 to 30
			validValues := []string{"max-age=27", "max-age=28", "max-age=29", "max-age=30"}
			for _, valid := range validValues {
				if a[0] == valid || b[0] == valid {
					for _, otherValid := range validValues {
						if (a[0] == valid && b[0] == otherValid) ||
							(a[0] == otherValid && b[0] == valid) {
							return true
						}
					}
				}
			}

			return a[0] == b[0]
		}),
	)
}

func TestGetFileWithPresignedURL(t *testing.T) { //nolint:cyclop,maintidx
	t.Parallel()

	cl, err := client.NewClientWithResponses(testBaseURL)
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	id1 := uuid.NewString()
	id2 := uuid.NewString()

	uploadInitialFile(t, cl, id1, id2)

	p1, err := cl.GetFilePresignedURLWithResponse(
		t.Context(), id1, WithAccessToken(accessTokenValidUser),
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	presignedURL1, err := url.Parse(p1.JSON200.Url)
	if err != nil {
		t.Fatalf("failed to parse presigned URL: %v", err)
	}

	params1 := func() *client.GetFileWithPresignedURLParams {
		return &client.GetFileWithPresignedURLParams{
			XAmzAlgorithm:     presignedURL1.Query().Get("X-Amz-Algorithm"),
			XAmzChecksumMode:  presignedURL1.Query().Get("X-Amz-Checksum-Mode"),
			XAmzCredential:    presignedURL1.Query().Get("X-Amz-Credential"),
			XAmzDate:          presignedURL1.Query().Get("X-Amz-Date"),
			XAmzExpires:       presignedURL1.Query().Get("X-Amz-Expires"),
			XId:               presignedURL1.Query().Get("x-id"),
			XAmzSignature:     presignedURL1.Query().Get("X-Amz-Signature"),
			XAmzSignedHeaders: presignedURL1.Query().Get("X-Amz-SignedHeaders"),
		}
	}

	p2, err := cl.GetFilePresignedURLWithResponse(
		t.Context(), id2, WithAccessToken(accessTokenValidUser),
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	presignedURL2, err := url.Parse(p2.JSON200.Url)
	if err != nil {
		t.Fatalf("failed to parse presigned URL: %v", err)
	}

	params2 := func() *client.GetFileWithPresignedURLParams {
		return &client.GetFileWithPresignedURLParams{
			XAmzAlgorithm:     presignedURL2.Query().Get("X-Amz-Algorithm"),
			XAmzChecksumMode:  presignedURL2.Query().Get("X-Amz-Checksum-Mode"),
			XAmzCredential:    presignedURL2.Query().Get("X-Amz-Credential"),
			XAmzDate:          presignedURL2.Query().Get("X-Amz-Date"),
			XAmzExpires:       presignedURL2.Query().Get("X-Amz-Expires"),
			XId:               presignedURL2.Query().Get("x-id"),
			XAmzSignature:     presignedURL2.Query().Get("X-Amz-Signature"),
			XAmzSignedHeaders: presignedURL2.Query().Get("X-Amz-SignedHeaders"),
		}
	}

	cases := []struct {
		name               string
		id                 string
		requestParams      func() *client.GetFileWithPresignedURLParams
		interceptor        func(ctx context.Context, req *http.Request) error
		expectedStatusCode int
		expectedBody       string
		expectedErr        *client.ErrorResponse
		expectedHeaders    http.Header
	}{
		{
			name:        "simple get",
			id:          id1,
			interceptor: WithAccessToken(accessTokenValidUser),
			requestParams: func() *client.GetFileWithPresignedURLParams {
				return params1()
			},
			expectedStatusCode: http.StatusOK,
			expectedBody:       "Hello, World!",
			expectedHeaders: http.Header{
				"Accept-Ranges":       []string{"bytes"},
				"Cache-Control":       []string{"max-age=29"},
				"Content-Disposition": []string{`inline; filename="testfile.txt"`},
				"Content-Length":      []string{"13"},
				"Content-Type":        []string{"text/plain; charset=utf-8"},
				"Date":                []string{"Mon, 21 Jul 2025 13:24:53 GMT"},
				"Etag":                []string{`"65a8e27d8879283831b664bd8b7f0ad4"`},
				"Last-Modified":       []string{"2025-07-21 13:24:53.586273 +0000 +0000"},
				"Surrogate-Control":   []string{"max-age=29"},
				"Surrogate-Key":       []string{"d505075a-ee28-4a02-b27a-5973fd2ea35f"},
			},
		},
		{
			name:        "IfMatch matches",
			id:          id1,
			interceptor: WithAccessToken(accessTokenValidUser),
			requestParams: func() *client.GetFileWithPresignedURLParams {
				req := params1()
				req.IfMatch = new(`"65a8e27d8879283831b664bd8b7f0ad4"`)

				return req
			},
			expectedStatusCode: http.StatusOK,
			expectedBody:       "Hello, World!",
			expectedHeaders: http.Header{
				"Accept-Ranges":       []string{"bytes"},
				"Cache-Control":       []string{"max-age=29"},
				"Content-Disposition": []string{`inline; filename="testfile.txt"`},
				"Content-Length":      []string{"13"},
				"Content-Type":        []string{"text/plain; charset=utf-8"},
				"Date":                []string{"Mon, 21 Jul 2025 13:24:53 GMT"},
				"Etag":                []string{`"65a8e27d8879283831b664bd8b7f0ad4"`},
				"Last-Modified":       []string{"2025-07-21 13:24:53.586273 +0000 +0000"},
				"Surrogate-Control":   []string{"max-age=29"},
				"Surrogate-Key":       []string{"d505075a-ee28-4a02-b27a-5973fd2ea35f"},
			},
		},
		{
			name: "IfMatch does not match",
			id:   id1,
			requestParams: func() *client.GetFileWithPresignedURLParams {
				req := params1()
				req.IfMatch = new(`"85a8e27d8879283831b664bd8b7f0ad4"`)

				return req
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusPreconditionFailed,
			expectedBody:       "",
			expectedHeaders: http.Header{
				"Cache-Control":     []string{"max-age=29"},
				"Content-Length":    []string{"0"},
				"Date":              []string{"Mon, 21 Jul 2025 13:24:53 GMT"},
				"Etag":              []string{`"65a8e27d8879283831b664bd8b7f0ad4"`},
				"Last-Modified":     []string{"2025-07-21 13:24:53.586273 +0000 +0000"},
				"Surrogate-Control": []string{"max-age=29"},
				"Surrogate-Key":     []string{"d505075a-ee28-4a02-b27a-5973fd2ea35f"},
			},
		},
		{
			name: "IfNoneMatch matches",
			id:   id1,
			requestParams: func() *client.GetFileWithPresignedURLParams {
				req := params1()
				req.IfNoneMatch = new(`"65a8e27d8879283831b664bd8b7f0ad4"`)

				return req
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusNotModified,
			expectedBody:       "",
			expectedHeaders: http.Header{
				"Cache-Control":     []string{"max-age=29"},
				"Date":              []string{"Mon, 21 Jul 2025 13:24:53 GMT"},
				"Etag":              []string{`"65a8e27d8879283831b664bd8b7f0ad4"`},
				"Last-Modified":     []string{"2025-07-21 13:24:53.586273 +0000 +0000"},
				"Surrogate-Control": []string{"max-age=29"},
				"Surrogate-Key":     []string{"d505075a-ee28-4a02-b27a-5973fd2ea35f"},
			},
		},
		{
			name: "IfNoneMatch does not match",
			id:   id1,
			requestParams: func() *client.GetFileWithPresignedURLParams {
				req := params1()
				req.IfNoneMatch = new(`"85a8e27d8879283831b664bd8b7f0ad4"`)

				return req
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusOK,
			expectedBody:       "Hello, World!",
			expectedHeaders: http.Header{
				"Accept-Ranges":       []string{"bytes"},
				"Cache-Control":       []string{"max-age=29"},
				"Content-Disposition": []string{`inline; filename="testfile.txt"`},
				"Content-Length":      []string{"13"},
				"Content-Type":        []string{"text/plain; charset=utf-8"},
				"Date":                []string{"Mon, 21 Jul 2025 13:24:53 GMT"},
				"Etag":                []string{`"65a8e27d8879283831b664bd8b7f0ad4"`},
				"Last-Modified":       []string{"2025-07-21 13:24:53.586273 +0000 +0000"},
				"Surrogate-Control":   []string{"max-age=29"},
				"Surrogate-Key":       []string{"d505075a-ee28-4a02-b27a-5973fd2ea35f"},
			},
		},
		{
			name: "IfModifiedSince matches",
			id:   id1,
			requestParams: func() *client.GetFileWithPresignedURLParams {
				req := params1()
				req.IfModifiedSince = new(client.NewTime(time.Now().Add(-time.Hour)))

				return req
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusOK,
			expectedBody:       "Hello, World!",
			expectedHeaders: http.Header{
				"Accept-Ranges":       []string{"bytes"},
				"Cache-Control":       []string{"max-age=29"},
				"Content-Disposition": []string{`inline; filename="testfile.txt"`},
				"Content-Length":      []string{"13"},
				"Content-Type":        []string{"text/plain; charset=utf-8"},
				"Date":                []string{"Mon, 21 Jul 2025 13:24:53 GMT"},
				"Etag":                []string{`"65a8e27d8879283831b664bd8b7f0ad4"`},
				"Last-Modified":       []string{"2025-07-21 13:24:53.586273 +0000 +0000"},
				"Surrogate-Control":   []string{"max-age=29"},
				"Surrogate-Key":       []string{"d505075a-ee28-4a02-b27a-5973fd2ea35f"},
			},
		},
		{
			name: "IfModifiedSince does not match",
			id:   id1,
			requestParams: func() *client.GetFileWithPresignedURLParams {
				req := params1()
				req.IfModifiedSince = new(client.NewTime(time.Now().Add(time.Hour)))

				return req
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusNotModified,
			expectedBody:       "",
			expectedHeaders: http.Header{
				"Cache-Control":     []string{"max-age=29"},
				"Date":              []string{"Mon, 21 Jul 2025 13:24:53 GMT"},
				"Etag":              []string{`"65a8e27d8879283831b664bd8b7f0ad4"`},
				"Last-Modified":     []string{"2025-07-21 13:24:53.586273 +0000 +0000"},
				"Surrogate-Control": []string{"max-age=29"},
				"Surrogate-Key":     []string{"d505075a-ee28-4a02-b27a-5973fd2ea35f"},
			},
		},
		{
			name: "IfUnmodifiedSince matches",
			id:   id1,
			requestParams: func() *client.GetFileWithPresignedURLParams {
				req := params1()
				req.IfUnmodifiedSince = new(client.NewTime(time.Now().Add(-time.Hour)))

				return req
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusPreconditionFailed,
			expectedBody:       "",
			expectedHeaders: http.Header{
				"Cache-Control":     []string{"max-age=29"},
				"Content-Length":    []string{"0"},
				"Date":              []string{"Mon, 21 Jul 2025 13:24:53 GMT"},
				"Etag":              []string{`"65a8e27d8879283831b664bd8b7f0ad4"`},
				"Last-Modified":     []string{"2025-07-21 13:24:53.586273 +0000 +0000"},
				"Surrogate-Control": []string{"max-age=29"},
				"Surrogate-Key":     []string{"d505075a-ee28-4a02-b27a-5973fd2ea35f"},
			},
		},
		{
			name: "IfUnmodifiedSince does not match",
			id:   id1,
			requestParams: func() *client.GetFileWithPresignedURLParams {
				req := params1()
				req.IfUnmodifiedSince = new(client.NewTime(time.Now().Add(time.Hour)))

				return req
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusOK,
			expectedBody:       "Hello, World!",
			expectedHeaders: http.Header{
				"Accept-Ranges":       []string{"bytes"},
				"Cache-Control":       []string{"max-age=29"},
				"Content-Disposition": []string{`inline; filename="testfile.txt"`},
				"Content-Length":      []string{"13"},
				"Content-Type":        []string{"text/plain; charset=utf-8"},
				"Date":                []string{"Mon, 21 Jul 2025 13:24:53 GMT"},
				"Etag":                []string{`"65a8e27d8879283831b664bd8b7f0ad4"`},
				"Last-Modified":       []string{"2025-07-21 13:24:53.586273 +0000 +0000"},
				"Surrogate-Control":   []string{"max-age=29"},
				"Surrogate-Key":       []string{"d505075a-ee28-4a02-b27a-5973fd2ea35f"},
			},
		},
		{
			name: "x-hasura-admin-secret",
			id:   id1,
			requestParams: func() *client.GetFileWithPresignedURLParams {
				req := params1()
				return req
			},
			interceptor: WithHeaders(http.Header{
				"x-hasura-admin-secret": []string{"nhost-admin-secret"},
			}),
			expectedStatusCode: http.StatusOK,
			expectedBody:       "Hello, World!",
			expectedHeaders: http.Header{
				"Accept-Ranges":       []string{"bytes"},
				"Cache-Control":       []string{"max-age=29"},
				"Content-Disposition": []string{`inline; filename="testfile.txt"`},
				"Content-Length":      []string{"13"},
				"Content-Type":        []string{"text/plain; charset=utf-8"},
				"Date":                []string{"Mon, 21 Jul 2025 13:24:53 GMT"},
				"Etag":                []string{`"65a8e27d8879283831b664bd8b7f0ad4"`},
				"Last-Modified":       []string{"2025-07-21 13:24:53.586273 +0000 +0000"},
				"Surrogate-Control":   []string{"max-age=29"},
				"Surrogate-Key":       []string{"d505075a-ee28-4a02-b27a-5973fd2ea35f"},
			},
		},
		{
			name: "x-hasura-role",
			id:   id1,
			requestParams: func() *client.GetFileWithPresignedURLParams {
				req := params1()
				return req
			},
			interceptor: WithHeaders(http.Header{
				"x-hasura-admin-secret": []string{"nhost-admin-secret"},
				"x-hasura-role":         []string{"user"},
			}),
			expectedStatusCode: http.StatusOK,
			expectedBody:       "Hello, World!",
			expectedHeaders: http.Header{
				"Accept-Ranges":       []string{"bytes"},
				"Cache-Control":       []string{"max-age=29"},
				"Content-Disposition": []string{`inline; filename="testfile.txt"`},
				"Content-Length":      []string{"13"},
				"Content-Type":        []string{"text/plain; charset=utf-8"},
				"Date":                []string{"Mon, 21 Jul 2025 13:24:53 GMT"},
				"Etag":                []string{`"65a8e27d8879283831b664bd8b7f0ad4"`},
				"Last-Modified":       []string{"2025-07-21 13:24:53.586273 +0000 +0000"},
				"Surrogate-Control":   []string{"max-age=29"},
				"Surrogate-Key":       []string{"d505075a-ee28-4a02-b27a-5973fd2ea35f"},
			},
		},
		{
			name: "unauthenticated request",
			id:   id1,
			requestParams: func() *client.GetFileWithPresignedURLParams {
				return params1()
			},
			interceptor:        nil,
			expectedStatusCode: http.StatusOK,
			expectedBody:       "Hello, World!",
			expectedHeaders: http.Header{
				"Accept-Ranges":       []string{"bytes"},
				"Cache-Control":       []string{"max-age=29"},
				"Content-Disposition": []string{`inline; filename="testfile.txt"`},
				"Content-Length":      []string{"13"},
				"Content-Type":        []string{"text/plain; charset=utf-8"},
				"Date":                []string{"Mon, 21 Jul 2025 13:24:53 GMT"},
				"Etag":                []string{`"65a8e27d8879283831b664bd8b7f0ad4"`},
				"Last-Modified":       []string{"2025-07-21 13:24:53.586273 +0000 +0000"},
				"Surrogate-Control":   []string{"max-age=29"},
				"Surrogate-Key":       []string{"d505075a-ee28-4a02-b27a-5973fd2ea35f"},
			},
		},
		{
			name: "range",
			id:   id1,
			requestParams: func() *client.GetFileWithPresignedURLParams {
				req := params1()
				req.Range = new("bytes=0-4")

				return req
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusPartialContent,
			expectedBody:       "Hello",
			expectedHeaders: http.Header{
				"Cache-Control":       []string{"max-age=29"},
				"Content-Disposition": []string{`inline; filename="testfile.txt"`},
				"Content-Length":      []string{"5"},
				"Content-Range":       []string{"bytes 0-4/13"},
				"Content-Type":        []string{"text/plain; charset=utf-8"},
				"Date":                []string{"Mon, 21 Jul 2025 13:24:53 GMT"},
				"Etag":                []string{`"65a8e27d8879283831b664bd8b7f0ad4"`},
				"Last-Modified":       []string{"2025-07-21 13:24:53.586273 +0000 +0000"},
				"Surrogate-Control":   []string{"max-age=29"},
				"Surrogate-Key":       []string{"d505075a-ee28-4a02-b27a-5973fd2ea35f"},
			},
		},
		{
			name: "range middle",
			id:   id1,
			requestParams: func() *client.GetFileWithPresignedURLParams {
				req := params1()
				req.Range = new("bytes=2-8")

				return req
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusPartialContent,
			expectedBody:       "llo, Wo",
			expectedHeaders: http.Header{
				"Cache-Control":       []string{"max-age=29"},
				"Content-Disposition": []string{`inline; filename="testfile.txt"`},
				"Content-Length":      []string{"7"},
				"Content-Range":       []string{"bytes 2-8/13"},
				"Content-Type":        []string{"text/plain; charset=utf-8"},
				"Date":                []string{"Mon, 21 Jul 2025 13:24:53 GMT"},
				"Etag":                []string{`"65a8e27d8879283831b664bd8b7f0ad4"`},
				"Last-Modified":       []string{"2025-07-21 13:24:53.586273 +0000 +0000"},
				"Surrogate-Control":   []string{"max-age=29"},
				"Surrogate-Key":       []string{"d505075a-ee28-4a02-b27a-5973fd2ea35f"},
			},
		},
		{
			name: "image",
			id:   id2,
			requestParams: func() *client.GetFileWithPresignedURLParams {
				return params2()
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusOK,
			expectedBody:       "ignoreme",
			expectedHeaders: http.Header{
				"Accept-Ranges":       []string{"bytes"},
				"Cache-Control":       []string{"max-age=29"},
				"Content-Disposition": []string{`inline; filename="nhost.jpg"`},
				"Content-Length":      []string{"33399"},
				"Content-Type":        []string{"image/jpeg"},
				"Date":                []string{"Mon, 21 Jul 2025 13:24:53 GMT"},
				"Etag":                []string{`"78b676e65ebc31f0bb1f2f0d05098572"`},
				"Last-Modified":       []string{"2025-07-21 13:24:53.586273 +0000 +0000"},
				"Surrogate-Control":   []string{"max-age=29"},
				"Surrogate-Key":       []string{id2},
			},
		},
		{
			name: "image manipulation",
			id:   id2,
			requestParams: func() *client.GetFileWithPresignedURLParams {
				req := params2()
				req.Q = new(80)
				req.H = new(100)
				req.W = new(100)
				req.B = new(float32(0.10))

				return req
			},
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusOK,
			expectedBody:       "ignoreme",
			expectedHeaders: http.Header{
				"Accept-Ranges":       []string{"bytes"},
				"Cache-Control":       []string{"max-age=30"},
				"Content-Disposition": []string{`inline; filename="nhost.jpg"`},
				"Content-Length":      []string{"8963"},
				"Content-Type":        []string{"image/jpeg"},
				"Date":                []string{"Mon, 21 Jul 2025 13:24:53 GMT"},
				"Etag":                []string{`"78b676e65ebc31f0bb1f2f0d05098572"`},
				"Last-Modified":       []string{"2025-07-21 13:24:53.586273 +0000 +0000"},
				"Surrogate-Control":   []string{"max-age=30"},
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

			resp, err := cl.GetFileWithPresignedURLWithResponse(
				t.Context(),
				tc.id,
				tc.requestParams(),
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
				compareCacheControlMaxAge(),
			); diff != "" {
				t.Errorf("unexpected response headers: %s", diff)
			}
		})
	}
}
