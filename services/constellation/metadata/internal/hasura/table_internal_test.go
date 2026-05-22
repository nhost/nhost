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
	name                    string
	input                   string
	wantForeignKeyColumn    string
	wantForeignKeyTableName string
	wantForeignKeySchema    string
	wantForeignKeyConstrCol string
	wantManualSource        string
	wantErr                 bool
	wantWrapContext         string
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

	if ru.ForeignKeyColumn != tc.wantForeignKeyColumn {
		t.Errorf(
			"ForeignKeyColumn = %q, want %q",
			ru.ForeignKeyColumn,
			tc.wantForeignKeyColumn,
		)
	}

	assertForeignKeyConstraint(t, ru.ForeignKeyConstraint, tc)
	assertManualConfiguration(t, ru.ManualConfiguration, tc.wantManualSource)
}

func assertForeignKeyConstraint(
	t *testing.T,
	got *ForeignKeyConstraint,
	tc relationshipUsingCase,
) {
	t.Helper()

	if tc.wantForeignKeyConstrCol == "" {
		if got != nil {
			t.Errorf("expected nil ForeignKeyConstraint, got %+v", got)
		}

		return
	}

	if got == nil {
		t.Fatalf("expected ForeignKeyConstraint, got nil")
	}

	if got.Column != tc.wantForeignKeyConstrCol {
		t.Errorf(
			"ForeignKeyConstraint.Column = %q, want %q",
			got.Column,
			tc.wantForeignKeyConstrCol,
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
// (column string, constraint mapping, manual_configuration mapping) as well as
// a malformed-input case that surfaces the outer wrap context.
func TestRelationshipUsing_UnmarshalYAML(t *testing.T) {
	t.Parallel()

	tests := []relationshipUsingCase{
		{
			name:                    "string column",
			input:                   "foreign_key_constraint_on: profile_id",
			wantForeignKeyColumn:    "profile_id",
			wantForeignKeyTableName: "",
			wantForeignKeySchema:    "",
			wantForeignKeyConstrCol: "",
			wantManualSource:        "",
			wantErr:                 false,
			wantWrapContext:         "",
		},
		{
			name: "constraint mapping",
			input: "foreign_key_constraint_on:\n" +
				"  column: author_id\n" +
				"  table:\n" +
				"    name: posts\n" +
				"    schema: public",
			wantForeignKeyColumn:    "",
			wantForeignKeyTableName: "posts",
			wantForeignKeySchema:    "public",
			wantForeignKeyConstrCol: "author_id",
			wantManualSource:        "",
			wantErr:                 false,
			wantWrapContext:         "",
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
			wantForeignKeyColumn:    "",
			wantForeignKeyTableName: "",
			wantForeignKeySchema:    "",
			wantForeignKeyConstrCol: "",
			wantManualSource:        "default",
			wantErr:                 false,
			wantWrapContext:         "",
		},
		{
			name: "constraint mapping ignored unknown shape",
			// integer for foreign_key_constraint_on falls through both the
			// string and map[string]any switch arms in UnmarshalYAML, leaving
			// the destination zero-valued without error.
			input:                   "foreign_key_constraint_on: 42",
			wantForeignKeyColumn:    "",
			wantForeignKeyTableName: "",
			wantForeignKeySchema:    "",
			wantForeignKeyConstrCol: "",
			wantManualSource:        "",
			wantErr:                 false,
			wantWrapContext:         "",
		},
		{
			name:                    "malformed yaml not a mapping",
			input:                   "[not a map]",
			wantForeignKeyColumn:    "",
			wantForeignKeyTableName: "",
			wantForeignKeySchema:    "",
			wantForeignKeyConstrCol: "",
			wantManualSource:        "",
			wantErr:                 true,
			wantWrapContext:         "unmarshaling relationship using",
		},
		{
			name:                    "malformed yaml plain string",
			input:                   "just a plain string",
			wantForeignKeyColumn:    "",
			wantForeignKeyTableName: "",
			wantForeignKeySchema:    "",
			wantForeignKeyConstrCol: "",
			wantManualSource:        "",
			wantErr:                 true,
			wantWrapContext:         "unmarshaling relationship using",
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
			name:                    "string column",
			input:                   `{"foreign_key_constraint_on":"profile_id"}`,
			wantForeignKeyColumn:    "profile_id",
			wantForeignKeyTableName: "",
			wantForeignKeySchema:    "",
			wantForeignKeyConstrCol: "",
			wantManualSource:        "",
			wantErr:                 false,
			wantWrapContext:         "",
		},
		{
			name: "constraint object",
			input: `{"foreign_key_constraint_on":{"column":"author_id",` +
				`"table":{"name":"posts","schema":"public"}}}`,
			wantForeignKeyColumn:    "",
			wantForeignKeyTableName: "posts",
			wantForeignKeySchema:    "public",
			wantForeignKeyConstrCol: "author_id",
			wantManualSource:        "",
			wantErr:                 false,
			wantWrapContext:         "",
		},
		{
			name: "manual configuration",
			input: `{"manual_configuration":{"remote_table":{"name":"profiles",` +
				`"schema":"public"},"column_mapping":{"user_id":"id"},` +
				`"source":"default"}}`,
			wantForeignKeyColumn:    "",
			wantForeignKeyTableName: "",
			wantForeignKeySchema:    "",
			wantForeignKeyConstrCol: "",
			wantManualSource:        "default",
			wantErr:                 false,
			wantWrapContext:         "",
		},
		{
			name:                    "empty object",
			input:                   `{}`,
			wantForeignKeyColumn:    "",
			wantForeignKeyTableName: "",
			wantForeignKeySchema:    "",
			wantForeignKeyConstrCol: "",
			wantManualSource:        "",
			wantErr:                 false,
			wantWrapContext:         "",
		},
		{
			name:                    "outer unmarshal failure not an object",
			input:                   `[1,2,3]`,
			wantForeignKeyColumn:    "",
			wantForeignKeyTableName: "",
			wantForeignKeySchema:    "",
			wantForeignKeyConstrCol: "",
			wantManualSource:        "",
			wantErr:                 true,
			wantWrapContext:         "unmarshaling relationship using",
		},
		{
			name:                    "inner constraint failure number value",
			input:                   `{"foreign_key_constraint_on":42}`,
			wantForeignKeyColumn:    "",
			wantForeignKeyTableName: "",
			wantForeignKeySchema:    "",
			wantForeignKeyConstrCol: "",
			wantManualSource:        "",
			wantErr:                 true,
			wantWrapContext:         "unmarshaling foreign key constraint",
		},
		{
			name:                    "inner constraint failure array value",
			input:                   `{"foreign_key_constraint_on":["x"]}`,
			wantForeignKeyColumn:    "",
			wantForeignKeyTableName: "",
			wantForeignKeySchema:    "",
			wantForeignKeyConstrCol: "",
			wantManualSource:        "",
			wantErr:                 true,
			wantWrapContext:         "unmarshaling foreign key constraint",
		},
		{
			name:                    "inner constraint failure wrong field type",
			input:                   `{"foreign_key_constraint_on":{"column":42}}`,
			wantForeignKeyColumn:    "",
			wantForeignKeyTableName: "",
			wantForeignKeySchema:    "",
			wantForeignKeyConstrCol: "",
			wantManualSource:        "",
			wantErr:                 true,
			wantWrapContext:         "unmarshaling foreign key constraint",
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
// table, non-mapping table, and partial table identification.
func TestMapToForeignKeyConstraint(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		input      map[string]any
		wantColumn string
		wantName   string
		wantSchema string
	}{
		{
			name: "all fields present",
			input: map[string]any{
				"column": "author_id",
				"table": map[string]any{
					"name":   "posts",
					"schema": "public",
				},
			},
			wantColumn: "author_id",
			wantName:   "posts",
			wantSchema: "public",
		},
		{
			name:       "empty map yields zero constraint",
			input:      map[string]any{},
			wantColumn: "",
			wantName:   "",
			wantSchema: "",
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
			wantColumn: "",
			wantName:   "posts",
			wantSchema: "public",
		},
		{
			name: "table wrong type drops table",
			input: map[string]any{
				"column": "author_id",
				"table":  "not a map",
			},
			wantColumn: "author_id",
			wantName:   "",
			wantSchema: "",
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
			wantColumn: "author_id",
			wantName:   "",
			wantSchema: "public",
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
			wantColumn: "author_id",
			wantName:   "posts",
			wantSchema: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := mapToForeignKeyConstraint(tt.input)
			if got == nil {
				t.Fatal("expected non-nil constraint, got nil")
			}

			if got.Column != tt.wantColumn {
				t.Errorf("Column = %q, want %q", got.Column, tt.wantColumn)
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
