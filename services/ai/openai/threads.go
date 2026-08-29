package openai

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/nhost/nhost/services/ai/graph/model"
	"github.com/nhost/nhost/services/ai/openai/api"
)

func logJSON(name string, object any) slog.Attr {
	b, _ := json.Marshal(object) //nolint:errchkjson
	return slog.Any(name, string(b))
}

func (cl *Client) SessionsStart(
	ctx context.Context,
	userID string,
	assistantID string,
	vectorStoreIDs []string,
) (*model.GraphiteSession, error) {
	metadata := map[string]any{
		"assistant": assistantID,
		"user_id":   userID,
	}

	content := api.CreateMessageRequest_Content{}
	if err := content.FromCreateMessageRequestContent0("start"); err != nil {
		return nil, fmt.Errorf("error converting message content: %w", err)
	}

	threadr, err := cl.oai.CreateThreadWithResponse(
		ctx,
		api.CreateThreadJSONRequestBody{
			Messages: &[]api.CreateMessageRequest{
				{ //nolint:exhaustruct
					Role:     api.CreateMessageRequestRoleUser,
					Metadata: nil,
					Content:  content,
				},
			},
			Metadata: &metadata,
			ToolResources: &struct { //nolint:exhaustruct
				CodeInterpreter *struct {
					FileIds *[]string `json:"file_ids,omitempty"` //nolint: revive
				} `json:"code_interpreter,omitempty"`
				FileSearch *api.CreateThreadRequest_ToolResources_FileSearch `json:"file_search,omitempty"`
			}{
				FileSearch: func() *api.CreateThreadRequest_ToolResources_FileSearch {
					if len(vectorStoreIDs) == 0 {
						return nil
					}

					return &api.CreateThreadRequest_ToolResources_FileSearch{ //nolint:exhaustruct
						VectorStoreIds: &vectorStoreIDs,
					}
				}(),
			},
		},
	)
	if err != nil {
		return nil, fmt.Errorf("error creating thread: %w", err)
	}

	if err := handleReponseStatus(threadr, threadr.Body); err != nil {
		return nil, err
	}

	return &model.GraphiteSession{
		SessionID:   threadr.JSON200.Id,
		AssistantID: assistantID,
		UserID:      userID,
		CreatedAt:   time.Unix(int64(threadr.JSON200.CreatedAt), 0),
	}, nil
}

func (cl *Client) SessionsSendMessage(
	ctx context.Context,
	sessionID, message, prevMessageID string,
	assistant *model.GraphiteAssistant,
	logger *slog.Logger,
) (*model.GraphiteMessageResponse, error) {
	logger.DebugContext(ctx, "sending message...")

	msg, err := cl.sendMessage(ctx, sessionID, message)
	if err != nil {
		return nil, fmt.Errorf("error sending message: %w", err)
	}

	logger.DebugContext(ctx, "message sent", logJSON("response", msg))

	logger.DebugContext(ctx, "running thread...")

	run, err := cl.run(ctx, sessionID, assistant.AssistantID)
	if err != nil {
		return nil, fmt.Errorf("error running thread: %w", err)
	}

	logger.DebugContext(ctx, "thread running", logJSON("response", run))

OUTER:
	for {
		logger.DebugContext(ctx, "getting run...")

		run, err := cl.getRun(ctx, run.Id, sessionID)
		if err != nil {
			return nil, fmt.Errorf("error getting run: %w", err)
		}

		logger.DebugContext(ctx, "run retrieved", logJSON("response", run))

		switch run.Status {
		case api.RunObjectStatusIncomplete:
		case api.RunObjectStatusCompleted:
			break OUTER
		case api.RunObjectStatusRequiresAction:
			if err := cl.processRequiredActions(ctx, assistant, run, logger); err != nil {
				return nil, fmt.Errorf("error processing required actions: %w", err)
			}
		case api.RunObjectStatusInProgress, api.RunObjectStatusQueued:
		case api.RunObjectStatusCancelled,
			api.RunObjectStatusFailed,
			api.RunObjectStatusExpired,
			api.RunObjectStatusCancelling:
			return nil, fmt.Errorf("unexpected run status: %s", run.Status) //nolint:err113
		default:
			return nil, fmt.Errorf("unknown run status: %s", run.Status) //nolint:err113
		}

		time.Sleep(500 * time.Millisecond) //nolint:mnd
	}

	logger.DebugContext(ctx, "getting messages...")

	messages, err := cl.getMessages(ctx, sessionID, prevMessageID)
	if err != nil {
		return nil, fmt.Errorf("error getting messages: %w", err)
	}

	logger.DebugContext(ctx, "messages retrieved", logJSON("response", messages))

	return messages, nil
}

func (cl *Client) sendMessage(
	ctx context.Context, sessionID, message string,
) (*api.MessageObject, error) {
	content := api.CreateMessageRequest_Content{}
	if err := content.FromCreateMessageRequestContent0(message); err != nil {
		return nil, fmt.Errorf("error converting message content: %w", err)
	}

	resp, err := cl.oai.CreateMessageWithResponse(
		ctx,
		sessionID,
		api.CreateMessageJSONRequestBody{ //nolint:exhaustruct
			Content:  content,
			Metadata: &map[string]any{},
			Role:     api.CreateMessageRequestRoleUser,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("error sending message: %w", err)
	}

	if err := handleReponseStatus(resp, resp.Body); err != nil {
		return nil, err
	}

	return resp.JSON200, nil
}

func (cl *Client) run(
	ctx context.Context,
	sessionID string,
	assistantID string,
) (*api.RunObject, error) {
	resp, err := cl.oai.CreateRunWithResponse(
		ctx,
		sessionID,
		api.CreateRunJSONRequestBody{ //nolint:exhaustruct
			AssistantId:            assistantID,
			AdditionalInstructions: nil,
			AdditionalMessages:     nil,
			Instructions:           nil,
			Metadata:               nil,
			Model:                  nil,
			Stream:                 nil,
			Temperature:            nil,
			Tools:                  nil,
			MaxCompletionTokens:    nil,
			MaxPromptTokens:        nil,
			ResponseFormat:         nil,
			ToolChoice:             nil,
			TopP:                   nil,
			TruncationStrategy:     nil,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("error running thread: %w", err)
	}

	if err := handleReponseStatus(resp, resp.Body); err != nil {
		return nil, err
	}

	return resp.JSON200, nil
}

func (cl *Client) getRun(
	ctx context.Context,
	runID string,
	threadID string,
) (*api.RunObject, error) {
	resp, err := cl.oai.GetRunWithResponse(
		ctx,
		threadID,
		runID,
	)
	if err != nil {
		return nil, fmt.Errorf("error getting run: %w", err)
	}

	if err := handleReponseStatus(resp, resp.Body); err != nil {
		return nil, err
	}

	return resp.JSON200, nil
}

func (cl *Client) getMessages(
	ctx context.Context,
	sessionID, lastMessageID string,
) (*model.GraphiteMessageResponse, error) {
	resp, err := cl.oai.ListMessagesWithResponse(
		ctx,
		sessionID,
		&api.ListMessagesParams{
			RunId:  nil,
			Limit:  nil,
			Order:  new(api.ListMessagesParamsOrderAsc),
			After:  new(lastMessageID),
			Before: nil,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("error listing messages: %w", err)
	}

	if err := handleReponseStatus(resp, resp.Body); err != nil {
		return nil, err
	}

	res := &model.GraphiteMessageResponse{
		Messages:  make([]*model.GraphiteMessage, 0, len(resp.JSON200.Data)),
		SessionID: sessionID,
	}

	for _, message := range resp.JSON200.Data {
		c := make([]string, 0, len(message.Content))
		for _, content := range message.Content {
			m, err := content.AsMessageContentTextObject()
			if err != nil {
				return nil, fmt.Errorf("error getting message content: %w", err)
			}

			c = append(c, m.Text.Value)
		}

		res.Messages = append(res.Messages, &model.GraphiteMessage{
			ID:        message.Id,
			Role:      string(message.Role),
			Message:   strings.Join(c, "\n"),
			CreatedAt: time.Unix(int64(message.CreatedAt), 0),
		})
	}

	return res, nil
}

func (cl *Client) processRequiredActions(
	ctx context.Context,
	assistant *model.GraphiteAssistant,
	run *api.RunObject,
	logger *slog.Logger,
) error {
	if run.RequiredAction == nil || run.RequiredAction.Type != api.SubmitToolOutputs {
		return NewUnexpectedResponseError(
			fmt.Sprintf("unexpected required action: %v", run.RequiredAction), run,
		)
	}

	toolsOutputs := make([]struct {
		Output     *string `json:"output,omitempty"`
		ToolCallId *string `json:"tool_call_id,omitempty"` //nolint:revive,tagliatelle
	}, len(run.RequiredAction.SubmitToolOutputs.ToolCalls))

	for i, tool := range run.RequiredAction.SubmitToolOutputs.ToolCalls {
		if tool.Type != api.Function {
			return NewUnexpectedResponseError(
				fmt.Sprintf("unexpected tool type: %v", tool.Type),
				run,
			)
		}

		logger.DebugContext(ctx, "running tool...", logJSON("tool", tool))
		toolOutput := cl.runTool(ctx, assistant, tool, logger.WithGroup("tool"))
		logger.DebugContext(ctx, "tool ran", logJSON("output", toolOutput))

		toolsOutputs[i] = struct {
			Output     *string `json:"output,omitempty"`
			ToolCallId *string `json:"tool_call_id,omitempty"` //nolint:revive,tagliatelle
		}{
			Output:     &toolOutput,
			ToolCallId: &tool.Id,
		}
	}

	submit, err := cl.oai.SubmitToolOuputsToRunWithResponse(
		ctx,
		run.ThreadId,
		run.Id,
		api.SubmitToolOutputsRunRequest{
			ToolOutputs: toolsOutputs,
			Stream:      nil,
		},
	)
	if err != nil {
		return fmt.Errorf("error submitting tool outputs: %w", err)
	}

	return handleReponseStatus(submit, submit.Body)
}

func (cl *Client) getToolFromAssistant(assistant *model.GraphiteAssistant, toolName string) toolFn {
	for _, tool := range assistant.Graphql {
		if tool.Name == toolName {
			return graphqlToolWrapper(cl.graphqlURL, cl.adminSecret, tool.Query)
		}
	}

	for _, tool := range assistant.Webhooks {
		if tool.Name == toolName {
			return webhookToolWrapper(tool.URL)
		}
	}

	return nil
}

func (cl *Client) runTool(
	ctx context.Context,
	assistant *model.GraphiteAssistant,
	toolCall api.RunToolCallObject,
	logger *slog.Logger,
) string {
	var fn toolFn

	if assistant.Name == devAssistantName {
		switch toolCall.Function.Name {
		case "list_sql_tables":
			fn = listSQLTables(cl.pgConnString)
		case "get_sql_schema":
			fn = toolGetSQLSchema(cl.pgConnString)
		case "get_graphql_schema_layout":
			fn = toolGetGraphqlLayout(cl.graphqlURL, cl.adminSecret)
		case "get_graphql_schema_method":
			fn = toolGetGraphqlMethod(cl.graphqlURL, cl.adminSecret)
		default:
			return "tool not found for dev assistant"
		}
	} else {
		fn = cl.getToolFromAssistant(assistant, toolCall.Function.Name)
		if fn == nil {
			logger.ErrorContext(ctx, "tool not found", slog.String("name", toolCall.Function.Name))
			return "tool not found"
		}
	}

	return fn(
		ctx,
		toolCall.Function.Arguments,
		logger.With(
			slog.String("name", toolCall.Function.Name),
			slog.String("arguments", toolCall.Function.Arguments),
		),
	)
}

type toolFn func(ctx context.Context, arguments string, logger *slog.Logger) string

func (cl *Client) SessionsMessages(
	ctx context.Context, sessionID string,
) (*model.GraphiteMessageResponse, error) {
	messages, err := cl.oai.ListMessagesWithResponse(
		ctx,
		sessionID,
		&api.ListMessagesParams{
			RunId:  nil,
			Limit:  new(maxListElements),
			Order:  new(api.ListMessagesParamsOrderAsc),
			After:  nil,
			Before: nil,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("error listing messages: %w", err)
	}

	if err := handleReponseStatus(messages, messages.Body); err != nil {
		return nil, err
	}

	res := &model.GraphiteMessageResponse{
		Messages:  make([]*model.GraphiteMessage, len(messages.JSON200.Data)),
		SessionID: sessionID,
	}

	for i, message := range messages.JSON200.Data {
		c := make([]string, 0, len(message.Content))
		for _, content := range message.Content {
			m, err := content.AsMessageContentTextObject()
			if err != nil {
				return nil, fmt.Errorf("error getting message content: %w", err)
			}

			c = append(c, m.Text.Value)
		}

		res.Messages[i] = &model.GraphiteMessage{
			ID:        message.Id,
			Role:      string(message.Role),
			Message:   strings.Join(c, "\n"),
			CreatedAt: time.Unix(int64(message.CreatedAt), 0),
		}
	}

	return res, nil
}

func (cl *Client) SessionsDelete(
	ctx context.Context, id string,
) error {
	resp, err := cl.oai.DeleteThreadWithResponse(
		ctx,
		id,
	)
	if err != nil {
		return fmt.Errorf("error deleting assistant: %w", err)
	}

	return handleReponseStatus(resp, resp.Body)
}
