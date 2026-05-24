package subscription

import (
	"context"
	"fmt"
	"log/slog"
	"strconv"
	"sync"
	"time"

	"github.com/cespare/xxhash/v2"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/internal/requestcontext"
	sub "github.com/nhost/nhost/services/constellation/subscription"
)

// defaultPollingInterval is the default interval for polling subscriptions.
const defaultPollingInterval = 1 * time.Second

// cohortManager manages cohorts for multiplexed subscription execution.
// This manager handles non-stream (live query) subscriptions.
// For stream subscriptions, use streamCohortManager instead.
type cohortManager struct {
	executor          QueryExecutor
	roots             QueryBuilder
	cohorts           map[string]*cohort
	subscriptionIndex map[string]string // subscription ID -> cohort key (O(1) lookup)
	mu                sync.RWMutex
	pollingInterval   time.Duration
	logger            *slog.Logger
}

// newCohortManager creates a new cohort manager for non-stream subscriptions.
func newCohortManager(
	executor QueryExecutor,
	roots QueryBuilder,
	pollingInterval time.Duration,
	logger *slog.Logger,
) *cohortManager {
	if pollingInterval == 0 {
		pollingInterval = defaultPollingInterval
	}

	if logger == nil {
		logger = slog.Default()
	}

	return &cohortManager{
		executor:          executor,
		roots:             roots,
		cohorts:           make(map[string]*cohort),
		subscriptionIndex: make(map[string]string),
		mu:                sync.RWMutex{},
		pollingInterval:   pollingInterval,
		logger:            logger,
	}
}

// addSubscription adds a subscription to the appropriate cohort.
// It creates a new cohort if none exists for the subscription's query + role.
// Returns the channel for receiving updates.
func (m *cohortManager) addSubscription(
	ctx context.Context,
	req sub.Request,
	logger *slog.Logger,
) (<-chan sub.Update, error) {
	// Compute cohort key (using query string + variables hash for batching).
	// Variable values must be part of the key because they become static SQL
	// parameters shared by all subscribers in the cohort.
	baseKey := newCohortKey(req.QueryString, req.Role, req.OperationName, req.Variables)

	m.mu.Lock()

	c := m.findOrCreateCohort(ctx, baseKey, req, logger)

	// Create and add subscription while still holding the manager lock
	// to prevent races with removeSubscription and pollCohort cleanup.
	cohortSub := newCohortSubscription(
		req.ID,
		req.SessionVariables,
		req.Variables,
	)

	c.addSubscription(cohortSub)
	m.subscriptionIndex[req.ID] = c.key.String()

	m.mu.Unlock()

	logger.DebugContext(ctx, "added subscription to cohort",
		slog.String("subscription_id", req.ID),
		slog.String("cohort_key", c.key.String()),
		slog.Int("cohort_size", c.size()),
	)

	return cohortSub.updateChannel(), nil
}

// findOrCreateCohort walks the overflow chain for baseKey and returns the
// first cohort with available capacity, creating a new one at the next free
// suffix when every existing cohort is full. The manager lock must be held
// by the caller.
func (m *cohortManager) findOrCreateCohort(
	ctx context.Context,
	baseKey cohortKey,
	req sub.Request,
	logger *slog.Logger,
) *cohort {
	for suffix := 0; ; suffix++ {
		key := baseKey
		if suffix > 0 {
			key = m.createOverflowKey(baseKey, suffix)
		}

		keyStr := key.String()

		c, exists := m.cohorts[keyStr]
		if !exists {
			c = newCohort(key, req.Operation, req.Fragments, req.OperationName)
			m.cohorts[keyStr] = c

			// Use background context so polling continues even when the first subscriber disconnects.
			go m.pollCohort(context.Background(), c) //nolint:contextcheck

			if suffix == 0 {
				logger.DebugContext(ctx, "created new cohort",
					slog.String("cohort_key", keyStr),
				)
			} else {
				logger.DebugContext(ctx, "created overflow cohort",
					slog.String("cohort_key", keyStr),
				)
			}

			return c
		}

		if c.size() < maxCohortSize {
			return c
		}
	}
}

// removeSubscription removes a subscription from its cohort.
func (m *cohortManager) removeSubscription(ctx context.Context, subID string) {
	logger := requestcontext.LoggerFromContext(ctx)

	m.mu.Lock()
	defer m.mu.Unlock()

	// O(1) lookup via subscription index.
	keyStr, exists := m.subscriptionIndex[subID]
	if !exists {
		return
	}

	delete(m.subscriptionIndex, subID)

	c, exists := m.cohorts[keyStr]
	if !exists {
		return
	}

	isEmpty := c.removeSubscription(subID)

	logger.DebugContext(ctx, "removed subscription from cohort",
		slog.String("subscription_id", subID),
		slog.String("cohort_key", keyStr),
	)

	if isEmpty {
		c.stop()
		delete(m.cohorts, keyStr)

		logger.DebugContext(ctx, "removed empty cohort",
			slog.String("cohort_key", keyStr),
		)
	}
}

// createOverflowKey creates a new key for overflow cohorts.
func (m *cohortManager) createOverflowKey(key cohortKey, suffix int) cohortKey {
	return cohortKey{
		queryHash:     key.queryHash,
		role:          key.role,
		operationName: key.operationName + "_overflow_" + strconv.Itoa(suffix),
		variablesHash: key.variablesHash,
	}
}

// pollCohort runs the polling loop for a cohort.
func (m *cohortManager) pollCohort(ctx context.Context, c *cohort) {
	logger := m.logger

	ticker := time.NewTicker(m.pollingInterval)
	defer ticker.Stop()

	logger.DebugContext(ctx, "started polling cohort",
		slog.String("cohort_key", c.key.String()),
	)

	// Execute immediately on start
	m.executeAndNotifyCohort(ctx, c, logger)

	// Polling runs under context.Background() (see findOrCreateCohort), so
	// ctx.Done() can never fire here — termination always comes through
	// c.stopChannel() (Handler.Shutdown or the empty-cohort cleanup below).
	for {
		select {
		case <-c.stopChannel():
			logger.DebugContext(ctx, "cohort polling stopped",
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

				c.stop()

				return
			}

			m.mu.Unlock()

			m.executeAndNotifyCohort(ctx, c, logger)
		}
	}
}

// executeAndNotifyCohort executes the multiplexed query and sends results.
func (m *cohortManager) executeAndNotifyCohort(
	ctx context.Context,
	c *cohort,
	logger *slog.Logger,
) {
	subscriptions := c.getSubscriptionsCopy()
	if len(subscriptions) == 0 {
		logger.Debug("no subscriptions in cohort, skipping")
		return
	}

	subIDs, sessionVarArrays := buildSubscriberInputs(subscriptions)

	op, err := m.getOrBuildSQL(c, sessionVarArrays, subscriptions, logger)
	if err != nil {
		logger.ErrorContext(ctx, "failed to build subscription SQL",
			slog.String("cohort_key", c.key.String()),
			slog.String("error", err.Error()),
		)
		broadcastError(subscriptions, err)

		return
	}

	results, err := m.executor.ExecuteMultiplexedQuery(ctx, op, subIDs, sessionVarArrays, logger)
	if err != nil {
		wrapped := fmt.Errorf("executing subscription poll: %w", err)

		logger.ErrorContext(ctx, "failed to execute multiplexed query",
			slog.String("cohort_key", c.key.String()),
			slog.String("error", wrapped.Error()),
		)
		broadcastError(subscriptions, wrapped)

		return
	}

	distributeResults(results, subscriptions)
}

// buildSubscriberInputs assembles the per-subscriber subscription-ID list and
// session-variable arrays used by the multiplexed executor. GraphQL variables
// are identical within a cohort (enforced by the cohort key) and are baked
// into the cached SQL operation, so they are not collected per subscriber.
func buildSubscriberInputs(
	subscriptions map[string]*cohortSubscription,
) ([]string, map[string][]any) {
	subIDs := make([]string, 0, len(subscriptions))
	sessionVarArrays := make(map[string][]any)

	for _, s := range subscriptions {
		subIDs = append(subIDs, s.id)

		for varName, varValue := range s.sessionVariables {
			if _, exists := sessionVarArrays[varName]; !exists {
				sessionVarArrays[varName] = make([]any, 0, len(subscriptions))
			}

			sessionVarArrays[varName] = append(sessionVarArrays[varName], varValue)
		}
	}

	return subIDs, sessionVarArrays
}

// broadcastError sends the same error to every subscriber in the cohort.
func broadcastError(subscriptions map[string]*cohortSubscription, err error) {
	for _, s := range subscriptions {
		s.sendUpdate(sub.NewUpdateError(s.id, err))
	}
}

// distributeResults demultiplexes the per-subscription results and dispatches
// each one, skipping subscribers whose previous payload hash is unchanged.
func distributeResults(
	results []MultiplexedResult,
	subscriptions map[string]*cohortSubscription,
) {
	for _, result := range results {
		s, exists := subscriptions[result.SubscriptionID]
		if !exists {
			continue
		}

		hash := computeDataHash(result.Data)
		if hash == s.lastHash {
			continue
		}

		if s.sendUpdate(sub.NewUpdateData(s.id, result.Data)) {
			s.lastHash = hash
		}
	}
}

// getOrBuildSQL returns the cached SQL operation or builds and caches it on first call.
// The SQL is stable per cohort because the query, role, and variable values are fixed
// by the cohort key. Only session variable NAMES are needed to generate the correct
// permission-check expressions.
func (m *cohortManager) getOrBuildSQL(
	c *cohort,
	sessionVarArrays map[string][]any,
	subscriptions map[string]*cohortSubscription,
	logger *slog.Logger,
) (core.SQLOperation, error) {
	if c.cachedOp != nil {
		return *c.cachedOp, nil
	}

	// Build template session vars (names only — values don't affect SQL shape).
	templateSessionVars := make(map[string]any, len(sessionVarArrays))
	for varName := range sessionVarArrays {
		templateSessionVars[varName] = varName
	}

	// Use any subscriber's GraphQL variables — they're identical within a cohort.
	var graphQLVars map[string]any
	for _, s := range subscriptions {
		graphQLVars = s.graphQLVariables

		break
	}

	operations, err := m.roots.BuildQuery(
		c.operation,
		c.fragments,
		graphQLVars,
		c.key.role,
		templateSessionVars,
	)
	if err != nil {
		// Wrap with ErrInvalidSubscription so the protocol layer can surface the
		// actionable plan-failure verbatim instead of collapsing it into an
		// opaque "internal server error". Live-query plan failures only surface
		// here (the build is lazy and runs inside the polling goroutine), so
		// the wrap is the only signal forwardUpdates has to distinguish a
		// client-actionable error from a driver/runtime fault.
		return core.SQLOperation{}, fmt.Errorf(
			"%w: failed to build subscription SQL: %w",
			sub.ErrInvalidSubscription,
			err,
		)
	}

	if len(operations) == 0 {
		return core.SQLOperation{}, fmt.Errorf(
			"%w: no operations generated from subscription",
			sub.ErrInvalidSubscription,
		)
	}

	op := operations[0]
	c.cachedOp = &op

	logger.Debug("built and cached subscription SQL",
		slog.String("cohort_key", c.key.String()),
	)

	return op, nil
}

// shutdown gracefully shuts down all cohorts.
func (m *cohortManager) shutdown(ctx context.Context) {
	logger := requestcontext.LoggerFromContext(ctx)

	m.mu.Lock()
	defer m.mu.Unlock()

	logger.InfoContext(ctx, "shutting down cohort manager",
		slog.Int("cohorts", len(m.cohorts)),
	)

	for _, c := range m.cohorts {
		c.stop()
	}

	m.cohorts = make(map[string]*cohort)
	m.subscriptionIndex = make(map[string]string)
}

// computeDataHash computes an xxhash of the data for change detection.
func computeDataHash(data []byte) string {
	return strconv.FormatUint(xxhash.Sum64(data), 16)
}
