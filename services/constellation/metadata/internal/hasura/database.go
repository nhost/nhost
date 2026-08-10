package hasura

import (
	"context"
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"fmt"

	"github.com/goccy/go-yaml"
)

// DatabaseMetadata describes a single tracked database: its connection
// configuration and the tables/functions tracked on it.
type DatabaseMetadata struct {
	Name          string                      `json:"name"                yaml:"name"`
	Kind          string                      `json:"kind"                yaml:"kind"`
	Configuration DatabaseConfiguration       `json:"configuration"       yaml:"configuration"`
	Customization DatabaseSourceCustomization `json:"customization"       yaml:"customization"`
	Tables        []TableMetadata             `json:"tables,omitempty"    yaml:"tables,omitempty"`
	Functions     []FunctionMetadata          `json:"functions,omitempty" yaml:"functions,omitempty"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// UnmarshalYAML implements custom YAML unmarshaling to handle !include directives.
// It uses the context-aware variant so the include base directory can be threaded
// through the decoder without package-level globals.
func (d *DatabaseMetadata) UnmarshalYAML(ctx context.Context, unmarshal func(any) error) error {
	type rawDatabase struct {
		Name          string                      `yaml:"name"`
		Kind          string                      `yaml:"kind"`
		Configuration DatabaseConfiguration       `yaml:"configuration"`
		Customization DatabaseSourceCustomization `yaml:"customization"`
		Tables        any                         `yaml:"tables,omitempty"`
		Functions     any                         `yaml:"functions,omitempty"`
	}

	var raw rawDatabase
	if err := unmarshal(&raw); err != nil {
		return fmt.Errorf("unmarshaling database metadata: %w", err)
	}

	d.Name = raw.Name
	d.Kind = raw.Kind
	d.Configuration = raw.Configuration
	d.Customization = raw.Customization

	if err := resolveIncludeOrInline(ctx, raw.Tables, &d.Tables, "tables"); err != nil {
		return err
	}

	if err := resolveIncludeOrInline(ctx, raw.Functions, &d.Functions, "functions"); err != nil {
		return err
	}

	return nil
}

// resolveIncludeOrInline handles a YAML field that may be either a `!include`
// directive string or inline data. For unknown shapes the destination is left
// unchanged. The context carries the current !include base directory so the
// inline-decode path can resolve nested !include strings the same way the
// top-level decoder does.
func resolveIncludeOrInline[T any](ctx context.Context, raw any, dst *[]T, fieldName string) error {
	switch v := raw.(type) {
	case string:
		if path, ok := parseIncludePath(v); ok {
			if err := loadIncludedFile(ctx, path, dst); err != nil {
				return err
			}
		}

		return nil

	case []any:
		data, err := yaml.Marshal(v)
		if err != nil {
			return fmt.Errorf("marshaling %s data: %w", fieldName, err)
		}

		if err := yaml.UnmarshalContext(ctx, data, dst); err != nil {
			return fmt.Errorf("unmarshaling %s data: %w", fieldName, err)
		}

		return nil
	}

	return nil
}

// DatabaseURL is a Hasura connection URL that can either be a literal string
// (URL) or a reference to an environment variable (FromEnv).
type DatabaseURL struct {
	FromEnv string `json:"from_env,omitempty" yaml:"from_env"`
	URL     string `json:"-"                  yaml:"-"`
}

// UnmarshalYAML accepts either a plain string (`database_url: "postgres://..."`)
// or a mapping (`database_url: { from_env: "VAR_NAME" }`).
func (d *DatabaseURL) UnmarshalYAML(unmarshal func(any) error) error {
	var directURL string
	if err := unmarshal(&directURL); err == nil {
		d.URL = directURL

		return nil
	}

	type rawDatabaseURL struct {
		FromEnv string `yaml:"from_env"`
	}

	var raw rawDatabaseURL
	if err := unmarshal(&raw); err != nil {
		return fmt.Errorf("unmarshaling database URL mapping: %w", err)
	}

	d.FromEnv = raw.FromEnv

	return nil
}

// UnmarshalJSON implements custom JSON unmarshaling to handle both string and mapping formats.
func (d *DatabaseURL) UnmarshalJSON(data []byte) error {
	var directURL string
	if err := json.Unmarshal(data, &directURL); err == nil {
		d.URL = directURL

		return nil
	}

	type rawDatabaseURL struct {
		FromEnv string `json:"from_env"`
	}

	var raw rawDatabaseURL
	if err := json.Unmarshal(data, &raw); err != nil {
		return fmt.Errorf("unmarshaling database URL: %w", err)
	}

	d.FromEnv = raw.FromEnv

	return nil
}

// IsFromEnv returns true if the database URL is configured via environment variable.
func (d *DatabaseURL) IsFromEnv() bool {
	return d.FromEnv != ""
}

// MarshalJSON inverts UnmarshalJSON: emit a bare string when the URL is
// literal, or the {from_env: VAR} mapping when it is environment-backed.
func (d DatabaseURL) MarshalJSON() ([]byte, error) {
	if d.FromEnv != "" {
		b, err := json.Marshal(struct {
			FromEnv string `json:"from_env"`
		}{FromEnv: d.FromEnv})
		if err != nil {
			return nil, fmt.Errorf("marshaling database url from_env: %w", err)
		}

		return b, nil
	}

	b, err := json.Marshal(d.URL)
	if err != nil {
		return nil, fmt.Errorf("marshaling database url: %w", err)
	}

	return b, nil
}

// DatabaseConnectionInfo holds the connection settings for a tracked database.
type DatabaseConnectionInfo struct {
	DatabaseURL DatabaseURL `json:"database_url" yaml:"database_url"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// DatabaseConfiguration wraps the per-database connection block.
type DatabaseConfiguration struct {
	ConnectionInfo DatabaseConnectionInfo `json:"connection_info" yaml:"connection_info"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}
