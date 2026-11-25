package mcp

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"

	"github.com/spf13/cast"
)

// ClientRequest types
var (
	_ ClientRequest = (*PingRequest)(nil)
	_ ClientRequest = (*InitializeRequest)(nil)
	_ ClientRequest = (*CompleteRequest)(nil)
	_ ClientRequest = (*SetLevelRequest)(nil)
	_ ClientRequest = (*GetPromptRequest)(nil)
	_ ClientRequest = (*ListPromptsRequest)(nil)
	_ ClientRequest = (*ListResourcesRequest)(nil)
	_ ClientRequest = (*ReadResourceRequest)(nil)
	_ ClientRequest = (*SubscribeRequest)(nil)
	_ ClientRequest = (*UnsubscribeRequest)(nil)
	_ ClientRequest = (*CallToolRequest)(nil)
	_ ClientRequest = (*ListToolsRequest)(nil)
)

// ClientNotification types
var (
	_ ClientNotification = (*CancelledNotification)(nil)
	_ ClientNotification = (*ProgressNotification)(nil)
	_ ClientNotification = (*InitializedNotification)(nil)
	_ ClientNotification = (*RootsListChangedNotification)(nil)
)

// ClientResult types
var (
	_ ClientResult = (*EmptyResult)(nil)
	_ ClientResult = (*CreateMessageResult)(nil)
	_ ClientResult = (*ListRootsResult)(nil)
)

// ServerRequest types
var (
	_ ServerRequest = (*PingRequest)(nil)
	_ ServerRequest = (*CreateMessageRequest)(nil)
	_ ServerRequest = (*ListRootsRequest)(nil)
)

// ServerNotification types
var (
	_ ServerNotification = (*CancelledNotification)(nil)
	_ ServerNotification = (*ProgressNotification)(nil)
	_ ServerNotification = (*LoggingMessageNotification)(nil)
	_ ServerNotification = (*ResourceUpdatedNotification)(nil)
	_ ServerNotification = (*ResourceListChangedNotification)(nil)
	_ ServerNotification = (*ToolListChangedNotification)(nil)
	_ ServerNotification = (*PromptListChangedNotification)(nil)
)

// ServerResult types
var (
	_ ServerResult = (*EmptyResult)(nil)
	_ ServerResult = (*InitializeResult)(nil)
	_ ServerResult = (*CompleteResult)(nil)
	_ ServerResult = (*GetPromptResult)(nil)
	_ ServerResult = (*ListPromptsResult)(nil)
	_ ServerResult = (*ListResourcesResult)(nil)
	_ ServerResult = (*ReadResourceResult)(nil)
	_ ServerResult = (*CallToolResult)(nil)
	_ ServerResult = (*ListToolsResult)(nil)
)

// Helper functions for type assertions

// asType attempts to cast the given interface to the given type
func asType[T any](content any) (*T, bool) {
	tc, ok := content.(T)
	if !ok {
		return nil, false
	}
	return &tc, true
}

// AsTextContent attempts to cast the given interface to TextContent
func AsTextContent(content any) (*TextContent, bool) {
	return asType[TextContent](content)
}

// AsImageContent attempts to cast the given interface to ImageContent
func AsImageContent(content any) (*ImageContent, bool) {
	return asType[ImageContent](content)
}

// AsAudioContent attempts to cast the given interface to AudioContent
func AsAudioContent(content any) (*AudioContent, bool) {
	return asType[AudioContent](content)
}

// AsEmbeddedResource attempts to cast the given interface to EmbeddedResource
func AsEmbeddedResource(content any) (*EmbeddedResource, bool) {
	return asType[EmbeddedResource](content)
}

// AsToolUseContent attempts to cast the given interface to ToolUseContent
func AsToolUseContent(content any) (*ToolUseContent, bool) {
	return asType[ToolUseContent](content)
}

// AsToolResultContent attempts to cast the given interface to ToolResultContent
func AsToolResultContent(content any) (*ToolResultContent, bool) {
	return asType[ToolResultContent](content)
}

// AsTextResourceContents attempts to cast the given interface to TextResourceContents
func AsTextResourceContents(content any) (*TextResourceContents, bool) {
	return asType[TextResourceContents](content)
}

// AsBlobResourceContents attempts to cast the given interface to BlobResourceContents
func AsBlobResourceContents(content any) (*BlobResourceContents, bool) {
	return asType[BlobResourceContents](content)
}

// Helper function for JSON-RPC

// NewJSONRPCResponse creates a new JSONRPCResponse with the given id and result.
// NOTE: This function expects a Result struct, but JSONRPCResponse.Result is typed as `any`.
// The Result struct wraps the actual result data with optional metadata.
// For direct result assignment, use NewJSONRPCResultResponse instead.
func NewJSONRPCResponse(id RequestId, result Result) JSONRPCResponse {
	return JSONRPCResponse{
		JSONRPC: JSONRPC_VERSION,
		ID:      id,
		Result:  result,
	}
}

// NewJSONRPCResultResponse creates a new JSONRPCResponse with the given id and result.
// This function accepts any type for the result, matching the JSONRPCResponse.Result field type.
func NewJSONRPCResultResponse(id RequestId, result any) JSONRPCResponse {
	return JSONRPCResponse{
		JSONRPC: JSONRPC_VERSION,
		ID:      id,
		Result:  result,
	}
}

// NewJSONRPCErrorDetails creates a new JSONRPCErrorDetails with the given code, message, and data.
func NewJSONRPCErrorDetails(code int, message string, data any) JSONRPCErrorDetails {
	return JSONRPCErrorDetails{
		Code:    code,
		Message: message,
		Data:    data,
	}
}

// NewJSONRPCError creates a new JSONRPCResponse with the given id, code, and message
func NewJSONRPCError(
	id RequestId,
	code int,
	message string,
	data any,
) JSONRPCError {
	return JSONRPCError{
		JSONRPC: JSONRPC_VERSION,
		ID:      id,
		Error:   NewJSONRPCErrorDetails(code, message, data),
	}
}

// NewProgressNotification creates a progress notification.
func NewProgressNotification(
	token ProgressToken,
	progress float64,
	total *float64,
	message *string,
) ProgressNotification {
	notification := ProgressNotification{
		Notification: Notification{
			Method: string(MethodNotificationProgress),
		},
		Params: struct {
			ProgressToken ProgressToken `json:"progressToken"`
			Progress      float64       `json:"progress"`
			Total         float64       `json:"total,omitempty"`
			Message       string        `json:"message,omitempty"`
		}{
			ProgressToken: token,
			Progress:      progress,
		},
	}
	if total != nil {
		notification.Params.Total = *total
	}
	if message != nil {
		notification.Params.Message = *message
	}
	return notification
}

// NewLoggingMessageNotification creates a logging message notification.
func NewLoggingMessageNotification(
	level LoggingLevel,
	logger string,
	data any,
) LoggingMessageNotification {
	return LoggingMessageNotification{
		Notification: Notification{
			Method: string(MethodNotificationMessage),
		},
		Params: struct {
			Level  LoggingLevel `json:"level"`
			Logger string       `json:"logger,omitempty"`
			Data   any          `json:"data"`
		}{
			Level:  level,
			Logger: logger,
			Data:   data,
		},
	}
}

// NewPromptMessage creates a prompt message.
func NewPromptMessage(role Role, content Content) PromptMessage {
	return PromptMessage{
		Role:    role,
		Content: content,
	}
}

// NewTextContent creates text content.
func NewTextContent(text string) TextContent {
	return TextContent{
		Type: ContentTypeText,
		Text: text,
	}
}

// NewImageContent creates image content.
func NewImageContent(data, mimeType string) ImageContent {
	return ImageContent{
		Type:     ContentTypeImage,
		Data:     data,
		MIMEType: mimeType,
	}
}

// NewAudioContent creates audio content.
func NewAudioContent(data, mimeType string) AudioContent {
	return AudioContent{
		Type:     ContentTypeAudio,
		Data:     data,
		MIMEType: mimeType,
	}
}

// NewResourceLink creates a resource link.
func NewResourceLink(uri, name, description, mimeType string) ResourceLink {
	return ResourceLink{
		Type:        ContentTypeLink,
		URI:         uri,
		Name:        name,
		Description: description,
		MIMEType:    mimeType,
	}
}

// NewEmbeddedResource creates an embedded resource.
func NewEmbeddedResource(resource ResourceContents) EmbeddedResource {
	return EmbeddedResource{
		Type:     ContentTypeResource,
		Resource: resource,
	}
}

// NewToolUseContent creates a new ToolUseContent with the given id, tool name, and input arguments.
func NewToolUseContent(id, name string, input any) ToolUseContent {
	return ToolUseContent{
		Type:  ContentTypeToolUse,
		ID:    id,
		Name:  name,
		Input: input,
	}
}

// NewToolResultContent creates a new ToolResultContent with the given tool use ID, content, and error flag.
func NewToolResultContent(toolUseID string, content []Content, isError bool) ToolResultContent {
	return ToolResultContent{
		Type:      ContentTypeToolResult,
		ToolUseID: toolUseID,
		Content:   content,
		IsError:   isError,
	}
}

// NewToolResultText creates a new CallToolResult with a text content
func NewToolResultText(text string) *CallToolResult {
	return &CallToolResult{
		Content: []Content{
			TextContent{
				Type: ContentTypeText,
				Text: text,
			},
		},
	}
}

// NewToolResultJSON creates a new CallToolResult with a JSON content.
func NewToolResultJSON[T any](data T) (*CallToolResult, error) {
	b, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("unable to marshal JSON: %w", err)
	}

	return &CallToolResult{
		Content: []Content{
			TextContent{
				Type: ContentTypeText,
				Text: string(b),
			},
		},
		StructuredContent: data,
	}, nil
}

// NewToolResultStructured creates a new CallToolResult with structured content.
// It includes both the structured content and a text representation for backward compatibility.
func NewToolResultStructured(structured any, fallbackText string) *CallToolResult {
	return &CallToolResult{
		Content: []Content{
			TextContent{
				Type: "text",
				Text: fallbackText,
			},
		},
		StructuredContent: structured,
	}
}

// NewToolResultStructuredOnly creates a new CallToolResult with structured
// content and creates a JSON string fallback for backwards compatibility.
// This is useful when you want to provide structured data without any specific text fallback.
func NewToolResultStructuredOnly(structured any) *CallToolResult {
	var fallbackText string
	// Convert to JSON string for backward compatibility
	jsonBytes, err := json.Marshal(structured)
	if err != nil {
		return NewToolResultError(fmt.Sprintf("Error serializing structured content: %v", err))
	} else {
		fallbackText = string(jsonBytes)
	}

	return &CallToolResult{
		Content: []Content{
			TextContent{
				Type: "text",
				Text: fallbackText,
			},
		},
		StructuredContent: structured,
	}
}

// NewToolResultImage creates a new CallToolResult with both text and image content
func NewToolResultImage(text, imageData, mimeType string) *CallToolResult {
	return &CallToolResult{
		Content: []Content{
			TextContent{
				Type: ContentTypeText,
				Text: text,
			},
			ImageContent{
				Type:     ContentTypeImage,
				Data:     imageData,
				MIMEType: mimeType,
			},
		},
	}
}

// NewToolResultAudio creates a new CallToolResult with both text and audio content
func NewToolResultAudio(text, audioData, mimeType string) *CallToolResult {
	return &CallToolResult{
		Content: []Content{
			TextContent{
				Type: ContentTypeText,
				Text: text,
			},
			AudioContent{
				Type:     ContentTypeAudio,
				Data:     audioData,
				MIMEType: mimeType,
			},
		},
	}
}

// NewToolResultResource creates a new CallToolResult with an embedded resource
func NewToolResultResource(
	text string,
	resource ResourceContents,
) *CallToolResult {
	return &CallToolResult{
		Content: []Content{
			TextContent{
				Type: ContentTypeText,
				Text: text,
			},
			EmbeddedResource{
				Type:     ContentTypeResource,
				Resource: resource,
			},
		},
	}
}

// NewToolResultError creates a new CallToolResult with an error message.
// Any errors that originate from the tool SHOULD be reported inside the result object.
func NewToolResultError(text string) *CallToolResult {
	return &CallToolResult{
		Content: []Content{
			TextContent{
				Type: ContentTypeText,
				Text: text,
			},
		},
		IsError: true,
	}
}

// NewToolResultErrorFromErr creates a new CallToolResult with an error message.
// If an error is provided, its details will be appended to the text message.
// Any errors that originate from the tool SHOULD be reported inside the result object.
func NewToolResultErrorFromErr(text string, err error) *CallToolResult {
	if err != nil {
		text = fmt.Sprintf("%s: %v", text, err)
	}
	return &CallToolResult{
		Content: []Content{
			TextContent{
				Type: ContentTypeText,
				Text: text,
			},
		},
		IsError: true,
	}
}

// NewToolResultErrorf creates a new CallToolResult with an error message.
// The error message is formatted using the fmt package.
// Any errors that originate from the tool SHOULD be reported inside the result object.
func NewToolResultErrorf(format string, a ...any) *CallToolResult {
	return &CallToolResult{
		Content: []Content{
			TextContent{
				Type: ContentTypeText,
				Text: fmt.Sprintf(format, a...),
			},
		},
		IsError: true,
	}
}

// NewListResourcesResult creates a new ListResourcesResult
func NewListResourcesResult(
	resources []Resource,
	nextCursor Cursor,
) *ListResourcesResult {
	return &ListResourcesResult{
		PaginatedResult: PaginatedResult{
			NextCursor: nextCursor,
		},
		Resources: resources,
	}
}

// NewListResourceTemplatesResult creates a new ListResourceTemplatesResult
func NewListResourceTemplatesResult(
	templates []ResourceTemplate,
	nextCursor Cursor,
) *ListResourceTemplatesResult {
	return &ListResourceTemplatesResult{
		PaginatedResult: PaginatedResult{
			NextCursor: nextCursor,
		},
		ResourceTemplates: templates,
	}
}

// NewReadResourceResult creates a new ReadResourceResult with text content
func NewReadResourceResult(text string) *ReadResourceResult {
	return &ReadResourceResult{
		Contents: []ResourceContents{
			TextResourceContents{
				Text: text,
			},
		},
	}
}

// NewListPromptsResult creates a new ListPromptsResult
func NewListPromptsResult(
	prompts []Prompt,
	nextCursor Cursor,
) *ListPromptsResult {
	return &ListPromptsResult{
		PaginatedResult: PaginatedResult{
			NextCursor: nextCursor,
		},
		Prompts: prompts,
	}
}

// NewGetPromptResult creates a new GetPromptResult
func NewGetPromptResult(
	description string,
	messages []PromptMessage,
) *GetPromptResult {
	return &GetPromptResult{
		Description: description,
		Messages:    messages,
	}
}

// NewListToolsResult creates a new ListToolsResult
func NewListToolsResult(tools []Tool, nextCursor Cursor) *ListToolsResult {
	return &ListToolsResult{
		PaginatedResult: PaginatedResult{
			NextCursor: nextCursor,
		},
		Tools: tools,
	}
}

// NewInitializeResult creates a new InitializeResult
func NewInitializeResult(
	protocolVersion string,
	capabilities ServerCapabilities,
	serverInfo Implementation,
	instructions string,
) *InitializeResult {
	return &InitializeResult{
		ProtocolVersion: protocolVersion,
		Capabilities:    capabilities,
		ServerInfo:      serverInfo,
		Instructions:    instructions,
	}
}

// FormatNumberResult formats a number as a tool result.
func FormatNumberResult(value float64) *CallToolResult {
	return NewToolResultText(fmt.Sprintf("%.2f", value))
}

func ExtractString(data map[string]any, key string) string {
	if value, ok := data[key]; ok {
		if str, ok := value.(string); ok {
			return str
		}
	}
	return ""
}

// ParseAnnotations parses priority, audience, and lastModified fields from the provided map
// and returns an Annotations struct populated with any valid values found.
// If data is nil, ParseAnnotations returns nil. Priority is set when a numeric value can be
// parsed and is stored as a *float64. Audience is populated from string values and includes
// only RoleUser and RoleAssistant entries. LastModified is set when the value is a string.
func ParseAnnotations(data map[string]any) *Annotations {
	if data == nil {
		return nil
	}
	annotations := &Annotations{}
	if value, ok := data["priority"]; ok {
		if value != nil {
			if priority, err := cast.ToFloat64E(value); err == nil {
				annotations.Priority = &priority
			}
		}
	}

	if value, ok := data["audience"]; ok {
		for _, a := range cast.ToStringSlice(value) {
			a := Role(a)
			if a == RoleUser || a == RoleAssistant {
				annotations.Audience = append(annotations.Audience, a)
			}
		}
	}

	if value, ok := data["lastModified"]; ok {
		if str, ok := value.(string); ok {
			annotations.LastModified = str
		}
	}
	return annotations

}

func ExtractMap(data map[string]any, key string) map[string]any {
	if value, ok := data[key]; ok {
		if m, ok := value.(map[string]any); ok {
			return m
		}
	}
	return nil
}

// ParseContent parses a generic map into a strongly-typed Content value.
// It extracts annotations and _meta fields from the map and sets them on
// the returned content type.
func ParseContent(contentMap map[string]any) (Content, error) {
	contentType := ExtractString(contentMap, "type")

	var annotations *Annotations
	if annotationsMap := ExtractMap(contentMap, "annotations"); annotationsMap != nil {
		annotations = ParseAnnotations(annotationsMap)
	}

	var meta *Meta
	if metaMap := ExtractMap(contentMap, "_meta"); metaMap != nil {
		meta = NewMetaFromMap(metaMap)
	}

	switch contentType {
	case ContentTypeText:
		text := ExtractString(contentMap, "text")
		c := NewTextContent(text)
		c.Annotations = annotations
		c.Meta = meta
		return c, nil

	case ContentTypeImage:
		data := ExtractString(contentMap, "data")
		mimeType := ExtractString(contentMap, "mimeType")
		if data == "" || mimeType == "" {
			return nil, fmt.Errorf("image data or mimeType is missing")
		}
		c := NewImageContent(data, mimeType)
		c.Annotations = annotations
		c.Meta = meta
		return c, nil

	case ContentTypeAudio:
		data := ExtractString(contentMap, "data")
		mimeType := ExtractString(contentMap, "mimeType")
		if data == "" || mimeType == "" {
			return nil, fmt.Errorf("audio data or mimeType is missing")
		}
		c := NewAudioContent(data, mimeType)
		c.Annotations = annotations
		c.Meta = meta
		return c, nil

	case ContentTypeLink:
		uri := ExtractString(contentMap, "uri")
		name := ExtractString(contentMap, "name")
		description := ExtractString(contentMap, "description")
		mimeType := ExtractString(contentMap, "mimeType")
		if uri == "" || name == "" {
			return nil, fmt.Errorf("resource_link uri or name is missing")
		}
		c := NewResourceLink(uri, name, description, mimeType)
		c.Title = ExtractString(contentMap, "title")
		if value, ok := contentMap["size"]; ok && value != nil {
			if size, err := cast.ToInt64E(value); err == nil && size >= 0 {
				c.Size = &size
			}
		}
		c.Annotations = annotations
		c.Meta = meta
		return c, nil

	case ContentTypeResource:
		resourceMap := ExtractMap(contentMap, "resource")
		if resourceMap == nil {
			return nil, fmt.Errorf("resource is missing")
		}

		resourceContents, err := ParseResourceContents(resourceMap)
		if err != nil {
			return nil, err
		}

		c := NewEmbeddedResource(resourceContents)
		c.Annotations = annotations
		c.Meta = meta
		return c, nil

	case ContentTypeToolUse:
		id := ExtractString(contentMap, "id")
		if id == "" {
			return nil, fmt.Errorf("tool_use id is missing")
		}
		name := ExtractString(contentMap, "name")
		if name == "" {
			return nil, fmt.Errorf("tool_use name is missing")
		}
		input := contentMap["input"]
		c := NewToolUseContent(id, name, input)
		c.Annotations = annotations
		c.Meta = meta
		return c, nil

	case ContentTypeToolResult:
		toolUseID := ExtractString(contentMap, "toolUseId")
		if toolUseID == "" {
			return nil, fmt.Errorf("tool_result toolUseId is missing")
		}
		isError, _ := contentMap["isError"].(bool)
		var contentItems []Content
		if rawContent, ok := contentMap["content"].([]any); ok {
			for i, item := range rawContent {
				itemMap, ok := item.(map[string]any)
				if !ok {
					return nil, fmt.Errorf("tool_result content[%d]: expected object, got %T", i, item)
				}
				parsed, err := ParseContent(itemMap)
				if err != nil {
					return nil, fmt.Errorf("parsing tool result content[%d]: %w", i, err)
				}
				contentItems = append(contentItems, parsed)
			}
		}
		c := NewToolResultContent(toolUseID, contentItems, isError)
		c.StructuredContent = contentMap["structuredContent"]
		c.Annotations = annotations
		c.Meta = meta
		return c, nil
	}

	return nil, fmt.Errorf("unsupported content type: %s", contentType)
}

// ParseSamplingContent parses the content of a SamplingMessage that was
// decoded into generic JSON values. A single content block is returned as a
// Content and an array of blocks as a []Content. Any other value, such as
// content that is already typed, is returned unchanged.
func ParseSamplingContent(content any) (any, error) {
	switch c := content.(type) {
	case map[string]any:
		return ParseContent(c)
	case []any:
		blocks := make([]Content, 0, len(c))
		for i, item := range c {
			itemMap, ok := item.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("content[%d]: expected object, got %T", i, item)
			}
			block, err := ParseContent(itemMap)
			if err != nil {
				return nil, fmt.Errorf("content[%d]: %w", i, err)
			}
			blocks = append(blocks, block)
		}
		return blocks, nil
	default:
		return content, nil
	}
}

// resultEnvelope holds the fields a result carries outside its payload: the
// SEP-2322 round-trip fields and the SEP-2549 cache hints.
type resultEnvelope struct {
	ResultType    ResultType    `json:"resultType"`
	InputRequests InputRequests `json:"inputRequests"`
	RequestState  string        `json:"requestState"`
	TTLMs         *int64        `json:"ttlMs"`
	CacheScope    CacheScope    `json:"cacheScope"`
}

// parseResultEnvelope decodes the envelope of a result whose payload holds
// interface values and therefore has to be walked by hand.
func parseResultEnvelope(rawMessage json.RawMessage) (resultEnvelope, error) {
	var envelope resultEnvelope
	if err := json.Unmarshal(rawMessage, &envelope); err != nil {
		return resultEnvelope{}, fmt.Errorf("failed to unmarshal response: %w", err)
	}
	return envelope, nil
}

func ParseGetPromptResult(rawMessage *json.RawMessage) (*GetPromptResult, error) {
	if rawMessage == nil {
		return nil, fmt.Errorf("response is nil")
	}

	var jsonContent map[string]any
	if err := json.Unmarshal(*rawMessage, &jsonContent); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	envelope, err := parseResultEnvelope(*rawMessage)
	if err != nil {
		return nil, err
	}

	result := GetPromptResult{}
	result.ResultType = envelope.ResultType
	result.InputRequests = envelope.InputRequests
	result.RequestState = envelope.RequestState

	meta, ok := jsonContent["_meta"]
	if ok {
		if metaMap, ok := meta.(map[string]any); ok {
			result.Meta = NewMetaFromMap(metaMap)
		}
	}

	description, ok := jsonContent["description"]
	if ok {
		if descriptionStr, ok := description.(string); ok {
			result.Description = descriptionStr
		}
	}

	// A null payload is treated like an absent one: an input_required result
	// carries no messages, and so does a zero-valued GetPromptResult.
	messages, ok := jsonContent["messages"]
	if ok && messages != nil {
		messagesArr, ok := messages.([]any)
		if !ok {
			return nil, fmt.Errorf("messages is not an array")
		}

		result.Messages = make([]PromptMessage, 0, len(messagesArr))
		for _, message := range messagesArr {
			messageMap, ok := message.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("message is not an object")
			}

			// Extract role
			roleStr := ExtractString(messageMap, "role")
			if roleStr == "" || (roleStr != string(RoleAssistant) && roleStr != string(RoleUser)) {
				return nil, fmt.Errorf("unsupported role: %s", roleStr)
			}

			// Extract content
			contentMap, ok := messageMap["content"].(map[string]any)
			if !ok {
				return nil, fmt.Errorf("content is not an object")
			}

			// Process content
			content, err := ParseContent(contentMap)
			if err != nil {
				return nil, err
			}

			// Append processed message
			result.Messages = append(result.Messages, NewPromptMessage(Role(roleStr), content))

		}
	}

	return &result, nil
}

func ParseCallToolResult(rawMessage *json.RawMessage) (*CallToolResult, error) {
	if rawMessage == nil {
		return nil, fmt.Errorf("response is nil")
	}

	var probe struct {
		Content           json.RawMessage `json:"content"`
		StructuredContent json.RawMessage `json:"structuredContent"`
		ResultType        ResultType      `json:"resultType"`
	}
	if err := json.Unmarshal(*rawMessage, &probe); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}
	// A structured-only result, and a result asking for more input (SEP-2322)
	// that carries only the input requests and the request state, legitimately
	// have no content. A null structuredContent counts as missing.
	hasStructured := len(probe.StructuredContent) > 0 && !bytes.Equal(bytes.TrimSpace(probe.StructuredContent), []byte("null"))
	if probe.Content == nil && !hasStructured && probe.ResultType != ResultTypeInputRequired {
		return nil, fmt.Errorf("content is missing")
	}

	var result CallToolResult
	if err := json.Unmarshal(*rawMessage, &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &result, nil
}

func ParseResourceContents(contentMap map[string]any) (ResourceContents, error) {
	uri := ExtractString(contentMap, "uri")
	if uri == "" {
		return nil, fmt.Errorf("resource uri is missing")
	}

	mimeType := ExtractString(contentMap, "mimeType")

	meta := ExtractMap(contentMap, "_meta")

	if _, present := contentMap["_meta"]; present && meta == nil {
		return nil, fmt.Errorf("_meta must be an object")
	}

	// Select the variant on the presence of a string "text" or "blob" field,
	// not on its emptiness. An empty resource is still a resource, and both
	// fields marshal unconditionally, so treating "" as absent rejected
	// payloads this library itself produces.
	if text, ok := contentMap["text"].(string); ok {
		return TextResourceContents{
			Meta:     meta,
			URI:      uri,
			MIMEType: mimeType,
			Text:     text,
		}, nil
	}

	if blob, ok := contentMap["blob"].(string); ok {
		return BlobResourceContents{
			Meta:     meta,
			URI:      uri,
			MIMEType: mimeType,
			Blob:     blob,
		}, nil
	}

	return nil, fmt.Errorf("unsupported resource type")
}

func ParseReadResourceResult(rawMessage *json.RawMessage) (*ReadResourceResult, error) {
	if rawMessage == nil {
		return nil, fmt.Errorf("response is nil")
	}

	var jsonContent map[string]any
	if err := json.Unmarshal(*rawMessage, &jsonContent); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	envelope, err := parseResultEnvelope(*rawMessage)
	if err != nil {
		return nil, err
	}

	var result ReadResourceResult
	result.ResultType = envelope.ResultType
	result.InputRequests = envelope.InputRequests
	result.RequestState = envelope.RequestState
	result.TTLMs = envelope.TTLMs
	result.CacheScope = envelope.CacheScope

	meta, ok := jsonContent["_meta"]
	if ok {
		if metaMap, ok := meta.(map[string]any); ok {
			result.Meta = NewMetaFromMap(metaMap)
		}
	}

	contents, ok := jsonContent["contents"]
	if !ok || contents == nil {
		// An input_required result asks for more input instead of returning
		// contents, so the payload is legitimately absent.
		if result.NeedsInput() {
			return &result, nil
		}
		return nil, fmt.Errorf("contents is missing")
	}

	contentArr, ok := contents.([]any)
	if !ok {
		return nil, fmt.Errorf("contents is not an array")
	}

	result.Contents = make([]ResourceContents, 0, len(contentArr))
	for _, content := range contentArr {
		// Extract content
		contentMap, ok := content.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("content is not an object")
		}

		// Process content
		content, err := ParseResourceContents(contentMap)
		if err != nil {
			return nil, err
		}

		result.Contents = append(result.Contents, content)
	}

	return &result, nil
}

func ParseArgument(request CallToolRequest, key string, defaultVal any) any {
	args := request.GetArguments()
	if _, ok := args[key]; !ok {
		return defaultVal
	} else {
		return args[key]
	}
}

// ParseBoolean extracts and converts a boolean parameter from a CallToolRequest.
// If the key is not found in the Arguments map, the defaultValue is returned.
// The function uses cast.ToBool for conversion which handles various string representations
// such as "true", "yes", "1", etc.
func ParseBoolean(request CallToolRequest, key string, defaultValue bool) bool {
	v := ParseArgument(request, key, defaultValue)
	return cast.ToBool(v)
}

// checkedSignedInteger validates before narrowing or crossing signedness. Float
// bounds are exact powers of two with an exclusive upper bound, since converting
// MaxInt64 or MaxUint64 to float64 rounds up to an unrepresentable integer.
func checkedSignedInteger(value any, bits int) (int64, bool) {
	switch v := value.(type) {
	case string:
		n, err := strconv.ParseInt(strings.TrimSpace(v), 10, bits)
		return n, err == nil
	case json.Number:
		return checkedSignedInteger(string(v), bits)
	case int64:
		max := int64(uint64(1)<<(bits-1) - 1)
		return v, v >= -max-1 && v <= max
	case uint64:
		max := uint64(1)<<(bits-1) - 1
		if v > max {
			return 0, false
		}
		return int64(v), true
	case float64:
		if math.IsNaN(v) || math.IsInf(v, 0) {
			return 0, false
		}
		n := math.Trunc(v)
		bound := math.Ldexp(1, bits-1)
		if n < -bound || n >= bound {
			return 0, false
		}
		return int64(n), true
	case int:
		return checkedSignedInteger(int64(v), bits)
	case int8:
		return checkedSignedInteger(int64(v), bits)
	case int16:
		return checkedSignedInteger(int64(v), bits)
	case int32:
		return checkedSignedInteger(int64(v), bits)
	case uint:
		return checkedSignedInteger(uint64(v), bits)
	case uint8:
		return checkedSignedInteger(uint64(v), bits)
	case uint16:
		return checkedSignedInteger(uint64(v), bits)
	case uint32:
		return checkedSignedInteger(uint64(v), bits)
	case float32:
		return checkedSignedInteger(float64(v), bits)
	case bool:
		if v {
			return 1, true
		}
		return 0, true
	default:
		return 0, false
	}
}

// checkedUnsignedInteger never routes unsigned integers through int64 and
// rejects negative floats before truncation, including fractions above -1.
func checkedUnsignedInteger(value any, bits int) (uint64, bool) {
	switch v := value.(type) {
	case string:
		n, err := strconv.ParseUint(strings.TrimSpace(v), 10, bits)
		return n, err == nil
	case json.Number:
		return checkedUnsignedInteger(string(v), bits)
	case uint64:
		max := ^uint64(0) >> (64 - bits)
		return v, v <= max
	case int64:
		if v < 0 {
			return 0, false
		}
		return checkedUnsignedInteger(uint64(v), bits)
	case float64:
		if math.IsNaN(v) || math.IsInf(v, 0) {
			return 0, false
		}
		n := math.Trunc(v)
		if v < 0 || n >= math.Ldexp(1, bits) {
			return 0, false
		}
		return uint64(n), true
	case int:
		return checkedUnsignedInteger(int64(v), bits)
	case int8:
		return checkedUnsignedInteger(int64(v), bits)
	case int16:
		return checkedUnsignedInteger(int64(v), bits)
	case int32:
		return checkedUnsignedInteger(int64(v), bits)
	case uint:
		return checkedUnsignedInteger(uint64(v), bits)
	case uint8:
		return checkedUnsignedInteger(uint64(v), bits)
	case uint16:
		return checkedUnsignedInteger(uint64(v), bits)
	case uint32:
		return checkedUnsignedInteger(uint64(v), bits)
	case float32:
		return checkedUnsignedInteger(float64(v), bits)
	case bool:
		if v {
			return 1, true
		}
		return 0, true
	default:
		return 0, false
	}
}

// ParseInt64 extracts and converts an int64 parameter from a CallToolRequest.
// It accepts built-in integers, floats (truncated toward zero), bools (0/1),
// strings and json.Number. Strings and json.Number use trimmed base-10 integer
// syntax with an optional sign; prefixes, decimal points and exponents are invalid.
// Missing, nil, unsupported (including pointers and named types), invalid or
// out-of-range values (including non-finite floats) return defaultValue.
func ParseInt64(request CallToolRequest, key string, defaultValue int64) int64 {
	v, ok := checkedSignedInteger(ParseArgument(request, key, defaultValue), 64)
	if !ok {
		return defaultValue
	}
	return v
}

// ParseInt32 extracts and converts an int32 parameter from a CallToolRequest.
// It accepts built-in integers, floats (truncated toward zero), bools (0/1),
// strings and json.Number. Strings and json.Number use trimmed base-10 integer
// syntax with an optional sign; prefixes, decimal points and exponents are invalid.
// Missing, nil, unsupported (including pointers and named types), invalid or
// out-of-range values (including non-finite floats) return defaultValue.
func ParseInt32(request CallToolRequest, key string, defaultValue int32) int32 {
	v, ok := checkedSignedInteger(ParseArgument(request, key, defaultValue), 32)
	if !ok {
		return defaultValue
	}
	return int32(v)
}

// ParseInt16 extracts and converts an int16 parameter from a CallToolRequest.
// It accepts built-in integers, floats (truncated toward zero), bools (0/1),
// strings and json.Number. Strings and json.Number use trimmed base-10 integer
// syntax with an optional sign; prefixes, decimal points and exponents are invalid.
// Missing, nil, unsupported (including pointers and named types), invalid or
// out-of-range values (including non-finite floats) return defaultValue.
func ParseInt16(request CallToolRequest, key string, defaultValue int16) int16 {
	v, ok := checkedSignedInteger(ParseArgument(request, key, defaultValue), 16)
	if !ok {
		return defaultValue
	}
	return int16(v)
}

// ParseInt8 extracts and converts an int8 parameter from a CallToolRequest.
// It accepts built-in integers, floats (truncated toward zero), bools (0/1),
// strings and json.Number. Strings and json.Number use trimmed base-10 integer
// syntax with an optional sign; prefixes, decimal points and exponents are invalid.
// Missing, nil, unsupported (including pointers and named types), invalid or
// out-of-range values (including non-finite floats) return defaultValue.
func ParseInt8(request CallToolRequest, key string, defaultValue int8) int8 {
	v, ok := checkedSignedInteger(ParseArgument(request, key, defaultValue), 8)
	if !ok {
		return defaultValue
	}
	return int8(v)
}

// ParseInt extracts and converts an int parameter from a CallToolRequest.
// It accepts built-in integers, floats (truncated toward zero), bools (0/1),
// strings and json.Number. Strings and json.Number use trimmed base-10 integer
// syntax with an optional sign; prefixes, decimal points and exponents are invalid.
// Missing, nil, unsupported (including pointers and named types), invalid or
// out-of-range values (including non-finite floats) return defaultValue.
func ParseInt(request CallToolRequest, key string, defaultValue int) int {
	v, ok := checkedSignedInteger(ParseArgument(request, key, defaultValue), strconv.IntSize)
	if !ok {
		return defaultValue
	}
	return int(v)
}

// ParseUInt extracts and converts a uint parameter from a CallToolRequest.
// It accepts built-in integers, floats (truncated toward zero), bools (0/1),
// strings and json.Number. Strings and json.Number use trimmed base-10 integer
// syntax without a sign; prefixes, decimal points and exponents are invalid.
// Negative numeric values return defaultValue, even fractional values above -1.
// Missing, nil, unsupported (including pointers and named types), invalid or
// out-of-range values (including non-finite floats) return defaultValue.
func ParseUInt(request CallToolRequest, key string, defaultValue uint) uint {
	v, ok := checkedUnsignedInteger(ParseArgument(request, key, defaultValue), strconv.IntSize)
	if !ok {
		return defaultValue
	}
	return uint(v)
}

// ParseUInt64 extracts and converts a uint64 parameter from a CallToolRequest.
// It accepts built-in integers, floats (truncated toward zero), bools (0/1),
// strings and json.Number. Strings and json.Number use trimmed base-10 integer
// syntax without a sign; prefixes, decimal points and exponents are invalid.
// Negative numeric values return defaultValue, even fractional values above -1.
// Missing, nil, unsupported (including pointers and named types), invalid or
// out-of-range values (including non-finite floats) return defaultValue.
func ParseUInt64(request CallToolRequest, key string, defaultValue uint64) uint64 {
	v, ok := checkedUnsignedInteger(ParseArgument(request, key, defaultValue), 64)
	if !ok {
		return defaultValue
	}
	return v
}

// ParseUInt32 extracts and converts a uint32 parameter from a CallToolRequest.
// It accepts built-in integers, floats (truncated toward zero), bools (0/1),
// strings and json.Number. Strings and json.Number use trimmed base-10 integer
// syntax without a sign; prefixes, decimal points and exponents are invalid.
// Negative numeric values return defaultValue, even fractional values above -1.
// Missing, nil, unsupported (including pointers and named types), invalid or
// out-of-range values (including non-finite floats) return defaultValue.
func ParseUInt32(request CallToolRequest, key string, defaultValue uint32) uint32 {
	v, ok := checkedUnsignedInteger(ParseArgument(request, key, defaultValue), 32)
	if !ok {
		return defaultValue
	}
	return uint32(v)
}

// ParseUInt16 extracts and converts a uint16 parameter from a CallToolRequest.
// It accepts built-in integers, floats (truncated toward zero), bools (0/1),
// strings and json.Number. Strings and json.Number use trimmed base-10 integer
// syntax without a sign; prefixes, decimal points and exponents are invalid.
// Negative numeric values return defaultValue, even fractional values above -1.
// Missing, nil, unsupported (including pointers and named types), invalid or
// out-of-range values (including non-finite floats) return defaultValue.
func ParseUInt16(request CallToolRequest, key string, defaultValue uint16) uint16 {
	v, ok := checkedUnsignedInteger(ParseArgument(request, key, defaultValue), 16)
	if !ok {
		return defaultValue
	}
	return uint16(v)
}

// ParseUInt8 extracts and converts a uint8 parameter from a CallToolRequest.
// It accepts built-in integers, floats (truncated toward zero), bools (0/1),
// strings and json.Number. Strings and json.Number use trimmed base-10 integer
// syntax without a sign; prefixes, decimal points and exponents are invalid.
// Negative numeric values return defaultValue, even fractional values above -1.
// Missing, nil, unsupported (including pointers and named types), invalid or
// out-of-range values (including non-finite floats) return defaultValue.
func ParseUInt8(request CallToolRequest, key string, defaultValue uint8) uint8 {
	v, ok := checkedUnsignedInteger(ParseArgument(request, key, defaultValue), 8)
	if !ok {
		return defaultValue
	}
	return uint8(v)
}

// ParseFloat32 extracts and converts a float32 parameter from a CallToolRequest.
func ParseFloat32(request CallToolRequest, key string, defaultValue float32) float32 {
	v := ParseArgument(request, key, defaultValue)
	return cast.ToFloat32(v)
}

// ParseFloat64 extracts and converts a float64 parameter from a CallToolRequest.
func ParseFloat64(request CallToolRequest, key string, defaultValue float64) float64 {
	v := ParseArgument(request, key, defaultValue)
	return cast.ToFloat64(v)
}

// ParseString extracts and converts a string parameter from a CallToolRequest.
func ParseString(request CallToolRequest, key string, defaultValue string) string {
	v := ParseArgument(request, key, defaultValue)
	return cast.ToString(v)
}

// ParseStringMap extracts and converts a string map parameter from a CallToolRequest.
func ParseStringMap(request CallToolRequest, key string, defaultValue map[string]any) map[string]any {
	v := ParseArgument(request, key, defaultValue)
	return cast.ToStringMap(v)
}

// ToBoolPtr returns a pointer to the given boolean value
func ToBoolPtr(b bool) *bool {
	return &b
}

// ToInt64Ptr returns a pointer to the given int64 value
func ToInt64Ptr(i int64) *int64 {
	return &i
}

// GetTextFromContent extracts text from a Content interface that might be a TextContent struct
// or a map[string]any that was unmarshaled from JSON. This is useful when dealing with content
// that comes from different transport layers that may handle JSON differently.
//
// This function uses fallback behavior for non-text content - it returns a string representation
// via fmt.Sprintf for any content that cannot be extracted as text. This is a lossy operation
// intended for convenience in logging and display scenarios.
//
// For strict type validation, use ParseContent() instead, which returns an error for invalid content.
func GetTextFromContent(content any) string {
	switch c := content.(type) {
	case TextContent:
		return c.Text
	case map[string]any:
		// Handle JSON unmarshaled content
		if contentType, exists := c["type"]; exists && contentType == "text" {
			if text, exists := c["text"].(string); exists {
				return text
			}
		}
		return fmt.Sprintf("%v", content)
	case string:
		return c
	default:
		return fmt.Sprintf("%v", content)
	}
}

// ParseCancelTaskResult parses a JSON message and converts it to a CancelTaskResult.
func ParseCancelTaskResult(rawMessage *json.RawMessage) (*CancelTaskResult, error) {
	if rawMessage == nil {
		return nil, fmt.Errorf("response is nil")
	}
	var result CancelTaskResult
	if err := json.Unmarshal(*rawMessage, &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}
	return &result, nil
}

// ParseListTasksResult parses a JSON message and converts it to a ListTasksResult.
func ParseListTasksResult(rawMessage *json.RawMessage) (*ListTasksResult, error) {
	if rawMessage == nil {
		return nil, fmt.Errorf("response is nil")
	}
	var result ListTasksResult
	if err := json.Unmarshal(*rawMessage, &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}
	return &result, nil
}

// ParseTaskResultResult parses a JSON message and converts it to a TaskResultResult.
func ParseTaskResultResult(rawMessage *json.RawMessage) (*TaskResultResult, error) {
	if rawMessage == nil {
		return nil, fmt.Errorf("response is nil")
	}

	// Content holds interface values, so it is decoded element by element -
	// the same shape CallToolResult.UnmarshalJSON handles.
	var raw struct {
		Meta              *Meta             `json:"_meta"`
		ResultType        ResultType        `json:"resultType"`
		Content           []json.RawMessage `json:"content"`
		StructuredContent json.RawMessage   `json:"structuredContent"`
		IsError           bool              `json:"isError"`
	}
	if err := json.Unmarshal(*rawMessage, &raw); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	resultResult := TaskResultResult{
		Result:               Result{Meta: raw.Meta, ResultType: raw.ResultType},
		RawStructuredContent: raw.StructuredContent,
		IsError:              raw.IsError,
	}

	if len(raw.StructuredContent) > 0 {
		if err := json.Unmarshal(raw.StructuredContent, &resultResult.StructuredContent); err != nil {
			return nil, fmt.Errorf("unmarshal task structured content: %w", err)
		}
	}

	for _, item := range raw.Content {
		content, err := UnmarshalContent(item)
		if err != nil {
			return nil, fmt.Errorf("unmarshal task result content: %w", err)
		}
		resultResult.Content = append(resultResult.Content, content)
	}

	return &resultResult, nil
}

// ParseGetTaskResult parses a JSON message and converts it to a GetTaskResult.
func ParseGetTaskResult(rawMessage *json.RawMessage) (*GetTaskResult, error) {
	if rawMessage == nil {
		return nil, fmt.Errorf("response is nil")
	}
	var result GetTaskResult
	if err := json.Unmarshal(*rawMessage, &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}
	return &result, nil
}
