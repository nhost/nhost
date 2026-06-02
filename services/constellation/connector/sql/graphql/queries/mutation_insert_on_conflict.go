package queries

import (
	"fmt"
	"strings"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

const upsertUpdatedColumn = "__nhost_upsert_updated"

// upsertUpdateCheckPlan describes how an upsert classifies rows that took the
// INSERT branch vs the DO UPDATE branch.
//
// useUpdateActionColumn is the preferred strategy: dialects that can expose an
// internal per-row marker from INSERT ... ON CONFLICT DO UPDATE RETURNING let us
// apply UPDATE checks only to rows that actually took the UPDATE branch and
// INSERT checks only to freshly inserted rows. PostgreSQL uses xmax for this,
// matching Hasura's permission semantics.
//
// canDetectConflicts is the SQLite fallback. SQLite has no RETURNING marker that
// identifies the branch taken by each upsert row, so we can only scope the
// UPDATE check when the insert payload carries all conflict-target columns. When
// it cannot, the UPDATE check deliberately covers every RETURNING row: this can
// reject a pure insert, but avoids letting an undetectable UPDATE bypass its
// permission check.
type upsertUpdateCheckPlan struct {
	enabled                  bool
	checkUpdatedRows         bool
	useUpdateActionColumn    bool
	canDetectConflicts       bool
	conflictColumns          []string
	conflictNullsNotDistinct bool
	sourceCTEName            string
	conflictCTEName          string
	insertedRowsCTEName      string
	updatedRowsCTEName       string
	postCheckName            string
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
			// `_PLACEHOLDER` sentinel. The only update_columns value such a role
			// can name is `_PLACEHOLDER`, and arguments.ParseOnConflict resolves
			// each entry via ColumnFromGraphqlName: `_PLACEHOLDER` has no real
			// column, so ParseOnConflict returns ErrInvalidArgument and the
			// whole upsert is rejected before any SQL is built — DO UPDATE is
			// unreachable. (The empty-update_columns -> DO NOTHING path in
			// ToSQLWithWhere is the separate, legitimate "insert-or-ignore" case
			// reached only when a caller passes an explicit empty list; it is
			// not how this privilege boundary is enforced.) Emitting no filter
			// is therefore intentional, not a missing check. If schema-gen ever
			// stops gating the enum this way, this branch becomes a
			// privilege-escalation path and must scope the filter instead.
			return params, paramIndex, false, nil
		}

		if len(clause) == 0 {
			b.WriteString("true")
			return params, paramIndex, true, nil
		}

		params, paramIndex, _, err := t.permissions.WriteUpdateFilter(
			b, params, paramIndex, role, sessionVariables, t.tableSourceRef(),
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
	checkInsertedRows bool,
) upsertUpdateCheckPlan {
	if onConflict == nil || len(onConflict.UpdateColumns) == 0 {
		var empty upsertUpdateCheckPlan

		return empty
	}

	checkUpdatedRows := t.permissions.HasUpdateCheck(role)
	if !checkUpdatedRows && !checkInsertedRows {
		var empty upsertUpdateCheckPlan

		return empty
	}

	plan := upsertUpdateCheckPlan{
		enabled:                  true,
		checkUpdatedRows:         checkUpdatedRows,
		useUpdateActionColumn:    t.dialect.SupportsUpsertUpdateAction(),
		canDetectConflicts:       false,
		conflictColumns:          nil,
		conflictNullsNotDistinct: false,
		sourceCTEName:            sourceCTEName,
		conflictCTEName:          cteName + "_upsert_conflicts",
		insertedRowsCTEName:      cteName + "_upsert_inserts",
		updatedRowsCTEName:       cteName + "_upsert_updates",
		postCheckName:            cteName + "_update_post_check",
	}
	if plan.useUpdateActionColumn {
		return plan
	}

	conflictColumns, nullsNotDistinct, canDetectConflicts := t.upsertConflictDetectionColumns(
		onConflict, sourceColumns, presentColumns,
	)
	plan.canDetectConflicts = canDetectConflicts
	plan.conflictColumns = conflictColumns
	plan.conflictNullsNotDistinct = nullsNotDistinct

	return plan
}

func (t *table) upsertConflictDetectionColumns(
	onConflict *arguments.OnConflict,
	sourceColumns []string,
	presentColumns map[string]struct{},
) ([]string, bool, bool) {
	constraintColumns, found := t.conflictColumns[onConflict.ConstraintName]
	if !found || len(constraintColumns) == 0 {
		return nil, false, false
	}

	sourceColumnSet := make(map[string]struct{}, len(sourceColumns))
	for _, column := range sourceColumns {
		sourceColumnSet[column] = struct{}{}
	}

	for _, column := range constraintColumns {
		if _, ok := sourceColumnSet[column]; !ok {
			return nil, false, false
		}

		if _, ok := presentColumns[column]; !ok {
			return nil, false, false
		}
	}

	return append([]string(nil), constraintColumns...),
		t.conflictNullsNotDistinct[onConflict.ConstraintName],
		true
}

func (t *table) prepareUpsertUpdateCheckPlan(
	b *strings.Builder,
	cteName string,
	sourceCTEName string,
	onConflict *arguments.OnConflict,
	sourceColumns []string,
	presentColumns map[string]struct{},
	role string,
	checkInsertedRows bool,
) upsertUpdateCheckPlan {
	plan := t.newUpsertUpdateCheckPlan(
		cteName,
		sourceCTEName,
		onConflict,
		sourceColumns,
		presentColumns,
		role,
		checkInsertedRows,
	)
	if plan.enabled && !plan.useUpdateActionColumn && plan.canDetectConflicts {
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

func (t *table) writeInsertReturning(b *strings.Builder, plan upsertUpdateCheckPlan) {
	b.WriteString(" RETURNING *")

	if !plan.useUpdateActionColumn {
		return
	}

	b.WriteString(", ")
	t.dialect.WriteUpsertUpdateAction(b)
	b.WriteString(" AS ")
	core.WriteQuotedIdentifier(b, upsertUpdatedColumn)
}

func appendUpsertInsertedRowsCTE(
	b *strings.Builder,
	plan upsertUpdateCheckPlan,
	rawCTEName string,
) string {
	if !plan.useUpdateActionColumn && !plan.canDetectConflicts {
		return rawCTEName
	}

	b.WriteString(plan.insertedRowsCTEName)
	b.WriteString(" AS (SELECT * FROM ") //nolint:unqueryvet
	b.WriteString(rawCTEName)
	b.WriteString(" WHERE ")

	if plan.useUpdateActionColumn {
		writeUpsertUpdatedColumnPredicate(b, rawCTEName, false)
	} else {
		b.WriteString("NOT EXISTS (SELECT 1 FROM ")
		b.WriteString(plan.conflictCTEName)
		b.WriteString(" WHERE ")
		writeConflictKeyMatch(
			b,
			plan.conflictCTEName,
			rawCTEName,
			plan.conflictColumns,
			plan.conflictNullsNotDistinct,
		)
		b.WriteByte(')')
	}

	b.WriteString("), ")

	return plan.insertedRowsCTEName
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
	writeConflictKeyMatch(
		b,
		targetAlias,
		plan.sourceCTEName,
		plan.conflictColumns,
		plan.conflictNullsNotDistinct,
	)
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
	if !plan.enabled || !plan.checkUpdatedRows {
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

	if plan.checkUpdatedRows {
		statusCheckNames = append(statusCheckNames, plan.postCheckName)
	}

	if !hasStatusCheckNames(statusCheckNames) {
		return params, paramIndex, nil
	}

	b.WriteString(", ")

	if plan.useUpdateActionColumn {
		writeCTESelectColumnsWithStatusChecks(
			b,
			cteName,
			rawCTEName,
			t.columns,
			statusCheckNames...,
		)
	} else {
		writeCTESelectAllWithStatusChecks(b, cteName, rawCTEName, statusCheckNames...)
	}

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
// to the rows the upsert actually updated. Dialects with a RETURNING action
// marker (PostgreSQL uses xmax) filter on that marker, making the scope exact
// even when conflict keys are defaulted or generated. SQLite falls back to
// pre-selecting conflict keys when the insert payload carries the full target key.
// If that is impossible, it deliberately leaves the CTE unfiltered so the UPDATE
// check runs fail-closed against every RETURNING row.
func (t *table) writeUpsertUpdatedRowsCTE(
	b *strings.Builder,
	plan upsertUpdateCheckPlan,
	rawCTEName string,
) {
	b.WriteString(plan.updatedRowsCTEName)
	b.WriteString(" AS (SELECT * FROM ") //nolint:unqueryvet
	b.WriteString(rawCTEName)

	if plan.useUpdateActionColumn {
		b.WriteString(" WHERE ")
		writeUpsertUpdatedColumnPredicate(b, rawCTEName, true)
	} else if plan.canDetectConflicts {
		b.WriteString(" WHERE EXISTS (SELECT 1 FROM ")
		b.WriteString(plan.conflictCTEName)
		b.WriteString(" WHERE ")
		writeConflictKeyMatch(
			b,
			plan.conflictCTEName,
			rawCTEName,
			plan.conflictColumns,
			plan.conflictNullsNotDistinct,
		)
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

func writeCTESelectColumnsWithStatusChecks(
	b *strings.Builder,
	cteName string,
	sourceCTEName string,
	columns []*core.Column,
	checkNames ...string,
) {
	b.WriteString(cteName)
	b.WriteString(" AS (SELECT ")

	for i, column := range columns {
		if i > 0 {
			b.WriteString(", ")
		}

		core.WriteQualifiedColumn(b, sourceCTEName, column.SQLName)
	}

	b.WriteString(" FROM ")
	b.WriteString(sourceCTEName)

	writeStatusCheckWhere(b, checkNames)

	b.WriteByte(')')
}

func writeUpsertUpdatedColumnPredicate(
	b *strings.Builder,
	sourceCTEName string,
	wantUpdated bool,
) {
	if !wantUpdated {
		b.WriteString("NOT ")
	}

	core.WriteQualifiedColumn(b, sourceCTEName, upsertUpdatedColumn)
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

func writeConflictKeyMatch(
	b *strings.Builder,
	leftSource string,
	rightSource string,
	columns []string,
	nullsNotDistinct bool,
) {
	operator := " = "
	if nullsNotDistinct {
		operator = " IS NOT DISTINCT FROM "
	}

	for i, column := range columns {
		if i > 0 {
			b.WriteString(" AND ")
		}

		core.WriteQualifiedColumn(b, leftSource, column)
		b.WriteString(operator)
		core.WriteQualifiedColumn(b, rightSource, column)
	}
}

// sourceColumnsFromInsertObject mirrors the single-row source CTE's visible
// columns. Parent-sourced nested FK columns are included because the source CTE
// selects them from their parent CTE, so they are available for conflict-key
// detection.
func sourceColumnsFromInsertObject(insertObj arguments.InsertObject) []string {
	columns := make([]string, 0, len(insertObj.Columns))
	for _, column := range insertObj.Columns {
		columns = append(columns, column.Column.SQLName)
	}

	return columns
}
