// Package metadata provides a client for managing Hasura GraphQL Engine metadata.
// It supports tracking tables, configuring custom root fields and column names,
// and creating object/array relationships via the Hasura Metadata API.
package metadata

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"maps"
	"net/http"
	"time"
)

const (
	defaultTimeout          = 10
	defaultDBName           = "default"
	errorCodeAlreadyTracked = "already-tracked"
	errorCodeAlreadyExists  = "already-exists"
)

// Config holds the connection settings for the Hasura Metadata API.
// If Timeout is zero, a 10-second default is used. If DBName is empty, "default" is used.
type Config struct {
	URL         string
	AdminSecret string
	DBName      string
	Timeout     time.Duration
}

func (c Config) timeout() time.Duration {
	if c.Timeout > 0 {
		return c.Timeout
	}

	return defaultTimeout * time.Second
}

func (c Config) dbName() string {
	if c.DBName != "" {
		return c.DBName
	}

	return defaultDBName
}

type hasuraErrResponse struct {
	Path  string `json:"path"`
	Error string `json:"error"`
	Code  string `json:"code"`
}

type apiError struct {
	code string
	msg  string
}

func (e *apiError) Error() string {
	return e.msg
}

func (e *apiError) Code() string {
	return e.code
}

func postMetadata(
	ctx context.Context, cfg Config, data any,
) ([]byte, error) {
	client := &http.Client{ //nolint: exhaustruct
		Timeout: cfg.timeout(),
	}

	b, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("problem marshalling data: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.URL, bytes.NewBuffer(b))
	if err != nil {
		return nil, fmt.Errorf("problem creating request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json; charset=UTF-8")
	req.Header.Set("X-Hasura-Admin-Secret", cfg.AdminSecret)

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("problem executing request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("problem reading response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		var errResponse *hasuraErrResponse

		if err := json.Unmarshal(body, &errResponse); err != nil {
			return nil, fmt.Errorf( //nolint: err113
				"status_code: %d\nresponse: %s",
				resp.StatusCode,
				body,
			)
		}

		if errResponse.Code == errorCodeAlreadyTracked ||
			errResponse.Code == errorCodeAlreadyExists {
			return nil, &apiError{
				code: errResponse.Code,
				msg:  errResponse.Error,
			}
		}

		return nil, fmt.Errorf( //nolint: err113
			"status_code: %d\nresponse: %s", resp.StatusCode, body,
		)
	}

	return body, nil
}

// TrackTable represents a Hasura pg_track_table API request.
type TrackTable struct {
	Type   string           `json:"type"`
	Args   PgTrackTableArgs `json:"args"`
	IsEnum bool             `json:"is_enum,omitempty"` //nolint: tagliatelle
}

// Table identifies a database table by schema and name.
type Table struct {
	Schema string `json:"schema"`
	Name   string `json:"name"`
}

// CustomRootFields maps Hasura root field operations to custom names.
// Unknown fields from the API are preserved in AdditionalProperties for forward compatibility.
type CustomRootFields struct {
	Select          string `json:"select"`
	SelectByPk      string `json:"select_by_pk"`     //nolint: tagliatelle
	SelectAggregate string `json:"select_aggregate"` //nolint: tagliatelle
	Insert          string `json:"insert"`
	InsertOne       string `json:"insert_one"` //nolint: tagliatelle
	Update          string `json:"update"`
	UpdateByPk      string `json:"update_by_pk"` //nolint: tagliatelle
	Delete          string `json:"delete"`
	DeleteByPk      string `json:"delete_by_pk"` //nolint: tagliatelle

	AdditionalProperties map[string]json.RawMessage `json:"-"`
}

//nolint:tagliatelle
type customRootFieldsAlias struct {
	Select          string `json:"select"`
	SelectByPk      string `json:"select_by_pk"`
	SelectAggregate string `json:"select_aggregate"`
	Insert          string `json:"insert"`
	InsertOne       string `json:"insert_one"`
	Update          string `json:"update"`
	UpdateByPk      string `json:"update_by_pk"`
	Delete          string `json:"delete"`
	DeleteByPk      string `json:"delete_by_pk"`
}

var customRootFieldsKnownKeys = map[string]bool{ //nolint:gochecknoglobals
	"select":           true,
	"select_by_pk":     true,
	"select_aggregate": true,
	"insert":           true,
	"insert_one":       true,
	"update":           true,
	"update_by_pk":     true,
	"delete":           true,
	"delete_by_pk":     true,
}

func (c *CustomRootFields) UnmarshalJSON(data []byte) error {
	var alias customRootFieldsAlias
	if err := json.Unmarshal(data, &alias); err != nil {
		return fmt.Errorf("unmarshaling custom root fields: %w", err)
	}

	c.Select = alias.Select
	c.SelectByPk = alias.SelectByPk
	c.SelectAggregate = alias.SelectAggregate
	c.Insert = alias.Insert
	c.InsertOne = alias.InsertOne
	c.Update = alias.Update
	c.UpdateByPk = alias.UpdateByPk
	c.Delete = alias.Delete
	c.DeleteByPk = alias.DeleteByPk

	var allFields map[string]json.RawMessage
	if err := json.Unmarshal(data, &allFields); err != nil {
		return fmt.Errorf("unmarshaling custom root fields into map: %w", err)
	}

	extra := make(map[string]json.RawMessage)
	for k, v := range allFields {
		if !customRootFieldsKnownKeys[k] {
			extra[k] = v
		}
	}

	if len(extra) > 0 {
		c.AdditionalProperties = extra
	}

	return nil
}

func (c CustomRootFields) MarshalJSON() ([]byte, error) {
	alias := customRootFieldsAlias{
		Select:          c.Select,
		SelectByPk:      c.SelectByPk,
		SelectAggregate: c.SelectAggregate,
		Insert:          c.Insert,
		InsertOne:       c.InsertOne,
		Update:          c.Update,
		UpdateByPk:      c.UpdateByPk,
		Delete:          c.Delete,
		DeleteByPk:      c.DeleteByPk,
	}

	b, err := json.Marshal(alias)
	if err != nil {
		return nil, fmt.Errorf("marshaling custom root fields: %w", err)
	}

	if len(c.AdditionalProperties) == 0 {
		return b, nil
	}

	var m map[string]json.RawMessage
	if err := json.Unmarshal(b, &m); err != nil {
		return nil, fmt.Errorf("unmarshaling custom root fields for merge: %w", err)
	}

	maps.Copy(m, c.AdditionalProperties)

	return json.Marshal(m) //nolint:wrapcheck
}

// Configuration holds table customization settings for Hasura.
// Unknown fields from the API are preserved in AdditionalProperties for forward compatibility.
type Configuration struct {
	CustomName        string            `json:"custom_name"`         //nolint: tagliatelle
	CustomRootFields  CustomRootFields  `json:"custom_root_fields"`  //nolint: tagliatelle
	CustomColumnNames map[string]string `json:"custom_column_names"` //nolint: tagliatelle

	AdditionalProperties map[string]json.RawMessage `json:"-"`
}

//nolint:tagliatelle
type configurationAlias struct {
	CustomName        string            `json:"custom_name"`
	CustomRootFields  CustomRootFields  `json:"custom_root_fields"`
	CustomColumnNames map[string]string `json:"custom_column_names"`
}

var configurationKnownKeys = map[string]bool{ //nolint:gochecknoglobals
	"custom_name":         true,
	"custom_root_fields":  true,
	"custom_column_names": true,
}

func (c *Configuration) UnmarshalJSON(data []byte) error {
	var alias configurationAlias
	if err := json.Unmarshal(data, &alias); err != nil {
		return fmt.Errorf("unmarshaling configuration: %w", err)
	}

	c.CustomName = alias.CustomName
	c.CustomRootFields = alias.CustomRootFields
	c.CustomColumnNames = alias.CustomColumnNames

	var allFields map[string]json.RawMessage
	if err := json.Unmarshal(data, &allFields); err != nil {
		return fmt.Errorf("unmarshaling configuration into map: %w", err)
	}

	extra := make(map[string]json.RawMessage)
	for k, v := range allFields {
		if !configurationKnownKeys[k] {
			extra[k] = v
		}
	}

	if len(extra) > 0 {
		c.AdditionalProperties = extra
	}

	return nil
}

func (c Configuration) MarshalJSON() ([]byte, error) {
	alias := configurationAlias{
		CustomName:        c.CustomName,
		CustomRootFields:  c.CustomRootFields,
		CustomColumnNames: c.CustomColumnNames,
	}

	b, err := json.Marshal(alias)
	if err != nil {
		return nil, fmt.Errorf("marshaling configuration: %w", err)
	}

	if len(c.AdditionalProperties) == 0 {
		return b, nil
	}

	var m map[string]json.RawMessage
	if err := json.Unmarshal(b, &m); err != nil {
		return nil, fmt.Errorf("unmarshaling configuration for merge: %w", err)
	}

	maps.Copy(m, c.AdditionalProperties)

	return json.Marshal(m) //nolint:wrapcheck
}

// PgTrackTableArgs contains the arguments for a pg_track_table request.
type PgTrackTableArgs struct {
	Source              string                     `json:"source"`
	Table               Table                      `json:"table"`
	Configuration       Configuration              `json:"configuration"`
	ObjectRelationships []ObjectRelationshipConfig `json:"object_relationships,omitempty"` //nolint: tagliatelle
	ArrayRelationships  []ArrayRelationshipConfig  `json:"array_relationships,omitempty"`  //nolint: tagliatelle
}

// ObjectRelationshipConfig defines an object (many-to-one) relationship on a tracked table.
type ObjectRelationshipConfig struct {
	Name  string                        `json:"name"`
	Using ObjectRelationshipConfigUsing `json:"using"`
}

// ObjectRelationshipConfigUsing specifies how an object relationship is derived.
// ForeignKeyConstraintOn accepts a string (single column) or []string (composite key).
type ObjectRelationshipConfigUsing struct {
	ForeignKeyConstraintOn any `json:"foreign_key_constraint_on"` //nolint: tagliatelle
}

// ArrayRelationshipConfig defines an array (one-to-many) relationship on a tracked table.
type ArrayRelationshipConfig struct {
	Name  string                       `json:"name"`
	Using ArrayRelationshipConfigUsing `json:"using"`
}

// ArrayRelationshipConfigUsing specifies how an array relationship is derived.
type ArrayRelationshipConfigUsing struct {
	ForeignKeyConstraintOn ForeignKeyConstraintOn `json:"foreign_key_constraint_on"` //nolint: tagliatelle
}

type createObjectRelationship struct {
	Type string                       `json:"type"`
	Args createObjectRelationshipArgs `json:"args"`
}

type createObjectRelationshipUsing struct {
	ForeignKeyConstraintOn []string `json:"foreign_key_constraint_on"` //nolint: tagliatelle
}

type createObjectRelationshipArgs struct {
	Table  Table                         `json:"table"`
	Name   string                        `json:"name"`
	Source string                        `json:"source"`
	Using  createObjectRelationshipUsing `json:"using"`
}

type createArrayRelationship struct {
	Type string                      `json:"type"`
	Args createArrayRelationshipArgs `json:"args"`
}

// ForeignKeyConstraintOn identifies the foreign key columns on a remote table for array relationships.
type ForeignKeyConstraintOn struct {
	Table   Table    `json:"table"`
	Columns []string `json:"columns"`
}

type createArrayRelationshipUsing struct {
	ForeignKeyConstraintOn ForeignKeyConstraintOn `json:"foreign_key_constraint_on"` //nolint: tagliatelle
}

type createArrayRelationshipArgs struct {
	Table  Table                        `json:"table"`
	Name   string                       `json:"name"`
	Source string                       `json:"source"`
	Using  createArrayRelationshipUsing `json:"using"`
}

type setTableCustomization struct {
	Type string                    `json:"type"`
	Args setTableCustomizationArgs `json:"args"`
}

type setTableCustomizationArgs struct {
	Source        string        `json:"source"`
	Table         Table         `json:"table"`
	Configuration Configuration `json:"configuration"`
}

type exportMetadataRequest struct {
	Type    string `json:"type"`
	Version int    `json:"version"`
}

type exportMetadataResponse struct {
	Metadata exportMetadataMetadata `json:"metadata"`
}

type exportMetadataMetadata struct {
	Sources []exportMetadataSource `json:"sources"`
}

type exportMetadataSource struct {
	Name   string                `json:"name"`
	Tables []exportMetadataTable `json:"tables"`
}

type exportMetadataTable struct {
	Table               Table                      `json:"table"`
	Configuration       *json.RawMessage           `json:"configuration,omitempty"`
	ObjectRelationships []ObjectRelationshipConfig `json:"object_relationships,omitempty"` //nolint: tagliatelle
	ArrayRelationships  []ArrayRelationshipConfig  `json:"array_relationships,omitempty"`  //nolint: tagliatelle
}

type existingTableMetadata struct {
	Configuration       json.RawMessage
	ObjectRelationships []ObjectRelationshipConfig
	ArrayRelationships  []ArrayRelationshipConfig
}

func fetchExistingTableMetadata(
	ctx context.Context, cfg Config,
) (map[string]existingTableMetadata, error) {
	body, err := postMetadata(
		ctx, cfg,
		exportMetadataRequest{Type: "export_metadata", Version: 2}, //nolint:mnd
	)
	if err != nil {
		return nil, fmt.Errorf("problem fetching metadata: %w", err)
	}

	var resp exportMetadataResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("problem parsing metadata response: %w", err)
	}

	result := make(map[string]existingTableMetadata)

	dbName := cfg.dbName()

	for _, source := range resp.Metadata.Sources {
		if source.Name != dbName {
			continue
		}

		for _, table := range source.Tables {
			key := table.Table.Schema + "." + table.Table.Name

			var config json.RawMessage
			if table.Configuration != nil {
				config = *table.Configuration
			}

			result[key] = existingTableMetadata{
				Configuration:       config,
				ObjectRelationships: table.ObjectRelationships,
				ArrayRelationships:  table.ArrayRelationships,
			}
		}
	}

	return result, nil
}

func mergeCustomRootFields(existing, ours CustomRootFields) CustomRootFields {
	merged := ours

	if len(existing.AdditionalProperties) > 0 {
		merged.AdditionalProperties = make(
			map[string]json.RawMessage,
			len(existing.AdditionalProperties),
		)
		maps.Copy(merged.AdditionalProperties, existing.AdditionalProperties)
	}

	return merged
}

func mergeConfiguration(existing, ours Configuration) Configuration {
	merged := ours
	merged.CustomRootFields = mergeCustomRootFields(
		existing.CustomRootFields,
		ours.CustomRootFields,
	)

	if len(existing.AdditionalProperties) > 0 {
		merged.AdditionalProperties = make(
			map[string]json.RawMessage,
			len(existing.AdditionalProperties),
		)
		maps.Copy(merged.AdditionalProperties, existing.AdditionalProperties)
	}

	return merged
}

func mergeObjectRelationships(
	existing, ours []ObjectRelationshipConfig,
) []ObjectRelationshipConfig {
	merged := make([]ObjectRelationshipConfig, 0, len(ours)+len(existing))
	seen := make(map[string]bool, len(ours))

	for _, r := range ours {
		merged = append(merged, r)
		seen[r.Name] = true
	}

	for _, r := range existing {
		if !seen[r.Name] {
			merged = append(merged, r)
		}
	}

	return merged
}

func mergeArrayRelationships(
	existing, ours []ArrayRelationshipConfig,
) []ArrayRelationshipConfig {
	merged := make([]ArrayRelationshipConfig, 0, len(ours)+len(existing))
	seen := make(map[string]bool, len(ours))

	for _, r := range ours {
		merged = append(merged, r)
		seen[r.Name] = true
	}

	for _, r := range existing {
		if !seen[r.Name] {
			merged = append(merged, r)
		}
	}

	return merged
}

func applyTableCustomization(
	ctx context.Context,
	cfg Config,
	table TrackTable,
	existingConfigJSON json.RawMessage,
	logger *slog.Logger,
) error {
	config := table.Args.Configuration

	if len(existingConfigJSON) > 0 {
		var existing Configuration
		if err := json.Unmarshal(existingConfigJSON, &existing); err != nil {
			logger.WarnContext(
				ctx,
				"failed to parse existing configuration, overwriting",
				slog.String("table", table.Args.Table.Schema+"."+table.Args.Table.Name),
				slog.String("error", err.Error()),
			)
		} else {
			config = mergeConfiguration(existing, config)
		}
	}

	customization := setTableCustomization{
		Type: "pg_set_table_customization",
		Args: setTableCustomizationArgs{
			Source:        table.Args.Source,
			Table:         table.Args.Table,
			Configuration: config,
		},
	}

	_, err := postMetadata(ctx, cfg, customization)

	return err
}

// fkConstraintColumns normalizes a ForeignKeyConstraintOn value (which may be
// a string, []string, or []any from JSON) into a []string of column names.
func fkConstraintColumns(v any) []string {
	switch v := v.(type) {
	case string:
		return []string{v}
	case []string:
		return v
	case []any:
		cols := make([]string, 0, len(v))
		for _, item := range v {
			if s, ok := item.(string); ok {
				cols = append(cols, s)
			}
		}

		return cols
	default:
		return []string{}
	}
}

func applyObjectRelationships(
	ctx context.Context,
	cfg Config,
	table TrackTable,
	existing []ObjectRelationshipConfig,
) error {
	existingNames := make(map[string]bool, len(existing))
	for _, r := range existing {
		existingNames[r.Name] = true
	}

	merged := mergeObjectRelationships(existing, table.Args.ObjectRelationships)

	for _, rel := range merged {
		if existingNames[rel.Name] {
			continue
		}

		relationship := createObjectRelationship{
			Type: "pg_create_object_relationship",
			Args: createObjectRelationshipArgs{
				Source: table.Args.Source,
				Table:  table.Args.Table,
				Name:   rel.Name,
				Using: createObjectRelationshipUsing{
					ForeignKeyConstraintOn: fkConstraintColumns(
						rel.Using.ForeignKeyConstraintOn,
					),
				},
			},
		}

		if _, err := postMetadata(ctx, cfg, relationship); err != nil {
			var metaErr *apiError
			if ok := errors.As(err, &metaErr); ok && metaErr.Code() == errorCodeAlreadyExists {
				continue
			}

			return fmt.Errorf(
				"problem creating object relationship %s for table %s.%s: %w",
				rel.Name,
				table.Args.Table.Schema,
				table.Args.Table.Name,
				err,
			)
		}
	}

	return nil
}

func applyArrayRelationships(
	ctx context.Context,
	cfg Config,
	table TrackTable,
	existing []ArrayRelationshipConfig,
) error {
	existingNames := make(map[string]bool, len(existing))
	for _, r := range existing {
		existingNames[r.Name] = true
	}

	merged := mergeArrayRelationships(existing, table.Args.ArrayRelationships)

	for _, rel := range merged {
		if existingNames[rel.Name] {
			continue
		}

		relationship := createArrayRelationship{
			Type: "pg_create_array_relationship",
			Args: createArrayRelationshipArgs{
				Source: table.Args.Source,
				Table:  table.Args.Table,
				Name:   rel.Name,
				Using: createArrayRelationshipUsing{
					ForeignKeyConstraintOn: rel.Using.ForeignKeyConstraintOn,
				},
			},
		}

		if _, err := postMetadata(ctx, cfg, relationship); err != nil {
			var metaErr *apiError
			if ok := errors.As(err, &metaErr); ok && metaErr.Code() == errorCodeAlreadyExists {
				continue
			}

			return fmt.Errorf(
				"problem creating array relationship %s for table %s.%s: %w",
				rel.Name,
				table.Args.Table.Schema,
				table.Args.Table.Name,
				err,
			)
		}
	}

	return nil
}

// ApplyMetadata tracks the given tables in Hasura and configures their customizations
// and relationships. For already-tracked tables, it merges the desired configuration with
// the existing one, preserving any additional properties set outside this library.
func ApplyMetadata(
	ctx context.Context,
	cfg Config,
	tables []TrackTable,
	logger *slog.Logger,
) error {
	existingMeta, err := fetchExistingTableMetadata(ctx, cfg)
	if err != nil {
		logger.WarnContext(
			ctx,
			"failed to fetch existing hasura metadata, will overwrite configurations",
			slog.String("error", err.Error()),
		)

		existingMeta = make(map[string]existingTableMetadata)
	}

	for _, table := range tables {
		_, err := postMetadata(ctx, cfg, table)
		if err != nil {
			var metaErr *apiError
			if ok := errors.As(err, &metaErr); ok && metaErr.Code() == errorCodeAlreadyTracked {
				tableKey := table.Args.Table.Schema + "." + table.Args.Table.Name

				if err := applyTableCustomization(
					ctx, cfg, table, existingMeta[tableKey].Configuration, logger,
				); err != nil {
					return fmt.Errorf(
						"problem updating customization for table %s.%s: %w",
						table.Args.Table.Schema,
						table.Args.Table.Name,
						err,
					)
				}
			} else {
				return fmt.Errorf(
					"problem adding metadata for table %s.%s: %w",
					table.Args.Table.Schema,
					table.Args.Table.Name,
					err,
				)
			}
		}
	}

	for _, table := range tables {
		tableKey := table.Args.Table.Schema + "." + table.Args.Table.Name
		existing := existingMeta[tableKey]

		if err := applyObjectRelationships(
			ctx, cfg, table, existing.ObjectRelationships,
		); err != nil {
			return err
		}

		if err := applyArrayRelationships(
			ctx, cfg, table, existing.ArrayRelationships,
		); err != nil {
			return err
		}
	}

	return nil
}
