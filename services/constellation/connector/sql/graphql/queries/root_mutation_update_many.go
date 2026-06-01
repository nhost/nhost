package queries

import (
	"fmt"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

func (t *table) buildMutationUpdateManySQL(
	field *ast.Field,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
) (core.SQLOperation, error) {
	alias := field.Alias
	if alias == "" {
		alias = field.Name
	}

	updates, err := arguments.ParseUpdateMany(
		t, field.Arguments, variables, role, sessionVariables,
	)
	if err != nil {
		return core.SQLOperation{}, fmt.Errorf("failed to parse update_many arguments: %w", err)
	}

	selection, err := t.astToMutationSelection(field, fragments)
	if err != nil {
		return core.SQLOperation{}, fmt.Errorf("failed to parse selection set: %w", err)
	}

	sequential := make([]core.SQLOperation, len(updates))

	for i := range updates {
		b := getBuilder()

		params, buildErr := t.buildUpdateCollectionSQL(
			b,
			updates[i],
			selection,
			fragments,
			variables,
			role,
			sessionVariables,
			roots,
		)
		if buildErr != nil {
			putBuilder(b)

			return core.SQLOperation{}, fmt.Errorf(
				"failed to build UPDATE MANY SQL for index %d: %w", i, buildErr,
			)
		}

		sequential[i] = core.SQLOperation{
			Name:          fmt.Sprintf("%s[%d]", alias, i),
			SQL:           b.String(),
			Parameters:    params,
			StreamCursors: nil,
			Sequential:    nil,
		}

		putBuilder(b)
	}

	return core.SQLOperation{
		Name:          alias,
		SQL:           "",
		Parameters:    nil,
		StreamCursors: nil,
		Sequential:    sequential,
	}, nil
}
