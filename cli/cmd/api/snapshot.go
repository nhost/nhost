package api

import (
	_ "embed"
	"errors"
	"fmt"
	"maps"
	"slices"
	"strings"

	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
)

// Regeneration needs an nhost login session or NHOST_PAT and pins the user role.
// The CLI's Nix check regenerates this snapshot and rejects any changes.
//go:generate go run ./internal/schemagen --output cloud_schema.graphql

//go:embed cloud_schema.graphql
var snapshot string

var errInvalidSelection = errors.New("invalid schema selection")

type schemaSummary struct {
	Query    []string `json:"query"`
	Mutation []string `json:"mutation"`
}

func loadSnapshot() (*ast.Schema, error) {
	schema, err := gqlparser.LoadSchema(
		&ast.Source{Name: "cloud_schema.graphql", Input: snapshot, BuiltIn: false},
	)
	if err != nil {
		return nil, fmt.Errorf("loading bundled Cloud schema: %w", err)
	}

	return schema, nil
}

func summarize(schema *ast.Schema) schemaSummary {
	return schemaSummary{
		Query:    rootFieldNames(schema.Query),
		Mutation: rootFieldNames(schema.Mutation),
	}
}

func rootFieldNames(root *ast.Definition) []string {
	names := make([]string, 0, len(root.Fields))
	for _, field := range root.Fields {
		if !strings.HasPrefix(field.Name, "__") {
			names = append(names, field.Name)
		}
	}

	slices.Sort(names)

	return names
}

func subset(schema *ast.Schema, names []string, depth uint) (*ast.SchemaDocument, error) {
	queries, mutations, unknown := resolveRootFields(schema, names)
	if len(unknown) != 0 {
		problems := make([]string, len(unknown))
		for i, name := range unknown {
			problems[i] = fmt.Sprintf("unknown field %q", name)
		}

		return nil, fmt.Errorf("%w: %s", errInvalidSelection, strings.Join(problems, "; "))
	}

	doc := &ast.SchemaDocument{}     //nolint:exhaustruct
	roots := &ast.SchemaDefinition{} //nolint:exhaustruct
	addSelectedRoot(doc, roots, schema.Query, queries, ast.Query)
	addSelectedRoot(doc, roots, schema.Mutation, mutations, ast.Mutation)
	doc.Schema = ast.SchemaDefinitionList{roots}
	doc.Definitions = append(
		doc.Definitions,
		reachableDefinitions(schema, doc.Definitions, depth)...)

	return doc, nil
}

// resolveRootFields looks each name up as a query and as a mutation root field.
// A name that exists on both roots selects both. It returns the names found on
// neither root as unknown, sorted and without duplicates.
func resolveRootFields(schema *ast.Schema, names []string) ([]string, []string, []string) {
	var queries, mutations, unknown []string

	for _, name := range slices.Compact(slices.Sorted(slices.Values(names))) {
		inQuery := hasRootField(schema.Query, name)
		inMutation := hasRootField(schema.Mutation, name)

		if inQuery {
			queries = append(queries, name)
		}

		if inMutation {
			mutations = append(mutations, name)
		}

		if !inQuery && !inMutation {
			unknown = append(unknown, name)
		}
	}

	return queries, mutations, unknown
}

func hasRootField(root *ast.Definition, name string) bool {
	return !strings.HasPrefix(name, "__") && root.Fields.ForName(name) != nil
}

func addSelectedRoot(
	doc *ast.SchemaDocument, roots *ast.SchemaDefinition,
	root *ast.Definition, names []string, operation ast.Operation,
) {
	if len(names) == 0 {
		return
	}

	roots.OperationTypes = append(
		roots.OperationTypes,
		&ast.OperationTypeDefinition{ //nolint:exhaustruct
			Operation: operation, Type: root.Name,
		},
	)

	selected := *root
	selected.Fields = ast.FieldList{}

	for _, field := range root.Fields {
		if slices.Contains(names, field.Name) {
			selected.Fields = append(selected.Fields, field)
		}
	}

	doc.Definitions = append(doc.Definitions, &selected)
}

type typeVisit struct {
	definition *ast.Definition
	level      uint
}

func reachableDefinitions(
	schema *ast.Schema,
	roots ast.DefinitionList,
	depth uint,
) ast.DefinitionList {
	queue := make([]typeVisit, 0, len(roots))
	seen := make(map[string]bool)
	definitions := make(map[string]*ast.Definition)

	for _, root := range roots {
		queue = append(queue, typeVisit{definition: root, level: 0})
		seen[root.Name] = true
	}

	// FIFO traversal visits each type at its lowest level, including through cycles.
	for i := 0; i < len(queue); i++ {
		visit := queue[i]
		for _, name := range referencedTypes(schema, visit.definition) {
			def := schema.Types[name]
			if def.BuiltIn || seen[name] {
				continue
			}

			if def.IsLeafType() {
				definitions[name] = def
				seen[name] = true
			} else if visit.level < depth {
				definitions[name] = def
				seen[name] = true

				queue = append(queue, typeVisit{definition: def, level: visit.level + 1})
			}
		}
	}

	result := make(ast.DefinitionList, 0, len(definitions))
	for _, name := range slices.Sorted(maps.Keys(definitions)) {
		result = append(result, definitions[name])
	}

	return result
}

func referencedTypes(schema *ast.Schema, def *ast.Definition) []string {
	names := slices.Concat(def.Interfaces, def.Types)
	for _, field := range def.Fields {
		names = append(names, field.Type.Name())
		for _, arg := range field.Arguments {
			names = append(names, arg.Type.Name())
		}
	}

	if def.Kind == ast.Interface {
		for _, implementation := range schema.GetPossibleTypes(def) {
			names = append(names, implementation.Name)
		}
	}

	return names
}
