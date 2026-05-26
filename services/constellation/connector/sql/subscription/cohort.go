package subscription

import (
	json "encoding/json/v2"
	"maps"
	"sort"
	"strconv"
	"sync"

	"github.com/cespare/xxhash/v2"
	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	sub "github.com/nhost/nhost/services/constellation/subscription"
)

// maxCohortSize is the maximum number of subscriptions per cohort.
const maxCohortSize = 100

// cohortKey uniquely identifies a cohort of subscriptions that can be batched together.
// Subscriptions with the same query, role, and variable values share a cohort.
// Session variables can differ between subscribers (they're per-subscriber in the multiplexed query).
type cohortKey struct {
	// queryHash is the xxhash of the GraphQL query string.
	queryHash string
	// role determines the permissions applied.
	role string
	// operationName from the GraphQL query.
	operationName string
	// variablesHash is the xxhash of the GraphQL variable values.
	// Different variable values (e.g. different limit) produce different SQL,
	// so they must be in separate cohorts.
	variablesHash string
}

func (k cohortKey) String() string {
	return k.role + ":" + k.operationName + ":" + k.queryHash + ":" + k.variablesHash
}

func newCohortKey(query, role, operationName string, variables map[string]any) cohortKey {
	return cohortKey{
		queryHash:     strconv.FormatUint(xxhash.Sum64String(query), 16),
		role:          role,
		operationName: operationName,
		variablesHash: hashVariables(variables),
	}
}

// hashVariables produces a deterministic hash of variable key-value pairs.
func hashVariables(vars map[string]any) string {
	if len(vars) == 0 {
		return ""
	}

	// Sort keys for deterministic ordering.
	keys := make([]string, 0, len(vars))
	for k := range vars {
		keys = append(keys, k)
	}

	sort.Strings(keys)

	h := xxhash.New()

	// xxhash.Digest.Write/WriteString never return an error per its documented
	// contract, so the (_, _) discards are intentional — not lint suppressions.
	for _, k := range keys {
		_, _ = h.WriteString(k)
		_, _ = h.WriteString("=")

		b, _ := json.Marshal(vars[k])
		_, _ = h.Write(b)
		_, _ = h.WriteString(";")
	}

	return strconv.FormatUint(h.Sum64(), 16)
}

// cohortSubscription tracks a subscription within a cohort.
type cohortSubscription struct {
	// id is the unique subscription ID.
	id string
	// sessionVariables are the x-hasura-* variables from the connection.
	sessionVariables map[string]any
	// graphQLVariables are the $limit, $offset, etc. from the subscription.
	graphQLVariables map[string]any
	// lastHash is the xxhash of the last result for change detection.
	lastHash string
	// updateCh is the channel to send updates to.
	updateCh chan sub.Update
	// stopCh is the channel to stop this subscription.
	stopCh chan struct{}
	// sendMu serialises sendUpdate with stop so that closing updateCh
	// never races with a concurrent send.
	sendMu sync.Mutex
	// stopped is guarded by sendMu and flips to true exactly once when
	// stop closes the channels.
	stopped bool
}

func newCohortSubscription(
	id string,
	sessionVars, graphqlVars map[string]any,
) *cohortSubscription {
	return &cohortSubscription{
		id:               id,
		sessionVariables: sessionVars,
		graphQLVariables: graphqlVars,
		lastHash:         "",
		updateCh:         make(chan sub.Update, 1),
		stopCh:           make(chan struct{}),
		sendMu:           sync.Mutex{},
		stopped:          false,
	}
}

func (s *cohortSubscription) updateChannel() <-chan sub.Update {
	return s.updateCh
}

// stop closes the stop and update channels.
// Safe to call concurrently and repeatedly; subsequent calls are no-ops.
func (s *cohortSubscription) stop() {
	s.sendMu.Lock()
	defer s.sendMu.Unlock()

	if s.stopped {
		return
	}

	s.stopped = true
	close(s.stopCh)
	close(s.updateCh)
}

// sendUpdate sends an update to the subscription's channel.
// Returns false if the subscription has been stopped or the buffer cannot
// be claimed.
func (s *cohortSubscription) sendUpdate(update sub.Update) bool {
	s.sendMu.Lock()
	defer s.sendMu.Unlock()

	if s.stopped {
		return false
	}

	// Try to send; if the buffer is full, drain the stale entry and replace
	// with the fresh one so the subscriber always sees the latest data.
	select {
	case s.updateCh <- update:
		return true
	default:
		select {
		case <-s.updateCh:
		default:
		}

		select {
		case s.updateCh <- update:
			return true
		default:
			return false
		}
	}
}

// cohort groups subscriptions with the same query template + role.
// This is used for non-stream (live query) subscriptions.
// For stream subscriptions, use streamCohort instead.
type cohort struct {
	// key uniquely identifies this cohort.
	key cohortKey
	// operation is the parsed GraphQL operation (pre-validated by controller).
	operation *ast.OperationDefinition
	// fragments are the parsed GraphQL fragments (pre-validated by controller).
	fragments ast.FragmentDefinitionList
	// operationName is the GraphQL operation name.
	operationName string
	// cachedOp holds the pre-built SQL operation, computed once on first poll
	// and reused for all subsequent polls. This avoids rebuilding from AST
	// on every polling cycle. Accessed only from the cohort's single poll
	// goroutine, so no synchronisation is needed.
	cachedOp *core.SQLOperation
	// subscriptions maps subscription ID to cohortSubscription.
	subscriptions map[string]*cohortSubscription
	// mu protects access to subscriptions.
	mu sync.RWMutex
	// stopCh signals the cohort to stop polling.
	stopCh chan struct{}
	// stopped indicates if the cohort has been stopped.
	stopped bool
}

func newCohort(
	key cohortKey,
	operation *ast.OperationDefinition,
	fragments ast.FragmentDefinitionList,
	operationName string,
) *cohort {
	return &cohort{
		key:           key,
		operation:     operation,
		fragments:     fragments,
		operationName: operationName,
		cachedOp:      nil,
		subscriptions: make(map[string]*cohortSubscription),
		mu:            sync.RWMutex{},
		stopCh:        make(chan struct{}),
		stopped:       false,
	}
}

func (c *cohort) addSubscription(sub *cohortSubscription) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.subscriptions[sub.id] = sub
}

// removeSubscription removes a subscription from the cohort.
// Returns true if the cohort is now empty.
func (c *cohort) removeSubscription(subID string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()

	if sub, exists := c.subscriptions[subID]; exists {
		sub.stop()
		delete(c.subscriptions, subID)
	}

	return len(c.subscriptions) == 0
}

// size returns the number of subscriptions in the cohort.
func (c *cohort) size() int {
	c.mu.RLock()
	defer c.mu.RUnlock()

	return len(c.subscriptions)
}

// isEmpty returns true if the cohort has no subscriptions.
func (c *cohort) isEmpty() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()

	return len(c.subscriptions) == 0
}

// getSubscriptionsCopy returns a copy of the subscriptions map.
// This is used during polling to avoid holding the lock during query execution.
func (c *cohort) getSubscriptionsCopy() map[string]*cohortSubscription {
	c.mu.RLock()
	defer c.mu.RUnlock()

	cpy := make(map[string]*cohortSubscription, len(c.subscriptions))
	maps.Copy(cpy, c.subscriptions)

	return cpy
}

// stopChannel returns the stop channel for this cohort.
func (c *cohort) stopChannel() <-chan struct{} {
	return c.stopCh
}

// stop closes the stop channel to signal cohort termination.
func (c *cohort) stop() {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.stopped {
		return
	}

	c.stopped = true
	close(c.stopCh)

	// Stop all subscriptions
	for _, sub := range c.subscriptions {
		sub.stop()
	}
}
