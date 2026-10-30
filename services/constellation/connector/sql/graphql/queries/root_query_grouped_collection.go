package queries

import (
	"fmt"
	"strings"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	groupedaggdispatch "github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/groupedaggregate"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
)

// collectionKeyCondition constrains the ordinary collection's CTE before its
// distinct/order/window modifiers. It adds no projected column, even when the
// target table itself has a column named like an internal matcher.
type collectionKeyCondition struct {
	columns []string
	keys    []string
}

func (c collectionKeyCondition) WriteCondition(
	b *strings.Builder, source string, params []any, paramIndex int,
) ([]any, int, error) {
	for i, col := range c.columns {
		if i > 0 {
			b.WriteString(" AND ")
		}

		core.WriteQualifiedColumn(b, source, col)
		b.WriteString(" = ")
		core.WriteQualifiedColumn(b, `"__cs_array_keys"`, c.keys[i])
	}

	return params, paramIndex, nil
}

// BuildGroupedCollectionSQL executes one parameterized statement for a batch
// of distinct parent tuples. PostgreSQL correlates a LATERAL collection to a
// typed unnest; SQLite correlates a scalar collection subquery to a bound
// derived key table. Both reuse the ordinary role-filtered collection builder
// and apply distinctness and pagination *inside* each key's target CTE.
//
//nolint:funlen // Name resolution is part of the shared PostgreSQL/SQLite correlation contract.
func (t *table) BuildGroupedCollectionSQL(
	in groupedaggdispatch.BuildInput, roots map[string]core.Operation,
) (core.SQLOperation, error) {
	columns := append([]string(nil), in.JoinColumns...)

	tuples := in.JoinTuples
	if len(columns) == 0 {
		columns = []string{in.JoinColumnSQLName}

		tuples = make([][]any, len(in.JoinValues))
		for i, v := range in.JoinValues {
			tuples[i] = []any{v}
		}
	}

	sqlTypes := make([]string, len(columns))

	keyNames := make([]string, len(columns))
	for i, name := range columns {
		col := t.columnFromGraphqlName(name)
		if col == nil {
			col = t.columnFromSQLName(name)
		}

		if col == nil {
			return core.SQLOperation{}, fmt.Errorf("%w: %q", errUnknownJoinColumn, name)
		}

		columns[i] = col.SQLName
		sqlTypes[i] = col.SQLType
		keyNames[i] = dialect.CollectionKeyName(i)
	}

	const keysAlias = "__cs_array_keys"

	if !t.dialect.SupportsLateral() {
		return t.buildSQLiteGroupedCollection(in, roots, columns, keyNames, sqlTypes, tuples)
	}

	b := getBuilder()
	defer putBuilder(b)

	b.WriteString(`SELECT coalesce(json_agg(json_build_object('_join_key', `)

	if len(columns) == 1 {
		core.WriteQualifiedColumn(b, `"__cs_array_keys"`, keyNames[0])
	} else {
		b.WriteString(dialect.CollectionKeyJSON(t.dialect, keysAlias, keyNames))
	}

	b.WriteString(`, 'nodes', "__cs_array_nodes"."nodes")), '[]'::json) AS `)
	core.WriteQuotedIdentifier(b, in.Field.Name)
	b.WriteString(" FROM ")
	params, paramIndex := dialect.WriteCollectionKeysFrom(
		t.dialect, b, keysAlias, keyNames, sqlTypes, tuples, []any{}, 1,
	)
	b.WriteString(" LEFT JOIN LATERAL (")

	params, _, err := t.writeCollectionForKey(b, in, roots, params, paramIndex, columns, keyNames)
	if err != nil {
		return core.SQLOperation{}, fmt.Errorf("building grouped collection: %w", err)
	}

	b.WriteString(`) AS "__cs_array_nodes" ON true`)

	return core.SQLOperation{
		Name: in.Field.Name, SQL: b.String(), Parameters: params,
		StreamCursors: nil, Sequential: nil, Insert: nil,
	}, nil
}

func (t *table) buildSQLiteGroupedCollection(
	in groupedaggdispatch.BuildInput, roots map[string]core.Operation,
	columns, keyNames, sqlTypes []string, tuples [][]any,
) (core.SQLOperation, error) {
	b := getBuilder()
	defer putBuilder(b)

	b.WriteString(`SELECT coalesce(json_group_array(json_object('_join_key', `)

	// JSON join parameters are bound as serialized text. Mark JSON-typed
	// components as JSON values before embedding them in the result key;
	// otherwise SQLite quotes numbers, strings and objects a second time.
	writeKey := func(i int) {
		jsonType := strings.EqualFold(sqlTypes[i], "json") ||
			strings.EqualFold(sqlTypes[i], "jsonb")
		if jsonType {
			b.WriteString("json(")
		}

		core.WriteQualifiedColumn(b, `"__cs_array_keys"`, keyNames[i])

		if jsonType {
			b.WriteByte(')')
		}
	}

	if len(columns) == 1 {
		writeKey(0)
	} else {
		b.WriteString("json_array(")

		for i := range columns {
			if i > 0 {
				b.WriteString(", ")
			}

			writeKey(i)
		}

		b.WriteByte(')')
	}

	b.WriteString(`, 'nodes', json((`)

	// SQLite placeholders are positional in SQL text: the correlated scalar
	// collection appears before the key table, so collection params come first.
	collection := getBuilder()
	defer putBuilder(collection)

	params, next, err := t.writeCollectionForKey(
		collection, in, roots, []any{}, 1, columns, keyNames,
	)
	if err != nil {
		return core.SQLOperation{}, fmt.Errorf("building grouped collection: %w", err)
	}

	b.WriteString(collection.String())
	b.WriteString(`)))), '[]') AS `)
	core.WriteQuotedIdentifier(b, in.Field.Name)
	b.WriteString(" FROM ")
	params, _ = dialect.WriteCollectionKeysFrom(
		t.dialect, b, "__cs_array_keys", keyNames, sqlTypes, tuples, params, next,
	)

	return core.SQLOperation{
		Name: in.Field.Name, SQL: b.String(), Parameters: params,
		StreamCursors: nil, Sequential: nil, Insert: nil,
	}, nil
}

func (t *table) writeCollectionForKey(
	b *strings.Builder, in groupedaggdispatch.BuildInput, roots map[string]core.Operation,
	params []any, paramIndex int, columns, keyNames []string,
) ([]any, int, error) {
	condition := collectionKeyCondition{columns: columns, keys: keyNames}

	return t.writeQueryCollectionSQLFromSource(
		b,
		in.Field,
		in.Fragments,
		in.Variables,
		in.Role,
		in.SessionVariables,
		roots,
		params,
		paramIndex,
		"_root",
		"nodes",
		t.tableFromClause(),
		t.tableSourceRef(),
		in.ArgumentPath,
		func(clause where.Clause, modifiers []arguments.QueryModifier) (where.Clause, []arguments.QueryModifier) {
			return append(clause, condition), modifiers
		},
	)
}
