// Package relationships injects remote-relationship fields into already-built
// per-role connector schemas. It walks a list of [RelationshipSpec] values —
// the narrow projection of metadata the algorithm actually needs — resolves
// target type names per connector, and grafts the resulting fields onto each
// role schema where source and target are both accessible.
//
// Inject is called by connector/composer.Composer.Compose after per-connector
// schemas have been collected and before they are merged into the per-role
// combined schema. The boundary this package sits on is therefore between
// schema collection and schema merging in the composer pipeline. The composer
// translates *metadata.Metadata into a []RelationshipSpec before calling
// Inject; the spec is the contract this package operates on, not the raw
// metadata tree.
//
// [TypeNameResolver] resolves types, while SQL targets additionally implement
// [SelectableJoinColumnResolver] for computed-key target column authorization.
// The Connector interface in connector/connector.go satisfies TypeNameResolver via GetTypeName, and the
// connector→GraphQL type-name mapping is exercised end-to-end by the
// integration tests in integration/query_remote_relationships_test.go (which
// wire real SQL and remote-schema connectors and assert that injected
// relationship fields resolve correctly). The mocked tests in this package
// cover all logic branches against a one-method stub and rely on those
// integration tests to pin the contract against the real connectors.
package relationships

import (
	"github.com/nhost/nhost/services/constellation/graph"
)

// TypeNameResolver is the minimal connector capability required by Inject.
// It resolves a connector-specific identifier (e.g., "schema.table") to a
// GraphQL type name. The Connector interface in the parent package satisfies
// this implicitly; the sole external consumer is connector/composer, which
// builds a TypeNameResolver map from its registered connectors before calling
// Inject.
//
//go:generate mockgen -package mock -destination mock/type_name_resolver.go . TypeNameResolver
type TypeNameResolver interface {
	GetTypeName(identifier string) string
}

// SelectableJoinColumnResolver proves that a target name is an actual SQL
// column exposed to the role, rather than merely a field on its GraphQL type.
// Non-SQL connectors do not satisfy this capability and fail closed.
//
//go:generate mockgen -package mock -destination mock/selectable_join_column_resolver.go . SelectableJoinColumnResolver
type SelectableJoinColumnResolver interface {
	HasSelectableJoinColumn(identifier, role, name string) bool
}

// RelationshipSpec is the narrow projection of metadata that Inject needs to
// graft a single remote-relationship field onto schemas. The composer
// translates *metadata.Metadata into a []RelationshipSpec before calling
// Inject; the spec carries no metadata-specific shape or magic strings.
//
// For a db→rs relationship, TargetIdentifier resolves to the remote schema's
// root field type name, RemoteFieldName names the remote root field, and
// BoundArguments lists which of that field's arguments are bound by the
// relationship (and therefore hidden from the user-facing field).
//
// For a db→db or rs→db relationship, TargetIdentifier is the source-local
// table identifier (e.g., "public.users") that the target connector resolves
// to a GraphQL type name via GetTypeName; RemoteFieldName and BoundArguments
// are zero-valued.
type RelationshipSpec struct {
	// SourceConnector is the name of the connector that owns the source type.
	SourceConnector string
	// SourceType is the GraphQL type name on the source connector to which the
	// relationship field is grafted.
	SourceType string
	// ComputedKeys identifies scalar computed LHS fields, with their explicit
	// select grants. Nil means this relationship uses only physical columns.
	ComputedKeys map[string]map[string]bool
	// TargetJoinFields are the target columns used by a computed-key to_source
	// join. They must be selectable on the target for the current role.
	TargetJoinFields []string
	// Name is the GraphQL field name to graft onto SourceType.
	Name string
	// TargetConnector is the name of the connector that owns the target type.
	TargetConnector string
	// TargetIdentifier is the connector-local identifier of the target
	// (e.g. "public.posts" for SQL, or the remote root field name for a
	// db→rs relationship). It is fed to the target connector's GetTypeName
	// to resolve the GraphQL type name.
	TargetIdentifier string
	// IsArray is true for one-to-many / many-to-many relationships and false
	// for object (one-to-one / many-to-one) relationships.
	IsArray bool
	// WithSQLArgs requests the SQL filtering arguments (distinct_on, limit,
	// offset, order_by, where) on the injected field. Only meaningful for
	// db→db relationships where the source connector can enforce SQL filters
	// on the target side.
	WithSQLArgs bool
	// RemoteFieldName, when non-empty, marks this spec as a db→rs
	// relationship. It names the root-Query field on the remote schema whose
	// type and unmapped arguments are imported onto the injected field.
	RemoteFieldName string
	// BoundArguments lists the remote field arguments bound by the
	// relationship (e.g. `appID: $id`). Only those arguments are stripped
	// from the user-facing field; unbound ones (e.g. `resolve: Boolean`)
	// remain. Only meaningful when RemoteFieldName is non-empty.
	BoundArguments map[string]string
	// ObjectDescription is the description text the injected field carries
	// when IsArray is false. Array relationships ignore this field — they
	// use the canonical "An array relationship" baked into the array-field
	// builder. The composer sets ObjectDescription to "An object relationship"
	// for db→db object relationships and "" for rs→db object relationships
	// (matching Hasura's per-direction defaults). For db→rs the description
	// is sourced from the remote schema, so this field is unused.
	ObjectDescription string
}

// Inject adds remote-relationship fields to every role schema in roleSchemas
// where both source and target types are accessible. roleSchemas is keyed by
// connector name, then role; connectors is keyed by connector name and used
// only to resolve target type names; specs is the list of relationships to
// inject (typically produced by connector/composer from *metadata.Metadata).
//
// Inject mutates roleSchemas in place and is not safe for concurrent use;
// callers must serialise calls or copy the input.
func Inject(
	roleSchemas map[string]map[string]*graph.Schema,
	specs []RelationshipSpec,
	connectors map[string]TypeNameResolver,
) {
	for _, spec := range specs {
		resolved := spec
		resolved.TargetIdentifier = resolveTypeName(
			connectors, spec.TargetConnector, spec.TargetIdentifier,
			spec.RemoteFieldName == "",
		)

		if resolved.RemoteFieldName != "" {
			addRemoteSchemaRelFieldToSchemas(roleSchemas, resolved)
		} else {
			addRelFieldToSchemas(
				roleSchemas,
				resolved,
				spec.TargetIdentifier,
				connectors[spec.TargetConnector],
			)
		}
	}
}

// resolveTypeName uses published database target types for to_source joins.
// Remote-schema joins retain their native target type identity; type-renamed
// remote-schema targets are not an established combination.
func resolveTypeName(
	connectors map[string]TypeNameResolver,
	connectorName, identifier string, toSource bool,
) string {
	connector := connectors[connectorName]
	if connector == nil {
		return ""
	}

	if toSource {
		return SchemaTypeName(connector, identifier)
	}

	return connector.GetTypeName(identifier)
}

// addRelFieldToSchemas adds a db→db (or rs→db) relationship field to all role
// schemas where both source and target types are accessible.
func addRelFieldToSchemas(
	roleSchemas map[string]map[string]*graph.Schema,
	spec RelationshipSpec,
	targetIdentifier string,
	connector TypeNameResolver,
) {
	schemas, ok := roleSchemas[spec.SourceConnector]
	if !ok {
		return
	}

	targetType := spec.TargetIdentifier

	types := relationshipTargetTypes(connector, targetIdentifier)
	if spec.WithSQLArgs &&
		(types.selectColumn == "" || types.orderBy == "" || types.boolExp == "") {
		return // A renamed input type was not produced; do not publish a broken field.
	}

	for role, schema := range schemas {
		if !targetTypeExistsInSchemas(roleSchemas, spec.TargetConnector, targetType, role) {
			continue
		}

		objectType := findObjectType(schema, spec.SourceType)
		if objectType == nil || !computedKeysAvailable(objectType, spec, role) ||
			!targetJoinFieldsAvailable(
				roleSchemas[spec.TargetConnector][role],
				targetType,
				spec.TargetJoinFields,
				targetIdentifier,
				role,
				connector,
			) {
			continue
		}

		if fieldExists(objectType, spec.Name) {
			continue
		}

		if spec.IsArray {
			addArrayRelField(objectType, spec.Name, targetType, spec.WithSQLArgs, types)

			// Expose <rel>_aggregate alongside the array field when the target
			// connector publishes the matching <target>_aggregate type for
			// this role. SQL connectors do; remote-schema connectors don't.
			aggFieldName := spec.Name + "_aggregate"

			if !fieldExists(objectType, aggFieldName) &&
				targetTypeExistsInSchemas(
					roleSchemas,
					spec.TargetConnector,
					types.aggregate,
					role,
				) {
				addArrayAggregateRelField(objectType, aggFieldName, spec.WithSQLArgs, types)
			}
		} else {
			objectType.Fields = append(objectType.Fields, &graph.Field{
				Name:        spec.Name,
				Description: spec.ObjectDescription,
				Type:        graph.NewNamedType(targetType),
				Arguments:   nil,
				Directives:  nil,
			})
		}
	}
}

// addArrayAggregateRelField adds an aggregate sibling with the target's
// actual type name (a type suffix belongs after _aggregate, not before it).
func addArrayAggregateRelField(
	objectType *graph.ObjectType, name string, withSQLArgs bool, types relationshipTypes,
) {
	field := &graph.Field{
		Name:        name,
		Description: "An aggregate over an array relationship",
		Type:        graph.NewNonNullType(types.aggregate),
		Arguments:   nil,
		Directives:  nil,
	}

	if withSQLArgs {
		field.Arguments = sqlListArgs(types)
	}

	objectType.Fields = append(objectType.Fields, field)
}

// sqlListArgs uses the target's published input types, not suffixes applied
// to its already-customized object name.
func sqlListArgs(types relationshipTypes) []*graph.Argument {
	return []*graph.Argument{
		{
			Name:        "distinct_on",
			Description: "distinct select on columns",
			Type:        graph.NewListType(graph.NewNonNullType(types.selectColumn)),
		},
		{
			Name:        "limit",
			Description: "limit the number of rows returned",
			Type:        graph.NewNamedType("Int"),
		},
		{
			Name:        "offset",
			Description: "skip the first n rows. Use only with order_by",
			Type:        graph.NewNamedType("Int"),
		},
		{
			Name:        "order_by",
			Description: "sort the rows by one or more columns",
			Type:        graph.NewListType(graph.NewNonNullType(types.orderBy)),
		},
		{
			Name:        "where",
			Description: "filter the rows returned",
			Type:        graph.NewNamedType(types.boolExp),
		},
	}
}

// addRemoteSchemaRelFieldToSchemas adds a db→rs relationship field to every
// role schema where both the source object type and the remote field are
// accessible. The field's GraphQL type and description are imported from the
// remote schema's matching root field, and arguments listed in
// spec.BoundArguments (e.g., appID: $id) are stripped so only the unbound,
// user-facing arguments (e.g., resolve: Boolean!) remain — matching Hasura's
// behaviour.
func addRemoteSchemaRelFieldToSchemas(
	roleSchemas map[string]map[string]*graph.Schema,
	spec RelationshipSpec,
) {
	schemas, ok := roleSchemas[spec.SourceConnector]
	if !ok {
		return
	}

	targetSchemas := roleSchemas[spec.TargetConnector]

	for role, schema := range schemas {
		if !targetTypeExistsInSchemas(
			roleSchemas, spec.TargetConnector, spec.TargetIdentifier, role,
		) {
			continue
		}

		objectType := findObjectType(schema, spec.SourceType)
		if objectType == nil {
			continue
		}

		if !computedKeysAvailable(objectType, spec, role) || fieldExists(objectType, spec.Name) {
			continue
		}

		remoteField := findFieldOnQueryType(targetSchemas[role], spec.RemoteFieldName)
		if remoteField == nil {
			continue // matches Hasura: per-role permissions can hide the remote field.
		}

		fieldDescription := remoteField.Description
		if fieldDescription == "" {
			// Fall back to the return type's description (matches Hasura).
			fieldDescription = findTypeDescription(
				targetSchemas[role], remoteField.Type,
			)
		}

		field := &graph.Field{
			Name:        spec.Name,
			Description: fieldDescription,
			Type:        remoteField.Type,
			Arguments: findUnmappedFieldArguments(
				targetSchemas[role],
				spec.RemoteFieldName,
				spec.BoundArguments,
			),
			Directives: nil,
		}

		objectType.Fields = append(objectType.Fields, field)
	}
}

// computedKeysAvailable requires an explicit grant and an executable scalar
// selection in this role's source schema. In particular, a stale definition,
// argument-bearing function or table-valued function cannot supply a phantom.
func computedKeysAvailable(source *graph.ObjectType, spec RelationshipSpec, role string) bool {
	for key, grants := range spec.ComputedKeys {
		if role != "admin" && !grants[role] {
			return false
		}

		var selected *graph.Field
		for _, field := range source.Fields {
			if field.Name == key {
				selected = field
				break
			}
		}

		if selected == nil || selected.Type == nil || selected.Type.NamedType == "" {
			return false
		}

		for _, arg := range selected.Arguments {
			if arg.Name == "args" {
				return false
			}
		}

		// JSON/JSONB computed keys are excluded for every remote-schema
		// destination, regardless of the remote argument's declared type.
		if spec.RemoteFieldName != "" && (selected.Type.NamedType == "jsonb" ||
			selected.Type.NamedType == "json") {
			return false
		}
	}

	return true
}

func targetJoinFieldsAvailable(
	schema *graph.Schema, typeName string, fields []string,
	identifier, role string, connector TypeNameResolver,
) bool {
	if len(fields) == 0 {
		return true
	}

	target := findObjectType(schema, typeName)

	columns, ok := connector.(SelectableJoinColumnResolver)
	if target == nil || !ok {
		return false
	}

	for _, name := range fields {
		if !fieldExists(target, name) || !columns.HasSelectableJoinColumn(identifier, role, name) {
			return false
		}
	}

	return true
}

// findFieldOnQueryType locates a field by name on the Query root type of the given schema.
func findFieldOnQueryType(schema *graph.Schema, fieldName string) *graph.Field {
	if schema == nil {
		return nil
	}

	queryTypeName := "Query"
	if schema.QueryType != nil {
		queryTypeName = *schema.QueryType
	}

	for _, t := range schema.Types {
		if t.Name != queryTypeName {
			continue
		}

		for _, f := range t.Fields {
			if f.Name == fieldName {
				return f
			}
		}
	}

	return nil
}

// findUnmappedFieldArguments looks up a field by name on the Query type of the given schema
// and returns any arguments that are not in the boundArguments map. These are the arguments
// that the user must provide when querying the remote relationship field.
func findUnmappedFieldArguments(
	schema *graph.Schema,
	fieldName string,
	boundArguments map[string]string,
) []*graph.Argument {
	field := findFieldOnQueryType(schema, fieldName)
	if field == nil {
		return nil
	}

	var unmapped []*graph.Argument
	for _, arg := range field.Arguments {
		if _, isBound := boundArguments[arg.Name]; !isBound {
			unmapped = append(unmapped, arg)
		}
	}

	return unmapped
}

// findTypeDescription returns the description of the base type referenced by a field's type.
// For example, if a field returns ConfigConfig, this returns ConfigConfig's type description.
func findTypeDescription(schema *graph.Schema, fieldType *graph.Type) string {
	if schema == nil || fieldType == nil {
		return ""
	}

	typeName := baseTypeName(fieldType)
	if typeName == "" {
		return ""
	}

	for _, t := range schema.Types {
		if t.Name == typeName {
			return t.Description
		}
	}

	return ""
}

// baseTypeName extracts the leaf named type from a potentially nested graph.Type.
func baseTypeName(t *graph.Type) string {
	if t == nil {
		return ""
	}

	if t.Elem != nil {
		return baseTypeName(t.Elem)
	}

	return t.NamedType
}

// targetTypeExistsInSchemas checks if a type exists in a connector's schema for a given role.
func targetTypeExistsInSchemas(
	roleSchemas map[string]map[string]*graph.Schema,
	connectorName, typeName, role string,
) bool {
	schemas, ok := roleSchemas[connectorName]
	if !ok {
		return false
	}

	schema, ok := schemas[role]
	if !ok {
		return false
	}

	return findObjectType(schema, typeName) != nil
}

func findObjectType(schema *graph.Schema, name string) *graph.ObjectType {
	for _, t := range schema.Types {
		if t.Name == name {
			return t
		}
	}

	return nil
}

// addArrayRelField adds an array relationship field to an ObjectType.
// If withSQLArgs is true, it adds SQL-specific arguments (distinct_on, limit, offset, order_by, where).
func addArrayRelField(
	objectType *graph.ObjectType, name, typeName string, withSQLArgs bool, types relationshipTypes,
) {
	field := &graph.Field{
		Name:        name,
		Description: "An array relationship",
		Type:        graph.NewNonNullListType(graph.NewNonNullType(typeName)),
		Arguments:   nil,
		Directives:  nil,
	}

	if withSQLArgs {
		field.Arguments = sqlListArgs(types)
	}

	objectType.Fields = append(objectType.Fields, field)
}

// fieldExists prevents duplicate relationship fields from being injected.
func fieldExists(objectType *graph.ObjectType, name string) bool {
	for _, f := range objectType.Fields {
		if f.Name == name {
			return true
		}
	}

	return false
}
