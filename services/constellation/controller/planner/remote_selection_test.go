package planner_test

import (
	"bytes"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	"github.com/nhost/nhost/services/constellation/controller/planner"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/formatter"
	"github.com/vektah/gqlparser/v2/validator/rules"
)

func TestPlanPolymorphicRemoteResultChildJoin(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name, directType, objects string
	}{
		{"union", "union Direct = Left | Right", "type Left { id: Int!, join_id: Int! }\n" +
			"type Right { id: Int!, local: RightItem }"},
		{"interface", "interface Direct { id: Int! }", "type Left implements Direct { id: Int!, join_id: Int! }\n" +
			"type Right implements Direct { id: Int!, local: RightItem }"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			p, composed, native := newPolymorphicRemoteResultPlanner(t, tc.directType, tc.objects)
			for _, query := range []struct {
				name, text string
			}{
				{"inline", `query { users { remote {
					... on Left { local { id } }
					... on Right { local { id } }
				} } }`},
				{"named", `query { users { remote { ...LeftFields ...RightFields } } }
					fragment LeftFields on Left { local { id } }
					fragment RightFields on Right { local { id } }`},
			} {
				for _, pruned := range []bool{false, true} {
					name := query.name
					if pruned {
						name += "/pruned"
					}

					t.Run(name, func(t *testing.T) {
						t.Parallel()
						checkPolymorphicRemoteResult(t, p, composed, native, query.text, pruned)
					})
				}
			}
		})
	}
}

func newPolymorphicRemoteResultPlanner(
	t *testing.T, directType, objects string,
) (*planner.QueryPlanner, *ast.Schema, *ast.Schema) {
	t.Helper()

	nativeSDL := `type Query { lookup(id: Int!): Direct }
		type RightItem { id: Int! }
		` + directType + "\n" + objects
	composedSDL := nativeSDL + `
		extend type Query { users: [User!]! }
		type User { id: Int!, remote: Direct }
		extend type Left { local: Target }
		type Target { id: Int! }`

	native, err := gqlparser.LoadSchema(&ast.Source{Input: nativeSDL})
	if err != nil {
		t.Fatal(err)
	}

	composed, err := gqlparser.LoadSchema(&ast.Source{Input: composedSDL})
	if err != nil {
		t.Fatal(err)
	}

	p := planner.New(
		map[string]*ast.Schema{"admin": composed},
		map[string]string{schemamerge.FieldKey(ast.Query, "users"): "db"},
		map[string][]string{
			"User": {"db"}, "Direct": {"remote"}, "Left": {"remote"},
			"Right": {"remote"}, "RightItem": {"remote"}, "Target": {"db"},
		},
		map[string][]*planner.RelationshipMetadata{
			"db": {
				{
					Name:            "remote",
					SourceType:      "User",
					TargetConnector: "remote",
					LHSFields: []string{
						"id",
					},
					RemoteFieldPath: []planner.RemoteFieldPathEntry{{FieldName: "lookup"}},
					IsRemote:        true,
				},
			},
			"remote": {{
				Name: "local", SourceType: "Left", TargetConnector: "db",
				TargetTable: "target", TargetTableSchema: "public",
				JoinMapping: map[string]string{"join_id": "id"}, IsRemote: true,
			}},
		},
	)

	return p, composed, native
}

func checkPolymorphicRemoteResult(
	t *testing.T, p *planner.QueryPlanner, composed, native *ast.Schema, query string, pruned bool,
) {
	t.Helper()

	doc, errs := gqlparser.LoadQueryWithRules(composed, query, rules.NewDefaultRules())
	if errs != nil {
		t.Fatal(errs)
	}

	if pruned {
		// controller.pruneField reallocates non-leaf fields without ObjectDefinition.
		clearRemoteObjectDefinitions(doc.Operations[0].SelectionSet)

		for _, frag := range doc.Fragments {
			clearRemoteObjectDefinitions(frag.SelectionSet)
		}
	}

	plan, err := p.Plan(doc.Operations[0], doc.Fragments, "admin", nil)
	if err != nil {
		t.Fatal(err)
	}

	var remote *planner.RemoteQueryPlan
	for _, candidate := range plan.RemoteQueries {
		if candidate.Name == "remote" {
			remote = candidate
		}
	}

	if remote == nil || len(plan.RemoteQueries) != 2 {
		t.Fatalf("expected parent and child remote plans, got %#v", plan.RemoteQueries)
	}

	forwarded := &ast.QueryDocument{Operations: ast.OperationList{{
		Operation: ast.Query,
		SelectionSet: ast.SelectionSet{&ast.Field{
			Name: "lookup",
			Arguments: ast.ArgumentList{
				{Name: "id", Value: &ast.Value{Kind: ast.IntValue, Raw: "1"}},
			},
			SelectionSet: remote.Selection.SelectionSet,
		}},
	}}}

	var buf bytes.Buffer
	formatter.NewFormatter(&buf).FormatQueryDocument(forwarded)

	text := buf.String()
	if !strings.Contains(text, "local") || !strings.Contains(text, "join_id") ||
		!strings.Contains(text, "on Right") || !strings.Contains(text, "on Left") {
		t.Fatalf("child join key/ordinary field not preserved: %s", text)
	}

	if _, errs := gqlparser.LoadQueryWithRules(native, text, rules.NewDefaultRules()); errs != nil {
		t.Fatalf("native remote rejected forwarded document: %v\n%s", errs, text)
	}
}

func clearRemoteObjectDefinitions(selections ast.SelectionSet) {
	for _, selection := range selections {
		switch s := selection.(type) {
		case *ast.Field:
			if len(s.SelectionSet) > 0 {
				s.ObjectDefinition = nil
				clearRemoteObjectDefinitions(s.SelectionSet)
			}
		case *ast.InlineFragment:
			clearRemoteObjectDefinitions(s.SelectionSet)
		}
	}
}
