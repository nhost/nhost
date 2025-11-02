package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/go-cmp/cmp"
)

func makeRequest(
	router *gin.Engine,
	method, path string,
	headers map[string]string,
	body io.Reader,
) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, body)

	for key, value := range headers {
		req.Header.Set(key, value)
	}

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	return w
}

func TestRequests(t *testing.T) {
	t.Parallel()

	logger := getLogger()

	router, err := setupRouter(logger)
	if err != nil {
		t.Fatalf("Failed to set up router: %v", err)
	}

	cases := []struct {
		name             string
		method           string
		path             string
		headers          map[string]string
		body             io.Reader
		expectedStatus   int
		expectedResponse string
	}{
		{
			name:   "success",
			method: http.MethodPost,
			path:   "/signin/email-password",
			headers: map[string]string{
				"Content-Type": "application/json",
			},
			body:             strings.NewReader(`{"email": "asd@asd.com", "password": "p4ssw0rd"}`),
			expectedStatus:   http.StatusOK,
			expectedResponse: "{\"session\":{\"accessToken\":\"access_token_example\",\"accessTokenExpiresIn\":900,\"refreshToken\":\"refresh_token_example\",\"refreshTokenId\":\"refresh_token_id_example\"}}\n", //nolint:lll
		},

		{
			name:   "expected error",
			method: http.MethodPost,
			path:   "/signin/email-password",
			headers: map[string]string{
				"Content-Type": "application/json",
			},
			body:             strings.NewReader(`{"email": "bad@email.com", "password": "p4ssw0rd"}`),
			expectedStatus:   http.StatusConflict,
			expectedResponse: "{\"error\":\"disabled-user\",\"message\":\"The user account is disabled.\",\"status\":409}\n", //nolint:lll
		},

		{
			name:   "unexpected error",
			method: http.MethodPost,
			path:   "/signin/email-password",
			headers: map[string]string{
				"Content-Type": "application/json",
			},
			body:             strings.NewReader(`{"email": "crash@email.com", "password": "p4ssw0rd"}`),
			expectedStatus:   http.StatusInternalServerError,
			expectedResponse: `{"errors":"internal-server-error","message":"simulated server crash"}`,
		},

		{
			name:   "missing body",
			method: http.MethodPost,
			path:   "/signin/email-password",
			headers: map[string]string{
				"Content-Type": "application/json",
			},
			body:             nil,
			expectedStatus:   http.StatusBadRequest,
			expectedResponse: `{"error":"request-validation-error","reason":"value is required but missing"}`,
		},

		{
			name:   "wrong param",
			method: http.MethodPost,
			path:   "/signin/email-password",
			headers: map[string]string{
				"Content-Type": "application/json",
			},
			body:             strings.NewReader(`{"wrong":"asd", "email": "asd@asd.com", "password": "p4ssw0rd"}`),
			expectedStatus:   http.StatusBadRequest,
			expectedResponse: `{"error":"schema-validation-error","reason":"property \"wrong\" is unsupported"}`,
		},

		{
			name:   "missing param",
			method: http.MethodPost,
			path:   "/signin/email-password",
			headers: map[string]string{
				"Content-Type": "application/json",
			},
			body:             strings.NewReader(`{"email": "asd@asd.com"}`),
			expectedStatus:   http.StatusBadRequest,
			expectedResponse: `{"error":"schema-validation-error","reason":"property \"password\" is missing"}`,
		},

		{
			name:   "invalid param",
			method: http.MethodPost,
			path:   "/signin/email-password",
			headers: map[string]string{
				"Content-Type": "application/json",
			},
			body:             strings.NewReader(`{"email": "asdasd.com", "password": "p4ssw0rd"}`),
			expectedStatus:   http.StatusBadRequest,
			expectedResponse: `{"errors":"bad-request","message":"email: failed to pass regex validation"}`,
		},

		{
			name:   "needs security",
			method: http.MethodPost,
			path:   "/user/email/change",
			headers: map[string]string{
				"Content-Type": "application/json",
			},
			body:             strings.NewReader(`{"newEmail": "new@asd.com"`),
			expectedStatus:   http.StatusUnauthorized,
			expectedResponse: `{"error":"unauthorized","reason":"your access token is invalid","securityScheme":"BearerAuthElevated"}`, //nolint:lll
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			w := makeRequest(router, tc.method, tc.path, tc.headers, tc.body)

			resp := w.Result()
			defer resp.Body.Close()

			body, err := io.ReadAll(resp.Body)
			if err != nil {
				t.Fatalf("Failed to read response body: %v", err)
			}

			if resp.StatusCode != tc.expectedStatus {
				t.Errorf("Expected status %d, got %d", tc.expectedStatus, resp.StatusCode)
			}

			if diff := cmp.Diff(string(body), tc.expectedResponse); diff != "" {
				t.Errorf("Response body mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
