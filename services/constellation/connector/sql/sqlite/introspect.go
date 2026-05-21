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

	enumValues, err := introspectEnumValues(ctx, c.db, dbMeta, schema.Tables)
	if err != nil {
		return nil, fmt.Errorf("failed to introspect enum values: %w", err)
	}

	objs := introspection.NewObjects()
	objs.Schemas[""] = schema
	objs.EnumValues = enumValues

	return objs, nil
}

// introspectTables discovers all user tables and views in the database and
// returns a fully-populated [introspection.Table] for each one (columns,
// primary keys, foreign keys, unique constraints). It walks the names emitted
// by [getTableNames] in lexicographic order so the resulting slice is stable
// across runs.
func introspectTables(ctx context.Context, q Querier) ([]introspection.Table, error) {
	tableNames, err := getTableNames(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("listing tables: %w", err)
	}

	tables := make([]introspection.Table, 0, len(tableNames))

	for _, name := range tableNames {
		t, err := introspectTable(ctx, q, name)
		if err != nil {
			return nil, fmt.Errorf("failed to introspect table %s: %w", name, err)
		}

		tables = append(tables, *t)
	}

	return tables, nil
}

// getTableNames returns user-defined table and view names from sqlite_master,
// excluding the internal sqlite_* objects. Ordering is by name so the rest of
// introspection sees a stable slice.
func getTableNames(ctx context.Context, q Querier) ([]string, error) {
	rows, err := q.QueryContext(ctx,
		`SELECT name FROM sqlite_master
		 WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
		 ORDER BY name`,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query sqlite_master: %w", err)
	}
	defer rows.Close()

	var names []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("failed to scan table name: %w", err)
		}

		names = append(names, name)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating table names: %w", err)
	}

	return names, nil
}

// introspectTable builds a complete [introspection.Table] for one SQLite table
// by reading PRAGMA table_xinfo (columns + primary key), PRAGMA
// foreign_key_list (FKs), and PRAGMA index_list / index_info (unique
// constraints) in turn. SQLite has no per-table or per-column comment system,
// so the corresponding fields are always nil.
func introspectTable(
	ctx context.Context,
	q Querier,
	tableName string,
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

	return &introspection.Table{
		Schema:                   "",
		Name:                     tableName,
		Comment:                  nil,
		Columns:                  columns,
		PrimaryKeys:              pks,
		PrimaryKeyConstraintName: "",
		ForeignKeys:              fks,
		UniqueConstraints:        ucs,
	}, nil
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
// empty on SQLite since there is no schema namespace.
func introspectEnumValues(
	ctx context.Context,
	q Querier,
	dbMeta *metadata.DatabaseMetadata,
	tables map[string]*introspection.Table,
) (map[string][]introspection.EnumValue, error) {
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
			return nil, fmt.Errorf(
				"enum table %s.%s not found in introspected objects",
				schemaName, tableName,
			)
		}

		valueCol, descCol, err := table.EnumColumns()
		if err != nil {
			return nil, fmt.Errorf("invalid enum table %s.%s: %w", schemaName, tableName, err)
		}

		enumValues, err := getEnumTable(ctx, q, tableName, valueCol, descCol)
		if err != nil {
			return nil, fmt.Errorf(
				"failed to introspect enum table %s.%s: %w",
				schemaName, tableName, err,
			)
		}

		key := schemaName + "." + tableName
		result[key] = enumValues
	}

	return result, nil
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
		return "int8"
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
