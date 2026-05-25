package queries

import (
	"fmt"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

// typenameField is the GraphQL meta-field that resolves to the runtime type name.
const typenameField = "__typename"

type aggregateQuerySelection interface {
	Write(b *strings.Builder)
}

type countSelection struct{}

// Write emits the JSON key/value pair for a COUNT(*) aggregate.
func (c *countSelection) Write(b *strings.Builder) {
	b.WriteString("'count', COUNT(*)")
}

// typenameSelection emits a JSON key/value pair where the value is a literal
// GraphQL type name. Used to support __typename inside aggregate selections,
// where each scope (aggregate root, aggregate_fields, *_fields) has its own
// type name. The customization layer remaps the literal at result-walk time.
type typenameSelection struct {
	alias    string
	typeName string
}

func (s *typenameSelection) Write(b *strings.Builder) {
	b.WriteByte('\'')
	b.WriteString(s.alias)
	b.WriteString("', '")
	b.WriteString(s.typeName)
	b.WriteByte('\'')
}

type aggregateFunctionSelection struct {
	Columns         []*core.Column
	Typenames       []typenameSelection
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
	columns := make([]*core.Column, 0, len(selectionSet))

	var typenames []typenameSelection

	fieldsTypeName := t.graphqlTypeName + "_" + alias + "_fields"

	for _, colField := range selectionSet {
		f, ok := colField.(*ast.Field)
		if !ok {
			continue
		}

		if f.Name == typenameField {
			typenames = appendTypename(typenames, f, fieldsTypeName)

			continue
		}

		col := t.columnFromGraphqlName(f.Name)
		if col == nil {
			return nil, fmt.Errorf("%w: %s", errUnknownAggregateColumn, f.Name)
		}

		columns = append(columns, col)
	}

	return &aggregateFunctionSelection{
		Alias:           alias,
		FuncName:        funcName,
		Columns:         columns,
		Typenames:       typenames,
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

	first := true

	for _, col := range s.Columns {
		if !first {
			b.WriteString(", ")
		}

		b.WriteByte('\'')
		b.WriteString(col.GraphqlName)
		b.WriteString("', ")
		b.WriteString(s.FuncName)
		b.WriteByte('(')
		core.WriteQuotedIdentifier(b, col.SQLName)
		b.WriteByte(')')

		first = false
	}

	for i := range s.Typenames {
		if !first {
			b.WriteString(", ")
		}

		s.Typenames[i].Write(b)

		first = false
	}

	b.WriteString(")")
}

// aggregateSelectionCollector walks an aggregate root selection, accumulating
// the outer __typename entries, the aggregate-scope selections, and the merged
// `nodes` field. It is constructed once per call to astToAggregateSelection.
type aggregateSelectionCollector struct {
	table          *table
	fragments      ast.FragmentDefinitionList
	outerTypeName  string
	outerTypenames []typenameSelection
	sel            []aggregateQuerySelection
	nodesField     *ast.Field
	err            error
}

// collectFields walks a selection set, recursing through inline fragments and
// named fragment spreads, and dispatches concrete fields to collectField.
func (c *aggregateSelectionCollector) collectFields(selectionSet ast.SelectionSet) {
	if c.err != nil {
		return
	}

	for _, selection := range selectionSet {
		switch s := selection.(type) {
		case *ast.Field:
			c.collectField(s)
		case *ast.InlineFragment:
			c.collectFields(s.SelectionSet)
		case *ast.FragmentSpread:
			fragment := findFragment(c.fragments, s.Name)
			if fragment == nil {
				c.err = fmt.Errorf("fragment %q is not defined", s.Name) //nolint:err113

				return
			}

			c.collectFields(fragment.SelectionSet)
		}
	}
}

// collectField dispatches one concrete field at the aggregate-root scope:
// __typename, aggregate { ... }, or nodes { ... }.
func (c *aggregateSelectionCollector) collectField(s *ast.Field) {
	switch s.Name {
	case typenameField:
		c.outerTypenames = appendTypename(c.outerTypenames, s, c.outerTypeName)
	case "aggregate":
		aggSel, err := c.table.parseAggregateFields(s, c.fragments)
		if err != nil {
			c.err = err

			return
		}

		c.sel = append(c.sel, aggSel...)
	case "nodes":
		// Merge nodes fields according to GraphQL field selection merging.
		// Shallow-copy the first occurrence so appending to SelectionSet
		// does not mutate the original AST (avoids accumulating duplicates
		// when the same AST is processed more than once).
		if c.nodesField == nil {
			tmp := *s
			tmp.SelectionSet = append(ast.SelectionSet(nil), s.SelectionSet...)
			c.nodesField = &tmp
		} else {
			c.nodesField.SelectionSet = append(c.nodesField.SelectionSet, s.SelectionSet...)
		}
	}
}

func (t *table) astToAggregateSelection(
	field *ast.Field,
	fragments ast.FragmentDefinitionList,
) ([]typenameSelection, []aggregateQuerySelection, *ast.Field, error) {
	c := &aggregateSelectionCollector{
		table:          t,
		fragments:      fragments,
		outerTypeName:  t.graphqlTypeName + "_aggregate",
		outerTypenames: nil,
		sel:            nil,
		nodesField:     nil,
		err:            nil,
	}

	c.collectFields(field.SelectionSet)

	if c.err != nil {
		return nil, nil, nil, c.err
	}

	return c.outerTypenames, c.sel, c.nodesField, nil
}

// appendTypename appends a typenameSelection for the __typename meta-field,
// de-duplicating by output alias so the same alias is not emitted twice.
func appendTypename(
	dst []typenameSelection,
	field *ast.Field,
	typeName string,
) []typenameSelection {
	alias := field.Alias
	if alias == "" {
		alias = field.Name
	}

	if hasTypenameAlias(dst, alias) {
		return dst
	}

	return append(dst, typenameSelection{alias: alias, typeName: typeName})
}

func hasTypenameAlias(typenames []typenameSelection, alias string) bool {
	for i := range typenames {
		if typenames[i].alias == alias {
			return true
		}
	}

	return false
}

// hasTypenameAliasInSelections reports whether sel already contains a
// typenameSelection with the given output alias. Used to de-duplicate
// __typename entries appended to the heterogeneous aggregate_fields scope.
func hasTypenameAliasInSelections(sel []aggregateQuerySelection, alias string) bool {
	for _, s := range sel {
		ts, ok := s.(*typenameSelection)
		if !ok {
			continue
		}

		if ts.alias == alias {
			return true
		}
	}

	return false
}

// appendAggregateField appends the result of parsing a single aggregate-scope
// AST field (count, sum, avg, ..., or __typename) to sel. __typename is
// de-duplicated by output alias so duplicate selections (e.g. via overlapping
// fragments) do not emit duplicate JSON keys.
func (t *table) appendAggregateField(
	sel []aggregateQuerySelection,
	f *ast.Field,
	aggregateFieldsTypeName string,
) ([]aggregateQuerySelection, error) {
	switch f.Name {
	case typenameField:
		tnAlias := f.Alias
		if tnAlias == "" {
			tnAlias = f.Name
		}

		if hasTypenameAliasInSelections(sel, tnAlias) {
			return sel, nil
		}

		return append(sel, &typenameSelection{
			alias:    tnAlias,
			typeName: aggregateFieldsTypeName,
		}), nil
	case "count":
		return append(sel, &countSelection{}), nil
	case "sum", "avg", "max", "min", "stddev", "stddev_pop",
		"stddev_samp", "var_pop", "var_samp", "variance":
		a, err := newAggregateFunctionSelection(
			f.Name, strings.ToUpper(f.Name), t, f.SelectionSet,
		)
		if err != nil {
			return nil, err
		}

		return append(sel, a), nil
	}

	return sel, nil
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

	aggregateFieldsTypeName := t.graphqlTypeName + "_aggregate_fields"

	collectFields = func(selectionSet ast.SelectionSet) {
		if collectErr != nil {
			return
		}

		for _, selection := range selectionSet {
			switch s := selection.(type) {
			case *ast.Field:
				next, err := t.appendAggregateField(sel, s, aggregateFieldsTypeName)
				if err != nil {
					collectErr = err
					return
				}

				sel = next

			case *ast.InlineFragment:
				collectFields(s.SelectionSet)

			case *ast.FragmentSpread:
				fragment := findFragment(fragments, s.Name)
				if fragment == nil {
					collectErr = fmt.Errorf("fragment %q is not defined", s.Name) //nolint:err113
					return
				}

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
