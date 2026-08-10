package hasura_test

import (
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"flag"
	"os"
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/nhost/nhost/services/constellation/metadata"
)

var updateGolden = flag.Bool("update", false, "update golden files") //nolint:gochecknoglobals

func TestFromYAML_Success(t *testing.T) {
	t.Parallel()

	dir := filepath.Join("testdata", "TestFromYAML", "success")

	m, err := metadata.FromDetect(t.Context(), filepath.Join(dir, "metadata.yaml"))
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	goldenPath := filepath.Join(dir, "golden.json")

	if *updateGolden {
		b, err := json.Marshal(
			m,
			jsontext.WithIndent("  "),
			json.FormatNilSliceAsNull(true),
			json.FormatNilMapAsNull(true),
		)
		if err != nil {
			t.Fatalf("failed to marshal metadata to JSON: %v", err)
		}

		if err := os.WriteFile(goldenPath, b, 0o600); err != nil {
			t.Fatalf("failed to write golden file: %v", err)
		}
	}

	got, err := os.ReadFile(goldenPath)
	if err != nil {
		t.Fatalf("failed to read golden file: %v", err)
	}

	var expected metadata.Metadata
	if err := json.Unmarshal(got, &expected); err != nil {
		t.Fatalf("failed to unmarshal golden file: %v", err)
	}

	if diff := cmp.Diff(&expected, m, cmpopts.EquateEmpty()); diff != "" {
		t.Errorf("metadata mismatch (-expected +got):\n%s", diff)
	}
}
