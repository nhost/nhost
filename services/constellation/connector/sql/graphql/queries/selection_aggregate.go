package queries

import (
	"fmt"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

type aggregateQuerySelection interface {
	Write(b *strings.Builder)
}

type countSelection struct{}

// Write emits the JSON key/value pair for a COUNT(*) aggregate.
func (c *countSelection) Write(b *strings.Builder) {
	b.WriteString("'count', COUNT(*)")
}

type aggregateFunctionSelection struct {
	Columns         []*core.Column
	Alias           string
	FuncName        string
	jsonBuildObject string
}

func newAggregateFunctionSelection(
	alias string,
	funcName string,
	t *table,
	selectionSet ast.SelectionSet,
) (*aggregateFunctionSelection, error) {
	columns := make([]*core.Column, len(selectionSet))
	for j, colField := range selectionSet {
		if f, ok := colField.(*ast.Field); ok {
			col := t.columnFromGraphqlName(f.Name)
			if col == nil {
				return nil, fmt.Errorf("unknown column: %s", f.Name)
			}

			columns[j] = col
		}
	}

	return &aggregateFunctionSelection{
		Alias:           alias,
		FuncName:        funcName,
		Columns:         columns,
		jsonBuildObject: t.dialect.JSONBuildObject(),
	}, nil
}

// Write emits a JSON key/value pair where the value is a nested object of
// per-column aggregate results, e.g. 'sum', json_build_object('col', SUM(col)).
func (s *aggregateFunctionSelection) Write(b *strings.Builder) {
	b.WriteByte('\'')
	b.WriteString(s.Alias)
	b.WriteString("', ")
	b.WriteString(s.jsonBuildObject)
	b.WriteByte('(')

	for i, col := range s.Columns {
		if i > 0 {
			b.WriteString(", ")
		}

		b.WriteByte('\'')
		b.WriteString(col.GraphqlName)
		b.WriteString("', ")
		b.WriteString(s.FuncName)
		b.WriteByte('(')
		core.WriteQuotedIdentifier(b, col.SQLName)
		b.WriteByte(')')
	}

	b.WriteString(")")
}

func (t *table) astToAggregateSelection(
	field *ast.Field,
	fragments ast.FragmentDefinitionList,
) ([]aggregateQuerySelection, *ast.Field, error) {
	var (
		nodesField    *ast.Field
		sel           []aggregateQuerySelection
		collectErr    error
		collectFields func(selectionSet ast.SelectionSet)
	)

	collectFields = func(selectionSet ast.SelectionSet) {
		if collectErr != nil {
			return
		}

		for _, selection := range selectionSet {
			switch s := selection.(type) {
			case *ast.Field:
				switch s.Name {
				case "aggregate":
					// Parse aggregate sub-selections and append them (merge)
					aggSel, err := t.parseAggregateFields(s, fragments)
					if err != nil {
						collectErr = err
						return
					}

					sel = append(sel, aggSel...)
				case "nodes":
					// Merge nodes fields according to GraphQL field selection merging.
					// Shallow-copy the first occurrence so appending to SelectionSet
					// does not mutate the original AST (avoids accumulating duplicates
					// when the same AST is processed more than once).
					if nodesField == nil {
						tmp := *s
						tmp.SelectionSet = append(ast.SelectionSet(nil), s.SelectionSet...)
						nodesField = &tmp
					} else {
						nodesField.SelectionSet = append(nodesField.SelectionSet, s.SelectionSet...)
					}
				}

			case *ast.InlineFragment:
				// Recursively collect fields from inline fragment
				collectFields(s.SelectionSet)

			case *ast.FragmentSpread:
				// Find and expand the named fragment
				fragment := findFragment(fragments, s.Name)
				if fragment == nil {
					collectErr = fmt.Errorf("fragment %q is not defined", s.Name) //nolint:err113
					return
				}
				// Recursively collect fields from the fragment
				collectFields(fragment.SelectionSet)
			}
		}
	}

	collectFields(field.SelectionSet)

	if collectErr != nil {
		return nil, nil, collectErr
	}

	return sel, nodesField, nil
}

// parseAggregateFields parses the aggregate { ... } selection.
func (t *table) parseAggregateFields(
	field *ast.Field,
	fragments ast.FragmentDefinitionList,
) ([]aggregateQuerySelection, error) {
	var (
		sel           []aggregateQuerySelection
		collectErr    error
		collectFields func(selectionSet ast.SelectionSet)
	)

	collectFields = func(selectionSet ast.SelectionSet) {
		if collectErr != nil {
			return
		}

		for _, selection := range selectionSet {
			switch s := selection.(type) {
			case *ast.Field:
				switch s.Name {
				case "count":
					sel = append(sel, &countSelection{})
				case "sum", "avg", "max", "min", "stddev", "stddev_pop",
					"stddev_samp", "var_pop", "var_samp", "variance":
					a, err := newAggregateFunctionSelection(
						s.Name, strings.ToUpper(s.Name), t, s.SelectionSet,
					)
					if err != nil {
						collectErr = err
						return
					}

					sel = append(sel, a)
				}

			case *ast.InlineFragment:
				// Recursively collect fields from inline fragment
				collectFields(s.SelectionSet)

			case *ast.FragmentSpread:
				// Find and expand the named fragment
				fragment := findFragment(fragments, s.Name)
				if fragment == nil {
					collectErr = fmt.Errorf("fragment %q is not defined", s.Name) //nolint:err113
					return
				}
				// Recursively collect fields from the fragment
				collectFields(fragment.SelectionSet)
			}
		}
	}

	collectFields(field.SelectionSet)

	if collectErr != nil {
		return nil, collectErr
	}

	return sel, nil
}
