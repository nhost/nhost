package where

import (
	"strings"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
)

// jsonbContainsFilter implements the _contains operator for JSONB columns.
// Dispatched from containmentParser when column.IsArray is false; the array
// branch produces arrayContainsFilter instead.
type jsonbContainsFilter struct {
	column  string
	value   any
	dialect dialect.Dialect
}

func (f *jsonbContainsFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	core.WriteQualifiedColumn(b, source, f.column)
	b.WriteString(" @> ")
	b.WriteString(f.dialect.TypeCast(f.dialect.Placeholder(paramIndex), "jsonb"))

	params = append(params, f.value)

	return params, paramIndex + 1, nil
}

// jsonbContainedInFilter implements the _contained_in operator for JSONB columns.
// Dispatched from containmentParser when column.IsArray is false; the array
// branch produces arrayContainedInFilter instead.
type jsonbContainedInFilter struct {
	column  string
	value   any
	dialect dialect.Dialect
}

func (f *jsonbContainedInFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	core.WriteQualifiedColumn(b, source, f.column)
	b.WriteString(" <@ ")
	b.WriteString(f.dialect.TypeCast(f.dialect.Placeholder(paramIndex), "jsonb"))

	params = append(params, f.value)

	return params, paramIndex + 1, nil
}

// jsonbHasKeyFilter implements the _has_key operator for JSONB columns.
type jsonbHasKeyFilter struct {
	column  string
	key     string
	dialect dialect.Dialect
}

func (f *jsonbHasKeyFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	core.WriteQualifiedColumn(b, source, f.column)
	b.WriteString(" ? ")
	b.WriteString(f.dialect.Placeholder(paramIndex))

	params = append(params, f.key)

	return params, paramIndex + 1, nil
}

// jsonbHasKeysAllFilter implements the _has_keys_all operator for JSONB columns.
type jsonbHasKeysAllFilter struct {
	column  string
	keys    []string
	dialect dialect.Dialect
}

func (f *jsonbHasKeysAllFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	core.WriteQualifiedColumn(b, source, f.column)
	b.WriteString(" ?& ")
	b.WriteString(f.dialect.TypeCast(f.dialect.Placeholder(paramIndex), "text[]"))

	params = append(params, f.keys)

	return params, paramIndex + 1, nil
}

// jsonbHasKeysAnyFilter implements the _has_keys_any operator for JSONB columns.
type jsonbHasKeysAnyFilter struct {
	column  string
	keys    []string
	dialect dialect.Dialect
}

func (f *jsonbHasKeysAnyFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	core.WriteQualifiedColumn(b, source, f.column)
	b.WriteString(" ?| ")
	b.WriteString(f.dialect.TypeCast(f.dialect.Placeholder(paramIndex), "text[]"))

	params = append(params, f.keys)

	return params, paramIndex + 1, nil
}
