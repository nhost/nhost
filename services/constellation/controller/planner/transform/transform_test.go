package transform_test

import (
	"maps"
	"slices"
	"testing"

	"github.com/nhost/nhost/services/constellation/controller/planner/transform"
	"github.com/nhost/nhost/services/constellation/internal/jsonpath"
	"github.com/vektah/gqlparser/v2/ast"
)

func makeSchema(
	queryFields ast.FieldList,
	types map[string]*ast.Definition,
) *ast.Schema {
	queryRoot := &ast.Definition{
		Kind:   ast.Object,
		Name:   "query_root",
		Fields: queryFields,
	}

	allTypes := make(map[string]*ast.Definition, len(types)+1)
	allTypes["query_root"] = queryRoot

	maps.Copy(allTypes, types)

	return &ast.Schema{
		Types: allTypes,
		Query: queryRoot,
	}
}

func fieldNames(ss ast.SelectionSet) []string {
	var names []string
	for _, sel := range ss {
		if f, ok := sel.(*ast.Field); ok {
			name := f.Name
			if f.Alias != "" {
				name = f.Alias
			}

			names = append(names, name)
		}
	}

	return names
}

func containsString(slice []string, s string) bool {
	return slices.Contains(slice, s)
}

func typeOwners(owners map[string]string) map[string][]string {
	out := make(map[string][]string, len(owners))
	for typeName, connectorName := range owners {
		out[typeName] = []string{connectorName}
	}

	return out
}

func usersWithDepartmentSchema() *ast.Schema {
	return makeSchema(
		ast.FieldList{
			{
				Name: "users",
				Type: ast.ListType(ast.NamedType("users", nil), nil),
			},
		},
		map[string]*ast.Definition{
			"users": {
				Kind: ast.Object,
				Name: "users",
				Fields: ast.FieldList{
					{
						Name: "id",
						Type: ast.NamedType("Int", nil),
					},
					{
						Name: "name",
						Type: ast.NamedType("String", nil),
					},
					{
						Name: "email",
						Type: ast.NamedType("String", nil),
					},
					{
						Name: "department",
						Type: ast.NamedType("departments", nil),
					},
				},
			},
			"departments": {
				Kind: ast.Object,
				Name: "departments",
				Fields: ast.FieldList{
					{Name: "id", Type: ast.NamedType("Int", nil)},
					{Name: "name", Type: ast.NamedType("String", nil)},
				},
			},
		},
	)
}

// usersWithDepartmentSchemaAllRoots builds a schema with Query, Mutation, and
// Subscription root types. The mutation `insert_users` returns
// `users_mutation_response { affected_rows, returning: [users!]! }` so the
// transformer must traverse into the returning selection to strip the remote
// `department` relationship. The subscription `users` field returns `[users]`
// directly. Used to exercise [Transformer.Transform] against `ast.Mutation`
// and `ast.Subscription` operations.
func usersWithDepartmentSchemaAllRoots() *ast.Schema {
	usersType := &ast.Definition{
		Kind: ast.Object,
		Name: "users",
		Fields: ast.FieldList{
			{Name: "id", Type: ast.NamedType("Int", nil)},
			{Name: "name", Type: ast.NamedType("String", nil)},
			{Name: "email", Type: ast.NamedType("String", nil)},
			{Name: "department", Type: ast.NamedType("departments", nil)},
		},
	}

	departmentsType := &ast.Definition{
		Kind: ast.Object,
		Name: "departments",
		Fields: ast.FieldList{
			{Name: "id", Type: ast.NamedType("Int", nil)},
			{Name: "name", Type: ast.NamedType("String", nil)},
		},
	}

	mutationResponseType := &ast.Definition{
		Kind: ast.Object,
		Name: "users_mutation_response",
		Fields: ast.FieldList{
			{Name: "affected_rows", Type: ast.NamedType("Int", nil)},
			{
				Name: "returning",
				Type: ast.ListType(ast.NamedType("users", nil), nil),
			},
		},
	}

	queryRoot := &ast.Definition{
		Kind: ast.Object,
		Name: "query_root",
		Fields: ast.FieldList{
			{Name: "users", Type: ast.ListType(ast.NamedType("users", nil), nil)},
		},
	}

	mutationRoot := &ast.Definition{
		Kind: ast.Object,
		Name: "mutation_root",
		Fields: ast.FieldList{
			{
				Name: "insert_users",
				Type: ast.NamedType("users_mutation_response", nil),
			},
		},
	}

	subscriptionRoot := &ast.Definition{
		Kind: ast.Object,
		Name: "subscription_root",
		Fields: ast.FieldList{
			{Name: "users", Type: ast.ListType(ast.NamedType("users", nil), nil)},
		},
	}

	return &ast.Schema{
		Types: map[string]*ast.Definition{
			"query_root":              queryRoot,
			"mutation_root":           mutationRoot,
			"subscription_root":       subscriptionRoot,
			"users":                   usersType,
			"departments":             departmentsType,
			"users_mutation_response": mutationResponseType,
		},
		Query:        queryRoot,
		Mutation:     mutationRoot,
		Subscription: subscriptionRoot,
	}
}

func departmentRemoteRel() transform.RemoteRelationship {
	return transform.RemoteRelationship{
		SourceType: "users",
		Name:       "department",
	}
}

// TestTransform runs Transformer.Transform across the supported
// branches. Per-case asserts are inline (rather than extracted into
// callbacks) for readability; the nolint covers the resulting complexity.
//
//nolint:gocognit,gocyclo,cyclop,maintidx // table-driven; assertions inlined per case
func TestTransform(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name            string
		schema          *ast.Schema
		remotes         []transform.RemoteRelationship
		typeToConnector map[string][]string
		op              *ast.OperationDefinition
		fragments       ast.FragmentDefinitionList
		check           func(t *testing.T, result *transform.Result, op *ast.OperationDefinition)
	}{
		{
			name: "no relationships returns identity",
			schema: makeSchema(
				ast.FieldList{
					{
						Name: "users",
						Type: ast.ListType(ast.NamedType("users", nil), nil),
					},
				},
				map[string]*ast.Definition{
					"users": {
						Kind: ast.Object,
						Name: "users",
						Fields: ast.FieldList{
							{Name: "id", Type: ast.NamedType("Int", nil)},
							{Name: "name", Type: ast.NamedType("String", nil)},
						},
					},
				},
			),
			remotes:         nil,
			typeToConnector: typeOwners(map[string]string{"users": "db1"}),
			op: &ast.OperationDefinition{
				Operation: ast.Query,
				Name:      "GetUsers",
				SelectionSet: ast.SelectionSet{
					&ast.Field{
						Name: "users",
						SelectionSet: ast.SelectionSet{
							&ast.Field{Name: "id"},
							&ast.Field{Name: "name"},
						},
					},
				},
			},
			fragments: nil,
			check: func(t *testing.T, result *transform.Result, op *ast.OperationDefinition) {
				t.Helper()

				if result.CleanOperation != op {
					t.Error("expected CleanOperation to be same object as input")
				}
			},
		},
		{
			name:            "strips remote relationship field from root",
			schema:          usersWithDepartmentSchema(),
			remotes:         []transform.RemoteRelationship{departmentRemoteRel()},
			typeToConnector: typeOwners(map[string]string{"users": "db1", "departments": "db2"}),
			op: &ast.OperationDefinition{
				Operation: ast.Query,
				Name:      "GetUsersWithDept",
				SelectionSet: ast.SelectionSet{
					&ast.Field{
						Name: "users",
						SelectionSet: ast.SelectionSet{
							&ast.Field{Name: "id"},
							&ast.Field{Name: "name"},
							&ast.Field{
								Name: "department",
								SelectionSet: ast.SelectionSet{
									&ast.Field{Name: "name"},
								},
							},
						},
					},
				},
			},
			fragments: nil,
			check: func(t *testing.T, result *transform.Result, _ *ast.OperationDefinition) {
				t.Helper()

				rootField, ok := result.CleanOperation.SelectionSet[0].(*ast.Field)
				if !ok {
					t.Fatal("expected root selection to be *ast.Field")
				}

				names := fieldNames(rootField.SelectionSet)
				if containsString(names, "department") {
					t.Error("expected 'department' relationship field stripped")
				}
			},
		},
		{
			name:            "preserves non-relationship fields",
			schema:          usersWithDepartmentSchema(),
			remotes:         []transform.RemoteRelationship{departmentRemoteRel()},
			typeToConnector: typeOwners(map[string]string{"users": "db1", "departments": "db2"}),
			op: &ast.OperationDefinition{
				Operation: ast.Query,
				Name:      "GetUsers",
				SelectionSet: ast.SelectionSet{
					&ast.Field{
						Name: "users",
						SelectionSet: ast.SelectionSet{
							&ast.Field{Name: "id"},
							&ast.Field{Name: "name"},
							&ast.Field{Name: "email"},
							&ast.Field{
								Name: "department",
								SelectionSet: ast.SelectionSet{
									&ast.Field{Name: "id"},
								},
							},
						},
					},
				},
			},
			fragments: nil,
			check: func(t *testing.T, result *transform.Result, _ *ast.OperationDefinition) {
				t.Helper()

				rootField, ok := result.CleanOperation.SelectionSet[0].(*ast.Field)
				if !ok {
					t.Fatal("expected root selection to be *ast.Field")
				}

				names := fieldNames(rootField.SelectionSet)
				for _, expected := range []string{"id", "name", "email"} {
					if !containsString(names, expected) {
						t.Errorf("expected %q preserved, got %v", expected, names)
					}
				}

				if containsString(names, "department") {
					t.Error("expected 'department' relationship field stripped")
				}
			},
		},
		{
			name: "filters cross-schema fragments owned by other connectors",
			schema: makeSchema(
				ast.FieldList{
					{
						Name: "users",
						Type: ast.ListType(ast.NamedType("users", nil), nil),
					},
				},
				map[string]*ast.Definition{
					"users": {
						Kind: ast.Object,
						Name: "users",
						Fields: ast.FieldList{
							{Name: "id", Type: ast.NamedType("Int", nil)},
							{Name: "name", Type: ast.NamedType("String", nil)},
						},
					},
					"departments": {
						Kind: ast.Object,
						Name: "departments",
						Fields: ast.FieldList{
							{Name: "id", Type: ast.NamedType("Int", nil)},
							{Name: "name", Type: ast.NamedType("String", nil)},
						},
					},
				},
			),
			remotes:         []transform.RemoteRelationship{departmentRemoteRel()},
			typeToConnector: typeOwners(map[string]string{"users": "db1", "departments": "db2"}),
			op: &ast.OperationDefinition{
				Operation: ast.Query,
				Name:      "GetUsers",
				SelectionSet: ast.SelectionSet{
					&ast.Field{
						Name: "users",
						SelectionSet: ast.SelectionSet{
							&ast.Field{Name: "id"},
						},
					},
				},
			},
			fragments: ast.FragmentDefinitionList{
				{
					Name:          "UserFields",
					TypeCondition: "users",
					SelectionSet: ast.SelectionSet{
						&ast.Field{Name: "name"},
					},
				},
				{
					Name:          "DeptFields",
					TypeCondition: "departments", // belongs to db2
					SelectionSet: ast.SelectionSet{
						&ast.Field{Name: "name"},
					},
				},
			},
			check: func(t *testing.T, result *transform.Result, _ *ast.OperationDefinition) {
				t.Helper()

				foundUser, foundDept := false, false

				for _, frag := range result.CleanFragments {
					if frag.Name == "UserFields" {
						foundUser = true
					}

					if frag.Name == "DeptFields" {
						foundDept = true
					}
				}

				if !foundUser {
					t.Error("expected UserFields fragment preserved")
				}

				if foundDept {
					t.Error("expected DeptFields fragment filtered (belongs to db2)")
				}
			},
		},
		{
			// The transformer must use ast.Subscription to look up the root
			// type, then strip the remote `department` relationship from the
			// users selection. The CleanOperation must preserve
			// ast.Subscription so downstream consumers know what they are
			// running.
			name:            "strips relationship from subscription root field",
			schema:          usersWithDepartmentSchemaAllRoots(),
			remotes:         []transform.RemoteRelationship{departmentRemoteRel()},
			typeToConnector: typeOwners(map[string]string{"users": "db1", "departments": "db2"}),
			op: &ast.OperationDefinition{
				Operation: ast.Subscription,
				Name:      "WatchUsersWithDept",
				SelectionSet: ast.SelectionSet{
					&ast.Field{
						Name: "users",
						SelectionSet: ast.SelectionSet{
							&ast.Field{Name: "id"},
							&ast.Field{Name: "name"},
							&ast.Field{
								Name: "department",
								SelectionSet: ast.SelectionSet{
									&ast.Field{Name: "name"},
								},
							},
						},
					},
				},
			},
			fragments: nil,
			check: func(t *testing.T, result *transform.Result, _ *ast.OperationDefinition) {
				t.Helper()

				if result.CleanOperation.Operation != ast.Subscription {
					t.Errorf(
						"expected CleanOperation.Operation=ast.Subscription, got %q",
						result.CleanOperation.Operation,
					)
				}

				rootField, ok := result.CleanOperation.SelectionSet[0].(*ast.Field)
				if !ok {
					t.Fatal("expected root selection to be *ast.Field")
				}

				names := fieldNames(rootField.SelectionSet)
				if containsString(names, "department") {
					t.Errorf("expected `department` stripped from subscription, got %v", names)
				}

				for _, expected := range []string{"id", "name"} {
					if !containsString(names, expected) {
						t.Errorf("expected %q preserved, got %v", expected, names)
					}
				}
			},
		},
		{
			// On a mutation, the remote relationship lives one level deep
			// inside `insert_users.returning`. The transformer must recurse
			// into the returning selection (typed `users`) and strip
			// `department` there while leaving sibling root fields intact.
			name:    "strips relationship inside mutation returning",
			schema:  usersWithDepartmentSchemaAllRoots(),
			remotes: []transform.RemoteRelationship{departmentRemoteRel()},
			typeToConnector: typeOwners(map[string]string{
				"users":                   "db1",
				"users_mutation_response": "db1",
				"departments":             "db2",
			}),
			op: &ast.OperationDefinition{
				Operation: ast.Mutation,
				Name:      "InsertUsersWithDept",
				SelectionSet: ast.SelectionSet{
					&ast.Field{
						Name: "insert_users",
						SelectionSet: ast.SelectionSet{
							&ast.Field{Name: "affected_rows"},
							&ast.Field{
								Name: "returning",
								SelectionSet: ast.SelectionSet{
									&ast.Field{Name: "id"},
									&ast.Field{Name: "name"},
									&ast.Field{
										Name: "department",
										SelectionSet: ast.SelectionSet{
											&ast.Field{Name: "name"},
										},
									},
								},
							},
						},
					},
				},
			},
			fragments: nil,
			check: func(t *testing.T, result *transform.Result, _ *ast.OperationDefinition) {
				t.Helper()

				if result.CleanOperation.Operation != ast.Mutation {
					t.Errorf(
						"expected CleanOperation.Operation=ast.Mutation, got %q",
						result.CleanOperation.Operation,
					)
				}

				rootField, ok := result.CleanOperation.SelectionSet[0].(*ast.Field)
				if !ok {
					t.Fatal("expected root selection to be *ast.Field")
				}

				if rootField.Name != "insert_users" {
					t.Fatalf("expected root field 'insert_users', got %q", rootField.Name)
				}

				var returningField *ast.Field

				for _, sel := range rootField.SelectionSet {
					f, isField := sel.(*ast.Field)
					if !isField {
						continue
					}

					if f.Name == "returning" {
						returningField = f
					}
				}

				if returningField == nil {
					t.Fatal("expected `returning` field preserved in mutation")
				}

				names := fieldNames(returningField.SelectionSet)
				if containsString(names, "department") {
					t.Errorf(
						"expected `department` stripped from returning, got %v",
						names,
					)
				}

				for _, expected := range []string{"id", "name"} {
					if !containsString(names, expected) {
						t.Errorf("expected %q preserved in returning, got %v", expected, names)
					}
				}

				// `affected_rows` is a sibling of `returning` under
				// `insert_users` — it must not be stripped.
				rootNames := fieldNames(rootField.SelectionSet)
				if !containsString(rootNames, "affected_rows") {
					t.Errorf(
						"expected `affected_rows` preserved on insert_users, got %v",
						rootNames,
					)
				}
			},
		},
		{
			// When a fragment becomes empty after stripping relationship fields,
			// any spread referencing it inside the operation must be removed too
			// — otherwise the connector receives an unresolved spread.
			name:            "strips empty fragment spread from operation",
			schema:          usersWithDepartmentSchema(),
			remotes:         []transform.RemoteRelationship{departmentRemoteRel()},
			typeToConnector: typeOwners(map[string]string{"users": "db1", "departments": "db2"}),
			op: &ast.OperationDefinition{
				Operation: ast.Query,
				Name:      "GetUsers",
				SelectionSet: ast.SelectionSet{
					&ast.Field{
						Name: "users",
						SelectionSet: ast.SelectionSet{
							&ast.Field{Name: "id"},
							&ast.FragmentSpread{Name: "DeptFields"},
						},
					},
				},
			},
			fragments: ast.FragmentDefinitionList{
				{
					Name:          "DeptFields",
					TypeCondition: "users",
					SelectionSet: ast.SelectionSet{
						&ast.Field{
							Name: "department",
							SelectionSet: ast.SelectionSet{
								&ast.Field{Name: "name"},
							},
						},
					},
				},
			},
			check: func(t *testing.T, result *transform.Result, _ *ast.OperationDefinition) {
				t.Helper()

				usersField, ok := result.CleanOperation.SelectionSet[0].(*ast.Field)
				if !ok {
					t.Fatal("expected first selection to be *ast.Field")
				}

				for _, sel := range usersField.SelectionSet {
					if fs, isSpread := sel.(*ast.FragmentSpread); isSpread {
						t.Errorf(
							"expected DeptFields fragment spread to be stripped, found %q",
							fs.Name,
						)
					}
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			tr := transform.NewTransformer(
				tt.schema,
				tt.remotes,
				"db1",
				tt.typeToConnector,
			)

			result := tr.Transform(tt.op, tt.fragments)

			tt.check(t, result, tt.op)
		})
	}
}

// ---------- InjectPhantomFields ----------

func TestInjectPhantomFields_AtRootPath(t *testing.T) {
	t.Parallel()

	op := &ast.OperationDefinition{
		Operation: ast.Query,
		Name:      "GetUsers",
		SelectionSet: ast.SelectionSet{
			&ast.Field{
				Name: "users",
				SelectionSet: ast.SelectionSet{
					&ast.Field{Name: "id"},
					&ast.Field{Name: "name"},
				},
			},
		},
	}

	specs := []transform.PhantomSpec{
		{
			Path:   jsonpath.Parse("users"),
			Fields: []string{"department_id"},
		},
	}

	transform.InjectPhantomFields(op, specs)

	usersField, ok := op.SelectionSet[0].(*ast.Field)
	if !ok {
		t.Fatal("expected root selection to be *ast.Field")
	}

	names := fieldNames(usersField.SelectionSet)
	if !containsString(names, "department_id") {
		t.Errorf("expected 'department_id' to be injected, got %v", names)
	}

	if !containsString(names, "id") || !containsString(names, "name") {
		t.Errorf("expected original fields preserved, got %v", names)
	}
}

func TestInjectPhantomFields_AtNestedPath(t *testing.T) {
	t.Parallel()

	op := &ast.OperationDefinition{
		Operation: ast.Query,
		Name:      "GetTeams",
		SelectionSet: ast.SelectionSet{
			&ast.Field{
				Name: "teams",
				SelectionSet: ast.SelectionSet{
					&ast.Field{Name: "id"},
					&ast.Field{
						Name: "leader",
						SelectionSet: ast.SelectionSet{
							&ast.Field{Name: "name"},
						},
					},
				},
			},
		},
	}

	specs := []transform.PhantomSpec{
		{
			Path:   jsonpath.Parse("teams.leader"),
			Fields: []string{"org_id"},
		},
	}

	transform.InjectPhantomFields(op, specs)

	teamsField, ok := op.SelectionSet[0].(*ast.Field)
	if !ok {
		t.Fatal("expected root selection to be *ast.Field")
	}

	var leaderField *ast.Field

	for _, sel := range teamsField.SelectionSet {
		if f, ok := sel.(*ast.Field); ok && f.Name == "leader" {
			leaderField = f

			break
		}
	}

	if leaderField == nil {
		t.Fatal("expected to find 'leader' field")
	}

	names := fieldNames(leaderField.SelectionSet)
	if !containsString(names, "org_id") {
		t.Errorf("expected 'org_id' to be injected into nested path, got %v", names)
	}

	if !containsString(names, "name") {
		t.Errorf("expected original 'name' field preserved, got %v", names)
	}
}

func TestInjectPhantomFields_DeduplicatesExistingFields(t *testing.T) {
	t.Parallel()

	op := &ast.OperationDefinition{
		Operation: ast.Query,
		Name:      "GetUsers",
		SelectionSet: ast.SelectionSet{
			&ast.Field{
				Name: "users",
				SelectionSet: ast.SelectionSet{
					&ast.Field{Name: "id"},
					&ast.Field{Name: "department_id"},
				},
			},
		},
	}

	specs := []transform.PhantomSpec{
		{
			Path:   jsonpath.Parse("users"),
			Fields: []string{"department_id", "org_id"},
		},
	}

	transform.InjectPhantomFields(op, specs)

	usersField, ok := op.SelectionSet[0].(*ast.Field)
	if !ok {
		t.Fatal("expected root selection to be *ast.Field")
	}

	names := fieldNames(usersField.SelectionSet)

	count := 0

	for _, n := range names {
		if n == "department_id" {
			count++
		}
	}

	if count != 1 {
		t.Errorf(
			"expected 'department_id' to appear exactly once, got %d times in %v",
			count,
			names,
		)
	}

	if !containsString(names, "org_id") {
		t.Errorf("expected 'org_id' to be injected, got %v", names)
	}
}

func TestInjectPhantomFields_InjectsUnaliasedPhantomWhenExistingFieldUsesDifferentAlias(
	t *testing.T,
) {
	t.Parallel()

	op := &ast.OperationDefinition{
		Operation: ast.Query,
		Name:      "GetUsers",
		SelectionSet: ast.SelectionSet{
			&ast.Field{
				Name: "users",
				SelectionSet: ast.SelectionSet{
					&ast.Field{Name: "id"},
					&ast.Field{Name: "department_id", Alias: "dep_id"},
				},
			},
		},
	}

	specs := []transform.PhantomSpec{
		{
			Path:   jsonpath.Parse("users"),
			Fields: []string{"department_id"},
		},
	}

	transform.InjectPhantomFields(op, specs)

	usersField, ok := op.SelectionSet[0].(*ast.Field)
	if !ok {
		t.Fatal("expected root selection to be *ast.Field")
	}

	responseKeys := fieldNames(usersField.SelectionSet)
	if !containsString(responseKeys, "dep_id") {
		t.Fatalf("expected original aliased field to remain, got %v", responseKeys)
	}

	if !containsString(responseKeys, "department_id") {
		t.Fatalf("expected unaliased phantom field to be injected, got %v", responseKeys)
	}
}

func TestInjectPhantomFields_AliasCollisionUsesPhantomAlias(t *testing.T) {
	t.Parallel()

	op := &ast.OperationDefinition{
		Operation: ast.Query,
		Name:      "GetUsers",
		SelectionSet: ast.SelectionSet{
			&ast.Field{
				Name: "users",
				SelectionSet: ast.SelectionSet{
					&ast.Field{Name: "id", Alias: "department_id"},
				},
			},
		},
	}

	specs := []transform.PhantomSpec{
		{
			Path:    jsonpath.Parse("users"),
			Fields:  []string{"department_id"},
			Aliases: map[string]string{"department_id": "_constellation_phantom_department_id"},
		},
	}

	transform.InjectPhantomFields(op, specs)

	usersField, ok := op.SelectionSet[0].(*ast.Field)
	if !ok {
		t.Fatal("expected root selection to be *ast.Field")
	}

	responseKeys := fieldNames(usersField.SelectionSet)
	if !containsString(responseKeys, "department_id") {
		t.Fatalf("expected original aliased field to remain, got %v", responseKeys)
	}

	if !containsString(responseKeys, "_constellation_phantom_department_id") {
		t.Fatalf("expected aliased phantom field to be injected, got %v", responseKeys)
	}
}

func TestInjectPhantomFields_NoOpWithEmptySpecs(t *testing.T) {
	t.Parallel()

	op := &ast.OperationDefinition{
		Operation: ast.Query,
		Name:      "GetUsers",
		SelectionSet: ast.SelectionSet{
			&ast.Field{
				Name: "users",
				SelectionSet: ast.SelectionSet{
					&ast.Field{Name: "id"},
					&ast.Field{Name: "name"},
				},
			},
		},
	}

	transform.InjectPhantomFields(op, nil)
	transform.InjectPhantomFields(op, []transform.PhantomSpec{})

	usersField, ok := op.SelectionSet[0].(*ast.Field)
	if !ok {
		t.Fatal("expected root selection to be *ast.Field")
	}

	names := fieldNames(usersField.SelectionSet)
	if len(names) != 2 {
		t.Errorf("expected 2 fields unchanged, got %v", names)
	}
}
