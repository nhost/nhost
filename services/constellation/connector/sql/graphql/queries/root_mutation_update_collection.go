package queries

import (
	"fmt"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

func (t *table) buildMutationUpdateSQL( //nolint:dupl
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

	// Parse update arguments (_set, _inc, where, etc.)
	updateObj, err := arguments.ParseUpdate(
		t, field.Arguments, variables, role, sessionVariables,
	)
	if err != nil {
		return core.SQLOperation{}, fmt.Errorf("failed to parse update arguments: %w", err)
	}

	selection, err := t.astToMutationSelection(field, fragments)
	if err != nil {
		return core.SQLOperation{}, fmt.Errorf("failed to parse selection set: %w", err)
	}

	b := getBuilder()

	// Build the UPDATE SQL with CTEs and permissions
	params, err := t.buildUpdateCollectionSQL(
		b,
		updateObj,
		selection,
		fragments,
		variables,
		role,
		sessionVariables,
		roots,
	)
	if err != nil {
		putBuilder(b)

		return core.SQLOperation{}, fmt.Errorf("failed to build UPDATE SQL: %w", err)
	}

	sql := b.String()
	putBuilder(b)

	return core.SQLOperation{
		Name:          alias,
		SQL:           sql,
		Parameters:    params,
		StreamCursors: nil,
	}, nil
}

// buildUpdateCTEBody builds the CTE(s) exposing the updated rows under cteName
// (without the "WITH " prefix). Used by update_collection/by_pk/many.
//
// When the role has no post-update check, it emits a single
// "cteName AS (UPDATE ... RETURNING *)". When the role has a non-empty update
// "check" predicate, it instead emits the all-or-nothing post-mutation shape —
// mirroring buildSingleInsertCTEPostCheck — so cteName still resolves to the
// updated rows but only after every RETURNING * row has been validated against
// the check (the entire mutation aborts if any row fails):
//
//	_cteName AS (UPDATE ... RETURNING *),
//	cteName_post_check AS (validate all rows pass the check),
//	cteName AS (SELECT * FROM _cteName WHERE cteName_post_check passes)
func (t *table) buildUpdateCTEBody(
	b *strings.Builder,
	cteName string,
	updateObj arguments.Update,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	if !t.permissions.HasUpdateCheck(role) {
		return t.writeUpdateStatementCTE(
			b, cteName, updateObj, role, sessionVariables, params, paramIndex,
		)
	}

	rawCTEName := "_" + cteName

	params, paramIndex, err := t.writeUpdateStatementCTE(
		b, rawCTEName, updateObj, role, sessionVariables, params, paramIndex,
	)
	if err != nil {
		return nil, 0, err
	}

	postCheckName := cteName + "_post_check"

	b.WriteString(", ")

	params, paramIndex, err = t.buildUpdatePostCheckCTE(
		b, postCheckName, rawCTEName, role, sessionVariables, params, paramIndex,
	)
	if err != nil {
		return nil, 0, err
	}

	b.WriteString(", ")
	b.WriteString(cteName)
	b.WriteString(" AS (SELECT * FROM ") //nolint:unqueryvet
	b.WriteString(rawCTEName)
	b.WriteString(" WHERE (SELECT status FROM ")
	b.WriteString(postCheckName)
	b.WriteString(") = 1)")

	return params, paramIndex, nil
}

// writeUpdateStatementCTE emits a single "cteName AS (UPDATE ... RETURNING *)"
// applying the update SET/WHERE and the role's row-level update filter. It is
// the raw UPDATE step shared by both the checked and unchecked update paths.
func (t *table) writeUpdateStatementCTE(
	b *strings.Builder,
	cteName string,
	updateObj arguments.Update,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	b.WriteString(cteName)
	b.WriteString(" AS (UPDATE ")
	b.WriteString(t.tableFromClause())
	b.WriteString(" SET ")

	params, paramIndex = updateObj.WriteSQL(b, params, paramIndex, t.dialect)

	b.WriteString(" WHERE ")

	var err error

	if len(updateObj.Where) > 0 {
		params, paramIndex, err = updateObj.Where.WriteCondition(
			b, t.tableName, params, paramIndex,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to write WHERE clause: %w", err)
		}
	} else {
		// No WHERE clause means update all rows (with permissions)
		b.WriteString("true")
	}

	if t.permissions.HasUpdateFilter(role) {
		b.WriteString(" AND (")

		params, paramIndex, _, err = t.permissions.WriteUpdateFilter(
			b, params, paramIndex, role, sessionVariables, t.tableName,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to apply update permissions: %w", err)
		}

		b.WriteString(")")
	}

	b.WriteString(" RETURNING *)")

	return params, paramIndex, nil
}

// buildUpdatePostCheckCTE builds the post-update permission check CTE named
// checkName. It validates that ALL rows updated by rawCTEName (RETURNING *)
// satisfy the role's update "check" predicate, evaluated against the real
// post-update column values. The CTE yields status=1 when every row passes and
// otherwise raises the same dialect error as the insert post-check, aborting
// the whole mutation (all-or-nothing). Mirrors buildPostCheckCTEWithName.
func (t *table) buildUpdatePostCheckCTE(
	b *strings.Builder,
	checkName string,
	rawCTEName string,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	b.WriteString(checkName)
	b.WriteString(" AS (SELECT CASE WHEN (SELECT COUNT(*) FROM ")
	b.WriteString(rawCTEName)
	b.WriteString(" WHERE ")

	params, paramIndex, _, err := t.permissions.WriteUpdateCheck(
		b, role, sessionVariables, params, paramIndex, rawCTEName,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to write update post-check permission: %w", err)
	}

	b.WriteString(") = (SELECT COUNT(*) FROM ")
	b.WriteString(rawCTEName)
	b.WriteString(") THEN 1 ELSE (SELECT 0 FROM (SELECT ")
	b.WriteString(t.dialect.ThrowError(errMsgInsertPermissionFailed, errCodePermissionDenied))
	b.WriteString(") x) END AS status)")

	return params, paramIndex, nil
}

// buildUpdateCollectionSQL builds the complete UPDATE query with CTEs for permissions.
// This follows the same pattern as buildInsertManySQL but for UPDATE operations.
func (t *table) buildUpdateCollectionSQL(
	b *strings.Builder,
	updateObj arguments.Update,
	selection mutationSelection,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
) ([]any, error) {
	var (
		params     = make([]any, 0, 8) //nolint:mnd
		paramIndex = 1
	)

	b.WriteString("WITH ")

	params, paramIndex, err := t.buildUpdateCTEBody(
		b,
		"mutation_result",
		updateObj,
		role,
		sessionVariables,
		params,
		paramIndex,
	)
	if err != nil {
		return nil, err
	}

	b.WriteString(" ")

	params, _, err = selection.WriteSQL(
		b,
		fragments,
		variables,
		role,
		sessionVariables,
		roots,
		params,
		paramIndex,
	)
	if err != nil {
		return nil, err
	}

	return params, nil
}
