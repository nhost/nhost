package client_test

import (
	"context"
	"net/http"
	"regexp"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/uuid"
	"github.com/nhost/hasura-storage/client"
)

func compareURLWithRegexp() cmp.Option {
	return cmp.FilterPath(
		func(p cmp.Path) bool {
			return p.Last().String() == `.Url`
		},
		cmp.Comparer(func(a, b string) bool {
			reg1 := regexp.MustCompile(a)
			reg2 := regexp.MustCompile(b)

			return reg1.MatchString(b) || reg2.MatchString(a)
		}),
	)
}

func TestGetFilePresignedURL(t *testing.T) {
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
		expected           *client.PresignedURLResponse
		expectedErr        *client.ErrorResponse
		expectedHeaders    http.Header
	}{
		{
			name:               "simple get",
			id:                 id1,
			interceptor:        WithAccessToken(accessTokenValidUser),
			expectedStatusCode: http.StatusOK,
			expected: &client.PresignedURLResponse{
				Expiration: 30,
				Url:        "http://localhost:8000/v1/files/.*/presignedurl/content?.*",
			},
			expectedHeaders: http.Header{
				"Content-Length": {"470"},
				"Content-Type":   {"application/json"},
				"Date":           {"Mon, 21 Jul 2025 14:45:00 GMT"},
			},
		},
		{
			name: "x-hasura-admin-secret",
			id:   id1,
			interceptor: WithHeaders(http.Header{
				"x-hasura-admin-secret": []string{"nhost-admin-secret"},
			}),
			expectedStatusCode: http.StatusOK,
			expected: &client.PresignedURLResponse{
				Expiration: 30,
				Url:        "http://localhost:8000/v1/files/.*/presignedurl/content?.*",
			},
			expectedHeaders: http.Header{
				"Content-Length": {"470"},
				"Content-Type":   {"application/json"},
				"Date":           {"Mon, 21 Jul 2025 14:45:00 GMT"},
			},
		},
		{
			name: "x-hasura-role",
			id:   id1,
			interceptor: WithHeaders(http.Header{
				"x-hasura-admin-secret": []string{"nhost-admin-secret"},
				"x-hasura-role":         []string{"user"},
			}),
			expectedStatusCode: http.StatusForbidden,
			expected:           nil,
			expectedErr: &client.ErrorResponse{
				Error: &struct {
					Data    *map[string]any `json:"data,omitempty"`
					Message string          `json:"message"`
				}{
					Message: "you are not authorized",
				},
			},
			expectedHeaders: http.Header{
				"Content-Length": {"59"},
				"Content-Type":   {"application/json"},
				"Date":           {"Mon, 21 Jul 2025 14:45:00 GMT"},
				"X-Error":        {"you are not authorized"},
			},
		},
		{
			name:               "unauthenticated request",
			id:                 id1,
			interceptor:        nil,
			expectedStatusCode: http.StatusForbidden,
			expected:           nil,
			expectedErr: &client.ErrorResponse{
				Error: &struct {
					Data    *map[string]any `json:"data,omitempty"`
					Message string          `json:"message"`
				}{
					Message: "you are not authorized",
				},
			},
			expectedHeaders: http.Header{
				"Content-Length": {"59"},
				"Content-Type":   {"application/json"},
				"Date":           {"Mon, 21 Jul 2025 14:45:00 GMT"},
				"X-Error":        {"you are not authorized"},
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

			resp, err := cl.GetFilePresignedURLWithResponse(
				t.Context(),
				tc.id,
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

			if diff := cmp.Diff(resp.JSON200, tc.expected, compareURLWithRegexp()); diff != "" {
				t.Errorf("unexpected response: %s", diff)
			}

			if diff := cmp.Diff(resp.JSONDefault, tc.expectedErr); diff != "" {
				t.Errorf("unexpected error response: %s", diff)
			}

			if diff := cmp.Diff(
				resp.HTTPResponse.Header,
				tc.expectedHeaders,
				compareContentLength(),
				IgnoreResponseHeaders(),
			); diff != "" {
				t.Errorf("unexpected headers: %s", diff)
			}
		})
	}
}
