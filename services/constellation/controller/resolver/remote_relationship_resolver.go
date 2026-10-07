// Package resolver executes cross-connector remote-relationship queries
// after the primary connector pass has returned its results, and stitches
// the remote rows back into the parent payload.
//
// It is the run-time counterpart to [controller/planner]: where the planner
// statically analyses an operation and emits a [QueryPlan] describing the
// remote relationships it found, this package consumes that plan during
// request execution. The single integration point is
// [RemoteRelationshipResolver.ResolvePlanned], invoked by controller.Resolve once
// the primary connector has produced the parent rows.
//
// # Resolution strategies
//
// Each [remoteQuery] in the plan carries a small strategy object describing
// how to fan out and gather the remote data. Two such strategies live in
// this package:
//
//   - databaseResolver — used when both sides are SQL connectors.
//     It collects the unique parent join-key values and issues a single
//     batched query against the target connector with a WHERE col IN (...)
//     filter, then builds a per-key result lookup keyed on the remote join
//     columns. This is the cheaper of the two paths because it sends one
//     request per remote relationship regardless of the number of parent
//     rows.
//
//   - schemaResolver — used when the target is a remote GraphQL schema (or
//     any connector that does not accept an _in filter on the join column).
//     Because remote schemas have no notion of bulk fetching by a list of
//     keys, the resolver emits an aliased field per parent row in a single
//     remote operation (_0: field(arg: val1) { ... }, _1: field(arg: val2)
//     { ... }, ...). The remote connector returns one result per alias and
//     the resolver pairs each alias back to its originating parent.
//
// A third path — cross-database grouped aggregates — bypasses the strategy
// interface entirely. When a remoteQuery carries an aggregateInfo,
// executeAndStitch dispatches to executeAndStitchAggregate, which fetches
// the target connector's [groupedaggregate.Executor] from the configuration-
// time aggregateExecutors map and invokes it directly. This skips the
// GraphQL operation pipeline (no AST is built, no Execute call is made
// through the connector.Connector interface) because grouped aggregates
// require a SQL GROUP BY that cannot be expressed in GraphQL. The
// aggregate path produces one numeric result per parent row.
//
// # Pipeline
//
// For every remoteQuery in the plan, ResolvePlanned walks the same five-stage
// pipeline:
//
//  1. Build — the strategy turns the parent join keys and the user's
//     selection set into a remote operation (or, for aggregates, a
//     groupedaggregate.Request).
//  2. Execute — the remote operation is dispatched to the target
//     connector.Connector (or to the aggregate executor on the bypass
//     path).
//  3. Extract — the strategy walks the remote payload and produces a flat
//     slice of result rows.
//  4. Stitch — the strategy builds a lookup keyed by join column and
//     copies the matching remote rows into each parent row under the
//     relationship field name.
//  5. Strip — target join-column phantoms are removed from this query's own
//     result maps after stitching. Source and child-key phantoms are removed
//     only after all descendants have read them.
//
// # Position in the controller pipeline
//
// controller.Resolve calls [RemoteRelationshipResolver.ResolvePlanned] after
// the primary connector pass, building each query from its stitched parent.
// [BuildRemoteQueriesFromPlan] and [RemoteRelationshipResolver.Resolve] retain
// the earlier eager-build path for compatibility and isolated strategy tests. The package
// owns no mutable state of its own — RemoteRelationshipResolver is built
// once per controllerState reload and reused for every request that sees
// that snapshot.
package resolver

import (
	"context"
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"github.com/nhost/nhost/services/constellation/connector"
	"github.com/nhost/nhost/services/constellation/connector/groupedaggregate"
	connectorrelationships "github.com/nhost/nhost/services/constellation/connector/relationships"
	"github.com/nhost/nhost/services/constellation/controller/planner"
	"github.com/nhost/nhost/services/constellation/internal/jsonpath"
	"github.com/vektah/gqlparser/v2/ast"
)

// errTargetConnectorNotFound is returned when a remote query's target
// connector is not registered with the resolver. Both the generic remote
// path and the grouped-aggregate path surface this error so callers can
// errors.Is-discriminate.
var errTargetConnectorNotFound = errors.New("target connector not found")

type queryValidationArgumentPathRemapper interface {
	error
	RemapArgumentPath(remap func(argumentPath string) (mappedPath string))
}

// RemoteRelationshipResolver handles the complete lifecycle of remote relationship resolution.
// It executes remote queries, stitches results, and cleans up phantom fields.
type RemoteRelationshipResolver struct {
	connectors         map[string]connector.Connector
	aggregateExecutors map[string]groupedaggregate.Executor
}

// New creates a new RemoteRelationshipResolver with the given connectors. The
// aggregate-executor map is derived at construction time by selecting the
// subset of connectors that satisfy [groupedaggregate.Executor]; this turns
// the per-call runtime type assertion that used to live on the aggregate path
// into a one-shot configuration-time decision.
func New(connectors map[string]connector.Connector) *RemoteRelationshipResolver {
	aggregateExecutors := make(map[string]groupedaggregate.Executor, len(connectors))

	for name, c := range connectors {
		if exec, ok := c.(groupedaggregate.Executor); ok {
			aggregateExecutors[name] = exec
		}
	}

	return &RemoteRelationshipResolver{
		connectors:         connectors,
		aggregateExecutors: aggregateExecutors,
	}
}

// Resolve executes already-built queries using the historical eager-build
// path. It is retained for compatibility and strategy tests; callers with
// dependent remote relationships must use ResolvePlanned. Target phantoms are
// removed per result; local phantoms are removed after all queries complete.
// pendingQueries is produced by [BuildRemoteQueriesFromPlan].
func (r *RemoteRelationshipResolver) Resolve(
	ctx context.Context,
	results map[string]any,
	pendingQueries []*remoteQuery,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	logger *slog.Logger,
) error {
	for _, rq := range pendingQueries {
		if err := r.executeAndStitch(
			ctx, results, rq, fragments, variables, role, sessionVariables, logger,
		); err != nil {
			return err
		}
	}

	r.removeAllLocalPhantomFields(results, pendingQueries)

	return nil
}

// ResolvePlanned materializes each remote query only after its parent has
// been stitched. One query per response path batches all available parent
// rows, including those nested inside remote arrays and aggregate nodes.
func (r *RemoteRelationshipResolver) ResolvePlanned(
	ctx context.Context,
	results map[string]any,
	plan *planner.QueryPlan,
	fragments ast.FragmentDefinitionList,
	resolveTypeName func(string, string) string,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	logger *slog.Logger,
) error {
	pendingQueries := make([]*remoteQuery, 0, len(plan.RemoteQueries))
	for _, remote := range plan.RemoteQueries {
		rq := buildRemoteQueryFromPlan(results, remote, fragments, resolveTypeName)
		if rq == nil {
			continue
		}

		pendingQueries = append(pendingQueries, rq)
		if err := r.executeAndStitch(
			ctx, results, rq, fragments, variables, role, sessionVariables, logger,
		); err != nil {
			return err
		}
	}

	r.removeAllLocalPhantomFields(results, pendingQueries)

	return nil
}

// executeAndStitch executes a single remote query and stitches results into the parent data.
func (r *RemoteRelationshipResolver) executeAndStitch(
	ctx context.Context,
	results map[string]any,
	rq *remoteQuery,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	logger *slog.Logger,
) error {
	// No remote call is needed when every parent has a null key, but the
	// requested field must still be present on each parent (including nested
	// rows and aliases). Hasura returns null even for array relationships.
	if len(rq.joinArguments) == 0 {
		rq.stitchNullResults(results)

		return nil
	}

	// Cross-database grouped-aggregate relationships dispatch through the
	// connector's grouped-aggregate executor, bypassing the GraphQL
	// operation pipeline.
	if rq.aggregateInfo != nil {
		return r.executeAndStitchAggregate(
			ctx, results, rq, fragments, variables, role, sessionVariables, logger,
		)
	}

	if err := r.setDatabaseTargetTypes(rq, role); err != nil {
		return err
	}

	if rq.collectionInfo != nil && hasPerParentCollectionModifiers(rq.sourceField, variables) {
		return r.executeAndStitchCollection(
			ctx, results, rq, fragments, variables, role, sessionVariables, logger,
		)
	}

	return r.executeAndStitchOperation(ctx, results, rq, fragments, variables,
		role, sessionVariables, logger)
}

func (r *RemoteRelationshipResolver) executeAndStitchOperation(
	ctx context.Context,
	results map[string]any,
	rq *remoteQuery,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	logger *slog.Logger,
) error {
	// Build the remote operation using the resolver
	remoteOp := rq.buildOperation()
	if remoteOp == nil {
		return nil
	}

	// Resolve any variable references in the remote operation's arguments to literal values.
	// The remote operation is a standalone query sent to the target connector,
	// so variable references (e.g., $stats) must be replaced with their actual values
	// since the remote operation has no variable definitions.
	remoteOp.SelectionSet = resolveVariableReferences(remoteOp.SelectionSet, variables)

	// Get the target connector
	targetConnector := r.connectors[rq.targetConnector]
	if targetConnector == nil {
		return fmt.Errorf("%w: %s", errTargetConnectorNotFound, rq.targetConnector)
	}

	// Filter fragments to only those referenced by the remote operation.
	// The original fragments list may contain fragments defined on local types
	// (e.g., "fragment X on localTable { ... }") that would cause validation
	// errors on the remote schema.
	filteredFragments := collectReferencedFragments(remoteOp, fragments)
	for i, fragment := range filteredFragments {
		copyFragment := *fragment
		copyFragment.SelectionSet = resolveVariableReferences(fragment.SelectionSet, variables)
		filteredFragments[i] = &copyFragment
	}

	// Execute the remote query
	remoteExecResult, err := targetConnector.Execute(
		ctx, remoteOp, filteredFragments, variables, role, sessionVariables, logger,
	)
	if err != nil {
		// Root-field execution can merge partial connector data field-by-field, but
		// remote relationships need a complete lookup set before stitching into
		// parent rows. Do not stitch partial relationship data on error.
		err = remapRemoteQueryValidationArgumentPath(err, rq, remoteOp)

		return fmt.Errorf("failed to execute remote query: %w", err)
	}

	// Unmarshal any raw JSON values so type assertions in ExtractResults work.
	if err := unmarshalRawResults(remoteExecResult); err != nil {
		return fmt.Errorf("failed to parse remote result: %w", err)
	}

	remoteResults := rq.extractResults(remoteExecResult)

	// Build result lookup using the resolver - handles type-specific key building
	resultLookup := rq.buildResultLookup(remoteResults)

	rq.stitchResults(results, resultLookup)
	// Remove only from this query's result maps: a later stitch at the same
	// response path may contain a user-selected column with the same name.
	removeRemoteResultPhantoms(remoteResults, rq.remotePhantomFields)

	return nil
}

func removeRemoteResultPhantoms(results []any, fields []string) {
	for _, result := range results {
		if row, ok := result.(map[string]any); ok {
			for _, field := range fields {
				delete(row, field)
			}
		}
	}
}

// The JSON/JSONB _in predicate accepts JSON text, not a raw GraphQL
// string/array. The admin schema supplies type information for physical
// relationships whose target join column is hidden from the caller.
func (r *RemoteRelationshipResolver) setDatabaseTargetTypes(rq *remoteQuery, role string) error {
	db, ok := rq.resolver.(*databaseResolver)
	if !ok {
		return nil
	}

	target := r.connectors[rq.targetConnector]
	if target == nil {
		return nil // executeAndStitch reports the missing connector below.
	}

	schemas, err := target.GetSchema()
	if err != nil {
		return fmt.Errorf("loading remote target schema: %w", err)
	}

	db.setTargetTypes(
		schemas[role], schemas["admin"],
		connectorrelationships.CustomizedTypeName(target, db.targetTableName),
	)

	return nil
}

func remapRemoteQueryValidationArgumentPath(
	err error,
	rq *remoteQuery,
	remoteOp *ast.OperationDefinition,
) error {
	if err == nil || rq == nil {
		return err
	}

	clientPath := rq.argumentPath()
	if clientPath == "" {
		return err
	}

	if remapper, ok := errors.AsType[queryValidationArgumentPathRemapper](err); ok {
		remoteRootPath := remoteOperationRootArgumentPath(remoteOp)
		remapper.RemapArgumentPath(func(path string) string {
			if remoteRootPath == "" || path == remoteRootPath {
				return clientPath
			}

			suffix, ok := strings.CutPrefix(path, remoteRootPath+".selectionSet.")
			if !ok {
				return clientPath
			}

			return clientPath + ".selectionSet." + suffix
		})
	}

	return err
}

func remoteOperationRootArgumentPath(operation *ast.OperationDefinition) string {
	if operation == nil {
		return ""
	}

	for _, selection := range operation.SelectionSet {
		field, ok := selection.(*ast.Field)
		if !ok {
			continue
		}

		return field.Name
	}

	return ""
}

// removeAllLocalPhantomFields removes local phantom fields from all remote queries.
// This is called after all remote queries complete to clean up join columns
// that were added to parent queries.
func (r *RemoteRelationshipResolver) removeAllLocalPhantomFields(
	results map[string]any,
	remoteQueries []*remoteQuery,
) {
	fieldsByPath := make(map[string]map[string]struct{})
	pathsByKey := make(map[string]jsonpath.Path)

	for _, rq := range remoteQueries {
		parentPath := rq.getParentPath()
		phantomFields := rq.getLocalPhantomFields()

		if parentPath.IsEmpty() || len(phantomFields) == 0 {
			continue
		}

		key := parentPath.String()

		pathsByKey[key] = parentPath
		if fieldsByPath[key] == nil {
			fieldsByPath[key] = make(map[string]struct{})
		}

		for _, field := range phantomFields {
			fieldsByPath[key][field] = struct{}{}
		}
	}

	for key, fieldSet := range fieldsByPath {
		phantomFields := make([]string, 0, len(fieldSet))
		for field := range fieldSet {
			phantomFields = append(phantomFields, field)
		}

		pathsByKey[key].Delete(results, phantomFields...)
	}
}

// unmarshalRawResults converts any [jsontext.Value] entries in results to
// parsed Go types. SQL connectors return [jsontext.Value] to avoid
// double-marshaling in the common path; this function materialises them
// when the resolver needs to traverse the data.
func unmarshalRawResults(results map[string]any) error {
	for k, v := range results {
		if raw, ok := v.(jsontext.Value); ok && raw != nil {
			var parsed any
			if err := json.Unmarshal(raw, &parsed); err != nil {
				return fmt.Errorf("key %q: %w", k, err)
			}

			results[k] = parsed
		}
	}

	return nil
}
