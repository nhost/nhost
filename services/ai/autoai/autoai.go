package autoai

import (
	"context"

	"github.com/gqlgo/gqlgenc/clientv2"
	"github.com/nhost/nhost/services/ai/autoai/embedder"
	"github.com/nhost/nhost/services/ai/hasura"
)

// HasuraClient is the configuration deployment boundary.
//
//go:generate mockgen -package mock -destination mock/hasura.go . HasuraClient
type HasuraClient interface {
	SetAiAutoEmbeddingsConfigurationLastError(
		ctx context.Context,
		id string,
		lastError *string,
		interceptors ...clientv2.RequestInterceptor,
	) (*hasura.SetAiAutoEmbeddingsConfigurationLastError, error)
	RunSQL(ctx context.Context, query string, readOnly bool) (*hasura.RunSQLResponse, error)
	TrackFunction(ctx context.Context, schema string, name string) error
	UntrackFunction(ctx context.Context, schema string, name string) error
	GetAiAutoEmbeddingsConfigurations(
		ctx context.Context,
		where *hasura.AiAutoEmbeddingsConfigurationBoolExp,
		interceptors ...clientv2.RequestInterceptor,
	) (*hasura.GetAiAutoEmbeddingsConfigurations, error)
}

type AutoAI struct {
	hasuraClient  HasuraClient
	catalog       Catalog
	providers     embedder.Registry
	aiBaseURL     string
	webhookSecret string
}

func NewAutoAI(
	hasuraClient HasuraClient,
	catalog Catalog,
	providers embedder.Registry,
	aiBaseURL string,
	webhookSecret string,
) *AutoAI {
	return &AutoAI{
		hasuraClient:  hasuraClient,
		catalog:       catalog,
		providers:     providers,
		aiBaseURL:     aiBaseURL,
		webhookSecret: webhookSecret,
	}
}
