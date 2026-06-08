package metadata_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestHasuraActionsYAMLAndJSONEquivalent(t *testing.T) {
	t.Parallel()

	fixtureDir := filepath.Join("..", "integration", "actionfixtures", "default")
	yamlPath := writeActionFixtureMetadata(t, fixtureDir, true)

	fromYAML, err := metadata.FromDetect(t.Context(), yamlPath)
	if err != nil {
		t.Fatalf("FromDetect: %v", err)
	}

	jsonData, err := os.ReadFile(filepath.Join(fixtureDir, "metadata.json"))
	if err != nil {
		t.Fatalf("reading metadata.json: %v", err)
	}

	fromJSON, err := metadata.FromHasuraJSON(jsonData)
	if err != nil {
		t.Fatalf("FromHasuraJSON: %v", err)
	}

	if diff := cmp.Diff(fromJSON, fromYAML, cmpopts.EquateEmpty()); diff != "" {
		t.Errorf("YAML+SDL and DB JSON metadata differ (-json +yaml):\n%s", diff)
	}
}

func TestHasuraActionsYAMLAndJSONEquivalentPreservesListOutputModifiers(t *testing.T) {
	t.Parallel()

	yamlPath := writeInlineActionMetadata(
		t,
		`
	actions:
	  - name: listReports
	    definition:
	      kind: synchronous
	      handler: '{{NHOST_FUNCTIONS_URL}}/actions'
	custom_types:
	  enums: []
	  input_objects: []
	  objects: []
	  scalars: []
	`,
		`
	type Query {
	  listReports(limit: Int!): [ReportOutput!]!
	}

	type ReportOutput {
	  id: ID!
	}
	`,
	)

	fromYAML, err := metadata.FromDetect(t.Context(), yamlPath)
	if err != nil {
		t.Fatalf("FromDetect: %v", err)
	}

	fromJSON, err := metadata.FromHasuraJSON([]byte(`{
		"version": 3,
		"sources": [],
		"remote_schemas": [],
		"actions": [{
			"name": "listReports",
			"definition": {
				"kind": "synchronous",
				"handler": "{{NHOST_FUNCTIONS_URL}}/actions",
				"type": "query",
				"arguments": [{"name": "limit", "type": "Int!"}],
				"output_type": "[ReportOutput!]!"
			}
		}],
		"custom_types": {
			"objects": [{
				"name": "ReportOutput",
				"fields": [{"name": "id", "type": "ID!"}]
			}]
		}
	}`))
	if err != nil {
		t.Fatalf("FromHasuraJSON: %v", err)
	}

	if diff := cmp.Diff(fromJSON, fromYAML, cmpopts.EquateEmpty()); diff != "" {
		t.Errorf("YAML+SDL and DB JSON list-output metadata differ (-json +yaml):\n%s", diff)
	}

	got := fromYAML.Actions[0].Definition.OutputType
	if got != "[ReportOutput!]!" {
		t.Fatalf("YAML+SDL output_type = %q, want [ReportOutput!]!", got)
	}
}

func TestHasuraActionsYAMLRequiresSDLForSignatures(t *testing.T) {
	t.Parallel()

	fixtureDir := filepath.Join("..", "integration", "actionfixtures", "default")
	yamlPath := writeActionFixtureMetadata(t, fixtureDir, false)

	m, err := metadata.FromDetect(t.Context(), yamlPath)
	if err != nil {
		t.Fatalf("FromDetect: %v", err)
	}

	if len(m.Actions) != 0 {
		t.Fatalf("Actions = %+v, want none after missing SDL diagnostic", m.Actions)
	}

	if !m.CustomTypes.IsZero() {
		t.Fatalf("CustomTypes = %+v, want zero after missing SDL diagnostic", m.CustomTypes)
	}

	assertSingleLoadDiagnostic(
		t,
		m,
		metadata.InconsistencyKindAction,
		"actions.graphql",
		"actions.graphql is required",
	)
}

func TestFromHasuraJSON_ActionDiagnosticsAreRecoverable(t *testing.T) {
	t.Parallel()

	input := []byte(`{
		"version": 3,
		"sources": [],
		"remote_schemas": [],
		"actions": {"not": "a list"},
		"custom_types": {
			"objects": [{"name": "Output", "fields": [{"name": "ok", "type": "String"}]}]
		}
	}`)

	m, err := metadata.FromHasuraJSON(input)
	if err != nil {
		t.Fatalf("FromHasuraJSON: %v", err)
	}

	if len(m.Actions) != 0 {
		t.Fatalf("Actions = %+v, want none after malformed action section", m.Actions)
	}

	if got := len(m.CustomTypes.Objects); got != 1 {
		t.Fatalf("custom type objects = %d, want 1", got)
	}

	assertSingleLoadDiagnostic(
		t,
		m,
		metadata.InconsistencyKindAction,
		"actions",
		"failed to unmarshal metadata JSON actions",
	)
}

func TestFromHasuraJSON_CustomTypeDiagnosticsAreRecoverable(t *testing.T) {
	t.Parallel()

	input := []byte(`{
		"version": 3,
		"sources": [],
		"remote_schemas": [],
		"actions": [{
			"name": "ping",
			"definition": {
				"kind": "synchronous",
				"handler": "{{NHOST_FUNCTIONS_URL}}/actions",
				"type": "query",
				"arguments": [],
				"output_type": "String"
			}
		}],
		"custom_types": []
	}`)

	m, err := metadata.FromHasuraJSON(input)
	if err != nil {
		t.Fatalf("FromHasuraJSON: %v", err)
	}

	if got := len(m.Actions); got != 1 {
		t.Fatalf("Actions = %d, want 1", got)
	}

	if !m.CustomTypes.IsZero() {
		t.Fatalf("CustomTypes = %+v, want zero after malformed custom_types", m.CustomTypes)
	}

	assertSingleLoadDiagnostic(
		t,
		m,
		metadata.InconsistencyKindCustomType,
		"custom_types",
		"failed to unmarshal metadata JSON custom_types",
	)
}

func writeActionFixtureMetadata(t *testing.T, fixtureDir string, includeSDL bool) string {
	t.Helper()

	actionsYAML := readFixtureString(t, fixtureDir, "actions.yaml")

	actionsGraphQL := ""
	if includeSDL {
		actionsGraphQL = readFixtureString(t, fixtureDir, "actions.graphql")
	}

	return writeActionMetadataFiles(t, actionsYAML, actionsGraphQL, includeSDL)
}

func writeInlineActionMetadata(t *testing.T, actionsYAML, actionsGraphQL string) string {
	t.Helper()

	return writeActionMetadataFiles(
		t,
		normalizeInlineFixture(actionsYAML),
		normalizeInlineFixture(actionsGraphQL),
		true,
	)
}

func writeActionMetadataFiles(
	t *testing.T,
	actionsYAML string,
	actionsGraphQL string,
	includeSDL bool,
) string {
	t.Helper()

	dir := t.TempDir()

	dbDir := filepath.Join(dir, "databases")
	if err := os.MkdirAll(dbDir, 0o700); err != nil {
		t.Fatalf("mkdir databases: %v", err)
	}

	files := map[string]string{
		filepath.Join(dir, "metadata.yaml"):    "",
		filepath.Join(dbDir, "databases.yaml"): "[]\n",
		filepath.Join(dir, "actions.yaml"):     actionsYAML,
	}

	if includeSDL {
		files[filepath.Join(dir, "actions.graphql")] = actionsGraphQL
	}

	for path, content := range files {
		if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
			t.Fatalf("writing %s: %v", path, err)
		}
	}

	return filepath.Join(dir, "metadata.yaml")
}

func normalizeInlineFixture(content string) string {
	content = strings.Trim(content, "\n")

	lines := strings.Split(content, "\n")
	for i, line := range lines {
		lines[i] = strings.TrimPrefix(line, "\t")
	}

	return strings.TrimSpace(strings.Join(lines, "\n")) + "\n"
}

func readFixtureString(t *testing.T, fixtureDir, name string) string {
	t.Helper()

	data, err := os.ReadFile(filepath.Join(fixtureDir, name))
	if err != nil {
		t.Fatalf("reading %s: %v", name, err)
	}

	return string(data)
}

func assertSingleLoadDiagnostic(
	t *testing.T,
	m *metadata.Metadata,
	wantKind, wantName, wantReasonSubstr string,
) {
	t.Helper()

	if len(m.LoadDiagnostics) != 1 {
		t.Fatalf("LoadDiagnostics = %+v, want one entry", m.LoadDiagnostics)
	}

	got := m.LoadDiagnostics[0]
	if got.Kind != wantKind {
		t.Errorf("Kind = %q, want %q", got.Kind, wantKind)
	}

	if got.Name != wantName {
		t.Errorf("Name = %q, want %q", got.Name, wantName)
	}

	if !strings.Contains(got.Reason, wantReasonSubstr) {
		t.Errorf("Reason = %q, want substring %q", got.Reason, wantReasonSubstr)
	}
}
