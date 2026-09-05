package transform_test

import (
	json "encoding/json/v2"
	"fmt"
	"net/http"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/connector/action/transform"
)

func TestCompileRequestDropsNullRenderedQueryParamAndFormFieldButKeepsHeader(t *testing.T) {
	t.Parallel()

	const missing = `{{ $session_variables?['x-hasura-missing'] }}`

	requestTransform, err := transform.CompileRequest(map[string]any{
		"version": 2,
		"query_params": map[string]any{
			"present": `{{ getSessionVariable("x-hasura-role") }}`,
			"missing": missing,
		},
		"request_headers": map[string]any{
			"add_headers": map[string]any{"x-missing": missing},
		},
		"body": map[string]any{
			"action": "x_www_form_urlencoded",
			"form_template": map[string]any{
				"present": `{{ $body.input.name }}`,
				"missing": missing,
			},
		},
	})
	if err != nil {
		t.Fatalf("CompileRequest: %v", err)
	}

	request := transform.OutgoingRequest{
		Method: http.MethodPost,
		URL:    "https://api.example.test/actions",
		Header: http.Header{},
		Body:   []byte(`{}`),
	}

	err = requestTransform.Apply(
		transform.RequestContext{
			Body:             map[string]any{"input": map[string]any{"name": "ada"}},
			BaseURL:          "https://api.example.test/actions",
			SessionVariables: map[string]any{"X-Hasura-Role": "user"},
		},
		&request,
	)
	if err != nil {
		t.Fatalf("Apply: %v", err)
	}

	// Query params: the null-rendered "missing" is dropped; "present" remains.
	if want := "present=user"; request.URL != "https://api.example.test/actions?"+want {
		t.Errorf("URL = %s, want query %q only (missing param must be dropped)", request.URL, want)
	}

	// Headers: a null-rendered header is NOT dropped (kept as the literal "null"),
	// matching Hasura's Headers transform.
	if got := request.Header.Get("X-Missing"); got != "null" {
		t.Errorf("X-Missing = %q, want %q (headers are not dropped on null)", got, "null")
	}

	// Form fields: the null-rendered "missing" is dropped; "present" remains.
	if want := "present=ada"; string(request.Body) != want {
		t.Errorf("body = %s, want %q (missing form field must be dropped)", request.Body, want)
	}
}

func TestCompileRequestApplyRequestOptionsHeadersAndFormBody(t *testing.T) {
	t.Parallel()

	requestTransform, err := transform.CompileRequest(map[string]any{
		"version":      2,
		"method":       "PATCH",
		"url":          "{{$base_url}}/profiles/{{escapeUri($body.input.username)}}",
		"content_type": "application/x-www-form-urlencoded",
		"query_params": map[string]any{
			"role": `{{ getSessionVariable("x-hasura-role") }}`,
		},
		"request_headers": map[string]any{
			"remove_headers": []any{"x-remove"},
			"add_headers": map[string]any{
				"x-added": `{{ concat(["hello-", $body.input.username]) }}`,
			},
		},
		"body": map[string]any{
			"action": "x_www_form_urlencoded",
			"form_template": map[string]any{
				"enabled":  "{{ $body.input.enabled }}",
				"username": "{{ $body.input.username }}",
			},
		},
	})
	if err != nil {
		t.Fatalf("CompileRequest: %v", err)
	}

	request := transform.OutgoingRequest{
		Method: http.MethodPost,
		URL:    "https://api.example.test/actions?old=1",
		Header: http.Header{
			"Content-Type": []string{"application/json"},
			"X-Remove":     []string{"gone"},
		},
		Body: []byte(`{"default":true}`),
	}

	err = requestTransform.Apply(
		transform.RequestContext{
			Body: map[string]any{
				"input": map[string]any{
					"username": "ada lovelace",
					"enabled":  true,
				},
			},
			BaseURL: "https://api.example.test/actions",
			SessionVariables: map[string]any{
				"X-Hasura-Role": "user",
			},
		},
		&request,
	)
	if err != nil {
		t.Fatalf("Apply: %v", err)
	}

	if request.Method != http.MethodPatch {
		t.Fatalf("method = %s, want PATCH", request.Method)
	}

	if want := "https://api.example.test/actions/profiles/ada%20lovelace?role=user"; request.URL != want {
		t.Fatalf("URL = %s, want %s", request.URL, want)
	}

	if got := request.Header.Get("Content-Type"); got != "application/x-www-form-urlencoded" {
		t.Fatalf("Content-Type = %q", got)
	}

	if got := request.Header.Get("X-Added"); got != "hello-ada lovelace" {
		t.Fatalf("X-Added = %q", got)
	}

	if got := request.Header.Get("X-Remove"); got != "" {
		t.Fatalf("X-Remove = %q, want removed", got)
	}

	if want := "enabled=true&username=ada+lovelace"; string(request.Body) != want {
		t.Fatalf("body = %s, want %s", request.Body, want)
	}
}

func TestCompileRequestApplyFormBodyDefaultsContentType(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		contentType string
		wantHeader  string
	}{
		{
			name:        "form body action only",
			contentType: "",
			wantHeader:  "application/x-www-form-urlencoded",
		},
		{
			name:        "explicit content type wins",
			contentType: "application/json",
			wantHeader:  "application/json",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			raw := map[string]any{
				"version": 2,
				"body": map[string]any{
					"action": "x_www_form_urlencoded",
					"form_template": map[string]any{
						"name": "{{$body.input.name}}",
					},
				},
			}
			if tt.contentType != "" {
				raw["content_type"] = tt.contentType
			}

			requestTransform, err := transform.CompileRequest(raw)
			if err != nil {
				t.Fatalf("CompileRequest: %v", err)
			}

			request := transform.OutgoingRequest{
				Method: http.MethodPost,
				URL:    "https://api.example.test/actions",
				Header: http.Header{"Content-Type": []string{"application/json"}},
				Body:   []byte(`{"default":true}`),
			}

			err = requestTransform.Apply(
				transform.RequestContext{
					Body: map[string]any{
						"input": map[string]any{"name": "Ada Lovelace"},
					},
					BaseURL:          "https://api.example.test/actions",
					SessionVariables: nil,
				},
				&request,
			)
			if err != nil {
				t.Fatalf("Apply: %v", err)
			}

			if got := request.Header.Get("Content-Type"); got != tt.wantHeader {
				t.Fatalf("Content-Type = %q, want %q", got, tt.wantHeader)
			}

			if want := "name=Ada+Lovelace"; string(request.Body) != want {
				t.Fatalf("body = %s, want %s", request.Body, want)
			}
		})
	}
}

func TestCompileRequestApplyJSONBodyTemplate(t *testing.T) {
	t.Parallel()

	requestTransform, err := transform.CompileRequest(map[string]any{
		"body": `{
			"name": {{$body.input.name}},
			"labels": {{concat([["go"], ["graphql"]])}}
		}`,
	})
	if err != nil {
		t.Fatalf("CompileRequest: %v", err)
	}

	request := transform.OutgoingRequest{
		Method: http.MethodPost,
		URL:    "https://api.example.test/actions",
		Header: http.Header{},
		Body:   []byte(`{}`),
	}

	err = requestTransform.Apply(
		transform.RequestContext{
			Body: map[string]any{
				"input": map[string]any{
					"a":    5,
					"b":    7,
					"name": "Ada",
				},
			},
			BaseURL:          "https://api.example.test/actions",
			SessionVariables: nil,
		},
		&request,
	)
	if err != nil {
		t.Fatalf("Apply: %v", err)
	}

	var got map[string]any
	if err := json.Unmarshal(request.Body, &got); err != nil {
		t.Fatalf("unmarshal body: %v", err)
	}

	want := map[string]any{
		"name":   "Ada",
		"labels": []any{"go", "graphql"},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Fatalf("body mismatch (-want +got):\n%s", diff)
	}
}

func TestCompileResponseApplyStatusSessionAndHeaderTemplate(t *testing.T) {
	t.Parallel()

	responseTransform, err := transform.CompileResponse(map[string]any{
		"version": "2",
		"body": map[string]any{
			"action": "transform",
			"template": `{{ if $response.status == 202 }}
			{
				"name": {{$body.user.name}},
				"password": {{ if $session_variables['x-hasura-role'] == "admin" }}{{$body.user.password}}{{ else }}"<redacted>"{{ end }},
				"trace": {{$response.headers['x-trace-id']}}
			}
			{{ else }}
			{"message": "unexpected"}
			{{ end }}`,
		},
	})
	if err != nil {
		t.Fatalf("CompileResponse: %v", err)
	}

	gotBody, err := responseTransform.Apply(
		transform.ResponseContext{
			BaseURL: "https://api.example.test/actions",
			SessionVariables: map[string]any{
				"x-hasura-role": "user",
			},
			Status: 202,
			Headers: http.Header{
				"X-Trace-Id": []string{"trace-123"},
			},
		},
		[]byte(`{"user":{"name":"Ada","password":"secret"}}`),
	)
	if err != nil {
		t.Fatalf("Apply: %v", err)
	}

	var got map[string]any
	if err := json.Unmarshal(gotBody, &got); err != nil {
		t.Fatalf("unmarshal transformed body: %v", err)
	}

	want := map[string]any{
		"name":     "Ada",
		"password": "<redacted>",
		"trace":    "trace-123",
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Fatalf("body mismatch (-want +got):\n%s", diff)
	}
}

func TestCompileRejectsUnsupportedTransformSurface(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		compile func() error
	}{
		{
			name: "unknown request field",
			compile: func() error {
				_, err := transform.CompileRequest(map[string]any{"unsupported": true})
				if err != nil {
					return fmt.Errorf("compiling request transform: %w", err)
				}

				return nil
			},
		},
		{
			name: "unsupported response body action",
			compile: func() error {
				_, err := transform.CompileResponse(map[string]any{
					"version": 2,
					"body": map[string]any{
						"action": "x_www_form_urlencoded",
					},
				})
				if err != nil {
					return fmt.Errorf("compiling response transform: %w", err)
				}

				return nil
			},
		},
		{
			name: "unsupported template engine",
			compile: func() error {
				_, err := transform.CompileRequest(map[string]any{"template_engine": "GoTemplate"})
				if err != nil {
					return fmt.Errorf("compiling request transform: %w", err)
				}

				return nil
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if err := tt.compile(); err == nil {
				t.Fatal("compile error = nil, want error")
			}
		})
	}
}

// TestRequestQueryParamsBoundAsPairArray pins the Hasura-parity shape of the
// $query_params template variable: a JSON array of [key, value-or-null] pairs
// in URL order (duplicates preserved), matching graphql-engine's
// RequestTransformCtx. A body transform that emits $query_params verbatim must
// produce that array.
func TestRequestQueryParamsBoundAsPairArray(t *testing.T) {
	t.Parallel()

	requestTransform, err := transform.CompileRequest(map[string]any{
		"version": 2,
		"body": map[string]any{
			"action":   "transform",
			"template": `{{ $query_params }}`,
		},
	})
	if err != nil {
		t.Fatalf("CompileRequest: %v", err)
	}

	request := transform.OutgoingRequest{
		Method: http.MethodPost,
		URL:    "https://api.example.test/actions",
		Header: http.Header{},
		Body:   []byte(`{}`),
	}

	if err := requestTransform.Apply(transform.RequestContext{
		Body:    map[string]any{},
		BaseURL: "https://api.example.test/actions?a=1&a=2&flag&empty=",
	}, &request); err != nil {
		t.Fatalf("Apply: %v", err)
	}

	if want := `[["a","1"],["a","2"],["flag",null],["empty",""]]`; string(request.Body) != want {
		t.Errorf("query_params binding = %s, want %s", request.Body, want)
	}
}

// TestRequestQueryParamsFromPairs proves a migrated Hasura template using the
// common {{ fromPairs($query_params) }} idiom works unchanged against the
// pair-array shape (it would fail against an object map).
func TestRequestQueryParamsFromPairs(t *testing.T) {
	t.Parallel()

	requestTransform, err := transform.CompileRequest(map[string]any{
		"version": 2,
		"body": map[string]any{
			"action":   "transform",
			"template": `{{ fromPairs($query_params) }}`,
		},
	})
	if err != nil {
		t.Fatalf("CompileRequest: %v", err)
	}

	request := transform.OutgoingRequest{
		Method: http.MethodPost,
		URL:    "https://api.example.test/actions",
		Header: http.Header{},
		Body:   []byte(`{}`),
	}

	if err := requestTransform.Apply(transform.RequestContext{
		Body:    map[string]any{},
		BaseURL: "https://api.example.test/actions?role=admin&team=eng",
	}, &request); err != nil {
		t.Fatalf("Apply: %v", err)
	}

	if want := `{"role":"admin","team":"eng"}`; string(request.Body) != want {
		t.Errorf("fromPairs($query_params) = %s, want %s", request.Body, want)
	}
}

// TestRawStringQueryParams covers the raw-string form of query_params, where
// the rendered template is written into the URL query verbatim after
// validateRawQuery: it must replace any pre-existing query, reject a '#'
// fragment separator, and reject control characters.
func TestRawStringQueryParams(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		template string
		input    string
		wantURL  string
		wantErr  bool
	}{
		{
			name:     "renders and replaces existing query",
			template: `{{ $body.input.q }}`,
			input:    "k=v",
			wantURL:  "https://api.example.test/actions?k=v",
		},
		{
			name:     "rejects fragment separator",
			template: `{{ $body.input.q }}`,
			input:    "a=1#frag",
			wantErr:  true,
		},
		{
			name:     "rejects control character",
			template: `{{ $body.input.q }}`,
			input:    "a=1\t",
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			requestTransform, err := transform.CompileRequest(map[string]any{
				"version":      2,
				"query_params": tt.template,
			})
			if err != nil {
				t.Fatalf("CompileRequest: %v", err)
			}

			request := transform.OutgoingRequest{
				Method: http.MethodPost,
				URL:    "https://api.example.test/actions?old=1",
				Header: http.Header{},
				Body:   []byte(`{}`),
			}

			err = requestTransform.Apply(transform.RequestContext{
				Body:    map[string]any{"input": map[string]any{"q": tt.input}},
				BaseURL: "https://api.example.test/actions",
			}, &request)

			if tt.wantErr {
				if err == nil {
					t.Fatalf("Apply error = nil, want error for input %q", tt.input)
				}

				return
			}

			if err != nil {
				t.Fatalf("Apply: %v", err)
			}

			if request.URL != tt.wantURL {
				t.Errorf("URL = %s, want %s", request.URL, tt.wantURL)
			}
		})
	}
}
