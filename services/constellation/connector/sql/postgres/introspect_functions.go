package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// introspectFunctions populates function metadata for all tracked functions
// in metadata. Functions that have no matching pg_proc row are silently
// elided from the result; the outer reconcile pass turns each absence into a
// per-function inconsistency and drops the function from the effective
// metadata so the rest of the source keeps serving. Other introspection
// failures (connection errors, scan errors, etc.) still propagate.
func (c *Client) introspectFunctions(
	ctx context.Context,
	dbMeta *metadata.DatabaseMetadata,
) (map[string]*introspection.Function, error) {
	result := make(map[string]*introspection.Function)

	for i := range dbMeta.Functions {
		fnMeta := &dbMeta.Functions[i]

		schemaName := fnMeta.Function.Schema
		funcName := fnMeta.Function.Name

		fn, err := introspectFunction(ctx, c.pool, schemaName, funcName)
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			// Function not present in pg_proc — drop silently so the
			// reconciler records a kind=function inconsistency without
			// taking the whole source down.
			continue
		case err != nil:
			return nil, fmt.Errorf(
				"failed to introspect function %s.%s: %w",
				schemaName,
				funcName,
				err,
			)
		}

		key := schemaName + "." + funcName
		result[key] = fn
	}

	return result, nil
}

// introspectFunction retrieves metadata for a single PostgreSQL function.
func introspectFunction( //nolint:funlen
	ctx context.Context,
	q Querier,
	schemaName, funcName string,
) (*introspection.Function, error) {
	query := `
		SELECT
			p.proargnames AS arg_names,
			COALESCE(
				(SELECT array_agg(format_type(t.oid, NULL) ORDER BY ord)
				 FROM unnest(p.proargtypes) WITH ORDINALITY AS u(oid, ord)
				 JOIN pg_type t ON t.oid = u.oid),
				'{}'::text[]
			) AS arg_types,
			p.pronargdefaults AS num_defaults,
			t.typname AS return_type,
			p.proretset AS is_setof,
			CASE
				WHEN t.typrelid != 0 THEN
					(SELECT c.relname FROM pg_class c WHERE c.oid = t.typrelid)
				ELSE NULL
			END AS return_table_name,
			CASE
				WHEN t.typrelid != 0 THEN
					(SELECT ns.nspname FROM pg_class c
					 JOIN pg_namespace ns ON c.relnamespace = ns.oid
					 WHERE c.oid = t.typrelid)
				ELSE NULL
			END AS return_table_schema,
			CASE p.provolatile
				WHEN 'i' THEN 'IMMUTABLE'
				WHEN 's' THEN 'STABLE'
				WHEN 'v' THEN 'VOLATILE'
			END AS volatility
		FROM pg_proc p
		JOIN pg_namespace n ON p.pronamespace = n.oid
		JOIN pg_type t ON p.prorettype = t.oid
		WHERE n.nspname = $1 AND p.proname = $2
		LIMIT 1
	`

	var (
		argNames        []string
		argTypes        []string
		numDefaults     int
		returnType      string
		isSetOf         bool
		returnTableName *string
		returnSchema    *string
		volatility      string
	)

	err := q.QueryRow(ctx, query, schemaName, funcName).Scan(
		&argNames,
		&argTypes,
		&numDefaults,
		&returnType,
		&isSetOf,
		&returnTableName,
		&returnSchema,
		&volatility,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query function %s.%s: %w", schemaName, funcName, err)
	}

	arguments := buildFunctionArguments(argNames, argTypes, numDefaults)

	tableSchema := ""
	if returnSchema != nil {
		tableSchema = *returnSchema
	}

	tableName := ""
	if returnTableName != nil {
		tableName = *returnTableName
	}

	retType := introspection.FunctionReturnType{
		Type:        returnType,
		IsSetOf:     isSetOf,
		TableSchema: tableSchema,
		TableName:   tableName,
	}

	var vol introspection.Volatility
	switch volatility {
	case "IMMUTABLE":
		vol = introspection.VolatilityImmutable
	case "STABLE":
		vol = introspection.VolatilityStable
	default:
		vol = introspection.VolatilityVolatile
	}

	return &introspection.Function{
		Arguments:  arguments,
		ReturnType: retType,
		Volatility: vol,
	}, nil
}

// buildFunctionArguments creates FunctionArgument slice from argument names and types.
// PostgreSQL stores the number of arguments with defaults (from the end of the argument list).
func buildFunctionArguments(
	argNames []string,
	argTypes []string,
	numDefaults int,
) []introspection.FunctionArgument {
	if len(argTypes) == 0 {
		return nil
	}

	args := make([]introspection.FunctionArgument, 0, len(argTypes))
	firstDefaultArg := len(argTypes) - numDefaults

	for i, argType := range argTypes {
		var argName string
		if i < len(argNames) {
			argName = argNames[i]
		}

		// Clean up type name (remove any schema prefix if present)
		cleanType := argType
		if idx := strings.LastIndex(argType, "."); idx != -1 {
			cleanType = argType[idx+1:]
		}

		args = append(args, introspection.FunctionArgument{
			Name:       argName,
			Type:       cleanType,
			HasDefault: i >= firstDefaultArg,
		})
	}

	return args
}
