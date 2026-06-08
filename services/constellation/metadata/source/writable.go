package source

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	json "encoding/json/v2"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/nhost/nhost/services/constellation/metadata"
	"gopkg.in/yaml.v3"
)

const metadataDirectoryMode = 0o755

var (
	// ErrMetadataWriteUnsupported reports that a metadata source cannot persist
	// metadata writes.
	ErrMetadataWriteUnsupported = errors.New("metadata source is not writable")
	// ErrMetadataWriteConflict reports that the backing metadata catalog changed
	// while a metadata API write was in progress.
	ErrMetadataWriteConflict = errors.New("metadata resource_version changed")
	errMetadataRequired      = errors.New("metadata is required")
)

type metadataExecStore interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// ReplaceMetadata persists the action/custom-type portion of meta to the file
// backing this source. TOML metadata is rewritten as a full native TOML file;
// Hasura directory metadata rewrites actions.yaml and actions.graphql only,
// leaving database and remote-schema files untouched.
func (s *FileMetadataSource) ReplaceMetadata(
	ctx context.Context,
	meta *metadata.Metadata,
) error {
	if meta == nil {
		return errMetadataRequired
	}

	s.writeMu.Lock()
	defer s.writeMu.Unlock()

	select {
	case <-ctx.Done():
		return fmt.Errorf("writing file metadata: %w", ctx.Err())
	default:
	}

	if strings.HasSuffix(filepath.Base(s.path), ".toml") {
		data, err := metadata.MarshalTOML(meta)
		if err != nil {
			return fmt.Errorf("marshaling TOML metadata: %w", err)
		}

		return writeFileAtomic(s.path, data)
	}

	root := metadataDirectoryRoot(s.path)
	if err := os.MkdirAll(root, metadataDirectoryMode); err != nil {
		return fmt.Errorf("creating metadata directory: %w", err)
	}

	actionsYAML, err := marshalActionsYAML(meta)
	if err != nil {
		return err
	}

	if err := writeFileAtomic(filepath.Join(root, "actions.yaml"), actionsYAML); err != nil {
		return fmt.Errorf("writing actions.yaml: %w", err)
	}

	if err := writeFileAtomic(
		filepath.Join(root, "actions.graphql"),
		[]byte(renderActionsSDL(meta)),
	); err != nil {
		return fmt.Errorf("writing actions.graphql: %w", err)
	}

	return nil
}

// ReplaceMetadata persists the action/custom-type portion of meta to
// hdb_catalog.hdb_metadata, preserving all non-action Hasura metadata JSON.
func (s *DatabaseMetadataSource) ReplaceMetadata(
	ctx context.Context,
	meta *metadata.Metadata,
) error {
	if meta == nil {
		return errMetadataRequired
	}

	execStore, ok := s.store.(metadataExecStore)
	if !ok {
		return ErrMetadataWriteUnsupported
	}

	var (
		currentJSON []byte
		version     int64
	)

	if err := s.store.QueryRow(
		ctx,
		"SELECT metadata, resource_version FROM hdb_catalog.hdb_metadata WHERE id = 1",
	).Scan(&currentJSON, &version); err != nil {
		return fmt.Errorf("loading current metadata for write: %w", err)
	}

	var doc map[string]any
	if err := json.Unmarshal(currentJSON, &doc); err != nil {
		return fmt.Errorf("decoding current metadata JSON: %w", err)
	}

	doc["actions"] = meta.Actions
	doc["custom_types"] = meta.CustomTypes

	updatedJSON, err := json.Marshal(doc)
	if err != nil {
		return fmt.Errorf("encoding updated metadata JSON: %w", err)
	}

	newVersion := version + 1

	commandTag, err := execStore.Exec(
		ctx,
		`UPDATE hdb_catalog.hdb_metadata
		SET metadata = $1::jsonb, resource_version = $2
		WHERE id = 1 AND resource_version = $3`,
		updatedJSON,
		newVersion,
		version,
	)
	if err != nil {
		return fmt.Errorf("updating hdb_catalog.hdb_metadata: %w", err)
	}

	if commandTag.RowsAffected() != 1 {
		return ErrMetadataWriteConflict
	}

	s.resourceVersion.Store(newVersion)

	return nil
}

func metadataDirectoryRoot(path string) string {
	if info, err := os.Stat(path); err == nil && info.IsDir() {
		return path
	}

	return filepath.Dir(path)
}

func writeFileAtomic(path string, data []byte) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, metadataDirectoryMode); err != nil {
		return fmt.Errorf("creating parent directory: %w", err)
	}

	tmp, err := os.CreateTemp(dir, "."+filepath.Base(path)+"-*.tmp")
	if err != nil {
		return fmt.Errorf("creating temp file: %w", err)
	}

	tmpName := tmp.Name()
	defer os.Remove(tmpName)

	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()

		return fmt.Errorf("writing temp file: %w", err)
	}

	if err := tmp.Close(); err != nil {
		return fmt.Errorf("closing temp file: %w", err)
	}

	if err := os.Rename(tmpName, path); err != nil {
		return fmt.Errorf("renaming temp file: %w", err)
	}

	return nil
}

func marshalActionsYAML(meta *metadata.Metadata) ([]byte, error) {
	payload := actionsYAML{
		Actions:     make([]actionYAML, 0, len(meta.Actions)),
		CustomTypes: customTypesYAMLFromMetadata(meta.CustomTypes),
	}

	for _, actionMeta := range meta.Actions {
		payload.Actions = append(payload.Actions, actionYAMLFromMetadata(actionMeta))
	}

	data, err := yaml.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshaling actions.yaml: %w", err)
	}

	return data, nil
}

type actionsYAML struct {
	Actions     []actionYAML    `yaml:"actions"`
	CustomTypes customTypesYAML `yaml:"custom_types"`
}

type actionYAML struct {
	Name        string                 `yaml:"name"`
	Definition  actionDefinitionYAML   `yaml:"definition"`
	Permissions []actionPermissionYAML `yaml:"permissions,omitempty"`
	Comment     string                 `yaml:"comment,omitempty"`
}

type actionDefinitionYAML struct {
	Kind                 string             `yaml:"kind,omitempty"`
	Handler              string             `yaml:"handler"`
	ForwardClientHeaders bool               `yaml:"forward_client_headers,omitempty"`
	Headers              []actionHeaderYAML `yaml:"headers,omitempty"`
	Timeout              int                `yaml:"timeout,omitempty"`
	RequestTransform     map[string]any     `yaml:"request_transform,omitempty"`
	ResponseTransform    map[string]any     `yaml:"response_transform,omitempty"`
}

type actionHeaderYAML struct {
	Name         string `yaml:"name"`
	Value        string `yaml:"value,omitempty"`
	ValueFromEnv string `yaml:"value_from_env,omitempty"`
}

type actionPermissionYAML struct {
	Role string `yaml:"role"`
}

type customTypesYAML struct {
	InputObjects []customInputObjectYAML `yaml:"input_objects"`
	Objects      []customObjectYAML      `yaml:"objects"`
	Scalars      []customScalarYAML      `yaml:"scalars"`
	Enums        []customEnumYAML        `yaml:"enums"`
}

type customInputObjectYAML struct {
	Name        string                `yaml:"name"`
	Description string                `yaml:"description,omitempty"`
	Fields      []customTypeFieldYAML `yaml:"fields,omitempty"`
}

type customObjectYAML struct {
	Name          string                         `yaml:"name"`
	Description   string                         `yaml:"description,omitempty"`
	Relationships []customObjectRelationshipYAML `yaml:"relationships,omitempty"`
}

type customScalarYAML struct {
	Name        string `yaml:"name"`
	Description string `yaml:"description,omitempty"`
}

type customEnumYAML struct {
	Name        string                `yaml:"name"`
	Description string                `yaml:"description,omitempty"`
	Values      []customEnumValueYAML `yaml:"values,omitempty"`
}

type customEnumValueYAML struct {
	Value             string `yaml:"value"`
	Description       string `yaml:"description,omitempty"`
	IsDeprecated      bool   `yaml:"is_deprecated,omitempty"`
	DeprecationReason string `yaml:"deprecation_reason,omitempty"`
}

type customTypeFieldYAML struct {
	Name        string `yaml:"name"`
	Type        string `yaml:"type"`
	Description string `yaml:"description,omitempty"`
}

type customObjectRelationshipYAML struct {
	Name         string            `yaml:"name"`
	Type         string            `yaml:"type"`
	Source       string            `yaml:"source,omitempty"`
	RemoteTable  tableSourceYAML   `yaml:"remote_table"`
	FieldMapping map[string]string `yaml:"field_mapping"`
}

type tableSourceYAML struct {
	Schema string `yaml:"schema"`
	Name   string `yaml:"name"`
}

func actionYAMLFromMetadata(actionMeta metadata.ActionMetadata) actionYAML {
	permissions := make([]actionPermissionYAML, 0, len(actionMeta.Permissions))
	for _, permission := range actionMeta.Permissions {
		permissions = append(permissions, actionPermissionYAML{Role: permission.Role})
	}

	headers := make([]actionHeaderYAML, 0, len(actionMeta.Definition.Headers))
	for _, header := range actionMeta.Definition.Headers {
		headers = append(headers, actionHeaderYAML{
			Name:         header.Name,
			Value:        header.Value,
			ValueFromEnv: header.ValueFromEnv,
		})
	}

	return actionYAML{
		Name: actionMeta.Name,
		Definition: actionDefinitionYAML{
			Kind:                 actionMeta.Definition.Kind,
			Handler:              string(actionMeta.Definition.Handler),
			ForwardClientHeaders: actionMeta.Definition.ForwardClientHeaders,
			Headers:              headers,
			Timeout:              actionMeta.Definition.Timeout,
			RequestTransform:     actionMeta.Definition.RequestTransform,
			ResponseTransform:    actionMeta.Definition.ResponseTransform,
		},
		Permissions: permissions,
		Comment:     actionMeta.Comment,
	}
}

func customTypesYAMLFromMetadata(customTypes metadata.CustomTypes) customTypesYAML {
	return customTypesYAML{
		InputObjects: customInputObjectsYAML(customTypes.InputObjects),
		Objects:      customObjectsYAML(customTypes.Objects),
		Scalars:      customScalarsYAML(customTypes.Scalars),
		Enums:        customEnumsYAML(customTypes.Enums),
	}
}

func customInputObjectsYAML(inputs []metadata.CustomInputObjectType) []customInputObjectYAML {
	out := make([]customInputObjectYAML, 0, len(inputs))
	for _, input := range inputs {
		out = append(out, customInputObjectYAML{
			Name:        input.Name,
			Description: input.Description,
			Fields:      customTypeFieldsYAML(input.Fields),
		})
	}

	return out
}

func customObjectsYAML(objects []metadata.CustomObjectType) []customObjectYAML {
	out := make([]customObjectYAML, 0, len(objects))
	for _, object := range objects {
		relationships := make([]customObjectRelationshipYAML, 0, len(object.Relationships))
		for _, rel := range object.Relationships {
			relationships = append(relationships, customObjectRelationshipYAML{
				Name:         rel.Name,
				Type:         rel.Type,
				Source:       rel.Source,
				RemoteTable:  tableSourceYAML{Schema: rel.RemoteTable.Schema, Name: rel.RemoteTable.Name},
				FieldMapping: rel.FieldMapping,
			})
		}

		out = append(out, customObjectYAML{
			Name:          object.Name,
			Description:   object.Description,
			Relationships: relationships,
		})
	}

	return out
}

func customScalarsYAML(scalars []metadata.CustomScalarType) []customScalarYAML {
	out := make([]customScalarYAML, 0, len(scalars))
	for _, scalar := range scalars {
		out = append(out, customScalarYAML{Name: scalar.Name, Description: scalar.Description})
	}

	return out
}

func customEnumsYAML(enums []metadata.CustomEnumType) []customEnumYAML {
	out := make([]customEnumYAML, 0, len(enums))
	for _, enum := range enums {
		values := make([]customEnumValueYAML, 0, len(enum.Values))
		for _, value := range enum.Values {
			values = append(values, customEnumValueYAML{
				Value:             value.Value,
				Description:       value.Description,
				IsDeprecated:      value.IsDeprecated,
				DeprecationReason: value.DeprecationReason,
			})
		}

		out = append(out, customEnumYAML{
			Name:        enum.Name,
			Description: enum.Description,
			Values:      values,
		})
	}

	return out
}

func customTypeFieldsYAML(fields []metadata.CustomTypeField) []customTypeFieldYAML {
	out := make([]customTypeFieldYAML, 0, len(fields))
	for _, field := range fields {
		out = append(out, customTypeFieldYAML{
			Name:        field.Name,
			Type:        field.Type,
			Description: field.Description,
		})
	}

	return out
}

func renderActionsSDL(meta *metadata.Metadata) string {
	var builder strings.Builder

	writeActionRootSDL(&builder, "Query", metadata.ActionOperationQuery, meta.Actions)
	writeActionRootSDL(&builder, "Mutation", metadata.ActionOperationMutation, meta.Actions)
	writeCustomTypesSDL(&builder, meta.CustomTypes)

	return builder.String()
}

func writeActionRootSDL(
	builder *strings.Builder,
	rootName, operation string,
	actions []metadata.ActionMetadata,
) {
	var fields []metadata.ActionMetadata
	for _, actionMeta := range actions {
		if actionMeta.Definition.Type == operation {
			fields = append(fields, actionMeta)
		}
	}

	if len(fields) == 0 {
		return
	}

	fmt.Fprintf(builder, "type %s {\n", rootName)

	for _, actionMeta := range fields {
		fmt.Fprintf(builder, "  %s", actionMeta.Name)

		if len(actionMeta.Definition.Arguments) > 0 {
			builder.WriteString("(")

			for i, arg := range actionMeta.Definition.Arguments {
				if i > 0 {
					builder.WriteString(", ")
				}

				fmt.Fprintf(builder, "%s: %s", arg.Name, arg.Type)
			}

			builder.WriteString(")")
		}

		fmt.Fprintf(builder, ": %s\n", actionMeta.Definition.OutputType)
	}

	builder.WriteString("}\n\n")
}

func writeCustomTypesSDL(builder *strings.Builder, customTypes metadata.CustomTypes) {
	for _, scalar := range customTypes.Scalars {
		fmt.Fprintf(builder, "scalar %s\n\n", scalar.Name)
	}

	for _, enum := range customTypes.Enums {
		fmt.Fprintf(builder, "enum %s {\n", enum.Name)

		for _, value := range enum.Values {
			fmt.Fprintf(builder, "  %s\n", value.Value)
		}

		builder.WriteString("}\n\n")
	}

	for _, input := range customTypes.InputObjects {
		fmt.Fprintf(builder, "input %s {\n", input.Name)

		for _, field := range input.Fields {
			fmt.Fprintf(builder, "  %s: %s\n", field.Name, field.Type)
		}

		builder.WriteString("}\n\n")
	}

	for _, object := range customTypes.Objects {
		fmt.Fprintf(builder, "type %s {\n", object.Name)

		for _, field := range object.Fields {
			fmt.Fprintf(builder, "  %s: %s\n", field.Name, field.Type)
		}

		builder.WriteString("}\n\n")
	}
}
