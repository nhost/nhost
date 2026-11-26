package mcp

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"math/big"
	"net/http"
	"os"
	"reflect"
	"slices"
	"strconv"
	"strings"
)

var errToolSchemaConflict = errors.New("provide either InputSchema or RawInputSchema, not both")

// ListToolsRequest is sent from the client to request a list of tools the
// server has.
type ListToolsRequest struct {
	PaginatedRequest
	Header http.Header `json:"-"`
}

// ListToolsResult is the server's response to a tools/list request from the
// client.
type ListToolsResult struct {
	PaginatedResult
	Tools []Tool `json:"tools"`
}

// CallToolResult is the server's response to a tool call.
//
// Any errors that originate from the tool SHOULD be reported inside the result
// object, with `isError` set to true, _not_ as an MCP protocol-level error
// response. Otherwise, the LLM would not be able to see that an error occurred
// and self-correct.
//
// However, any errors in _finding_ the tool, an error indicating that the
// server does not support tool calls, or any other exceptional conditions,
// should be reported as an MCP error response.
type CallToolResult struct {
	Result
	MultiRoundTripResult
	Content []Content `json:"content"` // Can be TextContent, ImageContent, AudioContent, or EmbeddedResource
	// Structured content returned as a JSON object in the structuredContent field of a result.
	// For backwards compatibility, a tool that returns structured content SHOULD also return
	// functionally equivalent unstructured content.
	StructuredContent any `json:"structuredContent,omitempty"`
	// RawStructuredContent preserves the original JSON bytes for structuredContent when
	// unmarshaled from a wire message.
	RawStructuredContent json.RawMessage `json:"-"`
	// Whether the tool call ended in an error.
	//
	// If not set, this is assumed to be false (the call was successful).
	IsError bool `json:"isError,omitempty"`
}

// CallToolRequest is used by the client to invoke a tool provided by the server.
type CallToolRequest struct {
	Request
	Header http.Header    `json:"-"` // HTTP headers from the original request
	Params CallToolParams `json:"params"`
}

type CallToolParams struct {
	Name      string      `json:"name"`
	Arguments any         `json:"arguments,omitempty"`
	Meta      *Meta       `json:"_meta,omitempty"`
	Task      *TaskParams `json:"task,omitempty"`
	MultiRoundTripParams
	// RawArguments preserves the original JSON bytes for arguments when unmarshaled
	// from a wire message. This avoids precision loss for integers above 2^53.
	RawArguments json.RawMessage `json:"-"`
}

// GetArguments returns the Arguments as map[string]any for backward compatibility
// If Arguments is not a map, it returns an empty map
func (r CallToolRequest) GetArguments() map[string]any {
	if args, ok := r.Params.Arguments.(map[string]any); ok {
		return args
	}
	return nil
}

// GetRawArguments returns the original arguments payload when available.
// For JSON-RPC requests this is json.RawMessage; otherwise it falls back to Arguments.
func (r CallToolRequest) GetRawArguments() any {
	if len(r.Params.RawArguments) > 0 {
		return r.Params.RawArguments
	}
	return r.Params.Arguments
}

// BindArguments unmarshals the Arguments into the provided struct
// This is useful for working with strongly-typed arguments
func (r CallToolRequest) BindArguments(target any) error {
	if target == nil || reflect.ValueOf(target).Kind() != reflect.Pointer {
		return fmt.Errorf("target must be a non-nil pointer")
	}

	if len(r.Params.RawArguments) > 0 {
		return json.Unmarshal(r.Params.RawArguments, target)
	}

	// Fast-path: already raw JSON
	if raw, ok := r.Params.Arguments.(json.RawMessage); ok {
		return json.Unmarshal(raw, target)
	}

	data, err := json.Marshal(r.Params.Arguments)
	if err != nil {
		return fmt.Errorf("failed to marshal arguments: %w", err)
	}

	return json.Unmarshal(data, target)
}

// GetString returns a string argument by key, or the default value if not found
func (r CallToolRequest) GetString(key string, defaultValue string) string {
	args := r.GetArguments()
	if val, ok := args[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return defaultValue
}

// UnmarshalJSON preserves the original arguments JSON while also populating Arguments.
func (p *CallToolParams) UnmarshalJSON(data []byte) error {
	type params struct {
		Name      string          `json:"name"`
		Arguments json.RawMessage `json:"arguments"`
		Meta      *Meta           `json:"_meta,omitempty"`
		Task      *TaskParams     `json:"task,omitempty"`
		MultiRoundTripParams
	}

	var raw params
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	p.Name = raw.Name
	p.Meta = raw.Meta
	p.Task = raw.Task
	p.MultiRoundTripParams = raw.MultiRoundTripParams
	p.Arguments = nil
	p.RawArguments = nil

	if len(raw.Arguments) == 0 {
		return nil
	}

	p.RawArguments = raw.Arguments
	return json.Unmarshal(raw.Arguments, &p.Arguments)
}

// MarshalJSON re-emits preserved raw arguments when available.
func (p CallToolParams) MarshalJSON() ([]byte, error) {
	if len(p.RawArguments) > 0 {
		type params struct {
			Name      string          `json:"name"`
			Arguments json.RawMessage `json:"arguments,omitempty"`
			Meta      *Meta           `json:"_meta,omitempty"`
			Task      *TaskParams     `json:"task,omitempty"`
			MultiRoundTripParams
		}
		return json.Marshal(params{
			Name:                 p.Name,
			Arguments:            p.RawArguments,
			Meta:                 p.Meta,
			Task:                 p.Task,
			MultiRoundTripParams: p.MultiRoundTripParams,
		})
	}

	type alias CallToolParams
	return json.Marshal(alias(p))
}

// RequireString returns a string argument by key, or an error if not found or not a string
func (r CallToolRequest) RequireString(key string) (string, error) {
	args := r.GetArguments()
	if val, ok := args[key]; ok {
		if str, ok := val.(string); ok {
			return str, nil
		}
		return "", fmt.Errorf("argument %q is not a string", key)
	}
	return "", fmt.Errorf("required argument %q not found", key)
}

// rawIntArgument parses an exact int argument from RawArguments when present.
func (r CallToolRequest) rawIntArgument(key string) (int, bool) {
	return parseRawInt(r.rawArgument(key))
}

func (r CallToolRequest) rawArgument(key string) json.RawMessage {
	if len(r.Params.RawArguments) == 0 {
		return nil
	}
	var rawMap map[string]json.RawMessage
	if err := json.Unmarshal(r.Params.RawArguments, &rawMap); err != nil {
		return nil
	}
	return rawMap[key]
}

func (r CallToolRequest) rawArgumentSlice(key string) []json.RawMessage {
	var items []json.RawMessage
	if err := json.Unmarshal(r.rawArgument(key), &items); err != nil {
		return nil
	}
	return items
}

func parseRawInt(rawVal json.RawMessage) (int, bool) {
	s := strings.TrimSpace(string(rawVal))
	if i, err := strconv.Atoi(s); err == nil {
		return i, true
	}
	if len(s) > 64 || !strings.ContainsAny(s, ".eE") {
		return 0, false
	}
	f, err := strconv.ParseFloat(s, 64)
	if err != nil || (f > -1 && f < 1) || f < float64(math.MinInt) || f > float64(math.MaxInt) {
		return 0, false
	}
	rat, ok := new(big.Rat).SetString(s)
	if !ok || !rat.IsInt() {
		return 0, false
	}
	i, err := strconv.Atoi(rat.Num().String())
	if err != nil {
		return 0, false
	}
	return i, true
}

// GetInt returns an int argument by key, or the default value if not found
func (r CallToolRequest) GetInt(key string, defaultValue int) int {
	args := r.GetArguments()
	if val, ok := args[key]; ok {
		switch v := val.(type) {
		case int:
			return v
		case float64:
			if i, ok := r.rawIntArgument(key); ok {
				return i
			}
			return int(v)
		case string:
			if i, err := strconv.Atoi(v); err == nil {
				return i
			}
		}
	}
	return defaultValue
}

// RequireInt returns an int argument by key, or an error if not found or not convertible to int
func (r CallToolRequest) RequireInt(key string) (int, error) {
	args := r.GetArguments()
	if val, ok := args[key]; ok {
		switch v := val.(type) {
		case int:
			return v, nil
		case float64:
			if i, ok := r.rawIntArgument(key); ok {
				return i, nil
			}
			return int(v), nil
		case string:
			if i, err := strconv.Atoi(v); err == nil {
				return i, nil
			}
			return 0, fmt.Errorf("argument %q cannot be converted to int", key)
		default:
			return 0, fmt.Errorf("argument %q is not an int", key)
		}
	}
	return 0, fmt.Errorf("required argument %q not found", key)
}

// GetFloat returns a float64 argument by key, or the default value if not found
func (r CallToolRequest) GetFloat(key string, defaultValue float64) float64 {
	args := r.GetArguments()
	if val, ok := args[key]; ok {
		switch v := val.(type) {
		case float64:
			return v
		case int:
			return float64(v)
		case string:
			if f, err := strconv.ParseFloat(v, 64); err == nil {
				return f
			}
		}
	}
	return defaultValue
}

// RequireFloat returns a float64 argument by key, or an error if not found or not convertible to float64
func (r CallToolRequest) RequireFloat(key string) (float64, error) {
	args := r.GetArguments()
	if val, ok := args[key]; ok {
		switch v := val.(type) {
		case float64:
			return v, nil
		case int:
			return float64(v), nil
		case string:
			if f, err := strconv.ParseFloat(v, 64); err == nil {
				return f, nil
			}
			return 0, fmt.Errorf("argument %q cannot be converted to float64", key)
		default:
			return 0, fmt.Errorf("argument %q is not a float64", key)
		}
	}
	return 0, fmt.Errorf("required argument %q not found", key)
}

// GetBool returns a bool argument by key, or the default value if not found
func (r CallToolRequest) GetBool(key string, defaultValue bool) bool {
	args := r.GetArguments()
	if val, ok := args[key]; ok {
		switch v := val.(type) {
		case bool:
			return v
		case string:
			if b, err := strconv.ParseBool(v); err == nil {
				return b
			}
		case int:
			return v != 0
		case float64:
			return v != 0
		}
	}
	return defaultValue
}

// RequireBool returns a bool argument by key, or an error if not found or not convertible to bool
func (r CallToolRequest) RequireBool(key string) (bool, error) {
	args := r.GetArguments()
	if val, ok := args[key]; ok {
		switch v := val.(type) {
		case bool:
			return v, nil
		case string:
			if b, err := strconv.ParseBool(v); err == nil {
				return b, nil
			}
			return false, fmt.Errorf("argument %q cannot be converted to bool", key)
		case int:
			return v != 0, nil
		case float64:
			return v != 0, nil
		default:
			return false, fmt.Errorf("argument %q is not a bool", key)
		}
	}
	return false, fmt.Errorf("required argument %q not found", key)
}

// GetStringSlice returns a string slice argument by key, or the default value if not found
func (r CallToolRequest) GetStringSlice(key string, defaultValue []string) []string {
	args := r.GetArguments()
	if val, ok := args[key]; ok {
		switch v := val.(type) {
		case []string:
			return v
		case []any:
			result := make([]string, 0, len(v))
			for _, item := range v {
				if str, ok := item.(string); ok {
					result = append(result, str)
				}
			}
			return result
		}
	}
	return defaultValue
}

// RequireStringSlice returns a string slice argument by key, or an error if not found or not convertible to string slice
func (r CallToolRequest) RequireStringSlice(key string) ([]string, error) {
	args := r.GetArguments()
	if val, ok := args[key]; ok {
		switch v := val.(type) {
		case []string:
			return v, nil
		case []any:
			result := make([]string, 0, len(v))
			for i, item := range v {
				if str, ok := item.(string); ok {
					result = append(result, str)
				} else {
					return nil, fmt.Errorf("item %d in argument %q is not a string", i, key)
				}
			}
			return result, nil
		default:
			return nil, fmt.Errorf("argument %q is not a string slice", key)
		}
	}
	return nil, fmt.Errorf("required argument %q not found", key)
}

// GetIntSlice returns an int slice argument by key, or the default value if not found.
// When raw JSON arguments are available, representable integer elements retain their exact values.
func (r CallToolRequest) GetIntSlice(key string, defaultValue []int) []int {
	args := r.GetArguments()
	if val, ok := args[key]; ok {
		switch v := val.(type) {
		case []int:
			return v
		case []any:
			rawItems := r.rawArgumentSlice(key)
			result := make([]int, 0, len(v))
			for i, item := range v {
				switch num := item.(type) {
				case int:
					result = append(result, num)
				case float64:
					if i < len(rawItems) {
						if exact, ok := parseRawInt(rawItems[i]); ok {
							result = append(result, exact)
							continue
						}
					}
					result = append(result, int(num))
				case string:
					if i, err := strconv.Atoi(num); err == nil {
						result = append(result, i)
					}
				}
			}
			return result
		}
	}
	return defaultValue
}

// RequireIntSlice returns an int slice argument by key, or an error if not found or not convertible to int slice.
// When raw JSON arguments are available, representable integer elements retain their exact values.
func (r CallToolRequest) RequireIntSlice(key string) ([]int, error) {
	args := r.GetArguments()
	if val, ok := args[key]; ok {
		switch v := val.(type) {
		case []int:
			return v, nil
		case []any:
			rawItems := r.rawArgumentSlice(key)
			result := make([]int, 0, len(v))
			for i, item := range v {
				switch num := item.(type) {
				case int:
					result = append(result, num)
				case float64:
					if i < len(rawItems) {
						if exact, ok := parseRawInt(rawItems[i]); ok {
							result = append(result, exact)
							continue
						}
					}
					result = append(result, int(num))
				case string:
					if n, err := strconv.Atoi(num); err == nil {
						result = append(result, n)
					} else {
						return nil, fmt.Errorf("item %d in argument %q cannot be converted to int", i, key)
					}
				default:
					return nil, fmt.Errorf("item %d in argument %q is not an int", i, key)
				}
			}
			return result, nil
		default:
			return nil, fmt.Errorf("argument %q is not an int slice", key)
		}
	}
	return nil, fmt.Errorf("required argument %q not found", key)
}

// GetFloatSlice returns a float64 slice argument by key, or the default value if not found
func (r CallToolRequest) GetFloatSlice(key string, defaultValue []float64) []float64 {
	args := r.GetArguments()
	if val, ok := args[key]; ok {
		switch v := val.(type) {
		case []float64:
			return v
		case []any:
			result := make([]float64, 0, len(v))
			for _, item := range v {
				switch num := item.(type) {
				case float64:
					result = append(result, num)
				case int:
					result = append(result, float64(num))
				case string:
					if f, err := strconv.ParseFloat(num, 64); err == nil {
						result = append(result, f)
					}
				}
			}
			return result
		}
	}
	return defaultValue
}

// RequireFloatSlice returns a float64 slice argument by key, or an error if not found or not convertible to float64 slice
func (r CallToolRequest) RequireFloatSlice(key string) ([]float64, error) {
	args := r.GetArguments()
	if val, ok := args[key]; ok {
		switch v := val.(type) {
		case []float64:
			return v, nil
		case []any:
			result := make([]float64, 0, len(v))
			for i, item := range v {
				switch num := item.(type) {
				case float64:
					result = append(result, num)
				case int:
					result = append(result, float64(num))
				case string:
					if f, err := strconv.ParseFloat(num, 64); err == nil {
						result = append(result, f)
					} else {
						return nil, fmt.Errorf("item %d in argument %q cannot be converted to float64", i, key)
					}
				default:
					return nil, fmt.Errorf("item %d in argument %q is not a float64", i, key)
				}
			}
			return result, nil
		default:
			return nil, fmt.Errorf("argument %q is not a float64 slice", key)
		}
	}
	return nil, fmt.Errorf("required argument %q not found", key)
}

// GetBoolSlice returns a bool slice argument by key, or the default value if not found
func (r CallToolRequest) GetBoolSlice(key string, defaultValue []bool) []bool {
	args := r.GetArguments()
	if val, ok := args[key]; ok {
		switch v := val.(type) {
		case []bool:
			return v
		case []any:
			result := make([]bool, 0, len(v))
			for _, item := range v {
				switch b := item.(type) {
				case bool:
					result = append(result, b)
				case string:
					if parsed, err := strconv.ParseBool(b); err == nil {
						result = append(result, parsed)
					}
				case int:
					result = append(result, b != 0)
				case float64:
					result = append(result, b != 0)
				}
			}
			return result
		}
	}
	return defaultValue
}

// RequireBoolSlice returns a bool slice argument by key, or an error if not found or not convertible to bool slice
func (r CallToolRequest) RequireBoolSlice(key string) ([]bool, error) {
	args := r.GetArguments()
	if val, ok := args[key]; ok {
		switch v := val.(type) {
		case []bool:
			return v, nil
		case []any:
			result := make([]bool, 0, len(v))
			for i, item := range v {
				switch b := item.(type) {
				case bool:
					result = append(result, b)
				case string:
					if parsed, err := strconv.ParseBool(b); err == nil {
						result = append(result, parsed)
					} else {
						return nil, fmt.Errorf("item %d in argument %q cannot be converted to bool", i, key)
					}
				case int:
					result = append(result, b != 0)
				case float64:
					result = append(result, b != 0)
				default:
					return nil, fmt.Errorf("item %d in argument %q is not a bool", i, key)
				}
			}
			return result, nil
		default:
			return nil, fmt.Errorf("argument %q is not a bool slice", key)
		}
	}
	return nil, fmt.Errorf("required argument %q not found", key)
}

// MarshalJSON implements custom JSON marshaling for CallToolResult
func (r CallToolResult) MarshalJSON() ([]byte, error) {
	m := make(map[string]any)

	// Marshal Meta if present
	if r.Meta != nil {
		m["_meta"] = r.Meta
	}

	// resultType is required from protocol version 2026-07-28 onward, and
	// omitted when replying to a client using an earlier version.
	if r.ResultType != "" {
		m["resultType"] = r.ResultType
	}

	// Marshal Content array
	content := make([]any, len(r.Content))
	for i, c := range r.Content {
		content[i] = c
	}
	m["content"] = content

	// Marshal StructuredContent if present
	if trimmed := bytes.TrimSpace(r.RawStructuredContent); len(trimmed) > 0 && (r.StructuredContent == nil || !bytes.Equal(trimmed, []byte("null"))) {
		m["structuredContent"] = json.RawMessage(r.RawStructuredContent)
	} else if r.StructuredContent != nil {
		m["structuredContent"] = r.StructuredContent
	}

	// Marshal IsError if true
	if r.IsError {
		m["isError"] = r.IsError
	}

	// Multi round-trip fields, present only when the server is asking the
	// client for more input before it can complete the call (SEP-2322).
	if len(r.InputRequests) > 0 {
		m["inputRequests"] = r.InputRequests
	}
	if r.RequestState != "" {
		m["requestState"] = r.RequestState
	}

	return json.Marshal(m)
}

// UnmarshalJSON implements custom JSON unmarshaling for CallToolResult
func (r *CallToolResult) UnmarshalJSON(data []byte) error {
	type result struct {
		Meta              *Meta             `json:"_meta,omitempty"`
		ResultType        ResultType        `json:"resultType,omitempty"`
		Content           []json.RawMessage `json:"content"`
		StructuredContent json.RawMessage   `json:"structuredContent,omitempty"`
		IsError           bool              `json:"isError,omitempty"`
		InputRequests     InputRequests     `json:"inputRequests,omitempty"`
		RequestState      string            `json:"requestState,omitempty"`
	}

	var raw result
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	r.Meta = raw.Meta
	r.ResultType = raw.ResultType
	r.IsError = raw.IsError
	r.InputRequests = raw.InputRequests
	r.RequestState = raw.RequestState

	r.Content = nil
	if raw.Content != nil {
		r.Content = make([]Content, len(raw.Content))
		for i, item := range raw.Content {
			content, err := UnmarshalContent(item)
			if err != nil {
				return err
			}
			r.Content[i] = content
		}
	}

	r.RawStructuredContent = nil
	r.StructuredContent = nil
	if len(raw.StructuredContent) > 0 {
		r.RawStructuredContent = append(json.RawMessage(nil), raw.StructuredContent...)
		if err := json.Unmarshal(raw.StructuredContent, &r.StructuredContent); err != nil {
			return err
		}
	}

	return nil
}

// ToolListChangedNotification is an optional notification from the server to
// the client, informing it that the list of tools it offers has changed. This may
// be issued by servers without any previous subscription from the client.
type ToolListChangedNotification struct {
	Notification
}

// TaskSupport indicates how a tool supports task augmentation.
type TaskSupport string

const (
	// TaskSupportForbidden means the tool cannot be invoked as a task (default).
	TaskSupportForbidden TaskSupport = "forbidden"
	// TaskSupportOptional means the tool can be invoked as a task or normally.
	TaskSupportOptional TaskSupport = "optional"
	// TaskSupportRequired means the tool must be invoked as a task.
	TaskSupportRequired TaskSupport = "required"
)

// ToolExecution describes execution behavior for a tool.
type ToolExecution struct {
	// TaskSupport indicates whether the tool supports task augmentation.
	TaskSupport TaskSupport `json:"taskSupport,omitempty"`
}

// Tool represents the definition for a tool the client can call.
type Tool struct {
	// Meta is a metadata object that is reserved by MCP for storing additional information.
	Meta *Meta `json:"_meta,omitempty"`
	// The name of the tool.
	Name string `json:"name"`
	// Title is an optional human-readable, UI-friendly display name for the tool.
	// If not provided, clients should use Annotations.Title (if set) and fall back to Name.
	Title string `json:"title,omitempty"`
	// A human-readable description of the tool.
	Description string `json:"description,omitempty"`
	// A JSON Schema object defining the expected parameters for the tool.
	InputSchema ToolInputSchema `json:"inputSchema"`
	// Alternative to InputSchema - allows arbitrary JSON Schema to be provided
	RawInputSchema json.RawMessage `json:"-"` // Hide this from JSON marshaling
	// A JSON Schema object defining the expected output returned by the tool .
	OutputSchema ToolOutputSchema `json:"outputSchema,omitzero"`
	// Optional JSON Schema defining expected output structure
	RawOutputSchema json.RawMessage `json:"-"` // Hide this from JSON marshaling
	// Optional properties describing tool behavior
	Annotations ToolAnnotation `json:"annotations"`
	// Support for deferred loading
	DeferLoading bool `json:"defer_loading,omitempty"`
	// Icons provides visual identifiers for the tool
	Icons []Icon `json:"icons,omitempty"`
	// Execution describes execution behavior for the tool
	Execution *ToolExecution `json:"execution,omitempty"`
}

// GetName returns the name of the tool.
func (t Tool) GetName() string {
	return t.Name
}

// MarshalJSON implements the json.Marshaler interface for Tool.
// It handles marshaling either InputSchema or RawInputSchema based on which is set.
func (t Tool) MarshalJSON() ([]byte, error) {
	// Create a map to build the JSON structure
	m := make(map[string]any, 5)

	// Add the name and description
	m["name"] = t.Name
	if t.Title != "" {
		m["title"] = t.Title
	}
	if t.Description != "" {
		m["description"] = t.Description
	}

	// Determine which input schema to use
	if t.RawInputSchema != nil {
		if t.InputSchema.Type != "" || t.InputSchema.Types != nil {
			return nil, fmt.Errorf("tool %s has both InputSchema and RawInputSchema set: %w", t.Name, errToolSchemaConflict)
		}
		m["inputSchema"] = t.RawInputSchema
	} else {
		// Use the structured InputSchema
		m["inputSchema"] = t.InputSchema
	}

	// Add output schema if present
	if t.RawOutputSchema != nil {
		if t.OutputSchema.Type != "" || t.OutputSchema.Types != nil {
			return nil, fmt.Errorf("tool %s has both OutputSchema and RawOutputSchema set: %w", t.Name, errToolSchemaConflict)
		}
		m["outputSchema"] = t.RawOutputSchema
	} else if t.OutputSchema.Type != "" || t.OutputSchema.Types != nil {
		m["outputSchema"] = t.OutputSchema
	}

	if t.Annotations != (ToolAnnotation{}) {
		m["annotations"] = t.Annotations
	}

	if t.DeferLoading {
		m["defer_loading"] = t.DeferLoading
	}

	// Marshal Meta if present
	if t.Meta != nil {
		m["_meta"] = t.Meta
	}

	if t.Icons != nil {
		m["icons"] = t.Icons
	}

	if t.Execution != nil {
		m["execution"] = t.Execution
	}

	return json.Marshal(m)
}

// ToolArgumentsSchema represents a JSON Schema for tool arguments.
type ToolArgumentsSchema struct {
	Defs map[string]any `json:"$defs,omitempty"`
	Type string         `json:"type"`
	// Types holds an array-valued JSON Schema type, including a single-element
	// array. Type remains a string for compatibility and takes precedence when
	// non-empty. Decoding a string clears Types; decoding an array clears Type.
	Types                []string       `json:"-"`
	Properties           map[string]any `json:"properties"`
	Required             []string       `json:"required,omitempty"`
	AdditionalProperties any            `json:"additionalProperties,omitempty"`
	// AdditionalFields contains unmodeled top-level JSON Schema keywords.
	// Modeled names (type, properties, required, additionalProperties and $defs)
	// are reserved and cannot override structured fields, even when omitted.
	// The distinct definitions container is retained here unless an undeclared
	// legacy schema adopts it into Defs. Decoded numbers use json.Number.
	AdditionalFields map[string]any `json:"-"`
	// PropertyOrder is the marshal order of the top-level Properties keys.
	// UnmarshalJSON sets it from the "properties" object. Names that are not
	// in Properties are skipped, and keys that are not listed follow in
	// sorted order. A nil PropertyOrder marshals all keys in sorted order.
	PropertyOrder []string `json:"-"`
}

// ToolInputSchema remains a named type for retro-compatibility, so its JSON
// methods explicitly forward to ToolArgumentsSchema.
type ToolInputSchema ToolArgumentsSchema

type ToolOutputSchema ToolArgumentsSchema

// MarshalJSON implements the json.Marshaler interface for ToolInputSchema.
func (tis ToolInputSchema) MarshalJSON() ([]byte, error) {
	return ToolArgumentsSchema(tis).MarshalJSON()
}

// MarshalJSON implements the json.Marshaler interface for ToolOutputSchema.
func (tis ToolOutputSchema) MarshalJSON() ([]byte, error) {
	return ToolArgumentsSchema(tis).MarshalJSON()
}

// MarshalJSON implements the json.Marshaler interface for ToolArgumentsSchema.
func (tis ToolArgumentsSchema) MarshalJSON() ([]byte, error) {
	return toolArgumentsSchemaMarshalJSON(tis)
}

// UnmarshalJSON implements the json.Unmarshaler interface for ToolInputSchema.
func (tis *ToolInputSchema) UnmarshalJSON(data []byte) error {
	return (*ToolArgumentsSchema)(tis).UnmarshalJSON(data)
}

// UnmarshalJSON implements the json.Unmarshaler interface for ToolOutputSchema.
func (tis *ToolOutputSchema) UnmarshalJSON(data []byte) error {
	return (*ToolArgumentsSchema)(tis).UnmarshalJSON(data)
}

// UnmarshalJSON implements the json.Unmarshaler interface for ToolArgumentsSchema.
func (tis *ToolArgumentsSchema) UnmarshalJSON(data []byte) error {
	return toolArgumentsSchemaUnmarshalJSON(data, tis)
}

// isModeledToolSchemaKeyword identifies names reserved for structured fields.
func isModeledToolSchemaKeyword(key string) bool {
	switch key {
	case "type", "properties", "required", "additionalProperties", "$defs":
		return true
	default:
		return false
	}
}

// toolArgumentsSchemaMarshalJSON handles the fields stored in ToolArgumentsSchema when json.Marshaler is called
func toolArgumentsSchemaMarshalJSON(tis ToolArgumentsSchema) ([]byte, error) {
	m := make(map[string]any, len(tis.AdditionalFields)+5)
	for key, value := range tis.AdditionalFields {
		if !isModeledToolSchemaKeyword(key) {
			m[key] = value
		}
	}
	m["type"] = tis.Type
	if tis.Type == "" && tis.Types != nil {
		m["type"] = tis.Types
	}

	if tis.Defs != nil {
		m["$defs"] = tis.Defs
	}

	// Marshal Properties to '{}' rather than `nil` when its length equals zero
	switch {
	case tis.PropertyOrder != nil:
		properties, err := marshalOrderedProperties(tis.Properties, tis.PropertyOrder)
		if err != nil {
			return nil, err
		}
		m["properties"] = properties
	case tis.Properties != nil:
		m["properties"] = tis.Properties
	default:
		m["properties"] = map[string]any{}
	}

	// Marshal Required to '[]' rather than `nil` when its length equals zero,
	// unless the schema declares draft-04 or earlier, where an empty
	// "required" is invalid.
	switch {
	case len(tis.Required) > 0:
		m["required"] = tis.Required
	case !declaresDraft04OrEarlier(m["$schema"]):
		m["required"] = []string{}
	}

	if tis.AdditionalProperties != nil {
		m["additionalProperties"] = tis.AdditionalProperties
	}

	return json.Marshal(m)
}

// marshalOrderedProperties encodes properties as a JSON object. Keys listed in
// order come first, names not in properties are skipped, and the remaining
// keys follow in sorted order. Keys and values go through json.Marshal, so
// escaping matches the encoding of a map.
func marshalOrderedProperties(properties map[string]any, order []string) (json.RawMessage, error) {
	var buf bytes.Buffer
	buf.WriteByte('{')
	written := make(map[string]bool, len(properties))
	writeProperty := func(name string) error {
		key, err := json.Marshal(name)
		if err != nil {
			return err
		}
		value, err := json.Marshal(properties[name])
		if err != nil {
			return err
		}
		if len(written) > 0 {
			buf.WriteByte(',')
		}
		written[name] = true
		buf.Write(key)
		buf.WriteByte(':')
		buf.Write(value)
		return nil
	}

	for _, name := range order {
		if _, ok := properties[name]; !ok || written[name] {
			continue
		}
		if err := writeProperty(name); err != nil {
			return nil, err
		}
	}

	if len(written) < len(properties) {
		rest := make([]string, 0, len(properties)-len(written))
		for name := range properties {
			if !written[name] {
				rest = append(rest, name)
			}
		}
		slices.Sort(rest)
		for _, name := range rest {
			if err := writeProperty(name); err != nil {
				return nil, err
			}
		}
	}

	buf.WriteByte('}')
	return buf.Bytes(), nil
}

// propertyOrder returns the keys of the JSON object raw in the order they
// appear, keeping the first position of a duplicate key. It returns nil when
// raw is not an object or has no keys.
func propertyOrder(raw json.RawMessage) []string {
	dec := json.NewDecoder(bytes.NewReader(raw))
	if tok, err := dec.Token(); err != nil || tok != json.Delim('{') {
		return nil
	}

	var order []string
	seen := make(map[string]bool)
	for dec.More() {
		tok, err := dec.Token()
		if err != nil {
			return nil
		}
		name, ok := tok.(string)
		if !ok {
			return nil
		}
		if !seen[name] {
			seen[name] = true
			order = append(order, name)
		}

		var value json.RawMessage
		if err := dec.Decode(&value); err != nil {
			return nil
		}
	}
	return order
}

// It preserves declared dialects and only normalizes legacy definitions to
// Defs when no dialect or $defs is provided.
func toolArgumentsSchemaUnmarshalJSON(data []byte, tis *ToolArgumentsSchema) error {
	// Use a temporary type to avoid infinite recursion
	type Alias ToolArgumentsSchema
	aux := &struct {
		Definitions json.RawMessage `json:"definitions,omitempty"`
		Type        json.RawMessage `json:"type"`
		// Properties shadows Alias.Properties so the raw bytes keep the key order.
		Properties json.RawMessage `json:"properties"`
		*Alias
	}{
		Alias: (*Alias)(tis),
	}

	if err := json.Unmarshal(data, aux); err != nil {
		return err
	}
	if err := unmarshalAdditionalSchemaKeywords(data, tis); err != nil {
		return err
	}
	if len(aux.Type) > 0 {
		if bytes.TrimSpace(aux.Type)[0] == '[' {
			var types []string
			if err := json.Unmarshal(aux.Type, &types); err != nil {
				return fmt.Errorf("decode schema type array: %w", err)
			}
			tis.Type = ""
			tis.Types = types
		} else {
			if err := json.Unmarshal(aux.Type, &tis.Type); err != nil {
				return fmt.Errorf("decode schema type: %w", err)
			}
			tis.Types = nil
		}
	}

	if aux.Properties != nil {
		if err := json.Unmarshal(aux.Properties, &tis.Properties); err != nil {
			return err
		}
		tis.PropertyOrder = propertyOrder(aux.Properties)
	}

	// A declared dialect owns its keyword syntax, including unknown dialects.
	// Without one, retain the compatibility normalization when there is no
	// competing $defs container. Both containers may have independent refs.
	_, declaredDialect := tis.AdditionalFields["$schema"]
	if !declaredDialect && tis.Defs == nil && aux.Definitions != nil {
		var definitions map[string]any
		decoder := json.NewDecoder(bytes.NewReader(aux.Definitions))
		decoder.UseNumber()
		if err := decoder.Decode(&definitions); err != nil {
			return err
		}
		if definitions == nil {
			return nil
		}
		tis.Defs = definitions
		delete(tis.AdditionalFields, "definitions")
		for _, schema := range tis.Defs {
			rewriteDraft07LocalRefs(schema)
		}
		for _, schema := range tis.Properties {
			rewriteDraft07LocalRefs(schema)
		}
		rewriteDraft07LocalRefs(tis.AdditionalProperties)
		rewriteDraft07LocalRefs(tis.AdditionalFields)
		if len(tis.AdditionalFields) == 0 {
			tis.AdditionalFields = nil
		}
	}

	return nil
}

// declaresDraft04OrEarlier reports whether a $schema value names JSON Schema
// draft-04 or earlier, where "required" needs at least one element.
func declaresDraft04OrEarlier(schema any) bool {
	uri, _ := schema.(string)
	return strings.Contains(uri, "json-schema.org/draft-04/") || strings.Contains(uri, "json-schema.org/draft-03/")
}

// unmarshalAdditionalSchemaKeywords stores the top-level keywords of a schema
// that ToolArgumentsSchema has no field for in AdditionalFields.
func unmarshalAdditionalSchemaKeywords(data []byte, tis *ToolArgumentsSchema) error {
	var keywords map[string]json.RawMessage
	if err := json.Unmarshal(data, &keywords); err != nil {
		return err
	}
	if keywords == nil { // JSON null, which leaves the schema as it is
		return nil
	}
	for _, known := range []string{"$defs", "type", "properties", "required", "additionalProperties"} {
		delete(keywords, known)
	}
	if len(keywords) == 0 {
		tis.AdditionalFields = nil
		return nil
	}
	tis.AdditionalFields = make(map[string]any, len(keywords))
	for name, raw := range keywords {
		var value any
		decoder := json.NewDecoder(bytes.NewReader(raw))
		decoder.UseNumber()
		if err := decoder.Decode(&value); err != nil {
			return err
		}
		tis.AdditionalFields[name] = value
	}
	return nil
}

// rewriteDraft07LocalRefs rewrites local draft-07 "#/definitions/..." $ref
// pointers to their 2019-09+ "#/$defs/..." equivalent in schema positions.
// Annotation values and unknown extension keywords are left untouched.
func rewriteDraft07LocalRefs(node any) {
	const draft07Prefix = "#/definitions/"
	schema, ok := node.(map[string]any)
	if !ok {
		return
	}
	if ref, ok := schema["$ref"].(string); ok && strings.HasPrefix(ref, draft07Prefix) {
		schema["$ref"] = "#/$defs/" + ref[len(draft07Prefix):]
	}
	for keyword, value := range schema {
		switch keyword {
		case "properties", "patternProperties", "$defs", "definitions", "dependentSchemas", "dependencies":
			if children, ok := value.(map[string]any); ok {
				for _, child := range children {
					rewriteDraft07LocalRefs(child)
				}
			}
		case "additionalProperties", "additionalItems", "contains", "propertyNames", "not", "if", "then", "else", "unevaluatedProperties", "unevaluatedItems", "contentSchema":
			rewriteDraft07LocalRefs(value)
		case "items", "allOf", "anyOf", "oneOf", "prefixItems":
			if children, ok := value.([]any); ok {
				for _, child := range children {
					rewriteDraft07LocalRefs(child)
				}
			} else if keyword == "items" {
				rewriteDraft07LocalRefs(value)
			}
		}
	}
}

type ToolAnnotation struct {
	// Human-readable title for the tool
	Title string `json:"title,omitempty"`
	// If true, the tool does not modify its environment
	ReadOnlyHint *bool `json:"readOnlyHint,omitempty"`
	// If true, the tool may perform destructive updates
	DestructiveHint *bool `json:"destructiveHint,omitempty"`
	// If true, repeated calls with same args have no additional effect
	IdempotentHint *bool `json:"idempotentHint,omitempty"`
	// If true, tool interacts with external entities
	OpenWorldHint *bool `json:"openWorldHint,omitempty"`
}

// ToolOption is a function that configures a Tool.
// It provides a flexible way to set various properties of a Tool using the functional options pattern.
type ToolOption func(*Tool)

// PropertyOption is a function that configures a property in a Tool's input schema.
// It allows for flexible configuration of JSON Schema properties using the functional options pattern.
type PropertyOption func(map[string]any)

//
// Core Tool Functions
//

// NewTool creates a new Tool with the given name and options.
// The tool will have an object-type input schema with configurable properties.
// Options are applied in order, allowing for flexible tool configuration.
func NewTool(name string, opts ...ToolOption) Tool {
	tool := Tool{
		Name: name,
		InputSchema: ToolInputSchema{
			Type:       "object",
			Properties: make(map[string]any),
			Required:   nil, // Will be omitted from JSON if empty
		},
		Annotations: ToolAnnotation{
			Title:           "",
			ReadOnlyHint:    ToBoolPtr(false),
			DestructiveHint: ToBoolPtr(true),
			IdempotentHint:  ToBoolPtr(false),
			OpenWorldHint:   ToBoolPtr(true),
		},
	}

	for _, opt := range opts {
		opt(&tool)
	}

	return tool
}

// NewToolWithRawSchema creates a new Tool with the given name and a raw JSON
// Schema. This allows for arbitrary JSON Schema to be used for the tool's input
// schema.
//
// NOTE a [Tool] built in such a way is incompatible with the [ToolOption] and
// runtime errors will result from supplying a [ToolOption] to a [Tool] built
// with this function.
func NewToolWithRawSchema(name, description string, schema json.RawMessage) Tool {
	tool := Tool{
		Name:           name,
		Description:    description,
		RawInputSchema: schema,
	}

	return tool
}

// WithDescription adds a description to the Tool.
// The description should provide a clear, human-readable explanation of what the tool does.
func WithDescription(description string) ToolOption {
	return func(t *Tool) {
		t.Description = description
	}
}

// WithToolTitle sets the optional human-readable display title for the Tool.
// Per the MCP spec, clients should prefer Title over Annotations.Title and Name for display.
func WithToolTitle(title string) ToolOption {
	return func(t *Tool) {
		t.Title = title
	}
}

// WithDeferLoading sets the defer_loading flag for the tool.
// This is used to implement dynamic tool loading/searching patterns.
func WithDeferLoading(deferLoading bool) ToolOption {
	return func(t *Tool) {
		t.DeferLoading = deferLoading
	}
}

// WithInputSchema creates a ToolOption that sets the input schema for a tool.
// It accepts any Go type, usually a struct, and automatically generates a JSON schema from it.
func WithInputSchema[T any]() ToolOption {
	return func(t *Tool) {
		schema, err := schemaFor[T]()
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			return
		}

		mcpSchema, err := json.Marshal(schema)
		if err != nil {
			return
		}

		t.InputSchema.Type = ""
		t.InputSchema.Types = nil
		t.RawInputSchema = json.RawMessage(mcpSchema)
	}
}

// WithToolIcons adds icons to the Tool.
// Icons provide visual identifiers for the tool.
func WithToolIcons(icons ...Icon) ToolOption {
	return func(t *Tool) {
		t.Icons = icons
	}
}

// WithTaskSupport sets the task support mode for the tool.
// It configures whether the tool can be invoked as a task (asynchronously).
// Valid values are TaskSupportForbidden (default), TaskSupportOptional, or TaskSupportRequired.
func WithTaskSupport(support TaskSupport) ToolOption {
	return func(t *Tool) {
		if t.Execution == nil {
			t.Execution = &ToolExecution{}
		}
		t.Execution.TaskSupport = support
	}
}

// WithRawInputSchema sets a raw JSON schema for the tool's input.
// Use this when you need full control over the schema or when working with
// complex schemas that can't be generated from Go types. The jsonschema library
// can handle complex schemas and provides nice extension points, so be sure to
// check that out before using this.
func WithRawInputSchema(schema json.RawMessage) ToolOption {
	return func(t *Tool) {
		if schema != nil {
			t.InputSchema.Type = ""
			t.InputSchema.Types = nil
		}
		t.RawInputSchema = schema
	}
}

// WithOutputSchema creates a ToolOption that sets the output schema for a tool.
// It accepts any Go type, usually a struct, and automatically generates a JSON schema from it.
func WithOutputSchema[T any]() ToolOption {
	return func(t *Tool) {
		schema, err := schemaFor[T]()
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			return
		}

		mcpSchema, err := json.Marshal(schema)
		if err != nil {
			return
		}

		var outputSchema ToolOutputSchema
		if err := json.Unmarshal(mcpSchema, &outputSchema); err != nil {
			return
		}
		t.OutputSchema = outputSchema

		// Always set the type to "object" as of the current MCP spec
		// https://modelcontextprotocol.io/specification/2025-06-18/server/tools#output-schema
		t.OutputSchema.Type = "object"
		// Decoding the generated schema recorded struct field order. Clear it
		// so these tools keep emitting properties sorted by name.
		t.OutputSchema.PropertyOrder = nil
	}
}

// WithRawOutputSchema sets a raw JSON schema for the tool's output.
// Use this when you need full control over the schema or when working with
// complex schemas that can't be generated from Go types. The jsonschema library
// can handle complex schemas and provides nice extension points, so be sure to
// check that out before using this.
func WithRawOutputSchema(schema json.RawMessage) ToolOption {
	return func(t *Tool) {
		t.RawOutputSchema = schema
	}
}

// WithoutDefaultAnnotations clears the default hints that NewTool sets, so the
// tool sends no annotations unless later options set some. Place it before
// any other annotation option, since it clears those set before it.
func WithoutDefaultAnnotations() ToolOption {
	return func(t *Tool) {
		t.Annotations = ToolAnnotation{}
	}
}

// WithToolAnnotation adds optional hints about the Tool.
func WithToolAnnotation(annotation ToolAnnotation) ToolOption {
	return func(t *Tool) {
		t.Annotations = annotation
	}
}

// WithTitleAnnotation sets the Title field of the Tool's Annotations.
// It provides a human-readable title for the tool.
func WithTitleAnnotation(title string) ToolOption {
	return func(t *Tool) {
		t.Annotations.Title = title
	}
}

// WithReadOnlyHintAnnotation sets the ReadOnlyHint field of the Tool's Annotations.
// If true, it indicates the tool does not modify its environment.
func WithReadOnlyHintAnnotation(value bool) ToolOption {
	return func(t *Tool) {
		t.Annotations.ReadOnlyHint = &value
	}
}

// WithDestructiveHintAnnotation sets the DestructiveHint field of the Tool's Annotations.
// If true, it indicates the tool may perform destructive updates.
func WithDestructiveHintAnnotation(value bool) ToolOption {
	return func(t *Tool) {
		t.Annotations.DestructiveHint = &value
	}
}

// WithIdempotentHintAnnotation sets the IdempotentHint field of the Tool's Annotations.
// If true, it indicates repeated calls with the same arguments have no additional effect.
func WithIdempotentHintAnnotation(value bool) ToolOption {
	return func(t *Tool) {
		t.Annotations.IdempotentHint = &value
	}
}

// WithOpenWorldHintAnnotation sets the OpenWorldHint field of the Tool's Annotations.
// If true, it indicates the tool interacts with external entities.
func WithOpenWorldHintAnnotation(value bool) ToolOption {
	return func(t *Tool) {
		t.Annotations.OpenWorldHint = &value
	}
}

// WithSchemaAdditionalProperties sets the additionalProperties field on the tool's input schema.
// It accepts false (disallow extra properties), true (allow any), or a schema map
// to validate additional properties against.
func WithSchemaAdditionalProperties(schema any) ToolOption {
	return func(t *Tool) {
		t.InputSchema.AdditionalProperties = schema
	}
}

//
// Common Property Options
//

// Description adds a description to a property in the JSON Schema.
// The description should explain the purpose and expected values of the property.
func Description(desc string) PropertyOption {
	return func(schema map[string]any) {
		schema["description"] = desc
	}
}

// Required marks a property as required in the tool's input schema.
// Required properties must be provided when using the tool.
func Required() PropertyOption {
	return func(schema map[string]any) {
		schema["required"] = true
	}
}

// Title adds a display-friendly title to a property in the JSON Schema.
// This title can be used by UI components to show a more readable property name.
func Title(title string) PropertyOption {
	return func(schema map[string]any) {
		schema["title"] = title
	}
}

//
// String Property Options
//

// DefaultString sets the default value for a string property.
// This value will be used if the property is not explicitly provided.
func DefaultString(value string) PropertyOption {
	return func(schema map[string]any) {
		schema["default"] = value
	}
}

// Enum specifies a list of allowed values for a string property.
// The property value must be one of the specified enum values.
func Enum(values ...string) PropertyOption {
	return func(schema map[string]any) {
		schema["enum"] = values
	}
}

// MaxLength sets the maximum length for a string property.
// The string value must not exceed this length.
func MaxLength(max int) PropertyOption {
	return func(schema map[string]any) {
		schema["maxLength"] = max
	}
}

// MinLength sets the minimum length for a string property.
// The string value must be at least this length.
func MinLength(min int) PropertyOption {
	return func(schema map[string]any) {
		schema["minLength"] = min
	}
}

// Pattern sets a regex pattern that a string property must match.
// The string value must conform to the specified regular expression.
func Pattern(pattern string) PropertyOption {
	return func(schema map[string]any) {
		schema["pattern"] = pattern
	}
}

//
// Number Property Options
//

// DefaultNumber sets the default value for a number or integer property.
// This value will be used if the property is not explicitly provided.
func DefaultNumber[T int | int64 | float64](value T) PropertyOption {
	return func(schema map[string]any) {
		schema["default"] = value
	}
}

// Max sets the maximum value for a number or integer property.
// The number value must not exceed this maximum.
func Max[T int | int64 | float64](max T) PropertyOption {
	return func(schema map[string]any) {
		schema["maximum"] = max
	}
}

// Min sets the minimum value for a number or integer property.
// The number value must not be less than this minimum.
func Min[T int | int64 | float64](min T) PropertyOption {
	return func(schema map[string]any) {
		schema["minimum"] = min
	}
}

// MultipleOf specifies that a number or integer must be a multiple of the given value.
// The number value must be divisible by this value.
func MultipleOf[T int | int64 | float64](value T) PropertyOption {
	return func(schema map[string]any) {
		schema["multipleOf"] = value
	}
}

//
// Boolean Property Options
//

// DefaultBool sets the default value for a boolean property.
// This value will be used if the property is not explicitly provided.
func DefaultBool(value bool) PropertyOption {
	return func(schema map[string]any) {
		schema["default"] = value
	}
}

//
// Array Property Options
//

// DefaultArray sets the default value for an array property.
// This value will be used if the property is not explicitly provided.
func DefaultArray[T any](value []T) PropertyOption {
	return func(schema map[string]any) {
		schema["default"] = value
	}
}

//
// Property Type Helpers
//

// WithInteger adds an integer property to the tool schema.
// It accepts property options to configure the integer property's behavior and constraints.
func WithInteger(name string, opts ...PropertyOption) ToolOption {
	return func(t *Tool) {
		schema := map[string]any{
			"type": "integer",
		}

		for _, opt := range opts {
			opt(schema)
		}

		// Remove required from property schema and add to InputSchema.required
		if required, ok := schema["required"].(bool); ok && required {
			delete(schema, "required")
			t.InputSchema.Required = append(t.InputSchema.Required, name)
		}

		t.InputSchema.Properties[name] = schema
	}
}

// WithBoolean adds a boolean property to the tool schema.
// It accepts property options to configure the boolean property's behavior and constraints.
func WithBoolean(name string, opts ...PropertyOption) ToolOption {
	return func(t *Tool) {
		schema := map[string]any{
			"type": "boolean",
		}

		for _, opt := range opts {
			opt(schema)
		}

		// Remove required from property schema and add to InputSchema.required
		if required, ok := schema["required"].(bool); ok && required {
			delete(schema, "required")
			t.InputSchema.Required = append(t.InputSchema.Required, name)
		}

		t.InputSchema.Properties[name] = schema
	}
}

// WithNumber adds a number property to the tool schema.
// It accepts property options to configure the number property's behavior and constraints.
func WithNumber(name string, opts ...PropertyOption) ToolOption {
	return func(t *Tool) {
		schema := map[string]any{
			"type": "number",
		}

		for _, opt := range opts {
			opt(schema)
		}

		// Remove required from property schema and add to InputSchema.required
		if required, ok := schema["required"].(bool); ok && required {
			delete(schema, "required")
			t.InputSchema.Required = append(t.InputSchema.Required, name)
		}

		t.InputSchema.Properties[name] = schema
	}
}

// WithString adds a string property to the tool schema.
// It accepts property options to configure the string property's behavior and constraints.
func WithString(name string, opts ...PropertyOption) ToolOption {
	return func(t *Tool) {
		schema := map[string]any{
			"type": "string",
		}

		for _, opt := range opts {
			opt(schema)
		}

		// Remove required from property schema and add to InputSchema.required
		if required, ok := schema["required"].(bool); ok && required {
			delete(schema, "required")
			t.InputSchema.Required = append(t.InputSchema.Required, name)
		}

		t.InputSchema.Properties[name] = schema
	}
}

// WithObject adds an object property to the tool schema.
// It accepts property options to configure the object property's behavior and constraints.
func WithObject(name string, opts ...PropertyOption) ToolOption {
	return func(t *Tool) {
		schema := map[string]any{
			"type":       "object",
			"properties": map[string]any{},
		}

		for _, opt := range opts {
			opt(schema)
		}

		// Remove required from property schema and add to InputSchema.required
		if required, ok := schema["required"].(bool); ok && required {
			delete(schema, "required")
			t.InputSchema.Required = append(t.InputSchema.Required, name)
		}

		t.InputSchema.Properties[name] = schema
	}
}

// WithArray returns a ToolOption that adds an array-typed property with the given name to a Tool's input schema.
// It applies provided PropertyOption functions to configure the property's schema, moves a `required` flag
// from the property schema into the Tool's InputSchema.Required slice when present, and registers the resulting
// schema under InputSchema.Properties[name].
func WithArray(name string, opts ...PropertyOption) ToolOption {
	return func(t *Tool) {
		schema := map[string]any{
			"type": "array",
		}

		for _, opt := range opts {
			opt(schema)
		}

		// Remove required from property schema and add to InputSchema.required
		if required, ok := schema["required"].(bool); ok && required {
			delete(schema, "required")
			t.InputSchema.Required = append(t.InputSchema.Required, name)
		}

		t.InputSchema.Properties[name] = schema
	}
}

// WithAny adds an input property named name with no predefined JSON Schema type to the Tool's input schema.
// The returned ToolOption applies the provided PropertyOption functions to the property's schema, moves a property-level
// `required` flag into the Tool's InputSchema.Required list if present, and stores the resulting schema under InputSchema.Properties[name].
func WithAny(name string, opts ...PropertyOption) ToolOption {
	return func(t *Tool) {
		schema := map[string]any{}

		for _, opt := range opts {
			opt(schema)
		}

		// Remove required from property schema and add to InputSchema.required
		if required, ok := schema["required"].(bool); ok && required {
			delete(schema, "required")
			t.InputSchema.Required = append(t.InputSchema.Required, name)
		}

		t.InputSchema.Properties[name] = schema
	}
}

// Properties sets the "properties" map for an object schema.
// The returned PropertyOption stores the provided map under the schema's "properties" key.
func Properties(props map[string]any) PropertyOption {
	return func(schema map[string]any) {
		schema["properties"] = props
	}
}

// AdditionalProperties specifies whether additional properties are allowed in the object
// or defines a schema for additional properties
func AdditionalProperties(schema any) PropertyOption {
	return func(schemaMap map[string]any) {
		schemaMap["additionalProperties"] = schema
	}
}

// MinProperties sets the minimum number of properties for an object
func MinProperties(min int) PropertyOption {
	return func(schema map[string]any) {
		schema["minProperties"] = min
	}
}

// MaxProperties sets the maximum number of properties for an object
func MaxProperties(max int) PropertyOption {
	return func(schema map[string]any) {
		schema["maxProperties"] = max
	}
}

// PropertyNames defines a schema for property names in an object
func PropertyNames(schema map[string]any) PropertyOption {
	return func(schemaMap map[string]any) {
		schemaMap["propertyNames"] = schema
	}
}

// Items defines the schema for array items.
// Accepts any schema definition for maximum flexibility.
//
// Example:
//
//	Items(map[string]any{
//	    "type": "object",
//	    "properties": map[string]any{
//	        "name": map[string]any{"type": "string"},
//	        "age": map[string]any{"type": "number"},
//	    },
//	})
//
// For simple types, use ItemsString(), ItemsNumber(), ItemsBoolean() instead.
func Items(schema any) PropertyOption {
	return func(schemaMap map[string]any) {
		schemaMap["items"] = schema
	}
}

// MinItems sets the minimum number of items for an array
func MinItems(min int) PropertyOption {
	return func(schema map[string]any) {
		schema["minItems"] = min
	}
}

// MaxItems sets the maximum number of items for an array
func MaxItems(max int) PropertyOption {
	return func(schema map[string]any) {
		schema["maxItems"] = max
	}
}

// UniqueItems specifies whether array items must be unique
func UniqueItems(unique bool) PropertyOption {
	return func(schema map[string]any) {
		schema["uniqueItems"] = unique
	}
}

// WithStringItems configures an array's items to be of type string.
//
// Supported options: Description(), DefaultString(), Enum(), MaxLength(), MinLength(), Pattern()
// Note: Options like Required() are not valid for item schemas and will be ignored.
//
// Examples:
//
//	mcp.WithArray("tags", mcp.WithStringItems())
//	mcp.WithArray("colors", mcp.WithStringItems(mcp.Enum("red", "green", "blue")))
//	mcp.WithArray("names", mcp.WithStringItems(mcp.MinLength(1), mcp.MaxLength(50)))
//
// Limitations: Only supports simple string arrays. Use Items() for complex objects.
func WithStringItems(opts ...PropertyOption) PropertyOption {
	return func(schema map[string]any) {
		itemSchema := map[string]any{
			"type": "string",
		}

		for _, opt := range opts {
			opt(itemSchema)
		}

		schema["items"] = itemSchema
	}
}

// WithStringEnumItems configures an array's items to be of type string with a specified enum.
// Example:
//
//	mcp.WithArray("priority", mcp.WithStringEnumItems([]string{"low", "medium", "high"}))
//
// Limitations: Only supports string enums. Use WithStringItems(Enum(...)) for more flexibility.
func WithStringEnumItems(values []string) PropertyOption {
	return func(schema map[string]any) {
		schema["items"] = map[string]any{
			"type": "string",
			"enum": values,
		}
	}
}

// WithNumberItems configures an array's items to be of type number.
//
// Supported options: Description(), DefaultNumber(), Min(), Max(), MultipleOf()
// Note: Options like Required() are not valid for item schemas and will be ignored.
//
// Examples:
//
//	mcp.WithArray("scores", mcp.WithNumberItems(mcp.Min(0), mcp.Max(100)))
//	mcp.WithArray("prices", mcp.WithNumberItems(mcp.Min(0)))
//
// Limitations: Only supports simple number arrays. Use Items() for complex objects.
func WithNumberItems(opts ...PropertyOption) PropertyOption {
	return func(schema map[string]any) {
		itemSchema := map[string]any{
			"type": "number",
		}

		for _, opt := range opts {
			opt(itemSchema)
		}

		schema["items"] = itemSchema
	}
}

// WithIntegerItems configures an array's items to be of type integer.
//
// Supported options: Description(), DefaultNumber(), Min(), Max(), MultipleOf()
// Note: Options like Required() are not valid for item schemas and will be ignored.
//
// Examples:
//
//	mcp.WithArray("ids", mcp.WithIntegerItems())
//	mcp.WithArray("scores", mcp.WithIntegerItems(mcp.Min(0), mcp.Max(100)))
//
// Limitations: Only supports simple integer arrays. Use Items() for complex objects.
func WithIntegerItems(opts ...PropertyOption) PropertyOption {
	return func(schema map[string]any) {
		itemSchema := map[string]any{
			"type": "integer",
		}

		for _, opt := range opts {
			opt(itemSchema)
		}

		if required, ok := itemSchema["required"].(bool); ok && required {
			delete(itemSchema, "required")
		}

		schema["items"] = itemSchema
	}
}

// WithBooleanItems configures an array's items to be of type boolean.
//
// Supported options: Description(), DefaultBool()
// Note: Options like Required() are not valid for item schemas and will be ignored.
//
// Examples:
//
//	mcp.WithArray("flags", mcp.WithBooleanItems())
//	mcp.WithArray("permissions", mcp.WithBooleanItems(mcp.Description("User permissions")))
//
// Limitations: Only supports simple boolean arrays. Use Items() for complex objects.
func WithBooleanItems(opts ...PropertyOption) PropertyOption {
	return func(schema map[string]any) {
		itemSchema := map[string]any{
			"type": "boolean",
		}

		for _, opt := range opts {
			opt(itemSchema)
		}

		schema["items"] = itemSchema
	}
}
