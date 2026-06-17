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

	"github.com/nhost/nhost/services/constellation/api"
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

		// Clone ColumnMapping so the downstream column rename does not alias and
		// mutate the shared *hasura.Metadata snapshot map, mirroring the
		// Arguments clone in convertRemoteFieldCalls.
		var columnMapping map[string]string
		if h.ManualConfiguration.ColumnMapping != nil {
			columnMapping = make(map[string]string, len(h.ManualConfiguration.ColumnMapping))
			maps.Copy(columnMapping, h.ManualConfiguration.ColumnMapping)
		}

		manual = &ManualConfiguration{
			RemoteTable:     convertTableSource(h.ManualConfiguration.RemoteTable),
			ColumnMapping:   columnMapping,
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

// strDeref returns the pointed-to string, or "" for a nil pointer. Generated
// wire types model optional scalars as pointers; the native model uses values.
func strDeref(s *string) string {
	if s == nil {
		return ""
	}

	return *s
}

func convertRemoteSchemaURL(h hasura.RemoteSchemaDefinition) EnvString {
	if h.UrlFromEnv != nil && *h.UrlFromEnv != "" {
		return EnvString("{{" + *h.UrlFromEnv + "}}")
	}

	return EnvString(strDeref(h.Url))
}

func convertRemoteSchemaHeaders(
	headers *[]api.RemoteSchemaDef_Headers_Item,
) []RemoteSchemaHeader {
	if headers == nil || len(*headers) == 0 {
		return nil
	}

	result := make([]RemoteSchemaHeader, len(*headers))
	for i, item := range *headers {
		// The generated header is a HeaderConfValue|HeaderConfFromEnv union with
		// no discriminator; project it through its JSON form, which carries
		// whichever of value / value_from_env is set.
		var raw struct {
			Name         string `json:"name"`
			Value        string `json:"value"`
			ValueFromEnv string `json:"value_from_env"`
		}

		if b, err := item.MarshalJSON(); err == nil {
			_ = stdjson.Unmarshal(b, &raw)
		}

		result[i] = RemoteSchemaHeader{
			Name:         raw.Name,
			Value:        raw.Value,
			ValueFromEnv: raw.ValueFromEnv,
		}
	}

	return result
}

func convertRemoteSchemaPermissions(
	perms *[]hasura.RemoteSchemaPermission,
) []RemoteSchemaPermission {
	if perms == nil || len(*perms) == 0 {
		return nil
	}

	result := make([]RemoteSchemaPermission, len(*perms))
	for i, p := range *perms {
		result[i] = RemoteSchemaPermission{
			Role: p.Role,
			Definition: RemoteSchemaPermissionDef{
				Schema: p.Definition.Schema,
			},
		}
	}

	return result
}

// ConvertRemoteSchema converts a single Hasura wire-form remote schema entry
// into the native model. Exported so the metadata mutation store can validate
// a prospective remote schema (URL/header resolution, permission SDL parsing,
// admin introspection) through the same path the controller uses to build the
// connector — guaranteeing that an accepted mutation also rebuilds cleanly.
func ConvertRemoteSchema(h hasura.RemoteSchemaMetadata) RemoteSchemaMetadata {
	return convertRemoteSchema(h)
}

func convertRemoteSchema(h hasura.RemoteSchemaMetadata) RemoteSchemaMetadata {
	var remoteRelationships []RemoteSchemaTypeRemoteRelationship
	if h.RemoteRelationships != nil {
		remoteRelationships = make(
			[]RemoteSchemaTypeRemoteRelationship, len(*h.RemoteRelationships),
		)
		for i, rr := range *h.RemoteRelationships {
			remoteRelationships[i] = convertRemoteSchemaTypeRelationship(rr)
		}
	}

	timeout := 0
	if h.Definition.TimeoutSeconds != nil {
		timeout = int(*h.Definition.TimeoutSeconds)
	}

	forward := false
	if h.Definition.ForwardClientHeaders != nil {
		forward = *h.Definition.ForwardClientHeaders
	}

	return RemoteSchemaMetadata{
		Name:    h.Name,
		Comment: strDeref(h.Comment),
		Definition: RemoteSchemaDefinition{
			URL:                  convertRemoteSchemaURL(h.Definition),
			TimeoutSeconds:       timeout,
			Customization:        convertRemoteSchemaCustomization(h.Definition.Customization),
			Headers:              convertRemoteSchemaHeaders(h.Definition.Headers),
			ForwardClientHeaders: forward,
		},
		Permissions:         convertRemoteSchemaPermissions(h.Permissions),
		RemoteRelationships: remoteRelationships,
	}
}

// convertRemoteSchemaCustomization normalizes a Hasura remote schema's
// definition.customization (root_fields_namespace + type_names + field_names)
// into the shared Customization shape. The argument is nilable: the generated
// definition models customization as an optional object.
func convertRemoteSchemaCustomization(h *hasura.RemoteSchemaCustomization) Customization {
	if h == nil {
		return Customization{}
	}

	var fieldNames []FieldNameCustomization
	if h.FieldNames != nil && len(*h.FieldNames) > 0 {
		fieldNames = make([]FieldNameCustomization, len(*h.FieldNames))
		for i, fn := range *h.FieldNames {
			fieldNames[i] = FieldNameCustomization{
				ParentType: fn.ParentType,
				Prefix:     strDeref(fn.Prefix),
				Suffix:     strDeref(fn.Suffix),
				Mapping:    fn.Mapping,
			}
		}
	}

	var typePrefix, typeSuffix string
	var typeMapping map[string]string
	if h.TypeNames != nil {
		typePrefix = strDeref(h.TypeNames.Prefix)
		typeSuffix = strDeref(h.TypeNames.Suffix)
		typeMapping = h.TypeNames.Mapping
	}

	return Customization{
		RootFieldsNamespace: strDeref(h.RootFieldsNamespace),
		RootFieldsPrefix:    "",
		RootFieldsSuffix:    "",
		TypeNamesPrefix:     typePrefix,
		TypeNamesSuffix:     typeSuffix,
		TypeNamesMapping:    typeMapping,
		FieldNames:          fieldNames,
	}
}

func convertRemoteSchemaTypeRelationship(
	h hasura.RemoteSchemaTypeRemoteRelationship,
) RemoteSchemaTypeRemoteRelationship {
	var relationships []RemoteSchemaRelationshipDef
	if h.Relationships != nil {
		relationships = make([]RemoteSchemaRelationshipDef, len(h.Relationships))
		for i, rel := range h.Relationships {
			relationships[i] = RemoteSchemaRelationshipDef{
				Name:       rel.Name,
				Definition: convertRemoteSchemaRelationshipDefinition(rel.Definition),
			}
		}
	}

	return RemoteSchemaTypeRemoteRelationship{
		TypeName:      h.TypeName,
		Relationships: relationships,
	}
}

// rawRemoteFieldCall mirrors the generated FieldCall but keeps argument values
// as raw JSON. The generated RemoteArguments value type (GraphQLValueName, a
// recursive anyOf) cannot be decoded by oapi-codegen's union for scalar values,
// so the native model decodes the relationship arms from the union's raw JSON
// directly rather than through the broken typed accessors.
type rawRemoteFieldCall struct {
	Arguments map[string]stdjson.RawMessage `json:"arguments"`
	Field     map[string]rawRemoteFieldCall `json:"field"`
}

// convertRemoteSchemaRelationshipDefinition projects the generated
// to_source|to_remote_schema union into the native two-pointer shape the
// composer consumes, decoding from the union's raw JSON (which is what the wire
// type actually stores). The legacy flat to-schema format is not modelled,
// matching the prior behaviour.
func convertRemoteSchemaRelationshipDefinition(
	d hasura.RemoteSchemaRelationshipDefinition,
) RemoteSchemaRelationshipDefinition {
	raw, err := d.MarshalJSON()
	if err != nil {
		return RemoteSchemaRelationshipDefinition{}
	}

	var body struct {
		ToSource *struct {
			FieldMapping     map[string]string `json:"field_mapping"`
			RelationshipType string            `json:"relationship_type"`
			Source           string            `json:"source"`
			Table            map[string]any    `json:"table"`
		} `json:"to_source"`
		ToRemoteSchema *struct {
			RemoteSchema string                        `json:"remote_schema"`
			LhsFields    []string                      `json:"lhs_fields"`
			RemoteField  map[string]rawRemoteFieldCall `json:"remote_field"`
		} `json:"to_remote_schema"`
	}

	if err := stdjson.Unmarshal(raw, &body); err != nil {
		return RemoteSchemaRelationshipDefinition{}
	}

	var toSource *RemoteSchemaToSourceRelationship
	if body.ToSource != nil {
		toSource = &RemoteSchemaToSourceRelationship{
			FieldMapping:     body.ToSource.FieldMapping,
			RelationshipType: body.ToSource.RelationshipType,
			Source:           body.ToSource.Source,
			Table:            remoteSchemaTableRef(body.ToSource.Table),
		}
	}

	var toRemoteSchema *ToRemoteSchemaRelationship
	if body.ToRemoteSchema != nil {
		toRemoteSchema = &ToRemoteSchemaRelationship{
			RemoteSchema: body.ToRemoteSchema.RemoteSchema,
			LHSFields:    body.ToRemoteSchema.LhsFields,
			RemoteField:  convertRawRemoteFields(body.ToRemoteSchema.RemoteField),
		}
	}

	return RemoteSchemaRelationshipDefinition{
		ToSource:       toSource,
		ToRemoteSchema: toRemoteSchema,
	}
}

// remoteSchemaTableRef extracts {schema,name} from the generated table object
// (typed as a free-form map in the spec).
func remoteSchemaTableRef(m map[string]any) RemoteSchemaTableRef {
	name, _ := m["name"].(string)
	schema, _ := m["schema"].(string)

	return RemoteSchemaTableRef{Name: name, Schema: schema}
}

// convertRawRemoteFields converts the raw remote_field tree into the native
// RemoteFieldCall map used by rs->rs relationships.
func convertRawRemoteFields(rf map[string]rawRemoteFieldCall) map[string]RemoteFieldCall {
	if rf == nil {
		return nil
	}

	out := make(map[string]RemoteFieldCall, len(rf))
	for name, fc := range rf {
		var args map[string]string
		if fc.Arguments != nil {
			args = make(map[string]string, len(fc.Arguments))
			for k, v := range fc.Arguments {
				args[k] = jsonRawToString(v)
			}
		}

		var field map[string]RemoteFieldCall
		if fc.Field != nil {
			field = convertRawRemoteFields(fc.Field)
		}

		out[name] = RemoteFieldCall{Arguments: args, Field: field}
	}

	return out
}

// jsonRawToString renders a remote-argument value as a string: a JSON string is
// unquoted (the common case, e.g. "$id"); any other JSON value is returned as
// its raw JSON encoding.
func jsonRawToString(b stdjson.RawMessage) string {
	var s string
	if err := stdjson.Unmarshal(b, &s); err == nil {
		return s
	}

	return string(b)
}
