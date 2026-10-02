package queries

import "strings"

// writeQueryNodeColumns shares the existing column serialization, adding
// parameterized row-bound computed selections in AST order.
func (t *table) writeQueryNodeColumns(
	b *strings.Builder, columns []columnSelection, alias string,
	variables, sessionVariables map[string]any, params []any, paramIndex int,
	argumentPath string,
) (bool, []any, int, error) {
	for i, selected := range columns {
		if i > 0 {
			b.WriteString(", ")
		}

		if selected.computed == nil {
			t.writeNodeColumnSelections(b, []columnSelection{selected}, alias)
			continue
		}

		var err error

		params, paramIndex, err = t.writeComputedScalar(
			b,
			selected,
			alias,
			childArgumentPath(argumentPath, selected.field),
			variables,
			sessionVariables,
			params,
			paramIndex,
		)
		if err != nil {
			return false, nil, 0, err
		}
	}

	return len(columns) > 0, params, paramIndex, nil
}
