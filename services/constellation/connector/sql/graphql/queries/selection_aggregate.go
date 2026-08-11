package queries

import (
	"fmt"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/values"
)

// typenameField is the GraphQL meta-field that resolves to the runtime type name.
const typenameField = "__typename"

// varianceAggregateFuncs is the subset of aggregate-selection functions backed
// by a native stddev/variance SQL aggregate. Backends without them (SQLite) gate
// these via dialect.SupportsVarianceAggregates: schema generation omits the
// fields and the selection builder rejects them. avg/sum/max/min are absent
// because they are native on every supported backend.
//
//nolint:gochecknoglobals // immutable lookup table.
var varianceAggregateFuncs = map[string]bool{
	"stddev":      true,
	"stddev_pop":  true,
	"stddev_samp": true,
	"var_pop":     true,
	"var_samp":    true,
	"variance":    true,
}

type aggregateQuerySelection interface {
	Write(b *strings.Builder)
}

// countSelection emits the `count` aggregate. With no columns it renders
// COUNT(*); with one or more columns it renders the dialect-specific equivalent
// of COUNT(c) / COUNT(DISTINCT (c1, c2)), matching Hasura's
// count(columns:[...], distinct:...) translation. Columns are resolved against
// the table at parse time, so rendering only ever emits known identifiers.
type countSelection struct {
	columns []*core.Column
	dialect dialect.Dialect
	// responseName is the JSON key for this count entry: the field alias if
	// present, otherwise the field name ("count"). Storing it lets a single
	// aggregate block select multiple count variants under distinct keys, e.g.
	// `total: count` and `distinct_budget: count(columns:[budget], distinct:true)`.
	responseName string
	distinct     bool
}

// Write emits the JSON key/value pair for the count aggregate, referencing
// columns unqualified (the enclosing SELECT has a single table in scope, like
// the sibling sum/avg selections).
func (c *countSelection) Write(b *strings.Builder) {
	c.write(b, "")
}

// write emits the count aggregate qualifying each column against source. An
// empty source leaves columns unqualified; the grouped-aggregate path passes
// the base CTE alias so COUNT references resolve after the LEFT JOIN.
//
// Multi-column count rendering is delegated to the dialect: PostgreSQL uses a
// row constructor, while SQLite uses a JSON tuple key because it rejects row
// values in COUNT. The grouped path adds an explicit FILTER to preserve
// zero-count semantics for synthesized empty-group rows.
func (c *countSelection) write(b *strings.Builder, source string) {
	b.WriteByte('\'')
	b.WriteString(c.responseName)
	b.WriteString("', ")
	c.writeCountExpr(b, source)
}

// writeFiltered emits the count aggregate with a FILTER that excludes the
// grouped-aggregate synthetic LEFT JOIN row. This matters for multi-column
// counts, where PostgreSQL row constructors and SQLite tuple keys are non-null
// even when every target column in the synthetic row is NULL.
func (c *countSelection) writeFiltered(
	b *strings.Builder, source string, filterColumn *core.Column,
) {
	c.write(b, source)
	b.WriteString(" FILTER (WHERE ")
	core.WriteQualifiedColumn(b, source, filterColumn.SQLName)
	b.WriteString(" IS NOT NULL)")
}

func (c *countSelection) writeCountExpr(b *strings.Builder, source string) {
	c.dialect.WriteCountAggregate(b, c.distinct, c.columnExpressions(source))
}

func (c *countSelection) columnExpressions(source string) []string {
	if len(c.columns) == 0 {
		return nil
	}

	expressions := make([]string, 0, len(c.columns))

	for _, col := range c.columns {
		var expr strings.Builder

		core.WriteQualifiedColumn(&expr, source, col.SQLName)
		expressions = append(expressions, expr.String())
	}

	return expressions
}

// typenameSelection emits a JSON key/value pair where the value is a literal
// GraphQL type name. Used to support __typename in SQL-built selection scopes
// whose type name is known while building the query. The customization layer
// remaps the literal at result-walk time.
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

// aggregateColumnSelection is one column inside an aggregate function
// selection. responseName is the GraphQL response key for that column: the
// alias when present, otherwise the column field name.
type aggregateColumnSelection struct {
	responseName string
	column       *core.Column
}

type aggregateFunctionSelection struct {
	Columns   []aggregateColumnSelection
	Typenames []typenameSelection
	// responseName is the JSON key for this aggregate sub-object: the field
	// alias if present, otherwise the field name ("sum", "avg", ...). Storing
	// it (rather than the field name) lets a single aggregate block select the
	// same function over different columns under distinct keys, e.g.
	// `total_budget: sum { budget }` and `total_id: sum { id }`; without it the
	// generated json_build_object would emit a duplicate "sum" key and
	// PostgreSQL would keep only the last value.
	responseName    string
	FuncName        string
	dialect         dialect.Dialect
	jsonBuildObject string
}

func newAggregateFunctionSelection(
	fieldName string,
	responseName string,
	funcName string,
	t *table,
	selectionSet ast.SelectionSet,
	fragments ast.FragmentDefinitionList,
) (*aggregateFunctionSelection, error) {
	columns := make([]aggregateColumnSelection, 0, len(selectionSet))
	fieldsTypeName := t.graphqlTypeName + "_" + fieldName + "_fields"

	var (
		typenames     []typenameSelection
		collectErr    error
		collectFields func(ss ast.SelectionSet)
	)

	collectFields = func(ss ast.SelectionSet) {
		if collectErr != nil {
			return
		}

		for _, sel := range ss {
			switch s := sel.(type) {
			case *ast.Field:
				if s.Name == typenameField {
					typenames = appendTypename(typenames, s, fieldsTypeName)
					continue
				}

				columns, collectErr = t.appendAggregateFunctionColumn(columns, s)
				if collectErr != nil {
					return
				}

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

	collectFields(selectionSet)

	if collectErr != nil {
		return nil, collectErr
	}

	return &aggregateFunctionSelection{
		responseName:    responseName,
		FuncName:        funcName,
		dialect:         t.dialect,
		Columns:         columns,
		Typenames:       typenames,
		jsonBuildObject: t.dialect.JSONBuildObject(),
	}, nil
}

func (t *table) appendAggregateFunctionColumn(
	columns []aggregateColumnSelection,
	field *ast.Field,
) ([]aggregateColumnSelection, error) {
	col := t.columnFromGraphqlName(field.Name)
	if col == nil {
		return nil, fmt.Errorf("%w: %s", errUnknownAggregateColumn, field.Name)
	}

	columnResponseName := fieldResponseName(field)
	if hasAggregateColumnResponseName(columns, columnResponseName) {
		return columns, nil
	}

	return append(columns, aggregateColumnSelection{
		responseName: columnResponseName,
		column:       col,
	}), nil
}

func hasAggregateColumnResponseName(columns []aggregateColumnSelection, responseName string) bool {
	for i := range columns {
		if columns[i].responseName == responseName {
			return true
		}
	}

	return false
}

func aggregateColumnExpression(funcName, source string, column *core.Column) string {
	var b strings.Builder

	b.WriteString(funcName)
	b.WriteByte('(')
	core.WriteQualifiedColumn(&b, source, column.SQLName)
	b.WriteByte(')')

	return b.String()
}

// Write emits a JSON key/value pair where the value is a nested object of
// per-column aggregate results, e.g. 'sum', json_build_object('col', SUM(col)).
// The key is the field's response name (alias if present, otherwise the field
// name) so aliased and repeated same-function selections get distinct keys.
func (s *aggregateFunctionSelection) Write(b *strings.Builder) {
	s.write(b, "")
}

// write emits the aggregate function selection, qualifying each SQL column
// against source when source is non-empty. The grouped aggregate builder passes
// its active CTE alias here so function aggregates read the same row source as
// count and nodes selections.
func (s *aggregateFunctionSelection) write(b *strings.Builder, source string) {
	b.WriteByte('\'')
	b.WriteString(s.responseName)
	b.WriteString("', ")
	b.WriteString(s.jsonBuildObject)
	b.WriteByte('(')

	first := true

	for _, colSel := range s.Columns {
		if !first {
			b.WriteString(", ")
		}

		b.WriteByte('\'')
		b.WriteString(colSel.responseName)
		b.WriteString("', ")

		expr := aggregateColumnExpression(s.FuncName, source, colSel.column)
		b.WriteString(outputColumnExpression(s.dialect, expr, colSel.column))

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

// aggregateFieldSelection is one `aggregate` field at the aggregate-root
// scope. responseName is the field alias if present, otherwise "aggregate".
type aggregateFieldSelection struct {
	responseName string
	selections   []aggregateQuerySelection
}

// aggregateNodesSelection is one `nodes` field at the aggregate-root scope.
// responseName is the field alias if present, otherwise "nodes".
type aggregateNodesSelection struct {
	responseName string
	field        *ast.Field
}

// aggregateSelectionCollector walks an aggregate root selection, accumulating
// the outer __typename entries plus aggregate/nodes fields keyed by response
// name. It is constructed once per call to astToAggregateSelection.
type aggregateSelectionCollector struct {
	table           *table
	fragments       ast.FragmentDefinitionList
	variables       map[string]any
	outerTypeName   string
	outerTypenames  []typenameSelection
	aggregateFields []aggregateFieldSelection
	nodesFields     []aggregateNodesSelection
	err             error
}

// collectFields walks a selection set, recursing through inline fragments and
// named fragment spreads, and dispatches concrete fields to collectField.
func (c *aggregateSelectionCollector) collectFields(selectionSet ast.SelectionSet) {
	if c.err != nil {
		return
	}

	for _, selection := range selectionSet {
		if c.err != nil {
			return
		}

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
		aggSel, err := c.table.parseAggregateFields(s, c.fragments, c.variables)
		if err != nil {
			c.err = err

			return
		}

		c.mergeAggregateField(fieldResponseName(s), aggSel)
	case "nodes":
		c.mergeNodesField(fieldResponseName(s), s)
	}
}

func (c *aggregateSelectionCollector) mergeAggregateField(
	responseName string, selections []aggregateQuerySelection,
) {
	for i := range c.aggregateFields {
		if c.aggregateFields[i].responseName == responseName {
			c.aggregateFields[i].selections = append(
				c.aggregateFields[i].selections, selections...,
			)

			return
		}
	}

	c.aggregateFields = append(c.aggregateFields, aggregateFieldSelection{
		responseName: responseName,
		selections:   selections,
	})
}

func (c *aggregateSelectionCollector) mergeNodesField(responseName string, field *ast.Field) {
	for i := range c.nodesFields {
		if c.nodesFields[i].responseName == responseName {
			c.nodesFields[i].field.SelectionSet = append(
				c.nodesFields[i].field.SelectionSet, field.SelectionSet...,
			)

			return
		}
	}

	// Shallow-copy the first occurrence so appending to SelectionSet does not
	// mutate the original AST (avoids accumulating duplicates when the same AST
	// is processed more than once).
	tmp := *field
	tmp.SelectionSet = append(ast.SelectionSet(nil), field.SelectionSet...)
	c.nodesFields = append(c.nodesFields, aggregateNodesSelection{
		responseName: responseName,
		field:        &tmp,
	})
}

func (t *table) astToAggregateSelection(
	field *ast.Field,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
) ([]typenameSelection, []aggregateFieldSelection, []aggregateNodesSelection, error) {
	c := &aggregateSelectionCollector{
		table:           t,
		fragments:       fragments,
		variables:       variables,
		outerTypeName:   t.graphqlTypeName + "_aggregate",
		outerTypenames:  nil,
		aggregateFields: nil,
		nodesFields:     nil,
		err:             nil,
	}

	c.collectFields(field.SelectionSet)

	if c.err != nil {
		return nil, nil, nil, c.err
	}

	return c.outerTypenames, c.aggregateFields, c.nodesFields, nil
}

func fieldResponseName(field *ast.Field) string {
	if field.Alias != "" {
		return field.Alias
	}

	return field.Name
}

// appendTypename appends a typenameSelection for the __typename meta-field,
// de-duplicating by output alias so the same alias is not emitted twice.
func appendTypename(
	dst []typenameSelection,
	field *ast.Field,
	typeName string,
) []typenameSelection {
	alias := fieldResponseName(field)

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
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
) ([]aggregateQuerySelection, error) {
	switch f.Name {
	case typenameField:
		tnAlias := fieldResponseName(f)

		if hasTypenameAliasInSelections(sel, tnAlias) {
			return sel, nil
		}

		return append(sel, &typenameSelection{
			alias:    tnAlias,
			typeName: aggregateFieldsTypeName,
		}), nil
	case "count":
		cs, err := t.parseCountSelection(f, variables)
		if err != nil {
			return nil, err
		}

		return append(sel, cs), nil
	case "sum", "avg", "max", "min", "stddev", "stddev_pop",
		"stddev_samp", "var_pop", "var_samp", "variance":
		// The stddev/variance family is rejected on backends without those
		// aggregate functions (SQLite). Schema generation already omits these
		// fields, so a schema-validated request never reaches this branch; this
		// is a defensive backstop for callers that bypass validation, converting
		// an opaque "no such function" execution error into a clear typed error.
		if varianceAggregateFuncs[f.Name] && !t.dialect.SupportsVarianceAggregates() {
			return nil, fmt.Errorf("%w: %s", ErrUnsupportedVarianceAggregate, f.Name)
		}

		responseName := fieldResponseName(f)

		a, err := newAggregateFunctionSelection(
			f.Name, responseName, strings.ToUpper(f.Name), t, f.SelectionSet, fragments,
		)
		if err != nil {
			return nil, err
		}

		return append(sel, a), nil
	}

	return sel, nil
}

// parseCountSelection builds a countSelection from a `count` field's
// arguments: count(columns: [<table>_select_column!], distinct: Boolean).
// Column enum names are GraphQL names resolved against the table, rejecting
// unknowns. Both arguments may be supplied as variables. With no columns the
// selection renders COUNT(*); with columns it renders COUNT([DISTINCT] c, …).
func (t *table) parseCountSelection(
	f *ast.Field,
	variables map[string]any,
) (*countSelection, error) {
	responseName := fieldResponseName(f)

	cs := &countSelection{
		columns:      nil,
		dialect:      t.dialect,
		responseName: responseName,
		distinct:     false,
	}

	if arg := f.Arguments.ForName("distinct"); arg != nil {
		distinctVal, err := values.ResolveASTValue(arg.Value, variables)
		if err != nil {
			return nil, fmt.Errorf("resolving count distinct argument: %w", err)
		}

		if b, ok := distinctVal.(bool); ok {
			cs.distinct = b
		}
	}

	if arg := f.Arguments.ForName("columns"); arg != nil {
		columnsVal, err := values.ResolveASTValue(arg.Value, variables)
		if err != nil {
			return nil, fmt.Errorf("resolving count columns argument: %w", err)
		}

		cs.columns, err = t.resolveCountColumns(columnsVal)
		if err != nil {
			return nil, err
		}
	}

	return cs, nil
}

// resolveCountColumns normalises the resolved `columns` argument (a list of
// GraphQL column-enum names, a single name via GraphQL list coercion, or nil)
// into resolved columns, rejecting any name that is not a column of the table.
func (t *table) resolveCountColumns(raw any) ([]*core.Column, error) {
	if raw == nil {
		return nil, nil
	}

	var names []string

	switch v := raw.(type) {
	case []any:
		names = make([]string, 0, len(v))

		for _, elem := range v {
			name, ok := elem.(string)
			if !ok {
				return nil, fmt.Errorf(
					"%w: count column must be a column name",
					errInvalidCountArgument,
				)
			}

			names = append(names, name)
		}
	case string:
		names = []string{v}
	default:
		return nil, fmt.Errorf(
			"%w: count columns must be a list of column names", errInvalidCountArgument,
		)
	}

	columns := make([]*core.Column, 0, len(names))

	for _, name := range names {
		col := t.columnFromGraphqlName(name)
		if col == nil {
			return nil, fmt.Errorf("%w: %s", errUnknownAggregateColumn, name)
		}

		columns = append(columns, col)
	}

	return columns, nil
}

// parseAggregateFields parses the aggregate { ... } selection.
func (t *table) parseAggregateFields(
	field *ast.Field,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
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
				next, err := t.appendAggregateField(
					sel, s, aggregateFieldsTypeName, fragments, variables,
				)
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
