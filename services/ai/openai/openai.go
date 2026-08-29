package openai

import (
	"context"

	"github.com/nhost/nhost/services/ai/openai/api"
)

const (
	maxListElements = 100
)

type CreateFileJSONRequestBody = api.CreateFileRequest

type filesInterface interface {
	DeleteFileWithResponse(
		ctx context.Context,
		fileID string,
		reqEditors ...api.RequestEditorFn,
	) (*api.DeleteFileR, error)
}

type vectorStoresInterface interface {
	CreateVectorStoreWithResponse(
		ctx context.Context,
		body api.CreateVectorStoreJSONRequestBody,
		reqEditors ...api.RequestEditorFn,
	) (*api.CreateVectorStoreR, error)
	ListVectorStoresWithResponse(
		ctx context.Context,
		params *api.ListVectorStoresParams,
		reqEditors ...api.RequestEditorFn,
	) (*api.ListVectorStoresR, error)
	CreateVectorStoreFileWithResponse(
		ctx context.Context,
		vectorStoreID string,
		body api.CreateVectorStoreFileJSONRequestBody,
		reqEditors ...api.RequestEditorFn,
	) (*api.CreateVectorStoreFileR, error)
	DeleteVectorStoreWithResponse(
		ctx context.Context,
		vectorStoreID string,
		reqEditors ...api.RequestEditorFn,
	) (*api.DeleteVectorStoreR, error)
	ListVectorStoreFilesWithResponse(
		ctx context.Context,
		vectorStoreID string,
		params *api.ListVectorStoreFilesParams,
		reqEditors ...api.RequestEditorFn,
	) (*api.ListVectorStoreFilesR, error)
}

type embeddingsInterface interface {
	CreateEmbeddingWithResponse(
		ctx context.Context,
		body api.CreateEmbeddingJSONRequestBody,
		reqEditors ...api.RequestEditorFn,
	) (*api.CreateEmbeddingR, error)
}

//nolint:revive
type assistantsInterface interface {
	GetAssistantWithResponse(
		ctx context.Context, assistantId string, reqEditors ...api.RequestEditorFn,
	) (*api.GetAssistantR, error)
	ListAssistantsWithResponse(
		ctx context.Context, params *api.ListAssistantsParams, reqEditors ...api.RequestEditorFn,
	) (*api.ListAssistantsR, error)
	CreateAssistantWithResponse(
		ctx context.Context, body api.CreateAssistantJSONRequestBody, reqEditors ...api.RequestEditorFn,
	) (*api.CreateAssistantR, error)
	ModifyAssistantWithResponse(
		ctx context.Context,
		assistantId string,
		body api.ModifyAssistantJSONRequestBody,
		reqEditors ...api.RequestEditorFn,
	) (*api.ModifyAssistantR, error)
	DeleteAssistantWithResponse(
		ctx context.Context, assistantId string, reqEditors ...api.RequestEditorFn,
	) (*api.DeleteAssistantR, error)
}

//nolint:revive
type threadsInterface interface {
	CreateThreadWithResponse(
		ctx context.Context,
		body api.CreateThreadJSONRequestBody,
		reqEditors ...api.RequestEditorFn,
	) (*api.CreateThreadR, error)
	CreateMessageWithResponse(
		ctx context.Context,
		threadId string,
		body api.CreateMessageJSONRequestBody,
		reqEditors ...api.RequestEditorFn,
	) (*api.CreateMessageR, error)
	CreateRunWithResponse(
		ctx context.Context,
		threadId string,
		body api.CreateRunJSONRequestBody,
		reqEditors ...api.RequestEditorFn,
	) (*api.CreateRunR, error)
	GetRunWithResponse(
		ctx context.Context,
		threadId string,
		runId string,
		reqEditors ...api.RequestEditorFn,
	) (*api.GetRunR, error)
	ListMessagesWithResponse(
		ctx context.Context,
		threadId string,
		params *api.ListMessagesParams,
		reqEditors ...api.RequestEditorFn,
	) (*api.ListMessagesR, error)
	GetThreadWithResponse(
		ctx context.Context,
		threadId string,
		reqEditors ...api.RequestEditorFn,
	) (*api.GetThreadR, error)
	SubmitToolOuputsToRunWithResponse(
		ctx context.Context,
		threadId string,
		runId string,
		body api.SubmitToolOuputsToRunJSONRequestBody,
		reqEditors ...api.RequestEditorFn,
	) (*api.SubmitToolOuputsToRunR, error)
	DeleteThreadWithResponse(
		ctx context.Context, threadId string, reqEditors ...api.RequestEditorFn,
	) (*api.DeleteThreadR, error)
}

//go:generate mockgen -package mock -destination mock/client.go --source=openai.go ClientWithResponsesInterface
type ClientWithResponsesInterface interface {
	embeddingsInterface
	assistantsInterface
	threadsInterface
	filesInterface
	vectorStoresInterface
}

type CustomClientWithResponsesInterface interface {
	CreateFileWithResponse(
		ctx context.Context,
		body CreateFileJSONRequestBody,
		reqEditors ...api.RequestEditorFn,
	) (*api.CreateFileR, error)
}

type Client struct {
	oai          ClientWithResponsesInterface
	coai         CustomClientWithResponsesInterface
	graphqlURL   string
	adminSecret  string
	pgConnString string
}

func New(
	oai ClientWithResponsesInterface,
	coai CustomClientWithResponsesInterface,
	graphqlURL string,
	adminSecret string,
	pgConnString string,
) *Client {
	return &Client{
		oai:          oai,
		coai:         coai,
		graphqlURL:   graphqlURL,
		adminSecret:  adminSecret,
		pgConnString: pgConnString,
	}
}
