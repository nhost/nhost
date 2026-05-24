package postgres

import (
	"context"
	"fmt"
	"maps"
	"slices"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// Introspect returns the database objects (schemas, tables, columns, primary keys, functions).
// If no schemaNames are specified, all schemas in the database are discovered and introspected.
func (c *Client) Introspect(
	ctx context.Context,
	dbMeta *metadata.DatabaseMetadata,
) (*introspection.Objects, error) {
	objs := introspection.NewObjects()

	schemaNames, err := getSchemas(ctx, c.pool)
	if err != nil {
		return nil, fmt.Errorf("failed to discover schemas: %w", err)
	}

	for _, schemaName := range schemaNames {
		schema, err := introspectSchemaObjects(ctx, c.pool, schemaName)
		if err != nil {
			return nil, fmt.Errorf("failed to introspect schema %s: %w", schemaName, err)
		}

		objs.Schemas[schemaName] = schema
	}

	objs.EnumValues = c.introspectEnumValues(ctx, dbMeta, objs)

	objs.Functions, err = c.introspectFunctions(ctx, dbMeta)
	if err != nil {
		return nil, fmt.Errorf("introspecting functions: %w", err)
	}

	return objs, nil
}

// introspectEnumValues populates enum values for all tables marked as enums
// in metadata. Per-table failures (missing table in source, invalid enum
// shape, query error, empty value set) are silently elided from the result
// map; the outer reconcile pass turns each absence into an inconsistency and
// clears the is_enum flag so the table is still served as a regular table.
func (c *Client) introspectEnumValues(
	ctx context.Context,
	dbMeta *metadata.DatabaseMetadata,
	objs *introspection.Objects,
) map[string][]introspection.EnumValue {
	result := make(map[string][]introspection.EnumValue)

	for i := range dbMeta.Tables {
		tableMeta := &dbMeta.Tables[i]

		if !tableMeta.IsEnum {
			continue
		}

		schemaName := tableMeta.Table.Schema
		tableName := tableMeta.Table.Name

		table, ok := objs.GetTable(schemaName, tableName)
		if !ok {
			continue
		}

		valueCol, descCol, err := table.EnumColumns()
		if err != nil {
			continue
		}

		enumValues, err := getEnumTable(ctx, c.pool, schemaName, tableName, valueCol, descCol)
		if err != nil || len(enumValues) == 0 {
			continue
		}

		key := schemaName + "." + tableName
		result[key] = enumValues
	}

	return result
}

// getSchemas discovers all schemas in the database, excluding system schemas.
// Reads pg_catalog.pg_namespace directly rather than information_schema.schemata
// so the result is independent of whether the connecting role is a member of
// each schema's owning role — information_schema views filter rows via
// pg_has_role()/has_*_privilege(), which silently hides objects from roles that
// only hold per-object grants. See populateForeignKeys for the same motivation.
func getSchemas(ctx context.Context, q Querier) ([]string, error) {
	query := `
		SELECT n.nspname
		FROM pg_catalog.pg_namespace n
		WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
		AND n.nspname NOT LIKE 'pg_temp_%'
		AND n.nspname NOT LIKE 'pg_toast_temp_%'
		ORDER BY n.nspname
	`

	rows, err := q.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query schemas: %w", err)
	}
	defer rows.Close()

	var schemas []string
	for rows.Next() {
		var schemaName string
		if err := rows.Scan(&schemaName); err != nil {
			return nil, fmt.Errorf("failed to scan schema name: %w", err)
		}

		schemas = append(schemas, schemaName)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating schema rows: %w", err)
	}

	return schemas, nil
}

// introspectSchemaObjects retrieves all objects (tables, columns, primary keys) for a schema.
func introspectSchemaObjects(
	ctx context.Context,
	q Querier,
	schemaName string,
) (*introspection.Schema, error) {
	schema := &introspection.Schema{
		Tables: make(map[string]*introspection.Table),
	}

	tables, err := getTables(ctx, q, schemaName)
	if err != nil {
		return nil, fmt.Errorf("failed to get tables: %w", err)
	}

	for i := range tables {
		schema.Tables[tables[i].Name] = &tables[i]
	}

	for _, tableName := range slices.Sorted(maps.Keys(schema.Tables)) {
		pkInfo, err := getPrimaryKeys(ctx, q, schemaName, tableName)
		if err != nil {
			return nil, fmt.Errorf("failed to get primary keys for table %s: %w", tableName, err)
		}

		schema.Tables[tableName].PrimaryKeys = pkInfo.columns
		schema.Tables[tableName].PrimaryKeyConstraintName = pkInfo.constraintName

		comment, err := getTableComment(ctx, q, schemaName, tableName)
		if err != nil {
			return nil, fmt.Errorf("failed to get comment for table %s: %w", tableName, err)
		}

		schema.Tables[tableName].Comment = comment
	}

	return schema, nil
}

// getTables queries the information_schema to get all tables and columns for a schema.
func getTables(
	ctx context.Context,
	q Querier,
	schemaName string,
) ([]introspection.Table, error) {
	tableMap := make(map[string]*introspection.Table)

	if err := populateTableColumns(ctx, q, schemaName, tableMap); err != nil {
		return nil, err
	}

	if err := populateForeignKeys(ctx, q, schemaName, tableMap); err != nil {
		return nil, err
	}

	if err := populateUniqueConstraints(ctx, q, schemaName, tableMap); err != nil {
		return nil, err
	}

	if err := populateRelationKinds(ctx, q, schemaName, tableMap); err != nil {
		return nil, err
	}

	tables := make([]introspection.Table, 0, len(tableMap))
	for _, table := range tableMap {
		tables = append(tables, *table)
	}

	return tables, nil
}

// populateRelationKinds fills in IsView / IsInsertable / IsUpdatable on every
// relation previously discovered by populateTableColumns. Base tables (relkind
// 'r') and partitioned tables ('p') are always insertable and updatable. Views
// ('v') and foreign tables ('f') consult pg_relation_is_updatable(), which is
// the same function information_schema.views uses internally: bit 8 (INSERT)
// gates IsInsertable, and bits 4|16 (UPDATE|DELETE) jointly gate IsUpdatable —
// the same (& 20) = 20 check information_schema.views.is_updatable uses. The
// schema generator uses these to suppress mutation fields on relations the
// database itself will reject writes to.
func populateRelationKinds(
	ctx context.Context,
	q Querier,
	schemaName string,
	tableMap map[string]*introspection.Table,
) error {
	if len(tableMap) == 0 {
		return nil
	}

	// pg_relation_is_updatable() returns an int bitmask whose bits mirror
	// the SQL standard's IS_UPDATABLE semantics (bit 4 = UPDATE, bit 8 =
	// INSERT, bit 16 = DELETE). information_schema.views uses the same
	// `& 8 = 8` (INSERT) and `& 20 = 20` (UPDATE|DELETE) checks; we
	// replicate them here against pg_class so the query works without
	// privileges on the relation's owner role.
	query := `
		SELECT
			cls.relname AS table_name,
			cls.relkind = 'v' AS is_view,
			CASE
				WHEN cls.relkind IN ('r', 'p') THEN true
				WHEN cls.relkind IN ('v', 'f') THEN
					(pg_catalog.pg_relation_is_updatable(cls.oid, false) & 8) = 8
				ELSE false
			END AS is_insertable,
			CASE
				WHEN cls.relkind IN ('r', 'p') THEN true
				WHEN cls.relkind IN ('v', 'f') THEN
					(pg_catalog.pg_relation_is_updatable(cls.oid, false) & 20) = 20
				ELSE false
			END AS is_updatable
		FROM pg_catalog.pg_class cls
		JOIN pg_catalog.pg_namespace ns ON ns.oid = cls.relnamespace
		WHERE ns.nspname = $1
			AND cls.relkind IN ('r', 'v', 'f', 'p')
	`

	rows, err := q.Query(ctx, query, schemaName)
	if err != nil {
		return fmt.Errorf("failed to query relation kinds: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var (
			tableName    string
			isView       bool
			isInsertable bool
			isUpdatable  bool
		)
		if err := rows.Scan(&tableName, &isView, &isInsertable, &isUpdatable); err != nil {
			return fmt.Errorf("failed to scan relation kind row: %w", err)
		}

		table, ok := tableMap[tableName]
		if !ok {
			// Table was filtered out earlier (e.g. no columns) — skip it
			// rather than synthesising an empty Table here.
			continue
		}

		table.IsView = isView
		table.IsInsertable = isInsertable
		table.IsUpdatable = isUpdatable
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("error iterating relation kind rows: %w", err)
	}

	return nil
}

// populateTableColumns queries and populates column information for tables in a schema.
func populateTableColumns( //nolint:funlen
	ctx context.Context,
	q Querier,
	schemaName string,
	tableMap map[string]*introspection.Table,
) error {
	// A type is considered "fully numeric" only when it implements the entire
	// standard numeric aggregate suite (avg/sum/stddev*/var*/variance). pgvector
	// for example defines avg(vector) and sum(vector) but none of the spread
	// statistics; without this check we would expose stddev/variance on vector
	// columns and they would fail at SQL execution time.
	// Similarly, `_inc` is only meaningful for types that are both numeric AND
	// support the `+` operator — vector has `+` but isn't a scalar increment.
	//nolint:lll
	query := `
		WITH type_aggregates AS (
			SELECT
				t.typname,
				bool_or(p.proname IN ('min', 'max')) as supports_min_max,
				COUNT(DISTINCT p.proname) FILTER (
					WHERE p.proname IN ('sum', 'avg', 'stddev', 'variance', 'stddev_pop', 'stddev_samp', 'var_pop', 'var_samp')
				) = 8 as supports_numeric_agg
			FROM pg_aggregate a
			JOIN pg_proc p ON p.oid = a.aggfnoid
			JOIN pg_type t ON t.oid = ANY(p.proargtypes)
			WHERE p.proname IN ('min', 'max', 'sum', 'avg', 'stddev', 'variance', 'stddev_pop', 'stddev_samp', 'var_pop', 'var_samp')
			GROUP BY t.typname
		),
		type_operators AS (
			SELECT DISTINCT t.typname
			FROM pg_operator o
			JOIN pg_type t ON t.oid = o.oprleft
			WHERE o.oprname = '+'
				AND o.oprleft = o.oprright
		),
		type_with_aliases AS (
			SELECT typname, supports_min_max, supports_inc, supports_numeric_agg FROM (
				SELECT
					ta.typname,
					ta.supports_min_max,
					(to2.typname IS NOT NULL) AND ta.supports_numeric_agg as supports_inc,
					ta.supports_numeric_agg
				FROM type_aggregates ta
				LEFT JOIN type_operators to2 ON to2.typname = ta.typname

				UNION ALL

				SELECT 'varchar', ta.supports_min_max,
					(to2.typname IS NOT NULL) AND ta.supports_numeric_agg as supports_inc,
					ta.supports_numeric_agg
				FROM type_aggregates ta
				LEFT JOIN type_operators to2 ON to2.typname = 'text'
				WHERE ta.typname = 'text'

				UNION ALL

				-- Types with a default btree operator class support min/max
				-- via polymorphic aggregates (e.g. min(anynonarray)) even
				-- without explicit min(type)/max(type) functions in pg_proc
				SELECT DISTINCT
					t.typname,
					true,
					false,
					false
				FROM pg_type t
				JOIN pg_opclass oc ON oc.opcintype = t.oid
				JOIN pg_am am ON am.oid = oc.opcmethod
				WHERE am.amname = 'btree'
				AND oc.opcdefault = true
				AND NOT EXISTS (
					SELECT 1 FROM type_aggregates ta WHERE ta.typname = t.typname
				)
			) sub
		)
		SELECT
			cls.relname AS table_name,
			a.attname AS column_name,
			CASE
				WHEN t.typcategory = 'A' THEN COALESCE(elem_bt.typname, elem.typname)
				ELSE COALESCE(bt.typname, t.typname)
			END as typname,
			CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END as is_nullable,
			a.attgenerated != '' as is_generated,
			t.typcategory = 'A' as is_array,
			COALESCE(ta.supports_min_max, false) as supports_min_max,
			COALESCE(ta.supports_inc, false) as supports_inc,
			COALESCE(ta.supports_numeric_agg, false) as supports_numeric_agg,
			CASE
			WHEN a.attgenerated = '' THEN pg_catalog.pg_get_expr(ad.adbin, ad.adrelid)
		END AS column_default,
			pg_catalog.col_description(cls.oid, a.attnum::int) as column_comment
		FROM pg_catalog.pg_class cls
		JOIN pg_catalog.pg_namespace ns ON ns.oid = cls.relnamespace
		JOIN pg_catalog.pg_attribute a ON a.attrelid = cls.oid
		JOIN pg_catalog.pg_type t ON t.oid = a.atttypid
		LEFT JOIN pg_catalog.pg_attrdef ad
			ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
		LEFT JOIN pg_catalog.pg_type bt ON bt.oid = t.typbasetype
		LEFT JOIN pg_catalog.pg_type elem
			ON elem.oid = t.typelem AND t.typcategory = 'A'
		LEFT JOIN pg_catalog.pg_type elem_bt ON elem_bt.oid = elem.typbasetype
		LEFT JOIN type_with_aliases ta ON ta.typname = CASE
			WHEN t.typcategory = 'A' THEN COALESCE(elem_bt.typname, elem.typname)
			ELSE COALESCE(bt.typname, t.typname)
		END
		WHERE ns.nspname = $1
			AND cls.relkind IN ('r', 'v', 'f', 'p')
			AND a.attnum > 0
			AND NOT a.attisdropped
		ORDER BY cls.relname, a.attnum
	`

	rows, err := q.Query(ctx, query, schemaName)
	if err != nil {
		return fmt.Errorf("failed to query tables: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var (
			tableName      string
			columnName     string
			typeName       string
			isNullable     string
			isGenerated    bool
			isArray        bool
			supportsMinMax bool
			supportsInc    bool
			supportsAgg    bool
			columnDefault  *string
			columnComment  *string
		)

		if err := rows.Scan(
			&tableName, &columnName, &typeName, &isNullable, &isGenerated,
			&isArray,
			&supportsMinMax, &supportsInc, &supportsAgg,
			&columnDefault, &columnComment,
		); err != nil {
			return fmt.Errorf("failed to scan row: %w", err)
		}

		// Array types don't support aggregate operations on the array itself
		if isArray {
			supportsMinMax = false
			supportsInc = false
			supportsAgg = false
		}

		table, exists := tableMap[tableName]
		if !exists {
			table = &introspection.Table{
				Schema:                   schemaName,
				Name:                     tableName,
				Comment:                  nil,
				Columns:                  nil,
				PrimaryKeys:              nil,
				PrimaryKeyConstraintName: "",
				ForeignKeys:              nil,
				UniqueConstraints:        nil,
				IsView:                   false,
				IsInsertable:             true,
				IsUpdatable:              true,
			}
			tableMap[tableName] = table
		}

		table.Columns = append(table.Columns, introspection.Column{
			Name:           columnName,
			Type:           typeName,
			IsNullable:     isNullable == "YES",
			IsGenerated:    isGenerated,
			IsArray:        isArray,
			Default:        columnDefault,
			Comment:        columnComment,
			SupportsMinMax: supportsMinMax,
			SupportsInc:    supportsInc,
			SupportsAgg:    supportsAgg,
		})
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("error iterating rows: %w", err)
	}

	return nil
}

// populateForeignKeys queries and populates foreign key information for tables in a schema.
// Reads pg_catalog.pg_constraint by OID instead of joining the
// information_schema.{table_constraints,key_column_usage,constraint_column_usage}
// views. The constraint_column_usage view in particular filters its output by
// pg_has_role() on the *referenced* table's owner, so a role that has SELECT
// grants but no membership in the owner role (e.g. nhost_hasura against
// auth.* tables owned by nhost_auth_admin) cannot see foreign keys whose
// targets it does not own. Catalog reads only require SELECT on pg_catalog
// and return constraints regardless of role membership.
func populateForeignKeys(
	ctx context.Context,
	q Querier,
	schemaName string,
	tableMap map[string]*introspection.Table,
) error {
	query := `
		SELECT
			ct.relname AS table_name,
			ac.attname AS column_name,
			cftn.nspname AS foreign_schema,
			cft.relname AS foreign_table_name,
			afc.attname AS foreign_column_name
		FROM pg_catalog.pg_constraint r
		JOIN pg_catalog.pg_class ct ON ct.oid = r.conrelid
		JOIN pg_catalog.pg_namespace ctn ON ctn.oid = ct.relnamespace
		JOIN pg_catalog.pg_class cft ON cft.oid = r.confrelid
		JOIN pg_catalog.pg_namespace cftn ON cftn.oid = cft.relnamespace
		JOIN LATERAL unnest(r.conkey) WITH ORDINALITY AS k(col_id, ord) ON true
		JOIN pg_catalog.pg_attribute ac
			ON ac.attrelid = r.conrelid AND ac.attnum = k.col_id
		JOIN pg_catalog.pg_attribute afc
			ON afc.attrelid = r.confrelid AND afc.attnum = r.confkey[k.ord]
		WHERE r.contype = 'f'
			AND ctn.nspname = $1
		ORDER BY ct.relname, r.conname, k.ord
	`

	rows, err := q.Query(ctx, query, schemaName)
	if err != nil {
		return fmt.Errorf("failed to query foreign keys: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var (
			tableName         string
			columnName        string
			foreignSchema     string
			foreignTableName  string
			foreignColumnName string
		)

		if err := rows.Scan(
			&tableName, &columnName,
			&foreignSchema, &foreignTableName, &foreignColumnName,
		); err != nil {
			return fmt.Errorf("failed to scan foreign key row: %w", err)
		}

		if table, exists := tableMap[tableName]; exists {
			table.ForeignKeys = append(table.ForeignKeys, introspection.ForeignKey{
				ColumnName:        columnName,
				ForeignSchema:     foreignSchema,
				ForeignTable:      foreignTableName,
				ForeignColumnName: foreignColumnName,
			})
		}
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("error iterating foreign key rows: %w", err)
	}

	return nil
}

// populateUniqueConstraints queries and populates unique constraint information for tables in a schema.
// Uses pg_catalog directly (see populateForeignKeys for rationale).
func populateUniqueConstraints(
	ctx context.Context,
	q Querier,
	schemaName string,
	tableMap map[string]*introspection.Table,
) error {
	query := `
		SELECT
			cls.relname AS table_name,
			r.conname AS constraint_name,
			array_agg(a.attname ORDER BY k.ord) AS columns
		FROM pg_catalog.pg_constraint r
		JOIN pg_catalog.pg_class cls ON cls.oid = r.conrelid
		JOIN pg_catalog.pg_namespace ns ON ns.oid = cls.relnamespace
		JOIN LATERAL unnest(r.conkey) WITH ORDINALITY AS k(col_id, ord) ON true
		JOIN pg_catalog.pg_attribute a
			ON a.attrelid = r.conrelid AND a.attnum = k.col_id
		WHERE r.contype = 'u'
			AND ns.nspname = $1
		GROUP BY cls.relname, r.conname
		ORDER BY cls.relname, r.conname
	`

	rows, err := q.Query(ctx, query, schemaName)
	if err != nil {
		return fmt.Errorf("failed to query unique constraints: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var (
			tableName      string
			constraintName string
			columns        []string
		)

		if err := rows.Scan(&tableName, &constraintName, &columns); err != nil {
			return fmt.Errorf("failed to scan unique constraint row: %w", err)
		}

		if table, exists := tableMap[tableName]; exists {
			table.UniqueConstraints = append(
				table.UniqueConstraints,
				introspection.UniqueConstraint{
					Name:    constraintName,
					Columns: columns,
				},
			)
		}
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("error iterating unique constraint rows: %w", err)
	}

	return nil
}

// primaryKeyInfo contains the primary key columns and constraint name for a table.
type primaryKeyInfo struct {
	columns        []string
	constraintName string
}

// getPrimaryKeys retrieves the primary key columns and constraint name for a table.
func getPrimaryKeys(
	ctx context.Context,
	q Querier,
	schemaName, tableName string,
) (primaryKeyInfo, error) {
	query := `
		SELECT a.attname, c.conname
		FROM pg_index i
		JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
		JOIN pg_constraint c ON c.conindid = i.indexrelid AND c.contype = 'p'
		WHERE i.indrelid = ($1 || '.' || $2)::regclass
		AND i.indisprimary
		ORDER BY a.attnum
	`

	rows, err := q.Query(ctx, query, schemaName, tableName)
	if err != nil {
		return primaryKeyInfo{}, fmt.Errorf("failed to query primary keys: %w", err)
	}
	defer rows.Close()

	var info primaryKeyInfo

	for rows.Next() {
		var columnName, constraintName string
		if err := rows.Scan(&columnName, &constraintName); err != nil {
			return primaryKeyInfo{}, fmt.Errorf("failed to scan primary key column: %w", err)
		}

		info.columns = append(info.columns, columnName)
		info.constraintName = constraintName
	}

	if err := rows.Err(); err != nil {
		return primaryKeyInfo{}, fmt.Errorf("error iterating primary key rows: %w", err)
	}

	return info, nil
}

// getTableComment retrieves the comment for a table.
func getTableComment(
	ctx context.Context,
	q Querier,
	schemaName, tableName string,
) (*string, error) {
	query := `
		SELECT pg_catalog.obj_description(
			('"' || $1 || '"."' || $2 || '"')::regclass::oid,
			'pg_class'
		)
	`

	var comment *string

	err := q.QueryRow(ctx, query, schemaName, tableName).Scan(&comment)
	if err != nil {
		return nil, fmt.Errorf("failed to query table comment: %w", err)
	}

	return comment, nil
}

// getEnumTable queries an enum table to get its values and optional descriptions.
// valueCol is the PK column holding enum values; descCol is the optional description column.
func getEnumTable(
	ctx context.Context,
	q Querier,
	schemaName, tableName, valueCol, descCol string,
) ([]introspection.EnumValue, error) {
	var query string

	if descCol != "" {
		query = `SELECT ` + core.QuoteIdentifier(valueCol) + `, ` + core.QuoteIdentifier(descCol) +
			` FROM ` + core.QuoteIdentifier(schemaName) + `.` + core.QuoteIdentifier(tableName) +
			` ORDER BY ` + core.QuoteIdentifier(valueCol)
	} else {
		query = `SELECT ` + core.QuoteIdentifier(valueCol) +
			` FROM ` + core.QuoteIdentifier(schemaName) + `.` + core.QuoteIdentifier(tableName) +
			` ORDER BY ` + core.QuoteIdentifier(valueCol)
	}

	rows, err := q.Query(ctx, query)
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

		if descCol != "" {
			if err := rows.Scan(&value, &description); err != nil {
				return nil, fmt.Errorf("failed to scan enum row: %w", err)
			}
		} else {
			if err := rows.Scan(&value); err != nil {
				return nil, fmt.Errorf("failed to scan enum row: %w", err)
			}
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
