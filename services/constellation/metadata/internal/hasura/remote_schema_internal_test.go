package hasura

import (
	"context"
	stdjson "encoding/json"
	json "encoding/json/v2"
	"strings"
	"testing"

	"github.com/goccy/go-yaml"
)

// TestRemoteSchemaMetadata_YAMLJSONBridge verifies the wrapper's YAML<->JSON
// bridge: a remote schema decoded from YAML must equal the same document
// decoded from JSON (the generated wire type only carries JSON tags, so YAML
// routes through JSON), and both header shapes — literal `value` and
// `value_from_env` — must survive the union round-trip.
func TestRemoteSchemaMetadata_YAMLJSONBridge(t *testing.T) {
	t.Parallel()

	const yamlDoc = `name: payments
definition:
  url: https://example.com/graphql
  timeout_seconds: 60
  forward_client_headers: true
  headers:
    - name: Authorization
      value: Bearer token123
    - name: X-Api-Key
      value_from_env: REMOTE_API_KEY
`

	const jsonDoc = `{"name":"payments","definition":{` +
		`"url":"https://example.com/graphql","timeout_seconds":60,` +
		`"forward_client_headers":true,"headers":[` +
		`{"name":"Authorization","value":"Bearer token123"},` +
		`{"name":"X-Api-Key","value_from_env":"REMOTE_API_KEY"}]}}`

	var fromYAML RemoteSchemaMetadata
	if err := yaml.UnmarshalContext(context.Background(), []byte(yamlDoc), &fromYAML); err != nil {
		t.Fatalf("yaml decode: %v", err)
	}

	var fromJSON RemoteSchemaMetadata
	if err := json.Unmarshal([]byte(jsonDoc), &fromJSON); err != nil {
		t.Fatalf("json decode: %v", err)
	}

	yb, err := json.Marshal(fromYAML)
	if err != nil {
		t.Fatalf("re-marshal yaml-sourced: %v", err)
	}

	jb, err := json.Marshal(fromJSON)
	if err != nil {
		t.Fatalf("re-marshal json-sourced: %v", err)
	}

	if string(yb) != string(jb) {
		t.Fatalf("YAML and JSON decode paths diverged:\n yaml->json = %s\n json->json = %s", yb, jb)
	}

	// Headers must round-trip with the right arm of the union populated.
	var got struct {
		Definition struct {
			Headers []struct {
				Name         string `json:"name"`
				Value        string `json:"value"`
				ValueFromEnv string `json:"value_from_env"`
			} `json:"headers"`
		} `json:"definition"`
	}

	if err := stdjson.Unmarshal(yb, &got); err != nil {
		t.Fatalf("probe headers: %v", err)
	}

	if len(got.Definition.Headers) != 2 {
		t.Fatalf("headers = %d, want 2", len(got.Definition.Headers))
	}

	if h := got.Definition.Headers[0]; h.Name != "Authorization" || h.Value != "Bearer token123" {
		t.Errorf("literal header = %+v", h)
	}

	if h := got.Definition.Headers[1]; h.Name != "X-Api-Key" || h.ValueFromEnv != "REMOTE_API_KEY" {
		t.Errorf("from-env header = %+v", h)
	}
}

// TestRemoteSchemaMetadata_EmptyHeader verifies that a header carrying neither
// `value` nor `value_from_env` survives the bridge and projects both fields to
// empty (the union stores the raw object regardless of which arm is present).
func TestRemoteSchemaMetadata_EmptyHeader(t *testing.T) {
	t.Parallel()

	const yamlDoc = `name: payments
definition:
  url: https://example.com/graphql
  headers:
    - name: X-Empty
`

	var rs RemoteSchemaMetadata
	if err := yaml.UnmarshalContext(context.Background(), []byte(yamlDoc), &rs); err != nil {
		t.Fatalf("yaml decode: %v", err)
	}

	b, err := json.Marshal(rs)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var got struct {
		Definition struct {
			Headers []struct {
				Name         string `json:"name"`
				Value        string `json:"value"`
				ValueFromEnv string `json:"value_from_env"`
			} `json:"headers"`
		} `json:"definition"`
	}

	if err := stdjson.Unmarshal(b, &got); err != nil {
		t.Fatalf("probe headers: %v", err)
	}

	if len(got.Definition.Headers) != 1 {
		t.Fatalf("headers = %d, want 1", len(got.Definition.Headers))
	}

	if h := got.Definition.Headers[0]; h.Name != "X-Empty" || h.Value != "" || h.ValueFromEnv != "" {
		t.Errorf("empty header = %+v, want only name set", h)
	}
}

// TestRemoteSchemaMetadata_MalformedYAML verifies UnmarshalYAML wraps a decode
// failure: a top-level sequence decodes as generic YAML but cannot unmarshal
// into the object wire type, surfacing the wrapped "decoding remote schema"
// error rather than a panic or silent zero value.
func TestRemoteSchemaMetadata_MalformedYAML(t *testing.T) {
	t.Parallel()

	const yamlDoc = "- not\n- a\n- map\n"

	var rs RemoteSchemaMetadata
	err := yaml.UnmarshalContext(context.Background(), []byte(yamlDoc), &rs)
	if err == nil {
		t.Fatalf("expected error decoding a sequence into a remote schema, got nil")
	}

	if !strings.Contains(err.Error(), "decoding remote schema") {
		t.Errorf("error = %q, want it to wrap %q", err, "decoding remote schema")
	}
}
