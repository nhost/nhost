package relationships_test

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/relationships"
	"github.com/nhost/nhost/services/constellation/connector/relationships/mock"
	"github.com/nhost/nhost/services/constellation/graph"
	"go.uber.org/mock/gomock"
)

// newSchema is a small helper that builds a graph.Schema from a set of object
// types. Tests use it to hand-build the per-role schemas that Inject walks.
func newSchema(types ...*graph.ObjectType) *graph.Schema {
	queryType := "Query"

	return &graph.Schema{
		QueryType:        &queryType,
		MutationType:     nil,
		SubscriptionType: nil,
		Types:            types,
		Scalars:          nil,
		Enums:            nil,
		Interfaces:       nil,
		Unions:           nil,
		Inputs:           nil,
		Directives:       nil,
	}
}

func emptyObject(name string) *graph.ObjectType {
	return &graph.ObjectType{
		Name:        name,
		Description: "",
		Fields:      nil,
		Interfaces:  nil,
		Directives:  nil,
	}
}

// newResolver returns a MockTypeNameResolver that maps identifiers to type
// names via the supplied table. Unknown identifiers map to the empty string,
// matching the real connector's "unknown" return value.
func newResolver(t *testing.T, table map[string]string) *mock.MockTypeNameResolver {
	t.Helper()

	ctrl := gomock.NewController(t)
	m := mock.NewMockTypeNameResolver(ctrl)
	m.EXPECT().
		GetTypeName(gomock.Any()).
		DoAndReturn(func(id string) string { return table[id] }).
		AnyTimes()

	return m
}

// findField returns the named field on objectType, or nil if absent.
func findField(objectType *graph.ObjectType, name string) *graph.Field {
	for _, f := range objectType.Fields {
		if f.Name == name {
			return f
		}
	}

	return nil
}

// dbArraySpec builds the canonical db→db array RelationshipSpec used by
// several tests. WithSQLArgs is true (matching composer translation for
// to_source relationships). ObjectDescription is empty because array
// relationships use the hardcoded "An array relationship" string instead.
func dbArraySpec(
	sourceConnector, sourceType, name, targetConnector, targetIdentifier string,
) relationships.RelationshipSpec {
	return relationships.RelationshipSpec{
		SourceConnector:   sourceConnector,
		SourceType:        sourceType,
		Name:              name,
		TargetConnector:   targetConnector,
		TargetIdentifier:  targetIdentifier,
		IsArray:           true,
		WithSQLArgs:       true,
		RemoteFieldName:   "",
		BoundArguments:    nil,
		ObjectDescription: "",
	}
}

// dbObjectSpec builds a db→db object RelationshipSpec. ObjectDescription is
// "An object relationship" — composer assigns the same string for the same
// source/target combination.
func dbObjectSpec(
	sourceConnector, sourceType, name, targetConnector, targetIdentifier string,
) relationships.RelationshipSpec {
	return relationships.RelationshipSpec{
		SourceConnector:   sourceConnector,
		SourceType:        sourceType,
		Name:              name,
		TargetConnector:   targetConnector,
		TargetIdentifier:  targetIdentifier,
		IsArray:           false,
		WithSQLArgs:       true,
		RemoteFieldName:   "",
		BoundArguments:    nil,
		ObjectDescription: "An object relationship",
	}
}

// dbToRemoteSchemaSpec is the canonical "db.users → rs.userConfig" db→rs
// RelationshipSpec used by all db→rs tests. The remote root field name
// doubles as TargetIdentifier (matching what the composer extracts from
// metadata.RemoteFieldCall) and as RemoteFieldName. ObjectDescription is
// unused for db→rs (the description is sourced from the remote schema).
func dbToRemoteSchemaSpec(boundArguments map[string]string) relationships.RelationshipSpec {
	return relationships.RelationshipSpec{
		SourceConnector:   "db",
		SourceType:        "users",
		Name:              "config",
		TargetConnector:   "rs",
		TargetIdentifier:  "userConfig",
		IsArray:           false,
		WithSQLArgs:       false,
		RemoteFieldName:   "userConfig",
		BoundArguments:    boundArguments,
		ObjectDescription: "",
	}
}

// rsToDBArraySpec builds an rs→db array RelationshipSpec. WithSQLArgs is
// false (composer never sets it on the rs→db path); ObjectDescription is
// likewise empty even for the object variant — Hasura does not synthesise a
// description for rs→db object relationships.
func rsToDBArraySpec(
	sourceConnector, sourceType, name, targetConnector, targetIdentifier string,
) relationships.RelationshipSpec {
	spec := dbArraySpec(sourceConnector, sourceType, name, targetConnector, targetIdentifier)
	spec.WithSQLArgs = false

	return spec
}

func TestInject_DBToDBArrayWithSQLArgs(t *testing.T) {
	t.Parallel()

	sourceObj := emptyObject("users")
	targetObj := emptyObject("posts")
	aggregateObj := emptyObject("posts_aggregate")

	roleSchemas := map[string]map[string]*graph.Schema{
		"db": {
			"user": newSchema(sourceObj, targetObj, aggregateObj),
		},
	}

	resolver := newResolver(t, map[string]string{
		"public.users": "users",
		"public.posts": "posts",
	})

	specs := []relationships.RelationshipSpec{
		dbArraySpec("db", "users", "posts", "db", "public.posts"),
	}

	relationships.Inject(
		roleSchemas,
		specs,
		map[string]relationships.TypeNameResolver{"db": resolver},
	)

	field := findField(sourceObj, "posts")
	if field == nil {
		t.Fatal("expected array relationship field 'posts' on users")
	}

	if field.Description != "An array relationship" {
		t.Errorf("description = %q, want %q", field.Description, "An array relationship")
	}

	if !field.Type.NonNull || field.Type.Elem == nil ||
		!field.Type.Elem.NonNull || field.Type.Elem.NamedType != "posts" {
		t.Errorf("array field type = %#v, want [posts!]!", field.Type)
	}

	wantArgs := []string{"distinct_on", "limit", "offset", "order_by", "where"}
	if len(field.Arguments) != len(wantArgs) {
		t.Fatalf("array field args = %d, want %d", len(field.Arguments), len(wantArgs))
	}

	for i, name := range wantArgs {
		if field.Arguments[i].Name != name {
			t.Errorf("arg[%d] = %q, want %q", i, field.Arguments[i].Name, name)
		}
	}

	agg := findField(sourceObj, "posts_aggregate")
	if agg == nil {
		t.Fatal("expected aggregate sibling field 'posts_aggregate'")
	}

	if agg.Type.NamedType != "posts_aggregate" || !agg.Type.NonNull {
		t.Errorf("aggregate field type = %#v, want posts_aggregate!", agg.Type)
	}

	if len(agg.Arguments) != len(wantArgs) {
		t.Errorf("aggregate field args = %d, want %d", len(agg.Arguments), len(wantArgs))
	}
}

func TestInject_DBToDBObject(t *testing.T) {
	t.Parallel()

	sourceObj := emptyObject("posts")
	targetObj := emptyObject("users")

	roleSchemas := map[string]map[string]*graph.Schema{
		"db": {"user": newSchema(sourceObj, targetObj)},
	}

	resolver := newResolver(t, map[string]string{
		"public.posts": "posts",
		"public.users": "users",
	})

	specs := []relationships.RelationshipSpec{
		dbObjectSpec("db", "posts", "author", "db", "public.users"),
	}

	relationships.Inject(
		roleSchemas,
		specs,
		map[string]relationships.TypeNameResolver{"db": resolver},
	)

	field := findField(sourceObj, "author")
	if field == nil {
		t.Fatal("expected object relationship field 'author' on posts")
	}

	if field.Description != "An object relationship" {
		t.Errorf("description = %q, want %q", field.Description, "An object relationship")
	}

	if field.Type.Elem != nil || field.Type.NonNull || field.Type.NamedType != "users" {
		t.Errorf("object field type = %#v, want users", field.Type)
	}

	if field.Arguments != nil {
		t.Errorf("object field args = %v, want nil", field.Arguments)
	}

	if findField(sourceObj, "author_aggregate") != nil {
		t.Error("object relationship should not get an _aggregate sibling")
	}
}

func TestInject_DBToRemoteSchema_BoundArgsHidden(t *testing.T) {
	t.Parallel()

	sourceObj := emptyObject("users")

	// The remote schema exposes a field "userConfig" with two arguments:
	// "appID" (bound by the relationship) and "resolve" (user-facing).
	rsQuery := &graph.ObjectType{
		Name:        "Query",
		Description: "",
		Fields: []*graph.Field{{
			Name:        "userConfig",
			Description: "user-specific configuration",
			Type:        graph.NewNonNullType("Config"),
			Arguments: []*graph.Argument{
				{Name: "appID", Type: graph.NewNonNullType("String")},
				{Name: "resolve", Type: graph.NewNamedType("Boolean")},
			},
		}},
	}
	rsConfig := &graph.ObjectType{Name: "Config", Description: "the main config"}

	roleSchemas := map[string]map[string]*graph.Schema{
		"db": {"user": newSchema(sourceObj)},
		"rs": {"user": newSchema(rsQuery, rsConfig)},
	}

	resolver := newResolver(t, map[string]string{
		"public.users": "users",
		"userConfig":   "Config",
	})

	specs := []relationships.RelationshipSpec{
		dbToRemoteSchemaSpec(map[string]string{"appID": "$id"}),
	}

	relationships.Inject(roleSchemas, specs, map[string]relationships.TypeNameResolver{
		"db": resolver,
		"rs": resolver,
	})

	field := findField(sourceObj, "config")
	if field == nil {
		t.Fatal("expected remote-schema relationship field 'config' on users")
	}

	if field.Description != "user-specific configuration" {
		t.Errorf("description = %q, want field description", field.Description)
	}

	if field.Type.NamedType != "Config" || !field.Type.NonNull {
		t.Errorf("field type = %#v, want Config!", field.Type)
	}

	if len(field.Arguments) != 1 || field.Arguments[0].Name != "resolve" {
		t.Errorf("expected 'resolve' to remain as user-facing arg, got %v", field.Arguments)
	}
}

func TestInject_DBToRemoteSchema_DescriptionFallsBackToBaseType(t *testing.T) {
	t.Parallel()

	sourceObj := emptyObject("users")

	rsQuery := &graph.ObjectType{
		Name: "Query",
		Fields: []*graph.Field{{
			Name:        "userConfig",
			Description: "",
			Type:        graph.NewNonNullType("Config"),
		}},
	}
	rsConfig := &graph.ObjectType{
		Name:        "Config",
		Description: "main entrypoint to the configuration",
	}

	roleSchemas := map[string]map[string]*graph.Schema{
		"db": {"user": newSchema(sourceObj)},
		"rs": {"user": newSchema(rsQuery, rsConfig)},
	}

	resolver := newResolver(t, map[string]string{
		"public.users": "users",
		"userConfig":   "Config",
	})

	specs := []relationships.RelationshipSpec{
		dbToRemoteSchemaSpec(nil),
	}

	relationships.Inject(roleSchemas, specs, map[string]relationships.TypeNameResolver{
		"db": resolver,
		"rs": resolver,
	})

	field := findField(sourceObj, "config")
	if field == nil {
		t.Fatal("expected field 'config' to be injected")
	}

	if field.Description != "main entrypoint to the configuration" {
		t.Errorf("description = %q, want base-type description", field.Description)
	}
}

func TestInject_RemoteSchemaToDB(t *testing.T) {
	t.Parallel()

	rsTypeObj := emptyObject("User") // a remote-schema type that has a rel back to db
	dbTargetObj := emptyObject("orders")

	roleSchemas := map[string]map[string]*graph.Schema{
		"rs": {"user": newSchema(rsTypeObj)},
		"db": {"user": newSchema(dbTargetObj)},
	}

	resolver := newResolver(t, map[string]string{"public.orders": "orders"})

	specs := []relationships.RelationshipSpec{
		rsToDBArraySpec("rs", "User", "orders", "db", "public.orders"),
	}

	relationships.Inject(
		roleSchemas,
		specs,
		map[string]relationships.TypeNameResolver{"db": resolver},
	)

	field := findField(rsTypeObj, "orders")
	if field == nil {
		t.Fatal("expected 'orders' field on rs User type")
	}

	if field.Type.Elem == nil || field.Type.Elem.NamedType != "orders" {
		t.Errorf("field type = %#v, want [orders!]!", field.Type)
	}

	// rs→db should NOT inject SQL args: composer sets WithSQLArgs=false on the
	// remote-schema branch (the source connector cannot enforce SQL filters).
	if field.Arguments != nil {
		t.Errorf("rs→db relationship should not expose SQL args, got %v", field.Arguments)
	}
}

func TestInject_TargetMissingForRole(t *testing.T) {
	t.Parallel()

	// "admin" can see both source and target; "user" can only see source.
	sourceForAdmin := emptyObject("users")
	targetForAdmin := emptyObject("posts")
	sourceForUser := emptyObject("users")

	roleSchemas := map[string]map[string]*graph.Schema{
		"db": {
			"admin": newSchema(sourceForAdmin, targetForAdmin),
			"user":  newSchema(sourceForUser),
		},
	}

	resolver := newResolver(t, map[string]string{
		"public.users": "users",
		"public.posts": "posts",
	})

	specs := []relationships.RelationshipSpec{
		dbArraySpec("db", "users", "posts", "db", "public.posts"),
	}

	relationships.Inject(
		roleSchemas,
		specs,
		map[string]relationships.TypeNameResolver{"db": resolver},
	)

	if findField(sourceForAdmin, "posts") == nil {
		t.Error("admin role: expected 'posts' field on users")
	}

	if findField(sourceForUser, "posts") != nil {
		t.Error("user role: expected 'posts' to be omitted (target type not visible)")
	}
}

func TestInject_AggregateSiblingOmittedWhenTargetHasNoAggregate(t *testing.T) {
	t.Parallel()

	// Target type exists but <target>_aggregate does not, so the aggregate
	// sibling must be skipped.
	sourceObj := emptyObject("users")
	targetObj := emptyObject("posts")

	roleSchemas := map[string]map[string]*graph.Schema{
		"db": {"user": newSchema(sourceObj, targetObj)},
	}

	resolver := newResolver(t, map[string]string{
		"public.users": "users",
		"public.posts": "posts",
	})

	specs := []relationships.RelationshipSpec{
		dbArraySpec("db", "users", "posts", "db", "public.posts"),
	}

	relationships.Inject(
		roleSchemas,
		specs,
		map[string]relationships.TypeNameResolver{"db": resolver},
	)

	if findField(sourceObj, "posts") == nil {
		t.Error("expected array relationship field 'posts'")
	}

	if findField(sourceObj, "posts_aggregate") != nil {
		t.Error("aggregate sibling should be omitted when posts_aggregate type is absent")
	}
}

func TestInject_DuplicateRelationshipFieldSkipped(t *testing.T) {
	t.Parallel()

	// Pre-populate the source type with a field that has the same name as
	// the relationship; Inject must not overwrite or duplicate it.
	preexisting := &graph.Field{
		Name:        "posts",
		Description: "pre-existing",
		Type:        graph.NewNamedType("String"),
	}
	sourceObj := &graph.ObjectType{
		Name:   "users",
		Fields: []*graph.Field{preexisting},
	}
	targetObj := emptyObject("posts")

	roleSchemas := map[string]map[string]*graph.Schema{
		"db": {"user": newSchema(sourceObj, targetObj)},
	}

	resolver := newResolver(t, map[string]string{
		"public.users": "users",
		"public.posts": "posts",
	})

	specs := []relationships.RelationshipSpec{
		dbArraySpec("db", "users", "posts", "db", "public.posts"),
	}

	relationships.Inject(
		roleSchemas,
		specs,
		map[string]relationships.TypeNameResolver{"db": resolver},
	)

	if len(sourceObj.Fields) != 1 {
		t.Fatalf("expected 1 field, got %d", len(sourceObj.Fields))
	}

	if sourceObj.Fields[0] != preexisting {
		t.Error("pre-existing field should be left intact")
	}
}

func TestInject_UnknownTargetConnectorIdentifierFallback(t *testing.T) {
	t.Parallel()

	// rs→db where target connector is not registered: resolveTypeName
	// should fall back to the identifier ("public.orders"). The schema
	// uses that identifier as the type name so the field gets injected.
	rsTypeObj := emptyObject("User")
	dbTargetObj := emptyObject("public.orders")

	roleSchemas := map[string]map[string]*graph.Schema{
		"rs": {"user": newSchema(rsTypeObj)},
		"db": {"user": newSchema(dbTargetObj)},
	}

	specs := []relationships.RelationshipSpec{
		rsToDBArraySpec("rs", "User", "orders", "db", "public.orders"),
	}

	// "db" is intentionally NOT in the connectors map.
	relationships.Inject(roleSchemas, specs, map[string]relationships.TypeNameResolver{})

	if findField(rsTypeObj, "orders") == nil {
		t.Fatal(
			"expected 'orders' field even when target connector is unregistered (identifier fallback)",
		)
	}
}

func TestInject_SourceConnectorMissingFromRoleSchemas(t *testing.T) {
	t.Parallel()

	// Spec names a source connector that has no role schemas yet — Inject
	// must not panic and must leave roleSchemas unchanged.
	specs := []relationships.RelationshipSpec{
		dbArraySpec("db", "users", "posts", "db", "public.posts"),
	}

	roleSchemas := map[string]map[string]*graph.Schema{}

	relationships.Inject(
		roleSchemas,
		specs,
		map[string]relationships.TypeNameResolver{},
	)

	if len(roleSchemas) != 0 {
		t.Errorf("expected roleSchemas to remain empty, got %v", roleSchemas)
	}
}

func TestInject_RemoteSchemaFieldHiddenForRole(t *testing.T) {
	t.Parallel()

	// The rs role schema exposes the Config type but NOT the userConfig
	// field on Query — simulating per-role permissions on the remote schema.
	// Inject must skip the relationship cleanly (no partial injection).
	sourceObj := emptyObject("users")

	rsQueryNoField := &graph.ObjectType{Name: "Query", Fields: nil}
	rsConfig := &graph.ObjectType{Name: "Config", Description: "the main config"}

	roleSchemas := map[string]map[string]*graph.Schema{
		"db": {"user": newSchema(sourceObj)},
		"rs": {"user": newSchema(rsQueryNoField, rsConfig)},
	}

	resolver := newResolver(t, map[string]string{
		"public.users": "users",
		"userConfig":   "Config",
	})

	specs := []relationships.RelationshipSpec{
		dbToRemoteSchemaSpec(nil),
	}

	relationships.Inject(roleSchemas, specs, map[string]relationships.TypeNameResolver{
		"db": resolver,
		"rs": resolver,
	})

	if findField(sourceObj, "config") != nil {
		t.Error(
			"expected 'config' to be skipped when target type exists but the remote field is hidden for this role",
		)
	}
}

func TestInject_TargetConnectorMissingFromRoleSchemas(t *testing.T) {
	t.Parallel()

	// Spec references a target connector that has no entry in roleSchemas at
	// all — covers the "connector not in roleSchemas" branch of
	// targetTypeExistsInSchemas. The relationship must be skipped.
	sourceObj := emptyObject("users")

	roleSchemas := map[string]map[string]*graph.Schema{
		"db": {"user": newSchema(sourceObj)},
		// "other-db" deliberately absent.
	}

	resolver := newResolver(t, map[string]string{
		"public.users":  "users",
		"public.orders": "orders",
	})

	specs := []relationships.RelationshipSpec{
		dbArraySpec("db", "users", "orders", "other-db", "public.orders"),
	}

	relationships.Inject(roleSchemas, specs, map[string]relationships.TypeNameResolver{
		"db":       resolver,
		"other-db": resolver,
	})

	if findField(sourceObj, "orders") != nil {
		t.Error("expected 'orders' to be skipped when target connector has no role schemas")
	}
}

func TestInject_TargetRoleMissingFromConnectorSchemas(t *testing.T) {
	t.Parallel()

	// The target connector is registered in roleSchemas but lacks the
	// specific role — covers the "role missing from that connector's
	// schemas" branch of targetTypeExistsInSchemas.
	sourceObj := emptyObject("users")
	targetObj := emptyObject("orders")

	roleSchemas := map[string]map[string]*graph.Schema{
		"db":       {"user": newSchema(sourceObj)},
		"other-db": {"admin": newSchema(targetObj)}, // no "user" role
	}

	resolver := newResolver(t, map[string]string{
		"public.users":  "users",
		"public.orders": "orders",
	})

	specs := []relationships.RelationshipSpec{
		dbArraySpec("db", "users", "orders", "other-db", "public.orders"),
	}

	relationships.Inject(roleSchemas, specs, map[string]relationships.TypeNameResolver{
		"db":       resolver,
		"other-db": resolver,
	})

	if findField(sourceObj, "orders") != nil {
		t.Error("expected 'orders' to be skipped when target connector lacks the source role")
	}
}

// Below: parallel tests for the db→rs path. The db→db twins live above, and
// the rs branch needs to be held to the same contract per review M5.

func TestInject_DBToRemoteSchema_SourceConnectorMissingFromRoleSchemas(t *testing.T) {
	t.Parallel()

	// Spec names a source connector "db" that has no role schemas —
	// addRemoteSchemaRelFieldToSchemas must skip cleanly.
	resolver := newResolver(t, map[string]string{
		"public.users": "users",
		"userConfig":   "Config",
	})

	// "rs" has schemas; "db" intentionally does not.
	rsQuery := &graph.ObjectType{
		Name: "Query",
		Fields: []*graph.Field{{
			Name:        "userConfig",
			Description: "user config",
			Type:        graph.NewNonNullType("Config"),
		}},
	}
	rsConfig := &graph.ObjectType{Name: "Config"}
	roleSchemas := map[string]map[string]*graph.Schema{
		"rs": {"user": newSchema(rsQuery, rsConfig)},
	}

	specs := []relationships.RelationshipSpec{
		dbToRemoteSchemaSpec(nil),
	}

	relationships.Inject(roleSchemas, specs, map[string]relationships.TypeNameResolver{
		"db": resolver,
		"rs": resolver,
	})

	// Nothing to assert beyond non-panic; "db" stays absent.
	if _, present := roleSchemas["db"]; present {
		t.Errorf("expected db connector to remain absent from roleSchemas, got %v", roleSchemas)
	}
}

func TestInject_DBToRemoteSchema_TargetTypeHiddenForRole(t *testing.T) {
	t.Parallel()

	// "admin" sees the Config type on the remote schema; "user" doesn't —
	// targetTypeExistsInSchemas returns false for the "user" role and the
	// relationship is omitted there. We assert "admin" gets the field but
	// "user" does not.
	sourceForAdmin := emptyObject("users")
	sourceForUser := emptyObject("users")

	rsQuery := &graph.ObjectType{
		Name: "Query",
		Fields: []*graph.Field{{
			Name:        "userConfig",
			Description: "user config",
			Type:        graph.NewNonNullType("Config"),
		}},
	}

	roleSchemas := map[string]map[string]*graph.Schema{
		"db": {
			"admin": newSchema(sourceForAdmin),
			"user":  newSchema(sourceForUser),
		},
		"rs": {
			// "admin" can see Config; "user" cannot.
			"admin": newSchema(rsQuery, &graph.ObjectType{Name: "Config"}),
			"user":  newSchema(rsQuery),
		},
	}

	resolver := newResolver(t, map[string]string{
		"public.users": "users",
		"userConfig":   "Config",
	})

	specs := []relationships.RelationshipSpec{
		dbToRemoteSchemaSpec(nil),
	}

	relationships.Inject(roleSchemas, specs, map[string]relationships.TypeNameResolver{
		"db": resolver,
		"rs": resolver,
	})

	if findField(sourceForAdmin, "config") == nil {
		t.Error("admin role: expected 'config' field on users")
	}

	if findField(sourceForUser, "config") != nil {
		t.Error("user role: expected 'config' to be omitted (target type hidden)")
	}
}

func TestInject_DBToRemoteSchema_SourceObjectTypeMissingForRole(t *testing.T) {
	t.Parallel()

	// "admin" has the "users" object type on the source schema; "user" has
	// the connector role but the "users" type is absent (e.g., permission
	// metadata produced an empty schema). findObjectType returns nil and
	// addRemoteSchemaRelFieldToSchemas skips that role.
	sourceForAdmin := emptyObject("users")

	rsQuery := &graph.ObjectType{
		Name: "Query",
		Fields: []*graph.Field{{
			Name:        "userConfig",
			Description: "user config",
			Type:        graph.NewNonNullType("Config"),
		}},
	}
	rsConfig := &graph.ObjectType{Name: "Config"}

	roleSchemas := map[string]map[string]*graph.Schema{
		"db": {
			"admin": newSchema(sourceForAdmin),
			"user":  newSchema(), // "users" type missing for this role
		},
		"rs": {
			"admin": newSchema(rsQuery, rsConfig),
			"user":  newSchema(rsQuery, rsConfig),
		},
	}

	resolver := newResolver(t, map[string]string{
		"public.users": "users",
		"userConfig":   "Config",
	})

	specs := []relationships.RelationshipSpec{
		dbToRemoteSchemaSpec(nil),
	}

	relationships.Inject(roleSchemas, specs, map[string]relationships.TypeNameResolver{
		"db": resolver,
		"rs": resolver,
	})

	if findField(sourceForAdmin, "config") == nil {
		t.Error("admin role: expected 'config' field on users")
	}

	// "user" had no "users" type to attach the field to; nothing should be
	// injected. Confirm the user role's source schema still has no object
	// types — Inject must not synthesise one.
	userSchema := roleSchemas["db"]["user"]
	for _, typ := range userSchema.Types {
		if typ.Name == "users" && len(typ.Fields) > 0 {
			t.Errorf(
				"user role: expected no 'users' type to be created with fields, got %v",
				typ,
			)
		}
	}
}

func TestInject_DBToRemoteSchema_DuplicateFieldSkipped(t *testing.T) {
	t.Parallel()

	// Pre-populate the source "users" object type with a "config" field of
	// a different shape; Inject must leave it alone and not double-add.
	preexisting := &graph.Field{
		Name:        "config",
		Description: "pre-existing",
		Type:        graph.NewNamedType("String"),
	}
	sourceObj := &graph.ObjectType{
		Name:   "users",
		Fields: []*graph.Field{preexisting},
	}

	rsQuery := &graph.ObjectType{
		Name: "Query",
		Fields: []*graph.Field{{
			Name:        "userConfig",
			Description: "the remote user config",
			Type:        graph.NewNonNullType("Config"),
		}},
	}
	rsConfig := &graph.ObjectType{Name: "Config"}

	roleSchemas := map[string]map[string]*graph.Schema{
		"db": {"user": newSchema(sourceObj)},
		"rs": {"user": newSchema(rsQuery, rsConfig)},
	}

	resolver := newResolver(t, map[string]string{
		"public.users": "users",
		"userConfig":   "Config",
	})

	specs := []relationships.RelationshipSpec{
		dbToRemoteSchemaSpec(nil),
	}

	relationships.Inject(roleSchemas, specs, map[string]relationships.TypeNameResolver{
		"db": resolver,
		"rs": resolver,
	})

	if len(sourceObj.Fields) != 1 {
		t.Fatalf("expected 1 field after Inject (no duplicate), got %d", len(sourceObj.Fields))
	}

	if sourceObj.Fields[0] != preexisting {
		t.Error("pre-existing field should be left intact, not overwritten")
	}
}

func TestInject_DBToRemoteSchema_DegenerateTypeDescriptionFallsBackToEmpty(t *testing.T) {
	t.Parallel()

	// A remote field whose type has no resolvable base name (e.g., a list of
	// an unnamed type). baseTypeName returns "", findTypeDescription returns
	// "" — the field is still injected, just with an empty description.
	sourceObj := emptyObject("users")

	// degenerate type: list whose element has an empty NamedType.
	degenerate := graph.NewListType(graph.NewNamedType(""))

	rsQuery := &graph.ObjectType{
		Name: "Query",
		Fields: []*graph.Field{{
			Name:        "userConfig",
			Description: "",
			Type:        degenerate,
		}},
	}

	roleSchemas := map[string]map[string]*graph.Schema{
		"db": {"user": newSchema(sourceObj)},
		// no rsConfig type — and even if there were, baseTypeName returns "".
		"rs": {"user": newSchema(rsQuery, &graph.ObjectType{Name: "Config"})},
	}

	resolver := newResolver(t, map[string]string{
		"public.users": "users",
		"userConfig":   "Config",
	})

	specs := []relationships.RelationshipSpec{
		dbToRemoteSchemaSpec(nil),
	}

	relationships.Inject(roleSchemas, specs, map[string]relationships.TypeNameResolver{
		"db": resolver,
		"rs": resolver,
	})

	field := findField(sourceObj, "config")
	if field == nil {
		t.Fatal("expected 'config' field to be injected even with degenerate base type")
	}

	if field.Description != "" {
		t.Errorf(
			"description = %q, want empty (base-type lookup short-circuits)",
			field.Description,
		)
	}
}
