package benchmark_test

import (
	"bytes"
	"encoding/json/jsontext"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/constellation/connector"
	"github.com/nhost/nhost/services/constellation/connector/memconnector"
	"github.com/nhost/nhost/services/constellation/controller"
	"github.com/nhost/nhost/services/constellation/controller/middleware"
	"github.com/nhost/nhost/services/constellation/controller/planner"
	"github.com/nhost/nhost/services/constellation/graph"
	oapilogger "github.com/nhost/nhost/services/constellation/internal/lib/oapi/logger"
)

const adminSecret = "nhost-admin-secret" //nolint:gosec

//nolint:gochecknoglobals
var (
	handler          http.Handler
	largeHandler     http.Handler
	marshalHandler   http.Handler
	remoteRelHandler http.Handler
)

func TestMain(m *testing.M) {
	gin.SetMode(gin.ReleaseMode)

	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{
		Level: slog.LevelWarn,
	}))

	h, err := buildHandler(logger)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to build handler: %v\n", err)
		os.Exit(1)
	}

	handler = h

	lh, err := buildLargeHandler(logger)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to build large handler: %v\n", err)
		os.Exit(1)
	}

	largeHandler = lh

	mh, err := buildMarshalHandler(logger)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to build marshal handler: %v\n", err)
		os.Exit(1)
	}

	marshalHandler = mh

	rrh, err := buildRemoteRelHandler(logger)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to build remote rel handler: %v\n", err)
		os.Exit(1)
	}

	remoteRelHandler = rrh

	os.Exit(m.Run())
}

func userObjects() []*graph.ObjectType {
	return []*graph.ObjectType{
		memconnector.Object("User",
			memconnector.ID("id"),
			memconnector.String("createdAt"),
			memconnector.String("updatedAt"),
			memconnector.String("displayName"),
			memconnector.String("email"),
			memconnector.String("locale"),
			memconnector.Boolean("disabled"),
			memconnector.String("defaultRole"),
			memconnector.Boolean("isAnonymous"),
			memconnector.String("phoneNumber"),
			memconnector.String("avatarUrl"),
			memconnector.String("metadata"),
			memconnector.Field("roles", memconnector.NonNullList(memconnector.NonNull("Role"))),
		),
		memconnector.Object("Role",
			memconnector.ID("id"),
			memconnector.String("role"),
		),
		memconnector.Object("users_aggregate",
			memconnector.Field("aggregate", memconnector.Named("users_aggregate_fields")),
			memconnector.Field("nodes", memconnector.NonNullList(memconnector.NonNull("User"))),
		),
		memconnector.Object("users_aggregate_fields",
			memconnector.Int("count"),
		),
	}
}

func buildRemoteRelRouter(
	logger *slog.Logger,
	connectors map[string]connector.Connector,
	relationships map[string][]*planner.RelationshipMetadata,
) (http.Handler, error) {
	ctrl, err := controller.NewFromConnectors(adminSecret, connectors, relationships, logger)
	if err != nil {
		return nil, fmt.Errorf("creating controller: %w", err)
	}

	router := gin.New()
	router.Use(
		gin.Recovery(),
		oapilogger.Logger(logger),
		middleware.Session(adminSecret, nil),
	)
	router.POST("/graphql", ctrl.HandlerPost)

	return router, nil
}

func buildRouter(
	logger *slog.Logger,
	conn connector.Connector,
) (http.Handler, error) {
	connectors := map[string]connector.Connector{"mem": conn}

	ctrl, err := controller.NewFromConnectors(adminSecret, connectors, nil, logger)
	if err != nil {
		return nil, fmt.Errorf("creating controller: %w", err)
	}

	router := gin.New()
	router.Use(
		gin.Recovery(),
		oapilogger.Logger(logger),
		middleware.Session(adminSecret, nil),
	)
	router.POST("/graphql", ctrl.HandlerPost)

	return router, nil
}

func buildHandler(logger *slog.Logger) (http.Handler, error) {
	usersResponse := jsontext.Value(`[` +
		`{"id":"1","createdAt":"2024-01-01T00:00:00Z","updatedAt":"2024-01-01T00:00:00Z",` +
		`"displayName":"Alice","email":"alice@example.com","locale":"en","disabled":false,` +
		`"defaultRole":"user","isAnonymous":false,"phoneNumber":"+1234567890",` +
		`"avatarUrl":"https://example.com/alice.png","metadata":"{}",` +
		`"roles":[{"id":"r1","role":"user"},{"id":"r2","role":"admin"}]},` +
		`{"id":"2","createdAt":"2024-01-02T00:00:00Z","updatedAt":"2024-01-02T00:00:00Z",` +
		`"displayName":"Bob","email":"bob@example.com","locale":"en","disabled":false,` +
		`"defaultRole":"user","isAnonymous":false,"phoneNumber":"+0987654321",` +
		`"avatarUrl":"https://example.com/bob.png","metadata":"{}",` +
		`"roles":[{"id":"r3","role":"user"}]}` +
		`]`)

	aggregateResponse := jsontext.Value(
		`{"aggregate":{"count":10},"nodes":[` +
			`{"id":"1","displayName":"Alice"},{"id":"2","displayName":"Bob"}]}`,
	)

	conn, err := memconnector.New(
		userObjects(),
		[]memconnector.QueryDef{
			memconnector.Query("users",
				graph.NewNonNullListType(graph.NewNonNullType("User")),
				usersResponse,
			),
			memconnector.Query("users_aggregate",
				graph.NewNonNullType("users_aggregate"),
				aggregateResponse,
			),
		},
	)
	if err != nil {
		return nil, fmt.Errorf("creating memconnector: %w", err)
	}

	return buildRouter(logger, conn)
}

// generateLargeUsersJSON builds a jsontext.Value containing n user objects.
func generateLargeUsersJSON(n int) jsontext.Value {
	var buf bytes.Buffer

	buf.WriteByte('[')

	for i := range n {
		if i > 0 {
			buf.WriteByte(',')
		}

		id := strconv.Itoa(i + 1)

		buf.WriteString(`{"id":"`)
		buf.WriteString(id)
		buf.WriteString(`","createdAt":"2024-01-01T00:00:00Z","updatedAt":"2024-01-01T00:00:00Z",`)
		buf.WriteString(`"displayName":"User `)
		buf.WriteString(id)
		buf.WriteString(`","email":"user`)
		buf.WriteString(id)
		buf.WriteString(`@example.com","locale":"en","disabled":false,`)
		buf.WriteString(`"defaultRole":"user","isAnonymous":false,"phoneNumber":"+0000000`)
		buf.WriteString(id)
		buf.WriteString(`","avatarUrl":"https://example.com/user`)
		buf.WriteString(id)
		buf.WriteString(`.png","metadata":"{}",`)
		buf.WriteString(`"roles":[{"id":"r`)
		buf.WriteString(id)
		buf.WriteString(`","role":"user"}]}`)
	}

	buf.WriteByte(']')

	return jsontext.Value(buf.Bytes())
}

func buildLargeHandler(logger *slog.Logger) (http.Handler, error) {
	const numUsers = 500

	usersResponse := generateLargeUsersJSON(numUsers)

	conn, err := memconnector.New(
		userObjects(),
		[]memconnector.QueryDef{
			memconnector.Query("users",
				graph.NewNonNullListType(graph.NewNonNullType("User")),
				usersResponse,
			),
		},
	)
	if err != nil {
		return nil, fmt.Errorf("creating memconnector: %w", err)
	}

	return buildRouter(logger, conn)
}

// buildMarshalHandler creates a handler whose connector returns Go maps
// instead of jsontext.Value, forcing the response through json.Marshal
// (the non-raw path) for A/B comparison.
func buildMarshalHandler(logger *slog.Logger) (http.Handler, error) {
	usersResponse := []map[string]any{
		{
			"id": "1", "createdAt": "2024-01-01T00:00:00Z", "updatedAt": "2024-01-01T00:00:00Z",
			"displayName": "Alice", "email": "alice@example.com", "locale": "en",
			"disabled": false, "defaultRole": "user", "isAnonymous": false,
			"phoneNumber": "+1234567890", "avatarUrl": "https://example.com/alice.png",
			"metadata": "{}",
			"roles": []map[string]any{
				{"id": "r1", "role": "user"},
				{"id": "r2", "role": "admin"},
			},
		},
		{
			"id": "2", "createdAt": "2024-01-02T00:00:00Z", "updatedAt": "2024-01-02T00:00:00Z",
			"displayName": "Bob", "email": "bob@example.com", "locale": "en",
			"disabled": false, "defaultRole": "user", "isAnonymous": false,
			"phoneNumber": "+0987654321", "avatarUrl": "https://example.com/bob.png",
			"metadata": "{}",
			"roles": []map[string]any{
				{"id": "r3", "role": "user"},
			},
		},
	}

	conn, err := memconnector.New(
		userObjects(),
		[]memconnector.QueryDef{
			memconnector.Query("users",
				graph.NewNonNullListType(graph.NewNonNullType("User")),
				usersResponse,
			),
		},
	)
	if err != nil {
		return nil, fmt.Errorf("creating memconnector: %w", err)
	}

	return buildRouter(logger, conn)
}

// serveGraphQLWith calls the given handler directly, bypassing TCP.
func serveGraphQLWith(b *testing.B, h http.Handler, body []byte) {
	b.Helper()

	req := httptest.NewRequest(
		http.MethodPost,
		"/graphql",
		bytes.NewReader(body),
	)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hasura-Admin-Secret", adminSecret)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		b.Fatalf("unexpected status %d: %s", w.Code, w.Body.String())
	}

	if bytes.Contains(w.Body.Bytes(), []byte(`"errors"`)) {
		b.Fatalf("graphql errors: %s", w.Body.String())
	}
}

// serveGraphQL calls the default handler.
func serveGraphQL(b *testing.B, body []byte) {
	b.Helper()

	serveGraphQLWith(b, handler, body)
}

// --- Small response benchmarks (2 rows) ---

func BenchmarkSelectSimple(b *testing.B) {
	b.ReportAllocs()

	body := []byte(`{"query": "{ users { id displayName email } }"}`)

	serveGraphQL(b, body)

	b.ResetTimer()

	for b.Loop() {
		serveGraphQL(b, body)
	}
}

func BenchmarkSelectAllFields(b *testing.B) {
	b.ReportAllocs()

	body := []byte(
		`{"query": "{ users { id createdAt updatedAt displayName email locale disabled defaultRole isAnonymous phoneNumber avatarUrl metadata } }"}`,
	)

	serveGraphQL(b, body)

	b.ResetTimer()

	for b.Loop() {
		serveGraphQL(b, body)
	}
}

func BenchmarkSelectNested(b *testing.B) {
	b.ReportAllocs()

	body := []byte(`{"query": "{ users { id roles { id role } } }"}`)

	serveGraphQL(b, body)

	b.ResetTimer()

	for b.Loop() {
		serveGraphQL(b, body)
	}
}

func BenchmarkSelectAggregate(b *testing.B) {
	b.ReportAllocs()

	body := []byte(
		`{"query": "{ users_aggregate { aggregate { count } nodes { id displayName } } }"}`,
	)

	serveGraphQL(b, body)

	b.ResetTimer()

	for b.Loop() {
		serveGraphQL(b, body)
	}
}

func BenchmarkSelectMultiQuery(b *testing.B) {
	b.ReportAllocs()

	body := []byte(
		`{"query": "{ users { id displayName } users_aggregate { aggregate { count } } }"}`,
	)

	serveGraphQL(b, body)

	b.ResetTimer()

	for b.Loop() {
		serveGraphQL(b, body)
	}
}

// --- Parallel benchmarks ---

func BenchmarkSelectSimpleParallel(b *testing.B) {
	b.ReportAllocs()

	body := []byte(`{"query": "{ users { id displayName email } }"}`)

	serveGraphQL(b, body)

	b.ResetTimer()

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			serveGraphQL(b, body)
		}
	})
}

func BenchmarkSelectAllFieldsParallel(b *testing.B) {
	b.ReportAllocs()

	body := []byte(
		`{"query": "{ users { id createdAt updatedAt displayName email locale disabled defaultRole isAnonymous phoneNumber avatarUrl metadata } }"}`,
	)

	serveGraphQL(b, body)

	b.ResetTimer()

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			serveGraphQL(b, body)
		}
	})
}

// --- Large response benchmarks (500 rows) ---

func BenchmarkSelectLargeSimple(b *testing.B) {
	b.ReportAllocs()

	body := []byte(`{"query": "{ users { id displayName email } }"}`)

	serveGraphQLWith(b, largeHandler, body)

	b.ResetTimer()

	for b.Loop() {
		serveGraphQLWith(b, largeHandler, body)
	}
}

func BenchmarkSelectLargeAllFields(b *testing.B) {
	b.ReportAllocs()

	body := []byte(
		`{"query": "{ users { id createdAt updatedAt displayName email locale disabled defaultRole isAnonymous phoneNumber avatarUrl metadata } }"}`,
	)

	serveGraphQLWith(b, largeHandler, body)

	b.ResetTimer()

	for b.Loop() {
		serveGraphQLWith(b, largeHandler, body)
	}
}

func BenchmarkSelectLargeParallel(b *testing.B) {
	b.ReportAllocs()

	body := []byte(`{"query": "{ users { id displayName email } }"}`)

	serveGraphQLWith(b, largeHandler, body)

	b.ResetTimer()

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			serveGraphQLWith(b, largeHandler, body)
		}
	})
}

// --- Raw vs Marshal comparison ---
// These benchmarks compare the raw JSON fast path (jsontext.Value passthrough)
// against the standard json.Marshal path (Go map results).

func BenchmarkSelectRawPath(b *testing.B) {
	b.ReportAllocs()

	body := []byte(`{"query": "{ users { id displayName email } }"}`)

	serveGraphQL(b, body)

	b.ResetTimer()

	for b.Loop() {
		serveGraphQL(b, body)
	}
}

func BenchmarkSelectMarshalPath(b *testing.B) {
	b.ReportAllocs()

	body := []byte(`{"query": "{ users { id displayName email } }"}`)

	serveGraphQLWith(b, marshalHandler, body)

	b.ResetTimer()

	for b.Loop() {
		serveGraphQLWith(b, marshalHandler, body)
	}
}

// --- Introspection benchmark ---
// Introspection takes a completely different code path (no raw fast path).

func BenchmarkIntrospection(b *testing.B) {
	b.ReportAllocs()

	body := []byte(`{"query": "{ __schema { types { name kind } } }"}`)

	serveGraphQL(b, body)

	b.ResetTimer()

	for b.Loop() {
		serveGraphQL(b, body)
	}
}

// --- Remote relationship benchmarks ---
// These exercise the cross-connector stitching code path: query planning,
// phantom field injection, remote query building, result extraction, and stitching.

func orderObjects() []*graph.ObjectType {
	return []*graph.ObjectType{
		memconnector.Object("Order",
			memconnector.ID("id"),
			memconnector.String("userId"),
			memconnector.String("product"),
			memconnector.Float("amount"),
			memconnector.String("createdAt"),
		),
	}
}

func buildRemoteRelHandler(logger *slog.Logger) (http.Handler, error) {
	// Connector "db1" serves users. The User type includes an "orders" field
	// that is a remote array relationship resolved from connector "db2".
	usersResponse := []map[string]any{
		{
			"id": "1", "displayName": "Alice", "email": "alice@example.com",
		},
		{
			"id": "2", "displayName": "Bob", "email": "bob@example.com",
		},
	}

	userObjects := []*graph.ObjectType{
		memconnector.Object("User",
			memconnector.ID("id"),
			memconnector.String("displayName"),
			memconnector.String("email"),
			// Remote relationship field — resolved from db2 by the controller.
			memconnector.Field("orders",
				memconnector.NonNullList(memconnector.NonNull("Order"))),
		),
	}

	db1, err := memconnector.New(
		userObjects,
		[]memconnector.QueryDef{
			memconnector.Query("users",
				graph.NewNonNullListType(graph.NewNonNullType("User")),
				usersResponse,
			),
		},
	)
	if err != nil {
		return nil, fmt.Errorf("creating db1 memconnector: %w", err)
	}

	// Connector "db2" serves orders. Responses include userId for join matching.
	ordersResponse := []map[string]any{
		{
			"id": "o1", "userId": "1", "product": "Widget",
			"amount": 9.99, "createdAt": "2024-06-01T00:00:00Z",
		},
		{
			"id": "o2", "userId": "1", "product": "Gadget",
			"amount": 24.99, "createdAt": "2024-06-02T00:00:00Z",
		},
		{
			"id": "o3", "userId": "2", "product": "Doohickey",
			"amount": 4.99, "createdAt": "2024-06-03T00:00:00Z",
		},
	}

	db2, err := memconnector.New(
		orderObjects(),
		[]memconnector.QueryDef{
			memconnector.Query("orders",
				graph.NewNonNullListType(graph.NewNonNullType("Order")),
				ordersResponse,
			),
		},
	)
	if err != nil {
		return nil, fmt.Errorf("creating db2 memconnector: %w", err)
	}

	connectors := map[string]connector.Connector{
		"db1": db1,
		"db2": db2,
	}

	// Tell the planner that User.orders is a remote array relationship
	// targeting "db2" with join key User.id → Order.userId.
	relationships := map[string][]*planner.RelationshipMetadata{
		"db1": {
			{
				Name:              "orders",
				SourceType:        "User",
				TargetConnector:   "db2",
				TargetTable:       "orders",
				TargetTableSchema: "",
				JoinMapping:       map[string]string{"id": "userId"},
				IsArray:           true,
				IsRemote:          true,
				LHSFields:         nil,
				RemoteFieldPath:   nil,
			},
		},
	}

	return buildRemoteRelRouter(logger, connectors, relationships)
}

func BenchmarkSelectRemoteRelSimple(b *testing.B) {
	b.ReportAllocs()

	body := []byte(`{"query": "{ users { id displayName orders { id product } } }"}`)

	serveGraphQLWith(b, remoteRelHandler, body)

	b.ResetTimer()

	for b.Loop() {
		serveGraphQLWith(b, remoteRelHandler, body)
	}
}

func BenchmarkSelectRemoteRelAllFields(b *testing.B) {
	b.ReportAllocs()

	body := []byte(
		`{"query": "{ users { id displayName email orders { id userId product amount createdAt } } }"}`,
	)

	serveGraphQLWith(b, remoteRelHandler, body)

	b.ResetTimer()

	for b.Loop() {
		serveGraphQLWith(b, remoteRelHandler, body)
	}
}

func BenchmarkSelectRemoteRelParallel(b *testing.B) {
	b.ReportAllocs()

	body := []byte(`{"query": "{ users { id displayName orders { id product } } }"}`)

	serveGraphQLWith(b, remoteRelHandler, body)

	b.ResetTimer()

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			serveGraphQLWith(b, remoteRelHandler, body)
		}
	})
}
