package arguments

import (
	"errors"
	"fmt"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/values"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
)

// StreamCursor is a single column cursor with an ordering, parsed from a
// _stream subscription's cursor input. Only core.OrderAsc and core.OrderDesc
// are emitted by the parser; downstream renderers go through
// Ordering.SQL() / Ordering.IsDescending() rather than reading the raw value.
type StreamCursor struct {
	Column   *core.Column
	Value    any
	Ordering core.OrderDirection
}

// Stream is the parsed argument set for a _stream subscription.
// Invariant: BatchSize > 0. The only public producer (ParseStream) enforces
// this; callers that construct Stream by struct literal must uphold it.
type Stream struct {
	BatchSize int
	Cursors   []StreamCursor
	Where     where.Clause
}

// ParseStream parses the arguments for a _stream subscription.
// Arguments:
//   - batch_size: Int! - maximum number of rows to return
//   - cursor: [{table}_stream_cursor_input]! - array of cursor inputs
//   - where: {table}_bool_exp - optional filter
func ParseStream(
	t Table,
	arguments ast.ArgumentList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
) (Stream, error) {
	var result Stream

	batchSizeArg := arguments.ForName("batch_size")
	if batchSizeArg == nil {
		return result, errors.New("batch_size is required for stream subscriptions")
	}

	batchSize, err := ParseLimitOffset(batchSizeArg.Value, variables)
	if err != nil {
		return result, fmt.Errorf("failed to parse batch_size: %w", err)
	}

	if batchSize == nil || *batchSize <= 0 {
		return result, errors.New("batch_size must be a positive integer")
	}

	result.BatchSize = *batchSize

	cursorArg := arguments.ForName("cursor")
	if cursorArg == nil {
		return result, errors.New("cursor is required for stream subscriptions")
	}

	cursors, err := parseStreamCursors(t, cursorArg.Value, variables)
	if err != nil {
		return result, fmt.Errorf("failed to parse cursor: %w", err)
	}

	if len(cursors) == 0 {
		return result, errors.New("at least one cursor is required for stream subscriptions")
	}

	result.Cursors = cursors

	if whereArg := arguments.ForName("where"); whereArg != nil {
		clause, err := t.ParseWhere(
			whereArg.Value, variables, role, sessionVariables, 0, where.QueryAliases,
		)
		if err != nil {
			return result, fmt.Errorf("failed to parse where clause: %w", err)
		}

		result.Where = clause
	}

	return result, nil
}

// parseStreamCursors parses the cursor array for stream subscriptions.
// Each cursor input has the structure:
//
//	{
//	  initial_value: {column1: value1, column2: value2, ...}
//	  ordering: cursor_ordering (optional, defaults to ASC)
//	}
//
// GraphQL allows passing a single object instead of an array, which is
// automatically coerced to an array containing that single object.
//
// The function is linear: coerce list, then for each cursor: validate, resolve
// initial_value, resolve optional ordering, emit one StreamCursor per inner
// column. Each step needs access to the caller's variables/err state, so
// splitting into helpers would either thread the same five arguments through
// three sub-functions or share state via a struct — both heavier than the
// current sequence. Revisit if a sixth independent step is added.
//
//nolint:gocognit,cyclop,funlen // see godoc above for rationale
func parseStreamCursors(
	t Table,
	value *ast.Value,
	variables map[string]any,
) ([]StreamCursor, error) {
	value, err := values.ResolveVariable(value, variables)
	if err != nil {
		return nil, fmt.Errorf("resolving cursor argument: %w", err)
	}

	var cursorValues []*ast.Value
	switch value.Kind { //nolint:exhaustive
	case ast.ListValue:
		for _, child := range value.Children {
			cursorValues = append(cursorValues, child.Value)
		}
	case ast.ObjectValue:
		// GraphQL allows passing a single object in place of [object]; coerce to
		// a single-element list so the downstream loop is uniform.
		cursorValues = []*ast.Value{value}
	default:
		return nil, errors.New("cursor must be an array or object")
	}

	var cursors []StreamCursor

	for _, childValue := range cursorValues {
		childValue, err = values.ResolveVariable(childValue, variables)
		if err != nil {
			return nil, fmt.Errorf("resolving cursor child: %w", err)
		}

		if childValue.Kind != ast.ObjectValue {
			return nil, errors.New("each cursor must be an object")
		}

		initialValueField := findChildField(childValue, "initial_value")
		if initialValueField == nil {
			return nil, errors.New("initial_value is required in cursor")
		}

		initialValue, err := values.ResolveVariable(initialValueField, variables)
		if err != nil {
			return nil, fmt.Errorf("failed to resolve initial_value: %w", err)
		}

		if initialValue.Kind != ast.ObjectValue {
			return nil, errors.New("initial_value must be an object")
		}

		ordering := core.OrderAsc
		if orderingField := findChildField(childValue, "ordering"); orderingField != nil {
			orderingValue, err := values.ResolveVariable(orderingField, variables)
			if err != nil {
				return nil, fmt.Errorf("failed to resolve ordering: %w", err)
			}

			if orderingValue.Kind != ast.EnumValue && orderingValue.Kind != ast.StringValue {
				return nil, fmt.Errorf(
					"ordering must be an enum or string, got %v", orderingValue.Kind,
				)
			}

			switch orderingValue.Raw {
			case "ASC", "asc":
				ordering = core.OrderAsc
			case "DESC", "desc":
				ordering = core.OrderDesc
			default:
				return nil, fmt.Errorf("invalid ordering value: %s", orderingValue.Raw)
			}
		}

		for _, field := range initialValue.Children {
			column := t.ColumnFromGraphqlName(field.Name)
			if column == nil {
				return nil, fmt.Errorf("unknown column in cursor: %s", field.Name)
			}

			fieldValue, err := values.ResolveASTValue(field.Value, variables)
			if err != nil {
				return nil, fmt.Errorf("failed to resolve cursor value for %s: %w", field.Name, err)
			}

			cursors = append(cursors, StreamCursor{
				Column:   column,
				Value:    fieldValue,
				Ordering: ordering,
			})
		}
	}

	return cursors, nil
}

// findChildField finds a child field by name in an object value.
func findChildField(value *ast.Value, name string) *ast.Value {
	for _, child := range value.Children {
		if child.Name == name {
			return child.Value
		}
	}

	return nil
}
