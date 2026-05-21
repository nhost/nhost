package subscription_test

import (
	"context"
	"errors"
	"log/slog"
	"strconv"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/vektah/gqlparser/v2/ast"
	"go.uber.org/mock/gomock"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	subscription "github.com/nhost/nhost/services/constellation/connector/sql/subscription"
	submock "github.com/nhost/nhost/services/constellation/connector/sql/subscription/mock"
	sub "github.com/nhost/nhost/services/constellation/subscription"
)

func integrationLogger() *slog.Logger {
	return slog.Default()
}

func testOperation() *ast.OperationDefinition {
	return &ast.OperationDefinition{
		Operation: ast.Subscription,
		SelectionSet: ast.SelectionSet{
			&ast.Field{Name: "users"},
		},
	}
}

func testRequest(id string) sub.Request {
	return sub.Request{
		ID:               id,
		QueryString:      "subscription { users { id } }",
		Operation:        testOperation(),
		OperationName:    "TestOp",
		Role:             "user",
		SessionVariables: map[string]any{"x-hasura-user-id": "1"},
	}
}

func nonStreamOp() core.SQLOperation {
	return core.SQLOperation{
		Name: "users",
		SQL:  "SELECT to_json(row) FROM users",
	}
}

func streamOp() core.SQLOperation {
	return core.SQLOperation{
		Name: "events_stream",
		SQL:  "SELECT to_json(row) FROM events WHERE id > $1",
		StreamCursors: []core.StreamCursorInfo{
			{
				ColumnName:   "id",
				GraphQLName:  "id",
				InitialValue: 0,
				Ordering:     core.OrderAsc,
			},
		},
	}
}

func streamOperation() *ast.OperationDefinition {
	return &ast.OperationDefinition{
		Operation: ast.Subscription,
		SelectionSet: ast.SelectionSet{
			&ast.Field{Name: "events_stream"},
		},
	}
}

func streamRequest(id string) sub.Request {
	return sub.Request{
		ID:               id,
		QueryString:      "subscription { events_stream(cursor: {initial_value: {id: 0}}) { id title } }",
		Operation:        streamOperation(),
		OperationName:    "StreamOp",
		Role:             "user",
		SessionVariables: map[string]any{"x-hasura-user-id": "1"},
	}
}

// expectIsStreamSubscription primes the mock to answer the
// QueryBuilder.IsStreamSubscription routing probe with the given verdict.
// Pass false for live-query test inputs and true for stream test inputs.
func expectIsStreamSubscription(b *submock.MockQueryBuilder, isStream bool) {
	b.EXPECT().IsStreamSubscription(gomock.Any()).Return(isStream).AnyTimes()
}

// receiveUpdate reads from the channel with a timeout.
func receiveUpdate(t *testing.T, ch <-chan sub.Update) sub.Update {
	t.Helper()

	select {
	case u := <-ch:
		return u
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for update")

		return sub.Update{}
	}
}

func TestNewHandler(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	executor := submock.NewMockQueryExecutor(ctrl)
	roots := queries.Roots{Operations: nil, StreamFields: nil}

	h := subscription.NewHandler(executor, roots, time.Second, integrationLogger())

	if h == nil {
		t.Fatal("NewHandler returned nil")
	}
}

func TestHandler_Start_RequestError(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	executor := submock.NewMockQueryExecutor(ctrl)
	roots := queries.Roots{Operations: nil, StreamFields: nil}
	h := subscription.NewHandler(executor, roots, time.Second, integrationLogger())

	ch, err := h.Start(context.Background(), sub.Request{
		ID:               "sub-nil-op",
		QueryString:      "subscription { users { id } }",
		Operation:        nil,
		Fragments:        nil,
		OperationName:    "TestOp",
		Role:             "user",
		Variables:        nil,
		SessionVariables: nil,
	}, integrationLogger())
	if err == nil {
		t.Fatal("expected error for nil operation, got nil")
	}

	if ch != nil {
		t.Error("expected nil channel when error occurs")
	}
}

// TestHandler_Start_UnknownRoute_ErrorsViaChannel verifies that a subscription
// whose root field has no registered builder still starts successfully but
// surfaces the routing failure as an error update on the channel during the
// first poll. The detection path no longer eagerly builds the SQL, so
// route-not-found errors arrive asynchronously like any other poll failure.
func TestHandler_Start_UnknownRoute_ErrorsViaChannel(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	executor := submock.NewMockQueryExecutor(ctrl)
	roots := queries.Roots{Operations: nil, StreamFields: nil}

	h := subscription.NewHandler(executor, roots, 50*time.Millisecond, integrationLogger())
	defer h.Shutdown(context.Background())

	ch, err := h.Start(context.Background(), sub.Request{
		ID:               "sub-empty-roots",
		QueryString:      "subscription { users { id } }",
		Operation:        testOperation(),
		Fragments:        nil,
		OperationName:    "TestOp",
		Role:             "user",
		Variables:        nil,
		SessionVariables: nil,
	}, integrationLogger())
	if err != nil {
		t.Fatalf("unexpected sync error: %v", err)
	}

	update := receiveUpdate(t, ch)
	if update.Error == nil {
		t.Fatal("expected error update for missing route, got nil")
	}
}

func TestHandler_LifecycleNoPanic(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		do   func(h *subscription.Handler)
	}{
		{
			name: "stop_nonexistent_subscription",
			do: func(h *subscription.Handler) {
				h.Stop(context.Background(), "nonexistent-sub-id")
			},
		},
		{
			name: "shutdown_no_subscriptions",
			do: func(h *subscription.Handler) {
				h.Shutdown(context.Background())
			},
		},
		{
			name: "double_shutdown",
			do: func(h *subscription.Handler) {
				h.Shutdown(context.Background())
				h.Shutdown(context.Background())
			},
		},
		{
			name: "stop_after_shutdown",
			do: func(h *subscription.Handler) {
				h.Shutdown(context.Background())
				h.Stop(context.Background(), "sub-1")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			executor := submock.NewMockQueryExecutor(ctrl)
			roots := queries.Roots{Operations: nil, StreamFields: nil}
			h := subscription.NewHandler(executor, roots, time.Second, integrationLogger())

			tt.do(h)
		})
	}
}

func TestHandler_Start_FirstUpdate(t *testing.T) {
	t.Parallel()

	dbErr := errors.New("connection refused")
	buildErr := errors.New("schema changed")
	streamErr := errors.New("stream query failed")

	tests := []struct {
		name       string
		request    sub.Request
		setupMocks func(b *submock.MockQueryBuilder, e *submock.MockQueryExecutor)
		wantData   string
		wantErr    error
	}{
		{
			name:    "live_query_happy_path",
			request: testRequest("sub-1"),
			setupMocks: func(b *submock.MockQueryBuilder, e *submock.MockQueryExecutor) {
				expectIsStreamSubscription(b, false)
				b.EXPECT().BuildQuery(
					gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
				).Return([]core.SQLOperation{nonStreamOp()}, nil).AnyTimes()
				e.EXPECT().ExecuteMultiplexedQuery(
					gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
				).Return([]subscription.MultiplexedResult{
					{SubscriptionID: "sub-1", Data: []byte(`{"users":[{"id":1}]}`)},
				}, nil).AnyTimes()
			},
			wantData: `{"users":[{"id":1}]}`,
			wantErr:  nil,
		},
		{
			name:    "live_query_execute_error",
			request: testRequest("sub-1"),
			setupMocks: func(b *submock.MockQueryBuilder, e *submock.MockQueryExecutor) {
				expectIsStreamSubscription(b, false)
				b.EXPECT().BuildQuery(
					gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
				).Return([]core.SQLOperation{nonStreamOp()}, nil).AnyTimes()
				e.EXPECT().ExecuteMultiplexedQuery(
					gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
				).Return(nil, dbErr).AnyTimes()
			},
			wantData: "",
			wantErr:  dbErr,
		},
		{
			name:    "live_query_build_sql_error",
			request: testRequest("sub-1"),
			setupMocks: func(b *submock.MockQueryBuilder, _ *submock.MockQueryExecutor) {
				expectIsStreamSubscription(b, false)
				// Detection no longer calls BuildQuery on the live-query path —
				// the only BuildQuery call is from getOrBuildSQL at poll time.
				b.EXPECT().BuildQuery(
					gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
				).Return(nil, buildErr).AnyTimes()
			},
			wantData: "",
			wantErr:  buildErr,
		},
		{
			name:    "stream_happy_path",
			request: streamRequest("stream-1"),
			setupMocks: func(b *submock.MockQueryBuilder, e *submock.MockQueryExecutor) {
				expectIsStreamSubscription(b, true)
				b.EXPECT().BuildQuery(
					gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
				).Return([]core.SQLOperation{streamOp()}, nil).AnyTimes()
				e.EXPECT().ExecuteMultiplexedQueryWithCursor(
					gomock.Any(),
					gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
				).
					Return([]subscription.MultiplexedResult{
						{
							SubscriptionID: "stream-1",
							Data:           []byte(`{"events_stream":[{"id":1,"title":"hello"}]}`),
						},
					}, nil).AnyTimes()
			},
			wantData: `{"events_stream":[{"id":1,"title":"hello"}]}`,
			wantErr:  nil,
		},
		{
			name:    "stream_execute_error",
			request: streamRequest("stream-1"),
			setupMocks: func(b *submock.MockQueryBuilder, e *submock.MockQueryExecutor) {
				expectIsStreamSubscription(b, true)
				b.EXPECT().BuildQuery(
					gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
				).Return([]core.SQLOperation{streamOp()}, nil).AnyTimes()
				e.EXPECT().ExecuteMultiplexedQueryWithCursor(
					gomock.Any(),
					gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
				).
					Return(nil, streamErr).AnyTimes()
			},
			wantData: "",
			wantErr:  streamErr,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			executor := submock.NewMockQueryExecutor(ctrl)
			builder := submock.NewMockQueryBuilder(ctrl)
			tt.setupMocks(builder, executor)

			h := subscription.NewHandler(
				executor,
				builder,
				50*time.Millisecond,
				integrationLogger(),
			)
			defer h.Shutdown(context.Background())

			ch, err := h.Start(context.Background(), tt.request, integrationLogger())
			if err != nil {
				t.Fatal("unexpected error:", err)
			}

			update := receiveUpdate(t, ch)

			if tt.wantErr != nil {
				if update.Error == nil {
					t.Fatal("expected error in update, got nil")
				}

				if !errors.Is(update.Error, tt.wantErr) {
					t.Errorf("expected wrapped %v, got %q", tt.wantErr, update.Error.Error())
				}

				return
			}

			if update.Error != nil {
				t.Fatal("unexpected error in update:", update.Error)
			}

			if update.SubscriptionID != tt.request.ID {
				t.Errorf("expected %s, got %s", tt.request.ID, update.SubscriptionID)
			}

			if string(update.Data) != tt.wantData {
				t.Errorf("expected data %q, got %q", tt.wantData, string(update.Data))
			}
		})
	}
}

func TestHandler_Start_LiveQuery_ChangeDetection(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	executor := submock.NewMockQueryExecutor(ctrl)
	builder := submock.NewMockQueryBuilder(ctrl)

	expectIsStreamSubscription(builder, false)
	builder.EXPECT().BuildQuery(
		gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
	).Return([]core.SQLOperation{nonStreamOp()}, nil).AnyTimes()

	// Return the same data every time — only the first should produce an update.
	executor.EXPECT().ExecuteMultiplexedQuery(
		gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
	).Return([]subscription.MultiplexedResult{
		{SubscriptionID: "sub-1", Data: []byte(`{"users":[{"id":1}]}`)},
	}, nil).AnyTimes()

	h := subscription.NewHandler(executor, builder, 50*time.Millisecond, integrationLogger())
	defer h.Shutdown(context.Background())

	ch, err := h.Start(context.Background(), testRequest("sub-1"), integrationLogger())
	if err != nil {
		t.Fatal("unexpected error:", err)
	}

	// First update should arrive.
	receiveUpdate(t, ch)

	// Wait several polling intervals — no new update should arrive because data is unchanged.
	select {
	case u := <-ch:
		t.Fatalf("unexpected duplicate update: %+v", u)
	case <-time.After(200 * time.Millisecond):
		// expected — no duplicate
	}
}

func TestHandler_Start_Stop_Lifecycle(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	executor := submock.NewMockQueryExecutor(ctrl)
	builder := submock.NewMockQueryBuilder(ctrl)

	expectIsStreamSubscription(builder, false)
	builder.EXPECT().BuildQuery(
		gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
	).Return([]core.SQLOperation{nonStreamOp()}, nil).AnyTimes()

	executor.EXPECT().ExecuteMultiplexedQuery(
		gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
	).Return([]subscription.MultiplexedResult{
		{SubscriptionID: "sub-1", Data: []byte(`{"users":[]}`)},
	}, nil).AnyTimes()

	h := subscription.NewHandler(executor, builder, 50*time.Millisecond, integrationLogger())
	defer h.Shutdown(context.Background())

	ch, err := h.Start(context.Background(), testRequest("sub-1"), integrationLogger())
	if err != nil {
		t.Fatal("unexpected error:", err)
	}

	// Drain first update
	receiveUpdate(t, ch)

	// Stop the subscription
	h.Stop(context.Background(), "sub-1")

	// Channel should eventually be closed (subscription stopped).
	// May receive one last buffered update — that's fine.
	select {
	case <-ch:
	case <-time.After(time.Second):
		t.Fatal("channel not closed after Stop")
	}
}

func TestHandler_Start_MultipleSubscriptions_SameCohort(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	executor := submock.NewMockQueryExecutor(ctrl)
	builder := submock.NewMockQueryBuilder(ctrl)

	expectIsStreamSubscription(builder, false)
	builder.EXPECT().BuildQuery(
		gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
	).Return([]core.SQLOperation{nonStreamOp()}, nil).AnyTimes()

	// The executor returns results for both subscribers in the same multiplexed query.
	executor.EXPECT().ExecuteMultiplexedQuery(
		gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
	).DoAndReturn(func(
		_ context.Context,
		_ core.SQLOperation,
		subIDs []string,
		_ map[string][]any,
		_ *slog.Logger,
	) ([]subscription.MultiplexedResult, error) {
		results := make([]subscription.MultiplexedResult, len(subIDs))
		for i, id := range subIDs {
			results[i] = subscription.MultiplexedResult{
				SubscriptionID: id,
				Data:           []byte(`{"users":[{"id":1}]}`),
			}
		}

		return results, nil
	}).AnyTimes()

	h := subscription.NewHandler(executor, builder, 50*time.Millisecond, integrationLogger())
	defer h.Shutdown(context.Background())

	// Start two subscriptions with the same query/role/variables → same cohort
	ch1, err := h.Start(context.Background(), testRequest("sub-1"), integrationLogger())
	if err != nil {
		t.Fatal("unexpected error:", err)
	}

	ch2, err := h.Start(context.Background(), testRequest("sub-2"), integrationLogger())
	if err != nil {
		t.Fatal("unexpected error:", err)
	}

	// Both should receive updates
	u1 := receiveUpdate(t, ch1)
	u2 := receiveUpdate(t, ch2)

	if u1.SubscriptionID != "sub-1" {
		t.Errorf("expected sub-1, got %s", u1.SubscriptionID)
	}

	if u2.SubscriptionID != "sub-2" {
		t.Errorf("expected sub-2, got %s", u2.SubscriptionID)
	}
}

func TestHandler_Start_LiveQuery_SQLCaching(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	executor := submock.NewMockQueryExecutor(ctrl)
	builder := submock.NewMockQueryBuilder(ctrl)

	expectIsStreamSubscription(builder, false)

	// BuildQuery should be called exactly 1 time on the live-query path:
	// getOrBuildSQL builds the SQL on the first poll and caches it; detection
	// itself routes via IsStreamSubscription and does not invoke BuildQuery.
	// Subsequent polls reuse the cached SQL operation.
	builder.EXPECT().BuildQuery(
		gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
	).Return([]core.SQLOperation{nonStreamOp()}, nil).Times(1)

	executor.EXPECT().ExecuteMultiplexedQuery(
		gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
	).Return([]subscription.MultiplexedResult{
		{SubscriptionID: "sub-1", Data: []byte(`{"users":[{"id":1}]}`)},
	}, nil).AnyTimes()

	h := subscription.NewHandler(executor, builder, 50*time.Millisecond, integrationLogger())
	defer h.Shutdown(context.Background())

	ch, err := h.Start(context.Background(), testRequest("sub-1"), integrationLogger())
	if err != nil {
		t.Fatal("unexpected error:", err)
	}

	// First update triggers initial SQL build + execution.
	receiveUpdate(t, ch)

	// Wait several polling intervals — BuildQuery should not be called again.
	time.Sleep(200 * time.Millisecond)

	// gomock verifies exactly 1 call at cleanup.
}

// TestHandler_Start_Stream_SQLCaching guards the streamCohortManager
// equivalent of the live-query SQL caching contract: the stream cohort
// caches the built SQLOperation on first poll, so subsequent polls reuse
// it even as the cursor advances. Cursor values flow through result_vars
// rather than the SQL string itself, so the cached op stays valid.
// Regression guard against re-introducing per-poll BuildQuery calls on
// the stream path.
func TestHandler_Start_Stream_SQLCaching(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	executor := submock.NewMockQueryExecutor(ctrl)
	builder := submock.NewMockQueryBuilder(ctrl)

	expectIsStreamSubscription(builder, true)

	// BuildQuery should be called exactly 2 times on the stream path:
	//   1. detectStreamSubscription (extracts cursor metadata at Start)
	//   2. getOrBuildSQL on the cohort's first poll (caches the result)
	// Subsequent polls reuse the cached SQL operation on the cohort, even
	// as the cursor advances — only the per-subscriber cursor JSON changes
	// between polls.
	builder.EXPECT().BuildQuery(
		gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
	).Return([]core.SQLOperation{streamOp()}, nil).Times(2)

	executor.EXPECT().ExecuteMultiplexedQueryWithCursor(
		gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
	).Return([]subscription.MultiplexedResult{
		{
			SubscriptionID: "stream-caching",
			Data:           []byte(`{"events_stream":[{"id":5,"title":"hello"}]}`),
		},
	}, nil).AnyTimes()

	h := subscription.NewHandler(executor, builder, 50*time.Millisecond, integrationLogger())
	defer h.Shutdown(context.Background())

	ch, err := h.Start(context.Background(), streamRequest("stream-caching"), integrationLogger())
	if err != nil {
		t.Fatal("unexpected error:", err)
	}

	// First update confirms the cohort built and cached its SQL.
	receiveUpdate(t, ch)

	// Wait several polling intervals — BuildQuery must not be called again
	// on subsequent polls. The cursor advances on every poll (initial 0 →
	// observed 5 → reseat), which would re-trigger BuildQuery if the cache
	// were dropped during cohort reseat. gomock fails on call #3 if so.
	time.Sleep(200 * time.Millisecond)
}

func TestHandler_Start_LiveQuery_OverflowCohort(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	executor := submock.NewMockQueryExecutor(ctrl)
	builder := submock.NewMockQueryBuilder(ctrl)

	expectIsStreamSubscription(builder, false)
	builder.EXPECT().BuildQuery(
		gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
	).Return([]core.SQLOperation{nonStreamOp()}, nil).AnyTimes()

	var (
		callMu      sync.Mutex
		maxBatch    int
		callBatches = make(map[int]int) // batch size -> number of calls.
	)

	executor.EXPECT().ExecuteMultiplexedQuery(
		gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
	).DoAndReturn(func(
		_ context.Context,
		_ core.SQLOperation,
		subIDs []string,
		_ map[string][]any,
		_ *slog.Logger,
	) ([]subscription.MultiplexedResult, error) {
		callMu.Lock()
		callBatches[len(subIDs)]++

		if len(subIDs) > maxBatch {
			maxBatch = len(subIDs)
		}
		callMu.Unlock()

		results := make([]subscription.MultiplexedResult, len(subIDs))
		for i, id := range subIDs {
			results[i] = subscription.MultiplexedResult{
				SubscriptionID: id,
				Data:           []byte(`{"users":[{"id":1}]}`),
			}
		}

		return results, nil
	}).AnyTimes()

	h := subscription.NewHandler(executor, builder, 50*time.Millisecond, integrationLogger())
	defer h.Shutdown(context.Background())

	// Start 225 subscriptions — should batch into 3 cohorts of sizes
	// 100, 100, 25 (not 126 single-subscriber overflow cohorts, which was
	// the prior bug). lastCh comes from cohort #3 (overflow), proving the
	// overflow path still produces updates.
	const totalSubs = 225

	channels := make([]<-chan sub.Update, 0, totalSubs)

	for i := range totalSubs {
		req := testRequest("sub-" + strconv.Itoa(i))

		ch, err := h.Start(context.Background(), req, integrationLogger())
		if err != nil {
			t.Fatalf("unexpected error starting subscription %d: %v", i, err)
		}

		channels = append(channels, ch)
	}

	// All subscribers should receive their first update.
	for i, ch := range channels {
		update := receiveUpdate(t, ch)
		if update.Error != nil {
			t.Fatalf("subscription %d got error: %v", i, update.Error)
		}
	}

	callMu.Lock()
	defer callMu.Unlock()

	// The largest poll must have batched a full cohort. If the overflow
	// lookup regresses and each new subscriber over the limit gets its own
	// cohort, maxBatch stays at 1 — this assertion guards against that.
	if maxBatch != 100 {
		t.Errorf(
			"expected max batch size of %d (one full cohort), got %d; batches=%v",
			100, maxBatch, callBatches,
		)
	}
}

func TestHandler_Start_Stream_CursorAdvancement(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	executor := submock.NewMockQueryExecutor(ctrl)
	builder := submock.NewMockQueryBuilder(ctrl)

	expectIsStreamSubscription(builder, true)
	builder.EXPECT().BuildQuery(
		gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
	).Return([]core.SQLOperation{streamOp()}, nil).AnyTimes()

	// Track call count to return different data on each poll, simulating cursor advancement.
	var callCount atomic.Int32

	executor.EXPECT().ExecuteMultiplexedQueryWithCursor(
		gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
	).DoAndReturn(func(
		_ context.Context,
		_ core.SQLOperation,
		subIDs []string,
		_ map[string][]any,
		_ map[string]any,
		_ *slog.Logger,
	) ([]subscription.MultiplexedResult, error) {
		n := callCount.Add(1)
		if n == 1 {
			// First poll: return data with cursor id=5
			return []subscription.MultiplexedResult{
				{
					SubscriptionID: subIDs[0],
					Data:           []byte(`{"events_stream":[{"id":5,"title":"first"}]}`),
				},
			}, nil
		}

		// Subsequent polls: return data with advanced cursor id=10
		return []subscription.MultiplexedResult{
			{
				SubscriptionID: subIDs[0],
				Data:           []byte(`{"events_stream":[{"id":10,"title":"second"}]}`),
			},
		}, nil
	}).AnyTimes()

	h := subscription.NewHandler(executor, builder, 50*time.Millisecond, integrationLogger())
	defer h.Shutdown(context.Background())

	ch, err := h.Start(context.Background(), streamRequest("stream-1"), integrationLogger())
	if err != nil {
		t.Fatal("unexpected error:", err)
	}

	// First update: initial data batch with cursor id=5.
	u1 := receiveUpdate(t, ch)
	if u1.Error != nil {
		t.Fatal("unexpected error:", u1.Error)
	}

	if string(u1.Data) != `{"events_stream":[{"id":5,"title":"first"}]}` {
		t.Errorf("unexpected first data: %s", string(u1.Data))
	}

	// Second update: cursor should have advanced, returning new data with id=10.
	u2 := receiveUpdate(t, ch)
	if u2.Error != nil {
		t.Fatal("unexpected error:", u2.Error)
	}

	if string(u2.Data) != `{"events_stream":[{"id":10,"title":"second"}]}` {
		t.Errorf("unexpected second data: %s", string(u2.Data))
	}
}
