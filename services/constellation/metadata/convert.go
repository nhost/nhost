package metadata

import (
	"context"
	stdjson "encoding/json"
	"fmt"
	"maps"
	"math"
	"os"
	"path/filepath"
	"strings"

	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

// columnRenamer maps a SQL column name to its GraphQL name, falling back to the
// SQL name when no custom rename is configured.
type columnRenamer func(sqlName string) string

func tableColumnRenamer(cfg map[string]ColumnConfig) columnRenamer {
	return func(sqlName string) string {
		if c, ok := cfg[sqlName]; ok && c.CustomName != "" {
			return c.CustomName
		}

		return sqlName
	}
}

// FromDetect loads metadata by detecting the format from the path.
//
// If path ends in ".toml" it is read as a single TOML file at that exact
// location. Otherwise it is interpreted as a locator for the Hasura v3
// directory layout — filepath.Dir(path) becomes the root and the loader reads
// "<root>/databases/databases.yaml" and the optional
// "<root>/remote_schemas.yaml". The Hasura branch never opens path itself, so
// callers can either point at the directory (with a trailing separator) or at
// a sentinel file inside it such as "<dir>/metadata.yaml". See FromYAML in
// metadata/internal/hasura for the full convention.
func FromDetect(ctx context.Context, path string) (*Metadata, error) {
	if strings.HasSuffix(filepath.Base(path), ".toml") {
		data, err := os.ReadFile(path)
		if err != nil {
			return nil, fmt.Errorf("reading TOML metadata file %s: %w", path, err)
		}

		return unmarshalTOML(data)
	}

	return fromHasuraYAML(ctx, path)
}

// FromHasuraJSON parses a Hasura v3 metadata JSON blob and converts it to the native format.
func FromHasuraJSON(data []byte) (*Metadata, error) {
	h, err := hasura.FromJSON(data)
	if err != nil {
		return nil, fmt.Errorf("parsing hasura JSON metadata: %w", err)
	}

	return fromHasura(h), nil
}

// FromDetectWithHasura mirrors FromDetect but also returns the *hasura.Metadata
// wire form when the path resolves to a Hasura YAML directory layout. For TOML
// paths the wire form is nil — the engine has no Hasura-shaped source to
// serialize and `export_metadata` will return an empty envelope.
func FromDetectWithHasura(
	ctx context.Context, path string,
) (*Metadata, *hasura.Metadata, error) {
	if strings.HasSuffix(filepath.Base(path), ".toml") {
		data, err := os.ReadFile(path)
		if err != nil {
			return nil, nil, fmt.Errorf("reading TOML metadata file %s: %w", path, err)
		}

		m, err := unmarshalTOML(data)
		if err != nil {
			return nil, nil, err
		}

		return m, nil, nil
	}

	h, err := hasura.FromYAML(ctx, path)
	if err != nil {
		return nil, nil, fmt.Errorf("loading hasura metadata: %w", err)
	}

	return fromHasura(h), h, nil
}

// MarshalHasura serializes the wire-level Hasura metadata back into the v3
// JSON envelope. It is the inverse of [hasura.FromJSON]'s parse step (with
// the native conversion stripped). The engine intentionally holds a
// *hasura.Metadata alongside the native *Metadata so that fields the engine
// does not model (actions, cron triggers, event triggers, etc.) survive the
// round-trip required by /v1/metadata's `export_metadata` operation. The
// reverse projection *Metadata → *hasura.Metadata is intentionally not
// implemented: the native form is lossy (it drops the unmodeled top-level
// keys above), so it could never reconstruct a faithful wire blob. Keeping the
// *hasura.Metadata as the source of truth for export sidesteps that entirely.
func MarshalHasura(h *hasura.Metadata) ([]byte, error) {
	data, err := hasura.ToJSON(h)
	if err != nil {
		return nil, fmt.Errorf("marshaling hasura JSON metadata: %w", err)
	}

	return data, nil
}

// fromHasuraYAML loads Hasura v3 metadata from the directory layout rooted at
// filepath.Dir(metadataPath) and converts it to the native format. metadataPath
// is a locator for the metadata directory only — the file it names is never
// read. See hasura.FromYAML for the full layout contract.
func fromHasuraYAML(ctx context.Context, metadataPath string) (*Metadata, error) {
	h, err := hasura.FromYAML(ctx, metadataPath)
	if err != nil {
		return nil, fmt.Errorf("loading hasura metadata: %w", err)
	}

	return fromHasura(h), nil
}

func fromHasura(h *hasura.Metadata) *Metadata {
	databases := make([]DatabaseMetadata, len(h.Databases))
	for i, db := range h.Databases {
		databases[i] = convertDatabase(db)
	}

	remoteSchemas := make([]RemoteSchemaMetadata, len(h.RemoteSchemas))
	for i, rs := range h.RemoteSchemas {
		remoteSchemas[i] = convertRemoteSchema(rs)
	}

	return &Metadata{
		Databases:     databases,
		RemoteSchemas: remoteSchemas,
	}
}

func convertDatabaseURL(h hasura.DatabaseURL) EnvString {
	if h.IsFromEnv() {
		return EnvString("{{" + h.FromEnv + "}}")
	}

	return EnvString(h.URL)
}

func convertHeaderValue(h hasura.EnvValue) (string, string) {
	if h.FromEnv != "" {
		return "", h.FromEnv
	}

	return h.Value, ""
}

func convertDatabase(h hasura.DatabaseMetadata) DatabaseMetadata {
	tables := make([]TableMetadata, len(h.Tables))
	for i, t := range h.Tables {
		tables[i] = convertTable(t)
	}

	functions := make([]FunctionMetadata, len(h.Functions))
	for i, f := range h.Functions {
		functions[i] = convertFunction(f)
	}

	return DatabaseMetadata{
		Name: h.Name,
		Kind: h.Kind,
		Configuration: DatabaseConfiguration{
			ConnectionInfo: DatabaseConnectionInfo{
				DatabaseURL: convertDatabaseURL(h.Configuration.ConnectionInfo.DatabaseURL),
			},
		},
		Customization: convertDatabaseCustomization(h.Customization),
		Tables:        tables,
		Functions:     functions,
	}
}

// convertDatabaseCustomization normalizes a Hasura database source's
// customization (root_fields + type_names) into the shared Customization
// shape. Databases use no type-name mapping or per-field renames.
func convertDatabaseCustomization(h hasura.DatabaseSourceCustomization) Customization {
	return Customization{
		RootFieldsNamespace: h.RootFields.Namespace,
		RootFieldsPrefix:    h.RootFields.Prefix,
		RootFieldsSuffix:    h.RootFields.Suffix,
		TypeNamesPrefix:     h.TypeNames.Prefix,
		TypeNamesSuffix:     h.TypeNames.Suffix,
		TypeNamesMapping:    nil,
		FieldNames:          nil,
	}
}

func convertTable(h hasura.TableMetadata) TableMetadata {
	t := TableMetadata{
		Table:               convertTableSource(h.Table),
		IsEnum:              h.IsEnum,
		Configuration:       convertTableConfiguration(h.Configuration),
		ObjectRelationships: convertObjectRelationships(h.ObjectRelationships),
		ArrayRelationships:  convertArrayRelationships(h.ArrayRelationships),
		RemoteRelationships: convertRemoteRelationships(h.RemoteRelationships),
		SelectPermissions:   convertSelectPermissions(h.SelectPermissions),
		InsertPermissions:   convertInsertPermissions(h.InsertPermissions),
		UpdatePermissions:   convertUpdatePermissions(h.UpdatePermissions),
		DeletePermissions:   convertDeletePermissions(h.DeletePermissions),
	}

	rename := tableColumnRenamer(t.Configuration.ColumnConfig)
	for i := range t.ObjectRelationships {
		applyRemoteSchemaColumnRenames(&t.ObjectRelationships[i].Using, rename)
	}

	for i := range t.ArrayRelationships {
		applyRemoteSchemaColumnRenames(&t.ArrayRelationships[i].Using, rename)
	}

	return t
}

// applyRemoteSchemaColumnRenames rewrites a remote-schema ManualConfiguration so
// that ColumnMapping keys/values and `$sql_column` references in remote field
// path arguments use the configured GraphQL column names. Downstream code reads
// result rows keyed by GraphQL name, so this rename is what makes phantom-field
// injection line up.
func applyRemoteSchemaColumnRenames(using *RelationshipUsing, rename columnRenamer) {
	if using == nil || using.ManualConfiguration == nil {
		return
	}

	mc := using.ManualConfiguration
	if mc.RemoteSchema == "" {
		return
	}

	if len(mc.ColumnMapping) > 0 {
		renamed := make(map[string]string, len(mc.ColumnMapping))
		for k, v := range mc.ColumnMapping {
			renamed[rename(k)] = rename(v)
		}

		mc.ColumnMapping = renamed
	}

	for j := range mc.RemoteFieldPath {
		args := mc.RemoteFieldPath[j].Arguments
		for argName, argValue := range args {
			sqlName, ok := strings.CutPrefix(argValue, "$")
			if !ok {
				continue
			}

			if newName := rename(sqlName); newName != sqlName {
				args[argName] = "$" + newName
			}
		}
	}
}

func convertObjectRelationships(rels []hasura.ObjectRelationship) []ObjectRelationship {
	result := make([]ObjectRelationship, len(rels))
	for i, rel := range rels {
		result[i] = ObjectRelationship{
			Name:  rel.Name,
			Using: convertRelationshipUsing(rel.Using),
		}
	}

	return result
}

func convertArrayRelationships(rels []hasura.ArrayRelationship) []ArrayRelationship {
	result := make([]ArrayRelationship, len(rels))
	for i, rel := range rels {
		result[i] = ArrayRelationship{
			Name:  rel.Name,
			Using: convertRelationshipUsing(rel.Using),
		}
	}

	return result
}

func convertRemoteRelationships(rels []hasura.RemoteRelationship) []RemoteRelationship {
	result := make([]RemoteRelationship, len(rels))
	for i, rel := range rels {
		result[i] = convertRemoteRelationship(rel)
	}

	return result
}

func convertSelectPermissions(perms []hasura.SelectPermission) []SelectPermission {
	result := make([]SelectPermission, len(perms))
	for i, p := range perms {
		result[i] = SelectPermission{
			Role: p.Role,
			Permission: SelectPermissionConfig{
				Columns:           p.Permission.Columns,
				Filter:            normalizePermissionMap(p.Permission.Filter),
				AllowAggregations: p.Permission.AllowAggregations,
			},
		}
	}

	return result
}

func convertInsertPermissions(perms []hasura.InsertPermission) []InsertPermission {
	result := make([]InsertPermission, len(perms))
	for i, p := range perms {
		result[i] = InsertPermission{
			Role: p.Role,
			Permission: InsertPermissionConfig{
				Columns: p.Permission.Columns,
				Check:   normalizePermissionMap(p.Permission.Check),
				Set:     normalizePermissionMap(p.Permission.Set),
			},
		}
	}

	return result
}

func convertUpdatePermissions(perms []hasura.UpdatePermission) []UpdatePermission {
	result := make([]UpdatePermission, len(perms))
	for i, p := range perms {
		result[i] = UpdatePermission{
			Role: p.Role,
			Permission: UpdatePermissionConfig{
				Columns: p.Permission.Columns,
				Filter:  normalizePermissionMap(p.Permission.Filter),
				Check:   normalizePermissionMap(p.Permission.Check),
				Set:     normalizePermissionMap(p.Permission.Set),
			},
		}
	}

	return result
}

func convertDeletePermissions(perms []hasura.DeletePermission) []DeletePermission {
	result := make([]DeletePermission, len(perms))
	for i, p := range perms {
		result[i] = DeletePermission{
			Role: p.Role,
			Permission: DeletePermissionConfig{
				Filter: normalizePermissionMap(p.Permission.Filter),
			},
		}
	}

	return result
}

func normalizePermissionMap[M ~map[string]any](m M) map[string]any {
	if m == nil {
		return nil
	}

	normalized, _ := normalizePermissionValue(map[string]any(m)).(map[string]any)

	return normalized
}

func normalizePermissionValue(v any) any {
	switch value := v.(type) {
	case map[string]any:
		out := make(map[string]any, len(value))
		for k, child := range value {
			out[k] = normalizePermissionValue(child)
		}

		return out
	case []any:
		out := make([]any, len(value))
		for i, child := range value {
			out[i] = normalizePermissionValue(child)
		}

		return out
	case stdjson.Number:
		return normalizeJSONNumber(value)
	case float64:
		return normalizeFloat(value)
	case float32:
		return normalizeFloat(float64(value))
	case int, int8, int16, int32, int64:
		return normalizeSigned(value)
	case uint, uint8, uint16, uint32, uint64:
		return normalizeUnsigned(value)
	default:
		return value
	}
}

func normalizeSigned(v any) int64 {
	switch value := v.(type) {
	case int:
		return int64(value)
	case int8:
		return int64(value)
	case int16:
		return int64(value)
	case int32:
		return int64(value)
	case int64:
		return value
	default:
		return 0
	}
}

func normalizeUnsigned(v any) any {
	switch value := v.(type) {
	case uint:
		return normalizeUint(uint64(value))
	case uint8:
		return int64(value)
	case uint16:
		return int64(value)
	case uint32:
		return int64(value)
	case uint64:
		return normalizeUint(value)
	default:
		return v
	}
}

func normalizeJSONNumber(n stdjson.Number) any {
	if i, err := n.Int64(); err == nil {
		return i
	}

	f, err := n.Float64()
	if err != nil {
		return n
	}

	return normalizeFloat(f)
}

func normalizeFloat(f float64) any {
	if math.IsNaN(f) || math.IsInf(f, 0) || math.Trunc(f) != f {
		return f
	}

	if f < float64(math.MinInt64) || f >= float64(math.MaxInt64) {
		return f
	}

	return int64(f)
}

func normalizeUint(u uint64) any {
	if u > math.MaxInt64 {
		return u
	}

	return int64(u)
}

func convertTableSource(h hasura.TableSource) TableSource {
	return TableSource{Name: h.Name, Schema: h.Schema}
}

func convertTableConfiguration(h hasura.TableConfiguration) TableConfiguration {
	var columnConfig map[string]ColumnConfig
	if len(h.ColumnConfig) > 0 {
		columnConfig = make(map[string]ColumnConfig, len(h.ColumnConfig))
		for k, v := range h.ColumnConfig {
			columnConfig[k] = ColumnConfig{CustomName: v.CustomName}
		}
	}

	return TableConfiguration{
		ColumnConfig: columnConfig,
		CustomName:   h.CustomName,
		CustomRootFields: CustomRootFields{
			Delete:          h.CustomRootFields.Delete,
			DeleteByPk:      h.CustomRootFields.DeleteByPk,
			Insert:          h.CustomRootFields.Insert,
			InsertOne:       h.CustomRootFields.InsertOne,
			Select:          h.CustomRootFields.Select,
			SelectAggregate: h.CustomRootFields.SelectAggregate,
			SelectByPk:      h.CustomRootFields.SelectByPk,
			SelectStream:    h.CustomRootFields.SelectStream,
			Update:          h.CustomRootFields.Update,
			UpdateByPk:      h.CustomRootFields.UpdateByPk,
			UpdateMany:      h.CustomRootFields.UpdateMany,
		},
	}
}

func convertRelationshipUsing(h hasura.RelationshipUsing) RelationshipUsing {
	var fk *ForeignKeyConstraint
	if h.ForeignKeyConstraint != nil {
		fk = &ForeignKeyConstraint{
			Columns: append([]string(nil), h.ForeignKeyConstraint.Columns...),
			Table:   convertTableSource(h.ForeignKeyConstraint.Table),
		}
	}

	var manual *ManualConfiguration
	if h.ManualConfiguration != nil {
		remoteField := convertRemoteFieldCalls(h.ManualConfiguration.RemoteField)

		manual = &ManualConfiguration{
			RemoteTable:     convertTableSource(h.ManualConfiguration.RemoteTable),
			ColumnMapping:   h.ManualConfiguration.ColumnMapping,
			Source:          h.ManualConfiguration.Source,
			RemoteSchema:    h.ManualConfiguration.RemoteSchema,
			RemoteFieldPath: ExtractRemoteFieldPath(remoteField),
		}

		if len(h.ManualConfiguration.LHSFields) > 0 {
			// Seed ColumnMapping with the original SQL names; convertTable applies
			// the column rename afterwards once the table's ColumnConfig is known.
			manual.ColumnMapping = make(map[string]string, len(h.ManualConfiguration.LHSFields))
			for _, lhs := range h.ManualConfiguration.LHSFields {
				manual.ColumnMapping[lhs] = lhs
			}
		}
	}

	return RelationshipUsing{
		ForeignKeyColumns:    append([]string(nil), h.ForeignKeyColumns...),
		ForeignKeyConstraint: fk,
		ManualConfiguration:  manual,
	}
}

func convertRemoteRelationship(h hasura.RemoteRelationship) RemoteRelationship {
	var toSource *ToSourceRelationship
	if h.Definition.ToSource != nil {
		toSource = &ToSourceRelationship{
			FieldMapping:     h.Definition.ToSource.FieldMapping,
			RelationshipType: h.Definition.ToSource.RelationshipType,
			Source:           h.Definition.ToSource.Source,
			Table:            convertTableSource(h.Definition.ToSource.Table),
		}
	}

	var toRemoteSchema *ToRemoteSchemaRelationship
	if h.Definition.ToRemoteSchema != nil {
		toRemoteSchema = &ToRemoteSchemaRelationship{
			RemoteSchema: h.Definition.ToRemoteSchema.RemoteSchema,
			LHSFields:    h.Definition.ToRemoteSchema.LHSFields,
			RemoteField:  convertRemoteFieldCalls(h.Definition.ToRemoteSchema.RemoteField),
		}
	}

	return RemoteRelationship{
		Name: h.Name,
		Definition: RemoteRelationshipDef{
			ToSource:       toSource,
			ToRemoteSchema: toRemoteSchema,
		},
	}
}

func convertRemoteFieldCalls(h map[string]hasura.RemoteFieldCall) map[string]RemoteFieldCall {
	if h == nil {
		return nil
	}

	result := make(map[string]RemoteFieldCall, len(h))
	for k, v := range h {
		// Clone Arguments so applyRemoteSchemaColumnRenames' in-place rename of
		// $sql_column → $graphql_name does not leak back into the source
		// *hasura.Metadata that FileMetadataSource snapshots verbatim for
		// export_metadata.
		var args map[string]string
		if v.Arguments != nil {
			args = make(map[string]string, len(v.Arguments))
			maps.Copy(args, v.Arguments)
		}

		result[k] = RemoteFieldCall{
			Arguments: args,
			Field:     convertRemoteFieldCalls(v.Field),
		}
	}

	return result
}

func convertFunction(h hasura.FunctionMetadata) FunctionMetadata {
	permissions := make([]FunctionPermission, len(h.Permissions))
	for i, p := range h.Permissions {
		permissions[i] = FunctionPermission{Role: p.Role}
	}

	return FunctionMetadata{
		Function: FunctionSource{
			Name:   h.Function.Name,
			Schema: h.Function.Schema,
		},
		Configuration: FunctionConfiguration{
			CustomName: h.Configuration.CustomName,
			CustomRootFields: FunctionCustomRootFields{
				Function:          h.Configuration.CustomRootFields.Function,
				FunctionAggregate: h.Configuration.CustomRootFields.FunctionAggregate,
			},
			ExposedAs:       h.Configuration.ExposedAs,
			SessionArgument: h.Configuration.SessionArgument,
		},
		Permissions: permissions,
	}
}

func convertRemoteSchemaURL(h hasura.RemoteSchemaDefinition) EnvString {
	if h.URLFromEnv != "" {
		return EnvString("{{" + h.URLFromEnv + "}}")
	}

	return EnvString(h.URL)
}

func convertRemoteSchemaHeaders(headers []hasura.RemoteSchemaHeader) []RemoteSchemaHeader {
	result := make([]RemoteSchemaHeader, len(headers))
	for i, h := range headers {
		value, valueFromEnv := convertHeaderValue(h.Value)
		result[i] = RemoteSchemaHeader{
			Name:         h.Name,
			Value:        value,
			ValueFromEnv: valueFromEnv,
		}
	}

	return result
}

func convertRemoteSchemaPermissions(
	perms []hasura.RemoteSchemaPermission,
) []RemoteSchemaPermission {
	result := make([]RemoteSchemaPermission, len(perms))
	for i, p := range perms {
		result[i] = RemoteSchemaPermission{
			Role: p.Role,
			Definition: RemoteSchemaPermissionDef{
				Schema: p.Definition.Schema,
			},
		}
	}

	return result
}

func convertRemoteSchema(h hasura.RemoteSchemaMetadata) RemoteSchemaMetadata {
	remoteRelationships := make([]RemoteSchemaTypeRemoteRelationship, len(h.RemoteRelationships))
	for i, rr := range h.RemoteRelationships {
		remoteRelationships[i] = convertRemoteSchemaTypeRelationship(rr)
	}

	return RemoteSchemaMetadata{
		Name:    h.Name,
		Comment: h.Comment,
		Definition: RemoteSchemaDefinition{
			URL:                  convertRemoteSchemaURL(h.Definition),
			TimeoutSeconds:       h.Definition.TimeoutSeconds,
			Customization:        convertRemoteSchemaCustomization(h.Definition.Customization),
			Headers:              convertRemoteSchemaHeaders(h.Definition.Headers),
			ForwardClientHeaders: h.Definition.ForwardClientHeaders,
		},
		Permissions:         convertRemoteSchemaPermissions(h.Permissions),
		RemoteRelationships: remoteRelationships,
	}
}

// convertRemoteSchemaCustomization normalizes a Hasura remote schema's
// definition.customization (root_fields_namespace + type_names + field_names)
// into the shared Customization shape.
func convertRemoteSchemaCustomization(h hasura.RemoteSchemaCustomization) Customization {
	var fieldNames []FieldNameCustomization

	if len(h.FieldNames) > 0 {
		fieldNames = make([]FieldNameCustomization, len(h.FieldNames))
		for i, fn := range h.FieldNames {
			fieldNames[i] = FieldNameCustomization{
				ParentType: fn.ParentType,
				Prefix:     fn.Prefix,
				Suffix:     fn.Suffix,
				Mapping:    fn.Mapping,
			}
		}
	}

	return Customization{
		RootFieldsNamespace: h.RootFieldsNamespace,
		RootFieldsPrefix:    "",
		RootFieldsSuffix:    "",
		TypeNamesPrefix:     h.TypeNames.Prefix,
		TypeNamesSuffix:     h.TypeNames.Suffix,
		TypeNamesMapping:    h.TypeNames.Mapping,
		FieldNames:          fieldNames,
	}
}

func convertRemoteSchemaTypeRelationship(
	h hasura.RemoteSchemaTypeRemoteRelationship,
) RemoteSchemaTypeRemoteRelationship {
	relationships := make([]RemoteSchemaRelationshipDef, len(h.Relationships))
	for i, rel := range h.Relationships {
		var toSource *RemoteSchemaToSourceRelationship
		if rel.Definition.ToSource != nil {
			toSource = &RemoteSchemaToSourceRelationship{
				FieldMapping:     rel.Definition.ToSource.FieldMapping,
				RelationshipType: rel.Definition.ToSource.RelationshipType,
				Source:           rel.Definition.ToSource.Source,
				Table: RemoteSchemaTableRef{
					Name:   rel.Definition.ToSource.Table.Name,
					Schema: rel.Definition.ToSource.Table.Schema,
				},
			}
		}

		relationships[i] = RemoteSchemaRelationshipDef{
			Name: rel.Name,
			Definition: RemoteSchemaRelationshipDefinition{
				ToSource: toSource,
			},
		}
	}

	return RemoteSchemaTypeRemoteRelationship{
		TypeName:      h.TypeName,
		Relationships: relationships,
	}
}
