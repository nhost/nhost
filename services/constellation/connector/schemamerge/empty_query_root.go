package schemamerge

import (
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/vektah/gqlparser/v2/ast"
)

const (
	// EmptyQueryField is the Hasura-compatible fallback on a queryless role.
	EmptyQueryField = "no_queries_available"
	// EmptyQueryMessage is both the field's description and its constant result.
	EmptyQueryMessage = "There are no queries available to the current role. " +
		"Either there are no sources or remote schemas configured, " +
		"or the current role doesn't have the required permissions."
)

// BuildComposedSchema validates a merged role schema and reports whether it
// added the local fallback query. Connector schemas must not add the fallback:
// only the merged schema shows whether the role has any real query fields.
func BuildComposedSchema(
	combined *graph.Schema,
	role string,
) (*ast.SchemaDocument, *ast.Schema, bool, error) {
	var emptyQueryRoot bool

	doc, validated, err := buildValidatedSchema(combined, role, func(doc *ast.SchemaDocument) {
		emptyQueryRoot = addEmptyQueryRoot(doc)
	})
	if err != nil {
		return nil, nil, false, err
	}

	return doc, validated, emptyQueryRoot, nil
}

func addEmptyQueryRoot(doc *ast.SchemaDocument) bool {
	if len(doc.Schema) == 0 {
		if query := doc.Definitions.ForName("Query"); query != nil {
			return fillEmptyQueryRoot(query)
		}

		// An explicit schema definition disables default operation names.
		// Preserve any existing implicit mutation and subscription roots.
		def := &ast.SchemaDefinition{} //nolint:exhaustruct // no source location for generated schema
		for _, op := range []struct {
			kind ast.Operation
			name string
		}{
			{kind: ast.Mutation, name: "Mutation"},
			{kind: ast.Subscription, name: "Subscription"},
		} {
			if doc.Definitions.ForName(op.name) != nil {
				def.OperationTypes = append(def.OperationTypes, operationType(op.kind, op.name))
			}
		}

		doc.Schema = append(doc.Schema, def)
	}

	schema := doc.Schema[0]
	for _, op := range schema.OperationTypes {
		if op.Operation == ast.Query {
			return fillEmptyQueryRoot(doc.Definitions.ForName(op.Type))
		}
	}

	// Don't shadow a connector type that happens to be named query_root.
	name := "query_root"
	for doc.Definitions.ForName(name) != nil {
		name += "_"
	}

	root := &ast.Definition{Kind: ast.Object, Name: name} //nolint:exhaustruct // no source location
	fillEmptyQueryRoot(root)
	doc.Definitions = append(doc.Definitions, root)
	schema.OperationTypes = append(schema.OperationTypes, operationType(ast.Query, name))

	return true
}

func fillEmptyQueryRoot(root *ast.Definition) bool {
	if root == nil || root.Kind != ast.Object || len(root.Fields) != 0 {
		return false
	}

	root.Fields = ast.FieldList{
		&ast.FieldDefinition{ //nolint:exhaustruct // plain generated scalar field
			Name:        EmptyQueryField,
			Description: EmptyQueryMessage,
			Type:        ast.NonNullNamedType("String", nil),
		},
	}

	return true
}

func operationType(kind ast.Operation, name string) *ast.OperationTypeDefinition {
	return &ast.OperationTypeDefinition{
		Operation: kind,
		Type:      name,
		Position:  nil,
		Comment:   nil,
	}
}
