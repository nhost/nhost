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

	params, paramIndex := tbl.buildUnionAllSelect(&b, objs, allColumns, columnToValue, nil, 1)

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

	tbl.buildUnionAllSelect(&b, objs, allColumns, columnToValue, nil, 1)

	got := b.String()

	want := `SELECT $1 AS "id", NULL AS "name" UNION ALL SELECT NULL AS "id", $2 AS "name"`
	if got != want {
		t.Errorf("buildUnionAllSelect SQL mismatch\n got: %s\nwant: %s", got, want)
	}
}

// permTableFor returns the permTable adapter usable for tests that need to
// install where.Clause values into Store.Insert directly via t.permissions.
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
		&b, "mutation_result", obj, nil, nil, nil, 1, "user", nil,
	)
	if err != nil {
		t.Fatalf("buildSingleInsertCTEPreCheck: %v", err)
	}

	got := b.String()

	// No insert permission for role "user" -> WriteInsertCheck writes "true"
	// and hasCheckPermissions=false, so no check_count CTE is emitted.
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
		&b, "mutation_result", obj, nil, nil, nil, 1, "user", nil,
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
		&b, "mutation_result", obj, nil, nil, nil, 1, "user",
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

func TestPermissionReferencesGeneratedColumnsBranching(t *testing.T) {
	t.Parallel()

	idCol := col("id", "uuid", false)
	nameCol := col("name", "text", false)
	createdByCol := col("created_by", "uuid", true) // generated
	tenantCol := col("tenant_id", "uuid", false)

	// Same insertObj and table layout in both cases; only the permission
	// filter's column changes. This locks the branch decision inside
	// permissionReferencesGeneratedColumns to the column.IsGenerated flag.
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

		if tbl.permissionReferencesGeneratedColumns("user") {
			var b strings.Builder

			_, _, err := tbl.buildSingleInsertCTEPostCheck(
				&b, "mutation_result", obj, nil, nil, nil, 1, "user", nil,
			)

			return b.String(), err
		}

		var b strings.Builder

		_, _, err := tbl.buildSingleInsertCTEPreCheck(
			&b, "mutation_result", obj, nil, nil, nil, 1, "user", nil,
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
