package agents

import (
	"context"
	"database/sql"
	"maps"
	"net/http"
	"time"

	"github.com/Yamashou/gqlgenc/clientv2"
	"github.com/nhost/nhost/services/ai/agents/provider"
	"github.com/nhost/nhost/services/ai/hasura"
)

// ToolConfig holds credentials used by optional agent tools.
type ToolConfig struct {
	BraveKey  string
	TavilyKey string
}

// agentSessionGetter abstracts the Hasura call used for authorization.
type agentSessionGetter interface {
	GetAgentSession(
		ctx context.Context,
		id string,
		interceptors ...clientv2.RequestInterceptor,
	) (*hasura.GetAgentSession, error)
}

// hasuraClient abstracts the Hasura calls used by the agent service. *hasura.Client
// satisfies this interface; tests may substitute a mock.
//
//go:generate mockgen -package mock -destination mock/client.go --source=agents.go hasuraClient
type hasuraClient interface {
	GetAgent(
		ctx context.Context,
		id string,
		interceptors ...clientv2.RequestInterceptor,
	) (*hasura.GetAgent, error)
	GetAgentSession(
		ctx context.Context,
		id string,
		interceptors ...clientv2.RequestInterceptor,
	) (*hasura.GetAgentSession, error)
	GetAgentMessages(
		ctx context.Context,
		where *hasura.AiAgentMessagesBoolExp,
		interceptors ...clientv2.RequestInterceptor,
	) (*hasura.GetAgentMessages, error)
	InsertAgentMessages(
		ctx context.Context,
		objects []*hasura.AiAgentMessagesInsertInput,
		interceptors ...clientv2.RequestInterceptor,
	) (*hasura.InsertAgentMessages, error)
}

type sessionLocker func(ctx context.Context, sessionID string) (func(), error)

// Service is the main agents service.
type Service struct {
	hasura      hasuraClient
	hasuraAuth  agentSessionGetter
	db          *sql.DB
	providers   provider.Registry
	tools       ToolConfig
	baseURL     string
	adminSecret string
	graphqlURL  string
	lockSession sessionLocker
}

// NewService creates a new agents service. db is used for per-session advisory
// locking and may be shared with other components; NewService does not take
// ownership of it. Returns nil when no providers are configured so callers
// can omit the agent routes entirely rather than register handlers that would
// fail at request time.
func NewService(
	hc *hasura.Client,
	db *sql.DB,
	providers provider.Registry,
	tools ToolConfig,
	baseURL string,
	adminSecret string,
	hasuraURL string,
) *Service {
	if len(providers) == 0 {
		return nil
	}

	authClient := hasura.NewClient(
		&http.Client{}, //nolint:exhaustruct
		hasuraURL,
		&clientv2.Options{
			ParseDataAlongWithErrors: false,
		},
	)

	return &Service{
		hasura:      hc,
		hasuraAuth:  authClient,
		db:          db,
		providers:   maps.Clone(providers),
		tools:       tools,
		baseURL:     baseURL,
		adminSecret: adminSecret,
		graphqlURL:  hasuraURL,
		lockSession: nil,
	}
}

// Agent represents an agent configuration.
type Agent struct {
	ID           string         `json:"id"`
	Name         string         `json:"name"`
	Description  string         `json:"description"`
	Instructions string         `json:"instructions"`
	Provider     string         `json:"provider"`
	Model        string         `json:"model"`
	ToolsConfig  map[string]any `json:"tools_config"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
}

// Session represents an agent session.
type Session struct {
	ID        string    `json:"id"`
	AgentID   string    `json:"agent_id"`
	UserID    string    `json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
}
