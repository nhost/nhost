package subscription

import (
	json "encoding/json/v2"
	"maps"
	"sort"
	"strconv"
	"strings"
	"sync"

	"github.com/cespare/xxhash/v2"
	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

// streamCohortKey uniquely identifies a stream subscription cohort.
// Unlike regular cohorts, stream cohorts include cursor values in the key
// so that subscribers with the same cursor position are batched together.
// As cursors advance, cohorts naturally merge when they reach the same position.
type streamCohortKey struct {
	// queryHash is the xxhash of the GraphQL query string.
	queryHash string
	// role determines the permissions applied.
	role string
	// operationName from the GraphQL query.
	operationName string
	// variablesHash is the xxhash of the GraphQL variable values.
	variablesHash string
	// cursorHash is the xxhash of the serialized cursor values.
	// This allows cohorts with the same cursor position to be merged.
	cursorHash string
}

// String returns a string representation of the stream cohort key.
func (k streamCohortKey) String() string {
	return k.role + ":" + k.operationName + ":" + k.queryHash + ":" + k.variablesHash + ":" + k.cursorHash
}

// newStreamCohortKey creates a new stream cohort key.
func newStreamCohortKey(
	query, role, operationName string,
	variables map[string]any,
	cursorValues map[string]any,
) streamCohortKey {
	return streamCohortKey{
		queryHash:     strconv.FormatUint(xxhash.Sum64String(query), 16),
		role:          role,
		operationName: operationName,
		variablesHash: hashVariables(variables),
		cursorHash:    hashCursorValues(cursorValues),
	}
}

// hashCursorValues creates a deterministic hash of cursor values.
func hashCursorValues(cursorValues map[string]any) string {
	if len(cursorValues) == 0 {
		return ""
	}

	// Sort keys for deterministic ordering
	keys := make([]string, 0, len(cursorValues))
	for k := range cursorValues {
		keys = append(keys, k)
	}

	sort.Strings(keys)

	// Build a deterministic string representation
	var b strings.Builder
	for i, k := range keys {
		if i > 0 {
			b.WriteString(",")
		}

		b.WriteString(k)
		b.WriteString("=")
		// Convert value to JSON for consistent representation
		if v, err := json.Marshal(cursorValues[k]); err == nil {
			b.Write(v)
		}
	}

	return strconv.FormatUint(xxhash.Sum64String(b.String()), 16)
}

// streamCohortSubscription tracks a stream subscription within a cohort.
// It extends cohortSubscription with stream-specific state.
type streamCohortSubscription struct {
	*cohortSubscription

	// initialCursorValues stores the cursor values when this subscription was created.
	// Used to determine if a subscriber arrived during a poll cycle.
	initialCursorValues map[string]any
	// isNew indicates this subscriber was added during the current poll cycle.
	// New subscribers are placed in a separate cohort to receive their initial data.
	isNew bool
}

// newStreamCohortSubscription creates a new stream cohort subscription.
func newStreamCohortSubscription(
	id string,
	sessionVars, graphqlVars map[string]any,
	cursorValues map[string]any,
) *streamCohortSubscription {
	return &streamCohortSubscription{
		cohortSubscription:  newCohortSubscription(id, sessionVars, graphqlVars),
		initialCursorValues: copyCursorValues(cursorValues),
		isNew:               true,
	}
}

// markProcessed marks the subscription as no longer new (has been polled at least once).
func (s *streamCohortSubscription) markProcessed() {
	s.isNew = false
}

// streamCohort groups stream subscriptions with the same query template + role + cursor position.
// Unlike regular cohort, streamCohort includes cursor values in its key and
// the cohort map is rebuilt after each poll to reflect cursor advancement.
type streamCohort struct {
	// key uniquely identifies this cohort (includes cursor position).
	key streamCohortKey
	// queryString is the original GraphQL query string (used for cohort key computation).
	queryString string
	// operation is the parsed GraphQL operation (pre-validated by controller).
	operation *ast.OperationDefinition
	// fragments are the parsed GraphQL fragments (pre-validated by controller).
	fragments ast.FragmentDefinitionList
	// operationName is the GraphQL operation name.
	operationName string
	// cursorValues contains the current cursor position for this cohort.
	cursorValues map[string]any
	// cursorColumns contains the cursor column names in order (for extracting from results).
	cursorColumns []string
	// cachedOp holds the pre-built SQL operation, computed once on first poll
	// and reused on every subsequent poll. Cursor values flow through the
	// multiplexed result_vars and never appear in the SQL string, so the
	// SQL is stable across cursor advancement, cohort merges, and subscriber
	// churn within a cohort (all subscribers share role/variables by key).
	// Accessed only from the cohort's single poll goroutine, so no
	// synchronisation is needed.
	cachedOp *core.SQLOperation
	// subscriptions maps subscription ID to streamCohortSubscription.
	subscriptions map[string]*streamCohortSubscription
	// newSubscriptions holds subscribers that arrived during the current poll cycle.
	// These are kept separate until they're processed in their own cohort.
	newSubscriptions map[string]*streamCohortSubscription
	// mu protects access to subscriptions.
	mu sync.RWMutex
	// stopCh signals the cohort to stop polling.
	stopCh chan struct{}
	// stopped indicates if the cohort has been stopped.
	stopped bool
	// polling indicates if a poll is currently in progress.
	polling bool
}

// newStreamCohort creates a new stream cohort.
func newStreamCohort(
	key streamCohortKey,
	queryString string,
	operation *ast.OperationDefinition,
	fragments ast.FragmentDefinitionList,
	operationName string,
	cursorValues map[string]any,
) *streamCohort {
	return &streamCohort{
		key:              key,
		queryString:      queryString,
		operation:        operation,
		fragments:        fragments,
		operationName:    operationName,
		cursorValues:     copyCursorValues(cursorValues),
		cursorColumns:    nil,
		cachedOp:         nil,
		subscriptions:    make(map[string]*streamCohortSubscription),
		newSubscriptions: make(map[string]*streamCohortSubscription),
		mu:               sync.RWMutex{},
		stopCh:           make(chan struct{}),
		stopped:          false,
		polling:          false,
	}
}

// addSubscription adds a subscription to the cohort.
// If a poll is in progress, the subscription is added to newSubscriptions
// and will be processed in a separate cohort on the next rebuild.
func (c *streamCohort) addSubscription(s *streamCohortSubscription) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.polling {
		// Poll in progress - add to new subscribers
		c.newSubscriptions[s.id] = s
	} else {
		c.subscriptions[s.id] = s
	}
}

// removeSubscription removes a subscription from the cohort.
// Returns true if the cohort is now empty (both subscriptions and newSubscriptions).
func (c *streamCohort) removeSubscription(subID string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()

	if s, exists := c.subscriptions[subID]; exists {
		s.stop()
		delete(c.subscriptions, subID)
	}

	if s, exists := c.newSubscriptions[subID]; exists {
		s.stop()
		delete(c.newSubscriptions, subID)
	}

	return len(c.subscriptions) == 0 && len(c.newSubscriptions) == 0
}

// getSubscription returns a subscription by ID (checks both regular and new).
func (c *streamCohort) getSubscription(subID string) *streamCohortSubscription {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if s, exists := c.subscriptions[subID]; exists {
		return s
	}

	return c.newSubscriptions[subID]
}

// size returns the total number of subscriptions (including new ones).
func (c *streamCohort) size() int {
	c.mu.RLock()
	defer c.mu.RUnlock()

	return len(c.subscriptions) + len(c.newSubscriptions)
}

// isEmpty returns true if the cohort has no subscriptions.
func (c *streamCohort) isEmpty() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()

	return len(c.subscriptions) == 0 && len(c.newSubscriptions) == 0
}

// getSubscriptionsCopy returns a copy of the subscriptions map (excluding new subscribers).
// This is used during polling.
func (c *streamCohort) getSubscriptionsCopy() map[string]*streamCohortSubscription {
	c.mu.RLock()
	defer c.mu.RUnlock()

	cpy := make(map[string]*streamCohortSubscription, len(c.subscriptions))
	maps.Copy(cpy, c.subscriptions)

	return cpy
}

// getNewSubscriptionsCopy returns a copy of the new subscriptions map.
func (c *streamCohort) getNewSubscriptionsCopy() map[string]*streamCohortSubscription {
	c.mu.RLock()
	defer c.mu.RUnlock()

	cpy := make(map[string]*streamCohortSubscription, len(c.newSubscriptions))
	maps.Copy(cpy, c.newSubscriptions)

	return cpy
}

// startPolling marks the cohort as currently polling.
// New subscribers added during this time will be placed in newSubscriptions.
func (c *streamCohort) startPolling() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.polling = true
}

// endPolling marks the cohort as done polling.
// Subscribers buffered in newSubscriptions during the poll are not merged
// here; streamCohortManager.processNewSubscribers extracts them after the
// poll completes so they get an initial-data poll of their own.
func (c *streamCohort) endPolling() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.polling = false
}

// extractNewSubscribers removes and returns all new subscribers.
// Used during cohort map rebuild to place new subscribers in their own cohort.
func (c *streamCohort) extractNewSubscribers() map[string]*streamCohortSubscription {
	c.mu.Lock()
	defer c.mu.Unlock()

	subs := c.newSubscriptions
	c.newSubscriptions = make(map[string]*streamCohortSubscription)

	return subs
}

// clearSubscriptions removes all subscriptions from the cohort without stopping them.
// This is used during cohort merging when subscriptions are moved to another cohort.
func (c *streamCohort) clearSubscriptions() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.subscriptions = make(map[string]*streamCohortSubscription)
	c.newSubscriptions = make(map[string]*streamCohortSubscription)
}

// updateCursor updates the cursor values for this cohort.
func (c *streamCohort) updateCursor(newCursorValues map[string]any) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.cursorValues = copyCursorValues(newCursorValues)
}

// getCursorValues returns a copy of the current cursor values.
func (c *streamCohort) getCursorValues() map[string]any {
	c.mu.RLock()
	defer c.mu.RUnlock()

	return copyCursorValues(c.cursorValues)
}

// stopChannel returns the stop channel for this cohort.
func (c *streamCohort) stopChannel() <-chan struct{} {
	return c.stopCh
}

// stop closes the stop channel to signal cohort termination.
func (c *streamCohort) stop() {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.stopped {
		return
	}

	c.stopped = true
	close(c.stopCh)

	// Stop all subscriptions
	for _, s := range c.subscriptions {
		s.stop()
	}

	for _, s := range c.newSubscriptions {
		s.stop()
	}
}

// copyCursorValues creates a deep copy of cursor values.
func copyCursorValues(src map[string]any) map[string]any {
	if src == nil {
		return nil
	}

	dst := make(map[string]any, len(src))
	maps.Copy(dst, src)

	return dst
}
