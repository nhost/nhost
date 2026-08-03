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
	"github.com/nhost/nhost/services/constellation/connector/action"
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

	// Action output object types -> database source relationships, routed under
	// the action connector. Only when the action connector is present.
	if actionConn := connectors[action.ConnectorName]; actionConn != nil {
		if rels := forCustomTypes(meta); len(rels) > 0 {
			result[action.ConnectorName] = append(result[action.ConnectorName], rels...)
		}
	}

	return result
}

// forCustomTypes builds cross-connector relationship metadata for action output
// object types (custom-type -> database source). The action connector owns the
// source type; the target is a database table. Mirrors the rs->db ToSource
// branch, including the array "_aggregate" sibling.
func forCustomTypes(meta *metadata.Metadata) []*planner.RelationshipMetadata {
	var out []*planner.RelationshipMetadata

	for _, object := range meta.CustomTypes.Objects {
		for _, rel := range object.Relationships {
			if rel.Type != metadata.RelationshipTypeObject &&
				rel.Type != metadata.RelationshipTypeArray {
				continue
			}

			if rel.Source == "" || rel.RemoteTable.Name == "" || rel.RemoteTable.Schema == "" {
				continue
			}

			rm := &planner.RelationshipMetadata{
				Name:              rel.Name,
				SourceType:        object.Name,
				TargetConnector:   rel.Source,
				TargetTable:       rel.RemoteTable.Name,
				TargetTableSchema: rel.RemoteTable.Schema,
				JoinMapping:       rel.FieldMapping,
				IsArray:           rel.Type == metadata.RelationshipTypeArray,
				IsArrayAggregate:  false,
				IsRemote:          true,
				LHSFields:         nil,
				RemoteFieldPath:   nil,
			}
			out = append(out, rm)

			if agg := aggregateRelationship(rm); agg != nil {
				out = append(out, agg)
			}
		}
	}

	return out
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

// forRemoteSchema builds the cross-connector relationship metadata for a single
// remote schema: rs→db (to_source) and rs→rs (to_remote_schema).
func forRemoteSchema(rs metadata.RemoteSchemaMetadata) []*planner.RelationshipMetadata {
	var out []*planner.RelationshipMetadata

	for _, typeRel := range rs.RemoteRelationships {
		for _, rel := range typeRel.Relationships {
			switch {
			case rel.Definition.ToSource != nil:
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

			case rel.Definition.ToRemoteSchema != nil:
				if rsRel := forRemoteSchemaToRemoteSchema(typeRel.TypeName, rel); rsRel != nil {
					out = append(out, rsRel)
				}
			}
		}
	}

	return out
}

// forRemoteSchemaToRemoteSchema builds rs→rs relationship metadata. The target
// is another remote schema, so the planner routes it through the schema
// resolver (RemoteFieldPath set). JoinMapping is keyed by the LHS fields so the
// phantom-injection pass fetches them from the parent remote-schema response;
// its values are unused for a remote-schema target (the schema resolver reads
// LHSFields directly). Mirrors the db→rs branch in forDatabaseRelationship.
func forRemoteSchemaToRemoteSchema(
	sourceType string, rel metadata.RemoteSchemaRelationshipDef,
) *planner.RelationshipMetadata {
	toRS := rel.Definition.ToRemoteSchema

	extracted := metadata.ExtractRemoteFieldPath(toRS.RemoteField)
	// Guard an empty remote_field: with no path the planner's resolver-kind
	// discriminator (len(RemoteFieldPath) > 0) would route this through the
	// database resolver with a remote-schema TargetConnector. Mirrors the
	// composer's rsRelationshipSpec and the db→rs sibling, which both drop the
	// relationship in this case.
	if len(extracted) == 0 {
		return nil
	}

	remoteFieldPath := make([]planner.RemoteFieldPathEntry, len(extracted))

	for i, entry := range extracted {
		remoteFieldPath[i] = planner.RemoteFieldPathEntry{
			FieldName: entry.FieldName,
			Arguments: entry.Arguments,
		}
	}

	joinMapping := make(map[string]string, len(toRS.LHSFields))
	for _, f := range toRS.LHSFields {
		joinMapping[f] = f
	}

	return &planner.RelationshipMetadata{
		Name:              rel.Name,
		SourceType:        sourceType,
		TargetConnector:   toRS.RemoteSchema,
		TargetTable:       "",
		TargetTableSchema: "",
		JoinMapping:       joinMapping,
		IsArray:           false,
		IsArrayAggregate:  false,
		IsRemote:          true,
		LHSFields:         toRS.LHSFields,
		RemoteFieldPath:   remoteFieldPath,
	}
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
