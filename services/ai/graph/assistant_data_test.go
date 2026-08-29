package graph //nolint:testpackage // Tests exercise unexported resolver helpers.

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/Yamashou/gqlgenc/clientv2"
	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/ai/graph/middleware"
	"github.com/nhost/nhost/services/ai/graph/model"
	"github.com/nhost/nhost/services/ai/hasura"
	"github.com/nhost/nhost/services/ai/openai/api"
)

const nullAssistantResponse = `{"data":{"_graphiteAssistants":[` +
	`{"id":"row-null","assistantID":"assistant-null","data":null}` +
	`]}}`

var (
	errUnexpectedAssistantsCreateCall         = errors.New("unexpected assistants create call")
	errUnexpectedAssistantsUpdateCall         = errors.New("unexpected assistants update call")
	errUnexpectedAssistantsDeleteCall         = errors.New("unexpected assistants delete call")
	errUnexpectedFindOrCreateDevAssistantCall = errors.New(
		"unexpected find or create dev assistant call",
	)
	errUnexpectedSessionsStartCall          = errors.New("unexpected sessions start call")
	errUnexpectedSessionsMessagesCall       = errors.New("unexpected sessions messages call")
	errSessionsSendMessageShouldNotBeCalled = errors.New(
		"sessions send message should not be called",
	)
	errUnexpectedSessionsSendMessageCall     = errors.New("unexpected sessions send message call")
	errUnexpectedSessionsDeleteCall          = errors.New("unexpected sessions delete call")
	errUnexpectedFilesCreateCall             = errors.New("unexpected files create call")
	errUnexpectedFilesDeleteCall             = errors.New("unexpected files delete call")
	errUnexpectedVectorStoresCreateCall      = errors.New("unexpected vector stores create call")
	errUnexpectedVectorStoresFilesCreateCall = errors.New(
		"unexpected vector stores files create call",
	)
	errUnexpectedVectorStoreDeleteCall  = errors.New("unexpected vector store delete call")
	errUnexpectedEmbeddingsGenerateCall = errors.New("unexpected embeddings generate call")
)

type graphQLTestResponse struct {
	status int
	body   string
}

type assistantNullDataCase struct {
	name      string
	responses []graphQLTestResponse
	run       func(context.Context, *testing.T, *Resolver) error
	wantErr   error
}

func TestAssistantResolversTreatNullDataAsEmpty(t *testing.T) {
	t.Parallel()

	for _, tc := range assistantNullDataCases() {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			resolver := newGraphQLTestResolver(t, tc.responses)
			ctx := newResolverTestContext(t)

			err := tc.run(ctx, t, resolver)
			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("error = %v, want %v", err, tc.wantErr)
			}
		})
	}
}

func assistantNullDataCases() []assistantNullDataCase {
	return []assistantNullDataCase{
		{
			name: "start session assistant lookup returns not found",
			responses: []graphQLTestResponse{
				{status: http.StatusOK, body: nullAssistantResponse},
			},
			run:     runGetAssistantByID,
			wantErr: ErrAssistantNotFound,
		},
		{
			name: "assistant query returns nil",
			responses: []graphQLTestResponse{
				{status: http.StatusOK, body: nullAssistantResponse},
			},
			run: runAssistantQuery,
		},
		{
			name: "assistants query skips null entry",
			responses: []graphQLTestResponse{
				{status: http.StatusOK, body: mixedAssistantsResponse()},
			},
			run: runAssistantsQuery,
		},
		{
			name: "start session returns not found before inserting session",
			responses: []graphQLTestResponse{
				{status: http.StatusOK, body: nullAssistantResponse},
			},
			run:     runStartSession,
			wantErr: ErrAssistantNotFound,
		},
		{
			name: "send message returns not found before AI call",
			responses: []graphQLTestResponse{
				{status: http.StatusOK, body: updateSessionAssistantResponse()},
				{status: http.StatusOK, body: nullAssistantResponse},
			},
			run:     runSendMessage,
			wantErr: ErrAssistantNotFound,
		},
	}
}

func runGetAssistantByID(ctx context.Context, t *testing.T, r *Resolver) error {
	t.Helper()

	return (&mutationResolver{Resolver: r}).getAssistantByID(ctx, "assistant-null")
}

func runAssistantQuery(ctx context.Context, t *testing.T, r *Resolver) error {
	t.Helper()

	assistant, err := (&queryResolver{Resolver: r}).assistant(ctx, "assistant-null")
	if assistant != nil {
		t.Fatalf("assistant() = %#v, want nil", assistant)
	}

	return err
}

func runAssistantsQuery(ctx context.Context, t *testing.T, r *Resolver) error {
	t.Helper()

	assistants, err := (&queryResolver{Resolver: r}).assistants(ctx)
	if err != nil {
		return err
	}

	if len(assistants) != 1 || assistants[0] == nil ||
		assistants[0].AssistantID != "assistant-valid" {
		t.Fatalf("assistants() = %#v, want only assistant-valid", assistants)
	}

	return nil
}

func runStartSession(ctx context.Context, t *testing.T, r *Resolver) error {
	t.Helper()

	_, err := (&mutationResolver{Resolver: r}).startSession(ctx, "assistant-null")

	return err
}

func runSendMessage(ctx context.Context, t *testing.T, r *Resolver) error {
	t.Helper()

	var sendMessageCalls atomic.Int32

	r.ai = fakeAI{
		sessionsSendMessage: func(
			context.Context,
			string,
			string,
			string,
			*model.GraphiteAssistant,
			*slog.Logger,
		) (*model.GraphiteMessageResponse, error) {
			sendMessageCalls.Add(1)

			return nil, errSessionsSendMessageShouldNotBeCalled
		},
	}

	_, err := (&mutationResolver{Resolver: r}).sendMessage(ctx, "session-id", "hello", "")

	if got := sendMessageCalls.Load(); got != 0 {
		t.Fatalf("SessionsSendMessage calls = %d, want 0", got)
	}

	return err
}

func mixedAssistantsResponse() string {
	return `{"data":{"_graphiteAssistants":[` +
		`{"id":"row-null","assistantID":"assistant-null","data":null},` +
		`{"id":"row-valid","assistantID":"assistant-valid","data":` +
		`{"assistantID":"assistant-valid","name":"Valid","description":"Desc",` +
		`"instructions":"Inst","model":"gpt-4o-mini","fileStores":[]}}]}}`
}

func updateSessionAssistantResponse() string {
	return `{"data":{"_updateGraphiteSessions":{"returning":[{"assistantID":"assistant-null"}]}}}`
}

func TestIsEmptyData(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		data []byte
		want bool
	}{
		{name: "nil", data: nil, want: true},
		{name: "empty", data: []byte{}, want: true},
		{name: "json null", data: []byte("null"), want: true},
		{name: "spaced json null", data: []byte(" \nnull\t"), want: true},
		{name: "object", data: []byte(`{"assistantID":"assistant-id"}`), want: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := isEmptyData(tc.data); got != tc.want {
				t.Fatalf("isEmptyData(%q) = %t, want %t", tc.data, got, tc.want)
			}
		})
	}
}

func newGraphQLTestResolver(t *testing.T, responses []graphQLTestResponse) *Resolver {
	t.Helper()

	var (
		idx int
		mu  sync.Mutex
	)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		mu.Lock()
		defer mu.Unlock()

		if idx >= len(responses) {
			t.Errorf("unexpected GraphQL request #%d", idx+1)
			w.WriteHeader(http.StatusInternalServerError)

			return
		}

		response := responses[idx]
		idx++

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(response.status)
		_, _ = w.Write([]byte(response.body))
	}))
	t.Cleanup(server.Close)

	t.Cleanup(func() {
		mu.Lock()
		defer mu.Unlock()

		if idx != len(responses) {
			t.Errorf("GraphQL requests = %d, want %d", idx, len(responses))
		}
	})

	return &Resolver{
		autoai: nil,
		ai: fakeAI{
			sessionsSendMessage: nil,
		},
		hasura: hasura.NewClient(
			server.Client(),
			server.URL,
			&clientv2.Options{ParseDataAlongWithErrors: false},
		),
		devAssistant: nil,
		storage:      nil,
	}
}

func newResolverTestContext(t *testing.T) context.Context {
	t.Helper()

	recorder := httptest.NewRecorder()
	ginCtx, _ := gin.CreateTestContext(recorder)
	ginCtx.Request = httptest.NewRequest(http.MethodPost, "/graphql", nil)

	return middleware.GinToContext(context.Background(), ginCtx)
}

type fakeAI struct {
	sessionsSendMessage func(
		context.Context,
		string,
		string,
		string,
		*model.GraphiteAssistant,
		*slog.Logger,
	) (*model.GraphiteMessageResponse, error)
}

func (fakeAI) AssistantsCreate(
	context.Context,
	string,
	model.GraphiteAssistantInput,
) (string, error) {
	return "", errUnexpectedAssistantsCreateCall
}

func (fakeAI) AssistantsUpdate(context.Context, string, model.GraphiteAssistantInput) error {
	return errUnexpectedAssistantsUpdateCall
}

func (fakeAI) AssistantsDelete(context.Context, string) error {
	return errUnexpectedAssistantsDeleteCall
}

func (fakeAI) FindOrCreateDevAssistant(context.Context) (*model.GraphiteAssistant, error) {
	return nil, errUnexpectedFindOrCreateDevAssistantCall
}

func (fakeAI) SessionsStart(
	context.Context,
	string,
	string,
	[]string,
) (*model.GraphiteSession, error) {
	return nil, errUnexpectedSessionsStartCall
}

func (fakeAI) SessionsMessages(context.Context, string) (*model.GraphiteMessageResponse, error) {
	return nil, errUnexpectedSessionsMessagesCall
}

func (f fakeAI) SessionsSendMessage(
	ctx context.Context,
	sessionID string,
	message string,
	prevMessageID string,
	assistant *model.GraphiteAssistant,
	logger *slog.Logger,
) (*model.GraphiteMessageResponse, error) {
	if f.sessionsSendMessage != nil {
		return f.sessionsSendMessage(ctx, sessionID, message, prevMessageID, assistant, logger)
	}

	return nil, errUnexpectedSessionsSendMessageCall
}

func (fakeAI) SessionsDelete(context.Context, string) error {
	return errUnexpectedSessionsDeleteCall
}

func (fakeAI) FilesCreate(
	context.Context,
	io.Reader,
	string,
	*slog.Logger,
) (*api.CreateFileR, error) {
	return nil, errUnexpectedFilesCreateCall
}

func (fakeAI) FilesDelete(context.Context, string, *slog.Logger) error {
	return errUnexpectedFilesDeleteCall
}

func (fakeAI) VectorStoresCreate(context.Context, string) (*api.VectorStoreObject, error) {
	return nil, errUnexpectedVectorStoresCreateCall
}

func (fakeAI) VectorStoresFilesCreate(
	context.Context,
	string,
	string,
) (*api.VectorStoreFileObject, error) {
	return nil, errUnexpectedVectorStoresFilesCreateCall
}

func (fakeAI) VectorStoreDelete(context.Context, string) error {
	return errUnexpectedVectorStoreDeleteCall
}

func (fakeAI) EmbeddingsGenerate(
	context.Context,
	string,
	string,
) (*model.GraphiteGenerateEmbeddingsResponse, error) {
	return nil, errUnexpectedEmbeddingsGenerateCall
}
