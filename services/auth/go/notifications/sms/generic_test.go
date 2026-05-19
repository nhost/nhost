package sms_test

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/nhost/nhost/services/auth/go/notifications/sms"
)

func jsonEqual(t *testing.T, expected, actual string) bool {
	t.Helper()

	var expObj, actObj any

	if err := json.Unmarshal([]byte(expected), &expObj); err != nil {
		t.Fatalf("failed to unmarshal expected JSON: %v", err)
	}

	if err := json.Unmarshal([]byte(actual), &actObj); err != nil {
		t.Fatalf("failed to unmarshal actual JSON: %v", err)
	}

	return reflect.DeepEqual(expObj, actObj)
}

// TestGenericSMS_SendSMS exercises the generic SMS provider against an httptest
// server through a table of inline cases. The per-case server handlers contain
// the assertions specific to each case (headers, body shape, response status),
// which keeps each case self-contained at the cost of a high gocognit score —
// splitting them out into many tiny one-call helpers would hurt readability.
func TestGenericSMS_SendSMS(t *testing.T) { //nolint:gocognit,gocyclo,cyclop,maintidx
	t.Parallel()

	type testCase struct {
		name         string
		contentType  string
		bodyTemplate string
		headers      map[string]string
		to           string
		body         string
		// serverHandler validates the incoming request and returns the status code
		// the server should respond with (0 means default 200) along with a
		// response body. If nil, the case expects no HTTP request to be made.
		serverHandler        func(t *testing.T, r *http.Request) (status int, respBody string)
		expectedErrSubstring string
	}

	cases := []testCase{
		{
			name:                 "json: basic with custom header",
			contentType:          "application/json",
			bodyTemplate:         `{"to": "${ to }", "message": "Your code is ${body}"}`,
			headers:              map[string]string{"X-Custom-Header": "secret-value"},
			to:                   "+123456789",
			body:                 "123456",
			expectedErrSubstring: "",
			serverHandler: func(t *testing.T, r *http.Request) (int, string) {
				t.Helper()

				if r.Method != http.MethodPost {
					t.Errorf("expected POST method, got: %s", r.Method)
				}

				if r.Header.Get("Content-Type") != "application/json" {
					t.Errorf("expected application/json, got: %s", r.Header.Get("Content-Type"))
				}

				if r.Header.Get("X-Custom-Header") != "secret-value" {
					t.Errorf("expected secret-value header, got: %s", r.Header.Get("X-Custom-Header"))
				}

				body, err := io.ReadAll(r.Body)
				if err != nil {
					t.Fatalf("failed to read body: %v", err)
				}

				expected := `{"to": "+123456789", "message": "Your code is 123456"}`
				if !jsonEqual(t, expected, string(body)) {
					t.Errorf("JSON body mismatch.\nExpected: %s\nGot: %s", expected, string(body))
				}

				return http.StatusOK, ""
			},
		},
		{
			name:                 "form: basic",
			contentType:          "application/x-www-form-urlencoded",
			bodyTemplate:         `{"otp":"${body}", "number":"${to}"}`,
			headers:              nil,
			to:                   "+919999999999",
			body:                 "123456",
			expectedErrSubstring: "",
			serverHandler: func(t *testing.T, r *http.Request) (int, string) {
				t.Helper()

				if r.Header.Get("Content-Type") != "application/x-www-form-urlencoded" {
					t.Errorf("expected application/x-www-form-urlencoded, got: %s", r.Header.Get("Content-Type"))
				}

				if err := r.ParseForm(); err != nil {
					t.Fatalf("failed to parse form: %v", err)
				}

				if r.Form.Get("otp") != "123456" {
					t.Errorf("expected otp=123456, got: %s", r.Form.Get("otp"))
				}

				if r.Form.Get("number") != "+919999999999" {
					t.Errorf("expected number=+919999999999, got: %s", r.Form.Get("number"))
				}

				return http.StatusOK, ""
			},
		},
		{
			name:                 "json: escapes special characters in to/body",
			contentType:          "application/json",
			bodyTemplate:         `{"to":"${to}","body":"${body}"}`,
			headers:              nil,
			to:                   "+1\"\n2345",
			body:                 `code "123"`,
			expectedErrSubstring: "",
			serverHandler: func(t *testing.T, r *http.Request) (int, string) {
				t.Helper()

				var payload struct {
					To   string `json:"to"`
					Body string `json:"body"`
				}

				if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
					t.Fatalf("rendered body is not valid JSON: %v", err)
				}

				if payload.To != "+1\"\n2345" {
					t.Errorf("expected `to` to round-trip through JSON, got: %q", payload.To)
				}

				if payload.Body != `code "123"` {
					t.Errorf("expected `body` to round-trip through JSON, got: %q", payload.Body)
				}

				return http.StatusOK, ""
			},
		},
		{
			name:                 "json: whitespace template variants all resolve",
			contentType:          "application/json",
			bodyTemplate:         `{"a":"${to}","b":"${ to}","c":"${to }","d":"${  to  }"}`,
			headers:              nil,
			to:                   "+123",
			body:                 "x",
			expectedErrSubstring: "",
			serverHandler: func(t *testing.T, r *http.Request) (int, string) {
				t.Helper()

				var payload map[string]string
				if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
					t.Fatalf("rendered body is not valid JSON: %v", err)
				}

				for _, key := range []string{"a", "b", "c", "d"} {
					if payload[key] != "+123" {
						t.Errorf("expected %s=+123, got: %q", key, payload[key])
					}
				}

				return http.StatusOK, ""
			},
		},
		{
			name:                 "error: unknown template variable does not send request",
			contentType:          "application/json",
			bodyTemplate:         `{"to":"${to}","oops":"${unknown}"}`,
			headers:              nil,
			to:                   "+123",
			body:                 "456",
			serverHandler:        nil,
			expectedErrSubstring: "unknown template variable",
		},
		{
			name:         "error: response body is surfaced in error",
			contentType:  "application/json",
			bodyTemplate: `{"to":"${to}"}`,
			headers:      nil,
			to:           "+123",
			body:         "456",
			serverHandler: func(_ *testing.T, _ *http.Request) (int, string) {
				return http.StatusBadRequest, `{"error":"invalid phone number"}`
			},
			expectedErrSubstring: "invalid phone number",
		},
		{
			name:                 "error: form content-type with non-JSON template does not send request",
			contentType:          "application/x-www-form-urlencoded",
			bodyTemplate:         `otp=${body}&number=${to}`,
			headers:              nil,
			to:                   "+919999999999",
			body:                 "123456",
			serverHandler:        nil,
			expectedErrSubstring: "body template must render to valid JSON",
		},
		{
			name:                 "form: charset parameter still routes through form encoder and is preserved on Content-Type",
			contentType:          "application/x-www-form-urlencoded; charset=utf-8",
			bodyTemplate:         `{"otp":"${body}", "number":"${to}"}`,
			headers:              nil,
			to:                   "+919999999999",
			body:                 "123456",
			expectedErrSubstring: "",
			serverHandler: func(t *testing.T, r *http.Request) (int, string) {
				t.Helper()

				if got := r.Header.Get("Content-Type"); got != "application/x-www-form-urlencoded; charset=utf-8" {
					t.Errorf("expected Content-Type to preserve charset, got: %s", got)
				}

				if err := r.ParseForm(); err != nil {
					t.Fatalf("failed to parse form: %v", err)
				}

				if r.Form.Get("otp") != "123456" {
					t.Errorf("expected otp=123456, got: %s", r.Form.Get("otp"))
				}

				return http.StatusOK, ""
			},
		},
		{
			name:                 "json: charset parameter routes through json branch and is preserved on Content-Type",
			contentType:          "application/json; charset=utf-8",
			bodyTemplate:         `{"to":"${to}","body":"${body}"}`,
			headers:              nil,
			to:                   "+123456789",
			body:                 "123456",
			expectedErrSubstring: "",
			serverHandler: func(t *testing.T, r *http.Request) (int, string) {
				t.Helper()

				if got := r.Header.Get("Content-Type"); got != "application/json; charset=utf-8" {
					t.Errorf("expected Content-Type to preserve charset, got: %s", got)
				}

				var payload struct {
					To   string `json:"to"`
					Body string `json:"body"`
				}

				if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
					t.Fatalf("rendered body is not valid JSON: %v", err)
				}

				if payload.To != "+123456789" {
					t.Errorf("expected to=+123456789, got: %s", payload.To)
				}

				return http.StatusOK, ""
			},
		},
		{
			name:         "error: server 500 surfaces status code",
			contentType:  "application/json",
			bodyTemplate: "{}",
			headers:      nil,
			to:           "+123456789",
			body:         "123456",
			serverHandler: func(_ *testing.T, _ *http.Request) (int, string) {
				return http.StatusInternalServerError, ""
			},
			expectedErrSubstring: "generic sms provider returned status: 500",
		},
		{
			name:                 "twilio compatibility: form + basic auth header, 201 created",
			contentType:          "application/x-www-form-urlencoded",
			bodyTemplate:         `{"To":"${to}", "Body":"Your code is ${ body }", "From":"+12345"}`,
			headers:              map[string]string{"Authorization": "Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ=="},
			to:                   "+919999999999",
			body:                 "123456",
			expectedErrSubstring: "",
			serverHandler: func(t *testing.T, r *http.Request) (int, string) {
				t.Helper()

				if r.Header.Get("Content-Type") != "application/x-www-form-urlencoded" {
					t.Errorf("expected application/x-www-form-urlencoded, got: %s", r.Header.Get("Content-Type"))
				}

				if !strings.Contains(r.Header.Get("Authorization"), "Basic") {
					t.Errorf("expected Authorization header to contain Basic, got: %s", r.Header.Get("Authorization"))
				}

				if err := r.ParseForm(); err != nil {
					t.Fatalf("failed to parse form: %v", err)
				}

				if r.Form.Get("To") != "+919999999999" {
					t.Errorf("expected To=+919999999999, got: %s", r.Form.Get("To"))
				}

				if !strings.Contains(r.Form.Get("Body"), "123456") {
					t.Errorf("expected Body to contain 123456, got: %s", r.Form.Get("Body"))
				}

				if r.Form.Get("From") != "+12345" {
					t.Errorf("expected From=+12345, got: %s", r.Form.Get("From"))
				}

				return http.StatusCreated, ""
			},
		},
		{
			name:                 "modica compatibility: json, 202 accepted",
			contentType:          "application/json",
			bodyTemplate:         `{"destination": "${to}", "content": "${body}"}`,
			headers:              nil,
			to:                   "+123456789",
			body:                 "123456",
			expectedErrSubstring: "",
			serverHandler: func(t *testing.T, r *http.Request) (int, string) {
				t.Helper()

				if r.Header.Get("Content-Type") != "application/json" {
					t.Errorf("expected application/json, got: %s", r.Header.Get("Content-Type"))
				}

				body, err := io.ReadAll(r.Body)
				if err != nil {
					t.Fatalf("failed to read body: %v", err)
				}

				expected := `{"destination": "+123456789", "content": "123456"}`
				if !jsonEqual(t, expected, string(body)) {
					t.Errorf("JSON body mismatch.\nExpected: %s\nGot: %s", expected, string(body))
				}

				return http.StatusAccepted, ""
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var serverHit bool

			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				serverHit = true

				if tc.serverHandler == nil {
					t.Error("expected no request to be sent")
					w.WriteHeader(http.StatusOK)

					return
				}

				status, respBody := tc.serverHandler(t, r)
				if status == 0 {
					status = http.StatusOK
				}

				w.WriteHeader(status)

				if respBody != "" {
					_, _ = w.Write([]byte(respBody))
				}
			}))
			defer server.Close()

			provider := sms.NewGenericSMS(
				server.URL, tc.contentType, tc.bodyTemplate, tc.headers, 5*time.Second,
			)

			err := provider.SendSMS(tc.to, tc.body)

			if tc.expectedErrSubstring != "" {
				if err == nil {
					t.Fatalf("expected error containing %q, got nil", tc.expectedErrSubstring)
				}

				if !strings.Contains(err.Error(), tc.expectedErrSubstring) {
					t.Errorf("expected error to contain %q, got: %v", tc.expectedErrSubstring, err)
				}

				return
			}

			if err != nil {
				t.Errorf("expected no error, got: %v", err)
			}

			if tc.serverHandler != nil && !serverHit {
				t.Error("expected request to be sent")
			}
		})
	}
}
