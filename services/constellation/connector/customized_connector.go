package connector

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/nhost/nhost/services/constellation/connector/customization"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/vektah/gqlparser/v2/ast"
)

// customizedConnector decorates a Connector with Hasura-style schema
// customization. It presents the customized schema (GetSchema) and reverses
// the customization on the execution path: incoming operations are rewritten
// to the wrapped connector's native names before Execute, and responses are
// reshaped back into customized form. The wrapped connector is unaware of any
// of this, so the decorator works uniformly for SQL, remote-schema, and
// in-memory connectors.
//
// Customization × cross-connector remote relationships is not yet handled:
// the composer injects relationship fields keyed by native type names (it calls
// GetTypeName, which this decorator delegates to inner unchanged), which this
// decorator's schema renames. No metadata in use combines the two (the
// namespaced remote schema declares no remote relationships), so it is left as
// a follow-up. Unlike field_names -- rejected at construction because it lives
// in the Customization config -- this combination cannot be guarded in
// newCustomizedConnector: remote relationships live in
// metadata.DatabaseMetadata.Tables[].RemoteRelationships /
// RemoteSchemaMetadata.RemoteRelationships, neither of which is passed to the
// constructor, and the *targeted* side (another source pointing at this one) is
// only visible to the composer, which holds the full metadata.Metadata. The
// divergence is pinned by TestCustomizedConnectorRelationshipNamingDivergence so
// any change to the GetTypeName-vs-schema naming contract is caught.
// Subscriptions, which flow through a separate handler rather than Execute, are
// likewise not yet customized.
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

func (c *customizedConnector) Execute(
	ctx context.Context,
	operation *ast.OperationDefinition,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	logger *slog.Logger,
) (map[string]any, error) {
	nativeOp, nativeFragments := c.customizer.ReverseOperation(operation, fragments)

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
	nativeOp, nativeFragments := c.customizer.ReverseOperation(operation, fragments)

	if err := c.inner.ValidateOperation(
		nativeOp, nativeFragments, variables, role, sessionVariables,
	); err != nil {
		err = c.remapQueryValidationArgumentPath(err, operation, fragments)

		return fmt.Errorf("validating customized connector %s: %w", c.name, err)
	}

	return nil
}

func (c *customizedConnector) remapQueryValidationArgumentPath(
	err error,
	operation *ast.OperationDefinition,
	fragments ast.FragmentDefinitionList,
) error {
	var remapper queryValidationArgumentPathRemapper
	if errors.As(err, &remapper) {
		remapper.RemapArgumentPath(func(path string) string {
			return c.customizer.ForwardArgumentPath(path, operation, fragments)
		})
	}

	return err
}

// GetTypeName delegates unchanged. The composer resolves database relationship
// source types through this; remote-schema relationship types come from
// metadata directly. See the customization × relationships note on the type.
func (c *customizedConnector) GetTypeName(identifier string) string {
	return c.inner.GetTypeName(identifier)
}

func (c *customizedConnector) Close() {
	c.inner.Close()
}
