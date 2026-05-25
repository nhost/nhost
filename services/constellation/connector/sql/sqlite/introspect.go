package sqlite

import (
	"context"
	"fmt"
	"strings"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// Introspect discovers tables, columns, primary keys, foreign keys and unique constraints
// from a SQLite database using PRAGMA commands.
func (c *Client) Introspect(
	ctx context.Context, dbMeta *metadata.DatabaseMetadata,
) (*introspection.Objects, error) {
	tables, err := introspectTables(ctx, c.db)
	if err != nil {
		return nil, fmt.Errorf("failed to introspect tables: %w", err)
	}

	schema := &introspection.Schema{
		Tables: make(map[string]*introspection.Table, len(tables)),
	}

	for i := range tables {
		schema.Tables[tables[i].Name] = &tables[i]
	}

	objs := introspection.NewObjects()
	objs.Schemas[""] = schema
	objs.EnumValues = introspectEnumValues(ctx, c.db, dbMeta, schema.Tables)

	return objs, nil
}

// introspectTables discovers all user tables and views in the database and
// returns a fully-populated [introspection.Table] for each one (columns,
// primary keys, foreign keys, unique constraints). It walks the names emitted
// by [getTableNames] in lexicographic order so the resulting slice is stable
// across runs.
func introspectTables(ctx context.Context, q Querier) ([]introspection.Table, error) {
	entries, err := getTableNames(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("listing tables: %w", err)
	}

	tables := make([]introspection.Table, 0, len(entries))

	for _, entry := range entries {
		t, err := introspectTable(ctx, q, entry.name, entry.isView)
		if err != nil {
			return nil, fmt.Errorf("failed to introspect table %s: %w", entry.name, err)
		}

		tables = append(tables, *t)
	}

	return tables, nil
}

// relationEntry pairs a relation name with whether it is a view; the kind is
// needed at construction time so we can populate IsView / IsInsertable /
// IsUpdatable directly on the introspected Table.
type relationEntry struct {
	name   string
	isView bool
}

// getTableNames returns user-defined table and view names from sqlite_master,
// excluding the internal sqlite_* objects. Ordering is by name so the rest of
// introspection sees a stable slice.
func getTableNames(ctx context.Context, q Querier) ([]relationEntry, error) {
	rows, err := q.QueryContext(ctx,
		`SELECT name, type FROM sqlite_master
		 WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
		 ORDER BY name`,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query sqlite_master: %w", err)
	}
	defer rows.Close()

	var entries []relationEntry

	for rows.Next() {
		var (
			name    string
			relKind string
		)
		if err := rows.Scan(&name, &relKind); err != nil {
			return nil, fmt.Errorf("failed to scan table name: %w", err)
		}

		entries = append(entries, relationEntry{name: name, isView: relKind == "view"})
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating table names: %w", err)
	}

	return entries, nil
}

// introspectTable builds a complete [introspection.Table] for one SQLite table
// by reading PRAGMA table_xinfo (columns + primary key), PRAGMA
// foreign_key_list (FKs), and PRAGMA index_list / index_info (unique
// constraints) in turn. SQLite has no per-table or per-column comment system,
// so the corresponding fields are always nil.
//
// SQLite views are read-only by default. A view becomes writable when it is
// backed by INSTEAD OF triggers — INSTEAD OF INSERT makes the view
// insertable, INSTEAD OF UPDATE or DELETE makes it "updatable" in the sense
// the introspection model uses (IsUpdatable gates both UPDATE and DELETE,
// matching Postgres' information_schema.views.is_updatable). For base tables
// we always report (true, true).
func introspectTable(
	ctx context.Context,
	q Querier,
	tableName string,
	isView bool,
) (*introspection.Table, error) {
	columns, pks, err := getColumnsAndPKs(ctx, q, tableName)
	if err != nil {
		return nil, fmt.Errorf("reading columns: %w", err)
	}

	fks, err := getForeignKeys(ctx, q, tableName)
	if err != nil {
		return nil, fmt.Errorf("reading foreign keys: %w", err)
	}

	ucs, err := getUniqueConstraints(ctx, q, tableName)
	if err != nil {
		return nil, fmt.Errorf("reading unique constraints: %w", err)
	}

	isInsertable := !isView
	isUpdatable := !isView

	if isView {
		insertable, updatable, terr := getViewMutability(ctx, q, tableName)
		if terr != nil {
			return nil, fmt.Errorf("reading view mutability: %w", terr)
		}

		isInsertable = insertable
		isUpdatable = updatable
	}

	return &introspection.Table{
		Schema:                   "",
		Name:                     tableName,
		Comment:                  nil,
		Columns:                  columns,
		PrimaryKeys:              pks,
		PrimaryKeyConstraintName: "",
		ForeignKeys:              fks,
		UniqueConstraints:        ucs,
		IsView:                   isView,
		IsInsertable:             isInsertable,
		IsUpdatable:              isUpdatable,
	}, nil
}

// getViewMutability inspects sqlite_master for INSTEAD OF triggers attached
// to viewName and returns (insertable, updatable). A view is "insertable" if
// it has an INSTEAD OF INSERT trigger, and "updatable" if it has an
// INSTEAD OF UPDATE or INSTEAD OF DELETE trigger — matching how Postgres'
// information_schema.views.is_updatable conflates UPDATE and DELETE.
//
// The match is done by scanning each trigger's stored CREATE TRIGGER text
// for the INSTEAD OF clause and the operation keyword. SQLite stores the
// original SQL verbatim (modulo case-folding by the parser is not applied),
// so the comparison normalises to upper case before substring matching.
// Only the header (everything before the trigger body's BEGIN keyword) is
// searched, so trigger bodies containing the literal phrase "INSTEAD OF
// <op>" inside a string literal or comment cannot create false positives —
// SQLite's CREATE TRIGGER grammar always places the INSTEAD OF clause
// between CREATE TRIGGER <name> and ON <table>, both of which precede BEGIN.
func getViewMutability(
	ctx context.Context, q Querier, viewName string,
) (bool, bool, error) {
	rows, err := q.QueryContext(
		ctx,
		`SELECT sql FROM sqlite_master
		 WHERE type = 'trigger' AND tbl_name = ? AND sql IS NOT NULL`,
		viewName,
	)
	if err != nil {
		return false, false, fmt.Errorf("failed to query triggers: %w", err)
	}
	defer rows.Close()

	var insertable, updatable bool

	for rows.Next() {
		var sql string
		if err := rows.Scan(&sql); err != nil {
			return false, false, fmt.Errorf("failed to scan trigger sql: %w", err)
		}

		// Restrict the search to the trigger header (the text before the
		// standalone BEGIN keyword) so phrases inside the trigger body
		// (string literals, comments, nested statements) cannot be mistaken
		// for the header's INSTEAD OF <op> marker. The boundary check is
		// required because the trigger or target relation may itself be
		// named with a "BEGIN" substring (e.g. `begin_audit`,
		// `v_begin`), and a plain `strings.Index` would otherwise truncate
		// the header before the real INSTEAD OF clause and regress the
		// detection into a false negative.
		upper := strings.ToUpper(sql)
		if idx := indexBeginKeyword(upper); idx >= 0 {
			upper = upper[:idx]
		}

		if !strings.Contains(upper, "INSTEAD OF") {
			continue
		}

		// Evaluate the INSERT and UPDATE/DELETE markers independently rather
		// than via a switch: SQLite restricts each trigger to a single event,
		// but the header text can still mention a different INSTEAD OF
		// operation inside a SQL comment. A switch would let the first
		// branch win and silently mask the real event, mirroring the
		// header-content false-positive concern handled elsewhere in this
		// file.
		if strings.Contains(upper, "INSTEAD OF INSERT") {
			insertable = true
		}

		if strings.Contains(upper, "INSTEAD OF UPDATE") ||
			strings.Contains(upper, "INSTEAD OF DELETE") {
			updatable = true
		}
	}

	if err := rows.Err(); err != nil {
		return false, false, fmt.Errorf("error iterating triggers: %w", err)
	}

	return insertable, updatable, nil
}

// indexBeginKeyword returns the byte offset of the first standalone BEGIN
// keyword in upper (which the caller has already upper-cased), or -1 if there
// is none. A match must be flanked on both sides by characters that are not
// part of a SQLite identifier — letters, digits, underscore and `$` — so that
// identifiers such as `begin_audit` or `v_begin` are not mistaken for the
// trigger body's opening keyword.
func indexBeginKeyword(upper string) int {
	const keyword = "BEGIN"

	start := 0
	for {
		rel := strings.Index(upper[start:], keyword)
		if rel < 0 {
			return -1
		}

		idx := start + rel
		if isStandaloneKeyword(upper, idx, len(keyword)) {
			return idx
		}

		start = idx + 1
	}
}

// isStandaloneKeyword reports whether the keyword of length keywordLen
// starting at idx in s is bounded by non-identifier characters on both sides.
// SQLite identifiers can contain letters, digits, underscore and `$`; any
// other byte (whitespace, punctuation, start/end of string) is treated as a
// boundary.
func isStandaloneKeyword(s string, idx, keywordLen int) bool {
	if idx > 0 && isIdentByte(s[idx-1]) {
		return false
	}

	end := idx + keywordLen
	if end < len(s) && isIdentByte(s[end]) {
		return false
	}

	return true
}

// isIdentByte reports whether b can appear inside an unquoted SQLite
// identifier. SQLite accepts ASCII letters, digits, underscore, and `$` in
// identifier name characters; the caller has already upper-cased the input so
// lower-case letters never reach this check.
func isIdentByte(b byte) bool {
	switch {
	case b >= 'A' && b <= 'Z':
		return true
	case b >= '0' && b <= '9':
		return true
	case b == '_' || b == '$':
		return true
	default:
		return false
	}
}

// getColumnsAndPKs returns the column metadata and primary-key column list
// for tableName by querying PRAGMA table_xinfo. The xinfo variant is used over
// table_info so that hidden / generated columns are included.
//
// PRAGMA table_xinfo returns rows of (cid, name, type, notnull, dflt_value,
// pk, hidden); the Scan call below tracks that exact column order. The hidden
// column carries 0 (normal), 1 (alias), 2 (virtual generated), or 3 (stored
// generated) — values 2 and 3 mark a column as generated. The pk column is
// 0 for non-PK columns and an ascending 1-based index identifying the PK
// component otherwise.
func getColumnsAndPKs(
	ctx context.Context, q Querier, tableName string,
) ([]introspection.Column, []string, error) {
	query := "PRAGMA table_xinfo(" + core.QuoteIdentifier(tableName) + ")"

	rows, err := q.QueryContext(ctx, query)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to query table_xinfo: %w", err)
	}
	defer rows.Close()

	type pkEntry struct {
		name  string
		order int
	}

	var (
		columns []introspection.Column
		pkCols  []pkEntry
	)

	for rows.Next() {
		var (
			cid       int
			name      string
			colType   string
			notNull   bool
			dfltValue *string
			pk        int
			hidden    int
		)

		if err := rows.Scan(&cid, &name, &colType, &notNull, &dfltValue, &pk, &hidden); err != nil {
			return nil, nil, fmt.Errorf("failed to scan column: %w", err)
		}

		mappedType := mapSQLiteType(colType)

		columns = append(columns, introspection.Column{
			Name:           name,
			Type:           mappedType,
			IsNullable:     !notNull,
			IsGenerated:    hidden == 2 || hidden == 3, // virtual or stored generated
			IsArray:        false,
			SupportsMinMax: typeSupportsMinMax(mappedType),
			SupportsInc:    typeSupportsInc(mappedType),
			SupportsAgg:    typeSupportsAgg(mappedType),
			Default:        dfltValue,
			Comment:        nil, // SQLite has no column comments
		})

		if pk > 0 {
			pkCols = append(pkCols, pkEntry{name: name, order: pk})
		}
	}

	if err := rows.Err(); err != nil {
		return nil, nil, fmt.Errorf("error iterating columns: %w", err)
	}

	pks := make([]string, len(pkCols))
	for _, p := range pkCols {
		pks[p.order-1] = p.name
	}

	return columns, pks, nil
}

// getForeignKeys returns the outbound foreign keys declared on tableName via
// PRAGMA foreign_key_list. PRAGMA foreign_key_list returns rows of (id, seq,
// table, from, to, on_update, on_delete, match) — the Scan call below tracks
// that exact column order. Only (from, table, to) are used; the action codes
// are unused because the introspection model has no field for them today.
func getForeignKeys(
	ctx context.Context, q Querier, tableName string,
) ([]introspection.ForeignKey, error) {
	query := "PRAGMA foreign_key_list(" + core.QuoteIdentifier(tableName) + ")"

	rows, err := q.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query foreign_key_list: %w", err)
	}
	defer rows.Close()

	var fks []introspection.ForeignKey

	for rows.Next() {
		var (
			id        int
			seq       int
			table     string
			from      string
			to        string
			onUpdate  string
			onDelete  string
			matchRule string
		)

		if err := rows.Scan(
			&id,
			&seq,
			&table,
			&from,
			&to,
			&onUpdate,
			&onDelete,
			&matchRule,
		); err != nil {
			return nil, fmt.Errorf("failed to scan foreign key: %w", err)
		}

		fks = append(fks, introspection.ForeignKey{
			ColumnName:        from,
			ForeignSchema:     "",
			ForeignTable:      table,
			ForeignColumnName: to,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating foreign keys: %w", err)
	}

	return fks, nil
}

// getUniqueConstraints returns the unique-constraint metadata for tableName.
// It walks PRAGMA index_list (rows of seq, name, unique, origin, partial),
// keeps only indexes flagged unique=1, and then calls [getIndexColumns] for
// each one. The origin column (pk/u/c) is unused: any unique index counts,
// regardless of whether it was created implicitly for a UNIQUE column, a
// PRIMARY KEY, or an explicit CREATE UNIQUE INDEX.
func getUniqueConstraints(
	ctx context.Context, q Querier, tableName string,
) ([]introspection.UniqueConstraint, error) {
	query := "PRAGMA index_list(" + core.QuoteIdentifier(tableName) + ")"

	rows, err := q.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query index_list: %w", err)
	}
	defer rows.Close()

	var indexNames []string

	for rows.Next() {
		var (
			seq     int
			name    string
			unique  bool
			origin  string
			partial bool
		)

		if err := rows.Scan(&seq, &name, &unique, &origin, &partial); err != nil {
			return nil, fmt.Errorf("failed to scan index entry: %w", err)
		}

		if unique {
			indexNames = append(indexNames, name)
		}
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating index_list: %w", err)
	}

	var constraints []introspection.UniqueConstraint

	for _, name := range indexNames {
		cols, err := getIndexColumns(ctx, q, name)
		if err != nil {
			return nil, fmt.Errorf("reading columns for index %s: %w", name, err)
		}

		constraints = append(constraints, introspection.UniqueConstraint{
			Name:    name,
			Columns: cols,
		})
	}

	return constraints, nil
}

// getIndexColumns returns the column names belonging to indexName, in index
// order. PRAGMA index_info returns rows of (seqno, cid, name); the Scan call
// below tracks that order, and only the name is retained.
func getIndexColumns(ctx context.Context, q Querier, indexName string) ([]string, error) {
	query := "PRAGMA index_info(" + core.QuoteIdentifier(indexName) + ")"

	rows, err := q.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query index_info: %w", err)
	}
	defer rows.Close()

	var cols []string

	for rows.Next() {
		var (
			seqno int
			cid   int
			name  string
		)

		if err := rows.Scan(&seqno, &cid, &name); err != nil {
			return nil, fmt.Errorf("failed to scan index column: %w", err)
		}

		cols = append(cols, name)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating index columns: %w", err)
	}

	return cols, nil
}

// introspectEnumValues reads the value+description rows from every table that
// metadata flags as an enum (TableMetadata.IsEnum). For each such table it
// uses [introspection.Table.EnumColumns] to find the value column (the single
// PK column) and the optional description column, then delegates to
// [getEnumTable]. Returns a map keyed by "schema.table" — schema is always
// empty on SQLite since there is no schema namespace. Per-table failures
// (missing table, invalid enum shape, query error, empty value set) are
// silently elided; the outer reconcile pass records an inconsistency and
// clears the is_enum flag so the table still serves as a regular table.
func introspectEnumValues(
	ctx context.Context,
	q Querier,
	dbMeta *metadata.DatabaseMetadata,
	tables map[string]*introspection.Table,
) map[string][]introspection.EnumValue {
	result := make(map[string][]introspection.EnumValue)

	for i := range dbMeta.Tables {
		tableMeta := &dbMeta.Tables[i]

		if !tableMeta.IsEnum {
			continue
		}

		schemaName := tableMeta.Table.Schema
		tableName := tableMeta.Table.Name

		// Look up introspected table to determine actual column names
		table, ok := tables[tableName]
		if !ok {
			continue
		}

		valueCol, descCol, err := table.EnumColumns()
		if err != nil {
			continue
		}

		enumValues, err := getEnumTable(ctx, q, tableName, valueCol, descCol)
		if err != nil || len(enumValues) == 0 {
			continue
		}

		key := schemaName + "." + tableName
		result[key] = enumValues
	}

	return result
}

// getEnumTable queries an enum table for its values and (optionally) per-row
// descriptions. valueCol is the PK column holding enum values; descCol is the
// optional description column — an empty string drops the description from the
// SELECT and the Scan path keys off that single source of truth so the two
// branches cannot drift.
func getEnumTable(
	ctx context.Context, q Querier, tableName, valueCol, descCol string,
) ([]introspection.EnumValue, error) {
	selectCols := core.QuoteIdentifier(valueCol)
	if descCol != "" {
		selectCols += ", " + core.QuoteIdentifier(descCol)
	}

	query := fmt.Sprintf(
		"SELECT %s FROM %s ORDER BY %s",
		selectCols,
		core.QuoteIdentifier(tableName),
		core.QuoteIdentifier(valueCol),
	)

	rows, err := q.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query enum table: %w", err)
	}
	defer rows.Close()

	var enumValues []introspection.EnumValue

	for rows.Next() {
		var (
			value       string
			description *string
		)

		scanDests := []any{&value}
		if descCol != "" {
			scanDests = append(scanDests, &description)
		}

		if err := rows.Scan(scanDests...); err != nil {
			return nil, fmt.Errorf("failed to scan enum row: %w", err)
		}

		desc := ""
		if description != nil {
			desc = *description
		}

		enumValues = append(enumValues, introspection.EnumValue{
			Value:   value,
			Comment: desc,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating enum rows: %w", err)
	}

	return enumValues, nil
}

// mapSQLiteType maps a SQLite column type declaration to a normalized type
// name compatible with the rest of the introspection system. The prefix-based
// switch implements SQLite's column-affinity rules (see
// https://sqlite.org/datatype3.html#determination_of_column_affinity §3.1):
// declarations are normalized to upper-case and inspected for the substring
// markers SQLite itself uses — INT-prefixed names take integer affinity, the
// CHAR / CLOB / TEXT family takes text affinity, BLOB or empty take none /
// bytea, REAL / FLOAT / DOUBLE-prefixed names take real affinity, and
// anything else falls through to text. The high cyclomatic complexity is
// intrinsic to this rule set; the function is otherwise a flat type switch
// with no branching on external state.
func mapSQLiteType(sqliteType string) string { //nolint:gocyclo,cyclop
	upper := strings.ToUpper(strings.TrimSpace(sqliteType))

	switch {
	case upper == "INTEGER" || upper == "INT" || upper == "BIGINT" ||
		upper == "SMALLINT" || upper == "TINYINT" || upper == "MEDIUMINT":
		return "int8" //nolint:goconst // matches sibling type cases that also nolint goconst
	case upper == "REAL" || upper == "FLOAT" || upper == "DOUBLE" ||
		strings.HasPrefix(upper, "DOUBLE "):
		return "float8" //nolint:goconst
	case upper == "BOOLEAN" || upper == "BOOL":
		return "bool"
	case upper == "NUMERIC" || upper == "DECIMAL" ||
		strings.HasPrefix(upper, "NUMERIC(") || strings.HasPrefix(upper, "DECIMAL("):
		return "numeric" //nolint:goconst
	case upper == "TEXT" || upper == "CLOB" ||
		strings.HasPrefix(upper, "VARCHAR") || strings.HasPrefix(upper, "CHAR") ||
		strings.HasPrefix(upper, "VARYING") || strings.HasPrefix(upper, "NCHAR") ||
		strings.HasPrefix(upper, "NVARCHAR") || strings.HasPrefix(upper, "NATIVE"):
		return "text" //nolint:goconst
	case upper == "BLOB" || upper == "":
		return "bytea"
	case upper == "DATE":
		return "date"
	case upper == "DATETIME" || upper == "TIMESTAMP" ||
		strings.HasPrefix(upper, "TIMESTAMP"):
		return "timestamptz"
	case upper == "UUID":
		return "uuid"
	case upper == "JSON" || upper == "JSONB":
		return "json"
	default:
		return "text"
	}
}

// typeSupportsMinMax returns whether a mapped type supports min/max aggregation.
func typeSupportsMinMax(mappedType string) bool {
	switch mappedType {
	case "int8", "float8", "numeric", "text", "date", "timestamptz", "uuid":
		return true
	default:
		return false
	}
}

// typeSupportsInc returns whether a mapped type supports increment (+) operations.
func typeSupportsInc(mappedType string) bool {
	switch mappedType {
	case "int8", "float8", "numeric":
		return true
	default:
		return false
	}
}

// typeSupportsAgg returns whether a mapped type supports numeric aggregation (sum, avg, etc.).
func typeSupportsAgg(mappedType string) bool {
	switch mappedType {
	case "int8", "float8", "numeric":
		return true
	default:
		return false
	}
}
