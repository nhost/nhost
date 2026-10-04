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

	return newTestTableWithDialect(t, columns, insertChecks, &dialect.PostgresDialect{})
}

func newTestTableWithDialect(
	t *testing.T,
	columns []*core.Column,
	insertChecks map[string]where.Clause,
	sqlDialect dialect.Dialect,
) *table {
	t.Helper()

	tbl := newTable("public", "users", sqlDialect)
	tbl.columns = columns

	maps.Copy(tbl.permissions.Insert, insertChecks)

	return tbl
}

type postgresConflictDetectionDialect struct {
	dialect.PostgresDialect
}

func (d *postgresConflictDetectionDialect) SupportsUpsertUpdateAction() bool { return false }

func (d *postgresConflictDetectionDialect) WriteUpsertUpdateAction(_ *strings.Builder) {
	panic("test dialect does not support upsert update action markers")
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

	allColumns, columnToValue := tbl.collectAllColumns(objs)

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

	allColumns, columnToValue := tbl.collectAllColumns(objs)

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

	allColumns, columnToValue := tbl.collectAllColumns(objs)

	var b strings.Builder

	params, _ := tbl.buildUnionAllSelect(&b, objs, allColumns, columnToValue, nil, 1)

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

	allColumns, columnToValue := tbl.collectAllColumns(objs)

	var b strings.Builder

	tbl.buildUnionAllSelect(&b, objs, allColumns, columnToValue, nil, 1)

	got := b.String()

	want := `SELECT $1 AS "id", NULL AS "name" UNION ALL SELECT NULL AS "id", $2 AS "name"`
	if got != want {
		t.Errorf("buildUnionAllSelect SQL mismatch\n got: %s\nwant: %s", got, want)
	}
}

// equalsClause constructs a physical-column equality filter for flat upserts.
func equalsClause(c *core.Column, v any) where.Clause {
	return where.Clause{where.NewEqualsFilter(c, v, &dialect.PostgresDialect{})}
}

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

	allColumns, columnToValue := tbl.collectAllColumns(objs)

	var b strings.Builder

	params, paramIndex, err := tbl.buildInsertMutationCTEPreCheck(
		&b,
		objs,
		allColumns,
		columnToValue,
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
		// INSERT CTE is renamed _mutation_result and carries the DO UPDATE WHERE filter plus marker.
		`_mutation_result AS (INSERT INTO "public"."users"`,
		`ON CONFLICT ON CONSTRAINT "users_username_key" DO UPDATE SET "bio" = EXCLUDED."bio", "status" = EXCLUDED."status" WHERE ("public"."users"."user_id" = $11::text) RETURNING *, (xmax <> 0) AS "__nhost_upsert_updated"`,
		// Updates CTE scoped to rows that took the UPDATE branch.
		`mutation_result_upsert_updates AS (SELECT * FROM _mutation_result WHERE _mutation_result."__nhost_upsert_updated")`,
		// Update post-check runs against the scoped updates CTE.
		`mutation_result_update_post_check AS (SELECT CASE WHEN (SELECT COUNT(*) FROM mutation_result_upsert_updates WHERE mutation_result_upsert_updates."status" = $12::text) = (SELECT COUNT(*) FROM mutation_result_upsert_updates)`,
		// Final wrapper gates on the update post-check status and strips the internal marker.
		`mutation_result AS (SELECT _mutation_result."id", _mutation_result."user_id", _mutation_result."username", _mutation_result."bio", _mutation_result."status" FROM _mutation_result WHERE (SELECT status FROM mutation_result_update_post_check) = 1)`,
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

	// Cross-path param-ordering invariant: 10 UNION-ALL row values, then the DO
	// UPDATE WHERE filter value, then the update-check value.
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

func TestBuildInsertMutationCTEPreCheckUpsertNoMarkerDetectsSourceDuplicates(t *testing.T) {
	t.Parallel()

	idCol := col("id", "uuid", false)
	userIDCol := col("user_id", "text", false)
	usernameCol := col("username", "text", false)
	bioCol := col("bio", "text", false)
	statusCol := col("status", "text", false)

	tbl := newTestTableWithDialect(
		t,
		[]*core.Column{idCol, userIDCol, usernameCol, bioCol, statusCol},
		map[string]where.Clause{"user": {}},
		&postgresConflictDetectionDialect{},
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
			insertCol(usernameCol, "alice"),
			insertCol(bioCol, "bio-1"),
			insertCol(statusCol, "approved"),
		}},
	}
	onConflict := &arguments.OnConflict{
		ConstraintName: "users_username_key",
		UpdateColumns:  []string{"bio", "status"},
		Where:          nil,
	}

	allColumns, columnToValue := tbl.collectAllColumns(objs)

	var b strings.Builder

	_, _, err := tbl.buildInsertMutationCTEPreCheck(
		&b,
		objs,
		allColumns,
		columnToValue,
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
		`mutation_result_upsert_conflicts AS (SELECT "mutation_result_upsert_conflicts_target"."username" AS "username" FROM "public"."users" AS "mutation_result_upsert_conflicts_target" WHERE EXISTS (SELECT 1 FROM check_mutation_result WHERE "mutation_result_upsert_conflicts_target"."username" = check_mutation_result."username"))`,
		`mutation_result_upsert_source_conflicts AS (SELECT check_mutation_result."username" AS "username" FROM check_mutation_result WHERE check_mutation_result."username" IS NOT NULL GROUP BY check_mutation_result."username" HAVING COUNT(*) > 1)`,
		`mutation_result_upsert_updates AS (SELECT * FROM _mutation_result WHERE EXISTS (SELECT 1 FROM mutation_result_upsert_conflicts WHERE mutation_result_upsert_conflicts."username" = _mutation_result."username") OR EXISTS (SELECT 1 FROM mutation_result_upsert_source_conflicts WHERE mutation_result_upsert_source_conflicts."username" = _mutation_result."username"))`,
		`mutation_result_update_post_check AS (SELECT CASE WHEN (SELECT COUNT(*) FROM mutation_result_upsert_updates WHERE mutation_result_upsert_updates."status" = $12::text) = (SELECT COUNT(*) FROM mutation_result_upsert_updates)`,
	}
	for _, fragment := range wantFragments {
		if !strings.Contains(got, fragment) {
			t.Errorf("generated SQL missing %q; got: %s", fragment, got)
		}
	}
}

// TestBuildInsertMutationCTEPostCheckUpsertNoMarkerChecksSourceDuplicates
// scopes UPDATE checks to source-key duplicates even without a RETURNING
// action marker.
func TestBuildInsertMutationCTEPostCheckUpsertNoMarkerChecksSourceDuplicates(t *testing.T) {
	t.Parallel()

	idCol := col("id", "uuid", false)
	userIDCol := col("user_id", "text", false)
	usernameCol := col("username", "text", false)
	bioCol := col("bio", "text", false)
	statusCol := col("status", "text", false)
	createdByCol := col("created_by", "uuid", true) // generated -> post-check path

	tbl := newTestTableWithDialect(
		t,
		[]*core.Column{idCol, userIDCol, usernameCol, bioCol, statusCol, createdByCol},
		map[string]where.Clause{"user": equalsClause(createdByCol, "x-hasura-user-id")},
		&postgresConflictDetectionDialect{},
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
			insertCol(usernameCol, "alice"),
			insertCol(bioCol, "bio-1"),
			insertCol(statusCol, "approved"),
		}},
	}
	onConflict := &arguments.OnConflict{
		ConstraintName: "users_username_key",
		UpdateColumns:  []string{"bio", "status"},
		Where:          nil,
	}

	allColumns, columnToValue := tbl.collectAllColumns(objs)

	var b strings.Builder

	_, _, err := tbl.buildInsertMutationCTEPostCheck(
		&b,
		objs,
		allColumns,
		columnToValue,
		onConflict,
		"user",
		map[string]any{"x-hasura-user-id": "user-A"},
		nil,
		1,
	)
	if err != nil {
		t.Fatalf("buildInsertMutationCTEPostCheck: %v", err)
	}

	got := b.String()

	wantFragments := []string{
		`mutation_result_upsert_source_conflicts AS (SELECT insert_data."username" AS "username" FROM insert_data WHERE insert_data."username" IS NOT NULL GROUP BY insert_data."username" HAVING COUNT(*) > 1)`,
		`mutation_result_upsert_inserts AS (SELECT * FROM _mutation_result WHERE NOT EXISTS (SELECT 1 FROM mutation_result_upsert_conflicts WHERE mutation_result_upsert_conflicts."username" = _mutation_result."username"))`,
		`post_check AS (SELECT CASE WHEN (SELECT COUNT(*) FROM mutation_result_upsert_inserts WHERE mutation_result_upsert_inserts."created_by" = $12::uuid)`,
		`mutation_result_upsert_updates AS (SELECT * FROM _mutation_result WHERE EXISTS (SELECT 1 FROM mutation_result_upsert_conflicts WHERE mutation_result_upsert_conflicts."username" = _mutation_result."username") OR EXISTS (SELECT 1 FROM mutation_result_upsert_source_conflicts WHERE mutation_result_upsert_source_conflicts."username" = _mutation_result."username"))`,
		`mutation_result_update_post_check AS (SELECT CASE WHEN (SELECT COUNT(*) FROM mutation_result_upsert_updates WHERE mutation_result_upsert_updates."status" = $13::text) = (SELECT COUNT(*) FROM mutation_result_upsert_updates)`,
		`mutation_result AS (SELECT * FROM _mutation_result WHERE (SELECT status FROM post_check) = 1 AND (SELECT status FROM mutation_result_update_post_check) = 1)`,
	}
	for _, fragment := range wantFragments {
		if !strings.Contains(got, fragment) {
			t.Errorf("generated SQL missing %q; got: %s", fragment, got)
		}
	}

	forbidden := `mutation_result_upsert_inserts AS (SELECT * FROM _mutation_result WHERE NOT EXISTS (SELECT 1 FROM mutation_result_upsert_source_conflicts` //nolint:unqueryvet
	if strings.Contains(got, forbidden) {
		t.Errorf(
			"source-duplicate conflicts must not be subtracted from insert post-check; got: %s",
			got,
		)
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

		sql, _, _, err := tbl.buildInsertMutationCTE(
			[]arguments.InsertObject{obj},
			nil,
			"user",
			nil,
			nil,
		)

		return sql, err
	}

	preSQL, err := build(tenantCol)
	if err != nil {
		t.Fatalf("pre-check build: %v", err)
	}

	postSQL, err := build(createdByCol)
	if err != nil {
		t.Fatalf("post-check build: %v", err)
	}

	if !strings.Contains(preSQL, "check_count AS") {
		t.Errorf(
			"non-generated column should select pre-check path with check_count CTE; got: %s",
			preSQL,
		)
	}

	if strings.Contains(preSQL, "post_check") {
		t.Errorf("pre-check path should not mention post_check; got: %s", preSQL)
	}

	if !strings.Contains(postSQL, "post_check AS") {
		t.Errorf("generated column should select post-check path; got: %s", postSQL)
	}

	if strings.Contains(postSQL, "_check_count") {
		t.Errorf("post-check path should not emit check_count CTE; got: %s", postSQL)
	}
}

// TestRequiresPostInsertCheckUpsertBranch locks the upsert side of the pre/post
// dispatch decision: an upsert whose DO UPDATE branch is reachable and whose
// role has a *non-empty* insert check must take the post-mutation path, so the
// insert check is scoped to inserted rows rather than enforced on every input
// row via the all-or-nothing check_count gate. The insert-check column here is
// a plain (non-generated, non-defaulted) column that is supplied in the
// payload, so condition (1) of requiresPostInsertCheck is false and the upsert
// condition (2) is the only thing that can force the post-check path.
func TestRequiresPostInsertCheckUpsertBranch(t *testing.T) {
	t.Parallel()

	idCol := col("id", "uuid", false)
	authorCol := col("author_id", "uuid", false)
	titleCol := col("title", "text", false)

	doUpdate := &arguments.OnConflict{
		ConstraintName: "notes_pkey",
		UpdateColumns:  []string{"title"},
		Where:          nil,
	}
	doNothing := &arguments.OnConflict{
		ConstraintName: "notes_pkey",
		UpdateColumns:  nil,
		Where:          nil,
	}

	tests := []struct {
		name        string
		insertCheck map[string]where.Clause
		onConflict  *arguments.OnConflict
		want        bool
	}{
		{
			name:        "plain insert with non-empty check stays pre-check",
			insertCheck: map[string]where.Clause{"user": equalsClause(authorCol, "v")},
			onConflict:  nil,
			want:        false,
		},
		{
			name:        "upsert DO UPDATE with non-empty insert check forces post-check",
			insertCheck: map[string]where.Clause{"user": equalsClause(authorCol, "v")},
			onConflict:  doUpdate,
			want:        true,
		},
		{
			name:        "upsert DO UPDATE with empty insert check stays pre-check",
			insertCheck: map[string]where.Clause{"user": {}},
			onConflict:  doUpdate,
			want:        false,
		},
		{
			name:        "upsert DO UPDATE with no insert permission stays pre-check",
			insertCheck: nil,
			onConflict:  doUpdate,
			want:        false,
		},
		{
			name:        "upsert DO NOTHING with non-empty insert check stays pre-check",
			insertCheck: map[string]where.Clause{"user": equalsClause(authorCol, "v")},
			onConflict:  doNothing,
			want:        false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			tbl := newTestTable(t, []*core.Column{idCol, authorCol, titleCol}, tt.insertCheck)

			obj := arguments.InsertObject{Columns: []arguments.InsertColumn{
				insertCol(idCol, "u1"),
				insertCol(authorCol, "a1"),
				insertCol(titleCol, "t1"),
			}}
			presentCols := insertPresentColumns([]arguments.InsertObject{obj})

			if got := tbl.requiresPostInsertCheck(
				"user",
				presentCols,
				tt.onConflict,
			); got != tt.want {
				t.Errorf("requiresPostInsertCheck = %v, want %v", got, tt.want)
			}
		})
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
		[]arguments.InsertObject{absent},
	), nil) {
		t.Errorf("defaulted column absent from insert should require post-check")
	}

	// Supplied in the payload -> pre-check is safe (no divergence from NULL).
	present := arguments.InsertObject{Columns: []arguments.InsertColumn{
		insertCol(idCol, "u1"),
		insertCol(kindCol, "strength"),
	}}
	if tbl.requiresPostInsertCheck("user", insertPresentColumns(
		[]arguments.InsertObject{present},
	), nil) {
		t.Errorf("defaulted column supplied in insert should not require post-check")
	}

	// Multi-row: absent in any one row forces post-check (intersection rule).
	if !tbl.requiresPostInsertCheck("user", insertPresentColumns(
		[]arguments.InsertObject{present, absent},
	), nil) {
		t.Errorf("defaulted column missing from one row should require post-check")
	}
}
