package graph_test

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/graph"
)

func TestPruneUnreachableTypes_DirectiveArgumentTypes(t *testing.T) {
	t.Parallel()

	queryType := "Query"
	schema := &graph.Schema{
		Types: []*graph.ObjectType{
			{
				Name: "Query",
				Fields: []*graph.Field{
					{
						Name: "hello",
						Type: graph.NewNamedType("String"),
					},
				},
			},
		},
		Enums: []*graph.EnumType{
			{
				Name: "PolicyEnum",
				Values: []*graph.EnumValue{
					{Name: "ALLOW"},
					{Name: "DENY"},
				},
			},
			{
				Name: "UnusedEnum",
				Values: []*graph.EnumValue{
					{Name: "A"},
				},
			},
		},
		Directives: []*graph.DirectiveDefinition{
			{
				Name: "auth",
				Arguments: []*graph.Argument{
					{
						Name: "policy",
						Type: graph.NewNonNullType("PolicyEnum"),
					},
				},
				Locations: []graph.DirectiveLocation{graph.LocationField},
			},
		},
		QueryType: &queryType,
	}

	schema.PruneUnreachableTypes()

	// PolicyEnum should be retained because it's referenced by @auth directive argument
	foundPolicy := false
	foundUnused := false

	for _, e := range schema.Enums {
		switch e.Name {
		case "PolicyEnum":
			foundPolicy = true
		case "UnusedEnum":
			foundUnused = true
		}
	}

	if !foundPolicy {
		t.Error("PolicyEnum was pruned but should be reachable via directive argument")
	}

	if foundUnused {
		t.Error("UnusedEnum should have been pruned")
	}
}

func TestPruneUnreachableTypes_InterfaceImplementors(t *testing.T) {
	t.Parallel()

	queryType := "Query"
	schema := &graph.Schema{
		Types: []*graph.ObjectType{
			{
				Name: "Query",
				Fields: []*graph.Field{
					{
						Name: "node",
						Type: graph.NewNamedType("Node"),
					},
				},
				Interfaces: nil,
				Directives: nil,
			},
			{
				Name: "User",
				Fields: []*graph.Field{
					{
						Name: "id",
						Type: graph.NewNonNullType("ID"),
					},
				},
				Interfaces: []string{"Node"},
				Directives: nil,
			},
			{
				Name: "Post",
				Fields: []*graph.Field{
					{
						Name: "id",
						Type: graph.NewNonNullType("ID"),
					},
				},
				Interfaces: []string{"Node"},
				Directives: nil,
			},
			{
				Name: "Comment",
				Fields: []*graph.Field{
					{
						Name: "id",
						Type: graph.NewNonNullType("ID"),
					},
				},
				Interfaces: []string{"Resource"},
				Directives: nil,
			},
			{
				Name:       "Orphan",
				Fields:     []*graph.Field{{Name: "id", Type: graph.NewNonNullType("ID")}},
				Interfaces: nil,
				Directives: nil,
			},
		},
		Interfaces: []*graph.InterfaceType{
			{
				Name: "Node",
				Fields: []*graph.Field{
					{
						Name: "id",
						Type: graph.NewNonNullType("ID"),
					},
				},
				Interfaces: nil,
				Directives: nil,
			},
			{
				Name: "Resource",
				Fields: []*graph.Field{
					{
						Name: "id",
						Type: graph.NewNonNullType("ID"),
					},
				},
				Interfaces: []string{"Node"},
				Directives: nil,
			},
		},
		QueryType: &queryType,
	}

	schema.PruneUnreachableTypes()

	typeNames := make(map[string]struct{}, len(schema.Types))
	for _, typ := range schema.Types {
		typeNames[typ.Name] = struct{}{}
	}

	for _, name := range []string{"Query", "User", "Post", "Comment"} {
		if _, ok := typeNames[name]; !ok {
			t.Errorf("expected %s to survive pruning", name)
		}
	}

	if _, ok := typeNames["Orphan"]; ok {
		t.Error("expected Orphan to be pruned")
	}
}

func TestPruneUnreachableTypes_ObjectInterfaceEdgeDoesNotReachSiblingImplementors(t *testing.T) {
	t.Parallel()

	queryType := "Query"
	schema := &graph.Schema{
		Types: []*graph.ObjectType{
			{
				Name: "Query",
				Fields: []*graph.Field{
					{
						Name: "user",
						Type: graph.NewNamedType("User"),
					},
				},
			},
			{
				Name: "User",
				Fields: []*graph.Field{
					{
						Name: "id",
						Type: graph.NewNonNullType("ID"),
					},
				},
				Interfaces: []string{"Node"},
			},
			{
				Name: "Post",
				Fields: []*graph.Field{
					{
						Name: "id",
						Type: graph.NewNonNullType("ID"),
					},
				},
				Interfaces: []string{"Node"},
			},
		},
		Interfaces: []*graph.InterfaceType{
			{
				Name: "Node",
				Fields: []*graph.Field{
					{
						Name: "id",
						Type: graph.NewNonNullType("ID"),
					},
				},
			},
		},
		QueryType: &queryType,
	}

	schema.PruneUnreachableTypes()

	typeNames := make(map[string]struct{}, len(schema.Types))
	for _, typ := range schema.Types {
		typeNames[typ.Name] = struct{}{}
	}

	for _, name := range []string{"Query", "User"} {
		if _, ok := typeNames[name]; !ok {
			t.Errorf("expected %s to survive pruning", name)
		}
	}

	if _, ok := typeNames["Post"]; ok {
		t.Error("expected Post to be pruned")
	}

	interfaceNames := make(map[string]struct{}, len(schema.Interfaces))
	for _, iface := range schema.Interfaces {
		interfaceNames[iface.Name] = struct{}{}
	}

	if _, ok := interfaceNames["Node"]; !ok {
		t.Error("expected Node interface to survive pruning")
	}
}
