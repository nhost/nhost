package jsontmpl_test

// End-to-end smoke tests for Scope construction and rendering. Each
// builds a known-shape scope with the generic New + WithVar combinators
// and renders a template that references the Hasura transform variables,
// locking in the engine's variable lookup, indexing, and $query_params
// pair-array handling.

import (
	"encoding/json/jsontext"
	"strings"
	"testing"

	"github.com/nhost/nhost/internal/lib/jsontmpl"
)

func TestActionRequestScope_RendersAllVars(t *testing.T) {
	scope := jsontmpl.New().
		WithVar("$body", map[string]any{"input": map[string]any{"x": 1}}).
		WithVar("$session_variables", map[string]string{"x-hasura-user-id": "abc"}).
		WithVar("$base_url", "https://example.test").
		WithVar("$query_params", [][]any{{"q", "v"}})
	tpl := `{"body":{{ $body }},"vars":{{ $session_variables }},"url":{{ $base_url }},"params":{{ $query_params }}}`
	got, err := jsontmpl.Render(tpl, scope)
	if err != nil {
		t.Fatalf("render: %v", err)
	}
	for _, want := range []string{`"input":{"x":1}`, `"x-hasura-user-id":"abc"`, `"https://example.test"`, `[["q","v"]]`} {
		if !strings.Contains(string(got), want) {
			t.Errorf("missing %q in output: %s", want, got)
		}
	}
}

func TestActionResponseScope_BindsRequestAndStatus(t *testing.T) {
	scope := jsontmpl.New().
		WithVar("$body", map[string]any{"ok": true}).
		WithVar("$request", map[string]any{"method": "POST"}).
		WithVar("$response", map[string]any{"status": 201}).
		WithVar("$session_variables", map[string]string{"x-hasura-user-id": "abc"})
	// Upstream uses $response.status (NOT status_code).
	tpl := `{"status":{{ $response.status }},"ok":{{ $body.ok }},"method":{{ $request.method }},"user":{{ $session_variables["x-hasura-user-id"] }}}`
	got, err := jsontmpl.Render(tpl, scope)
	if err != nil {
		t.Fatalf("render: %v", err)
	}
	for _, want := range []string{`"status":201`, `"ok":true`, `"method":"POST"`, `"user":"abc"`} {
		if !strings.Contains(string(got), want) {
			t.Errorf("missing %q in output: %s", want, got)
		}
	}
}

func TestConnectionTemplateScope_BindsSessionAndDefault(t *testing.T) {
	scope := jsontmpl.New().
		WithVar("$session", map[string]string{"x-hasura-role": "admin"}).
		WithVar("$default", "primary")
	tpl := `{"role":{{ $session["x-hasura-role"] }},"default":{{ $default }}}`
	got, err := jsontmpl.Render(tpl, scope)
	if err != nil {
		t.Fatalf("render: %v", err)
	}
	want := `{"role":"admin","default":"primary"}`
	if string(got) != want {
		t.Fatalf("got %s, want %s", got, want)
	}
}

func TestScope_WithFunc_Overlay(t *testing.T) {
	// Overlay functions should be available alongside the basic map.
	scope := jsontmpl.New().
		WithVar("$body", "hello").
		WithFunc("shout", func(_ jsontext.Value) (jsontext.Value, error) {
			// Naive uppercase for ASCII input strings.
			return jsontext.Value(`"HELLO"`), nil
		})
	got, err := jsontmpl.Render(`{{ shout($body) }}`, scope)
	if err != nil {
		t.Fatalf("render: %v", err)
	}
	if string(got) != `"HELLO"` {
		t.Fatalf("got %s, want \"HELLO\"", got)
	}
}
