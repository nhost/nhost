package planner_test

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	"github.com/nhost/nhost/services/constellation/controller/planner"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
)

// TestPlanDirectiveVariables exercises the planner on an unpruned document.
// WebSocket/HTTP normalization can remove excluded fields before planning,
// so this explicitly pins directive evaluation at the planning boundary.
func TestPlanDirectiveVariables(t *testing.T) {
	t.Parallel()

	schema := usersWithDepartmentSchemaAllRoots()

	p := makeAdminPlanner(schema,
		map[string]string{schemamerge.FieldKey(ast.Subscription, "users"): "db1"},
		typeOwners(map[string]string{"users": "db1", "departments": "db2"}),
		[]*planner.RelationshipMetadata{departmentRelationship()},
	)
	for _, tc := range []struct {
		name, selection string
		include         bool
		want            bool
	}{
		{"field included", `department @include(if:$x) { id }`, true, true},
		{"field excluded", `department @include(if:$x) { id }`, false, false},
		{"inline included", `... on users @include(if:$x) { department { id } }`, true, true},
		{"inline excluded", `... on users @include(if:$x) { department { id } }`, false, false},
		{"spread included", `...D @include(if:$x)`, true, true},
		{"spread excluded", `...D @include(if:$x)`, false, false},
		{"skip false", `...D @skip(if:$x)`, false, true},
		{"skip true", `...D @skip(if:$x)`, true, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			q := `subscription($x:Boolean!) { users { id ` + tc.selection + ` } }`
			if tc.name == "spread included" || tc.name == "spread excluded" ||
				tc.name == "skip false" || tc.name == "skip true" {
				q += ` fragment D on users { department { id } }`
			}

			doc, err := parser.ParseQuery(&ast.Source{Input: q})
			if err != nil {
				t.Fatal(err)
			}

			plan, err := p.Plan(
				doc.Operations[0],
				doc.Fragments,
				"admin",
				map[string]any{"x": tc.include},
			)
			if err != nil {
				t.Fatal(err)
			}

			if plan.HasRemoteQueries() != tc.want {
				t.Fatalf("remote plan=%t, want %t", plan.HasRemoteQueries(), tc.want)
			}
		})
	}
}

func TestPlanMergeRemoteSelectionsByResponsePath(t *testing.T) {
	t.Parallel()

	schema := usersWithDepartmentSchema()
	rel := departmentRelationship()
	p := makeAdminPlanner(schema,
		map[string]string{schemamerge.FieldKey(ast.Query, "users"): "db1"},
		typeOwners(map[string]string{"users": "db1", "departments": "db2"}),
		[]*planner.RelationshipMetadata{rel},
	)
	first := &ast.Field{Name: "department", SelectionSet: ast.SelectionSet{&ast.Field{Name: "id"}}}
	second := &ast.Field{
		Name:         "department",
		SelectionSet: ast.SelectionSet{&ast.Field{Name: "name"}},
	}
	op := &ast.OperationDefinition{Operation: ast.Query, SelectionSet: ast.SelectionSet{
		&ast.Field{Name: "users", SelectionSet: ast.SelectionSet{
			first,
			&ast.FragmentSpread{Name: "Fields"},
		}},
	}}
	fragments := ast.FragmentDefinitionList{&ast.FragmentDefinition{
		Name: "Fields", TypeCondition: "users", SelectionSet: ast.SelectionSet{second},
	}}

	plan, err := p.Plan(op, fragments, "admin", nil)
	if err != nil {
		t.Fatal(err)
	}

	if len(plan.RemoteQueries) != 1 {
		t.Fatalf("duplicate path issued %d target queries, want 1", len(plan.RemoteQueries))
	}

	selection := plan.RemoteQueries[0].Selection.SelectionSet
	if len(selection) != 2 {
		t.Fatalf("merged target selection = %#v", selection)
	}

	id, idOK := selection[0].(*ast.Field)

	name, nameOK := selection[1].(*ast.Field)
	if !idOK || !nameOK || id.Name != "id" || name.Name != "name" {
		t.Fatalf("merged target selection = %#v", selection)
	}

	if len(first.SelectionSet) != 1 || len(second.SelectionSet) != 1 ||
		plan.RemoteQueries[0].Selection == first {
		t.Fatal("cached field was replaced or mutated")
	}
}

func TestPlanRelationshipLookupIsConnectorScoped(t *testing.T) {
	t.Parallel()

	user := &ast.Definition{Kind: ast.Object, Name: "User", Fields: ast.FieldList{
		{Name: "id", Type: ast.NamedType("Int", nil)},
		{Name: "friend", Type: ast.NamedType("User", nil)},
	}}
	root := &ast.Definition{Kind: ast.Object, Name: "query_root", Fields: ast.FieldList{
		{Name: "a", Type: ast.NamedType("User", nil)},
		{Name: "b", Type: ast.NamedType("User", nil)},
	}}
	schema := &ast.Schema{Types: map[string]*ast.Definition{
		"User": user, "query_root": root,
	}, Query: root}
	p := planner.New(map[string]*ast.Schema{"admin": schema}, map[string]string{
		schemamerge.FieldKey(ast.Query, "a"): "one",
		schemamerge.FieldKey(ast.Query, "b"): "two",
	}, map[string][]string{"User": {"one", "two"}},
		map[string][]*planner.RelationshipMetadata{
			"one": {{
				Name: "friend", SourceType: "User", TargetConnector: "two",
				JoinMapping: map[string]string{"id": "id"}, IsRemote: true,
			}},
			"two": {{
				Name: "friend", SourceType: "User", TargetConnector: "one",
				JoinMapping: map[string]string{"id": "id"}, IsRemote: true,
			}},
		})
	friend := func() *ast.Field {
		return &ast.Field{Name: "friend", SelectionSet: ast.SelectionSet{
			&ast.Field{Name: "friend", SelectionSet: ast.SelectionSet{&ast.Field{Name: "id"}}},
		}}
	}
	op := &ast.OperationDefinition{Operation: ast.Query, SelectionSet: ast.SelectionSet{
		&ast.Field{Name: "a", SelectionSet: ast.SelectionSet{friend()}},
		&ast.Field{Name: "b", SelectionSet: ast.SelectionSet{friend()}},
	}}

	plan, err := p.Plan(op, nil, "admin", nil)
	if err != nil {
		t.Fatal(err)
	}

	if len(plan.RemoteQueries) != 4 {
		t.Fatalf("remote plans = %d, want 4", len(plan.RemoteQueries))
	}

	for _, rq := range plan.RemoteQueries {
		wantSource := "one"
		if rq.SourcePath[0] == "b" || len(rq.SourcePath) > 1 && rq.SourcePath[0] == "a" {
			wantSource = "two"
		}

		if len(rq.SourcePath) > 1 && rq.SourcePath[0] == "b" {
			wantSource = "one"
		}

		if rq.SourceConnector != wantSource || rq.TargetConnector == wantSource {
			t.Fatalf("path %s source=%s target=%s, want source %s",
				rq.SourcePath, rq.SourceConnector, rq.TargetConnector, wantSource)
		}
	}
}
