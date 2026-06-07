package controller

import (
	"context"
	"encoding/json/jsontext"
	"errors"
	"fmt"
	"log/slog"
	"maps"
	"slices"
	"sync"

	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	"github.com/nhost/nhost/services/constellation/controller/introspection"
	"github.com/nhost/nhost/services/constellation/controller/middleware"
	"github.com/nhost/nhost/services/constellation/controller/planner"
	"github.com/nhost/nhost/services/constellation/controller/planner/transform"
	"github.com/nhost/nhost/services/constellation/controller/resolver"
	"github.com/nhost/nhost/services/constellation/internal/requestcontext"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/gqlerror"
	"github.com/vektah/gqlparser/v2/validator"
	"github.com/vektah/gqlparser/v2/validator/rules"
)

// defaultRules returns the cached default validator rules. We resolve them
// once on first call instead of allocating a fresh set per request; using
// sync.OnceValue keeps the value behind a function rather than a mutable
// package variable.
//
//nolint:gochecknoglobals // sync.OnceValue is the idiomatic memoised-constant pattern.
var defaultRules = sync.OnceValue(rules.NewDefaultRules)

// GraphQLRequest is the JSON payload accepted by HandlerPost (and used as
// the input to Resolve when invoked directly). Variables are unmarshalled
// as map[string]any so they can be coerced against the operation's typed
// variable definitions during validation.
type GraphQLRequest struct {
	OperationName string         `json:"operationName"`
	Query         string         `json:"query"`
	Variables     map[string]any `json:"variables"`
}

// GraphQLResponse is the JSON shape returned to the HTTP client. Either Data
// or Errors (or both, for partial-success connector results) may be set.
//
// rawResponse (unexported) is set internally when every connector returned
// raw JSON bytes — the HTTP handler writes them directly, skipping
// json.Marshal. Callers outside this package see only Data/Errors.
type GraphQLResponse struct {
	Data   any `json:"data,omitempty"`
	Errors any `json:"errors,omitempty"`

	// rawResponse holds pre-built response bytes for the fast path.
	// When set, the handler writes these bytes directly, skipping json.Marshal.
	rawResponse jsontext.Value
}

// Resolve runs the supplied GraphQL request against the controller's current
// state. It selects the role-specific schema, parses and validates the query
// (using the per-state LRU cache), coerces variables, and dispatches the
// operation to the matching connectors. The returned error is non-nil only
// for unrecoverable internal failures; user-facing errors (auth, schema,
// validation) are reported inside the GraphQLResponse envelope.
func (c *Controller) Resolve(
	ctx context.Context, req GraphQLRequest,
) (*GraphQLResponse, error) {
	ctx = requestcontext.GraphQLQueryToContext(ctx, req.Query)
	logger := requestcontext.LoggerFromContext(ctx)

	state := c.state.Load()

	session := middleware.SessionFromContext(ctx)
	if session == nil {
		return errResponseSessionNotFound, nil
	}

	role := session.Role

	validatedSchema, exists := state.validatedSchemas[role]
	if !exists {
		return errorResponse("no schema available for role: " + role), nil
	}

	query, gqlErrs := loadQuery(state.queryCache, validatedSchema, req.Query, role)
	if gqlErrs != nil {
		return &GraphQLResponse{
			Data:        nil,
			Errors:      formatGQLErrors(gqlErrs),
			rawResponse: nil,
		}, nil
	}

	operation := selectOperation(query, req.OperationName)
	if operation == nil {
		// Distinguish the two failure modes Hasura reports separately: a
		// supplied operationName that matched nothing (not-found) versus an
		// omitted name when several operations are present (ambiguous).
		return operationSelectionResponse(req.OperationName, len(query.Operations)), nil
	}

	validatedVariables, varResp := validateVariables(validatedSchema, operation, req.Variables)
	if varResp != nil {
		return varResp, nil
	}

	result := c.execute(
		ctx, state, validatedSchema, query, operation, query.Fragments,
		validatedVariables, role, session.Variables, logger,
	)

	return result, nil
}

// selectOperation picks the named operation from query, or — if no name was
// given and only one operation exists — that single operation. Returns nil
// when neither rule resolves a unique operation.
func selectOperation(
	query *ast.QueryDocument,
	operationName string,
) *ast.OperationDefinition {
	if operationName != "" {
		return query.Operations.ForName(operationName)
	}

	if len(query.Operations) == 1 {
		for _, op := range query.Operations {
			return op
		}
	}

	return nil
}

// validateVariables coerces request variables against the operation's typed
// variable definitions. Returns the coerced map on success, or a
// GraphQLResponse wrapping the validation errors. Missing required variables
// and declared defaults are handled even when the request omitted the variables
// object.
func validateVariables(
	schema *ast.Schema,
	operation *ast.OperationDefinition,
	variables map[string]any,
) (map[string]any, *GraphQLResponse) {
	validated, err := coerceVariables(schema, operation, variables)
	if err != nil {
		if gqlErrs, ok := gqlValidationErrors(err); ok {
			return nil, &GraphQLResponse{
				Data:        nil,
				Errors:      formatGQLErrors(gqlErrs),
				rawResponse: nil,
			}
		}

		return nil, errorResponse(err.Error())
	}

	return validated, nil
}

func gqlValidationErrors(err error) (gqlerror.List, bool) {
	if gqlErrs, ok := errors.AsType[gqlerror.List](err); ok {
		return gqlErrs, true
	}

	if gqlErr, ok := errors.AsType[*gqlerror.Error](err); ok {
		return gqlerror.List{gqlErr}, true
	}

	return nil, false
}

func coerceVariables(
	schema *ast.Schema,
	operation *ast.OperationDefinition,
	variables map[string]any,
) (map[string]any, error) {
	if operation == nil || (len(variables) == 0 && len(operation.VariableDefinitions) == 0) {
		return variables, nil
	}

	validated, err := validator.VariableValues(schema, operation, variables)
	if err != nil {
		return nil, fmt.Errorf("coercing variables: %w", err)
	}

	return validated, nil
}

func (c *Controller) execute(
	ctx context.Context,
	state *controllerState,
	schema *ast.Schema,
	query *ast.QueryDocument,
	operation *ast.OperationDefinition,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	logger *slog.Logger,
) *GraphQLResponse {
	if operation == nil {
		return errResponseOperationNotFound
	}

	// Normalize the root selection set once, up front: evaluate @skip/@include
	// and expand root-level fragment spreads / inline fragments into plain
	// fields. Every downstream walk (routing, planning, connector execution)
	// then sees the same field-only, directive-resolved view, so directives and
	// root fragments are handled in exactly one place. The cached query document
	// is never mutated — normalization returns fresh nodes.
	operation = transform.BuildSubOperation(
		operation, normalizeRootSelections(operation.SelectionSet, fragments, variables),
	)
	fragments = pruneFragments(fragments, variables)

	// Partition the normalized root fields into introspection meta-fields
	// (__schema/__type/__typename), resolved locally, and connector-backed data
	// fields, routed to their owning connector.
	dataByConnector, metaSelections, resp := groupFieldsByConnector(state, role, operation)
	if resp != nil {
		return resp
	}

	if len(metaSelections) > 0 {
		return c.executeWithMeta(
			ctx, state, schema, query, operation, metaSelections,
			dataByConnector, fragments, variables, role, sessionVariables, logger,
		)
	}

	if len(dataByConnector) == 0 {
		// Every root field was excluded by @skip/@include. Hasura returns an
		// empty data object for this case.
		return &GraphQLResponse{Data: map[string]any{}, Errors: nil, rawResponse: nil}
	}

	return c.executeDataOnly(
		ctx, state, operation, dataByConnector,
		fragments, variables, role, sessionVariables, logger,
	)
}

// executeWithMeta resolves introspection meta-fields locally and, for mixed
// operations, merges the connector-backed data into the same payload.
// Introspection produces Go maps, so the response is always marshalled (no raw
// fast path); raw jsontext.Value data values still marshal correctly inside the
// merged map.
func (c *Controller) executeWithMeta(
	ctx context.Context,
	state *controllerState,
	schema *ast.Schema,
	query *ast.QueryDocument,
	operation *ast.OperationDefinition,
	metaSelections []ast.Selection,
	dataByConnector map[string][]ast.Selection,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	logger *slog.Logger,
) *GraphQLResponse {
	metaOp := transform.BuildSubOperation(operation, metaSelections)
	metaQuery := *query
	metaQuery.Fragments = fragments
	results := introspection.Execute(schema, metaOp, &metaQuery)

	if len(dataByConnector) == 0 {
		return &GraphQLResponse{Data: results, Errors: nil, rawResponse: nil}
	}

	dataResults, errs, fatal := c.resolveData(
		ctx, state, operation, dataByConnector,
		fragments, variables, role, sessionVariables, logger, true,
	)
	if fatal != nil {
		return fatal
	}

	maps.Copy(results, dataResults)

	if len(errs) > 0 {
		return &GraphQLResponse{Data: results, Errors: errs, rawResponse: nil}
	}

	return &GraphQLResponse{Data: results, Errors: nil, rawResponse: nil}
}

// executeDataOnly plans and runs the connector-backed root fields and builds the
// final response, selecting the raw-bytes fast path when every result is already
// serialised JSON. It is the pure-data path (no introspection meta-fields).
func (c *Controller) executeDataOnly(
	ctx context.Context,
	state *controllerState,
	operation *ast.OperationDefinition,
	dataByConnector map[string][]ast.Selection,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	logger *slog.Logger,
) *GraphQLResponse {
	results, errs, fatal := c.resolveData(
		ctx,
		state,
		operation,
		dataByConnector,
		fragments,
		variables,
		role,
		sessionVariables,
		logger,
		false,
	)
	if fatal != nil {
		return fatal
	}

	if len(errs) > 0 {
		return errorsResponse(results, errs)
	}

	// Fast path: if all results are raw JSON, bypass json.Marshal entirely.
	if raw := buildRawResponse(results); raw != nil {
		return &GraphQLResponse{
			rawResponse: raw,
			Data:        nil,
			Errors:      nil,
		}
	}

	return &GraphQLResponse{
		Data:        results,
		rawResponse: nil,
		Errors:      nil,
	}
}

// resolveData fans the connector-backed root fields out to their owning
// connectors, merges results, and resolves cross-connector relationships. It
// returns the merged results map plus either fatal (a response that must be
// returned as-is: planning failure, structured argument error, or
// remote-relationship failure) or errs (per-connector partial errors, with
// phantom join columns already stripped from results so they never leak — even
// on the partial-error path).
//
// requirePrevalidation forces root connector validation even for a single
// connector. Mixed meta+data operations use it so structured argument errors
// can reject the whole request before any locally-resolved meta data is
// returned.
func (c *Controller) resolveData(
	ctx context.Context,
	state *controllerState,
	operation *ast.OperationDefinition,
	dataByConnector map[string][]ast.Selection,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	logger *slog.Logger,
	requirePrevalidation bool,
) (map[string]any, []map[string]any, *GraphQLResponse) {
	plan, err := state.queryPlanner.Plan(operation, fragments, role)
	if err != nil {
		// validatedSchemas is checked upstream; Plan only errs on internal
		// failures and ErrSchemaForRoleNotFound (which is unreachable here).
		return nil, nil, errorResponse(fmt.Errorf("planning query: %w", err).Error())
	}

	if plan.HasRemoteQueries() && operation.Operation == ast.Subscription {
		return nil, nil, errorResponse("remote relationships are not supported in subscriptions")
	}

	// Requests that fan out to multiple root connectors, or that will resolve
	// remote relationships after the root pass, run every side-effect-free
	// connector validation step before executing any root connector. A structured
	// argument failure (e.g. a distinct_on / order_by mismatch or negative
	// offset) must reject the whole request the way Hasura does, with no partial
	// data and — for mutations — no side effects from connectors that would
	// otherwise run before the invalid relationship query is discovered. Plain
	// single-connector data-only requests skip this pre-pass because Execute
	// already runs the same build/validation before touching the database.
	if requirePrevalidation || len(dataByConnector) > 1 || plan.HasRemoteQueries() {
		if resp := c.validateConnectors(
			state, plan, operation, dataByConnector, fragments, variables, role, sessionVariables,
		); resp != nil {
			return nil, nil, resp
		}
	}

	results, allErrors := c.executeConnectors(
		ctx, state, plan, operation, dataByConnector,
		fragments, variables, role, sessionVariables, logger,
	)

	if len(allErrors) > 0 {
		// Strip phantom join columns even on the partial-error path so the
		// internal join keys the planner injected never reach the client. The
		// error branch skips resolveRemoteRelationships, so SQL results are still
		// raw jsontext.Value; unmarshal them first because Path.Delete only
		// traverses parsed maps/slices. Failure to unmarshal must not fail the
		// already-degraded response — log and continue.
		if plan.HasRemoteQueries() {
			if err := unmarshalRawResults(results); err != nil {
				logger.WarnContext(
					ctx, "could not unmarshal partial results for phantom cleanup",
					slog.String("error", err.Error()),
				)
			}

			removePhantomFieldsFromPlan(results, plan)
		}

		return results, allErrors, nil
	}

	if resp := c.resolveRemoteRelationships(
		ctx, state, results, plan,
		fragments, variables, role, sessionVariables, logger,
	); resp != nil {
		return nil, nil, resp
	}

	removePhantomFieldsFromPlan(results, plan)

	return results, nil, nil
}

// groupFieldsByConnector partitions the normalized root selection set into
// introspection meta-fields (resolved locally) and per-connector data fields.
// It assumes normalizeRootSelections already expanded root fragments, so every
// selection is a plain *ast.Field. Meta-fields (__schema/__type/__typename) are
// returned separately; every other field is routed to its owning connector.
// Returns an error response when a data field has no connector.
func groupFieldsByConnector(
	state *controllerState,
	role string,
	operation *ast.OperationDefinition,
) (map[string][]ast.Selection, []ast.Selection, *GraphQLResponse) {
	fieldsByConnector := make(map[string][]ast.Selection)
	fieldToConnector := state.fieldToConnector[role]

	var metaSelections []ast.Selection

	for _, selection := range operation.SelectionSet {
		field, ok := selection.(*ast.Field)
		if !ok {
			continue
		}

		if isMetaField(field.Name) {
			metaSelections = append(metaSelections, selection)

			continue
		}

		connName := fieldToConnector[schemamerge.FieldKey(operation.Operation, field.Name)]
		if connName == "" {
			return nil, nil, errResponseNoConnector
		}

		fieldsByConnector[connName] = append(fieldsByConnector[connName], selection)
	}

	return fieldsByConnector, metaSelections, nil
}

// validateConnectors runs each owning connector's pre-execution validation over
// its root operation slice plus every planned database-backed remote
// relationship query. It returns a structured GraphQL response (no data) when
// any connector reports a trusted argument error, so the whole request is
// rejected before any connector executes — matching Hasura. Root validations
// and remote-target validations are each sorted by connector/path so the
// envelope is deterministic even though
// the input connector map is not.
//
// Only structured argument errors short-circuit the request here. Any other
// error a connector surfaces from validation (an unknown field, an internal
// build failure) is left for executeConnectors/resolveRemoteRelationships to
// report, so non-validation failures keep their existing wire shape and
// per-connector partial-data semantics unchanged.
func (c *Controller) validateConnectors(
	state *controllerState,
	plan *planner.QueryPlan,
	operation *ast.OperationDefinition,
	fieldsByConnector map[string][]ast.Selection,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
) *GraphQLResponse {
	var allStructuredErrs []map[string]any

	for _, connName := range slices.Sorted(maps.Keys(fieldsByConnector)) {
		selections := fieldsByConnector[connName]

		conn := state.connectors[connName]
		if conn == nil {
			// A missing connector is reported by executeConnectors, which owns
			// the no-connector error envelope; skip it here.
			continue
		}

		execOp, execFragments := buildConnectorOperation(
			plan, connName, operation, selections, fragments,
		)

		err := conn.ValidateOperation(
			execOp, execFragments, variables, role, sessionVariables,
		)
		if err == nil {
			continue
		}

		if structuredErrs, ok := classifyStructuredConnectorError(err); ok {
			allStructuredErrs = append(allStructuredErrs, structuredErrs...)
		}
	}

	allStructuredErrs = append(
		allStructuredErrs,
		c.validateRemoteTargets(state, plan, fragments, variables, role, sessionVariables)...,
	)

	if len(allStructuredErrs) > 0 {
		return &GraphQLResponse{
			Data:        nil,
			Errors:      allStructuredErrs,
			rawResponse: nil,
		}
	}

	return nil
}

// executeConnectors runs the operation's fields against each owning connector and
// merges results. Errors from individual connectors are collected, not fatal.
func (c *Controller) executeConnectors(
	ctx context.Context,
	state *controllerState,
	plan *planner.QueryPlan,
	operation *ast.OperationDefinition,
	fieldsByConnector map[string][]ast.Selection,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	logger *slog.Logger,
) (map[string]any, []map[string]any) {
	results := make(map[string]any)

	var allErrors []map[string]any

	for connName, selections := range fieldsByConnector {
		connector := state.connectors[connName]
		if connector == nil {
			return nil, []map[string]any{{"message": "no connector found"}}
		}

		execOp, execFragments := buildConnectorOperation(
			plan, connName, operation, selections, fragments,
		)

		execResult, err := connector.Execute(
			ctx, execOp, execFragments, variables, role, sessionVariables, logger,
		)
		if err != nil {
			allErrors = append(allErrors, c.classifyConnectorError(ctx, logger, err)...)

			// Merge partial data even when there are errors (e.g. remote
			// schema returned data + errors for a partial response).
			if execResult != nil {
				maps.Copy(results, execResult)
			}

			continue
		}

		maps.Copy(results, execResult)
	}

	return results, allErrors
}

// buildConnectorOperation returns the executable operation and fragments to
// send to a connector. If the planner produced a clean operation (with
// relationship fields stripped), that is preferred. Otherwise a sub-operation is
// built from the raw selections. In both cases unused fragments and variable
// definitions are pruned so remote schemas receive a self-contained document
// that still validates after root-fragment expansion and directive pruning.
func buildConnectorOperation(
	plan *planner.QueryPlan,
	connName string,
	operation *ast.OperationDefinition,
	selections []ast.Selection,
	fragments ast.FragmentDefinitionList,
) (*ast.OperationDefinition, ast.FragmentDefinitionList) {
	if plan != nil {
		if pq := plan.GetPrimaryQueryForConnector(connName); pq != nil && pq.CleanOperation != nil {
			return pruneConnectorDocument(pq.CleanOperation, pq.CleanFragments)
		}
	}

	return pruneConnectorDocument(transform.BuildSubOperation(operation, selections), fragments)
}

// resolveRemoteRelationships handles cross-connector relationship resolution.
// It unmarshals raw JSON results, builds remote queries from the plan, and
// executes them. Returns an error response if any step fails, nil on success.
func (c *Controller) resolveRemoteRelationships(
	ctx context.Context,
	state *controllerState,
	results map[string]any,
	plan *planner.QueryPlan,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	logger *slog.Logger,
) *GraphQLResponse {
	if plan == nil || !plan.HasRemoteQueries() {
		return nil
	}

	// Unmarshal raw JSON values back to map[string]any so jsonpath can traverse them.
	if err := unmarshalRawResults(results); err != nil {
		return errorResponse(sanitizeConnectorError(ctx, logger, c.devMode, err))
	}

	pendingQueries := resolver.BuildRemoteQueriesFromPlan(
		results,
		plan,
		fragments,
		func(connectorName, identifier string) string {
			if conn := state.connectors[connectorName]; conn != nil {
				return conn.GetTypeName(identifier)
			}

			return ""
		},
	)

	if len(pendingQueries) == 0 {
		return nil
	}

	if err := state.remoteRelationshipResolver.Resolve(
		ctx, results, pendingQueries,
		fragments, variables, role, sessionVariables, logger,
	); err != nil {
		return &GraphQLResponse{
			Data:        nil,
			Errors:      c.classifyConnectorError(ctx, logger, err),
			rawResponse: nil,
		}
	}

	return nil
}

// errorResponse builds a GraphQLResponse with a single error message.
func errorResponse(msg string) *GraphQLResponse {
	return &GraphQLResponse{
		Errors:      []map[string]any{{"message": msg}},
		rawResponse: nil,
		Data:        nil,
	}
}

// errorsResponse builds a GraphQLResponse with partial data and multiple errors.
func errorsResponse(results map[string]any, errs []map[string]any) *GraphQLResponse {
	var data any
	if len(results) > 0 {
		data = results
	}

	return &GraphQLResponse{
		Data:        data,
		Errors:      errs,
		rawResponse: nil,
	}
}

// loadQuery parses and validates a GraphQL query, using the LRU cache to
// avoid re-parsing identical queries for the same role.
func loadQuery(
	cache *queryCache,
	schema *ast.Schema,
	queryStr string,
	role string,
) (*ast.QueryDocument, gqlerror.List) {
	key := queryCacheKey{query: queryStr, role: role}

	if cached, ok := cache.Get(key); ok {
		return cached.doc, cached.errs
	}

	doc, errs := gqlparser.LoadQueryWithRules(schema, queryStr, defaultRules())
	cache.Put(key, queryCacheEntry{doc: doc, errs: errs})

	return doc, errs
}

// buildRawResponse builds the complete JSON response bytes {"data":{...}} when
// all result values are raw JSON from SQL connectors. Returns nil if any value
// is not jsontext.Value (e.g., remote schema results or post-resolution data).
func buildRawResponse(results map[string]any) jsontext.Value {
	if len(results) == 0 {
		return nil
	}

	// Estimate total size: {"data":{"key1":value1,"key2":value2}}
	// outer wrapper is 9 bytes ({"data":{ + closing }}), plus per-entry overhead
	// of 4 bytes (",":" surrounding the key + a separating comma between entries).
	const (
		dataWrapperBytes = len(`{"data":{}}`)
		perEntryOverhead = 4
	)

	size := dataWrapperBytes
	for k, v := range results {
		raw, ok := v.(jsontext.Value)
		if !ok {
			return nil
		}

		size += len(k) + len(raw) + perEntryOverhead
	}

	buf := make([]byte, 0, size)
	buf = append(buf, `{"data":{`...)

	first := true
	for k, v := range results {
		raw, ok := v.(jsontext.Value)
		if !ok {
			continue
		}

		if !first {
			buf = append(buf, ',')
		}

		first = false

		buf = append(buf, '"')
		buf = append(buf, k...)
		buf = append(buf, '"', ':')
		buf = append(buf, raw...)
	}

	buf = append(buf, '}', '}')

	return buf
}

func formatGQLErrors(errs gqlerror.List) []map[string]any {
	result := make([]map[string]any, len(errs))
	for i, err := range errs {
		m := map[string]any{
			"message": err.Message,
		}
		if len(err.Locations) > 0 {
			m["locations"] = err.Locations
		}

		if len(err.Path) > 0 {
			m["path"] = pathToAny(err.Path)
		}

		if len(err.Extensions) > 0 {
			m["extensions"] = err.Extensions
		}

		result[i] = m
	}

	return result
}

func pathToAny(p ast.Path) []any {
	result := make([]any, len(p))
	for i, elem := range p {
		switch e := elem.(type) {
		case ast.PathName:
			result[i] = string(e)
		case ast.PathIndex:
			result[i] = int(e)
		}
	}

	return result
}
