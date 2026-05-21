package arguments

import (
	"fmt"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
)

// ParseDelete parses the arguments for a delete mutation. It extracts the
// where clause.
func ParseDelete(
	t Table,
	arguments ast.ArgumentList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
) (where.Clause, error) {
	var (
		whereClause where.Clause
		err         error
	)

	for _, arg := range arguments {
		if arg.Name == "where" {
			whereClause, err = t.ParseWhere(
				arg.Value, variables, role, sessionVariables, 0, where.QueryAliases,
			)
			if err != nil {
				return nil, fmt.Errorf("failed to parse where clause: %w", err)
			}
		} else {
			return nil, fmt.Errorf(
				"%w: unexpected argument in delete mutation: %s",
				ErrInvalidArgument, arg.Name,
			)
		}
	}

	return whereClause, nil
}

// ParseDeleteByPk parses the arguments for a delete_by_pk mutation. Unlike
// update_by_pk which uses pk_columns, delete_by_pk takes primary key columns
// as direct arguments (e.g., delete_users_by_pk(id: "...")).
func ParseDeleteByPk(
	t Table,
	arguments ast.ArgumentList,
	variables map[string]any,
) (where.Clause, error) {
	return parsePkArguments(t, arguments, variables)
}
