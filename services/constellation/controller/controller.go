// Package controller orchestrates GraphQL request execution across one or more
// connectors. It owns the HTTP and WebSocket entry points, the per-role
// schema/connector snapshot (rebuilt atomically on metadata reload), the LRU
// query cache, and the planner/resolver pair that handles cross-connector
// relationships.
//
// The package's single source of truth is the atomic.Pointer[controllerState]
// on Controller: every request loads it once and uses that snapshot for its
// lifetime. Reloads build a fresh state and swap the pointer; old states are
// shut down in the background once no in-flight request still holds them.
//
// Subpackages: planner (compile-time analysis), resolver (run-time stitching),
// middleware (auth and session extraction), introspection (__schema/__type),
// websocket (graphql-transport-ws protocol layer), relationships
// (metadata→planner relationship translation).
package controller

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"sync/atomic"
	"time"

	"github.com/nhost/nhost/services/constellation/connector"
	"github.com/nhost/nhost/services/constellation/connector/composer"
	"github.com/nhost/nhost/services/constellation/controller/middleware"
	"github.com/nhost/nhost/services/constellation/controller/planner"
	"github.com/nhost/nhost/services/constellation/controller/relationships"
	"github.com/nhost/nhost/services/constellation/controller/resolver"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/nhost/nhost/services/constellation/metadata/source"
	"github.com/nhost/nhost/services/constellation/subscription"
	"github.com/vektah/gqlparser/v2/ast"
)

const shutdownTimeout = 30 * time.Second

// subscriptionCapableConnector is the optional interface a connector satisfies
// when it can serve GraphQL subscriptions. buildState probes each connector
// for this interface via type assertion: connectors that implement it get a
// subscription handler registered; the rest are skipped silently.
// NewSubscriptionHandler may return nil to report that the connector advertises
// the capability but cannot serve it for this instance (e.g. a customization
// wrapper around a non-subscription connector); buildState skips nil handlers.
type subscriptionCapableConnector interface {
	connector.Connector
	NewSubscriptionHandler(pollingInterval time.Duration, logger *slog.Logger) subscription.Handler
}

// controllerState holds all mutable state that is rebuilt on metadata changes.
// Handler methods load a snapshot via c.state.Load() once per request so they
// see a consistent view even while a reload is in progress.
type controllerState struct {
	validatedSchemas           map[string]*ast.Schema
	connectors                 map[string]connector.Connector
	fieldToConnector           map[string]string
	metadata                   *metadata.Metadata
	remoteRelationshipResolver *resolver.RemoteRelationshipResolver
	queryPlanner               *planner.QueryPlanner
	subHandlers                map[string]subscription.Handler
	queryCache                 *queryCache
	// inconsistencies is the snapshot of per-source / per-role build failures
	// recorded by the metadata reload that produced this state. Captured once
	// at build time; the next reload produces a fresh snapshot.
	inconsistencies []metadata.Inconsistency
	// done is closed when this state is shut down (metadata reload or server stop).
	// WebSocket connections select on this to close when the state becomes stale.
	done chan struct{}
}

// newControllerState assembles a controllerState with the always-zero
// invariants (done channel + query cache) initialised once. Centralising
// construction here means new fields land in one place rather than the two
// existing call sites (buildState and NewFromConnectors).
func newControllerState(
	validatedSchemas map[string]*ast.Schema,
	connectors map[string]connector.Connector,
	fieldToConnector map[string]string,
	meta *metadata.Metadata,
	queryPlanner *planner.QueryPlanner,
	subHandlers map[string]subscription.Handler,
	inconsistencies []metadata.Inconsistency,
) *controllerState {
	return &controllerState{
		validatedSchemas:           validatedSchemas,
		connectors:                 connectors,
		fieldToConnector:           fieldToConnector,
		metadata:                   meta,
		remoteRelationshipResolver: resolver.New(connectors),
		queryPlanner:               queryPlanner,
		subHandlers:                subHandlers,
		queryCache:                 newQueryCache(),
		inconsistencies:            inconsistencies,
		done:                       make(chan struct{}),
	}
}

// shutdown gracefully stops all subscription handlers and signals
// WebSocket connections using this state to close.
func (s *controllerState) shutdown(ctx context.Context) {
	close(s.done)

	for _, handler := range s.subHandlers {
		if handler != nil {
			handler.Shutdown(ctx)
		}
	}
}

// closeConnectors closes all connectors, releasing their resources.
func (s *controllerState) closeConnectors() {
	for _, conn := range s.connectors {
		conn.Close()
	}
}

// Controller is the top-level orchestrator. Immutable configuration lives
// directly on the struct; everything that gets rebuilt on metadata changes
// is behind an atomic pointer.
type Controller struct {
	state           atomic.Pointer[controllerState]
	adminSecret     string
	jwtAuth         middleware.JWTAuthenticator
	pollingInterval time.Duration
	logger          *slog.Logger
	// devMode, when true, returns raw connector/database error detail to
	// clients instead of the sanitized generic message (Hasura
	// HASURA_GRAPHQL_DEV_MODE parity). Never enable in production.
	devMode bool

	source metadata.Source

	// store is the in-process mutable metadata snapshot used by the
	// /v1/metadata mutation dispatcher. Nil for file-source deployments;
	// mutations then fall through to the Hasura upstream proxy (or return
	// `not-supported` when no proxy is configured).
	store *source.Store

	// version is the build-time version string surfaced by the GetVersion
	// OpenAPI handler.
	version string

	// hasuraProxy is the per-op fallback used inside the /v1/metadata
	// dispatcher (any metadata op not yet migrated). Nil when no upstream
	// is configured — unknown ops then return `not-supported`.
	hasuraProxy http.Handler

	// connectorOpts are the immutable connector-build options (e.g. async
	// action-log configuration) reapplied on every metadata reload so the
	// rebuilt state keeps the same runtime wiring as the initial build.
	connectorOpts []connector.Option
}

// New constructs a Controller, performing the initial metadata load and
// state build synchronously. Callers must invoke Run on a goroutine to
// apply subsequent metadata updates.
func New(
	ctx context.Context,
	subscriptionPollInterval time.Duration,
	adminSecret string,
	devMode bool,
	jwtAuth middleware.JWTAuthenticator,
	source metadata.Source,
	store *source.Store,
	logger *slog.Logger,
	version string,
	hasuraProxy http.Handler,
	connectorOpts ...connector.Option,
) (*Controller, error) {
	meta, err := source.InitialLoad(ctx)
	if err != nil {
		return nil, fmt.Errorf("initial metadata load: %w", err)
	}

	state, err := buildState(ctx, meta, subscriptionPollInterval, logger, connectorOpts...)
	if err != nil {
		return nil, fmt.Errorf("building initial state: %w", err)
	}

	logInconsistencySummary(ctx, logger, state.inconsistencies)

	ctrl := &Controller{
		state:           atomic.Pointer[controllerState]{},
		adminSecret:     adminSecret,
		jwtAuth:         jwtAuth,
		pollingInterval: subscriptionPollInterval,
		logger:          logger,
		devMode:         devMode,
		source:          source,
		store:           store,
		version:         version,
		hasuraProxy:     hasuraProxy,
		connectorOpts:   connectorOpts,
	}
	ctrl.state.Store(state)

	return ctrl, nil
}

// Inconsistencies returns the partial-failure entries recorded during the
// most recent successful metadata build. The returned slice is a snapshot;
// it does not reflect later reloads.
func (c *Controller) Inconsistencies() []metadata.Inconsistency {
	state := c.state.Load()
	if state == nil {
		return nil
	}

	return state.inconsistencies
}

// logInconsistencySummary emits a single summary log line after a build so
// operators see the count even when individual Record calls scrolled past.
// No-op when there are no inconsistencies.
func logInconsistencySummary(
	ctx context.Context, logger *slog.Logger, inc []metadata.Inconsistency,
) {
	if len(inc) == 0 {
		return
	}

	logger.WarnContext(
		ctx, "metadata loaded with inconsistencies",
		slog.Int("count", len(inc)),
	)
}

// buildState constructs a new controllerState from metadata. This is called
// both at startup and on every metadata reload. Per-source and per-role
// build failures are recorded as inconsistencies on the returned state rather
// than aborting; the function only returns an error if the build cannot
// produce any usable state at all.
func buildState(
	ctx context.Context,
	meta *metadata.Metadata,
	subscriptionPollInterval time.Duration,
	logger *slog.Logger,
	connectorOpts ...connector.Option,
) (*controllerState, error) {
	built, err := connector.BuildConnectorsFromMetadata(ctx, meta, logger, connectorOpts...)
	if err != nil {
		return nil, fmt.Errorf("failed to build connectors from metadata: %w", err)
	}

	// Create subscription handlers for all subscription-capable connectors.
	// A nil handler means the connector reports the capability but cannot
	// actually serve it (e.g. a customization wrapper around a remote schema),
	// so it is skipped rather than registered.
	subHandlers := make(map[string]subscription.Handler)
	for dbName, conn := range built.Connectors {
		subCapable, ok := conn.(subscriptionCapableConnector)
		if !ok {
			continue
		}

		if handler := subCapable.NewSubscriptionHandler(
			subscriptionPollInterval,
			logger,
		); handler != nil {
			subHandlers[dbName] = handler
		}
	}

	// Build planner relationships from metadata index
	connectorRelationships := relationships.FromMetadata(meta, built.Connectors)

	// Create query planner
	queryPlanner := planner.New(
		built.ValidatedSchemas,
		built.FieldToConnector,
		built.TypeToConnectors,
		connectorRelationships,
	)

	return newControllerState(
		built.ValidatedSchemas,
		built.Connectors,
		built.FieldToConnector,
		meta,
		queryPlanner,
		subHandlers,
		built.Inconsistencies,
	), nil
}

// Run consumes metadata updates from the source and reloads state. It returns
// when the source channel closes or ctx is cancelled. In serve.go the
// deferred cancel() ensures the rest of the process shuts down.
func (c *Controller) Run(
	ctx context.Context,
	logger *slog.Logger,
) {
	defer c.shutdownState(ctx, logger)

	for update := range c.source.Watch(ctx) {
		if update.Err != nil {
			logger.ErrorContext(
				ctx, "metadata reload failed, keeping current state", "error", update.Err,
			)

			continue
		}

		newState, err := buildState(ctx, update.Metadata, c.pollingInterval, logger, c.connectorOpts...)
		if err != nil {
			logger.ErrorContext(ctx, "failed to rebuild controller state", "error", err)

			continue
		}

		logInconsistencySummary(ctx, logger, newState.inconsistencies)
		c.swapState(ctx, newState, logger)
	}
}

// swapState atomically replaces the current state and shuts down the
// old one in the background.
func (c *Controller) swapState(
	ctx context.Context, newState *controllerState, logger *slog.Logger,
) {
	oldState := c.state.Swap(newState)

	logger.Info("metadata reloaded successfully")

	go func() {
		shutdownCtx, cancel := context.WithTimeout(ctx, shutdownTimeout)
		defer cancel()

		oldState.shutdown(shutdownCtx)
		oldState.closeConnectors()
	}()
}

// shutdownState tears down the current state on controller exit.
func (c *Controller) shutdownState(ctx context.Context, logger *slog.Logger) {
	logger.InfoContext(ctx, "shutting down controller")

	state := c.state.Load()
	state.shutdown(ctx)
	state.closeConnectors()
}

// NewFromConnectors builds a Controller around an already-constructed set of
// connectors, skipping the metadata-driven connector-building step that New
// performs. Use this when the caller owns connector construction directly
// (programmatic embedding, in-process composition, benchmarking). The result
// has no metadata source attached: there is no reload loop, and Run is a
// no-op. Pass nil for relationships when no cross-connector relationships
// apply.
func NewFromConnectors(
	adminSecret string,
	connectors map[string]connector.Connector,
	relationships map[string][]*planner.RelationshipMetadata,
	logger *slog.Logger,
) (*Controller, error) {
	providers := make(map[string]composer.SchemaProvider, len(connectors))
	for name, c := range connectors {
		providers[name] = c
	}

	composed := composer.New(providers, &metadata.Metadata{
		Databases:     nil,
		RemoteSchemas: nil,
	}, nil).Compose(context.Background(), logger)

	queryPlanner := planner.New(
		composed.ValidatedSchemas,
		composed.FieldToConnector,
		composed.TypeToConnectors,
		relationships,
	)

	state := newControllerState(
		composed.ValidatedSchemas,
		connectors,
		composed.FieldToConnector,
		&metadata.Metadata{Databases: nil, RemoteSchemas: nil},
		queryPlanner,
		nil,
		nil,
	)

	ctrl := &Controller{
		adminSecret:     adminSecret,
		jwtAuth:         middleware.NewNoOpJWTAuthenticator(),
		pollingInterval: 0,
		logger:          logger,
		devMode:         false,
		source:          nil,
		store:           nil,
		hasuraProxy:     nil,
		version:         "",
		state:           atomic.Pointer[controllerState]{},
	}
	ctrl.state.Store(state)

	return ctrl, nil
}
