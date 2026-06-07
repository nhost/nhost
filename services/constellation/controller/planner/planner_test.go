package planner_test

import (
	"errors"
	"maps"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	"github.com/nhost/nhost/services/constellation/controller/planner"
	"github.com/nhost/nhost/services/constellation/internal/jsonpath"
	"github.com/vektah/gqlparser/v2/ast"
)

// ---------- helpers ----------

// makeSchema builds a minimal ast.Schema with query root and types.
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

func typeOwners(owners map[string]string) map[string][]string {
	out := make(map[string][]string, len(owners))
	for typeName, connectorName := range owners {
		out[typeName] = []string{connectorName}
	}

	return out
}

func fieldOwnersForRole(role string, owners map[string]string) map[string]map[string]string {
	return map[string]map[string]string{role: owners}
}

func typeOwnersForRole(role string, owners map[string][]string) map[string]map[string][]string {
	return map[string]map[string][]string{role: owners}
}

// usersWithDepartmentSchema returns a schema with users -> department (object
// relationship) and a separate departments type. Shared by tests that
// exercise the basic remote relationship code paths.
func usersWithDepartmentSchema() *ast.Schema {
	return makeSchema(
		ast.FieldList{
			{Name: "users", Type: ast.ListType(ast.NamedType("users", nil), nil)},
		},
		map[string]*ast.Definition{
			"users": {
				Kind: ast.Object,
				Name: "users",
				Fields: ast.FieldList{
					{Name: "id", Type: ast.NamedType("Int", nil)},
					{Name: "name", Type: ast.NamedType("String", nil)},
					{Name: "department_id", Type: ast.NamedType("Int", nil)},
					{Name: "department", Type: ast.NamedType("departments", nil)},
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

// usersWithDepartmentSchemaAllRoots returns a schema like
// [usersWithDepartmentSchema] but with Query, Mutation, and Subscription root
// types that all expose users-shaped fields. The user/department types carry a
// remote `department` relationship; the mutation `insert_users` returns the
// `users_mutation_response` type which exposes `returning: [users!]!`, and the
// subscription `users` field returns the same `users` object type as the
// query. This is used to exercise [QueryPlanner.Plan] (and the transformer)
// against `ast.Mutation` and `ast.Subscription` operations.
func usersWithDepartmentSchemaAllRoots() *ast.Schema {
	usersType := &ast.Definition{
		Kind: ast.Object,
		Name: "users",
		Fields: ast.FieldList{
			{Name: "id", Type: ast.NamedType("Int", nil)},
			{Name: "name", Type: ast.NamedType("String", nil)},
			{Name: "department_id", Type: ast.NamedType("Int", nil)},
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

// departmentRelationship returns the standard users -> department remote
// relationship metadata (db1 -> db2) shared across phantom-field, fragment,
// and inline-fragment tests.
func departmentRelationship() *planner.RelationshipMetadata {
	return &planner.RelationshipMetadata{
		Name:              "department",
		SourceType:        "users",
		TargetConnector:   "db2",
		TargetTable:       "departments",
		TargetTableSchema: "public",
		JoinMapping:       map[string]string{"department_id": "id"},
		IsArray:           false,
		IsArrayAggregate:  false,
		IsRemote:          true,
		LHSFields:         nil,
		RemoteFieldPath:   nil,
	}
}

// makeAdminPlanner constructs a single-role admin planner with the given
// schema, field routing, type ownership, and relationship metadata for a
// "db1" connector.
func makeAdminPlanner(
	schema *ast.Schema,
	fieldToConnector map[string]string,
	typeToConnector map[string][]string,
	relationships []*planner.RelationshipMetadata,
) *planner.QueryPlanner {
	return planner.New(
		map[string]*ast.Schema{"admin": schema},
		fieldOwnersForRole("admin", fieldToConnector),
		typeOwnersForRole("admin", typeToConnector),
		map[string][]*planner.RelationshipMetadata{"db1": relationships},
	)
}

// ---------- QueryPlanner.Plan ----------

// planTestCase describes one Plan invocation, the inputs needed to build the
// planner, and a callback that asserts on the resulting plan.
type planTestCase struct {
	name             string
	schema           *ast.Schema
	fieldToConnector map[string]string
	typeToConnector  map[string][]string
	relationships    []*planner.RelationshipMetadata
	role             string
	op               *ast.OperationDefinition
	fragments        ast.FragmentDefinitionList
	check            func(t *testing.T, plan *planner.QueryPlan)
}

// TestPlan runs end-to-end QueryPlanner.Plan scenarios. Each case is small
// but the table is large, so per-case asserts inflate the function's
// cyclomatic complexity score; the nolint covers the unavoidable noise.
//
//nolint:gocognit,gocyclo,cyclop,maintidx // table-driven; assertions inlined per case
func TestPlan(t *testing.T) {
	t.Parallel()

	tests := []planTestCase{
		{
			name: "single connector, no relationships",
			schema: makeSchema(
				ast.FieldList{
					{Name: "users", Type: ast.ListType(ast.NamedType("users", nil), nil)},
				},
				map[string]*ast.Definition{
					"users": {
						Kind: ast.Object,
						Name: "users",
						Fields: ast.FieldList{
							{Name: "id", Type: ast.NamedType("Int", nil)},
							{Name: "name", Type: ast.NamedType("String", nil)},
							{Name: "email", Type: ast.NamedType("String", nil)},
						},
					},
				},
			),
			fieldToConnector: map[string]string{schemamerge.FieldKey(ast.Query, "users"): "db1"},
			typeToConnector:  typeOwners(map[string]string{"users": "db1"}),
			relationships:    nil,
			role:             "user",
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
			check: func(t *testing.T, plan *planner.QueryPlan) {
				t.Helper()

				if len(plan.PrimaryQueries) != 1 {
					t.Fatalf("expected 1 primary query, got %d", len(plan.PrimaryQueries))
				}

				if plan.PrimaryQueries[0].Connector != "db1" {
					t.Errorf("expected connector db1, got %s", plan.PrimaryQueries[0].Connector)
				}

				if len(plan.RemoteQueries) != 0 {
					t.Errorf("expected 0 remote queries, got %d", len(plan.RemoteQueries))
				}

				if plan.HasRemoteQueries() {
					t.Error("expected HasRemoteQueries to be false")
				}
			},
		},
		{
			name: "multi-connector routing",
			schema: makeSchema(
				ast.FieldList{
					{Name: "users", Type: ast.ListType(ast.NamedType("users", nil), nil)},
					{Name: "products", Type: ast.ListType(ast.NamedType("products", nil), nil)},
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
					"products": {
						Kind: ast.Object,
						Name: "products",
						Fields: ast.FieldList{
							{Name: "id", Type: ast.NamedType("Int", nil)},
							{Name: "title", Type: ast.NamedType("String", nil)},
						},
					},
				},
			),
			fieldToConnector: map[string]string{
				schemamerge.FieldKey(ast.Query, "users"):    "db1",
				schemamerge.FieldKey(ast.Query, "products"): "db2",
			},
			typeToConnector: typeOwners(map[string]string{"users": "db1", "products": "db2"}),
			relationships:   nil,
			role:            "admin",
			op: &ast.OperationDefinition{
				Operation: ast.Query,
				Name:      "GetAll",
				SelectionSet: ast.SelectionSet{
					&ast.Field{
						Name: "users",
						SelectionSet: ast.SelectionSet{
							&ast.Field{Name: "id"},
						},
					},
					&ast.Field{
						Name: "products",
						SelectionSet: ast.SelectionSet{
							&ast.Field{Name: "title"},
						},
					},
				},
			},
			check: func(t *testing.T, plan *planner.QueryPlan) {
				t.Helper()

				if len(plan.PrimaryQueries) != 2 {
					t.Fatalf("expected 2 primary queries, got %d", len(plan.PrimaryQueries))
				}

				if plan.GetPrimaryQueryForConnector("db1") == nil {
					t.Fatal("expected primary query for db1")
				}

				if plan.GetPrimaryQueryForConnector("db2") == nil {
					t.Fatal("expected primary query for db2")
				}
			},
		},
		{
			name:             "remote relationship detection",
			schema:           usersWithDepartmentSchema(),
			fieldToConnector: map[string]string{schemamerge.FieldKey(ast.Query, "users"): "db1"},
			typeToConnector:  typeOwners(map[string]string{"users": "db1", "departments": "db2"}),
			relationships:    []*planner.RelationshipMetadata{departmentRelationship()},
			role:             "admin",
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
			check: func(t *testing.T, plan *planner.QueryPlan) {
				t.Helper()

				if !plan.HasRemoteQueries() || len(plan.RemoteQueries) != 1 {
					t.Fatalf("expected exactly 1 remote query, got %+v", plan.RemoteQueries)
				}

				rq := plan.RemoteQueries[0]
				switch {
				case rq.Name != "department":
					t.Errorf("expected relationship name 'department', got %s", rq.Name)
				case rq.SourceConnector != "db1":
					t.Errorf("expected source connector db1, got %s", rq.SourceConnector)
				case rq.TargetConnector != "db2":
					t.Errorf("expected target connector db2, got %s", rq.TargetConnector)
				case rq.TargetTable != "departments":
					t.Errorf("expected target table 'departments', got %s", rq.TargetTable)
				case rq.TargetTableSchema != "public":
					t.Errorf("expected target table schema 'public', got %s", rq.TargetTableSchema)
				case rq.IsArray:
					t.Error("expected IsArray=false for object relationship")
				case rq.OutputField != "department":
					t.Errorf("expected output field 'department', got %s", rq.OutputField)
				case rq.ResolverType != planner.ResolverKindDatabase:
					t.Errorf("expected resolver type 'database', got %s", rq.ResolverType)
				case rq.JoinMapping["department_id"] != "id":
					t.Errorf("expected join mapping department_id->id, got %v", rq.JoinMapping)
				}
			},
		},
		{
			name:             "phantom field injection",
			schema:           usersWithDepartmentSchema(),
			fieldToConnector: map[string]string{schemamerge.FieldKey(ast.Query, "users"): "db1"},
			typeToConnector:  typeOwners(map[string]string{"users": "db1", "departments": "db2"}),
			relationships:    []*planner.RelationshipMetadata{departmentRelationship()},
			role:             "admin",
			op: &ast.OperationDefinition{
				Operation: ast.Query,
				Name:      "GetUsersWithDept",
				// Note: query does NOT select department_id, so it must become
				// a phantom field for the cross-DB join.
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
			check: func(t *testing.T, plan *planner.QueryPlan) {
				t.Helper()

				allPhantoms := plan.AllPhantomFieldSpecs()
				if len(allPhantoms) == 0 {
					t.Fatal("expected at least one phantom field spec")
				}

				foundDeptID := false

				for _, pf := range allPhantoms {
					for _, f := range pf.Fields {
						if f == "department_id" {
							foundDeptID = true
						}
					}
				}

				if !foundDeptID {
					t.Error("expected phantom field 'department_id' to be injected")
				}

				pfs := allPhantoms[0]
				expectedPath := jsonpath.Parse("users")

				if pfs.Path.String() != expectedPath.String() {
					t.Errorf("expected phantom path 'users', got '%s'", pfs.Path.String())
				}

				if pfs.ForRelationship != "department" {
					t.Errorf("expected ForRelationship='department', got '%s'", pfs.ForRelationship)
				}
			},
		},
		{
			name: "schema resolver branch (db->rs)",
			schema: makeSchema(
				ast.FieldList{
					{Name: "users", Type: ast.ListType(ast.NamedType("users", nil), nil)},
				},
				map[string]*ast.Definition{
					"users": {
						Kind: ast.Object,
						Name: "users",
						Fields: ast.FieldList{
							{Name: "id", Type: ast.NamedType("Int", nil)},
							{Name: "team", Type: ast.NamedType("Team", nil)},
						},
					},
					"Team": {
						Kind: ast.Object,
						Name: "Team",
						Fields: ast.FieldList{
							{Name: "name", Type: ast.NamedType("String", nil)},
						},
					},
				},
			),
			fieldToConnector: map[string]string{schemamerge.FieldKey(ast.Query, "users"): "db1"},
			typeToConnector:  typeOwners(map[string]string{"users": "db1", "Team": "rs1"}),
			relationships: []*planner.RelationshipMetadata{
				{
					Name:              "team",
					SourceType:        "users",
					TargetConnector:   "rs1",
					TargetTable:       "",
					TargetTableSchema: "",
					JoinMapping:       map[string]string{"id": "userId"},
					IsArray:           false,
					IsArrayAggregate:  false,
					IsRemote:          true,
					LHSFields:         []string{"id"},
					RemoteFieldPath: []planner.RemoteFieldPathEntry{
						{
							FieldName: "teamByUser",
							Arguments: map[string]string{"userId": "$id"},
						},
					},
				},
			},
			role: "admin",
			op: &ast.OperationDefinition{
				Operation: ast.Query,
				Name:      "GetUsersWithTeam",
				SelectionSet: ast.SelectionSet{
					&ast.Field{
						Name: "users",
						SelectionSet: ast.SelectionSet{
							&ast.Field{Name: "id"},
							&ast.Field{
								Name:         "team",
								SelectionSet: ast.SelectionSet{&ast.Field{Name: "name"}},
							},
						},
					},
				},
			},
			check: func(t *testing.T, plan *planner.QueryPlan) {
				t.Helper()

				if !plan.HasRemoteQueries() || len(plan.RemoteQueries) != 1 {
					t.Fatalf("expected 1 remote query, got %+v", plan.RemoteQueries)
				}

				rq := plan.RemoteQueries[0]
				if rq.ResolverType != planner.ResolverKindSchema {
					t.Errorf("expected ResolverKindSchema, got %q", rq.ResolverType)
				}

				if len(rq.LHSFields) != 1 || rq.LHSFields[0] != "id" {
					t.Errorf("expected LHSFields=[id], got %v", rq.LHSFields)
				}

				if len(rq.RemoteFieldPath) != 1 || rq.RemoteFieldPath[0].FieldName != "teamByUser" {
					t.Errorf("expected RemoteFieldPath=[teamByUser], got %+v", rq.RemoteFieldPath)
				}
			},
		},
		{
			name: "IsArrayAggregate propagation",
			schema: makeSchema(
				ast.FieldList{
					{Name: "users", Type: ast.ListType(ast.NamedType("users", nil), nil)},
				},
				map[string]*ast.Definition{
					"users": {
						Kind: ast.Object,
						Name: "users",
						Fields: ast.FieldList{
							{Name: "id", Type: ast.NamedType("Int", nil)},
							{
								Name: "orders_aggregate",
								Type: ast.NamedType("orders_aggregate", nil),
							},
						},
					},
					"orders_aggregate": {
						Kind: ast.Object,
						Name: "orders_aggregate",
						Fields: ast.FieldList{
							{
								Name: "aggregate",
								Type: ast.NamedType("orders_aggregate_fields", nil),
							},
						},
					},
					"orders_aggregate_fields": {
						Kind: ast.Object,
						Name: "orders_aggregate_fields",
						Fields: ast.FieldList{
							{Name: "count", Type: ast.NamedType("Int", nil)},
						},
					},
				},
			),
			fieldToConnector: map[string]string{schemamerge.FieldKey(ast.Query, "users"): "db1"},
			typeToConnector: typeOwners(
				map[string]string{"users": "db1", "orders_aggregate": "db2"},
			),
			relationships: []*planner.RelationshipMetadata{
				{
					Name:              "orders_aggregate",
					SourceType:        "users",
					TargetConnector:   "db2",
					TargetTable:       "orders",
					TargetTableSchema: "public",
					JoinMapping:       map[string]string{"id": "userId"},
					IsArray:           true,
					IsArrayAggregate:  true,
					IsRemote:          true,
					LHSFields:         nil,
					RemoteFieldPath:   nil,
				},
			},
			role: "admin",
			op: &ast.OperationDefinition{
				Operation: ast.Query,
				Name:      "GetUsersWithOrdersAgg",
				SelectionSet: ast.SelectionSet{
					&ast.Field{
						Name: "users",
						SelectionSet: ast.SelectionSet{
							&ast.Field{Name: "id"},
							&ast.Field{
								Name: "orders_aggregate",
								SelectionSet: ast.SelectionSet{
									&ast.Field{
										Name:         "aggregate",
										SelectionSet: ast.SelectionSet{&ast.Field{Name: "count"}},
									},
								},
							},
						},
					},
				},
			},
			check: func(t *testing.T, plan *planner.QueryPlan) {
				t.Helper()

				if len(plan.RemoteQueries) != 1 {
					t.Fatalf("expected 1 remote query, got %+v", plan)
				}

				rq := plan.RemoteQueries[0]
				if !rq.IsArrayAggregate {
					t.Errorf("expected IsArrayAggregate=true, got %+v", rq)
				}

				if !rq.IsArray {
					t.Error("expected IsArray=true paired with IsArrayAggregate")
				}
			},
		},
		{
			name:             "remote relationship inside fragment spread",
			schema:           usersWithDepartmentSchema(),
			fieldToConnector: map[string]string{schemamerge.FieldKey(ast.Query, "users"): "db1"},
			typeToConnector:  typeOwners(map[string]string{"users": "db1", "departments": "db2"}),
			relationships:    []*planner.RelationshipMetadata{departmentRelationship()},
			role:             "admin",
			op: &ast.OperationDefinition{
				Operation: ast.Query,
				Name:      "GetUsers",
				SelectionSet: ast.SelectionSet{
					&ast.Field{
						Name: "users",
						SelectionSet: ast.SelectionSet{
							&ast.FragmentSpread{
								Name: "UserFields",
								Definition: &ast.FragmentDefinition{
									Name:          "UserFields",
									TypeCondition: "users",
									SelectionSet: ast.SelectionSet{
										&ast.Field{Name: "id"},
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
			},
			fragments: ast.FragmentDefinitionList{
				{
					Name:          "UserFields",
					TypeCondition: "users",
					SelectionSet: ast.SelectionSet{
						&ast.Field{Name: "id"},
						&ast.Field{
							Name: "department",
							SelectionSet: ast.SelectionSet{
								&ast.Field{Name: "name"},
							},
						},
					},
				},
			},
			check: func(t *testing.T, plan *planner.QueryPlan) {
				t.Helper()

				if !plan.HasRemoteQueries() {
					t.Fatal("expected remote queries detected through fragment spread")
				}

				if plan.RemoteQueries[0].Name != "department" {
					t.Errorf(
						"expected relationship 'department', got %q",
						plan.RemoteQueries[0].Name,
					)
				}
			},
		},
		{
			// Subscription operations should plan exactly like queries: the
			// analyzer must detect the remote `department` relationship and
			// inject `department_id` as a phantom field. The controller blocks
			// subscriptions with remote relationships at execution time, but
			// Plan() must not crash building the plan. See review file
			// .review/REVIEW_controller_planner.md (M5) for context.
			name:   "subscription operation with remote relationship",
			schema: usersWithDepartmentSchemaAllRoots(),
			fieldToConnector: map[string]string{
				schemamerge.FieldKey(ast.Subscription, "users"): "db1",
			},
			typeToConnector: typeOwners(map[string]string{"users": "db1", "departments": "db2"}),
			relationships:   []*planner.RelationshipMetadata{departmentRelationship()},
			role:            "admin",
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
			check: func(t *testing.T, plan *planner.QueryPlan) {
				t.Helper()

				if len(plan.PrimaryQueries) != 1 {
					t.Fatalf("expected 1 primary query, got %d", len(plan.PrimaryQueries))
				}

				pq := plan.PrimaryQueries[0]
				if pq.Connector != "db1" {
					t.Errorf("expected connector db1, got %s", pq.Connector)
				}

				if pq.CleanOperation.Operation != ast.Subscription {
					t.Errorf(
						"expected clean operation to preserve ast.Subscription, got %q",
						pq.CleanOperation.Operation,
					)
				}

				if !plan.HasRemoteQueries() || len(plan.RemoteQueries) != 1 {
					t.Fatalf("expected 1 remote query, got %+v", plan.RemoteQueries)
				}

				if plan.RemoteQueries[0].Name != "department" {
					t.Errorf(
						"expected remote relationship 'department', got %q",
						plan.RemoteQueries[0].Name,
					)
				}

				foundDeptID := false
				for _, pfs := range plan.AllPhantomFieldSpecs() {
					for _, f := range pfs.Fields {
						if f == "department_id" {
							foundDeptID = true
						}
					}
				}

				if !foundDeptID {
					t.Error("expected phantom field 'department_id' for subscription plan")
				}
			},
		},
		{
			// Mutation operations should plan correctly when their return type
			// contains a remote relationship. Here `insert_users.returning` is
			// a `[users!]!` and `users.department` is a remote relationship.
			// The planner must traverse into the mutation response selection
			// set, detect the relationship, and inject the join key. See
			// review file .review/REVIEW_controller_planner.md (M5) for
			// context.
			name:   "mutation operation with remote relationship in returning",
			schema: usersWithDepartmentSchemaAllRoots(),
			fieldToConnector: map[string]string{
				schemamerge.FieldKey(ast.Mutation, "insert_users"): "db1",
			},
			typeToConnector: typeOwners(map[string]string{
				"users":                   "db1",
				"users_mutation_response": "db1",
				"departments":             "db2",
			}),
			relationships: []*planner.RelationshipMetadata{departmentRelationship()},
			role:          "admin",
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
			check: func(t *testing.T, plan *planner.QueryPlan) {
				t.Helper()

				if len(plan.PrimaryQueries) != 1 {
					t.Fatalf("expected 1 primary query, got %d", len(plan.PrimaryQueries))
				}

				pq := plan.PrimaryQueries[0]
				if pq.Connector != "db1" {
					t.Errorf("expected connector db1, got %s", pq.Connector)
				}

				if pq.CleanOperation.Operation != ast.Mutation {
					t.Errorf(
						"expected clean operation to preserve ast.Mutation, got %q",
						pq.CleanOperation.Operation,
					)
				}

				// `department` must have been stripped from the clean
				// operation's returning selection set.
				rootField, ok := pq.CleanOperation.SelectionSet[0].(*ast.Field)
				if !ok {
					t.Fatal("expected first selection to be *ast.Field")
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
					t.Fatal("expected `returning` field in clean operation")
				}

				for _, sel := range returningField.SelectionSet {
					f, isField := sel.(*ast.Field)
					if !isField {
						continue
					}

					if f.Name == "department" {
						t.Error("expected `department` field stripped from returning selection")
					}
				}

				if !plan.HasRemoteQueries() || len(plan.RemoteQueries) != 1 {
					t.Fatalf("expected 1 remote query, got %+v", plan.RemoteQueries)
				}

				rq := plan.RemoteQueries[0]
				if rq.Name != "department" {
					t.Errorf("expected remote relationship 'department', got %q", rq.Name)
				}

				if rq.SourcePath.String() != "insert_users.returning" {
					t.Errorf(
						"expected source path 'insert_users.returning', got %q",
						rq.SourcePath.String(),
					)
				}

				foundDeptID := false
				for _, pfs := range plan.AllPhantomFieldSpecs() {
					for _, f := range pfs.Fields {
						if f == "department_id" {
							foundDeptID = true
						}
					}
				}

				if !foundDeptID {
					t.Error("expected phantom field 'department_id' injected for mutation plan")
				}
			},
		},
		{
			name:             "remote relationship inside inline fragment",
			schema:           usersWithDepartmentSchema(),
			fieldToConnector: map[string]string{schemamerge.FieldKey(ast.Query, "users"): "db1"},
			typeToConnector:  typeOwners(map[string]string{"users": "db1", "departments": "db2"}),
			relationships:    []*planner.RelationshipMetadata{departmentRelationship()},
			role:             "admin",
			op: &ast.OperationDefinition{
				Operation: ast.Query,
				Name:      "GetUsers",
				SelectionSet: ast.SelectionSet{
					&ast.Field{
						Name: "users",
						SelectionSet: ast.SelectionSet{
							&ast.InlineFragment{
								TypeCondition: "users",
								SelectionSet: ast.SelectionSet{
									&ast.Field{Name: "id"},
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
			check: func(t *testing.T, plan *planner.QueryPlan) {
				t.Helper()

				if !plan.HasRemoteQueries() {
					t.Fatal("expected remote queries detected through inline fragment")
				}

				if plan.RemoteQueries[0].Name != "department" {
					t.Errorf(
						"expected relationship 'department', got %q",
						plan.RemoteQueries[0].Name,
					)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			p := makeAdminPlanner(
				tt.schema,
				tt.fieldToConnector,
				tt.typeToConnector,
				tt.relationships,
			)
			// Override role-mapping for the single-connector "user" role test case.
			if tt.role != "admin" {
				p = planner.New(
					map[string]*ast.Schema{tt.role: tt.schema},
					fieldOwnersForRole(tt.role, tt.fieldToConnector),
					typeOwnersForRole(tt.role, tt.typeToConnector),
					map[string][]*planner.RelationshipMetadata{"db1": tt.relationships},
				)
			}

			plan, err := p.Plan(tt.op, tt.fragments, tt.role)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if plan == nil {
				t.Fatal("expected non-nil plan")
			}

			tt.check(t, plan)
		})
	}
}

func TestPlan_PreservesFragmentOnSharedTypeOwnedByCurrentConnector(t *testing.T) {
	t.Parallel()

	userType := &ast.Definition{
		Kind: ast.Object,
		Name: "User",
		Fields: ast.FieldList{
			{Name: "id", Type: ast.NamedType("ID", nil)},
			{Name: "name", Type: ast.NamedType("String", nil)},
			{Name: "friend", Type: ast.NamedType("User", nil)},
		},
	}
	queryRoot := &ast.Definition{
		Kind: ast.Object,
		Name: "query_root",
		Fields: ast.FieldList{
			{Name: "a", Type: ast.NamedType("User", nil)},
			{Name: "b", Type: ast.NamedType("User", nil)},
		},
	}
	schema := &ast.Schema{
		Types: map[string]*ast.Definition{
			"query_root": queryRoot,
			"User":       userType,
		},
		Query: queryRoot,
	}
	p := planner.New(
		map[string]*ast.Schema{"admin": schema},
		fieldOwnersForRole("admin", map[string]string{
			schemamerge.FieldKey(ast.Query, "a"): "db1",
			schemamerge.FieldKey(ast.Query, "b"): "db2",
		}),
		typeOwnersForRole("admin", map[string][]string{"User": {"db1", "db2"}}),
		map[string][]*planner.RelationshipMetadata{
			"db2": {
				{
					Name:              "friend",
					SourceType:        "User",
					TargetConnector:   "db1",
					TargetTable:       "users",
					TargetTableSchema: "public",
					JoinMapping:       map[string]string{"id": "id"},
					IsArray:           false,
					IsArrayAggregate:  false,
					IsRemote:          true,
					LHSFields:         nil,
					RemoteFieldPath:   nil,
				},
			},
		},
	)

	plan, err := p.Plan(
		&ast.OperationDefinition{
			Operation: ast.Query,
			Name:      "SharedTypeFragment",
			SelectionSet: ast.SelectionSet{
				&ast.Field{
					Name: "b",
					SelectionSet: ast.SelectionSet{
						&ast.FragmentSpread{Name: "UserFields"},
						&ast.Field{
							Name: "friend",
							SelectionSet: ast.SelectionSet{
								&ast.Field{Name: "id"},
							},
						},
					},
				},
			},
		},
		ast.FragmentDefinitionList{
			{
				Name:          "UserFields",
				TypeCondition: "User",
				SelectionSet: ast.SelectionSet{
					&ast.Field{Name: "id"},
					&ast.Field{Name: "name"},
				},
			},
		},
		"admin",
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	primary := plan.GetPrimaryQueryForConnector("db2")
	if primary == nil {
		t.Fatal("expected db2 primary query")
	}

	found := false
	for _, fragment := range primary.CleanFragments {
		if fragment.Name == "UserFields" {
			found = true
		}
	}

	if !found {
		t.Fatal("expected shared User fragment preserved for db2")
	}
}

func TestPlan_UsesRoleSpecificFieldAndTypeOwnership(t *testing.T) {
	t.Parallel()

	itemType := &ast.Definition{
		Kind: ast.Object,
		Name: "Item",
		Fields: ast.FieldList{
			{Name: "id", Type: ast.NamedType("ID", nil)},
			{Name: "name", Type: ast.NamedType("String", nil)},
			{Name: "owner", Type: ast.NamedType("Owner", nil)},
		},
	}
	ownerType := &ast.Definition{
		Kind: ast.Object,
		Name: "Owner",
		Fields: ast.FieldList{
			{Name: "id", Type: ast.NamedType("ID", nil)},
		},
	}
	queryRoot := &ast.Definition{
		Kind: ast.Object,
		Name: "query_root",
		Fields: ast.FieldList{
			{Name: "items", Type: ast.ListType(ast.NamedType("Item", nil), nil)},
		},
	}
	schema := &ast.Schema{
		Types: map[string]*ast.Definition{
			"query_root": queryRoot,
			"Item":       itemType,
			"Owner":      ownerType,
		},
		Query: queryRoot,
	}

	p := planner.New(
		map[string]*ast.Schema{"admin": schema, "user": schema},
		map[string]map[string]string{
			"admin": {schemamerge.FieldKey(ast.Query, "items"): "db1"},
			"user":  {schemamerge.FieldKey(ast.Query, "items"): "db2"},
		},
		map[string]map[string][]string{
			"admin": {
				"Item":  {"db1"},
				"Owner": {"owners"},
			},
			"user": {
				"Item":  {"db2"},
				"Owner": {"owners"},
			},
		},
		map[string][]*planner.RelationshipMetadata{
			"db2": {
				{
					Name:              "owner",
					SourceType:        "Item",
					TargetConnector:   "owners",
					TargetTable:       "owners",
					TargetTableSchema: "public",
					JoinMapping:       map[string]string{"id": "id"},
					IsArray:           false,
					IsArrayAggregate:  false,
					IsRemote:          true,
					LHSFields:         nil,
					RemoteFieldPath:   nil,
				},
			},
		},
	)

	plan, err := p.Plan(
		&ast.OperationDefinition{
			Operation: ast.Query,
			Name:      "RoleSpecificItems",
			SelectionSet: ast.SelectionSet{
				&ast.Field{
					Name: "items",
					SelectionSet: ast.SelectionSet{
						&ast.FragmentSpread{Name: "ItemFields"},
						&ast.Field{
							Name:         "owner",
							SelectionSet: ast.SelectionSet{&ast.Field{Name: "id"}},
						},
					},
				},
			},
		},
		ast.FragmentDefinitionList{
			{
				Name:          "ItemFields",
				TypeCondition: "Item",
				SelectionSet: ast.SelectionSet{
					&ast.Field{Name: "name"},
				},
			},
		},
		"user",
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	primary := plan.GetPrimaryQueryForConnector("db2")
	if primary == nil {
		t.Fatal("expected user role to route items to db2")
	}

	if len(primary.CleanFragments) != 1 || primary.CleanFragments[0].Name != "ItemFields" {
		t.Fatalf(
			"expected user role to preserve db2-owned Item fragment, got %+v",
			primary.CleanFragments,
		)
	}
}

func TestPlan_OperationQualifiedRouting(t *testing.T) {
	t.Parallel()

	queryRoot := &ast.Definition{
		Kind: ast.Object,
		Name: "query_root",
		Fields: ast.FieldList{
			{Name: "foo", Type: ast.NamedType("String", nil)},
		},
	}
	mutationRoot := &ast.Definition{
		Kind: ast.Object,
		Name: "mutation_root",
		Fields: ast.FieldList{
			{Name: "foo", Type: ast.NamedType("String", nil)},
		},
	}
	schema := &ast.Schema{
		Types: map[string]*ast.Definition{
			"query_root":    queryRoot,
			"mutation_root": mutationRoot,
		},
		Query:    queryRoot,
		Mutation: mutationRoot,
	}
	p := planner.New(
		map[string]*ast.Schema{"admin": schema},
		fieldOwnersForRole("admin", map[string]string{
			schemamerge.FieldKey(ast.Query, "foo"):    "db",
			schemamerge.FieldKey(ast.Mutation, "foo"): "rs",
		}),
		typeOwnersForRole("admin", map[string][]string{}),
		map[string][]*planner.RelationshipMetadata{},
	)

	for _, tc := range []struct {
		name      string
		operation ast.Operation
		want      string
	}{
		{name: "query", operation: ast.Query, want: "db"},
		{name: "mutation", operation: ast.Mutation, want: "rs"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			plan, err := p.Plan(
				&ast.OperationDefinition{
					Operation:    tc.operation,
					SelectionSet: ast.SelectionSet{&ast.Field{Name: "foo"}},
				},
				nil,
				"admin",
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if len(plan.PrimaryQueries) != 1 || plan.PrimaryQueries[0].Connector != tc.want {
				t.Fatalf("expected %s primary query, got %+v", tc.want, plan.PrimaryQueries)
			}
		})
	}
}

func TestPlan_UnknownRoleReturnsSentinelError(t *testing.T) {
	t.Parallel()

	p := planner.New(
		map[string]*ast.Schema{},
		fieldOwnersForRole("admin", map[string]string{
			schemamerge.FieldKey(ast.Query, "users"): "db1",
		}),
		typeOwnersForRole("admin", typeOwners(map[string]string{"users": "db1"})),
		map[string][]*planner.RelationshipMetadata{},
	)

	op := &ast.OperationDefinition{
		Operation: ast.Query,
		Name:      "GetUsers",
		SelectionSet: ast.SelectionSet{
			&ast.Field{Name: "users"},
		},
	}

	plan, err := p.Plan(op, nil, "nonexistent_role")
	if !errors.Is(err, planner.ErrSchemaForRoleNotFound) {
		t.Fatalf("expected ErrSchemaForRoleNotFound, got %v", err)
	}

	if plan != nil {
		t.Errorf("expected nil plan when sentinel error returned, got %+v", plan)
	}
}

// Transform and InjectPhantomFields tests live in the transform subpackage
// (controller/planner/transform/transform_test.go) alongside the symbols.

// ---------- QueryPlan helpers ----------

func TestGetPrimaryQueryForConnector(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		plan          *planner.QueryPlan
		connector     string
		wantNil       bool
		wantConnector string
	}{
		{
			name: "found",
			plan: &planner.QueryPlan{
				PrimaryQueries: []*planner.PrimaryQuery{
					{
						Connector:      "db1",
						CleanOperation: nil,
						CleanFragments: nil,
						PhantomFields:  nil,
					},
					{
						Connector:      "db2",
						CleanOperation: nil,
						CleanFragments: nil,
						PhantomFields:  nil,
					},
				},
				RemoteQueries: nil,
			},
			connector:     "db2",
			wantNil:       false,
			wantConnector: "db2",
		},
		{
			name: "not found",
			plan: &planner.QueryPlan{
				PrimaryQueries: []*planner.PrimaryQuery{
					{
						Connector:      "db1",
						CleanOperation: nil,
						CleanFragments: nil,
						PhantomFields:  nil,
					},
				},
				RemoteQueries: nil,
			},
			connector:     "nonexistent",
			wantNil:       true,
			wantConnector: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			pq := tt.plan.GetPrimaryQueryForConnector(tt.connector)

			if tt.wantNil {
				if pq != nil {
					t.Errorf("expected nil for connector %q, got %+v", tt.connector, pq)
				}

				return
			}

			if pq == nil {
				t.Fatalf("expected to find primary query for %q", tt.connector)
			}

			if pq.Connector != tt.wantConnector {
				t.Errorf("expected connector %q, got %q", tt.wantConnector, pq.Connector)
			}
		})
	}
}

func TestHasRemoteQueries(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		plan *planner.QueryPlan
		want bool
	}{
		{
			name: "true with populated slice",
			plan: &planner.QueryPlan{
				PrimaryQueries: nil,
				RemoteQueries: []*planner.RemoteQueryPlan{
					{
						Name:                "department",
						SourceConnector:     "db1",
						SourcePath:          jsonpath.Parse("users"),
						TargetConnector:     "db2",
						TargetTable:         "departments",
						TargetTableSchema:   "public",
						JoinMapping:         map[string]string{"department_id": "id"},
						IsArray:             false,
						IsArrayAggregate:    false,
						OutputField:         "department",
						Selection:           nil,
						SourcePhantomFields: nil,
						ResolverType:        planner.ResolverKindDatabase,
						LHSFields:           nil,
						RemoteFieldPath:     nil,
					},
				},
			},
			want: true,
		},
		{
			name: "false with nil slice",
			plan: &planner.QueryPlan{
				PrimaryQueries: nil,
				RemoteQueries:  nil,
			},
			want: false,
		},
		{
			name: "false with empty slice",
			plan: &planner.QueryPlan{
				PrimaryQueries: nil,
				RemoteQueries:  []*planner.RemoteQueryPlan{},
			},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := tt.plan.HasRemoteQueries(); got != tt.want {
				t.Errorf("HasRemoteQueries() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestAllPhantomFieldSpecs_AggregatesFromAllPrimaryQueries(t *testing.T) {
	t.Parallel()

	plan := &planner.QueryPlan{
		PrimaryQueries: []*planner.PrimaryQuery{
			{
				Connector:      "db1",
				CleanOperation: nil,
				CleanFragments: nil,
				PhantomFields: []*planner.PhantomFieldSpec{
					{
						Path:            jsonpath.Parse("users"),
						Fields:          []string{"department_id"},
						ForRelationship: "department",
					},
				},
			},
			{
				Connector:      "db2",
				CleanOperation: nil,
				CleanFragments: nil,
				PhantomFields: []*planner.PhantomFieldSpec{
					{
						Path:            jsonpath.Parse("orders"),
						Fields:          []string{"customer_id"},
						ForRelationship: "customer",
					},
					{
						Path:            jsonpath.Parse("orders.items"),
						Fields:          []string{"product_id"},
						ForRelationship: "product",
					},
				},
			},
		},
		RemoteQueries: nil,
	}

	allSpecs := plan.AllPhantomFieldSpecs()

	if len(allSpecs) != 3 {
		t.Fatalf("expected 3 phantom field specs aggregated, got %d", len(allSpecs))
	}

	foundDeptID := false
	foundCustID := false
	foundProdID := false

	for _, spec := range allSpecs {
		for _, f := range spec.Fields {
			switch f {
			case "department_id":
				foundDeptID = true
			case "customer_id":
				foundCustID = true
			case "product_id":
				foundProdID = true
			}
		}
	}

	if !foundDeptID {
		t.Error("expected department_id in aggregated specs")
	}

	if !foundCustID {
		t.Error("expected customer_id in aggregated specs")
	}

	if !foundProdID {
		t.Error("expected product_id in aggregated specs")
	}
}

func TestAllPhantomFieldSpecs_EmptyWhenNoPhantoms(t *testing.T) {
	t.Parallel()

	plan := &planner.QueryPlan{
		PrimaryQueries: []*planner.PrimaryQuery{
			{
				Connector:      "db1",
				CleanOperation: nil,
				CleanFragments: nil,
				PhantomFields:  nil,
			},
		},
		RemoteQueries: nil,
	}

	allSpecs := plan.AllPhantomFieldSpecs()
	if len(allSpecs) != 0 {
		t.Errorf("expected 0 phantom field specs, got %d", len(allSpecs))
	}
}
