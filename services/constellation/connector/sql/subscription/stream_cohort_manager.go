package subscription

import (
	"context"
	json "encoding/json/v2"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/internal/requestcontext"
	sub "github.com/nhost/nhost/services/constellation/subscription"
)

// streamCohortManager manages stream subscription cohorts with cursor-based batching.
// Unlike the regular cohortManager, this manager:
// 1. Includes cursor values in cohort keys (subscribers at same cursor position batch together)
// 2. Rebuilds the cohort map after each poll (to reflect cursor advancement)
// 3. Handles new subscribers arriving during a poll specially (separate cohort for initial data).
type streamCohortManager struct {
	executor        QueryExecutor
	roots           QueryBuilder
	cohorts         map[string]*streamCohort
	mu              sync.RWMutex
	pollingInterval time.Duration
	logger          *slog.Logger
	// subscriptionIndex maps subscription ID to cohort key for fast lookup during removal.
	subscriptionIndex map[string]string
}

// newStreamCohortManager creates a new stream cohort manager.
func newStreamCohortManager(
	executor QueryExecutor,
	roots QueryBuilder,
	pollingInterval time.Duration,
	logger *slog.Logger,
) *streamCohortManager {
	if pollingInterval == 0 {
		pollingInterval = defaultPollingInterval
	}

	if logger == nil {
		logger = slog.Default()
	}

	return &streamCohortManager{
		executor:          executor,
		roots:             roots,
		cohorts:           make(map[string]*streamCohort),
		mu:                sync.RWMutex{},
		pollingInterval:   pollingInterval,
		logger:            logger,
		subscriptionIndex: make(map[string]string),
	}
}

// addSubscription adds a stream subscription to the appropriate cohort.
// Cohorts are keyed by query + role + cursor values, so subscribers with
// the same cursor position are batched together.
func (m *streamCohortManager) addSubscription(
	ctx context.Context,
	req sub.Request,
	cursorValues map[string]any,
	cursorColumns []string,
	logger *slog.Logger,
) (<-chan sub.Update, error) {
	// Compute cohort key (includes variables and cursor values)
	key := newStreamCohortKey(
		req.QueryString,
		req.Role,
		req.OperationName,
		req.Variables,
		cursorValues,
	)
	keyStr := key.String()

	m.mu.Lock()

	c, exists := m.cohorts[keyStr]
	if !exists {
		c = newStreamCohort(
			key, req.QueryString, req.Operation, req.Fragments, req.OperationName, cursorValues,
		)
		c.cursorColumns = cursorColumns
		m.cohorts[keyStr] = c

		// Polling outlives any single subscriber; termination flows through
		// c.stopChannel() instead of context cancellation. Detaching from the
		// caller's ctx prevents the first subscriber's disconnect from failing
		// in-flight polls and broadcasting "context canceled" to remaining
		// cohort members.
		go m.pollCohort(context.Background(), c) //nolint:contextcheck

		logger.DebugContext(ctx, "created new stream cohort",
			slog.String("cohort_key", keyStr),
			slog.Any("cursor_values", cursorValues),
		)
	}

	// Create stream subscription
	streamSub := newStreamCohortSubscription(
		req.ID,
		req.SessionVariables,
		req.Variables,
		cursorValues,
	)

	c.addSubscription(streamSub)

	m.subscriptionIndex[req.ID] = keyStr

	m.mu.Unlock()

	logger.DebugContext(ctx, "added stream subscription to cohort",
		slog.String("subscription_id", req.ID),
		slog.String("cohort_key", keyStr),
		slog.Int("cohort_size", c.size()),
	)

	return streamSub.updateChannel(), nil
}

// removeSubscription removes a subscription from its cohort.
func (m *streamCohortManager) removeSubscription(ctx context.Context, subID string) {
	logger := requestcontext.LoggerFromContext(ctx)

	m.mu.Lock()
	defer m.mu.Unlock()

	// Use index for fast lookup
	keyStr, exists := m.subscriptionIndex[subID]
	if !exists {
		// Subscription not found in index, search all cohorts
		for k, c := range m.cohorts {
			if c.getSubscription(subID) != nil {
				keyStr = k
				exists = true

				break
			}
		}
	}

	if !exists {
		return
	}

	c, exists := m.cohorts[keyStr]
	if !exists {
		// Cohort was removed, clean up index
		delete(m.subscriptionIndex, subID)
		return
	}

	isEmpty := c.removeSubscription(subID)
	delete(m.subscriptionIndex, subID)

	logger.DebugContext(ctx, "removed subscription from stream cohort",
		slog.String("subscription_id", subID),
		slog.String("cohort_key", keyStr),
	)

	// If cohort is now empty, stop it and remove it
	if isEmpty {
		c.stop()
		delete(m.cohorts, keyStr)

		logger.DebugContext(ctx, "removed empty stream cohort",
			slog.String("cohort_key", keyStr),
		)
	}
}

// pollCohort runs the polling loop for a stream cohort.
func (m *streamCohortManager) pollCohort(ctx context.Context, c *streamCohort) {
	logger := m.logger

	ticker := time.NewTicker(m.pollingInterval)
	defer ticker.Stop()

	logger.DebugContext(ctx, "started polling stream cohort",
		slog.String("cohort_key", c.key.String()),
	)

	// Execute immediately on start
	m.executeAndRebuild(ctx, c, logger)

	// Polling runs under context.Background() (see findOrCreateCohort), so
	// ctx.Done() can never fire here — termination always comes through
	// c.stopChannel() (Handler.Shutdown or the empty-cohort cleanup below).
	for {
		select {
		case <-c.stopChannel():
			logger.DebugContext(ctx, "stream cohort polling stopped",
				slog.String("cohort_key", c.key.String()),
			)

			return

		case <-ticker.C:
			// Check emptiness under the manager lock to prevent TOCTOU
			// races where a subscription is added between isEmpty() and delete().
			m.mu.Lock()
			if c.isEmpty() {
				delete(m.cohorts, c.key.String())
				m.mu.Unlock()

				logger.DebugContext(ctx, "stream cohort is empty, stopping",
					slog.String("cohort_key", c.key.String()),
				)

				c.stop()

				return
			}

			m.mu.Unlock()

			m.executeAndRebuild(ctx, c, logger)
		}
	}
}

// executeAndRebuild executes the query and rebuilds the cohort map.
func (m *streamCohortManager) executeAndRebuild(
	ctx context.Context,
	c *streamCohort,
	logger *slog.Logger,
) {
	c.startPolling()
	defer c.endPolling()

	subscriptions := c.getSubscriptionsCopy()

	logger.DebugContext(ctx, "executing stream poll",
		slog.String("cohort_key", c.key.String()),
		slog.Int("subscriptions", len(subscriptions)),
		slog.Int("new_subscriptions", len(c.getNewSubscriptionsCopy())),
		slog.Any("cursor_values", c.getCursorValues()),
	)

	if len(subscriptions) == 0 {
		logger.DebugContext(ctx, "no subscriptions in stream cohort, skipping poll")
		return
	}

	subIDs, sessionVarArrays, graphQLVarArrays := buildStreamSubscriberInputs(subscriptions)

	rawResults, currentCursor, err := m.executeStreamQuery(
		ctx,
		c,
		subIDs,
		sessionVarArrays,
		graphQLVarArrays,
		logger,
	)
	if err != nil {
		wrapped := fmt.Errorf("executing stream subscription poll: %w", err)

		logger.ErrorContext(ctx, "failed to execute stream query",
			slog.String("cohort_key", c.key.String()),
			slog.String("error", wrapped.Error()),
		)
		broadcastStreamError(subscriptions, wrapped)

		return
	}

	// Parse every result's JSON payload exactly once, then derive both the
	// next cursor and (in sendStreamResults) the empty-result skip from the
	// same parse. Previously the empty check and the cursor extract each
	// re-parsed every payload, costing three passes per result per poll.
	results := parseStreamResults(rawResults)
	newCursorValues := pickCursorFromResults(results, c.cursorColumns, currentCursor)

	m.sendStreamResults(ctx, c, results, subscriptions, newCursorValues, logger)

	if len(newCursorValues) > 0 {
		m.rebuildCohortMap(ctx, c, newCursorValues, logger)
	}

	m.processNewSubscribers(ctx, c, logger)
}

// buildStreamSubscriberInputs assembles the per-subscriber inputs for the
// stream multiplexed executor. Unlike the live-query path, stream cohorts
// share the cursor but each subscriber contributes its own GraphQL variables.
func buildStreamSubscriberInputs(
	subscriptions map[string]*streamCohortSubscription,
) ([]string, map[string][]any, map[string][]any) {
	subIDs := make([]string, 0, len(subscriptions))
	sessionVarArrays := make(map[string][]any)
	graphQLVarArrays := make(map[string][]any)

	for _, s := range subscriptions {
		subIDs = append(subIDs, s.id)

		for varName, varValue := range s.sessionVariables {
			if _, exists := sessionVarArrays[varName]; !exists {
				sessionVarArrays[varName] = make([]any, 0, len(subscriptions))
			}

			sessionVarArrays[varName] = append(sessionVarArrays[varName], varValue)
		}

		for varName, varValue := range s.graphQLVariables {
			if _, exists := graphQLVarArrays[varName]; !exists {
				graphQLVarArrays[varName] = make([]any, 0, len(subscriptions))
			}

			graphQLVarArrays[varName] = append(graphQLVarArrays[varName], varValue)
		}
	}

	return subIDs, sessionVarArrays, graphQLVarArrays
}

// broadcastStreamError sends the same error to every stream subscriber.
func broadcastStreamError(
	subscriptions map[string]*streamCohortSubscription,
	err error,
) {
	for _, s := range subscriptions {
		s.sendUpdate(sub.NewUpdateError(s.id, err))
	}
}

// sendParseError surfaces a payload-parse failure to the affected subscriber so
// a corrupt result doesn't get silently demoted to "no rows".
func sendParseError(
	ctx context.Context,
	s *streamCohortSubscription,
	cohortKey string,
	parseErr error,
	logger *slog.Logger,
) {
	logger.ErrorContext(ctx, "failed to parse stream result payload",
		slog.String("cohort_key", cohortKey),
		slog.String("subscription_id", s.id),
		slog.String("error", parseErr.Error()),
	)

	s.sendUpdate(sub.NewUpdateError(s.id, parseErr))
}

// sendStreamResults sends poll results to subscribers with change detection.
func (m *streamCohortManager) sendStreamResults(
	ctx context.Context,
	c *streamCohort,
	results []parsedStreamResult,
	subscriptions map[string]*streamCohortSubscription,
	newCursorValues map[string]any,
	logger *slog.Logger,
) {
	sentCount := 0
	skippedUnchanged := 0
	skippedEmpty := 0
	errorCount := 0

	for _, result := range results {
		s, exists := subscriptions[result.subscriptionID]
		if !exists {
			continue
		}

		if result.parseErr != nil {
			sendParseError(ctx, s, c.key.String(), result.parseErr, logger)

			errorCount++

			continue
		}

		hash := computeDataHash(result.data)
		isInitialPoll := s.lastHash == ""

		// len(result.rows) == 0 here means "no rows returned" (parseErr was
		// handled above). Skip on non-initial polls; the initial poll is
		// always sent so subscribers see a baseline payload before going quiet.
		if !isInitialPoll && len(result.rows) == 0 {
			skippedEmpty++
			continue
		}

		if hash != s.lastHash {
			if s.sendUpdate(sub.NewUpdateData(s.id, result.data)) {
				s.lastHash = hash
				sentCount++
			}
		} else {
			skippedUnchanged++
		}
	}

	logger.DebugContext(ctx, "stream poll results sent",
		slog.String("cohort_key", c.key.String()),
		slog.Int("sent", sentCount),
		slog.Int("skipped_unchanged", skippedUnchanged),
		slog.Int("skipped_empty", skippedEmpty),
		slog.Int("errors", errorCount),
		slog.Any("new_cursor", newCursorValues),
	)
}

// executeStreamQuery executes the stream query and returns the raw results
// paired with the cursor that the query ran against. Cursor advancement is
// performed in executeAndRebuild against parsed results so payload JSON is
// unmarshalled once per poll instead of separately per concern.
func (m *streamCohortManager) executeStreamQuery(
	ctx context.Context,
	c *streamCohort,
	subscriptionIDs []string,
	sessionVarArrays, graphQLVarArrays map[string][]any,
	logger *slog.Logger,
) ([]MultiplexedResult, map[string]any, error) {
	op, err := m.getOrBuildSQL(c, sessionVarArrays, graphQLVarArrays, logger)
	if err != nil {
		return nil, nil, err
	}

	cursorValues := c.getCursorValues()

	results, err := m.executor.ExecuteMultiplexedQueryWithCursor(
		ctx,
		op,
		subscriptionIDs,
		sessionVarArrays,
		cursorValues,
		logger,
	)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to execute stream multiplexed query: %w", err)
	}

	return results, cursorValues, nil
}

// getOrBuildSQL returns the cached SQL operation or builds and caches it on
// first call. The SQL is stable per stream cohort: query, role, and variable
// values are fixed by the cohort key, and cursor values flow through
// result_vars rather than the SQL string itself. Mirrors the equivalent
// optimisation on cohortManager.
func (m *streamCohortManager) getOrBuildSQL(
	c *streamCohort,
	sessionVarArrays, graphQLVarArrays map[string][]any,
	logger *slog.Logger,
) (core.SQLOperation, error) {
	if c.cachedOp != nil {
		return *c.cachedOp, nil
	}

	templateSessionVars, templateGraphQLVars := buildStreamTemplateVars(
		sessionVarArrays, graphQLVarArrays,
	)

	operations, err := m.roots.BuildQuery(
		c.operation,
		c.fragments,
		templateGraphQLVars,
		c.key.role,
		templateSessionVars,
	)
	if err != nil {
		// Stream subscriptions are validated synchronously by
		// Handler.detectStreamSubscription before reaching the polling loop,
		// so this branch is normally unreachable. Wrap with
		// ErrInvalidSubscription for symmetry with cohortManager.getOrBuildSQL
		// and as defence-in-depth against future paths (e.g. metadata reload)
		// that might land an unplannable query in an already-running cohort.
		return core.SQLOperation{}, fmt.Errorf(
			"%w: failed to build stream SQL: %w",
			sub.ErrInvalidSubscription,
			err,
		)
	}

	if len(operations) == 0 {
		return core.SQLOperation{}, fmt.Errorf(
			"%w: no operations generated from stream subscription",
			sub.ErrInvalidSubscription,
		)
	}

	op := operations[0]
	c.cachedOp = &op

	logger.Debug("built and cached stream subscription SQL",
		slog.String("cohort_key", c.key.String()),
	)

	return op, nil
}

// buildStreamTemplateVars produces the variable maps used to build SQL once
// per poll. Session vars carry only their names (values are per-subscriber and
// supplied at execution time); GraphQL vars use the first subscriber's value
// because all subscribers in a cohort share identical GraphQL inputs.
func buildStreamTemplateVars(
	sessionVarArrays, graphQLVarArrays map[string][]any,
) (map[string]any, map[string]any) {
	templateSessionVars := make(map[string]any, len(sessionVarArrays))
	for varName := range sessionVarArrays {
		templateSessionVars[varName] = varName
	}

	templateGraphQLVars := make(map[string]any, len(graphQLVarArrays))
	for varName, values := range graphQLVarArrays {
		if len(values) > 0 {
			templateGraphQLVars[varName] = values[0]
		}
	}

	return templateSessionVars, templateGraphQLVars
}

// parsedStreamResult attaches the unwrapped row array to a multiplexed result.
// Stream results arrive wrapped like {"<field>": [...]}; the wrapper key is
// redundant with the cohort's operation, so parseStreamResults discards it and
// keeps only the row array. rows is nil when the payload is empty (no rows
// returned) or when parseErr is non-nil (malformed JSON); callers must check
// parseErr before treating rows as authoritative.
type parsedStreamResult struct {
	subscriptionID string
	data           []byte
	rows           []map[string]any
	parseErr       error
}

// parseStreamResults unmarshals each result's JSON payload exactly once so
// downstream consumers — cursor extraction and the empty-result skip in
// sendStreamResults — share a single parse instead of doing one each.
func parseStreamResults(
	results []MultiplexedResult,
) []parsedStreamResult {
	parsed := make([]parsedStreamResult, len(results))
	for i, r := range results {
		rows, err := unwrapResultRows(r.Data)
		parsed[i] = parsedStreamResult{
			subscriptionID: r.SubscriptionID,
			data:           r.Data,
			rows:           rows,
			parseErr:       err,
		}
	}

	return parsed
}

// unwrapResultRows pulls the row array out of a {"<field>": [...]} envelope.
// Returns (nil, nil) when data is empty. Returns (nil, err) when the payload
// fails to unmarshal so the caller can surface the error to the subscriber
// instead of silently demoting a corrupt payload to "no rows".
func unwrapResultRows(data []byte) ([]map[string]any, error) {
	if len(data) == 0 {
		return nil, nil
	}

	var wrapper map[string][]map[string]any
	if err := json.Unmarshal(data, &wrapper); err != nil {
		return nil, fmt.Errorf("parsing stream result payload: %w", err)
	}

	for _, v := range wrapper {
		return v, nil
	}

	return nil, nil
}

// pickCursorFromResults walks parsed results and returns the cursor extracted
// from the first non-empty payload. All subscribers in a cohort share the
// same cursor position, so the first match is sufficient.
func pickCursorFromResults(
	results []parsedStreamResult,
	cursorColumns []string,
	currentCursor map[string]any,
) map[string]any {
	if len(cursorColumns) == 0 {
		return nil
	}

	for _, result := range results {
		if len(result.rows) == 0 {
			continue
		}

		return pickCursorFromRows(result.rows, cursorColumns, currentCursor)
	}

	return nil
}

// pickCursorFromRows extracts cursor column values from the last row of a
// non-empty result, falling back to the previous cursor for any column the
// row is missing (matching Hasura's mergeOldAndNewCursorValues semantics).
func pickCursorFromRows(
	rows []map[string]any,
	cursorColumns []string,
	currentCursor map[string]any,
) map[string]any {
	lastRow := rows[len(rows)-1]
	newCursorValues := make(map[string]any, len(cursorColumns))

	for _, colName := range cursorColumns {
		if val, ok := pickCursorForColumn(lastRow, currentCursor, colName); ok {
			newCursorValues[colName] = val
		}
	}

	return newCursorValues
}

// pickCursorForColumn chooses the cursor value for a single column, falling
// back to the previous cursor when the result row is missing the column or
// has a NULL there (matching Hasura's mergeOldAndNewCursorValues semantics).
// Returns ok=false only when neither the row nor the previous cursor carries
// the column, in which case the column is omitted from the new cursor.
func pickCursorForColumn(
	row map[string]any,
	currentCursor map[string]any,
	colName string,
) (any, bool) {
	if val, exists := row[colName]; exists && val != nil {
		return val, true
	}

	if prev, exists := currentCursor[colName]; exists {
		return prev, true
	}

	return nil, false
}

// rebuildCohortMap rebuilds the cohort map with the new cursor position.
// This is the key mechanism that allows cohorts to naturally merge when
// they reach the same cursor position.
func (m *streamCohortManager) rebuildCohortMap(
	ctx context.Context,
	c *streamCohort,
	newCursorValues map[string]any,
	logger *slog.Logger,
) {
	m.mu.Lock()
	defer m.mu.Unlock()

	oldKeyStr := c.key.String()

	// Variables hash stays the same — only the cursor changes.
	newKey := streamCohortKey{
		queryHash:     c.key.queryHash,
		role:          c.key.role,
		operationName: c.key.operationName,
		variablesHash: c.key.variablesHash,
		cursorHash:    hashCursorValues(newCursorValues),
	}
	newKeyStr := newKey.String()

	if oldKeyStr == newKeyStr {
		c.updateCursor(newCursorValues)
		return
	}

	logger.DebugContext(ctx, "stream cohort cursor advanced",
		slog.String("old_key", oldKeyStr),
		slog.String("new_key", newKeyStr),
		slog.Any("new_cursor", newCursorValues),
	)

	if existing, exists := m.cohorts[newKeyStr]; exists && existing != c {
		m.mergeStreamCohort(ctx, c, existing, oldKeyStr, newKeyStr, logger)
		return
	}

	m.reseatStreamCohort(ctx, c, oldKeyStr, newKey, newCursorValues, logger)
}

// mergeStreamCohort moves every subscriber from src into dst and tears down
// src. clearSubscriptions runs before stop so the moved subscribers' channels
// stay open.
func (m *streamCohortManager) mergeStreamCohort(
	ctx context.Context,
	src, dst *streamCohort,
	oldKeyStr, newKeyStr string,
	logger *slog.Logger,
) {
	subscriptions := src.getSubscriptionsCopy()

	subIDs := make([]string, 0, len(subscriptions))
	for id := range subscriptions {
		subIDs = append(subIDs, id)
	}

	logger.DebugContext(ctx, "merging stream cohorts",
		slog.String("from_cohort", oldKeyStr),
		slog.String("to_cohort", newKeyStr),
		slog.Int("moving_subscriptions", len(subscriptions)),
		slog.Any("subscription_ids", subIDs),
		slog.Int("target_cohort_size", dst.size()),
	)

	for id, s := range subscriptions {
		dst.addSubscription(s)

		m.subscriptionIndex[id] = newKeyStr
	}

	src.clearSubscriptions()

	logger.DebugContext(ctx, "stopping merged cohort",
		slog.String("cohort_key", oldKeyStr),
	)
	src.stop()
	delete(m.cohorts, oldKeyStr)

	logger.DebugContext(ctx, "merge complete",
		slog.String("merged_into", newKeyStr),
		slog.Int("new_cohort_size", dst.size()),
	)
}

// reseatStreamCohort re-keys an existing cohort under its advanced cursor
// when no other cohort already occupies that key.
func (m *streamCohortManager) reseatStreamCohort(
	ctx context.Context,
	c *streamCohort,
	oldKeyStr string,
	newKey streamCohortKey,
	newCursorValues map[string]any,
	logger *slog.Logger,
) {
	newKeyStr := newKey.String()

	delete(m.cohorts, oldKeyStr)

	c.key = newKey
	c.updateCursor(newCursorValues)
	m.cohorts[newKeyStr] = c

	subscriptions := c.getSubscriptionsCopy()
	for id := range subscriptions {
		m.subscriptionIndex[id] = newKeyStr
	}

	logger.DebugContext(ctx, "cohort key updated",
		slog.String("old_key", oldKeyStr),
		slog.String("new_key", newKeyStr),
		slog.Int("subscriptions", len(subscriptions)),
	)
}

// processNewSubscribers handles subscribers that arrived during the poll.
// These subscribers need their initial data, so they're either:
// 1. Added to an existing cohort with matching cursor, or
// 2. Given their own new cohort.
func (m *streamCohortManager) processNewSubscribers(
	ctx context.Context,
	c *streamCohort,
	logger *slog.Logger,
) {
	newSubs := c.extractNewSubscribers()
	if len(newSubs) == 0 {
		return
	}

	subIDs := make([]string, 0, len(newSubs))
	for id := range newSubs {
		subIDs = append(subIDs, id)
	}

	logger.DebugContext(ctx, "processing new subscribers that arrived during poll",
		slog.String("cohort_key", c.key.String()),
		slog.Int("count", len(newSubs)),
		slog.Any("subscription_ids", subIDs),
	)

	m.mu.Lock()
	defer m.mu.Unlock()

	byCursor := groupNewSubscribersByCursor(newSubs)

	for cursorHash, subs := range byCursor {
		if len(subs) == 0 {
			continue
		}

		m.attachOrCreateCohortForCursor(ctx, c, cursorHash, subs, logger)
	}
}

// groupNewSubscribersByCursor buckets subscribers that arrived during a poll
// by the hash of their initial cursor values, so each bucket can join (or
// seed) a single cohort.
func groupNewSubscribersByCursor(
	newSubs map[string]*streamCohortSubscription,
) map[string][]*streamCohortSubscription {
	byCursor := make(map[string][]*streamCohortSubscription)

	for _, s := range newSubs {
		cursorHash := hashCursorValues(s.initialCursorValues)
		byCursor[cursorHash] = append(byCursor[cursorHash], s)
	}

	return byCursor
}

// attachOrCreateCohortForCursor places subs in an existing cohort that
// matches the cursor or, failing that, spins up a new cohort for them.
// The manager lock must be held by the caller.
func (m *streamCohortManager) attachOrCreateCohortForCursor(
	ctx context.Context,
	c *streamCohort,
	cursorHash string,
	subs []*streamCohortSubscription,
	logger *slog.Logger,
) {
	cursorValues := subs[0].initialCursorValues

	key := streamCohortKey{
		queryHash:     c.key.queryHash,
		role:          c.key.role,
		operationName: c.key.operationName,
		variablesHash: c.key.variablesHash,
		cursorHash:    hashCursorValues(cursorValues),
	}
	keyStr := key.String()

	if existing, exists := m.cohorts[keyStr]; exists {
		for _, s := range subs {
			s.markProcessed()
			existing.addSubscription(s)
			m.subscriptionIndex[s.id] = keyStr
		}

		logger.DebugContext(ctx, "added new subscribers to existing stream cohort",
			slog.String("cohort_key", keyStr),
			slog.Int("count", len(subs)),
		)

		return
	}

	nc := newStreamCohort(
		key,
		c.queryString,
		c.operation,
		c.fragments,
		c.operationName,
		cursorValues,
	)
	nc.cursorColumns = c.cursorColumns

	for _, s := range subs {
		s.markProcessed()
		nc.subscriptions[s.id] = s
		m.subscriptionIndex[s.id] = keyStr
	}

	m.cohorts[keyStr] = nc

	// Detach polling from the caller's ctx — see addSubscription for the
	// rationale.
	go m.pollCohort(context.Background(), nc) //nolint:contextcheck

	logger.DebugContext(ctx, "created new stream cohort for new subscribers",
		slog.String("cohort_key", keyStr),
		slog.String("cursor_hash", cursorHash),
		slog.Int("count", len(subs)),
	)
}

// shutdown gracefully shuts down all stream cohorts.
func (m *streamCohortManager) shutdown(ctx context.Context) {
	logger := requestcontext.LoggerFromContext(ctx)

	m.mu.Lock()
	defer m.mu.Unlock()

	logger.InfoContext(ctx, "shutting down stream cohort manager",
		slog.Int("cohorts", len(m.cohorts)),
	)

	for _, c := range m.cohorts {
		c.stop()
	}

	m.cohorts = make(map[string]*streamCohort)
	m.subscriptionIndex = make(map[string]string)
}
