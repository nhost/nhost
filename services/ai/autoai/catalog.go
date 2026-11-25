package autoai

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/nhost/nhost/services/ai/hasura"
)

// Catalog inspects deployment targets and function ownership without interpolating identifiers.
//
//go:generate mockgen -package mock -destination mock/catalog.go . Catalog
type Catalog interface {
	PrimaryKey(ctx context.Context, schema, table string) ([]hasura.PKInformation, error)
	VectorColumn(ctx context.Context, schema, table, column string) (string, int, error)
	TaggedFunctions(ctx context.Context, id string) ([]Function, error)
}

// Function identifies all signatures of a function in a namespace.
type Function struct{ Schema, Name string }

// SQLCatalog reads PostgreSQL deployment metadata. Construct it with NewSQLCatalog.
type SQLCatalog struct{ db *sql.DB }

// NewSQLCatalog inspects the same PostgreSQL database as Hasura's default source.
func NewSQLCatalog(db *sql.DB) *SQLCatalog { return &SQLCatalog{db: db} }

func (c *SQLCatalog) PrimaryKey(
	ctx context.Context,
	schema, table string,
) ([]hasura.PKInformation, error) {
	rows, err := c.db.QueryContext(
		ctx,
		`SELECT a.attname, pg_catalog.format_type(a.atttypid,a.atttypmod)
 FROM pg_index i JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum,position) ON k.position<=i.indnkeyatts
 JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum
 JOIN pg_class t ON t.oid=i.indrelid JOIN pg_namespace n ON n.oid=t.relnamespace
 WHERE n.nspname=$1 AND t.relname=$2 AND i.indisprimary AND a.attnum>0 AND NOT a.attisdropped`,
		schema,
		table,
	)
	if err != nil {
		return nil, fmt.Errorf("inspect primary key: %w", err)
	}
	defer rows.Close()

	var result []hasura.PKInformation
	for rows.Next() {
		var pk hasura.PKInformation
		if err := rows.Scan(&pk.ColumnName, &pk.DataType); err != nil {
			return nil, fmt.Errorf("read primary key: %w", err)
		}

		result = append(result, pk)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read primary keys: %w", err)
	}

	return result, nil
}

func (c *SQLCatalog) VectorColumn(
	ctx context.Context,
	schema, table, column string,
) (string, int, error) {
	var (
		typ        string
		dimensions int
	)

	err := c.db.QueryRowContext(ctx, `SELECT ty.typname,a.atttypmod FROM pg_attribute a
 JOIN pg_class t ON t.oid=a.attrelid JOIN pg_namespace n ON n.oid=t.relnamespace
 JOIN pg_type ty ON ty.oid=a.atttypid
 WHERE n.nspname=$1 AND t.relname=$2 AND a.attname=$3 AND a.attnum>0 AND NOT a.attisdropped`,
		schema, table, column).Scan(&typ, &dimensions)
	if err != nil {
		return "", 0, fmt.Errorf("inspect vector column: %w", err)
	}

	return typ, dimensions, nil
}

func (c *SQLCatalog) TaggedFunctions(ctx context.Context, id string) ([]Function, error) {
	rows, err := c.db.QueryContext(
		ctx,
		`SELECT DISTINCT n.nspname,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE obj_description(p.oid,'pg_proc')=$1`,
		ownershipTag(id),
	)
	if err != nil {
		return nil, fmt.Errorf("inspect functions: %w", err)
	}
	defer rows.Close()

	var result []Function
	for rows.Next() {
		var f Function
		if err := rows.Scan(&f.Schema, &f.Name); err != nil {
			return nil, fmt.Errorf("read function: %w", err)
		}

		result = append(result, f)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read functions: %w", err)
	}

	return result, nil
}

func ownershipTag(id string) string { return "nhost-ai:auto_embeddings:" + id }
