package postgres

import (
	"context"
	"fmt"

	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// computedFunctionCatalog returns every overload, rather than picking an
// arbitrary pg_proc row. PostgreSQL's type OIDs are used to match the row
// argument even when the connection search_path hides or shadows its schema.
const computedFunctionCatalog = `
SELECT p.oid, fnns.nspname, p.proname,
       COALESCE(p.proargnames, '{}'::text[]),
       ARRAY(SELECT ty.oid FROM unnest(COALESCE(p.proallargtypes, p.proargtypes::oid[]))
             WITH ORDINALITY AS a(oid, ord) JOIN pg_type ty ON ty.oid = a.oid ORDER BY a.ord),
       ARRAY(SELECT ns.nspname FROM unnest(COALESCE(p.proallargtypes, p.proargtypes::oid[]))
             WITH ORDINALITY AS a(oid, ord) JOIN pg_type ty ON ty.oid = a.oid
             JOIN pg_namespace ns ON ns.oid = ty.typnamespace ORDER BY a.ord),
       ARRAY(SELECT ty.typname FROM unnest(COALESCE(p.proallargtypes, p.proargtypes::oid[]))
             WITH ORDINALITY AS a(oid, ord) JOIN pg_type ty ON ty.oid = a.oid ORDER BY a.ord),
       CASE WHEN p.proargmodes IS NULL THEN array_fill('i'::text, ARRAY[p.pronargs])
            ELSE ARRAY(SELECT mode::text FROM unnest(p.proargmodes) AS mode) END,
       p.pronargdefaults, ret.oid, retns.nspname, ret.typname,
       COALESCE(ret.typrelid, 0), p.proretset, p.provolatile::text,
       COALESCE(tbl.reltype, 0)
FROM pg_proc p
JOIN pg_namespace fnns ON fnns.oid = p.pronamespace
JOIN pg_type ret ON ret.oid = p.prorettype
JOIN pg_namespace retns ON retns.oid = ret.typnamespace
LEFT JOIN pg_class tbl ON tbl.oid = to_regclass(format('%I.%I', $3::text, $4::text))
WHERE fnns.nspname = $1 AND p.proname = $2 AND p.prokind = 'f'
ORDER BY p.oid`

type computedCatalogRow struct {
	oid          uint32
	schema       string
	name         string
	names        []string
	typeOIDs     []uint32
	typeSchemas  []string
	typeNames    []string
	modes        []string
	defaults     int
	returnOID    uint32
	returnSchema string
	returnName   string
	returnRelOID uint32
	returnSet    bool
	volatility   string
	rowTypeOID   uint32
}

func lookupComputedFunction(
	ctx context.Context, q Querier, table metadata.TableSource, field metadata.ComputedField,
) (introspection.ComputedFunctionLookup, error) {
	if field.DecodeError != "" {
		return invalidComputedFunction(field.DecodeError), nil
	}

	fn := field.Definition.Function

	schema := fn.Schema
	if schema == "" {
		// Hasura resolves bare function references in public, not search_path.
		schema = "public"
	}

	rows, err := q.Query(ctx, computedFunctionCatalog, schema, fn.Name, table.Schema, table.Name)
	if err != nil {
		return introspection.ComputedFunctionLookup{}, fmt.Errorf(
			"querying computed function %s.%s: %w",
			schema,
			fn.Name,
			err,
		)
	}
	defer rows.Close()

	var candidates []computedCatalogRow
	for rows.Next() {
		var candidate computedCatalogRow
		if err := rows.Scan(
			&candidate.oid, &candidate.schema, &candidate.name,
			&candidate.names, &candidate.typeOIDs,
			&candidate.typeSchemas, &candidate.typeNames, &candidate.modes,
			&candidate.defaults, &candidate.returnOID, &candidate.returnSchema,
			&candidate.returnName, &candidate.returnRelOID, &candidate.returnSet,
			&candidate.volatility, &candidate.rowTypeOID,
		); err != nil {
			return introspection.ComputedFunctionLookup{}, fmt.Errorf(
				"scanning computed function %s.%s: %w",
				schema,
				fn.Name,
				err,
			)
		}

		candidates = append(candidates, candidate)
	}

	if err := rows.Err(); err != nil {
		return introspection.ComputedFunctionLookup{}, fmt.Errorf(
			"reading computed function %s.%s: %w",
			schema,
			fn.Name,
			err,
		)
	}

	switch len(candidates) {
	case 0:
		return invalidComputedFunction("function not found"), nil
	case 1:
		return resolveComputedSignature(candidates[0], field.Definition.TableArgument), nil
	default:
		return invalidComputedFunction("overloaded functions are not supported"), nil
	}
}

func invalidComputedFunction(reason string) introspection.ComputedFunctionLookup {
	return introspection.ComputedFunctionLookup{Function: nil, Reason: reason}
}

func resolveComputedSignature(
	row computedCatalogRow, tableArgument string,
) introspection.ComputedFunctionLookup {
	if row.rowTypeOID == 0 {
		return invalidComputedFunction("owning table not found")
	}

	arguments, rowIndex, reason := computedArguments(row, tableArgument)
	if reason != "" {
		return invalidComputedFunction(reason)
	}

	if rowIndex == -1 {
		return invalidComputedFunction("row argument not found")
	}

	if arguments[rowIndex].Type.OID != row.rowTypeOID {
		return invalidComputedFunction("row argument has wrong table type")
	}

	if arguments[rowIndex].Mode != "i" {
		return invalidComputedFunction("row argument must be IN")
	}

	var volatility introspection.Volatility
	switch row.volatility {
	case "i":
		volatility = introspection.VolatilityImmutable
	case "s":
		volatility = introspection.VolatilityStable
	case "v":
		volatility = introspection.VolatilityVolatile
	default:
		return invalidComputedFunction("unknown function volatility")
	}

	return introspection.ComputedFunctionLookup{Function: &introspection.ComputedFunction{
		OID: row.oid, Schema: row.schema, Name: row.name,
		Arguments: arguments, RowArgument: rowIndex,
		ReturnType: introspection.PostgreSQLType{
			OID: row.returnOID, Schema: row.returnSchema, Name: row.returnName,
		},
		ReturnRelOID: row.returnRelOID, ReturnSet: row.returnSet, Volatility: volatility,
	}, Reason: ""}
}

func computedArguments(
	row computedCatalogRow, tableArgument string,
) ([]introspection.ComputedFunctionArgument, int, string) {
	if len(row.typeOIDs) != len(row.typeSchemas) || len(row.typeOIDs) != len(row.typeNames) ||
		len(row.typeOIDs) != len(row.modes) {
		return nil, -1, "incomplete function argument catalog"
	}

	arguments := make([]introspection.ComputedFunctionArgument, 0, len(row.typeOIDs))
	rowIndex := -1

	var inputIndices []int
	for i, oid := range row.typeOIDs {
		name := ""
		if i < len(row.names) {
			name = row.names[i]
		}

		mode := row.modes[i]
		if mode == "i" || mode == "b" || mode == "v" {
			inputIndices = append(inputIndices, i)
			if (tableArgument == "" && len(inputIndices) == 1) ||
				(tableArgument != "" && name == tableArgument) {
				rowIndex = i
			}
		}

		arguments = append(arguments, introspection.ComputedFunctionArgument{
			Type: introspection.PostgreSQLType{
				OID: oid, Schema: row.typeSchemas[i], Name: row.typeNames[i],
			},
			Name: name, Mode: mode, Position: i, HasDefault: false,
		})
	}

	if row.defaults > len(inputIndices) {
		return nil, -1, "invalid function defaults in catalog"
	}

	for _, idx := range inputIndices[len(inputIndices)-row.defaults:] {
		arguments[idx].HasDefault = true
	}

	return arguments, rowIndex, ""
}

func (c *Client) introspectComputedFunctions(
	ctx context.Context, dbMeta *metadata.DatabaseMetadata,
) (map[introspection.ComputedTable]map[string]introspection.ComputedFunctionLookup, error) {
	var result map[introspection.ComputedTable]map[string]introspection.ComputedFunctionLookup
	for i := range dbMeta.Tables {
		table := &dbMeta.Tables[i]
		if len(table.ComputedFields) == 0 {
			continue
		}

		if result == nil {
			result = make(
				map[introspection.ComputedTable]map[string]introspection.ComputedFunctionLookup,
			)
		}

		key := introspection.ComputedTable{Schema: table.Table.Schema, Name: table.Table.Name}

		fields := make(map[string]introspection.ComputedFunctionLookup, len(table.ComputedFields))
		for _, field := range table.ComputedFields {
			lookup, err := lookupComputedFunction(ctx, c.pool, table.Table, field)
			if err != nil {
				return nil, fmt.Errorf(
					"introspecting computed field %s.%s.%s: %w",
					table.Table.Schema,
					table.Table.Name,
					field.Name,
					err,
				)
			}

			fields[field.Name] = lookup
		}

		result[key] = fields
	}

	return result, nil
}
