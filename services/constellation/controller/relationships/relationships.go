// Package relationships translates metadata.Metadata into the
// planner.RelationshipMetadata entries the query planner consumes. It is the
// glue between the user-facing metadata model (Hasura-compatible YAML/TOML)
// and the planner's internal cross-connector relationship representation.
//
// The package owns no state: every function here is a pure translation from
// metadata input to planner output. It lives alongside the controller because
// it is invoked at controller-state-build time (initial load and each
// metadata reload), but it deliberately does not depend on any controller
// internals.
package relationships

import (
	"maps"
	"strings"

	"github.com/nhost/nhost/services/constellation/connector"
	connectorrelationships "github.com/nhost/nhost/services/constellation/connector/relationships"
	"github.com/nhost/nhost/services/constellation/controller/planner"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// FromMetadata builds the planner relationship metadata for every connector
// referenced by meta. Each connector name maps to the cross-connector
// relationships it exposes; local same-database relationships are filtered
// out because the planner only cares about cross-connector traversals.
//
// Databases without a surviving connector are silently skipped: their source
// is already recorded as inconsistent, and forDatabase would otherwise
// dereference the missing connector for GetTypeName and panic. The
// remote-schema branch never reaches into its connector, so it does not
// need the same guard.
func FromMetadata(
	meta *metadata.Metadata,
	connectors map[string]connector.Connector,
) map[string][]*planner.RelationshipMetadata {
	result := make(map[string][]*planner.RelationshipMetadata)

	for _, db := range meta.Databases {
		dbConn, ok := connectors[db.Name]
		if !ok || dbConn == nil {
			continue
		}

		result[db.Name] = append(result[db.Name], forDatabase(db, dbConn)...)
	}

	for _, rs := range meta.RemoteSchemas {
		result[rs.Name] = append(result[rs.Name], forRemoteSchema(rs)...)
	}

	return result
}

// forDatabase builds the cross-connector relationship metadata (db→db and
// db→rs) for a single database. Local same-database relationships are
// filtered out by forDatabaseRelationship.
func forDatabase(
	db metadata.DatabaseMetadata, dbConn connector.Connector,
) []*planner.RelationshipMetadata {
	var out []*planner.RelationshipMetadata

	for _, table := range db.Tables {
		if table.IsEnum {
			continue
		}

		sourceType := connectorrelationships.SchemaTypeName(
			dbConn, table.Table.Schema+"."+table.Table.Name,
		)

		localNames := table.LocalRelationshipNames()

		rawSources := make(map[string]*metadata.ToSourceRelationship)
		for _, rel := range table.RemoteRelationships {
			if rel.Definition.ToSource != nil {
				rawSources[rel.Name] = rel.Definition.ToSource
			}
		}

		emitted := make(map[string]*planner.RelationshipMetadata)
		for _, rel := range table.ObjectRelationships {
			if rm := loweredRelationship(
				sourceType,
				rel.Name,
				rel.Using,
				false,
				localNames,
				rawSources,
			); rm != nil {
				out = append(out, rm)
				emitted[rel.Name] = rm
			}
		}

		for _, rel := range table.ArrayRelationships {
			rm := loweredRelationship(sourceType, rel.Name, rel.Using, true, localNames, rawSources)
			if rm == nil {
				continue
			}

			out = append(out, rm)
			emitted[rel.Name] = rm

			// Cross-database array relationships also expose an
			// "<rel>_aggregate" sibling field, routed through the
			// grouped-aggregate execution path, unless a local
			// relationship already owns that field.
			if agg := aggregateRelationship(rm); agg != nil && !localNames[agg.Name] {
				out = append(out, agg)
			}
		}

		out = append(out, forRawRemoteRelationships(table, sourceType, localNames, emitted)...)
	}

	return out
}

func loweredRelationship(
	sourceType, name string, using metadata.RelationshipUsing, array bool,
	localNames map[string]bool, rawSources map[string]*metadata.ToSourceRelationship,
) *planner.RelationshipMetadata {
	if localNames[name] {
		return nil
	}

	rm := forDatabaseRelationship(sourceType, name, using, array)
	if rm != nil {
		if raw := rawSources[name]; raw != nil && !matchesRawSource(rm, raw) {
			return nil
		}
	}

	return rm
}

// matchesRawSource identifies the lowered form of a raw to_source entry.
// Conflicting lowered entries must not supersede the raw definition used by
// the composer, including its array aggregate sibling.
func matchesRawSource(rm *planner.RelationshipMetadata, raw *metadata.ToSourceRelationship) bool {
	return rm.TargetConnector == raw.Source &&
		rm.TargetTable == raw.Table.Name && rm.TargetTableSchema == raw.Table.Schema &&
		rm.IsArray == (raw.RelationshipType == metadata.RelationshipTypeArray) &&
		maps.Equal(rm.JoinMapping, raw.FieldMapping)
}

func forRawRemoteRelationships(
	table metadata.TableMetadata, sourceType string, localNames map[string]bool,
	emitted map[string]*planner.RelationshipMetadata,
) []*planner.RelationshipMetadata {
	var out []*planner.RelationshipMetadata
	for _, rel := range table.RemoteRelationships {
		if localNames[rel.Name] {
			continue
		}

		if rel.Definition.ToSource == nil {
			if emitted[rel.Name] != nil {
				continue
			}

			// Prefer a usable lowered relationship, but retain raw-only native
			// definitions and malformed lowered paths as planner fallbacks.
			if rm := remoteSchemaRelationship(
				sourceType,
				rel,
				table.Configuration.ColumnConfig,
			); rm != nil {
				out = append(out, rm)
			}

			continue
		}

		toSource := rel.Definition.ToSource
		if lower := emitted[rel.Name]; lower != nil && matchesRawSource(lower, toSource) {
			continue
		}

		rm := &planner.RelationshipMetadata{
			Name: rel.Name, SourceType: sourceType, TargetConnector: toSource.Source,
			TargetTable: toSource.Table.Name, TargetTableSchema: toSource.Table.Schema,
			JoinMapping:      toSource.FieldMapping,
			IsArray:          toSource.RelationshipType == metadata.RelationshipTypeArray,
			IsArrayAggregate: false, IsRemote: true,
			LHSFields: nil, RemoteFieldPath: nil,
		}

		out = append(out, rm)
		if agg := aggregateRelationship(rm); agg != nil && !localNames[agg.Name] {
			out = append(out, agg)
		}
	}

	return out
}

func remoteSchemaRelationship(
	sourceType string,
	rel metadata.RemoteRelationship,
	columnConfig map[string]metadata.ColumnConfig,
) *planner.RelationshipMetadata {
	toRS := rel.Definition.ToRemoteSchema
	if toRS == nil {
		return nil
	}

	path := metadata.ExtractRemoteFieldPath(toRS.RemoteField)
	if len(path) == 0 {
		return nil
	}

	rename := func(sqlName string) string {
		if column, ok := columnConfig[sqlName]; ok && column.CustomName != "" {
			return column.CustomName
		}

		return sqlName
	}

	lhsFields := make([]string, len(toRS.LHSFields))
	for i, field := range toRS.LHSFields {
		lhsFields[i] = rename(field)
	}

	plannerPath := make([]planner.RemoteFieldPathEntry, len(path))
	for i, entry := range path {
		args := make(map[string]string, len(entry.Arguments))
		for key, value := range entry.Arguments {
			if sqlName, ok := strings.CutPrefix(value, "$"); ok {
				value = "$" + rename(sqlName)
			}

			args[key] = value
		}

		plannerPath[i] = planner.RemoteFieldPathEntry{
			FieldName: entry.FieldName, Arguments: args,
		}
	}

	return &planner.RelationshipMetadata{
		Name: rel.Name, SourceType: sourceType,
		TargetConnector: toRS.RemoteSchema, TargetTable: "", TargetTableSchema: "",
		JoinMapping: nil, IsArray: false, IsArrayAggregate: false, IsRemote: true,
		LHSFields: lhsFields, RemoteFieldPath: plannerPath,
	}
}

// forRemoteSchema builds rs→db relationship metadata for a single remote
// schema. rs→rs is not supported.
func forRemoteSchema(rs metadata.RemoteSchemaMetadata) []*planner.RelationshipMetadata {
	var out []*planner.RelationshipMetadata

	for _, typeRel := range rs.RemoteRelationships {
		for _, rel := range typeRel.Relationships {
			if rel.Definition.ToSource == nil {
				continue
			}

			toSource := rel.Definition.ToSource

			rsRel := &planner.RelationshipMetadata{
				Name:              rel.Name,
				SourceType:        typeRel.TypeName,
				TargetConnector:   toSource.Source,
				TargetTable:       toSource.Table.Name,
				TargetTableSchema: toSource.Table.Schema,
				JoinMapping:       toSource.FieldMapping,
				IsArray:           toSource.RelationshipType == metadata.RelationshipTypeArray,
				IsArrayAggregate:  false,
				IsRemote:          true,
				LHSFields:         nil,
				RemoteFieldPath:   nil,
			}
			out = append(out, rsRel)

			if agg := aggregateRelationship(rsRel); agg != nil {
				out = append(out, agg)
			}
		}
	}

	return out
}

// aggregateRelationship produces the "<rel>_aggregate" sibling relationship
// metadata for a cross-database array relationship. Returns nil for non-array
// or non-remote relationships, or when the target is a remote schema (remote
// schemas do not expose aggregate types).
func aggregateRelationship(base *planner.RelationshipMetadata) *planner.RelationshipMetadata {
	if base == nil || !base.IsArray || !base.IsRemote {
		return nil
	}

	if len(base.RemoteFieldPath) > 0 {
		// db→rs: remote schemas don't have aggregate types.
		return nil
	}

	agg := *base
	agg.Name = base.Name + "_aggregate"
	agg.IsArrayAggregate = true

	return &agg
}

// forDatabaseRelationship builds a planner.RelationshipMetadata from a
// database relationship. Returns nil for local (same-database) relationships,
// which the planner does not handle (the connector resolves them in-SQL).
func forDatabaseRelationship(
	sourceType, relName string,
	using metadata.RelationshipUsing,
	isArray bool,
) *planner.RelationshipMetadata {
	mc := using.ManualConfiguration
	if mc == nil {
		return nil
	}

	switch {
	case mc.Source != "":
		// db→db
		return &planner.RelationshipMetadata{
			Name:              relName,
			SourceType:        sourceType,
			TargetConnector:   mc.Source,
			TargetTable:       mc.RemoteTable.Name,
			TargetTableSchema: mc.RemoteTable.Schema,
			JoinMapping:       mc.ColumnMapping,
			IsArray:           isArray,
			IsArrayAggregate:  false,
			IsRemote:          true,
			LHSFields:         nil,
			RemoteFieldPath:   nil,
		}

	case mc.RemoteSchema != "" && len(mc.RemoteFieldPath) > 0:
		// db→rs
		lhsFields := make([]string, 0, len(mc.ColumnMapping))
		for localCol := range mc.ColumnMapping {
			lhsFields = append(lhsFields, localCol)
		}

		remoteFieldPath := make([]planner.RemoteFieldPathEntry, len(mc.RemoteFieldPath))
		for i, entry := range mc.RemoteFieldPath {
			remoteFieldPath[i] = planner.RemoteFieldPathEntry{
				FieldName: entry.FieldName,
				Arguments: entry.Arguments,
			}
		}

		return &planner.RelationshipMetadata{
			Name:              relName,
			SourceType:        sourceType,
			TargetConnector:   mc.RemoteSchema,
			TargetTable:       "",
			TargetTableSchema: "",
			JoinMapping:       mc.ColumnMapping,
			IsArray:           isArray,
			IsArrayAggregate:  false,
			IsRemote:          true,
			LHSFields:         lhsFields,
			RemoteFieldPath:   remoteFieldPath,
		}
	}

	return nil
}
