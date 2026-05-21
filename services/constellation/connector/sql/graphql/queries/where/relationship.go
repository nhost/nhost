package where

import (
	"errors"
	"fmt"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"
)

type relationshipFilter struct {
	relationship     Relationship
	conditions       Statement
	role             string
	sessionVariables map[string]any
	nestingLevel     int
	aliasPrefix      string
}

func (r *relationshipFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	targetAlias := fmt.Sprintf("\"%s%d\"", r.aliasPrefix, r.nestingLevel)
	if r.nestingLevel == 0 {
		targetAlias = r.aliasPrefix
	}

	target := r.relationship.Target()

	b.WriteString("EXISTS (SELECT 1 FROM ")
	b.WriteString(target.TableFromClause())
	b.WriteString(" ")
	b.WriteString(targetAlias)
	b.WriteString(" WHERE ")

	r.relationship.WriteJoinConditionAliased(b, source, targetAlias)

	var err error

	if r.conditions != nil {
		b.WriteString(" AND ")

		params, paramIndex, err = r.conditions.WriteCondition(b, targetAlias, params, paramIndex)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to write relationship conditions: %w", err)
		}
	}

	if r.role != "" && target.HasRowLevelPermissions(r.role) {
		b.WriteString(" AND ")

		params, paramIndex, err = target.WriteRowLevelPermissions(
			b, params, paramIndex, r.role, r.sessionVariables, targetAlias,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to apply row-level permissions: %w", err)
		}
	}

	b.WriteByte(')')

	return params, paramIndex, nil
}

// parseExists parses an _exists operator value into an existsFilter.
// _exists targets a sibling table by (schema, name) and applies a where clause
// against it. When _table.schema is omitted, t's schema is used.
//
//nolint:funlen,ireturn // ireturn: returns Statement to keep existsFilter unexported.
func parseExists(
	t Table,
	value *ast.Value,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	nestingLevel int,
	aliases Aliases,
) (Statement, error) {
	if value.Kind != ast.ObjectValue {
		return nil, errors.New("_exists must be an object")
	}

	var (
		tableSchema string
		tableName   string
		whereValue  *ast.Value
	)

	for _, child := range value.Children {
		switch child.Name {
		case "_table":
			if child.Value.Kind != ast.ObjectValue {
				return nil, errors.New("_exists._table must be an object")
			}

			for _, tableChild := range child.Value.Children {
				switch tableChild.Name {
				case "schema":
					tableSchema = tableChild.Value.Raw
				case "name":
					tableName = tableChild.Value.Raw
				}
			}
		case "_where":
			whereValue = child.Value
		}
	}

	if tableName == "" {
		return nil, errors.New("_exists._table.name is required")
	}

	// When _table.schema is omitted, default to the current table's schema.
	// This stays compatible with Postgres metadata (public tables get "public")
	// and works for SQLite, whose introspector returns every table under "".
	if tableSchema == "" {
		tableSchema = t.SchemaName()
	}

	targetTable := t.TableBySchemaName(tableSchema, tableName)
	if targetTable == nil {
		return nil, fmt.Errorf("table %s.%s not found for _exists operator", tableSchema, tableName)
	}

	conditions, err := Parse(
		targetTable, whereValue, variables, role, sessionVariables, nestingLevel+1, aliases,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to parse _exists _where: %w", err)
	}

	var conds Statement
	if conditions != nil {
		conds = conditions
	}

	return &existsFilter{
		targetTable:  targetTable,
		conditions:   conds,
		nestingLevel: nestingLevel,
		aliasPrefix:  aliases.Exists,
	}, nil
}

// existsFilter generates an EXISTS subquery for the _exists permission operator.
// Unlike relationshipFilter, it has no join condition — the user provides
// the full WHERE clause in the _exists._where field.
type existsFilter struct {
	targetTable  Table
	conditions   Statement
	nestingLevel int
	aliasPrefix  string
}

func (f *existsFilter) WriteCondition(
	b *strings.Builder,
	_ string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	targetAlias := fmt.Sprintf("\"%s%d\"", f.aliasPrefix, f.nestingLevel)
	if f.nestingLevel == 0 {
		targetAlias = f.aliasPrefix
	}

	b.WriteString("EXISTS (SELECT 1 FROM ")
	b.WriteString(f.targetTable.TableFromClause())
	b.WriteString(" ")
	b.WriteString(targetAlias)

	if f.conditions != nil {
		b.WriteString(" WHERE ")

		var err error

		params, paramIndex, err = f.conditions.WriteCondition(b, targetAlias, params, paramIndex)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to write _exists conditions: %w", err)
		}
	}

	b.WriteByte(')')

	return params, paramIndex, nil
}
