package hasura

import (
	json "encoding/json/v2"
	"strings"
	"testing"

	"github.com/goccy/go-yaml"
)

// relationshipUsingCase is one input/output expectation pair used by both the
// YAML and JSON test tables for RelationshipUsing.
type relationshipUsingCase struct {
	name                     string
	input                    string
	wantForeignKeyColumns    []string
	wantForeignKeyTableName  string
	wantForeignKeySchema     string
	wantForeignKeyConstrCols []string
	wantManualSource         string
	wantErr                  bool
	wantWrapContext          string
}

func runRelationshipUsingTest(
	t *testing.T,
	tc relationshipUsingCase,
	unmarshal func([]byte, any) error,
) {
	t.Helper()

	var ru RelationshipUsing

	err := unmarshal([]byte(tc.input), &ru)
	if (err != nil) != tc.wantErr {
		t.Fatalf("unmarshal err = %v, wantErr=%v", err, tc.wantErr)
	}

	if tc.wantErr {
		if err != nil && !strings.Contains(err.Error(), tc.wantWrapContext) {
			t.Errorf("expected wrap context %q, got %v", tc.wantWrapContext, err)
		}

		return
	}

	if !equalStringSlices(ru.ForeignKeyColumns, tc.wantForeignKeyColumns) {
		t.Errorf(
			"ForeignKeyColumns = %v, want %v",
			ru.ForeignKeyColumns,
			tc.wantForeignKeyColumns,
		)
	}

	assertForeignKeyConstraint(t, ru.ForeignKeyConstraint, tc)
	assertManualConfiguration(t, ru.ManualConfiguration, tc.wantManualSource)
}

// equalStringSlices treats nil and empty as equal, which matches how the
// unmarshalers leave the slice when the source carries no FK columns.
func equalStringSlices(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}

	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}

	return true
}

func assertForeignKeyConstraint(
	t *testing.T,
	got *ForeignKeyConstraint,
	tc relationshipUsingCase,
) {
	t.Helper()

	if len(tc.wantForeignKeyConstrCols) == 0 {
		if got != nil {
			t.Errorf("expected nil ForeignKeyConstraint, got %+v", got)
		}

		return
	}

	if got == nil {
		t.Fatalf("expected ForeignKeyConstraint, got nil")
	}

	if !equalStringSlices(got.Columns, tc.wantForeignKeyConstrCols) {
		t.Errorf(
			"ForeignKeyConstraint.Columns = %v, want %v",
			got.Columns,
			tc.wantForeignKeyConstrCols,
		)
	}

	if got.Table.Name != tc.wantForeignKeyTableName {
		t.Errorf(
			"ForeignKeyConstraint.Table.Name = %q, want %q",
			got.Table.Name,
			tc.wantForeignKeyTableName,
		)
	}

	if got.Table.Schema != tc.wantForeignKeySchema {
		t.Errorf(
			"ForeignKeyConstraint.Table.Schema = %q, want %q",
			got.Table.Schema,
			tc.wantForeignKeySchema,
		)
	}
}

func assertManualConfiguration(
	t *testing.T,
	got *ManualConfiguration,
	wantSource string,
) {
	t.Helper()

	if wantSource == "" {
		if got != nil {
			t.Errorf("expected nil ManualConfiguration, got %+v", got)
		}

		return
	}

	if got == nil {
		t.Fatalf("expected ManualConfiguration, got nil")
	}

	if got.Source != wantSource {
		t.Errorf(
			"ManualConfiguration.Source = %q, want %q",
			got.Source,
			wantSource,
		)
	}
}

// TestRelationshipUsing_UnmarshalYAML exercises every shape variant
// (column string, list of columns, constraint mapping with column or columns,
// manual_configuration mapping) plus a malformed-input case that surfaces the
// outer wrap context.
func TestRelationshipUsing_UnmarshalYAML(t *testing.T) {
	t.Parallel()

	tests := []relationshipUsingCase{
		{
			name:                     "string column",
			input:                    "foreign_key_constraint_on: profile_id",
			wantForeignKeyColumns:    []string{"profile_id"},
			wantForeignKeyTableName:  "",
			wantForeignKeySchema:     "",
			wantForeignKeyConstrCols: nil,
			wantManualSource:         "",
			wantErr:                  false,
			wantWrapContext:          "",
		},
		{
			name:                     "list of columns",
			input:                    "foreign_key_constraint_on: [exercise_id, kind]",
			wantForeignKeyColumns:    []string{"exercise_id", "kind"},
			wantForeignKeyTableName:  "",
			wantForeignKeySchema:     "",
			wantForeignKeyConstrCols: nil,
			wantManualSource:         "",
			wantErr:                  false,
			wantWrapContext:          "",
		},
		{
			name: "constraint mapping single column",
			input: "foreign_key_constraint_on:\n" +
				"  column: author_id\n" +
				"  table:\n" +
				"    name: posts\n" +
				"    schema: public",
			wantForeignKeyColumns:    nil,
			wantForeignKeyTableName:  "posts",
			wantForeignKeySchema:     "public",
			wantForeignKeyConstrCols: []string{"author_id"},
			wantManualSource:         "",
			wantErr:                  false,
			wantWrapContext:          "",
		},
		{
			name: "constraint mapping composite columns",
			input: "foreign_key_constraint_on:\n" +
				"  columns: [exercise_id, kind]\n" +
				"  table:\n" +
				"    name: workouts\n" +
				"    schema: public",
			wantForeignKeyColumns:    nil,
			wantForeignKeyTableName:  "workouts",
			wantForeignKeySchema:     "public",
			wantForeignKeyConstrCols: []string{"exercise_id", "kind"},
			wantManualSource:         "",
			wantErr:                  false,
			wantWrapContext:          "",
		},
		{
			name: "manual configuration",
			input: "manual_configuration:\n" +
				"  remote_table:\n" +
				"    name: profiles\n" +
				"    schema: public\n" +
				"  column_mapping:\n" +
				"    user_id: id\n" +
				"  source: default",
			wantForeignKeyColumns:    nil,
			wantForeignKeyTableName:  "",
			wantForeignKeySchema:     "",
			wantForeignKeyConstrCols: nil,
			wantManualSource:         "default",
			wantErr:                  false,
			wantWrapContext:          "",
		},
		{
			name: "constraint mapping unknown shape rejected",
			// An integer for foreign_key_constraint_on matches no recognised
			// type arm; the default arm rejects it so the YAML path agrees
			// with the JSON "inner constraint failure number value" case.
			input:                    "foreign_key_constraint_on: 42",
			wantForeignKeyColumns:    nil,
			wantForeignKeyTableName:  "",
			wantForeignKeySchema:     "",
			wantForeignKeyConstrCols: nil,
			wantManualSource:         "",
			wantErr:                  true,
			wantWrapContext:          "expected string, array, or object",
		},
		{
			name: "constraint mapping composite non-string entry rejected",
			// The map-form columns list must reject non-string entries too,
			// so the composite YAML object form agrees with the top-level
			// YAML array form and both JSON paths.
			input: "foreign_key_constraint_on:\n" +
				"  columns: [a, 42, b]\n" +
				"  table:\n" +
				"    name: t\n" +
				"    schema: public",
			wantForeignKeyColumns:    nil,
			wantForeignKeyTableName:  "",
			wantForeignKeySchema:     "",
			wantForeignKeyConstrCols: nil,
			wantManualSource:         "",
			wantErr:                  true,
			wantWrapContext:          "list entry is not a string",
		},
		{
			name: "list with non-string entry rejected",
			// A mixed list must fail loudly so the YAML path matches the
			// JSON path (which fails the same input via []string decode).
			// Silent filtering would mask typos in real-world metadata.
			input:                    "foreign_key_constraint_on: [exercise_id, 42, kind]",
			wantForeignKeyColumns:    nil,
			wantForeignKeyTableName:  "",
			wantForeignKeySchema:     "",
			wantForeignKeyConstrCols: nil,
			wantManualSource:         "",
			wantErr:                  true,
			wantWrapContext:          "list entry is not a string",
		},
		{
			name:                     "malformed yaml not a mapping",
			input:                    "[not a map]",
			wantForeignKeyColumns:    nil,
			wantForeignKeyTableName:  "",
			wantForeignKeySchema:     "",
			wantForeignKeyConstrCols: nil,
			wantManualSource:         "",
			wantErr:                  true,
			wantWrapContext:          "unmarshaling relationship using",
		},
		{
			name:                     "malformed yaml plain string",
			input:                    "just a plain string",
			wantForeignKeyColumns:    nil,
			wantForeignKeyTableName:  "",
			wantForeignKeySchema:     "",
			wantForeignKeyConstrCols: nil,
			wantManualSource:         "",
			wantErr:                  true,
			wantWrapContext:          "unmarshaling relationship using",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			runRelationshipUsingTest(t, tt, yaml.Unmarshal)
		})
	}
}

// TestRelationshipUsing_UnmarshalJSON exercises every shape variant plus the
// two error paths: outer json.Unmarshal failure and inner
// ForeignKeyConstraint unmarshal failure.
func TestRelationshipUsing_UnmarshalJSON(t *testing.T) {
	t.Parallel()

	tests := []relationshipUsingCase{
		{
			name:                     "string column",
			input:                    `{"foreign_key_constraint_on":"profile_id"}`,
			wantForeignKeyColumns:    []string{"profile_id"},
			wantForeignKeyTableName:  "",
			wantForeignKeySchema:     "",
			wantForeignKeyConstrCols: nil,
			wantManualSource:         "",
			wantErr:                  false,
			wantWrapContext:          "",
		},
		{
			name:                     "array of columns",
			input:                    `{"foreign_key_constraint_on":["exercise_id","kind"]}`,
			wantForeignKeyColumns:    []string{"exercise_id", "kind"},
			wantForeignKeyTableName:  "",
			wantForeignKeySchema:     "",
			wantForeignKeyConstrCols: nil,
			wantManualSource:         "",
			wantErr:                  false,
			wantWrapContext:          "",
		},
		{
			name: "constraint object single column",
			input: `{"foreign_key_constraint_on":{"column":"author_id",` +
				`"table":{"name":"posts","schema":"public"}}}`,
			wantForeignKeyColumns:    nil,
			wantForeignKeyTableName:  "posts",
			wantForeignKeySchema:     "public",
			wantForeignKeyConstrCols: []string{"author_id"},
			wantManualSource:         "",
			wantErr:                  false,
			wantWrapContext:          "",
		},
		{
			name: "constraint object composite columns",
			input: `{"foreign_key_constraint_on":{"columns":["a","b"],` +
				`"table":{"name":"t","schema":"public"}}}`,
			wantForeignKeyColumns:    nil,
			wantForeignKeyTableName:  "t",
			wantForeignKeySchema:     "public",
			wantForeignKeyConstrCols: []string{"a", "b"},
			wantManualSource:         "",
			wantErr:                  false,
			wantWrapContext:          "",
		},
		{
			name: "manual configuration",
			input: `{"manual_configuration":{"remote_table":{"name":"profiles",` +
				`"schema":"public"},"column_mapping":{"user_id":"id"},` +
				`"source":"default"}}`,
			wantForeignKeyColumns:    nil,
			wantForeignKeyTableName:  "",
			wantForeignKeySchema:     "",
			wantForeignKeyConstrCols: nil,
			wantManualSource:         "default",
			wantErr:                  false,
			wantWrapContext:          "",
		},
		{
			name:                     "empty object",
			input:                    `{}`,
			wantForeignKeyColumns:    nil,
			wantForeignKeyTableName:  "",
			wantForeignKeySchema:     "",
			wantForeignKeyConstrCols: nil,
			wantManualSource:         "",
			wantErr:                  false,
			wantWrapContext:          "",
		},
		{
			name:                     "outer unmarshal failure not an object",
			input:                    `[1,2,3]`,
			wantForeignKeyColumns:    nil,
			wantForeignKeyTableName:  "",
			wantForeignKeySchema:     "",
			wantForeignKeyConstrCols: nil,
			wantManualSource:         "",
			wantErr:                  true,
			wantWrapContext:          "unmarshaling relationship using",
		},
		{
			name:                     "inner constraint failure number value",
			input:                    `{"foreign_key_constraint_on":42}`,
			wantForeignKeyColumns:    nil,
			wantForeignKeyTableName:  "",
			wantForeignKeySchema:     "",
			wantForeignKeyConstrCols: nil,
			wantManualSource:         "",
			wantErr:                  true,
			wantWrapContext:          "unmarshaling foreign key constraint",
		},
		{
			name:                     "inner constraint failure wrong field type",
			input:                    `{"foreign_key_constraint_on":{"columns":[42]}}`,
			wantForeignKeyColumns:    nil,
			wantForeignKeyTableName:  "",
			wantForeignKeySchema:     "",
			wantForeignKeyConstrCols: nil,
			wantManualSource:         "",
			wantErr:                  true,
			wantWrapContext:          "unmarshaling foreign key constraint",
		},
		{
			name: "explicit null rejected",
			// Explicit null is treated as malformed input (the default arm
			// in UnmarshalJSON wraps the sentinel error). An omitted field
			// is still a no-op; this case pins down the difference between
			// "not present" and "present but null".
			input:                    `{"foreign_key_constraint_on":null}`,
			wantForeignKeyColumns:    nil,
			wantForeignKeyTableName:  "",
			wantForeignKeySchema:     "",
			wantForeignKeyConstrCols: nil,
			wantManualSource:         "",
			wantErr:                  true,
			wantWrapContext:          "unmarshaling foreign key constraint",
		},
		{
			name: "list with non-string entry rejected",
			// The strict []string decode rejects the same input the YAML
			// path now rejects in its array arm, so both serialisation
			// formats agree on what counts as malformed metadata.
			input:                    `{"foreign_key_constraint_on":["exercise_id",42,"kind"]}`,
			wantForeignKeyColumns:    nil,
			wantForeignKeyTableName:  "",
			wantForeignKeySchema:     "",
			wantForeignKeyConstrCols: nil,
			wantManualSource:         "",
			wantErr:                  true,
			wantWrapContext:          "unmarshaling foreign key constraint",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			runRelationshipUsingTest(t, tt, func(data []byte, v any) error {
				return json.Unmarshal(data, v)
			})
		})
	}
}

// TestMapToForeignKeyConstraint covers the type-assertion fallthroughs in
// mapToForeignKeyConstraint: missing column, non-string column, missing
// table, non-mapping table, and partial table identification. The single
// "column" key is promoted to a one-element Columns slice; the plural
// "columns" key is taken verbatim and wins when both are present.
func TestMapToForeignKeyConstraint(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name            string
		input           map[string]any
		wantColumns     []string
		wantName        string
		wantSchema      string
		wantErr         bool
		wantWrapContext string
	}{
		{
			name: "single column promoted to slice",
			input: map[string]any{
				"column": "author_id",
				"table": map[string]any{
					"name":   "posts",
					"schema": "public",
				},
			},
			wantColumns:     []string{"author_id"},
			wantName:        "posts",
			wantSchema:      "public",
			wantErr:         false,
			wantWrapContext: "",
		},
		{
			name: "composite columns",
			input: map[string]any{
				"columns": []any{"a", "b"},
				"table": map[string]any{
					"name":   "t",
					"schema": "public",
				},
			},
			wantColumns:     []string{"a", "b"},
			wantName:        "t",
			wantSchema:      "public",
			wantErr:         false,
			wantWrapContext: "",
		},
		{
			name: "columns key wins over column key",
			input: map[string]any{
				"columns": []any{"a"},
				"column":  "ignored",
				"table": map[string]any{
					"name":   "t",
					"schema": "public",
				},
			},
			wantColumns:     []string{"a"},
			wantName:        "t",
			wantSchema:      "public",
			wantErr:         false,
			wantWrapContext: "",
		},
		{
			name:            "empty map yields zero constraint",
			input:           map[string]any{},
			wantColumns:     nil,
			wantName:        "",
			wantSchema:      "",
			wantErr:         false,
			wantWrapContext: "",
		},
		{
			name: "column wrong type drops column",
			input: map[string]any{
				"column": 42,
				"table": map[string]any{
					"name":   "posts",
					"schema": "public",
				},
			},
			wantColumns:     nil,
			wantName:        "posts",
			wantSchema:      "public",
			wantErr:         false,
			wantWrapContext: "",
		},
		{
			name: "non-string list entry rejected",
			// Silent filtering of non-string entries would mask typos in
			// real-world metadata. The error wrap matches the top-level
			// YAML array form and the JSON []string decode.
			input: map[string]any{
				"columns": []any{"a", 42, "b"},
				"table": map[string]any{
					"name":   "t",
					"schema": "public",
				},
			},
			wantColumns:     nil,
			wantName:        "",
			wantSchema:      "",
			wantErr:         true,
			wantWrapContext: "list entry is not a string",
		},
		{
			name: "table wrong type drops table",
			input: map[string]any{
				"column": "author_id",
				"table":  "not a map",
			},
			wantColumns:     []string{"author_id"},
			wantName:        "",
			wantSchema:      "",
			wantErr:         false,
			wantWrapContext: "",
		},
		{
			name: "table name wrong type drops name only",
			input: map[string]any{
				"column": "author_id",
				"table": map[string]any{
					"name":   42,
					"schema": "public",
				},
			},
			wantColumns:     []string{"author_id"},
			wantName:        "",
			wantSchema:      "public",
			wantErr:         false,
			wantWrapContext: "",
		},
		{
			name: "table schema wrong type drops schema only",
			input: map[string]any{
				"column": "author_id",
				"table": map[string]any{
					"name":   "posts",
					"schema": false,
				},
			},
			wantColumns:     []string{"author_id"},
			wantName:        "posts",
			wantSchema:      "",
			wantErr:         false,
			wantWrapContext: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := mapToForeignKeyConstraint(tt.input)
			if (err != nil) != tt.wantErr {
				t.Fatalf("mapToForeignKeyConstraint err = %v, wantErr=%v", err, tt.wantErr)
			}

			if tt.wantErr {
				if err != nil && !strings.Contains(err.Error(), tt.wantWrapContext) {
					t.Errorf("expected wrap context %q, got %v", tt.wantWrapContext, err)
				}

				return
			}

			if got == nil {
				t.Fatal("expected non-nil constraint, got nil")
			}

			if !equalStringSlices(got.Columns, tt.wantColumns) {
				t.Errorf("Columns = %v, want %v", got.Columns, tt.wantColumns)
			}

			if got.Table.Name != tt.wantName {
				t.Errorf("Table.Name = %q, want %q", got.Table.Name, tt.wantName)
			}

			if got.Table.Schema != tt.wantSchema {
				t.Errorf(
					"Table.Schema = %q, want %q",
					got.Table.Schema,
					tt.wantSchema,
				)
			}
		})
	}
}
