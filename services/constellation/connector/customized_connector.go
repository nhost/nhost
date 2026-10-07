package connector

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/nhost/nhost/services/constellation/connector/customization"
	"github.com/nhost/nhost/services/constellation/connector/groupedaggregate"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/vektah/gqlparser/v2/ast"
)

var (
	errGroupedCollectionUnavailable = errors.New(
		"remote array target cannot execute per-parent modifiers",
	)
	errGroupedAggregateUnavailable = errors.New("grouped aggregate unavailable")
)

// customizedConnector decorates a Connector with Hasura-style schema
// customization. It presents the customized schema (GetSchema) and reverses
// the customization on the execution path: incoming operations are rewritten
// to the wrapped connector's native names before Execute, and responses are
// reshaped back into customized form. The wrapped connector is unaware of any
// of this, so the decorator works uniformly for SQL, remote-schema, and
// in-memory connectors.
//
// Database to_source relationships also work from a root-field namespace
// with a type-name prefix: the composer and planner use published type names,
// while GetTypeName retains native names for target root execution. The
// controller decodes namespaced rows before stitching and phantom cleanup.
// Type-prefixed/suffixed database targets support ordinary joins, per-parent
// collections and grouped aggregates through native table identity; computed
// keys still require role grants and selectable target SQL columns. Unknown
// native types cannot be synthesized by applying a prefix. Other source and
// target combinations are not implied by these verified database shapes.
// Subscriptions flow through a separate customized handler, not Execute.
type customizedConnector struct {
	name       string
	inner      Connector
	customizer *customization.Customizer
	schemas    map[string]*graph.Schema
}

type queryValidationArgumentPathRemapper interface {
	error
	RemapArgumentPath(remap func(argumentPath string) (mappedPath string))
}

// applyCustomization wraps inner in a customizedConnector when cfg is
// non-empty, returning inner unchanged otherwise. It is the single point where
// schema customization is layered onto a connector, keeping the composer,
// planner, and controller oblivious to it.
func applyCustomization( //nolint:ireturn,nolintlint
	name string,
	inner Connector,
	cfg metadata.Customization,
	flavor customization.Flavor,
) (Connector, error) {
	if cfg.IsZero() {
		return inner, nil
	}

	wrapped, err := newCustomizedConnector(name, inner, cfg, flavor)
	if err != nil {
		return nil, fmt.Errorf("customizing connector %s: %w", name, err)
	}

	return wrapped, nil
}

// newCustomizedConnector wraps inner so its schema and operations are
// customized per cfg. It customizes every role schema once at construction
// (Apply clones, so the wrapped connector's schemas are untouched).
//
// Per-type field_names customization is rejected here: Apply renames such
// fields in the forward schema, but the execution path (ReverseOperation /
// ForwardResult) does not reverse them, so the customized schema would
// advertise renamed fields while queries selecting them fail against the
// wrapped connector. Failing at construction turns that silent runtime
// breakage into a clear config-time error until reverse mapping is
// implemented.
func newCustomizedConnector(
	name string,
	inner Connector,
	cfg metadata.Customization,
	flavor customization.Flavor,
) (*customizedConnector, error) {
	if len(cfg.FieldNames) > 0 {
		return nil, fmt.Errorf(
			"%w: customizing connector %s: per-type field_names customization is not supported "+
				"(the schema would advertise renamed fields that execution cannot reverse)",
			ErrUnsupportedCustomization, name,
		)
	}

	customizer := customization.New(cfg, flavor)

	native, err := inner.GetSchema()
	if err != nil {
		return nil, fmt.Errorf("getting schema to customize for %s: %w", name, err)
	}

	schemas := make(map[string]*graph.Schema, len(native))
	for role, schema := range native {
		schemas[role] = customizer.Apply(schema)
	}

	return &customizedConnector{
		name:       name,
		inner:      inner,
		customizer: customizer,
		schemas:    schemas,
	}, nil
}

func (c *customizedConnector) GetSchema() (map[string]*graph.Schema, error) {
	return c.schemas, nil
}

// HasComputedJoinKey forwards reconciled SQL identity through the schema
// decorator. Non-SQL connectors cannot authorize computed LHS joins.
func (c *customizedConnector) HasComputedJoinKey(tableSchema, tableName, key string) bool {
	provider, ok := c.inner.(interface {
		HasComputedJoinKey(tableSchema, tableName, key string) bool
	})
	if !ok {
		return false
	}

	return provider.HasComputedJoinKey(tableSchema, tableName, key)
}

// HasSelectableJoinColumn forwards SQL column identity and role grants through
// source customization. Only the SQL connector can authorize a target column.
func (c *customizedConnector) HasSelectableJoinColumn(identifier, role, name string) bool {
	provider, ok := c.inner.(interface {
		HasSelectableJoinColumn(identifier, role, name string) bool
	})
	if !ok {
		return false
	}

	return provider.HasSelectableJoinColumn(identifier, role, name)
}

// ExecuteGroupedCollection forwards target-side per-parent array windows to a
// capable inner connector. Grouped SQL uses native table identity and nested
// field names rather than a customized root.
func (c *customizedConnector) ExecuteGroupedCollection(
	ctx context.Context,
	req groupedaggregate.Request,
	role string,
	sessionVariables map[string]any,
	logger *slog.Logger,
) (map[string]any, error) {
	provider, ok := c.inner.(interface {
		ExecuteGroupedCollection(
			ctx context.Context, req groupedaggregate.Request, role string,
			sessionVariables map[string]any, logger *slog.Logger,
		) (map[string]any, error)
	})
	if !ok {
		return nil, errGroupedCollectionUnavailable
	}

	results, err := provider.ExecuteGroupedCollection(ctx, req, role, sessionVariables, logger)
	if err != nil {
		return nil, fmt.Errorf(
			"executing grouped collection on customized connector %s: %w",
			c.name,
			err,
		)
	}

	return forwardGroupedTypeNames(results, req, c.customizer, true), nil
}

// ExecuteGroupedAggregate forwards grouped SQL using native table identity.
// Unlike a root GraphQL operation, the request has no customized root to undo.
func (c *customizedConnector) ExecuteGroupedAggregate(
	ctx context.Context,
	req groupedaggregate.Request,
	role string,
	sessionVariables map[string]any,
	logger *slog.Logger,
) (map[string]any, error) {
	provider, ok := c.inner.(groupedaggregate.Executor)
	if !ok {
		return nil, fmt.Errorf(
			"%w on customized connector %s",
			errGroupedAggregateUnavailable,
			c.name,
		)
	}

	results, err := provider.ExecuteGroupedAggregate(ctx, req, role, sessionVariables, logger)
	if err != nil {
		return nil, fmt.Errorf(
			"executing grouped aggregate on customized connector %s: %w",
			c.name,
			err,
		)
	}

	// Grouped SQL bypasses ForwardResult. Remap selected __typename values in
	// aggregate nodes without touching the inner connector's result maps.
	return forwardGroupedTypeNames(results, req, c.customizer, false), nil
}

func forwardGroupedTypeNames(
	results map[string]any, req groupedaggregate.Request,
	customizer *customization.Customizer, collection bool,
) map[string]any {
	out := make(map[string]any, len(results))
	for key, value := range results {
		if req.Field == nil {
			out[key] = forwardGroupedValue(value, customizer)

			continue
		}

		selections := req.Field.SelectionSet
		if collection {
			// Collection groups wrap each requested row inside nodes; aggregate
			// groups already have the aggregate field's own selection shape.
			selections = ast.SelectionSet{&ast.Field{ //nolint:exhaustruct
				Name: "nodes", SelectionSet: selections,
			}}
		}

		out[key] = customizer.ForwardSelectionValue(value, selections, req.Fragments)
	}

	return out
}

func forwardGroupedValue(value any, customizer *customization.Customizer) any {
	switch typed := value.(type) {
	case map[string]any:
		out := make(map[string]any, len(typed))
		for key, entry := range typed {
			if key == "__typename" {
				if native, ok := entry.(string); ok {
					if customized := customizer.TypeName(native); customized != "" {
						out[key] = customized

						continue
					}
				}
			}

			out[key] = forwardGroupedValue(entry, customizer)
		}

		return out
	case []any:
		out := make([]any, len(typed))
		for i, entry := range typed {
			out[i] = forwardGroupedValue(entry, customizer)
		}

		return out
	default:
		return value
	}
}

func (c *customizedConnector) Execute(
	ctx context.Context,
	operation *ast.OperationDefinition,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	logger *slog.Logger,
) (map[string]any, error) {
	nativeOp, nativeFragments := c.customizer.ReverseOperation(operation, fragments, variables)

	result, err := c.inner.Execute(
		ctx, nativeOp, nativeFragments, variables, role, sessionVariables, logger,
	)

	// Reshape any data the connector returned, including the partial data that
	// accompanies a GraphQL error, then preserve the error chain so the
	// controller can still extract structured remote errors from it.
	reshaped := c.customizer.ForwardResult(result, operation, fragments)
	if err != nil {
		err = c.remapQueryValidationArgumentPath(err, operation, fragments)

		return reshaped, fmt.Errorf("executing customized connector %s: %w", c.name, err)
	}

	return reshaped, nil
}

// ValidateOperation reverses the customization on the operation before
// delegating to the wrapped connector, mirroring Execute so validation runs
// against the native field/argument names the inner connector understands. The
// wrapped connector sees the same operation it would during Execute, so a
// customized SQL source still rejects an invalid argument before the controller
// executes any sibling connector.
func (c *customizedConnector) ValidateOperation(
	operation *ast.OperationDefinition,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
) error {
	nativeOp, nativeFragments := c.customizer.ReverseOperation(operation, fragments, variables)

	if err := c.inner.ValidateOperation(
		nativeOp, nativeFragments, variables, role, sessionVariables,
	); err != nil {
		err = c.remapQueryValidationArgumentPath(err, operation, fragments)

		return fmt.Errorf("validating customized connector %s: %w", c.name, err)
	}

	return nil
}

func (c *customizedConnector) remapQueryValidationArgumentPath(
	err error, operation *ast.OperationDefinition, fragments ast.FragmentDefinitionList,
) error {
	remapper, ok := errors.AsType[queryValidationArgumentPathRemapper](err)
	if !ok {
		return err
	}

	// SQL stamps native field names, not response aliases. Preserve Hasura's
	// field-name path even if several lifted namespace aliases are ambiguous.
	remapper.RemapArgumentPath(func(path string) string {
		return c.customizer.ForwardArgumentPath(path, operation, fragments)
	})

	return err
}

// GetTypeName retains the native table name for internal root-query execution.
// Composed relationship fields use GetCustomizedTypeName for the exposed SDL.
func (c *customizedConnector) GetTypeName(identifier string) string {
	return c.inner.GetTypeName(identifier)
}

// GetCustomizedTypeName maps a real native type into this connector's role SDL.
// An unknown native name returns empty instead of fabricating a type.
func (c *customizedConnector) GetCustomizedTypeName(native string) string {
	return c.customizer.TypeName(native)
}

func (c *customizedConnector) Close() {
	c.inner.Close()
}
