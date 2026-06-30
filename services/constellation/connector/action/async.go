package action

import (
	"bytes"
	"context"
	json "encoding/json/v2"
	"errors"
	"fmt"
	"log/slog"
	"maps"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/nhost/nhost/services/constellation/internal/requestcontext"
	"github.com/nhost/nhost/services/constellation/subscription"
	"github.com/vektah/gqlparser/v2/ast"
)

const (
	asyncScalarUUID        = "uuid"
	asyncScalarTimestamptz = "timestamptz"
	asyncScalarJSONB       = "json"

	defaultAsyncPollInterval     = time.Second
	defaultAsyncBatchSize        = 10
	defaultAsyncMaxConcurrency   = 4
	defaultAsyncShutdownTimeout  = 5 * time.Second
	asyncErrorCodeActionInternal = "unexpected"
)

// LogStatus identifies the Hasura-compatible action-log lifecycle state.
type LogStatus string

const (
	// LogStatusCreated is an enqueued action that no worker has claimed.
	LogStatusCreated LogStatus = "created"
	// LogStatusProcessing is an action claimed by a worker.
	LogStatusProcessing LogStatus = "processing"
	// LogStatusCompleted is an action whose webhook returned a 2xx payload.
	LogStatusCompleted LogStatus = "completed"
	// LogStatusError is an action whose webhook failed or returned a 4xx payload.
	LogStatusError LogStatus = "error"
)

var (
	// ErrActionLogStaleClaim reports that a worker tried to finish a log row that
	// is no longer in the processing state it claimed.
	ErrActionLogStaleClaim = errors.New("action log claim is no longer current")

	errActionLogIDMissing              = errors.New("missing id argument")
	errAsyncActionUnsupportedOperation = errors.New("unsupported async action operation")
	errAsyncSubscriptionHandlerClosed  = errors.New(
		"async action subscription handler is shut down",
	)
)

// ActionLogInsert is the data persisted when an asynchronous action mutation is
// accepted.
type ActionLogInsert struct { //nolint:revive // Matches the Hasura action-log boundary named in the phase plan.
	ActionName       string
	InputPayload     map[string]any
	RequestHeaders   http.Header
	SessionVariables map[string]any
}

// ActionLogEntry is one persisted asynchronous action-log row.
type ActionLogEntry struct { //nolint:revive // Matches the Hasura action-log boundary named in the phase plan.
	ID                 uuid.UUID
	ActionName         string
	InputPayload       map[string]any
	RequestHeaders     http.Header
	SessionVariables   map[string]any
	ResponsePayload    []byte
	Errors             []byte
	CreatedAt          time.Time
	ResponseReceivedAt *time.Time
	Status             LogStatus
}

// ActionLogStore abstracts Hasura-compatible asynchronous action-log
// persistence. Implementations own concurrency control for claiming rows; the
// action connector owns GraphQL shaping and webhook execution.
//
//go:generate mockgen -package mock -destination mock/action_log_store.go . ActionLogStore
type ActionLogStore interface { //nolint:revive // Required external-boundary name for async action logs.
	Insert(ctx context.Context, entry ActionLogInsert) (ActionLogEntry, error)
	ClaimPending(ctx context.Context, limit int) ([]ActionLogEntry, error)
	// Complete records a successful webhook response for a claimed row.
	// Implementations must tolerate an empty or non-JSON responsePayload
	// (an empty 2xx body becomes JSON null; non-JSON is stored as a JSON
	// string) so a webhook response never strands the row in 'processing'.
	Complete(ctx context.Context, id uuid.UUID, responsePayload []byte) error
	Fail(ctx context.Context, id uuid.UUID, errorsPayload []byte) error
	Get(ctx context.Context, id uuid.UUID) (ActionLogEntry, bool, error)
	RequeueProcessing(ctx context.Context, ids []uuid.UUID) error
	Close()
}

// AsyncConfig configures asynchronous action storage and optional worker
// execution for an action connector.
type AsyncConfig struct {
	Store             ActionLogStore
	CloseStore        bool
	UnavailableReason string
	WorkerEnabled     bool
	PollInterval      time.Duration
	BatchSize         int
	MaxConcurrency    int
	ShutdownTimeout   time.Duration
}

func (cfg AsyncConfig) withDefaults() AsyncConfig {
	if cfg.PollInterval <= 0 {
		cfg.PollInterval = defaultAsyncPollInterval
	}

	if cfg.BatchSize <= 0 {
		cfg.BatchSize = defaultAsyncBatchSize
	}

	if cfg.MaxConcurrency <= 0 {
		cfg.MaxConcurrency = defaultAsyncMaxConcurrency
	}

	if cfg.ShutdownTimeout <= 0 {
		cfg.ShutdownTimeout = defaultAsyncShutdownTimeout
	}

	return cfg
}

type asyncWorker struct {
	connector       *Connector
	store           ActionLogStore
	pollInterval    time.Duration
	batchSize       int
	shutdownTimeout time.Duration
	logger          *slog.Logger

	stop     chan struct{}
	done     chan struct{}
	sem      chan struct{}
	closeOne sync.Once

	inFlightMu      sync.Mutex
	inFlightCancels map[uuid.UUID]context.CancelFunc
	inFlightWG      sync.WaitGroup
}

func newAsyncWorker(connector *Connector, cfg AsyncConfig, logger *slog.Logger) *asyncWorker {
	cfg = cfg.withDefaults()

	return &asyncWorker{
		connector:       connector,
		store:           cfg.Store,
		pollInterval:    cfg.PollInterval,
		batchSize:       cfg.BatchSize,
		shutdownTimeout: cfg.ShutdownTimeout,
		logger:          logger,
		stop:            make(chan struct{}),
		done:            make(chan struct{}),
		sem:             make(chan struct{}, cfg.MaxConcurrency),
		closeOne:        sync.Once{},
		inFlightMu:      sync.Mutex{},
		inFlightCancels: make(map[uuid.UUID]context.CancelFunc),
		inFlightWG:      sync.WaitGroup{},
	}
}

func (w *asyncWorker) start(ctx context.Context) {
	go w.run(ctx)
}

func (w *asyncWorker) run(ctx context.Context) {
	defer close(w.done)

	w.claimAndDispatch(ctx)

	ticker := time.NewTicker(w.pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-w.stop:
			return
		case <-ticker.C:
			w.claimAndDispatch(ctx)
		}
	}
}

func (w *asyncWorker) claimAndDispatch(ctx context.Context) {
	entries, err := w.store.ClaimPending(ctx, w.batchSize)
	if err != nil {
		if w.logger != nil {
			w.logger.ErrorContext(
				ctx,
				"claiming async action logs",
				slog.String("error", err.Error()),
			)
		}

		return
	}

	for i, entry := range entries {
		select {
		case <-ctx.Done():
			// The run context is canceled on hard shutdown, so requeue the
			// claimed-but-not-yet-dispatched entries on a detached, bounded
			// context; using the canceled ctx would fail RequeueProcessing and
			// strand those rows in 'processing' forever (ClaimPending only
			// reclaims status='created').
			w.requeueDetached(ctx, actionLogIDs(entries[i:]))

			return
		case <-w.stop:
			w.requeueDetached(ctx, actionLogIDs(entries[i:]))

			return
		case w.sem <- struct{}{}:
			w.inFlightWG.Add(1)

			go w.process(ctx, entry)
		}
	}
}

func actionLogIDs(entries []ActionLogEntry) []uuid.UUID {
	ids := make([]uuid.UUID, 0, len(entries))
	for _, entry := range entries {
		ids = append(ids, entry.ID)
	}

	return ids
}

func (w *asyncWorker) process( //nolint:funlen // Keeps async lifecycle/error persistence ordering explicit.
	parent context.Context,
	entry ActionLogEntry,
) {
	defer func() {
		<-w.sem
		w.inFlightWG.Done()
	}()

	runtime, ok := w.connector.actions[entry.ActionName]
	if !ok || !runtime.async {
		w.persistWorkerError(
			parent,
			entry.ID,
			fmt.Sprintf("asynchronous action %q is not available", entry.ActionName),
		)

		return
	}

	ctx, cancel := context.WithTimeout(context.WithoutCancel(parent), runtime.timeout)
	ctx, closeCancel := context.WithCancel(ctx)

	defer cancel()
	defer closeCancel()

	w.addInFlight(entry.ID, closeCancel)
	defer w.removeInFlight(entry.ID)

	body, status, err := w.connector.executeRuntimeActionWithInput(
		ctx,
		runtime,
		entry.InputPayload,
		entry.SessionVariables,
		entry.RequestHeaders,
	)
	if errors.Is(ctx.Err(), context.Canceled) {
		w.requeue(context.WithoutCancel(parent), []uuid.UUID{entry.ID})

		return
	}

	storeCtx, storeCancel := w.storeContext(parent)
	defer storeCancel()

	if err != nil {
		w.persistWorkerError(storeCtx, entry.ID, "executing asynchronous action failed")

		return
	}

	switch {
	case status >= http.StatusOK && status < http.StatusMultipleChoices:
		if err := w.store.Complete(storeCtx, entry.ID, body); err != nil &&
			!errors.Is(err, ErrActionLogStaleClaim) {
			w.logWorkerError(storeCtx, "persisting async action response", err)
		}
	case status >= http.StatusBadRequest && status < http.StatusInternalServerError:
		actionErr, parseErr := actionErrorFromBody(body, []any{"output"})
		if parseErr != nil {
			w.persistWorkerError(storeCtx, entry.ID, "parsing asynchronous action error failed")

			return
		}

		w.persistGraphQLErrors(storeCtx, entry.ID, []map[string]any{actionErr})
	default:
		w.persistWorkerError(
			storeCtx,
			entry.ID,
			"asynchronous action handler returned an error status",
		)
	}
}

func (w *asyncWorker) Close(ctx context.Context) {
	w.closeOne.Do(func() {
		close(w.stop)
		<-w.done

		if w.waitInFlight(w.shutdownTimeout) {
			return
		}

		ids := w.cancelInFlight()
		if len(ids) > 0 {
			w.requeue(ctx, ids)
		}

		w.waitInFlight(time.Second)
	})
}

func (w *asyncWorker) storeContext(parent context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.WithoutCancel(parent), w.shutdownTimeout)
}

func (w *asyncWorker) addInFlight(id uuid.UUID, cancel context.CancelFunc) {
	w.inFlightMu.Lock()
	defer w.inFlightMu.Unlock()

	w.inFlightCancels[id] = cancel
}

func (w *asyncWorker) removeInFlight(id uuid.UUID) {
	w.inFlightMu.Lock()
	defer w.inFlightMu.Unlock()

	delete(w.inFlightCancels, id)
}

func (w *asyncWorker) cancelInFlight() []uuid.UUID {
	w.inFlightMu.Lock()
	defer w.inFlightMu.Unlock()

	ids := make([]uuid.UUID, 0, len(w.inFlightCancels))
	for id, cancel := range w.inFlightCancels {
		ids = append(ids, id)

		cancel()
	}

	return ids
}

func (w *asyncWorker) waitInFlight(timeout time.Duration) bool {
	done := make(chan struct{})
	go func() {
		w.inFlightWG.Wait()
		close(done)
	}()

	select {
	case <-done:
		return true
	case <-time.After(timeout):
		return false
	}
}

func (w *asyncWorker) requeue(ctx context.Context, ids []uuid.UUID) {
	if err := w.store.RequeueProcessing(ctx, ids); err != nil {
		w.logWorkerError(ctx, "requeueing async action logs", err)
	}
}

// requeueDetached requeues ids on a fresh, bounded context derived from parent
// (mirroring storeContext) so a canceled parent — e.g. the run context on hard
// shutdown — does not abort the requeue and strand rows in 'processing'.
func (w *asyncWorker) requeueDetached(parent context.Context, ids []uuid.UUID) {
	if len(ids) == 0 {
		return
	}

	ctx, cancel := w.storeContext(parent)
	defer cancel()

	w.requeue(ctx, ids)
}

func (w *asyncWorker) persistWorkerError(ctx context.Context, id uuid.UUID, message string) {
	w.persistGraphQLErrors(ctx, id, []map[string]any{newSingleGraphQLError(
		message,
		nil,
		map[string]any{"code": asyncErrorCodeActionInternal},
	)})
}

func (w *asyncWorker) persistGraphQLErrors(
	ctx context.Context,
	id uuid.UUID,
	errs []map[string]any,
) {
	payload, err := json.Marshal(errs)
	if err != nil {
		w.logWorkerError(ctx, "marshaling async action errors", err)

		return
	}

	if err := w.store.Fail(ctx, id, payload); err != nil &&
		!errors.Is(err, ErrActionLogStaleClaim) {
		w.logWorkerError(ctx, "persisting async action errors", err)
	}
}

func (w *asyncWorker) logWorkerError(ctx context.Context, message string, err error) {
	if w.logger != nil {
		w.logger.ErrorContext(ctx, message, slog.String("error", err.Error()))
	}
}

func (c *Connector) asyncMutationResult(
	ctx context.Context,
	runtime runtimeAction,
	field *ast.Field,
	_ ast.FragmentDefinitionList,
	variables map[string]any,
	sessionVariables map[string]any,
	clientHeaders http.Header,
) (string, any, []map[string]any, error) {
	responseKey := responseFieldName(field)

	input, err := actionInput(field, variables)
	if err != nil {
		return responseKey, nil, nil, fmt.Errorf(
			"building input for action %q: %w",
			field.Name,
			err,
		)
	}

	entry, err := c.asyncStore.Insert(ctx, ActionLogInsert{
		ActionName:       runtime.name,
		InputPayload:     input,
		RequestHeaders:   cloneHeader(clientHeaders),
		SessionVariables: cloneAnyMap(sessionVariables),
	})
	if err != nil {
		return responseKey, nil, nil, fmt.Errorf(
			"inserting async action log for %q: %w",
			runtime.name,
			err,
		)
	}

	return responseKey, entry.ID.String(), nil, nil
}

func (c *Connector) asyncStoredResult(
	ctx context.Context,
	runtime runtimeAction,
	field *ast.Field,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
) (string, any, []map[string]any, error) {
	responseKey := responseFieldName(field)

	id, err := actionLogIDArg(field, variables)
	if err != nil {
		return responseKey, nil, nil, fmt.Errorf(
			"resolving async action id for %q: %w",
			runtime.name,
			err,
		)
	}

	entry, ok, err := c.asyncStore.Get(ctx, id)
	if err != nil {
		return responseKey, nil, nil, fmt.Errorf("loading async action log %s: %w", id, err)
	}

	if !ok || !c.canAccessActionLog(runtime, role, sessionVariables, entry) {
		return responseKey, nil, nil, nil
	}

	return c.shapeAsyncEntry(responseKey, field, fragments, entry)
}

func actionLogIDArg(field *ast.Field, variables map[string]any) (uuid.UUID, error) {
	if field == nil {
		return uuid.Nil, errActionOperationNil
	}

	arg := field.Arguments.ForName("id")
	if arg == nil {
		return uuid.Nil, errActionLogIDMissing
	}

	value, err := arg.Value.Value(variables)
	if err != nil {
		return uuid.Nil, fmt.Errorf("resolving id argument: %w", err)
	}

	id, err := uuid.Parse(fmt.Sprint(value))
	if err != nil {
		return uuid.Nil, fmt.Errorf("parsing id argument: %w", err)
	}

	return id, nil
}

func (c *Connector) shapeAsyncEntry(
	responseKey string,
	field *ast.Field,
	fragments ast.FragmentDefinitionList,
	entry ActionLogEntry,
) (string, any, []map[string]any, error) {
	model, err := asyncEntryResultModel(entry)
	if err != nil {
		return responseKey, nil, nil, fmt.Errorf("building async action result: %w", err)
	}

	shaped, errs := c.shapeRootField(field, fragments, model)

	return responseKey, shaped, errs, nil
}

func asyncEntryResultModel(entry ActionLogEntry) (map[string]any, error) {
	var output any
	if len(entry.ResponsePayload) > 0 {
		if err := json.Unmarshal(entry.ResponsePayload, &output); err != nil {
			return nil, fmt.Errorf("decoding response payload: %w", err)
		}
	}

	var errs any
	if len(entry.Errors) > 0 {
		if err := json.Unmarshal(entry.Errors, &errs); err != nil {
			return nil, fmt.Errorf("decoding errors payload: %w", err)
		}
	}

	return map[string]any{
		"id":         entry.ID.String(),
		"created_at": entry.CreatedAt.Format(time.RFC3339Nano),
		"errors":     errs,
		"output":     output,
	}, nil
}

func (c *Connector) canAccessActionLog(
	runtime runtimeAction,
	role string,
	sessionVariables map[string]any,
	entry ActionLogEntry,
) bool {
	if entry.ActionName != runtime.name {
		return false
	}

	if role == "admin" {
		return true
	}

	if _, ok := runtime.roles[role]; !ok {
		return false
	}

	if fmt.Sprint(entry.SessionVariables["x-hasura-role"]) != role {
		return false
	}

	for name, stored := range entry.SessionVariables {
		if fmt.Sprint(sessionVariables[name]) != fmt.Sprint(stored) {
			return false
		}
	}

	return true
}

func cloneHeader(headers http.Header) http.Header {
	if headers == nil {
		return nil
	}

	return headers.Clone()
}

func cloneAnyMap(in map[string]any) map[string]any {
	if in == nil {
		return nil
	}

	return maps.Clone(in)
}

// NewSubscriptionHandler returns a polling subscription handler for asynchronous
// action result fields.
func (c *Connector) NewSubscriptionHandler( //nolint:ireturn // controller consumes the subscription.Handler boundary.
	pollingInterval time.Duration,
	logger *slog.Logger,
) subscription.Handler {
	if c.asyncStore == nil || !c.hasAsyncActions {
		return nil
	}

	if pollingInterval <= 0 {
		pollingInterval = defaultAsyncPollInterval
	}

	return newAsyncSubscriptionHandler(c, pollingInterval, logger)
}

type asyncSubscriptionHandler struct {
	connector *Connector
	interval  time.Duration
	logger    *slog.Logger

	mu       sync.Mutex
	subs     map[string]context.CancelFunc
	shutdown bool
}

func newAsyncSubscriptionHandler(
	connector *Connector,
	interval time.Duration,
	logger *slog.Logger,
) *asyncSubscriptionHandler {
	return &asyncSubscriptionHandler{
		connector: connector,
		interval:  interval,
		logger:    logger,
		mu:        sync.Mutex{},
		subs:      make(map[string]context.CancelFunc),
		shutdown:  false,
	}
}

func (h *asyncSubscriptionHandler) Start(
	ctx context.Context,
	req subscription.Request,
	logger *slog.Logger,
) (<-chan subscription.Update, error) {
	if req.Operation == nil {
		return nil, fmt.Errorf("%w: operation is required", subscription.ErrInvalidSubscription)
	}

	h.mu.Lock()
	if h.shutdown {
		h.mu.Unlock()

		return nil, errAsyncSubscriptionHandlerClosed
	}

	if _, exists := h.subs[req.ID]; exists {
		h.mu.Unlock()

		return nil, fmt.Errorf(
			"%w: subscription %q already exists",
			subscription.ErrInvalidSubscription,
			req.ID,
		)
	}

	subCtx, cancel := context.WithCancel(context.WithoutCancel(ctx))
	h.subs[req.ID] = cancel
	h.mu.Unlock()

	effectiveLogger := h.logger
	if logger != nil {
		effectiveLogger = logger
	}

	updates := make(chan subscription.Update, 1)
	go h.poll(subCtx, req, updates, effectiveLogger)

	return updates, nil
}

func (h *asyncSubscriptionHandler) Stop(_ context.Context, subscriptionID string) {
	h.mu.Lock()
	cancel := h.subs[subscriptionID]
	delete(h.subs, subscriptionID)
	h.mu.Unlock()

	if cancel != nil {
		cancel()
	}
}

func (h *asyncSubscriptionHandler) Shutdown(_ context.Context) {
	h.mu.Lock()
	if h.shutdown {
		h.mu.Unlock()

		return
	}

	h.shutdown = true

	cancels := make([]context.CancelFunc, 0, len(h.subs))
	for id, cancel := range h.subs {
		delete(h.subs, id)

		cancels = append(cancels, cancel)
	}
	h.mu.Unlock()

	for _, cancel := range cancels {
		cancel()
	}
}

func (h *asyncSubscriptionHandler) poll(
	ctx context.Context,
	req subscription.Request,
	updates chan<- subscription.Update,
	logger *slog.Logger,
) {
	defer close(updates)

	ticker := time.NewTicker(h.interval)
	defer ticker.Stop()

	var last []byte
	for {
		current, err := h.pollOnce(ctx, req, logger)
		if err != nil {
			h.sendUpdate(ctx, updates, subscription.NewUpdateError(req.ID, err))
		} else if !bytes.Equal(current, last) {
			last = append(last[:0], current...)
			h.sendUpdate(ctx, updates, subscription.NewUpdateData(req.ID, current))
		}

		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (h *asyncSubscriptionHandler) pollOnce(
	ctx context.Context,
	req subscription.Request,
	logger *slog.Logger,
) ([]byte, error) {
	ctx = requestQueryContext(ctx, req.QueryString)

	result, err := h.connector.Execute(
		ctx,
		req.Operation,
		req.Fragments,
		req.Variables,
		req.Role,
		req.SessionVariables,
		logger,
	)
	if err != nil {
		return nil, err
	}

	payload, err := json.Marshal(result)
	if err != nil {
		return nil, fmt.Errorf("marshaling async subscription result: %w", err)
	}

	return payload, nil
}

func (h *asyncSubscriptionHandler) sendUpdate(
	ctx context.Context,
	updates chan<- subscription.Update,
	update subscription.Update,
) {
	select {
	case updates <- update:
	case <-ctx.Done():
	}
}

func requestQueryContext(ctx context.Context, query string) context.Context {
	if query == "" {
		return ctx
	}

	return requestcontext.GraphQLQueryToContext(ctx, query)
}
