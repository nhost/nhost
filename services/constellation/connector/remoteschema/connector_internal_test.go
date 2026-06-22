package remoteschema

import (
	"errors"
	"os"
	"testing"

	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestBuildHeadersLiteralAndEnv(t *testing.T) {
	t.Setenv("REMOTE_HEADER", "resolved")

	meta := &metadata.RemoteSchemaMetadata{
		Name: "payments",
		Definition: metadata.RemoteSchemaDefinition{
			Headers: []metadata.RemoteSchemaHeader{
				{Name: "x-literal", Value: "{{REMOTE_HEADER}}"},
				{Name: "x-env", ValueFromEnv: "REMOTE_HEADER"},
			},
		},
	}

	headers, err := buildHeaders(meta)
	if err != nil {
		t.Fatalf("buildHeaders failed: %v", err)
	}

	if got, want := headers["x-literal"], "{{REMOTE_HEADER}}"; got != want {
		t.Errorf("literal header = %q, want %q", got, want)
	}

	if got, want := headers["x-env"], "resolved"; got != want {
		t.Errorf("env header = %q, want %q", got, want)
	}
}

func TestBuildHeadersMissingEnv(t *testing.T) {
	t.Parallel()

	const missingEnv = "NHOST_TEST_MISSING_REMOTE_SCHEMA_HEADER_2B1B9F50F6F14D40"
	if value, ok := os.LookupEnv(missingEnv); ok {
		t.Skipf("%s is unexpectedly set to %q", missingEnv, value)
	}

	meta := &metadata.RemoteSchemaMetadata{
		Name: "payments",
		Definition: metadata.RemoteSchemaDefinition{
			Headers: []metadata.RemoteSchemaHeader{
				{Name: "x-env", ValueFromEnv: missingEnv},
			},
		},
	}

	_, err := buildHeaders(meta)
	if !errors.Is(err, metadata.ErrUnresolvedEnvVars) {
		t.Fatalf("buildHeaders error = %v, want ErrUnresolvedEnvVars", err)
	}
}
