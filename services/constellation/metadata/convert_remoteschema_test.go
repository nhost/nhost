package metadata_test

import (
	json "encoding/json/v2"
	"testing"

	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

// TestConvertRemoteSchema_Exported is black-box coverage for the exported
// metadata.ConvertRemoteSchema wrapper (the metadata mutation store calls it to
// validate a prospective remote schema). The conversion internals are covered
// white-box in convert_internal_test.go; this pins the exported entry point
// against the generated wire type, decoded from JSON the way the store decodes
// add_remote_schema args.
func TestConvertRemoteSchema_Exported(t *testing.T) {
	t.Parallel()

	const wireJSON = `{
		"name": "weather",
		"comment": "forecast service",
		"definition": {
			"url_from_env": "WEATHER_URL",
			"timeout_seconds": 30,
			"forward_client_headers": true,
			"headers": [{"name": "x-api-key", "value_from_env": "WEATHER_KEY"}]
		},
		"permissions": [
			{"role": "user", "definition": {"schema": "type Query { forecast: String }"}}
		]
	}`

	var h hasura.RemoteSchemaMetadata
	if err := json.Unmarshal([]byte(wireJSON), &h); err != nil {
		t.Fatalf("decoding wire fixture: %v", err)
	}

	got := metadata.ConvertRemoteSchema(h)

	if got.Name != "weather" {
		t.Errorf("Name = %q, want weather", got.Name)
	}

	if got.Comment != "forecast service" {
		t.Errorf("Comment = %q, want %q", got.Comment, "forecast service")
	}

	// url_from_env is rendered into the {{...}} envelope.
	if want := metadata.EnvString("{{WEATHER_URL}}"); got.Definition.URL != want {
		t.Errorf("URL = %q, want %q", got.Definition.URL, want)
	}

	if got.Definition.TimeoutSeconds != 30 || !got.Definition.ForwardClientHeaders {
		t.Errorf("definition scalars = %+v", got.Definition)
	}

	if len(got.Definition.Headers) != 1 ||
		got.Definition.Headers[0].Name != "x-api-key" ||
		got.Definition.Headers[0].ValueFromEnv != "WEATHER_KEY" {
		t.Errorf("headers = %+v, want one x-api-key/WEATHER_KEY", got.Definition.Headers)
	}

	if len(got.Permissions) != 1 ||
		got.Permissions[0].Role != "user" ||
		got.Permissions[0].Definition.Schema != "type Query { forecast: String }" {
		t.Errorf("permissions = %+v", got.Permissions)
	}
}
