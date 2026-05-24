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
	"github.com/nhost/nhost/services/constellation/connector"
	"github.com/nhost/nhost/services/constellation/controller/planner"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// FromMetadata builds the planner relationship metadata for every connector
// referenced by meta. Each connector name maps to the cross-connector
// relationships it exposes; local same-database relationships are filtered
// out because the planner only cares about cross-connector traversals.
func FromMetadata(
	meta *metadata.Metadata,
	connectors map[string]connector.Connector,
) map[string][]*planner.RelationshipMetadata {
	result := make(map[string][]*planner.RelationshipMetadata)

	for _, db := range meta.Databases {
		result[db.Name] = append(result[db.Name], forDatabase(db, connectors[db.Name])...)
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

		sourceType := dbConn.GetTypeName(table.Table.Schema + "." + table.Table.Name)

		for _, rel := range table.ObjectRelationships {
			if rm := forDatabaseRelationship(sourceType, rel.Name, rel.Using, false); rm != nil {
				out = append(out, rm)
			}
		}

		for _, rel := range table.ArrayRelationships {
			rm := forDatabaseRelationship(sourceType, rel.Name, rel.Using, true)
			if rm == nil {
				continue
			}

			out = append(out, rm)

			// Cross-database array relationships also expose an
			// "<rel>_aggregate" sibling field, routed through the
			// grouped-aggregate execution path.
			if agg := aggregateRelationship(rm); agg != nil {
				out = append(out, agg)
			}
		}
	}

	return out
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
