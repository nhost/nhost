//nolint:exhaustruct
package metadata //nolint:testpackage

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestCustomRootFieldsUnmarshalJSON(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		input    string
		expected CustomRootFields
	}{
		{
			name: "known fields only",
			input: `{` +
				`"select":"s","select_by_pk":"sbp","select_aggregate":"sa",` +
				`"insert":"i","insert_one":"io","update":"u",` +
				`"update_by_pk":"ubp","delete":"d","delete_by_pk":"dbp"` +
				`}`,
			expected: CustomRootFields{
				Select:          "s",
				SelectByPk:      "sbp",
				SelectAggregate: "sa",
				Insert:          "i",
				InsertOne:       "io",
				Update:          "u",
				UpdateByPk:      "ubp",
				Delete:          "d",
				DeleteByPk:      "dbp",
			},
		},
		{
			name: "with additional properties",
			input: `{` +
				`"select":"s","select_by_pk":"sbp","select_aggregate":"sa",` +
				`"insert":"i","insert_one":"io","update":"u",` +
				`"update_by_pk":"ubp","delete":"d","delete_by_pk":"dbp",` +
				`"select_stream":"ss","custom_future_field":{"nested":true}` +
				`}`,
			expected: CustomRootFields{
				Select:          "s",
				SelectByPk:      "sbp",
				SelectAggregate: "sa",
				Insert:          "i",
				InsertOne:       "io",
				Update:          "u",
				UpdateByPk:      "ubp",
				Delete:          "d",
				DeleteByPk:      "dbp",
				AdditionalProperties: map[string]json.RawMessage{
					"select_stream":       json.RawMessage(`"ss"`),
					"custom_future_field": json.RawMessage(`{"nested":true}`),
				},
			},
		},
		{
			name:     "empty object",
			input:    `{}`,
			expected: CustomRootFields{},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var got CustomRootFields
			if err := json.Unmarshal([]byte(tc.input), &got); err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if diff := cmp.Diff(tc.expected, got); diff != "" {
				t.Errorf("unexpected result (-want +got):\n%s", diff)
			}
		})
	}
}

func TestCustomRootFieldsRoundTrip(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name  string
		input CustomRootFields
	}{
		{
			name: "known fields only",
			input: CustomRootFields{
				Select:          "s",
				SelectByPk:      "sbp",
				SelectAggregate: "sa",
				Insert:          "i",
				InsertOne:       "io",
				Update:          "u",
				UpdateByPk:      "ubp",
				Delete:          "d",
				DeleteByPk:      "dbp",
			},
		},
		{
			name: "with additional properties",
			input: CustomRootFields{
				Select:          "s",
				SelectByPk:      "sbp",
				SelectAggregate: "sa",
				Insert:          "i",
				InsertOne:       "io",
				Update:          "u",
				UpdateByPk:      "ubp",
				Delete:          "d",
				DeleteByPk:      "dbp",
				AdditionalProperties: map[string]json.RawMessage{
					"select_stream": json.RawMessage(`"ss"`),
					"future_field":  json.RawMessage(`42`),
				},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			b, err := json.Marshal(tc.input)
			if err != nil {
				t.Fatalf("unexpected marshal error: %v", err)
			}

			var roundTripped CustomRootFields
			if err := json.Unmarshal(b, &roundTripped); err != nil {
				t.Fatalf("unexpected unmarshal error: %v", err)
			}

			if diff := cmp.Diff(tc.input, roundTripped); diff != "" {
				t.Errorf("round-trip mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestConfigurationUnmarshalJSON(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		input    string
		expected Configuration
	}{
		{
			name: "known fields only",
			input: `{` +
				`"custom_name":"cn",` +
				`"custom_root_fields":{"select":"s"},` +
				`"custom_column_names":{"col":"c"}` +
				`}`,
			expected: Configuration{
				CustomName: "cn",
				CustomRootFields: CustomRootFields{
					Select: "s",
				},
				CustomColumnNames: map[string]string{"col": "c"},
			},
		},
		{
			name: "with additional properties at both levels",
			input: `{` +
				`"custom_name":"cn",` +
				`"custom_root_fields":{"select":"s","stream":"st"},` +
				`"custom_column_names":{"col":"c"},` +
				`"column_config":{"id":{"comment":"pk"}},` +
				`"comment":"table comment"` +
				`}`,
			expected: Configuration{
				CustomName: "cn",
				CustomRootFields: CustomRootFields{
					Select: "s",
					AdditionalProperties: map[string]json.RawMessage{
						"stream": json.RawMessage(`"st"`),
					},
				},
				CustomColumnNames: map[string]string{"col": "c"},
				AdditionalProperties: map[string]json.RawMessage{
					"column_config": json.RawMessage(`{"id":{"comment":"pk"}}`),
					"comment":       json.RawMessage(`"table comment"`),
				},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var got Configuration
			if err := json.Unmarshal([]byte(tc.input), &got); err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if diff := cmp.Diff(tc.expected, got); diff != "" {
				t.Errorf("unexpected result (-want +got):\n%s", diff)
			}
		})
	}
}

func TestConfigurationRoundTrip(t *testing.T) {
	t.Parallel()

	input := Configuration{
		CustomName: "cn",
		CustomRootFields: CustomRootFields{
			Select:     "s",
			SelectByPk: "sbp",
			AdditionalProperties: map[string]json.RawMessage{
				"stream": json.RawMessage(`"st"`),
			},
		},
		CustomColumnNames: map[string]string{"col": "c"},
		AdditionalProperties: map[string]json.RawMessage{
			"column_config": json.RawMessage(`{"id":{"comment":"pk"}}`),
		},
	}

	b, err := json.Marshal(input)
	if err != nil {
		t.Fatalf("unexpected marshal error: %v", err)
	}

	var roundTripped Configuration
	if err := json.Unmarshal(b, &roundTripped); err != nil {
		t.Fatalf("unexpected unmarshal error: %v", err)
	}

	if diff := cmp.Diff(input, roundTripped); diff != "" {
		t.Errorf("round-trip mismatch (-want +got):\n%s", diff)
	}
}

func TestConfigurationMarshalPreservesAdditionalProperties(t *testing.T) {
	t.Parallel()

	input := Configuration{
		CustomName: "cn",
		CustomRootFields: CustomRootFields{
			Select: "s",
		},
		CustomColumnNames: map[string]string{"col": "c"},
		AdditionalProperties: map[string]json.RawMessage{
			"column_config": json.RawMessage(`{"id":{"comment":"pk"}}`),
		},
	}

	b, err := json.Marshal(input)
	if err != nil {
		t.Fatalf("unexpected marshal error: %v", err)
	}

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(b, &raw); err != nil {
		t.Fatalf("unexpected unmarshal error: %v", err)
	}

	if _, ok := raw["column_config"]; !ok {
		t.Error("expected column_config in marshaled output")
	}

	if _, ok := raw["custom_name"]; !ok {
		t.Error("expected custom_name in marshaled output")
	}
}

func TestMergeCustomRootFields(t *testing.T) {
	t.Parallel()

	existing := CustomRootFields{
		Select:     "old_select",
		SelectByPk: "old_select_by_pk",
		AdditionalProperties: map[string]json.RawMessage{
			"select_stream": json.RawMessage(`"old_stream"`),
		},
	}

	ours := CustomRootFields{
		Select:          "new_select",
		SelectByPk:      "new_select_by_pk",
		SelectAggregate: "new_agg",
		Insert:          "new_insert",
		InsertOne:       "new_insert_one",
		Update:          "new_update",
		UpdateByPk:      "new_update_by_pk",
		Delete:          "new_delete",
		DeleteByPk:      "new_delete_by_pk",
	}

	merged := mergeCustomRootFields(existing, ours)

	expected := CustomRootFields{
		Select:          "new_select",
		SelectByPk:      "new_select_by_pk",
		SelectAggregate: "new_agg",
		Insert:          "new_insert",
		InsertOne:       "new_insert_one",
		Update:          "new_update",
		UpdateByPk:      "new_update_by_pk",
		Delete:          "new_delete",
		DeleteByPk:      "new_delete_by_pk",
		AdditionalProperties: map[string]json.RawMessage{
			"select_stream": json.RawMessage(`"old_stream"`),
		},
	}

	if diff := cmp.Diff(expected, merged); diff != "" {
		t.Errorf("unexpected merge result (-want +got):\n%s", diff)
	}
}

func TestMergeConfiguration(t *testing.T) {
	t.Parallel()

	existing := Configuration{
		CustomName: "old_name",
		CustomRootFields: CustomRootFields{
			Select: "old_select",
			AdditionalProperties: map[string]json.RawMessage{
				"select_stream": json.RawMessage(`"old_stream"`),
			},
		},
		CustomColumnNames: map[string]string{"old_col": "oc"},
		AdditionalProperties: map[string]json.RawMessage{
			"column_config": json.RawMessage(`{"id":{"comment":"pk"}}`),
			"comment":       json.RawMessage(`"old comment"`),
		},
	}

	ours := Configuration{
		CustomName: "new_name",
		CustomRootFields: CustomRootFields{
			Select:     "new_select",
			SelectByPk: "new_sbp",
		},
		CustomColumnNames: map[string]string{"new_col": "nc"},
	}

	merged := mergeConfiguration(existing, ours)

	expected := Configuration{
		CustomName: "new_name",
		CustomRootFields: CustomRootFields{
			Select:     "new_select",
			SelectByPk: "new_sbp",
			AdditionalProperties: map[string]json.RawMessage{
				"select_stream": json.RawMessage(`"old_stream"`),
			},
		},
		CustomColumnNames: map[string]string{"new_col": "nc"},
		AdditionalProperties: map[string]json.RawMessage{
			"column_config": json.RawMessage(`{"id":{"comment":"pk"}}`),
			"comment":       json.RawMessage(`"old comment"`),
		},
	}

	if diff := cmp.Diff(expected, merged); diff != "" {
		t.Errorf("unexpected merge result (-want +got):\n%s", diff)
	}
}

func TestMergeConfigurationNoExistingExtras(t *testing.T) {
	t.Parallel()

	existing := Configuration{
		CustomName: "old_name",
		CustomRootFields: CustomRootFields{
			Select: "old_select",
		},
		CustomColumnNames: map[string]string{"old_col": "oc"},
	}

	ours := Configuration{
		CustomName: "new_name",
		CustomRootFields: CustomRootFields{
			Select: "new_select",
		},
		CustomColumnNames: map[string]string{"new_col": "nc"},
	}

	merged := mergeConfiguration(existing, ours)

	if len(merged.AdditionalProperties) != 0 {
		t.Errorf(
			"expected no additional properties, got %v",
			merged.AdditionalProperties,
		)
	}

	if len(merged.CustomRootFields.AdditionalProperties) != 0 {
		t.Errorf(
			"expected no root field additional properties, got %v",
			merged.CustomRootFields.AdditionalProperties,
		)
	}

	if merged.CustomName != "new_name" {
		t.Errorf(
			"expected custom_name to be new_name, got %s",
			merged.CustomName,
		)
	}
}

func TestMergeObjectRelationships(t *testing.T) {
	t.Parallel()

	existing := []ObjectRelationshipConfig{
		{
			Name: "user",
			Using: ObjectRelationshipConfigUsing{
				ForeignKeyConstraintOn: "user_id",
			},
		},
		{
			Name: "userDefined",
			Using: ObjectRelationshipConfigUsing{
				ForeignKeyConstraintOn: "custom_col",
			},
		},
	}

	ours := []ObjectRelationshipConfig{
		{
			Name: "user",
			Using: ObjectRelationshipConfigUsing{
				ForeignKeyConstraintOn: "user_id",
			},
		},
		{
			Name: "role",
			Using: ObjectRelationshipConfigUsing{
				ForeignKeyConstraintOn: "role_id",
			},
		},
	}

	merged := mergeObjectRelationships(existing, ours)

	expected := []ObjectRelationshipConfig{
		{
			Name: "user",
			Using: ObjectRelationshipConfigUsing{
				ForeignKeyConstraintOn: "user_id",
			},
		},
		{
			Name: "role",
			Using: ObjectRelationshipConfigUsing{
				ForeignKeyConstraintOn: "role_id",
			},
		},
		{
			Name: "userDefined",
			Using: ObjectRelationshipConfigUsing{
				ForeignKeyConstraintOn: "custom_col",
			},
		},
	}

	if diff := cmp.Diff(expected, merged); diff != "" {
		t.Errorf("unexpected merge result (-want +got):\n%s", diff)
	}
}

func TestMergeObjectRelationshipsNoExisting(t *testing.T) {
	t.Parallel()

	ours := []ObjectRelationshipConfig{
		{
			Name: "user",
			Using: ObjectRelationshipConfigUsing{
				ForeignKeyConstraintOn: "user_id",
			},
		},
	}

	merged := mergeObjectRelationships(nil, ours)

	if diff := cmp.Diff(ours, merged); diff != "" {
		t.Errorf("unexpected merge result (-want +got):\n%s", diff)
	}
}

func TestMergeArrayRelationships(t *testing.T) {
	t.Parallel()

	existing := []ArrayRelationshipConfig{
		{
			Name: "files",
			Using: ArrayRelationshipConfigUsing{
				ForeignKeyConstraintOn: ForeignKeyConstraintOn{
					Table:   Table{Schema: "storage", Name: "files"},
					Columns: []string{"bucket_id"},
				},
			},
		},
		{
			Name: "userDefined",
			Using: ArrayRelationshipConfigUsing{
				ForeignKeyConstraintOn: ForeignKeyConstraintOn{
					Table:   Table{Schema: "public", Name: "custom"},
					Columns: []string{"custom_id"},
				},
			},
		},
	}

	ours := []ArrayRelationshipConfig{
		{
			Name: "files",
			Using: ArrayRelationshipConfigUsing{
				ForeignKeyConstraintOn: ForeignKeyConstraintOn{
					Table:   Table{Schema: "storage", Name: "files"},
					Columns: []string{"bucket_id"},
				},
			},
		},
	}

	merged := mergeArrayRelationships(existing, ours)

	expected := []ArrayRelationshipConfig{
		{
			Name: "files",
			Using: ArrayRelationshipConfigUsing{
				ForeignKeyConstraintOn: ForeignKeyConstraintOn{
					Table:   Table{Schema: "storage", Name: "files"},
					Columns: []string{"bucket_id"},
				},
			},
		},
		{
			Name: "userDefined",
			Using: ArrayRelationshipConfigUsing{
				ForeignKeyConstraintOn: ForeignKeyConstraintOn{
					Table:   Table{Schema: "public", Name: "custom"},
					Columns: []string{"custom_id"},
				},
			},
		},
	}

	if diff := cmp.Diff(expected, merged); diff != "" {
		t.Errorf("unexpected merge result (-want +got):\n%s", diff)
	}
}

func TestMergeArrayRelationshipsNoExisting(t *testing.T) {
	t.Parallel()

	ours := []ArrayRelationshipConfig{
		{
			Name: "files",
			Using: ArrayRelationshipConfigUsing{
				ForeignKeyConstraintOn: ForeignKeyConstraintOn{
					Table:   Table{Schema: "storage", Name: "files"},
					Columns: []string{"bucket_id"},
				},
			},
		},
	}

	merged := mergeArrayRelationships(nil, ours)

	if diff := cmp.Diff(ours, merged); diff != "" {
		t.Errorf("unexpected merge result (-want +got):\n%s", diff)
	}
}

func TestFetchExistingTableMetadata(t *testing.T) { //nolint:cyclop
	t.Parallel()

	configJSON := `{` +
		`"custom_name":"users",` +
		`"custom_root_fields":{"select":"users"},` +
		`"column_config":{"id":{"comment":"pk"}}` +
		`}`

	server := httptest.NewServer(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			body, _ := io.ReadAll(r.Body)
			defer r.Body.Close()

			var req map[string]any

			_ = json.Unmarshal(body, &req)

			if req["type"] != "export_metadata" {
				t.Errorf("unexpected request type: %v", req["type"])
			}

			resp := map[string]any{
				"metadata": map[string]any{
					"sources": []any{
						map[string]any{
							"name": "default",
							"tables": []any{
								map[string]any{
									"table": map[string]string{
										"schema": "auth",
										"name":   "users",
									},
									"configuration": json.RawMessage(configJSON),
									"object_relationships": []any{
										map[string]any{
											"name": "role",
											"using": map[string]any{
												"foreign_key_constraint_on": "default_role",
											},
										},
									},
									"array_relationships": []any{
										map[string]any{
											"name": "userRoles",
											"using": map[string]any{
												"foreign_key_constraint_on": map[string]any{
													"table": map[string]string{
														"schema": "auth",
														"name":   "user_roles",
													},
													"columns": []string{"user_id"},
												},
											},
										},
									},
								},
								map[string]any{
									"table": map[string]string{
										"schema": "auth",
										"name":   "roles",
									},
								},
							},
						},
						map[string]any{
							"name":   "other_source",
							"tables": []any{},
						},
					},
				},
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(resp)
		}),
	)
	t.Cleanup(server.Close)

	cfg := Config{
		URL:         server.URL,
		AdminSecret: "test-secret",
	}

	meta, err := fetchExistingTableMetadata(
		context.Background(), cfg,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(meta) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(meta))
	}

	t.Run("users table with config and relationships", func(t *testing.T) {
		t.Parallel()

		usersMeta, ok := meta["auth.users"]
		if !ok {
			t.Fatal("expected auth.users metadata")
		}

		var config Configuration
		if err := json.Unmarshal(usersMeta.Configuration, &config); err != nil {
			t.Fatalf("unexpected error unmarshaling config: %v", err)
		}

		if config.CustomName != "users" {
			t.Errorf("expected custom_name=users, got %s", config.CustomName)
		}

		if config.AdditionalProperties == nil {
			t.Fatal("expected additional properties to be preserved")
		}

		if _, ok := config.AdditionalProperties["column_config"]; !ok {
			t.Error("expected column_config in additional properties")
		}

		if len(usersMeta.ObjectRelationships) != 1 {
			t.Fatalf(
				"expected 1 object relationship, got %d",
				len(usersMeta.ObjectRelationships),
			)
		}

		if usersMeta.ObjectRelationships[0].Name != "role" {
			t.Errorf(
				"expected object relationship name=role, got %s",
				usersMeta.ObjectRelationships[0].Name,
			)
		}

		if len(usersMeta.ArrayRelationships) != 1 {
			t.Fatalf(
				"expected 1 array relationship, got %d",
				len(usersMeta.ArrayRelationships),
			)
		}

		if usersMeta.ArrayRelationships[0].Name != "userRoles" {
			t.Errorf(
				"expected array relationship name=userRoles, got %s",
				usersMeta.ArrayRelationships[0].Name,
			)
		}
	})

	t.Run("roles table without config or relationships", func(t *testing.T) {
		t.Parallel()

		rolesMeta, ok := meta["auth.roles"]
		if !ok {
			t.Fatal("expected auth.roles metadata")
		}

		if rolesMeta.Configuration != nil {
			t.Error("expected nil configuration for roles")
		}

		if len(rolesMeta.ObjectRelationships) != 0 {
			t.Errorf(
				"expected no object relationships for roles, got %d",
				len(rolesMeta.ObjectRelationships),
			)
		}
	})
}

func TestFetchExistingTableMetadataError(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(
		http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte(`{"error":"internal error"}`))
		}),
	)
	defer server.Close()

	cfg := Config{
		URL:         server.URL,
		AdminSecret: "test-secret",
	}

	_, err := fetchExistingTableMetadata(
		context.Background(), cfg,
	)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestApplyTableCustomizationWithMerge(t *testing.T) {
	t.Parallel()

	var receivedConfig Configuration

	server := httptest.NewServer(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			body, _ := io.ReadAll(r.Body)
			defer r.Body.Close()

			var req struct {
				Type string `json:"type"`
				Args struct {
					Configuration json.RawMessage `json:"configuration"`
				} `json:"args"`
			}

			_ = json.Unmarshal(body, &req)
			_ = json.Unmarshal(req.Args.Configuration, &receivedConfig)

			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"message":"success"}`))
		}),
	)
	defer server.Close()

	logger := slog.Default()

	cfg := Config{
		URL:         server.URL,
		AdminSecret: "test-secret",
	}

	existingConfigJSON := json.RawMessage(`{` +
		`"custom_name":"old_name",` +
		`"custom_root_fields":{"select":"old_s","select_stream":"old_stream"},` +
		`"custom_column_names":{"old_col":"oc"},` +
		`"column_config":{"id":{"comment":"pk"}}` +
		`}`)

	table := TrackTable{
		Type: "pg_track_table",
		Args: PgTrackTableArgs{
			Source: "default",
			Table: Table{
				Schema: "auth",
				Name:   "users",
			},
			Configuration: Configuration{
				CustomName: "new_name",
				CustomRootFields: CustomRootFields{
					Select:     "new_s",
					SelectByPk: "new_sbp",
				},
				CustomColumnNames: map[string]string{"new_col": "nc"},
			},
		},
	}

	err := applyTableCustomization(
		context.Background(),
		cfg,
		table,
		existingConfigJSON,
		logger,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if receivedConfig.CustomName != "new_name" {
		t.Errorf(
			"expected custom_name=new_name, got %s",
			receivedConfig.CustomName,
		)
	}

	if receivedConfig.CustomRootFields.Select != "new_s" {
		t.Errorf(
			"expected select=new_s, got %s",
			receivedConfig.CustomRootFields.Select,
		)
	}

	if receivedConfig.CustomRootFields.SelectByPk != "new_sbp" {
		t.Errorf(
			"expected select_by_pk=new_sbp, got %s",
			receivedConfig.CustomRootFields.SelectByPk,
		)
	}

	if receivedConfig.CustomRootFields.AdditionalProperties == nil {
		t.Fatal(
			"expected root fields additional properties to be preserved",
		)
	}

	if _, ok := receivedConfig.CustomRootFields.AdditionalProperties["select_stream"]; !ok {
		t.Error(
			"expected select_stream in root fields additional properties",
		)
	}

	if receivedConfig.AdditionalProperties == nil {
		t.Fatal(
			"expected configuration additional properties to be preserved",
		)
	}

	if _, ok := receivedConfig.AdditionalProperties["column_config"]; !ok {
		t.Error(
			"expected column_config in configuration additional properties",
		)
	}
}

func TestApplyTableCustomizationWithoutExistingConfig(t *testing.T) {
	t.Parallel()

	var receivedBody []byte

	server := httptest.NewServer(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			receivedBody, _ = io.ReadAll(r.Body)
			defer r.Body.Close()

			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"message":"success"}`))
		}),
	)
	defer server.Close()

	logger := slog.Default()

	cfg := Config{
		URL:         server.URL,
		AdminSecret: "test-secret",
	}

	table := TrackTable{
		Type: "pg_track_table",
		Args: PgTrackTableArgs{
			Source: "default",
			Table: Table{
				Schema: "auth",
				Name:   "users",
			},
			Configuration: Configuration{
				CustomName: "users",
				CustomRootFields: CustomRootFields{
					Select: "users_select",
				},
				CustomColumnNames: map[string]string{"col": "c"},
			},
		},
	}

	err := applyTableCustomization(
		context.Background(),
		cfg,
		table,
		nil,
		logger,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var req struct {
		Args struct {
			Configuration Configuration `json:"configuration"`
		} `json:"args"`
	}

	if err := json.Unmarshal(receivedBody, &req); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if req.Args.Configuration.CustomName != "users" {
		t.Errorf(
			"expected custom_name=users, got %s",
			req.Args.Configuration.CustomName,
		)
	}

	if req.Args.Configuration.AdditionalProperties != nil {
		t.Errorf(
			"expected no additional properties, got %v",
			req.Args.Configuration.AdditionalProperties,
		)
	}
}

func TestFkConstraintColumns(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		input    any
		expected []string
	}{
		{
			name:     "plain string",
			input:    "user_id",
			expected: []string{"user_id"},
		},
		{
			name:     "string slice",
			input:    []string{"col_a", "col_b"},
			expected: []string{"col_a", "col_b"},
		},
		{
			name:     "any slice with all strings",
			input:    []any{"col_a", "col_b"},
			expected: []string{"col_a", "col_b"},
		},
		{
			name:     "any slice with mixed types skips non-strings",
			input:    []any{"col_a", 42, "col_b"},
			expected: []string{"col_a", "col_b"},
		},
		{
			name:     "unexpected type returns empty slice",
			input:    12345,
			expected: []string{},
		},
		{
			name:     "nil returns empty slice",
			input:    nil,
			expected: []string{},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := fkConstraintColumns(tc.input)
			if diff := cmp.Diff(tc.expected, got); diff != "" {
				t.Errorf("unexpected result (-want +got):\n%s", diff)
			}
		})
	}
}

func TestApplyMetadata(t *testing.T) { //nolint:cyclop,gocognit,maintidx
	t.Parallel()

	makeTable := func(schema, name string) TrackTable {
		return TrackTable{
			Type: "pg_track_table",
			Args: PgTrackTableArgs{
				Source: "default",
				Table:  Table{Schema: schema, Name: name},
				Configuration: Configuration{
					CustomName: name + "_custom",
					CustomRootFields: CustomRootFields{
						Select: name + "_select",
					},
					CustomColumnNames: map[string]string{"id": name + "_id"},
				},
				ObjectRelationships: []ObjectRelationshipConfig{
					{
						Name: "parent",
						Using: ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: "parent_id",
						},
					},
				},
				ArrayRelationships: []ArrayRelationshipConfig{
					{
						Name: "children",
						Using: ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: ForeignKeyConstraintOn{
								Table:   Table{Schema: schema, Name: "children"},
								Columns: []string{name + "_id"},
							},
						},
					},
				},
			},
		}
	}

	t.Run("happy path tracks new tables and creates relationships", func(t *testing.T) {
		t.Parallel()

		var requestTypes []string

		server := httptest.NewServer(
			http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				body, _ := io.ReadAll(r.Body)
				defer r.Body.Close()

				var req map[string]any

				_ = json.Unmarshal(body, &req)

				reqType, _ := req["type"].(string)
				requestTypes = append(requestTypes, reqType)

				w.Header().Set("Content-Type", "application/json")

				switch reqType {
				case "export_metadata":
					resp := map[string]any{
						"metadata": map[string]any{
							"sources": []any{
								map[string]any{
									"name":   "default",
									"tables": []any{},
								},
							},
						},
					}
					_ = json.NewEncoder(w).Encode(resp)
				default:
					_, _ = w.Write([]byte(`{"message":"success"}`))
				}
			}),
		)
		t.Cleanup(server.Close)

		cfg := Config{URL: server.URL, AdminSecret: "secret"}
		tables := []TrackTable{makeTable("auth", "users")}

		err := ApplyMetadata(
			context.Background(), cfg, tables, slog.Default(),
		)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		expected := []string{
			"export_metadata",
			"pg_track_table",
			"pg_create_object_relationship",
			"pg_create_array_relationship",
		}
		if diff := cmp.Diff(expected, requestTypes); diff != "" {
			t.Errorf("unexpected request sequence (-want +got):\n%s", diff)
		}
	})

	t.Run("already tracked table applies customization", func(t *testing.T) {
		t.Parallel()

		var customizationReceived bool

		server := httptest.NewServer(
			http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				body, _ := io.ReadAll(r.Body)
				defer r.Body.Close()

				var req map[string]any

				_ = json.Unmarshal(body, &req)

				reqType, _ := req["type"].(string)

				w.Header().Set("Content-Type", "application/json")

				switch reqType {
				case "export_metadata":
					resp := map[string]any{
						"metadata": map[string]any{
							"sources": []any{
								map[string]any{
									"name": "default",
									"tables": []any{
										map[string]any{
											"table": map[string]string{
												"schema": "auth",
												"name":   "users",
											},
											"configuration": map[string]any{
												"custom_name":         "old_users",
												"custom_root_fields":  map[string]any{},
												"custom_column_names": map[string]any{},
											},
											"object_relationships": []any{},
											"array_relationships":  []any{},
										},
									},
								},
							},
						},
					}
					_ = json.NewEncoder(w).Encode(resp)
				case "pg_track_table":
					w.WriteHeader(http.StatusBadRequest)

					resp := hasuraErrResponse{
						Code:  errorCodeAlreadyTracked,
						Error: "already tracked",
					}
					_ = json.NewEncoder(w).Encode(resp)
				case "pg_set_table_customization":
					customizationReceived = true
					_, _ = w.Write([]byte(`{"message":"success"}`))
				default:
					_, _ = w.Write([]byte(`{"message":"success"}`))
				}
			}),
		)
		t.Cleanup(server.Close)

		cfg := Config{URL: server.URL, AdminSecret: "secret"}
		tables := []TrackTable{makeTable("auth", "users")}

		err := ApplyMetadata(
			context.Background(), cfg, tables, slog.Default(),
		)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if !customizationReceived {
			t.Error("expected pg_set_table_customization to be called")
		}
	})

	t.Run("fetchExistingTableMetadata failure degrades gracefully", func(t *testing.T) {
		t.Parallel()

		requestCount := 0

		server := httptest.NewServer(
			http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				body, _ := io.ReadAll(r.Body)
				defer r.Body.Close()

				var req map[string]any

				_ = json.Unmarshal(body, &req)

				reqType, _ := req["type"].(string)
				requestCount++

				w.Header().Set("Content-Type", "application/json")

				switch reqType {
				case "export_metadata":
					w.WriteHeader(http.StatusInternalServerError)
					_, _ = w.Write([]byte(`{"error":"internal error"}`))
				default:
					_, _ = w.Write([]byte(`{"message":"success"}`))
				}
			}),
		)
		t.Cleanup(server.Close)

		cfg := Config{URL: server.URL, AdminSecret: "secret"}
		tables := []TrackTable{makeTable("auth", "users")}

		err := ApplyMetadata(
			context.Background(), cfg, tables, slog.Default(),
		)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		// export_metadata (failed) + pg_track_table + obj rel + arr rel = 4
		if requestCount != 4 {
			t.Errorf("expected 4 requests, got %d", requestCount)
		}
	})

	t.Run("relationship already exists is not an error", func(t *testing.T) {
		t.Parallel()

		server := httptest.NewServer(
			http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				body, _ := io.ReadAll(r.Body)
				defer r.Body.Close()

				var req map[string]any

				_ = json.Unmarshal(body, &req)

				reqType, _ := req["type"].(string)

				w.Header().Set("Content-Type", "application/json")

				switch reqType {
				case "export_metadata":
					resp := map[string]any{
						"metadata": map[string]any{
							"sources": []any{
								map[string]any{
									"name":   "default",
									"tables": []any{},
								},
							},
						},
					}
					_ = json.NewEncoder(w).Encode(resp)
				case "pg_track_table":
					_, _ = w.Write([]byte(`{"message":"success"}`))
				case "pg_create_object_relationship",
					"pg_create_array_relationship":
					w.WriteHeader(http.StatusBadRequest)

					resp := hasuraErrResponse{
						Code:  errorCodeAlreadyExists,
						Error: "already exists",
					}
					_ = json.NewEncoder(w).Encode(resp)
				default:
					_, _ = w.Write([]byte(`{"message":"success"}`))
				}
			}),
		)
		t.Cleanup(server.Close)

		cfg := Config{URL: server.URL, AdminSecret: "secret"}
		tables := []TrackTable{makeTable("auth", "users")}

		err := ApplyMetadata(
			context.Background(), cfg, tables, slog.Default(),
		)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})

	t.Run("track table non-recoverable error is returned", func(t *testing.T) {
		t.Parallel()

		server := httptest.NewServer(
			http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				body, _ := io.ReadAll(r.Body)
				defer r.Body.Close()

				var req map[string]any

				_ = json.Unmarshal(body, &req)

				reqType, _ := req["type"].(string)

				w.Header().Set("Content-Type", "application/json")

				switch reqType {
				case "export_metadata":
					resp := map[string]any{
						"metadata": map[string]any{
							"sources": []any{
								map[string]any{
									"name":   "default",
									"tables": []any{},
								},
							},
						},
					}
					_ = json.NewEncoder(w).Encode(resp)
				case "pg_track_table":
					w.WriteHeader(http.StatusInternalServerError)
					_, _ = w.Write([]byte(
						`{"error":"something went wrong","code":"unexpected"}`,
					))
				default:
					_, _ = w.Write([]byte(`{"message":"success"}`))
				}
			}),
		)
		t.Cleanup(server.Close)

		cfg := Config{URL: server.URL, AdminSecret: "secret"}
		tables := []TrackTable{makeTable("auth", "users")}

		err := ApplyMetadata(
			context.Background(), cfg, tables, slog.Default(),
		)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

func TestApplyTableCustomizationInvalidExistingConfig(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer r.Body.Close()

			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"message":"success"}`))
		}),
	)
	defer server.Close()

	logger := slog.Default()

	cfg := Config{
		URL:         server.URL,
		AdminSecret: "test-secret",
	}

	table := TrackTable{
		Type: "pg_track_table",
		Args: PgTrackTableArgs{
			Source: "default",
			Table: Table{
				Schema: "auth",
				Name:   "users",
			},
			Configuration: Configuration{
				CustomName: "users",
				CustomRootFields: CustomRootFields{
					Select: "s",
				},
				CustomColumnNames: map[string]string{"col": "c"},
			},
		},
	}

	// Invalid JSON should not cause an error - graceful degradation
	err := applyTableCustomization(
		context.Background(),
		cfg,
		table,
		json.RawMessage(`{invalid json`),
		logger,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
