// Package composer collects schemas from multiple connector backends,
// injects remote-relationship fields, merges schemas per role, and validates
// the merged schemas.
package composer

import (
	"context"
	"fmt"
	"log/slog"
	"maps"
	"slices"

	"github.com/nhost/nhost/services/constellation/connector/action"
	"github.com/nhost/nhost/services/constellation/connector/relationships"
	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/vektah/gqlparser/v2/ast"
)

// SchemaProvider is the minimal connector contract the composer needs:
// schemas to merge and type-name resolution for cross-connector relationships.
//
//go:generate mockgen -package mock -destination mock/schemaprovider.go . SchemaProvider
type SchemaProvider interface {
	GetSchema() (map[string]*graph.Schema, error)
	GetTypeName(identifier string) string
}

// Composer binds a provider set and metadata together so that [Composer.Compose]
// can be invoked against them. Instances are immutable handles: they do not
// retain state across calls and are safe to reuse for repeated compositions.
type Composer struct {
	providers       map[string]SchemaProvider
	meta            *metadata.Metadata
	inconsistencies *metadata.Inconsistencies
}

// New creates a Composer over the given providers. Per-connector and per-role
// composition failures are recorded in inconsistencies and the affected
// connector or role is dropped from the result. Pass nil to have the composer
// allocate its own collector internally.
func New(
	providers map[string]SchemaProvider,
	meta *metadata.Metadata,
	inconsistencies *metadata.Inconsistencies,
) *Composer {
	if inconsistencies == nil {
		inconsistencies = metadata.NewInconsistencies()
	}

	return &Composer{
		providers:       providers,
		meta:            meta,
		inconsistencies: inconsistencies,
	}
}

// Result holds the output of schema composition across providers.
//
// The maps are owned by the Composer that produced this Result: callers must
// treat them as read-only. Mutating them is undefined behaviour, and because
// the value is small (four map headers) Result is returned and embedded by
// value so the ownership contract is not blurred by pointer aliasing.
type Result struct {
	// SchemaDocs is keyed by role name.
	SchemaDocs map[string]*ast.SchemaDocument
	// ValidatedSchemas is keyed by role name.
	ValidatedSchemas map[string]*ast.Schema
	// FieldToConnector maps schemamerge.FieldKey(op, fieldName) to the name of
	// the connector that owns that root field; used by the controller to route
	// operations.
	FieldToConnector map[string]string
	// TypeToConnectors maps each GraphQL type name to the names of the
	// connectors that own it; used by the controller to route operations.
	TypeToConnectors map[string][]string
}

// Compose collects schemas from all providers, adds remote relationship
// fields, merges them per role, and validates. Per-connector and per-role
// failures are recorded as inconsistencies on the collector supplied to New
// rather than aborting the build, so a partial failure still yields a usable
// (if narrower) Result with the surviving roles and connectors.
func (c *Composer) Compose(
	ctx context.Context,
	logger *slog.Logger,
) Result {
	roleSchemas, allRoles := c.collectSchemas(ctx, logger)

	relationships.Inject(roleSchemas, c.relationshipSpecs(), c.typeNameResolvers())

	result := Result{
		SchemaDocs:       make(map[string]*ast.SchemaDocument),
		ValidatedSchemas: make(map[string]*ast.Schema),
		FieldToConnector: make(map[string]string),
		TypeToConnectors: make(map[string][]string),
	}

	connectorNames := make([]string, 0, len(roleSchemas))
	for connName := range roleSchemas {
		connectorNames = append(connectorNames, connName)
	}

	// Merge in lexicographic connector-name order so scalar first-wins dedup and
	// merge-conflict attribution are deterministic. For enums, inputs, object
	// types, interfaces, unions, and directives, schemamerge keeps structurally
	// identical duplicates and rejects differing duplicates with the incoming
	// connector named by composeRole's wrapper.
	slices.Sort(connectorNames)

	for role := range allRoles {
		c.composeRole(ctx, logger, role, connectorNames, roleSchemas, &result)
	}

	return result
}

// composeRole merges every connector's schema for a single role and stores the
// validated result in result. connectorNames must already be sorted so the
// merge order is deterministic. A merge or validation failure drops the entire
// role (it is recorded as an inconsistency and omitted from result); partial
// per-role merges are not exposed because schemamerge can leave the combined
// schema in an intermediate state on error.
func (c *Composer) composeRole(
	ctx context.Context,
	logger *slog.Logger,
	role string,
	connectorNames []string,
	roleSchemas map[string]map[string]*graph.Schema,
	result *Result,
) {
	var (
		combinedSchema   graph.Schema
		fieldToConnector = make(map[string]string)
		typeToConnectors = make(map[string][]string)
	)

	for _, connName := range connectorNames {
		schemas := roleSchemas[connName]

		schema, exists := schemas[role]
		if !exists {
			continue
		}

		if err := schemamerge.MergeConnectorSchema(
			schema, &combinedSchema, connName, fieldToConnector, typeToConnectors,
		); err != nil {
			c.inconsistencies.RecordRole(
				ctx, logger,
				role,
				fmt.Sprintf(
					"failed to merge schema (incoming connector %q): %v",
					connName, err,
				),
			)

			return
		}

		logger.InfoContext(
			ctx, "merged schema for role",
			slog.String("role", role),
			slog.String("connector", connName),
		)
	}

	schemaDoc, validatedSchema, err := schemamerge.BuildValidatedSchema(&combinedSchema, role)
	if err != nil {
		c.inconsistencies.RecordRole(
			ctx, logger,
			role,
			fmt.Sprintf("building validated schema: %v", err),
		)

		return
	}

	result.SchemaDocs[role] = schemaDoc
	result.ValidatedSchemas[role] = validatedSchema

	maps.Copy(result.FieldToConnector, fieldToConnector)
	maps.Copy(result.TypeToConnectors, typeToConnectors)

	logger.InfoContext(ctx, "validated schema for role", slog.String("role", role))
}

func (c *Composer) collectSchemas(
	ctx context.Context,
	logger *slog.Logger,
) (map[string]map[string]*graph.Schema, map[string]struct{}) {
	roleSchemas := make(map[string]map[string]*graph.Schema)
	allRoles := make(map[string]struct{})

	for connName, conn := range c.providers {
		schemas, err := conn.GetSchema()
		if err != nil {
			c.inconsistencies.Record(
				ctx, logger,
				kindForConnector(c.meta, connName),
				"",
				connName,
				fmt.Sprintf("failed to get schema from connector: %v", err),
			)

			continue
		}

		roleSchemas[connName] = schemas

		for role := range schemas {
			allRoles[role] = struct{}{}
		}
	}

	return roleSchemas, allRoles
}

// kindForConnector returns the inconsistency kind ("database" or
// "remote_schema") for a connector name by looking it up in meta. It defaults
// to "database" so the field is never empty even if the connector is
// unregistered (which already implies a prior inconsistency was recorded).
func kindForConnector(meta *metadata.Metadata, name string) string {
	for _, rs := range meta.RemoteSchemas {
		if rs.Name == name {
			return metadata.InconsistencyKindRemoteSchema
		}
	}

	return metadata.InconsistencyKindDatabase
}

func (c *Composer) typeNameResolvers() map[string]relationships.TypeNameResolver {
	resolvers := make(map[string]relationships.TypeNameResolver, len(c.providers))
	for name, conn := range c.providers {
		resolvers[name] = conn
	}

	return resolvers
}

// relationshipSpecs projects c.meta into the narrow shape relationships.Inject
// consumes. The translation is the single seam where metadata-specific
// concerns (the "array"/"object" wire-format string, the
// metadata.ExtractRemoteFieldPath helper, the FromSource/FromRemoteSchema
// shape variants) leave the metadata package and become a flat list of
// [relationships.RelationshipSpec] values. Specs whose source connector is
// not registered as a provider, or whose source table is an enum, are
// dropped here so Inject never sees them.
func (c *Composer) relationshipSpecs() []relationships.RelationshipSpec {
	specs := c.databaseRelationshipSpecs()
	specs = append(specs, c.remoteSchemaRelationshipSpecs()...)
	specs = append(specs, c.actionRelationshipSpecs()...)

	return specs
}

func (c *Composer) databaseRelationshipSpecs() []relationships.RelationshipSpec {
	var specs []relationships.RelationshipSpec

	for _, db := range c.meta.Databases {
		dbConn, ok := c.providers[db.Name]
		if !ok || dbConn == nil {
			continue
		}

		for _, table := range db.Tables {
			if table.IsEnum {
				continue
			}

			sourceType := dbConn.GetTypeName(
				table.Table.Schema + "." + table.Table.Name,
			)

			for _, rel := range table.RemoteRelationships {
				if spec, ok := dbRelationshipSpec(db.Name, sourceType, rel); ok {
					specs = append(specs, spec)
				}
			}
		}
	}

	return specs
}

func (c *Composer) remoteSchemaRelationshipSpecs() []relationships.RelationshipSpec {
	var specs []relationships.RelationshipSpec

	for _, rs := range c.meta.RemoteSchemas {
		for _, typeRel := range rs.RemoteRelationships {
			for _, rel := range typeRel.Relationships {
				if spec, ok := rsRelationshipSpec(rs.Name, typeRel.TypeName, rel); ok {
					specs = append(specs, spec)
				}
			}
		}
	}

	return specs
}

// actionRelationshipSpecs emits action output object type -> database source
// relationships. Only emitted when the action connector is a provider (i.e.
// there are actions); the source type lives on the action connector.
func (c *Composer) actionRelationshipSpecs() []relationships.RelationshipSpec {
	actionConn := c.providers[action.ConnectorName]
	if actionConn == nil {
		return nil
	}

	var specs []relationships.RelationshipSpec

	for _, object := range c.meta.CustomTypes.Objects {
		for _, rel := range object.Relationships {
			if spec, ok := customTypeRelationshipSpec(object.Name, rel); ok {
				specs = append(specs, spec)
			}
		}
	}

	return specs
}

// customTypeRelationshipSpec translates a metadata CustomObjectRelationship (an
// action output object type -> database source relationship) into a
// RelationshipSpec. The action connector owns the source object type; the
// target is a database table, so this mirrors the db->db ToSource shape (SQL
// filtering args on the injected field). Returns ok=false for an unusable
// relationship (bad type, missing source/table), which the action connector
// separately records as a type inconsistency.
func customTypeRelationshipSpec(
	sourceType string, rel metadata.CustomObjectRelationship,
) (relationships.RelationshipSpec, bool) {
	if rel.Type != metadata.RelationshipTypeObject &&
		rel.Type != metadata.RelationshipTypeArray {
		return relationships.RelationshipSpec{}, false //nolint:exhaustruct
	}

	if rel.Source == "" || rel.RemoteTable.Name == "" || rel.RemoteTable.Schema == "" {
		return relationships.RelationshipSpec{}, false //nolint:exhaustruct
	}

	isArray := rel.Type == metadata.RelationshipTypeArray

	return relationships.RelationshipSpec{
		SourceConnector:   action.ConnectorName,
		SourceType:        sourceType,
		Name:              rel.Name,
		TargetConnector:   rel.Source,
		TargetIdentifier:  rel.RemoteTable.Schema + "." + rel.RemoteTable.Name,
		IsArray:           isArray,
		WithSQLArgs:       true,
		RemoteFieldName:   "",
		BoundArguments:    nil,
		ObjectDescription: dbToDBObjectDescription(isArray),
	}, true
}

// dbRelationshipSpec translates a metadata RemoteRelationship (rooted in a
// database table) into a single RelationshipSpec. Returns ok=false if the
// relationship has neither a ToSource nor a usable ToRemoteSchema definition.
func dbRelationshipSpec(
	dbName, sourceType string,
	rel metadata.RemoteRelationship,
) (relationships.RelationshipSpec, bool) {
	if rel.Definition.ToSource != nil {
		toSource := rel.Definition.ToSource
		if toSource.RelationshipType != metadata.RelationshipTypeObject &&
			toSource.RelationshipType != metadata.RelationshipTypeArray {
			return relationships.RelationshipSpec{}, false //nolint:exhaustruct
		}

		isArray := toSource.RelationshipType == metadata.RelationshipTypeArray

		return relationships.RelationshipSpec{
			SourceConnector:   dbName,
			SourceType:        sourceType,
			Name:              rel.Name,
			TargetConnector:   toSource.Source,
			TargetIdentifier:  toSource.Table.Schema + "." + toSource.Table.Name,
			IsArray:           isArray,
			WithSQLArgs:       true,
			RemoteFieldName:   "",
			BoundArguments:    nil,
			ObjectDescription: dbToDBObjectDescription(isArray),
		}, true
	}

	if rel.Definition.ToRemoteSchema != nil {
		toRS := rel.Definition.ToRemoteSchema
		path := metadata.ExtractRemoteFieldPath(toRS.RemoteField)

		if len(path) == 0 {
			return relationships.RelationshipSpec{}, false //nolint:exhaustruct
		}

		return relationships.RelationshipSpec{
			SourceConnector:   dbName,
			SourceType:        sourceType,
			Name:              rel.Name,
			TargetConnector:   toRS.RemoteSchema,
			TargetIdentifier:  path[0].FieldName,
			IsArray:           false,
			WithSQLArgs:       false,
			RemoteFieldName:   path[0].FieldName,
			BoundArguments:    path[0].Arguments,
			ObjectDescription: "",
		}, true
	}

	return relationships.RelationshipSpec{}, false //nolint:exhaustruct
}

// dbToDBObjectDescription returns the description text Hasura emits for a
// db→db object relationship. Array relationships use the canonical
// "An array relationship" string baked into the array-field builder, so this
// returns "" for arrays and lets that value apply.
func dbToDBObjectDescription(isArray bool) string {
	if isArray {
		return ""
	}

	return "An object relationship"
}

// rsRelationshipSpec translates a metadata RemoteSchemaRelationshipDef
// (rooted in a remote-schema type) into a single RelationshipSpec. Returns
// ok=false if the relationship has no ToSource definition (rs→rs is not
// supported and rs→db is currently the only outbound shape).
//
// Object descriptions are intentionally left empty: Hasura does not synthesise
// an "An object relationship" string for rs→db object relationships the way
// it does for db→db, and the goldens rely on that asymmetry.
func rsRelationshipSpec(
	rsName, typeName string,
	rel metadata.RemoteSchemaRelationshipDef,
) (relationships.RelationshipSpec, bool) {
	if rel.Definition.ToSource == nil {
		return relationships.RelationshipSpec{}, false //nolint:exhaustruct
	}

	toSource := rel.Definition.ToSource
	if toSource.RelationshipType != metadata.RelationshipTypeObject &&
		toSource.RelationshipType != metadata.RelationshipTypeArray {
		return relationships.RelationshipSpec{}, false //nolint:exhaustruct
	}

	return relationships.RelationshipSpec{
		SourceConnector:   rsName,
		SourceType:        typeName,
		Name:              rel.Name,
		TargetConnector:   toSource.Source,
		TargetIdentifier:  toSource.Table.Schema + "." + toSource.Table.Name,
		IsArray:           toSource.RelationshipType == metadata.RelationshipTypeArray,
		WithSQLArgs:       false,
		RemoteFieldName:   "",
		BoundArguments:    nil,
		ObjectDescription: "",
	}, true
}
