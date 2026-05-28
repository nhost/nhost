package queries

import (
	"maps"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
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

	nestedFKIndex := map[string]string{"workout_session_id": "mutation_result"}

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

// equalsClause returns a where.Clause with a single equals filter on c = v.
func equalsClause(c *core.Column, v any) where.Clause {
	return where.Clause{where.NewEqualsFilter(c, v, &dialect.PostgresDialect{})}
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
		[]arguments.InsertObject{absent}, map[string]string{"kind": "parent_cte"},
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
