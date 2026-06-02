package queries

import (
	"maps"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/values"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
)

// newTestTable builds a public.users *table with the given columns and an
// optional insertChecks map of role -> insert check clause. Tests use this in
// place of mutating tbl.columns / tbl.permissions.Insert directly so a future
// rename or representation change of those fields requires a single edit
// rather than touching every test site.
func newTestTable(
	t *testing.T,
	columns []*core.Column,
	insertChecks map[string]where.Clause,
) *table {
	t.Helper()

	tbl := newTable("public", "users", &dialect.PostgresDialect{})
	tbl.columns = columns

	maps.Copy(tbl.permissions.Insert, insertChecks)

	return tbl
}

func col(sqlName, sqlType string, generated bool) *core.Column {
	return &core.Column{
		SQLName:     sqlName,
		GraphqlName: sqlName,
		SQLType:     sqlType,
		IsGenerated: generated,
		HasDefault:  false,
	}
}

func colWithDefault(sqlName, sqlType string) *core.Column {
	return &core.Column{
		SQLName:     sqlName,
		GraphqlName: sqlName,
		SQLType:     sqlType,
		IsGenerated: false,
		HasDefault:  true,
	}
}

func colWithDefaultExpr(sqlName, sqlType, defaultExpr string) *core.Column {
	return &core.Column{
		SQLName:     sqlName,
		GraphqlName: sqlName,
		SQLType:     sqlType,
		IsGenerated: false,
		HasDefault:  true,
		DefaultExpr: defaultExpr,
	}
}

func insertCol(c *core.Column, value any) arguments.InsertColumn {
	return arguments.InsertColumn{Column: c, Value: value}
}

func TestCollectAllColumnsDedup(t *testing.T) {
	t.Parallel()

	idCol := col("id", "uuid", false)
	nameCol := col("name", "text", false)
	emailCol := col("email", "text", false)

	objs := []arguments.InsertObject{
		{Columns: []arguments.InsertColumn{
			insertCol(idCol, "u1"),
			insertCol(nameCol, "alice"),
		}},
		{Columns: []arguments.InsertColumn{
			insertCol(idCol, "u2"),
			insertCol(emailCol, "bob@example.com"),
		}},
	}

	tbl := newTestTable(t, []*core.Column{idCol, nameCol, emailCol}, nil)

	allColumns, columnToValue := tbl.collectAllColumns(objs, nil)

	// Union of columns in source order, deduplicated.
	wantAll := []string{"id", "name", "email"}
	if len(allColumns) != len(wantAll) {
		t.Fatalf("allColumns = %v, want %v", allColumns, wantAll)
	}

	for i, c := range wantAll {
		if allColumns[i] != c {
			t.Errorf("allColumns[%d] = %q, want %q", i, allColumns[i], c)
		}
	}

	// Per-object value maps reflect each object's payload only.
	if got := columnToValue[0]["id"]; got != "u1" {
		t.Errorf("obj0.id = %v, want u1", got)
	}

	if got := columnToValue[0]["name"]; got != "alice" {
		t.Errorf("obj0.name = %v, want alice", got)
	}

	if _, has := columnToValue[0]["email"]; has {
		t.Errorf("obj0 should not have email; got %v", columnToValue[0]["email"])
	}

	if got := columnToValue[1]["id"]; got != "u2" {
		t.Errorf("obj1.id = %v, want u2", got)
	}

	if got := columnToValue[1]["email"]; got != "bob@example.com" {
		t.Errorf("obj1.email = %v, want bob@example.com", got)
	}

	if _, has := columnToValue[1]["name"]; has {
		t.Errorf("obj1 should not have name; got %v", columnToValue[1]["name"])
	}
}

func TestCollectAllColumnsSkipsNestedFK(t *testing.T) {
	t.Parallel()

	idCol := col("id", "uuid", false)
	ownerCol := col("owner_id", "uuid", false)

	objs := []arguments.InsertObject{
		{Columns: []arguments.InsertColumn{
			insertCol(idCol, "u1"),
			insertCol(ownerCol, "owner-1"),
		}},
	}

	tbl := newTestTable(t, []*core.Column{idCol, ownerCol}, nil)

	nested := map[string]struct{}{"owner_id": {}}

	allColumns, columnToValue := tbl.collectAllColumns(objs, nested)

	if len(allColumns) != 1 || allColumns[0] != "id" {
		t.Fatalf("allColumns = %v, want [id]", allColumns)
	}

	if _, has := columnToValue[0]["owner_id"]; has {
		t.Errorf("owner_id should be skipped in columnToValue, got %v", columnToValue[0])
	}
}

func TestBuildUnionAllSelectTypedNullForMissing(t *testing.T) {
	t.Parallel()

	idCol := col("id", "uuid", false)
	nameCol := col("name", "text", false)
	emailCol := col("email", "text", false)

	tbl := newTestTable(t, []*core.Column{idCol, nameCol, emailCol}, nil)

	objs := []arguments.InsertObject{
		{Columns: []arguments.InsertColumn{
			insertCol(idCol, "u1"),
			insertCol(nameCol, "alice"),
		}},
		{Columns: []arguments.InsertColumn{
			insertCol(idCol, "u2"),
			insertCol(emailCol, "bob@example.com"),
		}},
	}

	allColumns, columnToValue := tbl.collectAllColumns(objs, nil)

	var b strings.Builder

	params, paramIndex := tbl.buildUnionAllSelect(&b, objs, allColumns, columnToValue, nil, nil, 1)

	got := b.String()

	// First row: id and name have values, email is missing -> typed NULL.
	wantFirst := `SELECT $1::uuid AS "id", $2::text AS "name", NULL::text AS "email"`
	// Second row: id and email have values, name is missing -> typed NULL.
	wantSecond := `SELECT $3::uuid AS "id", NULL::text AS "name", $4::text AS "email"`

	want := wantFirst + " UNION ALL " + wantSecond
	if got != want {
		t.Errorf("buildUnionAllSelect SQL mismatch\n got: %s\nwant: %s", got, want)
	}

	wantParams := []any{"u1", "alice", "u2", "bob@example.com"}
	if len(params) != len(wantParams) {
		t.Fatalf("params length = %d, want %d (params=%v)", len(params), len(wantParams), params)
	}

	for i, p := range wantParams {
		if params[i] != p {
			t.Errorf("params[%d] = %v, want %v", i, params[i], p)
		}
	}

	if paramIndex != 5 {
		t.Errorf("paramIndex = %d, want 5", paramIndex)
	}
}

// TestBuildUnionAllSelectDefaultExprForMissing locks the Hasura-parity fix
// for multi-row inserts whose rows have different column sets: when a row
// omits a column that has a registered DB default, the UNION-ALL branch must
// emit the default expression (parenthesised and type-cast) instead of a
// typed NULL, otherwise INSERT into a NOT NULL DEFAULT column trips 23502
// where Hasura would let the default apply per row.
func TestBuildUnionAllSelectDefaultExprForMissing(t *testing.T) {
	t.Parallel()

	idCol := col("id", "uuid", false)
	bodyCol := col("body", "text", false)
	visibilityCol := colWithDefaultExpr("visibility", "text", "'public'::text")

	tbl := newTestTable(t, []*core.Column{idCol, bodyCol, visibilityCol}, nil)

	objs := []arguments.InsertObject{
		// Row 0 omits visibility -> must render the default expression.
		{Columns: []arguments.InsertColumn{
			insertCol(idCol, "u1"),
			insertCol(bodyCol, "first"),
		}},
		// Row 1 supplies visibility -> renders the typed placeholder as usual.
		{Columns: []arguments.InsertColumn{
			insertCol(idCol, "u2"),
			insertCol(bodyCol, "second"),
			insertCol(visibilityCol, "private"),
		}},
	}

	allColumns, columnToValue := tbl.collectAllColumns(objs, nil)

	var b strings.Builder

	params, _ := tbl.buildUnionAllSelect(&b, objs, allColumns, columnToValue, nil, nil, 1)

	got := b.String()

	wantFirst := `SELECT $1::uuid AS "id", $2::text AS "body", ` +
		`('public'::text)::text AS "visibility"`
	wantSecond := `SELECT $3::uuid AS "id", $4::text AS "body", $5::text AS "visibility"`

	want := wantFirst + " UNION ALL " + wantSecond
	if got != want {
		t.Errorf("buildUnionAllSelect SQL mismatch\n got: %s\nwant: %s", got, want)
	}

	wantParams := []any{"u1", "first", "u2", "second", "private"}
	if len(params) != len(wantParams) {
		t.Fatalf("params length = %d, want %d (params=%v)", len(params), len(wantParams), params)
	}
}

func TestBuildUnionAllSelectUntypedColumnUsesPlainNull(t *testing.T) {
	t.Parallel()

	// Column with no SQLType: select clause should omit the type cast for both
	// the value placeholder and the NULL placeholder.
	idCol := col("id", "", false)
	other := col("name", "", false)

	tbl := newTestTable(t, []*core.Column{idCol, other}, nil)

	objs := []arguments.InsertObject{
		{Columns: []arguments.InsertColumn{insertCol(idCol, "u1")}},
		{Columns: []arguments.InsertColumn{insertCol(other, "alice")}},
	}

	allColumns, columnToValue := tbl.collectAllColumns(objs, nil)

	var b strings.Builder

	tbl.buildUnionAllSelect(&b, objs, allColumns, columnToValue, nil, nil, 1)

	got := b.String()

	want := `SELECT $1 AS "id", NULL AS "name" UNION ALL SELECT NULL AS "id", $2 AS "name"`
	if got != want {
		t.Errorf("buildUnionAllSelect SQL mismatch\n got: %s\nwant: %s", got, want)
	}
}

func TestBuildUnionAllSelectFKFromParentCTE(t *testing.T) {
	t.Parallel()

	// When a column is mapped in nestedFKIndex, buildUnionAllSelect must emit
	// the CTE's id for that column (rather than a placeholder or NULL) and
	// add the CTE to each UNION-ALL branch's FROM clause, so the surrounding
	// permission predicate sees the real FK value pulled from the parent's
	// RETURNING — not the NULL the data subquery would otherwise carry.
	exerciseCol := col("exercise_id", "uuid", false)
	positionCol := col("position", "int", false)
	fkCol := col("workout_session_id", "uuid", false)

	tbl := newTestTable(t, []*core.Column{exerciseCol, positionCol, fkCol}, nil)

	objs := []arguments.InsertObject{
		{Columns: []arguments.InsertColumn{
			insertCol(exerciseCol, "ex1"),
			insertCol(positionCol, 1),
		}},
		{Columns: []arguments.InsertColumn{
			insertCol(exerciseCol, "ex2"),
			insertCol(positionCol, 2),
		}},
	}

	// dataColumns mirrors what buildMultiNestedInsertCTEPreCheck builds: the
	// permission references the FK column, so the FK is added to the column
	// list via extendWithPermissionColumns.
	allColumns := []string{"exercise_id", "position", "workout_session_id"}
	columnToValue := []map[string]any{
		{"exercise_id": "ex1", "position": 1},
		{"exercise_id": "ex2", "position": 2},
	}

	nestedFKIndex := arguments.NestedFKSources{
		"workout_session_id": {CTEName: "mutation_result", ColumnName: "id"},
	}

	var b strings.Builder

	params, _ := tbl.buildUnionAllSelect(
		&b, objs, allColumns, columnToValue, nestedFKIndex, nil, 1,
	)

	got := b.String()

	want := `SELECT $1::uuid AS "exercise_id", $2::int AS "position", ` +
		`mutation_result."id" AS "workout_session_id" FROM mutation_result ` +
		`UNION ALL SELECT $3::uuid AS "exercise_id", $4::int AS "position", ` +
		`mutation_result."id" AS "workout_session_id" FROM mutation_result`
	if got != want {
		t.Errorf(
			"buildUnionAllSelect with FK from parent CTE mismatch\n got: %s\nwant: %s",
			got,
			want,
		)
	}

	wantParams := []any{"ex1", 1, "ex2", 2}
	if len(params) != len(wantParams) {
		t.Fatalf("params length = %d, want %d (params=%v)", len(params), len(wantParams), params)
	}
}

func TestBuildPartitionedUnionAllSelectFKFromParentCTE(t *testing.T) {
	t.Parallel()

	bodyCol := col("body", "text", false)
	fkCol := col("note_id", "uuid", false)

	tbl := newTestTable(t, []*core.Column{bodyCol, fkCol}, nil)

	objs := []arguments.InsertObject{
		{Columns: []arguments.InsertColumn{insertCol(bodyCol, "reply one")}},
		{Columns: []arguments.InsertColumn{insertCol(bodyCol, "reply two")}},
	}
	columnToValue := []map[string]any{
		{"body": "reply one"},
		{"body": "reply two"},
	}

	var b strings.Builder

	params, paramIndex := tbl.buildPartitionedUnionAllSelect(
		&b,
		objs,
		partitionedParentCTENames(2),
		[]string{"body", "note_id"},
		columnToValue,
		arguments.NestedFKSources{"note_id": {ColumnName: "id"}},
		nil,
		1,
	)

	want := `SELECT $1::text AS "body", mutation_result_0."id" AS "note_id" ` +
		`FROM mutation_result_0 UNION ALL SELECT $2::text AS "body", ` +
		`mutation_result_1."id" AS "note_id" FROM mutation_result_1`
	if got := b.String(); got != want {
		t.Errorf("buildPartitionedUnionAllSelect SQL mismatch\n got: %s\nwant: %s", got, want)
	}

	wantParams := []any{"reply one", "reply two"}
	if len(params) != len(wantParams) {
		t.Fatalf("params length = %d, want %d (params=%v)", len(params), len(wantParams), params)
	}

	for i, p := range wantParams {
		if params[i] != p {
			t.Errorf("params[%d] = %v, want %v", i, params[i], p)
		}
	}

	if paramIndex != 3 {
		t.Errorf("paramIndex = %d, want 3", paramIndex)
	}
}

func TestBuildPartitionedUnionAllSelectCompositeFKFromParentCTE(t *testing.T) {
	t.Parallel()

	repsCol := col("reps", "int", false)
	parentIDCol := col("parent_id", "uuid", false)
	parentKindCol := col("parent_kind", "text", false)

	tbl := newTestTable(t, []*core.Column{repsCol, parentIDCol, parentKindCol}, nil)

	objs := []arguments.InsertObject{
		{Columns: []arguments.InsertColumn{insertCol(repsCol, 8)}},
		{Columns: []arguments.InsertColumn{insertCol(repsCol, 10)}},
	}
	columnToValue := []map[string]any{
		{"reps": 8},
		{"reps": 10},
	}

	var b strings.Builder

	params, paramIndex := tbl.buildPartitionedUnionAllSelect(
		&b,
		objs,
		partitionedParentCTENames(2),
		[]string{"reps", "parent_id", "parent_kind"},
		columnToValue,
		arguments.NestedFKSources{
			"parent_id":   {ColumnName: "id"},
			"parent_kind": {ColumnName: "kind"},
		},
		nil,
		1,
	)

	want := `SELECT $1::int AS "reps", mutation_result_0."id" AS "parent_id", ` +
		`mutation_result_0."kind" AS "parent_kind" FROM mutation_result_0 UNION ALL ` +
		`SELECT $2::int AS "reps", mutation_result_1."id" AS "parent_id", ` +
		`mutation_result_1."kind" AS "parent_kind" FROM mutation_result_1`
	if got := b.String(); got != want {
		t.Errorf(
			"buildPartitionedUnionAllSelect composite SQL mismatch\n got: %s\nwant: %s",
			got,
			want,
		)
	}

	wantParams := []any{8, 10}
	if len(params) != len(wantParams) {
		t.Fatalf("params length = %d, want %d (params=%v)", len(params), len(wantParams), params)
	}

	for i, p := range wantParams {
		if params[i] != p {
			t.Errorf("params[%d] = %v, want %v", i, params[i], p)
		}
	}

	if paramIndex != 3 {
		t.Errorf("paramIndex = %d, want 3", paramIndex)
	}
}

func TestBuildPartitionedUnionAllSelectSQLiteHasNoPostgresCasts(t *testing.T) {
	t.Parallel()

	bodyCol := col("body", "text", false)
	fkCol := col("note_id", "uuid", false)

	tbl := newTable("public", "note_replies", &dialect.SQLiteDialect{})
	tbl.columns = []*core.Column{bodyCol, fkCol}

	objs := []arguments.InsertObject{
		{Columns: []arguments.InsertColumn{insertCol(bodyCol, "reply")}},
	}
	columnToValue := []map[string]any{{"body": "reply"}}

	var b strings.Builder

	_, _ = tbl.buildPartitionedUnionAllSelect(
		&b,
		objs,
		partitionedParentCTENames(1),
		[]string{"body", "note_id"},
		columnToValue,
		arguments.NestedFKSources{"note_id": {ColumnName: "id"}},
		nil,
		1,
	)

	if got := b.String(); strings.Contains(got, "::") {
		t.Fatalf("SQLite partitioned SELECT contains PostgreSQL cast: %s", got)
	}
}

// equalsClause returns a where.Clause with a single equals filter on c = v.
func equalsClause(c *core.Column, v any) where.Clause {
	return where.Clause{where.NewEqualsFilter(c, v, &dialect.PostgresDialect{})}
}

func TestBuildSingleInsertCTEPreCheckUpsertAppliesUpdatePermissions(t *testing.T) {
	t.Parallel()

	idCol := col("id", "uuid", false)
	userIDCol := col("user_id", "text", false)
	usernameCol := col("username", "text", false)
	bioCol := col("bio", "text", false)
	statusCol := col("status", "text", false)

	tbl := newTestTable(
		t,
		[]*core.Column{idCol, userIDCol, usernameCol, bioCol, statusCol},
		map[string]where.Clause{"user": {}},
	)
	tbl.conflictColumns["users_username_key"] = []string{"username"}
	tbl.permissions.Update["user"] = equalsClause(userIDCol, "x-hasura-user-id")
	tbl.permissions.UpdateCheck["user"] = equalsClause(statusCol, "pending")

	obj := arguments.InsertObject{Columns: []arguments.InsertColumn{
		insertCol(idCol, "00000000-0000-0000-0000-000000000001"),
		insertCol(userIDCol, "user-A"),
		insertCol(usernameCol, "alice"),
		insertCol(bioCol, "updated bio"),
		insertCol(statusCol, "approved"),
	}}
	onConflict := &arguments.OnConflict{
		ConstraintName: "users_username_key",
		UpdateColumns:  []string{"bio", "status"},
		Where:          nil,
	}

	var b strings.Builder

	params, paramIndex, err := tbl.buildSingleInsertCTEPreCheck(
		&b,
		"mutation_result",
		obj,
		onConflict,
		nil,
		nil,
		nil,
		1,
		"user",
		map[string]any{"x-hasura-user-id": "user-A"},
	)
	if err != nil {
		t.Fatalf("buildSingleInsertCTEPreCheck: %v", err)
	}

	got := b.String()

	wantFragments := []string{
		`mutation_result_upsert_conflicts AS (SELECT "mutation_result_upsert_conflicts_target"."username" AS "username" FROM "public"."users" AS "mutation_result_upsert_conflicts_target" WHERE EXISTS (SELECT 1 FROM check_mutation_result WHERE "mutation_result_upsert_conflicts_target"."username" = check_mutation_result."username"))`,
		`_mutation_result AS (INSERT INTO "public"."users"`,
		`ON CONFLICT ON CONSTRAINT "users_username_key" DO UPDATE SET "bio" = EXCLUDED."bio", "status" = EXCLUDED."status" WHERE (users."user_id" = $6::text)`,
		`mutation_result_upsert_updates AS (SELECT * FROM _mutation_result WHERE EXISTS (SELECT 1 FROM mutation_result_upsert_conflicts WHERE mutation_result_upsert_conflicts."username" = _mutation_result."username"))`,
		`mutation_result_update_post_check AS (SELECT CASE WHEN (SELECT COUNT(*) FROM mutation_result_upsert_updates WHERE mutation_result_upsert_updates."status" = $7::text) = (SELECT COUNT(*) FROM mutation_result_upsert_updates)`,
		`mutation_result AS (SELECT * FROM _mutation_result WHERE (SELECT status FROM mutation_result_update_post_check) = 1)`,
	}
	for _, fragment := range wantFragments {
		if !strings.Contains(got, fragment) {
			t.Errorf("generated SQL missing %q; got: %s", fragment, got)
		}
	}

	wantParams := []any{
		"user-A",
		"pending",
	}
	if len(params) != len(wantParams) {
		t.Fatalf("params length = %d, want %d (%v)", len(params), len(wantParams), params)
	}

	for i, want := range wantParams {
		if params[i] != want {
			t.Fatalf("params[%d] = %v, want %v (all params: %v)", i, params[i], want, params)
		}
	}

	if paramIndex != 8 {
		t.Fatalf("paramIndex = %d, want 8", paramIndex)
	}
}

// TestBuildSingleInsertCTEPreCheckUpsertNullsNotDistinctConflictUsesNullSafeMatch
// locks the PostgreSQL UNIQUE NULLS NOT DISTINCT path: nullable conflict keys
// must use null-safe matching in both conflict-detection CTEs so UPDATE checks
// still run when the conflicting key value is NULL.
func TestBuildSingleInsertCTEPreCheckUpsertNullsNotDistinctConflictUsesNullSafeMatch(
	t *testing.T,
) {
	t.Parallel()

	idCol := col("id", "uuid", false)
	userIDCol := col("user_id", "text", false)
	usernameCol := col("username", "text", false)
	bioCol := col("bio", "text", false)
	statusCol := col("status", "text", false)

	tbl := newTestTable(
		t,
		[]*core.Column{idCol, userIDCol, usernameCol, bioCol, statusCol},
		map[string]where.Clause{"user": {}},
	)
	tbl.conflictColumns, tbl.conflictNullsNotDistinct = tableConflictMetadata(
		&introspection.Table{
			Name: "users",
			UniqueConstraints: []introspection.UniqueConstraint{{
				Name:             "users_username_key",
				Columns:          []string{"username"},
				NullsNotDistinct: true,
			}},
		},
	)
	tbl.permissions.Update["user"] = equalsClause(userIDCol, "x-hasura-user-id")
	tbl.permissions.UpdateCheck["user"] = equalsClause(statusCol, "pending")

	obj := arguments.InsertObject{Columns: []arguments.InsertColumn{
		insertCol(idCol, "00000000-0000-0000-0000-000000000001"),
		insertCol(userIDCol, "user-A"),
		insertCol(usernameCol, nil),
		insertCol(bioCol, "updated bio"),
		insertCol(statusCol, "approved"),
	}}
	onConflict := &arguments.OnConflict{
		ConstraintName: "users_username_key",
		UpdateColumns:  []string{"bio", "status"},
		Where:          nil,
	}

	var b strings.Builder

	_, _, err := tbl.buildSingleInsertCTEPreCheck(
		&b,
		"mutation_result",
		obj,
		onConflict,
		nil,
		nil,
		nil,
		1,
		"user",
		map[string]any{"x-hasura-user-id": "user-A"},
	)
	if err != nil {
		t.Fatalf("buildSingleInsertCTEPreCheck: %v", err)
	}

	got := b.String()

	wantFragments := []string{
		`mutation_result_upsert_conflicts AS (SELECT "mutation_result_upsert_conflicts_target"."username" AS "username" FROM "public"."users" AS "mutation_result_upsert_conflicts_target" WHERE EXISTS (SELECT 1 FROM check_mutation_result WHERE "mutation_result_upsert_conflicts_target"."username" IS NOT DISTINCT FROM check_mutation_result."username"))`,
		`mutation_result_upsert_updates AS (SELECT * FROM _mutation_result WHERE EXISTS (SELECT 1 FROM mutation_result_upsert_conflicts WHERE mutation_result_upsert_conflicts."username" IS NOT DISTINCT FROM _mutation_result."username"))`,
		`mutation_result_update_post_check AS (SELECT CASE WHEN`,
	}
	for _, fragment := range wantFragments {
		if !strings.Contains(got, fragment) {
			t.Errorf("generated SQL missing %q; got: %s", fragment, got)
		}
	}

	wrongFragments := []string{
		`"mutation_result_upsert_conflicts_target"."username" = check_mutation_result."username"`,
		`mutation_result_upsert_conflicts."username" = _mutation_result."username"`,
	}
	for _, fragment := range wrongFragments {
		if strings.Contains(got, fragment) {
			t.Errorf(
				"NULLS NOT DISTINCT conflict must not use nullable = match %q; got: %s",
				fragment,
				got,
			)
		}
	}
}

// TestBuildInsertMutationCTEPreCheckUpsertAppliesUpdatePermissions is the
// multi-row companion to
// TestBuildSingleInsertCTEPreCheckUpsertAppliesUpdatePermissions: it locks the
// upsert UPDATE-check threading on the buildInsertMutationCTEPreCheck path,
// which uses a UNION-ALL data CTE instead of a single SELECT. Two rows both
// supply the conflict-target key "username", so the conflict is detectable and
// the check is scoped to genuinely-updated rows. The role has no insert check
// (so no check_count CTE), an UPDATE row filter, and an UPDATE check — exactly
// the shape that exercises prepareUpsertUpdateCheckPlan /
// appendUpsertUpdateCheckAndFinalCTE on the multi-row branch.
//
// It asserts the four emitted CTE names, that the INSERT is renamed
// _mutation_result with the DO UPDATE WHERE filter applied, that the updates
// CTE is scoped to the conflict-keys CTE, that the final wrapper gates on the
// update post-check status, and — the cross-path invariant the finding calls
// out — the full params slice ORDER: the 10 UNION-ALL row values first (the
// conflict-keys CTE adds none), then the DO UPDATE WHERE filter value, then the
// update-check value.
func TestBuildInsertMutationCTEPreCheckUpsertAppliesUpdatePermissions(t *testing.T) {
	t.Parallel()

	idCol := col("id", "uuid", false)
	userIDCol := col("user_id", "text", false)
	usernameCol := col("username", "text", false)
	bioCol := col("bio", "text", false)
	statusCol := col("status", "text", false)

	tbl := newTestTable(
		t,
		[]*core.Column{idCol, userIDCol, usernameCol, bioCol, statusCol},
		map[string]where.Clause{"user": {}},
	)
	tbl.conflictColumns["users_username_key"] = []string{"username"}
	tbl.permissions.Update["user"] = equalsClause(userIDCol, "x-hasura-user-id")
	tbl.permissions.UpdateCheck["user"] = equalsClause(statusCol, "pending")

	objs := []arguments.InsertObject{
		{Columns: []arguments.InsertColumn{
			insertCol(idCol, "id-0"),
			insertCol(userIDCol, "user-A"),
			insertCol(usernameCol, "alice"),
			insertCol(bioCol, "bio-0"),
			insertCol(statusCol, "approved"),
		}},
		{Columns: []arguments.InsertColumn{
			insertCol(idCol, "id-1"),
			insertCol(userIDCol, "user-A"),
			insertCol(usernameCol, "bob"),
			insertCol(bioCol, "bio-1"),
			insertCol(statusCol, "approved"),
		}},
	}
	onConflict := &arguments.OnConflict{
		ConstraintName: "users_username_key",
		UpdateColumns:  []string{"bio", "status"},
		Where:          nil,
	}

	nestedFKColumns := map[string]struct{}(nil)
	allColumns, columnToValue := tbl.collectAllColumns(objs, nestedFKColumns)

	var b strings.Builder

	params, paramIndex, err := tbl.buildInsertMutationCTEPreCheck(
		&b,
		objs,
		allColumns,
		columnToValue,
		nil,
		onConflict,
		"user",
		map[string]any{"x-hasura-user-id": "user-A"},
		nil,
		1,
	)
	if err != nil {
		t.Fatalf("buildInsertMutationCTEPreCheck: %v", err)
	}

	got := b.String()

	wantFragments := []string{
		// No insert check -> data CTE ends with WHERE true and no check_count CTE.
		`) AS data WHERE true), `,
		// Conflict-keys CTE scopes off the multi-row check_mutation_result CTE.
		`mutation_result_upsert_conflicts AS (SELECT "mutation_result_upsert_conflicts_target"."username" AS "username" FROM "public"."users" AS "mutation_result_upsert_conflicts_target" WHERE EXISTS (SELECT 1 FROM check_mutation_result WHERE "mutation_result_upsert_conflicts_target"."username" = check_mutation_result."username"))`,
		// INSERT CTE is renamed _mutation_result and carries the DO UPDATE WHERE filter.
		`_mutation_result AS (INSERT INTO "public"."users"`,
		`ON CONFLICT ON CONSTRAINT "users_username_key" DO UPDATE SET "bio" = EXCLUDED."bio", "status" = EXCLUDED."status" WHERE (users."user_id" = $11::text)`,
		// Updates CTE scoped to detected conflicts.
		`mutation_result_upsert_updates AS (SELECT * FROM _mutation_result WHERE EXISTS (SELECT 1 FROM mutation_result_upsert_conflicts WHERE mutation_result_upsert_conflicts."username" = _mutation_result."username"))`,
		// Update post-check runs against the scoped updates CTE.
		`mutation_result_update_post_check AS (SELECT CASE WHEN (SELECT COUNT(*) FROM mutation_result_upsert_updates WHERE mutation_result_upsert_updates."status" = $12::text) = (SELECT COUNT(*) FROM mutation_result_upsert_updates)`,
		// Final wrapper gates on the update post-check status.
		`mutation_result AS (SELECT * FROM _mutation_result WHERE (SELECT status FROM mutation_result_update_post_check) = 1)`,
	}
	for _, fragment := range wantFragments {
		if !strings.Contains(got, fragment) {
			t.Errorf("generated SQL missing %q; got: %s", fragment, got)
		}
	}

	// No insert-check permission means no check_count gate anywhere.
	if strings.Contains(got, "check_count") {
		t.Errorf("multi-row upsert with empty insert check must not emit check_count; got: %s", got)
	}

	// Cross-path param-ordering invariant: 10 UNION-ALL row values (conflict-keys
	// CTE adds none), then the DO UPDATE WHERE filter value, then the update-check
	// value.
	wantParams := []any{
		"id-0", "user-A", "alice", "bio-0", "approved",
		"id-1", "user-A", "bob", "bio-1", "approved",
		"user-A",
		"pending",
	}
	if len(params) != len(wantParams) {
		t.Fatalf("params length = %d, want %d (%v)", len(params), len(wantParams), params)
	}

	for i, want := range wantParams {
		if params[i] != want {
			t.Fatalf("params[%d] = %v, want %v (all params: %v)", i, params[i], want, params)
		}
	}

	if paramIndex != 13 {
		t.Fatalf("paramIndex = %d, want 13", paramIndex)
	}
}

// TestBuildSingleInsertCTEPreCheckUpsertUndetectableConflictCoversAllRows locks
// the fail-closed fallback for finding C1: when the conflict-target key cannot
// be scoped from the insert payload (here the unique key "username" is omitted,
// so upsertConflictDetectionColumns returns canDetectConflicts=false), the
// builder must NOT emit a conflict-keys CTE and the _upsert_updates CTE must
// select every RETURNING row with no scoping WHERE. The UPDATE check therefore
// covers freshly INSERTed rows too — a deliberate conservative choice (skipping
// the check would let an undetectable-conflict UPDATE bypass it). This is the
// security-over-reliability trade-off documented on writeUpsertUpdatedRowsCTE.
func TestBuildSingleInsertCTEPreCheckUpsertUndetectableConflictCoversAllRows(t *testing.T) {
	t.Parallel()

	idCol := col("id", "uuid", false)
	userIDCol := col("user_id", "text", false)
	usernameCol := col("username", "text", false)
	bioCol := col("bio", "text", false)
	statusCol := col("status", "text", false)

	tbl := newTestTable(
		t,
		[]*core.Column{idCol, userIDCol, usernameCol, bioCol, statusCol},
		map[string]where.Clause{"user": {}},
	)
	tbl.conflictColumns["users_username_key"] = []string{"username"}
	tbl.permissions.Update["user"] = equalsClause(userIDCol, "x-hasura-user-id")
	tbl.permissions.UpdateCheck["user"] = equalsClause(statusCol, "pending")

	// "username" — the conflict-target key — is deliberately omitted from the
	// payload, so the engine cannot scope the conflict and falls back to the
	// all-rows UPDATE check.
	obj := arguments.InsertObject{Columns: []arguments.InsertColumn{
		insertCol(idCol, "00000000-0000-0000-0000-000000000001"),
		insertCol(userIDCol, "user-A"),
		insertCol(bioCol, "updated bio"),
		insertCol(statusCol, "approved"),
	}}
	onConflict := &arguments.OnConflict{
		ConstraintName: "users_username_key",
		UpdateColumns:  []string{"bio", "status"},
		Where:          nil,
	}

	var b strings.Builder

	_, _, err := tbl.buildSingleInsertCTEPreCheck(
		&b,
		"mutation_result",
		obj,
		onConflict,
		nil,
		nil,
		nil,
		1,
		"user",
		map[string]any{"x-hasura-user-id": "user-A"},
	)
	if err != nil {
		t.Fatalf("buildSingleInsertCTEPreCheck: %v", err)
	}

	got := b.String()

	// No conflict-keys CTE is emitted when the conflict can't be detected.
	if strings.Contains(got, "mutation_result_upsert_conflicts") {
		t.Errorf("undetectable conflict must not emit a conflict-keys CTE; got: %s", got)
	}

	// The _upsert_updates CTE selects every RETURNING row with no scoping WHERE,
	// so the post-check covers freshly INSERTed rows too (fail-closed).
	wantUpdatesCTE := `mutation_result_upsert_updates AS (SELECT * FROM _mutation_result)` //nolint:unqueryvet
	if !strings.Contains(got, wantUpdatesCTE) {
		t.Errorf("expected unscoped updates CTE %q; got: %s", wantUpdatesCTE, got)
	}

	// The post-check still runs against the (all-rows) updates CTE.
	if !strings.Contains(got, "mutation_result_update_post_check AS (SELECT CASE WHEN") {
		t.Errorf("update post-check CTE must still be emitted; got: %s", got)
	}
}

func TestBuildSingleInsertCTEPreCheckUpsertDetectsParentSourcedFKConflict(t *testing.T) {
	t.Parallel()

	idCol := col("id", "uuid", false)
	orgIDCol := col("organization_id", "uuid", false)
	emailCol := col("email", "text", false)
	roleCol := col("role", "text", false)
	statusCol := col("status", "text", false)

	tbl := newTestTable(
		t,
		[]*core.Column{idCol, orgIDCol, emailCol, roleCol, statusCol},
		map[string]where.Clause{"user": {}},
	)
	tbl.conflictColumns["users_organization_email_key"] = []string{"organization_id", "email"}
	tbl.permissions.Update["user"] = equalsClause(orgIDCol, "x-hasura-org-id")
	tbl.permissions.UpdateCheck["user"] = equalsClause(statusCol, "active")

	obj := arguments.InsertObject{Columns: []arguments.InsertColumn{
		insertCol(idCol, "00000000-0000-0000-0000-000000000001"),
		insertCol(orgIDCol, nil),
		insertCol(emailCol, "alice@example.com"),
		insertCol(roleCol, "member"),
		insertCol(statusCol, "pending"),
	}}
	onConflict := &arguments.OnConflict{
		ConstraintName: "users_organization_email_key",
		UpdateColumns:  []string{"role", "status"},
		Where:          nil,
	}
	nestedFKIndex := arguments.NestedFKSources{
		"organization_id": {CTEName: "mutation_result", ColumnName: "id"},
	}

	var b strings.Builder

	params, paramIndex, err := tbl.buildSingleInsertCTEPreCheck(
		&b,
		"nested_members",
		obj,
		onConflict,
		nestedFKIndex,
		nil,
		nil,
		1,
		"user",
		map[string]any{"x-hasura-org-id": "org-A"},
	)
	if err != nil {
		t.Fatalf("buildSingleInsertCTEPreCheck: %v", err)
	}

	got := b.String()

	wantFragments := []string{
		`check_nested_members AS (SELECT * FROM (SELECT $1::uuid AS "id", mutation_result."id" AS "organization_id", $2::text AS "email", $3::text AS "role", $4::text AS "status" FROM mutation_result) AS data WHERE true), `,
		`nested_members_upsert_conflicts AS (SELECT "nested_members_upsert_conflicts_target"."organization_id" AS "organization_id", "nested_members_upsert_conflicts_target"."email" AS "email" FROM "public"."users" AS "nested_members_upsert_conflicts_target" WHERE EXISTS (SELECT 1 FROM check_nested_members WHERE "nested_members_upsert_conflicts_target"."organization_id" = check_nested_members."organization_id" AND "nested_members_upsert_conflicts_target"."email" = check_nested_members."email"))`,
		`nested_members_upsert_updates AS (SELECT * FROM _nested_members WHERE EXISTS (SELECT 1 FROM nested_members_upsert_conflicts WHERE nested_members_upsert_conflicts."organization_id" = _nested_members."organization_id" AND nested_members_upsert_conflicts."email" = _nested_members."email"))`,
		`nested_members_update_post_check AS (SELECT CASE WHEN (SELECT COUNT(*) FROM nested_members_upsert_updates WHERE nested_members_upsert_updates."status" = $6::text) = (SELECT COUNT(*) FROM nested_members_upsert_updates)`,
	}
	for _, fragment := range wantFragments {
		if !strings.Contains(got, fragment) {
			t.Errorf("generated SQL missing %q; got: %s", fragment, got)
		}
	}

	unscopedUpdatesCTE := `nested_members_upsert_updates AS (SELECT * FROM _nested_members)` //nolint:unqueryvet
	if strings.Contains(got, unscopedUpdatesCTE) {
		t.Errorf(
			"parent-sourced FK conflict key should not fall back to all-row check; got: %s",
			got,
		)
	}

	wantParams := []any{"org-A", "active"}
	if len(params) != len(wantParams) {
		t.Fatalf("params length = %d, want %d (%v)", len(params), len(wantParams), params)
	}

	for i, want := range wantParams {
		if params[i] != want {
			t.Fatalf("params[%d] = %v, want %v (all params: %v)", i, params[i], want, params)
		}
	}

	if paramIndex != 7 {
		t.Fatalf("paramIndex = %d, want 7", paramIndex)
	}
}

// TestBuildPartitionedNestedArrayCTEPreCheckUpsertAppliesUpdatePermissions
// covers the multi-parent array-relationship upsert path the finding flags as
// untested. It drives buildPartitionedNestedArrayCTE (the dispatcher), which —
// with no generated/defaulted-absent insert-check column — routes to
// buildPartitionedNestedArrayCTEPreCheck. Two parent rows each carry one child
// reply; the FK column "note_id" is sourced per-row from its parent CTE
// (mutation_result_0 / mutation_result_1), and the supplied "id" is the
// conflict-target key so the conflict is detectable.
//
// It locks the partitioned-path CTE names (prefixed by the nested cteName),
// that the partitioned UNION-ALL still sources FK columns from the matching
// parent CTE, the scoped updates CTE, the update post-check gate in the final
// wrapper, and the param ORDER: six per-row data values (FK columns add none),
// then the DO UPDATE WHERE filter value, then the update-check value.
func TestBuildPartitionedNestedArrayCTEPreCheckUpsertAppliesUpdatePermissions(t *testing.T) {
	t.Parallel()

	idCol := col("id", "uuid", false)
	bodyCol := col("body", "text", false)
	statusCol := col("status", "text", false)
	noteIDCol := col("note_id", "uuid", false) // array FK, sourced from parent CTE

	tbl := newTable("public", "note_replies", &dialect.PostgresDialect{})
	tbl.columns = []*core.Column{idCol, bodyCol, statusCol, noteIDCol}
	tbl.permissions.Insert["user"] = where.Clause{}
	tbl.conflictColumns["note_replies_id_key"] = []string{"id"}
	tbl.permissions.Update["user"] = equalsClause(statusCol, "x-hasura-status")
	tbl.permissions.UpdateCheck["user"] = equalsClause(bodyCol, "ok")

	objs := []arguments.InsertObject{
		{Columns: []arguments.InsertColumn{
			insertCol(idCol, "r0-id"),
			insertCol(bodyCol, "r0-body"),
			insertCol(statusCol, "r0-status"),
		}},
		{Columns: []arguments.InsertColumn{
			insertCol(idCol, "r1-id"),
			insertCol(bodyCol, "r1-body"),
			insertCol(statusCol, "r1-status"),
		}},
	}
	onConflict := &arguments.OnConflict{
		ConstraintName: "note_replies_id_key",
		UpdateColumns:  []string{"body", "status"},
		Where:          nil,
	}

	parentCTENames := partitionedParentCTENames(2)
	nestedFKIndex := arguments.NestedFKSources{"note_id": {ColumnName: "id"}}

	var b strings.Builder

	params, paramIndex, err := tbl.buildPartitionedNestedArrayCTE(
		&b,
		"nested_replies",
		objs,
		parentCTENames,
		onConflict,
		nestedFKIndex,
		nil,
		"user",
		map[string]any{"x-hasura-status": "on"},
		nil,
		1,
	)
	if err != nil {
		t.Fatalf("buildPartitionedNestedArrayCTE: %v", err)
	}

	got := b.String()

	wantFragments := []string{
		// Partitioned UNION-ALL still sources the FK from each row's parent CTE.
		`mutation_result_0."id" AS "note_id" FROM mutation_result_0`,
		`mutation_result_1."id" AS "note_id" FROM mutation_result_1`,
		// Empty insert check -> data CTE ends with WHERE true and no check_count.
		`) AS data WHERE true), `,
		// Conflict-keys CTE prefixed by the nested cteName, scoped off check_nested_replies.
		`nested_replies_upsert_conflicts AS (SELECT "nested_replies_upsert_conflicts_target"."id" AS "id" FROM "public"."note_replies" AS "nested_replies_upsert_conflicts_target" WHERE EXISTS (SELECT 1 FROM check_nested_replies WHERE "nested_replies_upsert_conflicts_target"."id" = check_nested_replies."id"))`,
		// INSERT CTE renamed _nested_replies with the DO UPDATE WHERE filter.
		`_nested_replies AS (INSERT INTO "public"."note_replies"`,
		`ON CONFLICT ON CONSTRAINT "note_replies_id_key" DO UPDATE SET "body" = EXCLUDED."body", "status" = EXCLUDED."status" WHERE (note_replies."status" = $7::text)`,
		// Updates CTE scoped to the detected conflict.
		`nested_replies_upsert_updates AS (SELECT * FROM _nested_replies WHERE EXISTS (SELECT 1 FROM nested_replies_upsert_conflicts WHERE nested_replies_upsert_conflicts."id" = _nested_replies."id"))`,
		// Update post-check against the scoped updates CTE.
		`nested_replies_update_post_check AS (SELECT CASE WHEN (SELECT COUNT(*) FROM nested_replies_upsert_updates WHERE nested_replies_upsert_updates."body" = $8::text) = (SELECT COUNT(*) FROM nested_replies_upsert_updates)`,
		// Final wrapper gates on the update post-check status.
		`nested_replies AS (SELECT * FROM _nested_replies WHERE (SELECT status FROM nested_replies_update_post_check) = 1)`,
	}
	for _, fragment := range wantFragments {
		if !strings.Contains(got, fragment) {
			t.Errorf("generated SQL missing %q; got: %s", fragment, got)
		}
	}

	// Empty insert check -> no check_count gate anywhere on the partitioned path.
	if strings.Contains(got, "check_count") {
		t.Errorf(
			"partitioned upsert with empty insert check must not emit check_count; got: %s",
			got,
		)
	}

	// Param ORDER: six per-row data values (FK columns add none), then the DO
	// UPDATE WHERE filter value (session var resolved), then the update-check.
	wantParams := []any{
		"r0-id", "r0-body", "r0-status",
		"r1-id", "r1-body", "r1-status",
		"on", // DO UPDATE WHERE filter (status = x-hasura-status)
		"ok", // update post-check (body = "ok")
	}
	if len(params) != len(wantParams) {
		t.Fatalf("params length = %d, want %d (%v)", len(params), len(wantParams), params)
	}

	for i, want := range wantParams {
		if params[i] != want {
			t.Fatalf("params[%d] = %v, want %v (all params: %v)", i, params[i], want, params)
		}
	}

	if paramIndex != 9 {
		t.Fatalf("paramIndex = %d, want 9", paramIndex)
	}
}

func TestBuildSingleInsertCTEPreCheckNoPermissions(t *testing.T) {
	t.Parallel()

	idCol := col("id", "uuid", false)
	nameCol := col("name", "text", false)

	tbl := newTestTable(t, []*core.Column{idCol, nameCol}, nil)

	obj := arguments.InsertObject{Columns: []arguments.InsertColumn{
		insertCol(idCol, "u1"),
		insertCol(nameCol, "alice"),
	}}

	var b strings.Builder

	params, paramIndex, err := tbl.buildSingleInsertCTEPreCheck(
		&b, "mutation_result", obj, nil, nil, nil, nil, 1, "user", nil,
	)
	if err != nil {
		t.Fatalf("buildSingleInsertCTEPreCheck: %v", err)
	}

	got := b.String()

	// No insert permission for role "user" -> WriteInsertCheckSubstituted
	// writes "true" and hasCheckPermissions=false, so no check_count CTE is
	// emitted.
	wantPrefix := `check_mutation_result AS (SELECT * FROM (SELECT $1::uuid AS "id", $2::text AS "name") AS data WHERE true), ` //nolint:unqueryvet
	if !strings.HasPrefix(got, wantPrefix) {
		t.Errorf("check CTE missing/wrong prefix\n got: %s\nwant prefix: %s", got, wantPrefix)
	}

	if strings.Contains(got, "check_count") {
		t.Errorf("did not expect check_count CTE without permissions; got: %s", got)
	}

	if !strings.Contains(got, `mutation_result AS (INSERT INTO "public"."users"`) {
		t.Errorf("missing INSERT CTE; got: %s", got)
	}

	if paramIndex != 3 {
		t.Errorf("paramIndex = %d, want 3", paramIndex)
	}

	if len(params) != 0 {
		t.Errorf("params length = %d, want 0", len(params))
	}
}

func TestBuildSingleInsertCTEPreCheckWithPermissions(t *testing.T) {
	t.Parallel()

	idCol := col("id", "uuid", false)
	tenantCol := col("tenant_id", "uuid", false)
	nameCol := col("name", "text", false)

	// Insert check: tenant_id = "t-42". Not generated; pre-check path applies.
	tbl := newTestTable(
		t,
		[]*core.Column{idCol, tenantCol, nameCol},
		map[string]where.Clause{"user": equalsClause(tenantCol, "t-42")},
	)

	obj := arguments.InsertObject{Columns: []arguments.InsertColumn{
		insertCol(idCol, "u1"),
		insertCol(tenantCol, "t-42"),
		insertCol(nameCol, "alice"),
	}}

	var b strings.Builder

	params, _, err := tbl.buildSingleInsertCTEPreCheck(
		&b, "mutation_result", obj, nil, nil, nil, nil, 1, "user", nil,
	)
	if err != nil {
		t.Fatalf("buildSingleInsertCTEPreCheck: %v", err)
	}

	got := b.String()

	// check_mutation_result emits the SELECTed columns then a WHERE that
	// references the permission filter against alias "data".
	wantPreamble := `check_mutation_result AS (SELECT * FROM (SELECT ` //nolint:unqueryvet
	if !strings.Contains(got, wantPreamble) {
		t.Errorf("missing check CTE preamble; got: %s", got)
	}

	if !strings.Contains(got, `WHERE data."tenant_id" = `) {
		t.Errorf("permission filter not rendered against data alias; got: %s", got)
	}

	// With permissions, check_count CTE is emitted with expectedCount = 1.
	if !strings.Contains(
		got,
		`mutation_result_check_count AS (SELECT CASE WHEN (SELECT COUNT(*) FROM check_mutation_result) >= 1 `,
	) {
		t.Errorf("check_count CTE missing or wrong expectedCount; got: %s", got)
	}

	// Final INSERT CTE references check_count and check_mutation_result.
	if !strings.Contains(got, `mutation_result AS (INSERT INTO "public"."users"`) {
		t.Errorf("missing INSERT CTE; got: %s", got)
	}

	if !strings.Contains(got, ` WHERE (SELECT status FROM mutation_result_check_count) = 1`) {
		t.Errorf("missing check_count gate on INSERT; got: %s", got)
	}

	// The permission value was appended after the SELECT placeholders, so it
	// is the last entry in params.
	if len(params) == 0 || params[len(params)-1] != "t-42" {
		t.Errorf("permission param missing or wrong; params=%v", params)
	}
}

func TestBuildSingleInsertCTEPostCheckShape(t *testing.T) {
	t.Parallel()

	idCol := col("id", "uuid", false)
	nameCol := col("name", "text", false)
	createdByCol := col("created_by", "uuid", true) // generated

	// Insert check references a generated column -> selectPostCheck path.
	tbl := newTestTable(
		t,
		[]*core.Column{idCol, nameCol, createdByCol},
		map[string]where.Clause{"user": equalsClause(createdByCol, "x-hasura-user-id")},
	)

	obj := arguments.InsertObject{Columns: []arguments.InsertColumn{
		insertCol(idCol, "u1"),
		insertCol(nameCol, "alice"),
	}}

	var b strings.Builder

	_, _, err := tbl.buildSingleInsertCTEPostCheck(
		&b, "mutation_result", obj, nil, nil, nil, nil, 1, "user",
		map[string]any{"x-hasura-user-id": "user-42"},
	)
	if err != nil {
		t.Fatalf("buildSingleInsertCTEPostCheck: %v", err)
	}

	got := b.String()

	// Post-check shape:
	//   check_mutation_result (data) -> _mutation_result (raw INSERT)
	//   -> mutation_result_post_check -> mutation_result (final filter)
	wantSubstrings := []string{
		`check_mutation_result AS (SELECT * FROM (SELECT `,
		`) AS data WHERE true), `,
		`_mutation_result AS (INSERT INTO "public"."users"`,
		` RETURNING *), `,
		`mutation_result_post_check AS (SELECT CASE WHEN (SELECT COUNT(*) FROM _mutation_result WHERE `,
		`mutation_result AS (SELECT * FROM _mutation_result WHERE (SELECT status FROM mutation_result_post_check) = 1)`,
	}
	for _, sub := range wantSubstrings {
		if !strings.Contains(got, sub) {
			t.Errorf("post-check SQL missing %q; got: %s", sub, got)
		}
	}

	// The pre-check check_count gate must NOT be present in the post-check path.
	if strings.Contains(got, "mutation_result_check_count") {
		t.Errorf("post-check path should not emit check_count CTE; got: %s", got)
	}
}

// TestBuildSingleInsertCTEPostCheckUpsertANDsUpdateAndInsertPostChecks locks the
// post-check upsert path the finding flags as untested: an upsert whose insert
// check references a generated column (forcing requiresPostInsertCheck via
// buildSingleInsertCTEPostCheck) under a role that also carries an UPDATE
// filter + UPDATE check. The conflict-target key "username" is supplied, so the
// conflict is detectable and the UPDATE check is scoped to genuine updates.
//
// The load-bearing invariant here is the final wrapper: it must AND *both* the
// insert post_check status and the update post_check status, since both the
// generated-column insert check and the upsert UPDATE check must hold. It also
// locks the cross-path param ORDER for this branch: the conflict-keys CTE adds
// no params, then the DO UPDATE WHERE filter value, then the insert post-check
// value (emitted before the update CTEs), then the update-check value.
func TestBuildSingleInsertCTEPostCheckUpsertANDsUpdateAndInsertPostChecks(t *testing.T) {
	t.Parallel()

	idCol := col("id", "uuid", false)
	userIDCol := col("user_id", "text", false)
	usernameCol := col("username", "text", false)
	bioCol := col("bio", "text", false)
	statusCol := col("status", "text", false)
	createdByCol := col("created_by", "uuid", true) // generated -> post-check path

	tbl := newTestTable(
		t,
		[]*core.Column{idCol, userIDCol, usernameCol, bioCol, statusCol, createdByCol},
		map[string]where.Clause{"user": equalsClause(createdByCol, "x-hasura-user-id")},
	)
	tbl.conflictColumns["users_username_key"] = []string{"username"}
	tbl.permissions.Update["user"] = equalsClause(userIDCol, "x-hasura-user-id")
	tbl.permissions.UpdateCheck["user"] = equalsClause(statusCol, "pending")

	// "username" (the conflict key) is supplied so the conflict is detectable;
	// "created_by" is generated and absent, which forces the post-check path.
	obj := arguments.InsertObject{Columns: []arguments.InsertColumn{
		insertCol(idCol, "id-0"),
		insertCol(userIDCol, "user-A"),
		insertCol(usernameCol, "alice"),
		insertCol(bioCol, "bio-0"),
		insertCol(statusCol, "approved"),
	}}
	onConflict := &arguments.OnConflict{
		ConstraintName: "users_username_key",
		UpdateColumns:  []string{"bio", "status"},
		Where:          nil,
	}

	presentCols := insertPresentColumns([]arguments.InsertObject{obj}, nil)
	if !tbl.requiresPostInsertCheck("user", presentCols) {
		t.Fatalf("fixture must take the post-check path (generated insert-check column)")
	}

	var b strings.Builder

	params, paramIndex, err := tbl.buildSingleInsertCTEPostCheck(
		&b,
		"mutation_result",
		obj,
		onConflict,
		nil,
		nil,
		nil,
		1,
		"user",
		map[string]any{"x-hasura-user-id": "user-A", "created_by": "ignored"},
	)
	if err != nil {
		t.Fatalf("buildSingleInsertCTEPostCheck: %v", err)
	}

	got := b.String()

	wantFragments := []string{
		// Detectable conflict -> conflict-keys CTE present.
		`mutation_result_upsert_conflicts AS (SELECT "mutation_result_upsert_conflicts_target"."username" AS "username" FROM "public"."users" AS "mutation_result_upsert_conflicts_target" WHERE EXISTS (SELECT 1 FROM check_mutation_result WHERE`,
		// INSERT CTE renamed _mutation_result with the DO UPDATE WHERE filter.
		`_mutation_result AS (INSERT INTO "public"."users"`,
		`ON CONFLICT ON CONSTRAINT "users_username_key" DO UPDATE SET "bio" = EXCLUDED."bio", "status" = EXCLUDED."status" WHERE (users."user_id" = $6::text)`,
		// Insert post-check (generated column) runs against _mutation_result.
		`mutation_result_post_check AS (SELECT CASE WHEN (SELECT COUNT(*) FROM _mutation_result WHERE _mutation_result."created_by" = $7::uuid)`,
		// Updates CTE scoped to the detected conflict.
		`mutation_result_upsert_updates AS (SELECT * FROM _mutation_result WHERE EXISTS (SELECT 1 FROM mutation_result_upsert_conflicts WHERE mutation_result_upsert_conflicts."username" = _mutation_result."username"))`,
		// Update post-check against the scoped updates CTE.
		`mutation_result_update_post_check AS (SELECT CASE WHEN (SELECT COUNT(*) FROM mutation_result_upsert_updates WHERE mutation_result_upsert_updates."status" = $8::text) = (SELECT COUNT(*) FROM mutation_result_upsert_updates)`,
		// THE invariant: the final wrapper ANDs BOTH status checks.
		`mutation_result AS (SELECT * FROM _mutation_result WHERE (SELECT status FROM mutation_result_post_check) = 1 AND (SELECT status FROM mutation_result_update_post_check) = 1)`,
	}
	for _, fragment := range wantFragments {
		if !strings.Contains(got, fragment) {
			t.Errorf("generated SQL missing %q; got: %s", fragment, got)
		}
	}

	// Post-check path must never emit the pre-check check_count gate.
	if strings.Contains(got, "check_count") {
		t.Errorf("post-check path should not emit check_count CTE; got: %s", got)
	}

	// Cross-path param ORDER for the post-check branch: DO UPDATE WHERE filter,
	// then the insert post-check value (emitted before the update CTEs), then the
	// update-check value. The data-CTE column values are appended by the caller,
	// not by this builder, so they are absent here (params starts nil).
	wantParams := []any{
		"user-A",  // DO UPDATE WHERE filter (user_id = x-hasura-user-id)
		"user-A",  // insert post_check (created_by = x-hasura-user-id)
		"pending", // update post_check (status = "pending")
	}
	if len(params) != len(wantParams) {
		t.Fatalf("params length = %d, want %d (%v)", len(params), len(wantParams), params)
	}

	for i, want := range wantParams {
		if params[i] != want {
			t.Fatalf("params[%d] = %v, want %v (all params: %v)", i, params[i], want, params)
		}
	}

	if paramIndex != 9 {
		t.Fatalf("paramIndex = %d, want 9", paramIndex)
	}
}

func TestRequiresPostInsertCheckBranching(t *testing.T) {
	t.Parallel()

	idCol := col("id", "uuid", false)
	nameCol := col("name", "text", false)
	createdByCol := col("created_by", "uuid", true) // generated
	tenantCol := col("tenant_id", "uuid", false)

	// Same insertObj and table layout in both cases; only the permission
	// filter's column changes. This locks the branch decision inside
	// requiresPostInsertCheck to the column.IsGenerated flag.
	build := func(insertCheckCol *core.Column) (string, error) {
		tbl := newTestTable(
			t,
			[]*core.Column{idCol, nameCol, createdByCol, tenantCol},
			map[string]where.Clause{"user": equalsClause(insertCheckCol, "v")},
		)

		obj := arguments.InsertObject{Columns: []arguments.InsertColumn{
			insertCol(idCol, "u1"),
			insertCol(nameCol, "alice"),
		}}

		presentCols := insertPresentColumns([]arguments.InsertObject{obj}, nil)
		if tbl.requiresPostInsertCheck("user", presentCols) {
			var b strings.Builder

			_, _, err := tbl.buildSingleInsertCTEPostCheck(
				&b, "mutation_result", obj, nil, nil, nil, nil, 1, "user", nil,
			)

			return b.String(), err
		}

		var b strings.Builder

		_, _, err := tbl.buildSingleInsertCTEPreCheck(
			&b, "mutation_result", obj, nil, nil, nil, nil, 1, "user", nil,
		)

		return b.String(), err
	}

	preSQL, err := build(tenantCol)
	if err != nil {
		t.Fatalf("pre-check build: %v", err)
	}

	postSQL, err := build(createdByCol)
	if err != nil {
		t.Fatalf("post-check build: %v", err)
	}

	if !strings.Contains(preSQL, "mutation_result_check_count") {
		t.Errorf(
			"non-generated column should select pre-check path with check_count CTE; got: %s",
			preSQL,
		)
	}

	if strings.Contains(preSQL, "post_check") {
		t.Errorf("pre-check path should not mention post_check; got: %s", preSQL)
	}

	if !strings.Contains(postSQL, "mutation_result_post_check") {
		t.Errorf("generated column should select post-check path; got: %s", postSQL)
	}

	if strings.Contains(postSQL, "_check_count") {
		t.Errorf("post-check path should not emit check_count CTE; got: %s", postSQL)
	}
}

// TestRequiresPostInsertCheckDefaultedColumn covers the composite-FK /
// defaulted-discriminator bug: an insert check that references a column with a
// DEFAULT must run post-INSERT when that column is absent from the payload
// (the pre-check would see NULL instead of the default), but may stay on the
// fast pre-check path when the payload supplies the column.
func TestRequiresPostInsertCheckDefaultedColumn(t *testing.T) {
	t.Parallel()

	idCol := col("id", "uuid", false)
	kindCol := colWithDefault("kind", "text") // DEFAULT 'strength', pinned by CHECK

	tbl := newTestTable(
		t,
		[]*core.Column{idCol, kindCol},
		map[string]where.Clause{"user": equalsClause(kindCol, "v")},
	)

	// Absent from the payload -> must use post-check (default applies on insert).
	absent := arguments.InsertObject{Columns: []arguments.InsertColumn{
		insertCol(idCol, "u1"),
	}}
	if !tbl.requiresPostInsertCheck("user", insertPresentColumns(
		[]arguments.InsertObject{absent}, nil,
	)) {
		t.Errorf("defaulted column absent from insert should require post-check")
	}

	// Supplied in the payload -> pre-check is safe (no divergence from NULL).
	present := arguments.InsertObject{Columns: []arguments.InsertColumn{
		insertCol(idCol, "u1"),
		insertCol(kindCol, "strength"),
	}}
	if tbl.requiresPostInsertCheck("user", insertPresentColumns(
		[]arguments.InsertObject{present}, nil,
	)) {
		t.Errorf("defaulted column supplied in insert should not require post-check")
	}

	// Multi-row: absent in any one row forces post-check (intersection rule).
	if !tbl.requiresPostInsertCheck("user", insertPresentColumns(
		[]arguments.InsertObject{present, absent}, nil,
	)) {
		t.Errorf("defaulted column missing from one row should require post-check")
	}

	// FK columns sourced from a parent CTE count as present.
	if tbl.requiresPostInsertCheck("user", insertPresentColumns(
		[]arguments.InsertObject{absent},
		arguments.NestedFKSources{"kind": {CTEName: "parent_cte", ColumnName: "kind"}},
	)) {
		t.Errorf("defaulted column sourced from parent CTE should not require post-check")
	}
}

// TestBuildPostCheckCTEWithNameThreadsSubs locks the threading of the
// tableSubs parameter through buildPostCheckCTEWithName. With a leaf-only
// permission predicate (no relationship-EXISTS to substitute), passing nil
// and a non-nil-but-irrelevant subs map must produce byte-identical SQL —
// proving the parameter flows to permissions.Store.WriteInsertCheckSubstituted
// without altering the no-subs output path. The end-to-end substituted shape
// for relationship-EXISTS predicates is locked by the
// "nested array-rel insert with post-check" goldens, which use real
// introspected tables.
func TestBuildPostCheckCTEWithNameThreadsSubs(t *testing.T) {
	t.Parallel()

	idCol := col("id", "uuid", false)
	tenantCol := col("tenant_id", "uuid", false)

	tbl := newTestTable(
		t,
		[]*core.Column{idCol, tenantCol},
		map[string]where.Clause{"user": equalsClause(tenantCol, "x-hasura-tenant-id")},
	)

	build := func(subs where.TableSubstitutions) string {
		var b strings.Builder

		_, _, err := tbl.buildPostCheckCTEWithName(
			&b, "post_check", "_mutation_result", subs, "user",
			map[string]any{"x-hasura-tenant-id": "t-1"}, nil, 1,
		)
		if err != nil {
			t.Fatalf("buildPostCheckCTEWithName: %v", err)
		}

		return b.String()
	}

	nilSubs := build(nil)
	irrelevantSubs := build(where.TableSubstitutions{
		`"public"."unrelated_table"`: "some_cte",
	})

	if nilSubs != irrelevantSubs {
		t.Errorf(
			"non-relationship predicate must render identically with or without irrelevant subs\nnil:    %s\nsubs:   %s",
			nilSubs,
			irrelevantSubs,
		)
	}

	// Sanity: the rendered SQL must be the post-check CTE shape against
	// _mutation_result with the leaf predicate threaded through.
	if !strings.Contains(
		nilSubs,
		"post_check AS (SELECT CASE WHEN (SELECT COUNT(*) FROM _mutation_result WHERE _mutation_result.\"tenant_id\" = $1",
	) {
		t.Errorf("post_check CTE shape unexpected; got: %s", nilSubs)
	}
}

// TestBuildSingleInsertCTEPostCheckPropagatesSubs ensures the
// buildSingleInsertCTEPostCheck wrapper threads tableSubs into
// buildPostCheckCTEWithName. The same leaf predicate-stability invariant from
// TestBuildPostCheckCTEWithNameThreadsSubs applies, so calling the wrapper
// with nil vs. an irrelevant subs map must produce byte-identical SQL.
func TestBuildSingleInsertCTEPostCheckPropagatesSubs(t *testing.T) {
	t.Parallel()

	idCol := col("id", "uuid", false)
	nameCol := col("name", "text", false)
	createdByCol := col("created_by", "uuid", true) // generated -> post-check

	tbl := newTestTable(
		t,
		[]*core.Column{idCol, nameCol, createdByCol},
		map[string]where.Clause{"user": equalsClause(createdByCol, "x-hasura-user-id")},
	)

	obj := arguments.InsertObject{Columns: []arguments.InsertColumn{
		insertCol(idCol, "u1"),
		insertCol(nameCol, "alice"),
	}}

	build := func(subs where.TableSubstitutions) string {
		var b strings.Builder

		_, _, err := tbl.buildSingleInsertCTEPostCheck(
			&b, "mutation_result", obj, nil, nil, subs, nil, 1, "user",
			map[string]any{"x-hasura-user-id": "user-42"},
		)
		if err != nil {
			t.Fatalf("buildSingleInsertCTEPostCheck: %v", err)
		}

		return b.String()
	}

	if got := build(nil); !strings.Contains(got, "mutation_result_post_check AS") {
		t.Errorf("post-check CTE name missing; got: %s", got)
	}

	if build(nil) != build(where.TableSubstitutions{
		`"public"."unrelated_table"`: "some_cte",
	}) {
		t.Error(
			"non-relationship predicate must render identically with or without irrelevant subs",
		)
	}
}

// newAggregateInsertCheckTable builds a "public"."departments" *table whose
// role "user" insert check is the aggregate-relationship predicate
//
//	user_departments_aggregate: {bool_and: {arguments: is_active, predicate: {_eq: true}}}
//
// over an array relationship to "public"."user_departments". The relationship
// join is reverse-FK (the FK department_id lives on the target), so the
// parent-side join column is the departments primary key "id" — i.e. exactly the
// column where.CollectSourceColumns must surface via
// aggregateRelationshipFilter.sourceColumns() for the insert-permission data CTE
// to project it.
//
// The clause is parsed through the same where.Parse entry point the production
// permission pipeline uses (table.parseWhere with PermissionAliases), so this
// exercises the real aggregateRelationshipFilter, not a stub. It is injected
// directly into permissions.Insert — the documented white-box test seam — to
// avoid standing up the full metadata Initialize pipeline.
func newAggregateInsertCheckTable(t *testing.T) *table {
	t.Helper()

	idCol := col("id", "uuid", false)
	nameCol := col("name", "text", false)

	target := newTable("public", "user_departments", &dialect.PostgresDialect{})
	target.columns = []*core.Column{
		col("department_id", "uuid", false),
		col("is_active", "boolean", false),
	}

	parent := newTestTable(t, []*core.Column{idCol, nameCol}, nil)
	parent.relationships = []*relationship{{
		name:           "user_departments",
		aggregateName:  "user_departments_aggregate",
		table:          target,
		isArray:        true,
		parentColumns:  []string{"id"},
		targetColumns:  []string{"department_id"},
		joinIsReversed: true,
	}}

	check := map[string]any{
		"user_departments_aggregate": map[string]any{
			"bool_and": map[string]any{
				"arguments": "is_active",
				"predicate": map[string]any{"_eq": true},
			},
		},
	}

	checkAST, err := values.GoValueToAST(check)
	if err != nil {
		t.Fatalf("GoValueToAST: %v", err)
	}

	clause, err := parent.parseWhere(checkAST, nil, "", nil, 0, where.PermissionAliases)
	if err != nil {
		t.Fatalf("parseWhere aggregate insert check: %v", err)
	}

	parent.permissions.Insert["user"] = clause

	return parent
}

// TestBuildSingleInsertCTEPreCheckAggregateRelationshipCheck is the end-to-end
// guard for finding C3: an aggregate-relationship predicate used as an insert
// permission check, rendered through the real insert-permission pre-check CTE
// builder (buildSingleInsertCTEPreCheck -> buildCheckConstraintCTE ->
// permissions.WriteInsertCheckSubstituted -> where.WriteConditionSubstituted,
// with the data-CTE column list drawn from MissingInsertColumns ->
// where.CollectSourceColumns).
//
// It asserts the two security-sensitive C3 behaviours that the where-package
// unit tests only cover in isolation:
//
//  1. With a substitution mapping the aggregate target table to the in-flight
//     parent CTE, the correlated aggregate subquery reads that CTE, NOT the base
//     "public"."user_departments" table — Postgres' WITH snapshot semantics mean
//     the base table can't see the sibling INSERT's in-flight rows. A C3
//     regression that dropped writeConditionSubstituted (falling back to
//     WriteCondition) would read the base table here.
//  2. The parent join column "id" is projected in the pre-insert data CTE even
//     though it is absent from the insert payload. A C3 regression that dropped
//     aggregateRelationshipFilter.sourceColumns() would omit it, leaving the
//     join's data."id" reference unresolved.
func TestBuildSingleInsertCTEPreCheckAggregateRelationshipCheck(t *testing.T) {
	t.Parallel()

	tbl := newAggregateInsertCheckTable(t)

	// "id" is deliberately absent from the payload so its appearance in the
	// data CTE can only come from CollectSourceColumns picking up the
	// aggregate filter's parent join column.
	obj := arguments.InsertObject{Columns: []arguments.InsertColumn{
		insertCol(col("name", "text", false), "research"),
	}}

	subs := where.TableSubstitutions{`"public"."user_departments"`: "mutation_result"}

	var b strings.Builder

	_, _, err := tbl.buildSingleInsertCTEPreCheck(
		&b, "mutation_result", obj, nil, nil, subs, nil, 1, "user", nil,
	)
	if err != nil {
		t.Fatalf("buildSingleInsertCTEPreCheck: %v", err)
	}

	got := b.String()

	dataSelect, _, ok := strings.Cut(got, ") AS data WHERE ")
	if !ok {
		t.Fatalf("could not locate data-CTE SELECT boundary in:\n%s", got)
	}

	// (2) Parent join column projected in the pre-insert data CTE. The aggregate
	// filter never references "id" except through the relationship's parent
	// columns, so this only holds if sourceColumns() surfaced it.
	if !strings.Contains(dataSelect, `NULL::uuid AS "id"`) {
		t.Errorf(
			"data CTE must project the aggregate relationship's parent join column \"id\"; got:\n%s",
			got,
		)
	}

	// (1) The correlated aggregate subquery reads the substituted CTE.
	if !strings.Contains(got, `FROM mutation_result "gaggt0"`) {
		t.Errorf("aggregate subquery must read the substituted CTE; got:\n%s", got)
	}

	if strings.Contains(got, `FROM "public"."user_departments"`) {
		t.Errorf(
			"aggregate subquery must not read the base target table when substituted; got:\n%s",
			got,
		)
	}

	// The aggregate shape itself must be intact: bool_and over the target's
	// boolean column, aliased __cs_agg, joined back to the parent on data."id",
	// and compared in the outer WHERE.
	wantFragments := []string{
		`EXISTS (SELECT 1 FROM (SELECT bool_and("gaggt0"."is_active") AS "__cs_agg"`,
		`WHERE "gaggt0"."department_id" = data."id"`,
		`"gaggs0" WHERE "gaggs0"."__cs_agg" = `,
	}
	for _, frag := range wantFragments {
		if !strings.Contains(got, frag) {
			t.Errorf("missing aggregate-predicate fragment %q; got:\n%s", frag, got)
		}
	}
}

// TestBuildSingleInsertCTEPreCheckAggregateRelationshipNoSubs is the companion
// negative control: with NO substitution, the same insert check must read the
// base target table (Postgres' WITH semantics are correct for a top-level
// insert, where there is no in-flight parent CTE). This proves the substituted
// rendering in the test above is the substitution actually firing, not a render
// that always emits the CTE name regardless of subs.
func TestBuildSingleInsertCTEPreCheckAggregateRelationshipNoSubs(t *testing.T) {
	t.Parallel()

	tbl := newAggregateInsertCheckTable(t)

	obj := arguments.InsertObject{Columns: []arguments.InsertColumn{
		insertCol(col("name", "text", false), "research"),
	}}

	var b strings.Builder

	_, _, err := tbl.buildSingleInsertCTEPreCheck(
		&b, "mutation_result", obj, nil, nil, nil, nil, 1, "user", nil,
	)
	if err != nil {
		t.Fatalf("buildSingleInsertCTEPreCheck: %v", err)
	}

	got := b.String()

	if !strings.Contains(got, `FROM "public"."user_departments" "gaggt0"`) {
		t.Errorf(
			"without subs the aggregate subquery must read the base target table; got:\n%s",
			got,
		)
	}

	if strings.Contains(got, "mutation_result \"gaggt0\"") {
		t.Errorf("without subs the aggregate subquery must not read a CTE; got:\n%s", got)
	}

	// The parent join column projection is independent of substitution: it comes
	// from CollectSourceColumns, which runs the same way on both paths.
	if !strings.Contains(got, `NULL::uuid AS "id"`) {
		t.Errorf(
			"data CTE must project parent join column \"id\" regardless of subs; got:\n%s",
			got,
		)
	}
}
