// Package composer collects schemas from multiple connector backends,
// injects remote-relationship fields, merges schemas per role, and validates
// the merged schemas.
package composer

import (
	"context"
	"fmt"
	"log/slog"
	"slices"

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
	providers map[string]SchemaProvider
	meta      *metadata.Metadata
}

// New creates a Composer over the given providers.
func New(providers map[string]SchemaProvider, meta *metadata.Metadata) *Composer {
	return &Composer{
		providers: providers,
		meta:      meta,
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
	// FieldToConnector maps each root field (query, mutation, subscription) to
	// the name of the connector that owns it; used by the controller to route
	// operations.
	FieldToConnector map[string]string
	// TypeToConnector maps each GraphQL type name to the name of the connector
	// that owns it; used by the controller to route operations.
	TypeToConnector map[string]string
}

// Compose collects schemas from all providers, adds remote relationship
// fields, merges them per role, and validates.
func (c *Composer) Compose(
	ctx context.Context,
	logger *slog.Logger,
) (Result, error) {
	if err := c.validateProviders(); err != nil {
		return Result{}, fmt.Errorf("validating connectors: %w", err)
	}

	roleSchemas, allRoles, err := c.collectSchemas()
	if err != nil {
		return Result{}, err
	}

	relationships.Inject(roleSchemas, c.relationshipSpecs(), c.typeNameResolvers())

	result := Result{
		SchemaDocs:       make(map[string]*ast.SchemaDocument),
		ValidatedSchemas: make(map[string]*ast.Schema),
		FieldToConnector: make(map[string]string),
		TypeToConnector:  make(map[string]string),
	}

	connectorNames := make([]string, 0, len(roleSchemas))
	for connName := range roleSchemas {
		connectorNames = append(connectorNames, connName)
	}

	// Merge in lexicographic connector-name order: when two connectors expose a
	// type with the same name, the alphabetically-first connector's definition
	// is the one [schemamerge.MergeConnectorSchema] keeps. Renaming a connector
	// can therefore silently change which schema wins a duplicate-type
	// collision, so the sort here is load-bearing and must stay stable.
	slices.Sort(connectorNames)

	for role := range allRoles {
		if err := composeRole(
			ctx, logger, role, connectorNames, roleSchemas, &result,
		); err != nil {
			return Result{}, err
		}
	}

	return result, nil
}

// composeRole merges every connector's schema for a single role and stores the
// validated result in result. connectorNames must already be sorted so the
// merge order is deterministic.
func composeRole(
	ctx context.Context,
	logger *slog.Logger,
	role string,
	connectorNames []string,
	roleSchemas map[string]map[string]*graph.Schema,
	result *Result,
) error {
	var combinedSchema graph.Schema

	for _, connName := range connectorNames {
		schemas := roleSchemas[connName]

		schema, exists := schemas[role]
		if !exists {
			continue
		}

		if err := schemamerge.MergeConnectorSchema(
			schema, &combinedSchema, connName, result.FieldToConnector, result.TypeToConnector,
		); err != nil {
			return fmt.Errorf(
				"failed to merge schema for role %q (incoming connector %q): %w",
				role, connName, err,
			)
		}

		logger.InfoContext(ctx, "merged schema for role",
			slog.String("role", role),
			slog.String("connector", connName),
		)
	}

	schemaDoc, validatedSchema, err := schemamerge.BuildValidatedSchema(&combinedSchema, role)
	if err != nil {
		return fmt.Errorf("role %s: %w", role, err)
	}

	result.SchemaDocs[role] = schemaDoc
	result.ValidatedSchemas[role] = validatedSchema

	logger.InfoContext(ctx, "validated schema for role", slog.String("role", role))

	return nil
}

func (c *Composer) validateProviders() error {
	for _, db := range c.meta.Databases {
		if _, ok := c.providers[db.Name]; !ok {
			return fmt.Errorf("%w for database %q", ErrMissingConnector, db.Name)
		}
	}

	for _, rs := range c.meta.RemoteSchemas {
		if _, ok := c.providers[rs.Name]; !ok {
			return fmt.Errorf("%w for remote schema %q", ErrMissingConnector, rs.Name)
		}
	}

	return nil
}

func (c *Composer) collectSchemas() (
	map[string]map[string]*graph.Schema, map[string]struct{}, error,
) {
	roleSchemas := make(map[string]map[string]*graph.Schema)
	allRoles := make(map[string]struct{})

	for connName, conn := range c.providers {
		schemas, err := conn.GetSchema()
		if err != nil {
			return nil, nil, fmt.Errorf(
				"failed to get schema from connector %s: %w", connName, err,
			)
		}

		roleSchemas[connName] = schemas

		for role := range schemas {
			allRoles[role] = struct{}{}
		}
	}

	return roleSchemas, allRoles, nil
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

// dbRelationshipSpec translates a metadata RemoteRelationship (rooted in a
// database table) into a single RelationshipSpec. Returns ok=false if the
// relationship has neither a ToSource nor a usable ToRemoteSchema definition.
func dbRelationshipSpec(
	dbName, sourceType string,
	rel metadata.RemoteRelationship,
) (relationships.RelationshipSpec, bool) {
	if rel.Definition.ToSource != nil {
		toSource := rel.Definition.ToSource
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
