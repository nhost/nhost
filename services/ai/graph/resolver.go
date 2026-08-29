package graph

import (
	"context"
	"errors"
	"io"
	"log/slog"

	"github.com/nhost/nhost/services/ai/autoai"
	"github.com/nhost/nhost/services/ai/graph/model"
	"github.com/nhost/nhost/services/ai/hasura"
	"github.com/nhost/nhost/services/ai/openai/api"
	sapi "github.com/nhost/nhost/services/ai/storage/api"
)

// ErrAssistantNotFound is returned when an assistant is not found.
var ErrAssistantNotFound = errors.New("assistant not found")

type aiAssistant interface {
	AssistantsCreate(
		ctx context.Context, id string, input model.GraphiteAssistantInput,
	) (string, error)
	AssistantsUpdate(
		ctx context.Context,
		id string,
		input model.GraphiteAssistantInput,
	) error
	AssistantsDelete(ctx context.Context, id string) error
	FindOrCreateDevAssistant(
		ctx context.Context,
	) (*model.GraphiteAssistant, error)
}

type aiSession interface {
	SessionsStart(
		ctx context.Context,
		userID string,
		assistantID string,
		vectorStoreIDs []string,
	) (*model.GraphiteSession, error)
	SessionsMessages(ctx context.Context, sessionID string) (*model.GraphiteMessageResponse, error)
	SessionsSendMessage(
		ctx context.Context,
		sessionID, message, prevMessageID string,
		assistant *model.GraphiteAssistant,
		logger *slog.Logger,
	) (*model.GraphiteMessageResponse, error)
	SessionsDelete(ctx context.Context, sessionID string) error
}

type aiFile interface {
	FilesCreate(
		ctx context.Context,
		file io.Reader,
		filename string,
		logger *slog.Logger,
	) (*api.CreateFileR, error)
	FilesDelete(
		ctx context.Context,
		id string,
		logger *slog.Logger,
	) error
}

type aiVectorStore interface {
	VectorStoresCreate(
		ctx context.Context,
		bucket string,
	) (*api.VectorStoreObject, error)
	VectorStoresFilesCreate(
		ctx context.Context,
		vectorStoreID string,
		fileID string,
	) (*api.VectorStoreFileObject, error)
	VectorStoreDelete(
		ctx context.Context,
		id string,
	) error
}

type aiEmbeddings interface {
	EmbeddingsGenerate(
		ctx context.Context,
		input string,
		embeddingsModel string,
	) (*model.GraphiteGenerateEmbeddingsResponse, error)
}

type AI interface {
	aiEmbeddings
	aiFile
	aiVectorStore
	aiAssistant
	aiSession
}

type Resolver struct {
	autoai       *autoai.AutoAI
	ai           AI
	hasura       *hasura.Client
	devAssistant *model.GraphiteAssistant
	storage      *sapi.ClientWithResponses
}

func NewResolver(
	autoai *autoai.AutoAI,
	ai AI,
	hasura *hasura.Client,
	storage *sapi.ClientWithResponses,
) *Resolver {
	return &Resolver{
		autoai:       autoai,
		ai:           ai,
		hasura:       hasura,
		storage:      storage,
		devAssistant: nil,
	}
}
