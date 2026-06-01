package queries

import (
	"fmt"
	"strings"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

// upsertUpdateCheckPlan describes how an upsert's DO UPDATE branch enforces the
// role's UPDATE check against the rows it produced.
//
// canDetectConflicts reports whether the conflict-target key could be scoped
// from the insert payload (see upsertConflictDetectionColumns). When true, the
// check is restricted to the rows that matched a pre-existing row (the genuine
// updates). When false the key is undetectable, so the check conservatively
// covers every RETURNING row — including freshly INSERTed ones. That fail-closed
// fallback can reject an otherwise-valid pure-insert row, but the alternative
// (skipping the check) would let an undetectable-conflict UPDATE bypass its
// permission check, so the conservative behaviour is intentional. See
// writeUpsertUpdatedRowsCTE.
type upsertUpdateCheckPlan struct {
	enabled            bool
	canDetectConflicts bool
	conflictColumns    []string
	sourceCTEName      string
	conflictCTEName    string
	updatedRowsCTEName string
	postCheckName      string
}

func (t *table) writeOnConflictSQL(
	b *strings.Builder,
	onConflict *arguments.OnConflict,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	if onConflict == nil {
		return params, paramIndex, nil
	}

	if onConflict.TargetTableRef == "" {
		cloned := *onConflict
		cloned.TargetTableRef = t.tableSourceRef()
		onConflict = &cloned
	}

	params, paramIndex, err := onConflict.ToSQLWithWhere(
		b,
		params,
		paramIndex,
		t.onConflictUpdateFilterWriter(role, sessionVariables),
	)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to write on_conflict clause: %w", err)
	}

	return params, paramIndex, nil
}

func (t *table) onConflictUpdateFilterWriter(
	role string,
	sessionVariables map[string]any,
) arguments.OnConflictWhereWriter {
	return func(
		b *strings.Builder,
		params []any,
		paramIndex int,
	) ([]any, int, bool, error) {
		clause, found := t.permissions.Update[role]
		if !found {
			// A missing Update[role] entry here means the role is admin
			// (unrestricted, so no row filter is correct) — never a non-admin
			// role that slipped past its update permission. Schema generation
			// builds the `<table>_update_column` enum from
			// getUpdateAllowedColumns, which is empty for a non-admin role
			// without update permission, so that enum carries only the
			// `_PLACEHOLDER` sentinel. arguments.ParseOnConflict rejects
			// `_PLACEHOLDER` (it is not a real column), leaving update_columns
			// empty, which resolves to DO NOTHING — so such a role can never
			// reach DO UPDATE. Emitting no filter is therefore intentional, not
			// a missing check. If schema-gen ever stops gating the enum this
			// way, this branch becomes a privilege-escalation path and must
			// scope the filter instead.
			return params, paramIndex, false, nil
		}

		if len(clause) == 0 {
			b.WriteString("true")
			return params, paramIndex, true, nil
		}

		params, paramIndex, _, err := t.permissions.WriteUpdateFilter(
			b, params, paramIndex, role, sessionVariables, t.tableName,
		)
		if err != nil {
			return nil, 0, false, fmt.Errorf("failed to apply upsert update permissions: %w", err)
		}

		return params, paramIndex, true, nil
	}
}

func (t *table) newUpsertUpdateCheckPlan(
	cteName string,
	sourceCTEName string,
	onConflict *arguments.OnConflict,
	sourceColumns []string,
	presentColumns map[string]struct{},
	role string,
) upsertUpdateCheckPlan {
	if onConflict == nil || len(onConflict.UpdateColumns) == 0 ||
		!t.permissions.HasUpdateCheck(role) {
		var empty upsertUpdateCheckPlan

		return empty
	}

	conflictColumns, canDetectConflicts := t.upsertConflictDetectionColumns(
		onConflict, sourceColumns, presentColumns,
	)

	return upsertUpdateCheckPlan{
		enabled:            true,
		canDetectConflicts: canDetectConflicts,
		conflictColumns:    conflictColumns,
		sourceCTEName:      sourceCTEName,
		conflictCTEName:    cteName + "_upsert_conflicts",
		updatedRowsCTEName: cteName + "_upsert_updates",
		postCheckName:      cteName + "_update_post_check",
	}
}

func (t *table) upsertConflictDetectionColumns(
	onConflict *arguments.OnConflict,
	sourceColumns []string,
	presentColumns map[string]struct{},
) ([]string, bool) {
	constraintColumns, found := t.conflictColumns[onConflict.ConstraintName]
	if !found || len(constraintColumns) == 0 {
		return nil, false
	}

	sourceColumnSet := make(map[string]struct{}, len(sourceColumns))
	for _, column := range sourceColumns {
		sourceColumnSet[column] = struct{}{}
	}

	for _, column := range constraintColumns {
		if _, ok := sourceColumnSet[column]; !ok {
			return nil, false
		}

		if _, ok := presentColumns[column]; !ok {
			return nil, false
		}
	}

	return append([]string(nil), constraintColumns...), true
}

func (t *table) prepareUpsertUpdateCheckPlan(
	b *strings.Builder,
	cteName string,
	sourceCTEName string,
	onConflict *arguments.OnConflict,
	sourceColumns []string,
	presentColumns map[string]struct{},
	role string,
) upsertUpdateCheckPlan {
	plan := t.newUpsertUpdateCheckPlan(
		cteName, sourceCTEName, onConflict, sourceColumns, presentColumns, role,
	)
	if plan.enabled && plan.canDetectConflicts {
		t.writeUpsertConflictKeysCTE(b, plan)
		b.WriteString(", ")
	}

	return plan
}

func rawCTENameForUpsertUpdateCheck(cteName string, plan upsertUpdateCheckPlan) string {
	if plan.enabled {
		return "_" + cteName
	}

	return cteName
}

func (t *table) writeUpsertConflictKeysCTE(
	b *strings.Builder,
	plan upsertUpdateCheckPlan,
) {
	if !plan.enabled || !plan.canDetectConflicts {
		return
	}

	targetAlias := core.QuoteIdentifier(plan.conflictCTEName + "_target")

	b.WriteString(plan.conflictCTEName)
	b.WriteString(" AS (SELECT ")

	for i, column := range plan.conflictColumns {
		if i > 0 {
			b.WriteString(", ")
		}

		core.WriteQualifiedColumn(b, targetAlias, column)
		b.WriteString(" AS ")
		core.WriteQuotedIdentifier(b, column)
	}

	b.WriteString(" FROM ")
	b.WriteString(t.tableFromClause())
	b.WriteString(" AS ")
	b.WriteString(targetAlias)
	b.WriteString(" WHERE EXISTS (SELECT 1 FROM ")
	b.WriteString(plan.sourceCTEName)
	b.WriteString(" WHERE ")
	writeColumnEquality(b, targetAlias, plan.sourceCTEName, plan.conflictColumns)
	b.WriteString("))")
}

func (t *table) appendUpsertUpdatePostCheckCTEs(
	b *strings.Builder,
	plan upsertUpdateCheckPlan,
	rawCTEName string,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	if !plan.enabled {
		return params, paramIndex, nil
	}

	b.WriteString(", ")
	t.writeUpsertUpdatedRowsCTE(b, plan, rawCTEName)

	b.WriteString(", ")

	var err error

	params, paramIndex, err = t.buildUpdatePostCheckCTE(
		b, plan.postCheckName, plan.updatedRowsCTEName,
		role, sessionVariables, params, paramIndex,
	)
	if err != nil {
		return nil, 0, err
	}

	return params, paramIndex, nil
}

func (t *table) appendUpsertUpdateCheckAndFinalCTE(
	b *strings.Builder,
	cteName string,
	rawCTEName string,
	plan upsertUpdateCheckPlan,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
	statusCheckNames ...string,
) ([]any, int, error) {
	params, paramIndex, err := t.appendUpsertUpdatePostCheckCTEs(
		b, plan, rawCTEName, role, sessionVariables, params, paramIndex,
	)
	if err != nil {
		return nil, 0, err
	}

	if plan.enabled {
		statusCheckNames = append(statusCheckNames, plan.postCheckName)
	}

	if !hasStatusCheckNames(statusCheckNames) {
		return params, paramIndex, nil
	}

	b.WriteString(", ")
	writeCTESelectAllWithStatusChecks(b, cteName, rawCTEName, statusCheckNames...)

	return params, paramIndex, nil
}

func hasStatusCheckNames(checkNames []string) bool {
	for _, checkName := range checkNames {
		if checkName != "" {
			return true
		}
	}

	return false
}

// writeUpsertUpdatedRowsCTE emits the CTE that scopes the role's UPDATE check
// to the rows the upsert actually updated. When plan.canDetectConflicts is true
// it filters rawCTEName to rows whose conflict key matched a pre-existing row
// (the conflict-keys CTE), so the check runs only against updated rows.
//
// When plan.canDetectConflicts is false the conflict keys could not be scoped
// (see upsertConflictDetectionColumns), so this conservatively selects *every*
// RETURNING row with no WHERE — meaning the UPDATE check is validated against
// freshly INSERTed rows too. This is a deliberate fail-closed choice: skipping
// the check on undetectable conflicts would let an UPDATE that the engine
// couldn't attribute bypass its permission check (a security regression). The
// trade-off is that a pure-insert row failing the UPDATE check aborts the whole
// all-or-nothing mutation even though no update occurred; see
// upsertUpdateCheckPlan.canDetectConflicts.
func (t *table) writeUpsertUpdatedRowsCTE(
	b *strings.Builder,
	plan upsertUpdateCheckPlan,
	rawCTEName string,
) {
	b.WriteString(plan.updatedRowsCTEName)
	b.WriteString(" AS (SELECT * FROM ") //nolint:unqueryvet
	b.WriteString(rawCTEName)

	if plan.canDetectConflicts {
		b.WriteString(" WHERE EXISTS (SELECT 1 FROM ")
		b.WriteString(plan.conflictCTEName)
		b.WriteString(" WHERE ")
		writeColumnEquality(b, plan.conflictCTEName, rawCTEName, plan.conflictColumns)
		b.WriteByte(')')
	}

	b.WriteByte(')')
}

func writeCTESelectAllWithStatusChecks(
	b *strings.Builder,
	cteName string,
	sourceCTEName string,
	checkNames ...string,
) {
	b.WriteString(cteName)
	b.WriteString(" AS (SELECT * FROM ") //nolint:unqueryvet
	b.WriteString(sourceCTEName)

	writeStatusCheckWhere(b, checkNames)

	b.WriteByte(')')
}

func writeStatusCheckWhere(b *strings.Builder, checkNames []string) {
	wroteWhere := false

	for _, checkName := range checkNames {
		if checkName == "" {
			continue
		}

		if !wroteWhere {
			b.WriteString(" WHERE ")

			wroteWhere = true
		} else {
			b.WriteString(" AND ")
		}

		b.WriteString("(SELECT status FROM ")
		b.WriteString(checkName)
		b.WriteString(") = 1")
	}
}

func writeColumnEquality(
	b *strings.Builder,
	leftSource string,
	rightSource string,
	columns []string,
) {
	for i, column := range columns {
		if i > 0 {
			b.WriteString(" AND ")
		}

		core.WriteQualifiedColumn(b, leftSource, column)
		b.WriteString(" = ")
		core.WriteQualifiedColumn(b, rightSource, column)
	}
}

func sourceColumnsFromInsertObject(
	insertObj arguments.InsertObject,
	nestedFKIndex arguments.NestedFKSources,
) []string {
	columns := make([]string, 0, len(insertObj.Columns))
	for _, column := range insertObj.Columns {
		if _, nested := nestedFKIndex[column.Column.SQLName]; nested {
			continue
		}

		columns = append(columns, column.Column.SQLName)
	}

	return columns
}
