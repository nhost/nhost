package queries

import (
	"fmt"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

type columnSelection struct {
	alias   string
	column  *core.Column
	literal string // holds a literal value (e.g., __typename); could be generalized to an interface
}

type relationshipSelection struct {
	alias        string
	relationship *relationship
	field        *ast.Field
}

// astToQuerySelection builds the list of selected fields from the AST.
// Returns local columns and local relationships. Remote and remote-schema
// relationship fields are silently skipped here — the controller's planner
// strips them from the AST before this point, and re-derives the resolution
// info from metadata. Any remote field that slips through is dropped.
func (t *table) astToQuerySelection(
	field *ast.Field,
	fragments ast.FragmentDefinitionList,
) ([]columnSelection, []relationshipSelection, error) {
	return t.astToQuerySelectionWithPath(field, fragments, "")
}

// astToQuerySelectionWithPath is like astToQuerySelection but allows specifying a parent path prefix.
// This is used by mutations where the path needs to include the root field name
// (e.g., "insert_user_profiles.returning.user" instead of just "returning.user").
func (t *table) astToQuerySelectionWithPath( //nolint:funlen,cyclop,gocognit
	field *ast.Field,
	fragments ast.FragmentDefinitionList,
	parentPath string,
) ([]columnSelection, []relationshipSelection, error) {
	var (
		columns       []columnSelection
		relationships []relationshipSelection
		collectErr    error
		collectFields func(selectionSet ast.SelectionSet, currentPath string)
	)

	// Determine the field alias for path building
	fieldAlias := field.Alias
	if fieldAlias == "" {
		fieldAlias = field.Name
	}

	// Include parent path if provided (for mutations)
	basePath := fieldAlias
	if parentPath != "" {
		basePath = parentPath + "." + fieldAlias
	}

	collectFields = func(selectionSet ast.SelectionSet, currentPath string) {
		if collectErr != nil {
			return
		}

		for _, selection := range selectionSet {
			switch sel := selection.(type) {
			case *ast.Field:
				// Handle __typename introspection field
				if sel.Name == "__typename" {
					alias := sel.Alias
					if alias == "" {
						alias = sel.Name
					}

					if !hasColumnAlias(columns, alias) {
						columns = append(columns, columnSelection{
							alias:   alias,
							literal: t.graphqlTypeName,
							column:  nil,
						})
					}

					continue
				}

				if c := t.astToQuerySelectionColumn(sel); c != nil {
					if !hasColumnAlias(columns, c.alias) {
						columns = append(columns, *c)
					}

					continue
				}

				r, isRemote := t.astToQueryRelationships(sel)
				if isRemote {
					// Remote and remote-schema relationships are resolved by
					// the controller after SQL execution; skip them here.
					continue
				}

				if r != nil {
					// Merge relationships with the same alias
					merged := false
					for i := range relationships {
						if relationships[i].alias == r.alias {
							relationships[i].field.SelectionSet = append(
								relationships[i].field.SelectionSet, r.field.SelectionSet...,
							)
							merged = true

							break
						}
					}

					if !merged {
						relationships = append(relationships, *r)
					}

					continue
				}

				collectErr = fmt.Errorf("%w: %s", errFieldDoesNotExist, sel.Name)

			case *ast.InlineFragment:
				// Recursively collect fields from inline fragment
				collectFields(sel.SelectionSet, currentPath)

			case *ast.FragmentSpread:
				// Find and expand the named fragment
				fragment := findFragment(fragments, sel.Name)
				if fragment == nil {
					collectErr = fmt.Errorf("fragment %q is not defined", sel.Name) //nolint:err113
					return
				}
				// Recursively collect fields from the fragment
				collectFields(fragment.SelectionSet, currentPath)
			}
		}
	}

	collectFields(field.SelectionSet, basePath)

	if collectErr != nil {
		return nil, nil, collectErr
	}

	return columns, relationships, nil
}

func (t *table) astToQuerySelectionColumn(
	sel *ast.Field,
) *columnSelection {
	c := t.columnFromGraphqlName(sel.Name)
	if c == nil {
		return nil
	}

	alias := sel.Alias
	if alias == "" {
		alias = sel.Name
	}

	return &columnSelection{
		alias:   alias,
		column:  c,
		literal: "",
	}
}

// astToQueryRelationships looks up a relationship by GraphQL field name.
// Returns (selection, isRemote). A nil selection means the field is not a
// relationship on this table. isRemote is true for both remote database and
// remote schema relationships — these are resolved outside the SQL pipeline
// and must be skipped during selection collection.
func (t *table) astToQueryRelationships(
	sel *ast.Field,
) (*relationshipSelection, bool) {
	r := t.relationshipFromGraphqlName(sel.Name)
	if r == nil {
		return nil, false
	}

	if r.isRemote || r.isRemoteSchema {
		return nil, true
	}

	alias := sel.Alias
	if alias == "" {
		alias = sel.Name
	}

	return &relationshipSelection{
		alias:        alias,
		relationship: r,
		field:        sel,
	}, false
}

func hasColumnAlias(columns []columnSelection, alias string) bool {
	for i := range columns {
		if columns[i].alias == alias {
			return true
		}
	}

	return false
}

func findFragment(fragments ast.FragmentDefinitionList, name string) *ast.FragmentDefinition {
	for _, frag := range fragments {
		if frag.Name == name {
			return frag
		}
	}

	return nil
}
