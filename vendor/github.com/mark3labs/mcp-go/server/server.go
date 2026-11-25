// Package server provides MCP (Model Context Protocol) server implementations.
package server

import (
	"cmp"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"maps"
	"slices"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/tracing"
)

// resourceEntry holds both a resource and its handler
type resourceEntry struct {
	resource mcp.Resource
	handler  ResourceHandlerFunc
}

// resourceTemplateEntry holds both a template and its handler
type resourceTemplateEntry struct {
	template mcp.ResourceTemplate
	handler  ResourceTemplateHandlerFunc
}

// taskEntry holds task state and associated data
type taskEntry struct {
	task       mcp.Task
	sessionID  string
	toolName   string             // Name of the tool that created this task
	createdAt  time.Time          // When the task was created (for metrics)
	result     any                // The actual result once completed
	resultErr  error              // Error if task failed
	cancelFunc context.CancelFunc // Function to cancel the task
	done       chan struct{}      // Channel to signal task completion
	completed  bool               // Whether the task has been completed (guards done channel closure)
	// createdHookDone, under tasksMu, says the created hook has returned;
	// until then the hook of a completion or cancellation waits in
	// pendingHooks, which createTask runs after the created hook. A task's
	// hooks so keep their order with no lock held across hook code: a hook
	// that cancels its own task does not wait for itself.
	createdHookDone bool
	pendingHooks    []func()
}

// ServerOption is a function that configures an MCPServer.
type ServerOption func(*MCPServer)

// ResourceHandlerFunc is a function that returns resource contents.
type ResourceHandlerFunc func(ctx context.Context, request mcp.ReadResourceRequest) ([]mcp.ResourceContents, error)

// ResourceTemplateHandlerFunc is a function that returns a resource template.
type ResourceTemplateHandlerFunc func(ctx context.Context, request mcp.ReadResourceRequest) ([]mcp.ResourceContents, error)

// PromptHandlerFunc handles prompt requests with given arguments.
type PromptHandlerFunc func(ctx context.Context, request mcp.GetPromptRequest) (*mcp.GetPromptResult, error)

// ToolHandlerFunc handles tool calls with given arguments.
type ToolHandlerFunc func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error)

// TaskToolHandlerFunc handles tool calls that execute asynchronously.
// It returns immediately with task creation info; the actual result is
// retrieved later via tasks/result.
type TaskToolHandlerFunc func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CreateTaskResult, error)

// ToolHandlerMiddleware is a middleware function that wraps a ToolHandlerFunc.
type ToolHandlerMiddleware func(ToolHandlerFunc) ToolHandlerFunc

// ResourceHandlerMiddleware is a middleware function that wraps a ResourceHandlerFunc.
type ResourceHandlerMiddleware func(ResourceHandlerFunc) ResourceHandlerFunc

// ToolFilterFunc is a function that filters tools based on context, typically
// using session information. Filters are applied both when listing tools
// (tools/list) and when calling tools (tools/call), so a filtered-out tool
// cannot be discovered or invoked. During tools/call, filters receive only the
// requested tool to keep the call-time access check off the full-list hot path.
type ToolFilterFunc func(ctx context.Context, tools []mcp.Tool) []mcp.Tool

// PromptHandlerMiddleware is a middleware function that wraps a PromptHandlerFunc.
type PromptHandlerMiddleware func(PromptHandlerFunc) PromptHandlerFunc

// PromptFilterFunc is a function that filters prompts based on context,
// typically using session information. Filters are applied both when listing
// prompts (prompts/list) and when retrieving prompts (prompts/get), so a
// filtered-out prompt cannot be discovered or accessed. During prompts/get,
// filters receive only the requested prompt to keep the get-time access check
// off the full-list hot path.
type PromptFilterFunc func(ctx context.Context, prompts []mcp.Prompt) []mcp.Prompt

// ServerTool combines a Tool with its ToolHandlerFunc.
type ServerTool struct {
	Tool    mcp.Tool
	Handler ToolHandlerFunc
}

// ServerTaskTool combines a Tool with its TaskToolHandlerFunc.
type ServerTaskTool struct {
	Tool    mcp.Tool
	Handler TaskToolHandlerFunc
}

// ServerPrompt combines a Prompt with its handler function.
type ServerPrompt struct {
	Prompt  mcp.Prompt
	Handler PromptHandlerFunc
}

// ServerResource combines a Resource with its handler function.
type ServerResource struct {
	Resource mcp.Resource
	Handler  ResourceHandlerFunc
}

// ServerResourceTemplate combines a ResourceTemplate with its handler function.
type ServerResourceTemplate struct {
	Template mcp.ResourceTemplate
	Handler  ResourceTemplateHandlerFunc
}

// serverKey is the context key for storing the server instance
type serverKey struct{}

// ServerFromContext retrieves the MCPServer instance from a context
func ServerFromContext(ctx context.Context) *MCPServer {
	if srv, ok := ctx.Value(serverKey{}).(*MCPServer); ok {
		return srv
	}
	return nil
}

// UnparsableMessageError is attached to the RequestError when json.Unmarshal
// fails on the request.
type UnparsableMessageError struct {
	message json.RawMessage
	method  mcp.MCPMethod
	err     error
}

func (e *UnparsableMessageError) Error() string {
	return fmt.Sprintf("unparsable %s request: %s", e.method, e.err)
}

func (e *UnparsableMessageError) Unwrap() error {
	return e.err
}

func (e *UnparsableMessageError) GetMessage() json.RawMessage {
	return e.message
}

func (e *UnparsableMessageError) GetMethod() mcp.MCPMethod {
	return e.method
}

// RequestError is an error that can be converted to a JSON-RPC error.
// Implements Unwrap() to allow inspecting the error chain.
type requestError struct {
	id   any
	code int
	err  error
	// message, when set, is sent instead of err.Error().
	message *string
	// data, when set, is sent as the data member of the JSON-RPC error.
	data any
}

func (e *requestError) Error() string {
	return fmt.Sprintf("request error: %s", e.err)
}

func (e *requestError) ToJSONRPCError() mcp.JSONRPCError {
	message := e.err.Error()
	if e.message != nil {
		message = *e.message
	}
	return mcp.JSONRPCError{
		JSONRPC: mcp.JSONRPC_VERSION,
		ID:      mcp.NewRequestId(e.id),
		Error:   mcp.NewJSONRPCErrorDetails(e.code, message, e.data),
	}
}

func (e *requestError) Unwrap() error {
	return e.err
}

// NotificationHandlerFunc handles incoming notifications.
type NotificationHandlerFunc func(ctx context.Context, notification mcp.JSONRPCNotification)

// MCPServer implements a Model Context Protocol server that can handle various types of requests
// including resources, prompts, and tools.
type MCPServer struct {
	// Separate mutexes for different resource types
	resourcesMu            sync.RWMutex
	resourceMiddlewareMu   sync.RWMutex
	promptsMu              sync.RWMutex
	toolsMu                sync.RWMutex
	toolMiddlewareMu       sync.RWMutex
	promptMiddlewareMu     sync.RWMutex
	notificationHandlersMu sync.RWMutex
	capabilitiesMu         sync.RWMutex
	toolFiltersMu          sync.RWMutex
	promptFiltersMu        sync.RWMutex
	tasksMu                sync.RWMutex

	// Test-only checkpoint configured before the server is used concurrently.
	beforeCapabilityRegistration func()

	name                       string
	version                    string
	implementation             mcp.Implementation
	instructions               string
	resources                  map[string]resourceEntry
	resourceTemplates          map[string]resourceTemplateEntry
	prompts                    map[string]mcp.Prompt
	promptHandlers             map[string]PromptHandlerFunc
	tools                      map[string]ServerTool
	taskTools                  map[string]ServerTaskTool
	toolHandlerMiddlewares     []ToolHandlerMiddleware
	resourceHandlerMiddlewares []ResourceHandlerMiddleware
	promptHandlerMiddlewares   []PromptHandlerMiddleware
	toolFilters                []ToolFilterFunc
	promptFilters              []PromptFilterFunc
	notificationHandlers       map[string]NotificationHandlerFunc
	promptCompletionProvider   PromptCompletionProvider
	resourceCompletionProvider ResourceCompletionProvider
	capabilities               serverCapabilities
	cacheHints                 map[mcp.MCPMethod]cacheHints
	// toolHeaderBindings holds each registered tool's x-mcp-header bindings,
	// extracted once at registration so a tools/call never re-reads the input
	// schema. Keyed like tools and taskTools and kept in step with them under
	// toolsMu; session tools are not cached here.
	toolHeaderBindings map[string][]mcp.ParamHeaderBinding
	// allowServerInitiatedRequests keeps RequestSampling, RequestElicitation,
	// and RequestRoots usable against clients speaking protocol version
	// 2026-07-28 or later. See WithLegacyServerInitiatedRequests.
	allowServerInitiatedRequests bool
	paginationLimit              *int
	toolResultSizeLimit          int
	sessions                     sync.Map
	listenSessions               sync.Map // see registerListenSession
	hooks                        *Hooks
	taskHooks                    *TaskHooks
	tasks                        map[string]*taskEntry
	expiredTasks                 map[string]time.Time // Tracks recently expired task IDs with expiration timestamp
	maxConcurrentTasks           *int                 // Optional limit on concurrent running tasks
	activeTasks                  int                  // Current count of running (non-terminal) tasks
	inflightCancels              sync.Map             // Maps request ID -> context.CancelFunc for in-flight requests
	inputValidator               *inputSchemaValidator
	outputValidator              *outputSchemaValidator
	strictInputSchemaDefault     bool
	tracer                       tracing.Tracer
	propagator                   tracing.Propagator
	metaPropagator               tracing.MetaPropagator
	requestLogger                *slog.Logger
}

// WithCacheHints sets the default SEP-2549 caching hints advertised on
// tools/list, prompts/list, resources/list, resources/templates/list,
// resources/read, and server/discover results.
//
// ttlMs is a freshness hint in milliseconds: clients may reuse a cached
// response for that long before re-fetching. Zero, the default, asks clients
// to revalidate every time. scope controls whether shared intermediaries may
// cache the response across authorization contexts.
//
// The hints are only emitted to clients using protocol version 2026-07-28 or
// later, which is where the fields were introduced.
func WithCacheHints(ttlMs int64, scope mcp.CacheScope) ServerOption {
	return func(s *MCPServer) {
		s.capabilitiesMu.Lock()
		defer s.capabilitiesMu.Unlock()
		if s.cacheHints == nil {
			s.cacheHints = make(map[mcp.MCPMethod]cacheHints)
		}
		s.cacheHints[""] = cacheHints{ttlMs: ttlMs, scope: scope}
	}
}

// WithMethodCacheHints sets the SEP-2549 caching hints advertised on the
// result of a single method, overriding any default set by [WithCacheHints].
func WithMethodCacheHints(method mcp.MCPMethod, ttlMs int64, scope mcp.CacheScope) ServerOption {
	return func(s *MCPServer) {
		s.capabilitiesMu.Lock()
		defer s.capabilitiesMu.Unlock()
		if s.cacheHints == nil {
			s.cacheHints = make(map[mcp.MCPMethod]cacheHints)
		}
		s.cacheHints[method] = cacheHints{ttlMs: ttlMs, scope: scope}
	}
}

// WithLegacyServerInitiatedRequests keeps [MCPServer.RequestSampling],
// [MCPServer.RequestElicitation], and [MCPServer.RequestRoots] usable against
// clients speaking protocol version 2026-07-28 or later.
//
// That revision replaced server-initiated requests with multi round-trip
// requests (SEP-2322), so by default those methods return
// [ErrServerInitiatedRequestUnsupported] rather than sending a request the
// client is not obliged to answer. Enabling this option restores the old
// behaviour, which still works over genuinely bidirectional transports such as
// stdio and in-process, but not over stateless Streamable HTTP.
//
// Deprecated: server-initiated requests were removed in protocol version
// 2026-07-28 (SEP-2322). Prefer [InputRequestBuilder], which produces handlers
// that work against clients of either protocol era. This option exists to ease
// migration and will be removed once the deprecation window closes.
func WithLegacyServerInitiatedRequests() ServerOption {
	return func(s *MCPServer) {
		s.allowServerInitiatedRequests = true
	}
}

// WithPaginationLimit sets the maximum page size for list results.
// Zero and negative limits leave the list unpaged.
func WithPaginationLimit(limit int) ServerOption {
	return func(s *MCPServer) {
		s.paginationLimit = &limit
	}
}

// WithToolResultSizeLimit replaces a tool result whose JSON encoding is
// larger than maxBytes with an error result. The oversized payload is not
// sent. The same check runs for a synchronous call and for both task
// execution paths, before the result is stored. Zero and negative limits
// disable the check.
func WithToolResultSizeLimit(maxBytes int) ServerOption {
	return func(s *MCPServer) {
		s.toolResultSizeLimit = maxBytes
	}
}

// serverCapabilities defines the supported features of the MCP server
type serverCapabilities struct {
	tools        *toolCapabilities
	resources    *resourceCapabilities
	prompts      *promptCapabilities
	logging      *bool
	sampling     *bool
	elicitation  *bool
	roots        *bool
	tasks        *taskCapabilities
	completions  *bool
	experimental map[string]any
	extensions   map[string]any
}

// resourceCapabilities defines the supported resource-related features
type resourceCapabilities struct {
	subscribe   bool
	listChanged bool
}

// promptCapabilities defines the supported prompt-related features
type promptCapabilities struct {
	listChanged bool
}

// toolCapabilities defines the supported tool-related features
type toolCapabilities struct {
	listChanged bool
}

// taskCapabilities defines the supported task-related features
type taskCapabilities struct {
	list          bool
	cancel        bool
	toolCallTasks bool
}

// WithResourceCapabilities configures resource-related server capabilities
func WithResourceCapabilities(subscribe, listChanged bool) ServerOption {
	return func(s *MCPServer) {
		// Always create a non-nil capability object
		s.capabilities.resources = &resourceCapabilities{
			subscribe:   subscribe,
			listChanged: listChanged,
		}
	}
}

// WithPromptCompletionProvider sets a custom prompt completion provider
func WithPromptCompletionProvider(provider PromptCompletionProvider) ServerOption {
	return func(s *MCPServer) {
		s.promptCompletionProvider = provider
	}
}

// WithResourceCompletionProvider sets a custom resource completion provider
func WithResourceCompletionProvider(provider ResourceCompletionProvider) ServerOption {
	return func(s *MCPServer) {
		s.resourceCompletionProvider = provider
	}
}

// WithToolHandlerMiddleware allows adding a middleware for the
// tool handler call chain.
func WithToolHandlerMiddleware(
	toolHandlerMiddleware ToolHandlerMiddleware,
) ServerOption {
	return func(s *MCPServer) {
		s.toolMiddlewareMu.Lock()
		s.toolHandlerMiddlewares = append(s.toolHandlerMiddlewares, toolHandlerMiddleware)
		s.toolMiddlewareMu.Unlock()
	}
}

// Use adds one or more tool handler middlewares to the server.
// Middleware is applied in the order added (outermost first), matching net/http convention.
func (s *MCPServer) Use(mw ...ToolHandlerMiddleware) {
	s.toolMiddlewareMu.Lock()
	s.toolHandlerMiddlewares = append(s.toolHandlerMiddlewares, mw...)
	s.toolMiddlewareMu.Unlock()
}

// WithResourceHandlerMiddleware allows adding a middleware for the
// resource handler call chain.
func WithResourceHandlerMiddleware(
	resourceHandlerMiddleware ResourceHandlerMiddleware,
) ServerOption {
	return func(s *MCPServer) {
		s.resourceMiddlewareMu.Lock()
		s.resourceHandlerMiddlewares = append(s.resourceHandlerMiddlewares, resourceHandlerMiddleware)
		s.resourceMiddlewareMu.Unlock()
	}
}

// WithResourceRecovery adds a middleware that recovers from panics in resource handlers.
func WithResourceRecovery() ServerOption {
	return WithResourceHandlerMiddleware(func(next ResourceHandlerFunc) ResourceHandlerFunc {
		return func(ctx context.Context, request mcp.ReadResourceRequest) (result []mcp.ResourceContents, err error) {
			defer func() {
				if r := recover(); r != nil {
					err = fmt.Errorf(
						"panic recovered in %s resource handler: %v",
						request.Params.URI,
						r,
					)
				}
			}()
			return next(ctx, request)
		}
	})
}

// WithToolFilter adds a filter function that controls tool visibility and access.
// The filter is applied both when listing tools (tools/list) and when calling
// tools (tools/call). A tool that is filtered out cannot be discovered or
// invoked, ensuring that filters act as an access control boundary rather than
// just a visibility hint. Call-time checks pass only the requested tool to the
// filter, while list-time checks pass the full candidate list.
func WithToolFilter(
	toolFilter ToolFilterFunc,
) ServerOption {
	return func(s *MCPServer) {
		s.toolFiltersMu.Lock()
		s.toolFilters = append(s.toolFilters, toolFilter)
		s.toolFiltersMu.Unlock()
	}
}

// WithPromptHandlerMiddleware allows adding a middleware for the
// prompt handler call chain.
func WithPromptHandlerMiddleware(
	promptHandlerMiddleware PromptHandlerMiddleware,
) ServerOption {
	return func(s *MCPServer) {
		s.promptMiddlewareMu.Lock()
		s.promptHandlerMiddlewares = append(s.promptHandlerMiddlewares, promptHandlerMiddleware)
		s.promptMiddlewareMu.Unlock()
	}
}

// WithPromptFilter adds a filter function that controls prompt visibility and
// access. The filter is applied both when listing prompts (prompts/list) and
// when retrieving a prompt (prompts/get). A prompt that is filtered out cannot
// be discovered or accessed. Get-time checks pass only the requested prompt to
// the filter, while list-time checks pass the full candidate list.
func WithPromptFilter(
	promptFilter PromptFilterFunc,
) ServerOption {
	return func(s *MCPServer) {
		s.promptFiltersMu.Lock()
		s.promptFilters = append(s.promptFilters, promptFilter)
		s.promptFiltersMu.Unlock()
	}
}

// WithRecovery adds a middleware that recovers from panics in tool handlers.
func WithRecovery() ServerOption {
	return WithToolHandlerMiddleware(func(next ToolHandlerFunc) ToolHandlerFunc {
		return func(ctx context.Context, request mcp.CallToolRequest) (result *mcp.CallToolResult, err error) {
			defer func() {
				if r := recover(); r != nil {
					err = fmt.Errorf(
						"panic recovered in %s tool handler: %v",
						request.Params.Name,
						r,
					)
				}
			}()
			return next(ctx, request)
		}
	})
}

// WithInputSchemaValidation enables server-side validation of tool call
// arguments against each tool's declared inputSchema. When validation fails
// the server returns a tool execution error result (CallToolResult with
// IsError: true) per [SEP-1303] so that the language model receives the
// failure details in its context window and can self-correct (for example,
// when it sends an unknown parameter name).
//
// Validation is opt-in to preserve backwards compatibility with servers whose
// hand-written schemas may not perfectly describe the arguments their handlers
// actually accept. Enabling it is recommended for new servers and for any
// server whose schemas are accurate.
//
// Tools whose input schemas cannot be compiled (malformed JSON Schema) are
// silently skipped, so a single broken schema cannot block tool calls.
//
// [SEP-1303]: https://modelcontextprotocol.io/seps/1303-input-validation-errors-as-tool-execution-errors
func WithInputSchemaValidation() ServerOption {
	return func(s *MCPServer) {
		if s.inputValidator == nil {
			s.inputValidator = newInputSchemaValidator()
		}
	}
}

// WithStrictInputSchemaDefault sets additionalProperties:false on every
// registered tool's input schema when the tool author has not configured the
// field explicitly. Tools published by such a server reject unknown property
// names — at the client (which sees the strict schema in tools/list) and at
// the server when [WithInputSchemaValidation] is also enabled.
//
// Tools that supply [mcp.Tool.RawInputSchema] are not modified: those authors
// have opted out of the structured-schema helpers and own additionalProperties
// themselves. Tools that explicitly call
// [mcp.WithSchemaAdditionalProperties] are left untouched, so a single tool
// can opt back into permissive behaviour while the server default stays
// strict.
//
// The option is independent of [WithInputSchemaValidation]: setting strict
// schemas without server-side enforcement still steers schema-aware clients
// and language models away from unknown arguments.
func WithStrictInputSchemaDefault() ServerOption {
	return func(s *MCPServer) {
		s.strictInputSchemaDefault = true
	}
}

// WithOutputSchemaValidation enables server-side validation of tool call
// results against each tool's declared outputSchema. When a tool returns a
// CallToolResult whose StructuredContent does not conform to the schema, the
// server replaces the result with a tool execution error (CallToolResult with
// IsError: true) so the client never sees a result that violates the
// declared contract.
//
// The MCP tools specification states that when an outputSchema is provided,
// the tool result MUST include structuredContent conforming to that schema.
// Enabling this option enforces that contract at runtime.
//
// Validation is skipped for results whose StructuredContent is nil and for
// error results (IsError: true). Tools whose output schemas cannot be
// compiled (malformed JSON Schema) are silently skipped, matching the
// behaviour of WithInputSchemaValidation, so a single broken schema cannot
// block tool calls.
//
// This option is opt-in to preserve backwards compatibility with servers
// whose hand-written output schemas may not perfectly describe the values
// their handlers actually return. Enabling it is recommended for any server
// whose schemas are accurate.
func WithOutputSchemaValidation() ServerOption {
	return func(s *MCPServer) {
		if s.outputValidator == nil {
			s.outputValidator = newOutputSchemaValidator()
		}
	}
}

// WithHooks allows adding hooks that will be called before or after
// either [all] requests or before / after specific request methods, or else
// prior to returning an error to the client.
func WithHooks(hooks *Hooks) ServerOption {
	return func(s *MCPServer) {
		s.hooks = hooks
	}
}

// GetHooks returns the server's current Hooks instance, or nil if no hooks
// have been configured. The returned pointer can be used to add additional
// hooks via the Add* methods without replacing existing hook registrations.
func (s *MCPServer) GetHooks() *Hooks {
	return s.hooks
}

// WithTaskHooks allows adding hooks for task lifecycle events.
// Use these hooks to monitor task execution, track metrics, and observe
// task-augmented tool behavior.
func WithTaskHooks(taskHooks *TaskHooks) ServerOption {
	return func(s *MCPServer) {
		s.taskHooks = taskHooks
	}
}

// WithMaxConcurrentTasks sets a limit on the maximum number of concurrent running tasks.
// When this limit is reached, attempts to create new tasks will fail with an error.
// If not set (or set to 0), there is no limit on concurrent tasks.
func WithMaxConcurrentTasks(limit int) ServerOption {
	return func(s *MCPServer) {
		s.maxConcurrentTasks = &limit
	}
}

// WithPromptCapabilities configures prompt-related server capabilities
func WithPromptCapabilities(listChanged bool) ServerOption {
	return func(s *MCPServer) {
		// Always create a non-nil capability object
		s.capabilities.prompts = &promptCapabilities{
			listChanged: listChanged,
		}
	}
}

// WithToolCapabilities configures tool-related server capabilities
func WithToolCapabilities(listChanged bool) ServerOption {
	return func(s *MCPServer) {
		// Always create a non-nil capability object
		s.capabilities.tools = &toolCapabilities{
			listChanged: listChanged,
		}
	}
}

// WithLogging enables logging capabilities for the server
func WithLogging() ServerOption {
	return func(s *MCPServer) {
		s.capabilities.logging = mcp.ToBoolPtr(true)
	}
}

// WithElicitation enables elicitation capabilities for the server
func WithElicitation() ServerOption {
	return func(s *MCPServer) {
		s.capabilities.elicitation = mcp.ToBoolPtr(true)
	}
}

// WithRoots returns a ServerOption that enables the roots capability on the MCPServer
func WithRoots() ServerOption {
	return func(s *MCPServer) {
		s.capabilities.roots = mcp.ToBoolPtr(true)
	}
}

// WithTaskCapabilities configures task-related server capabilities
func WithTaskCapabilities(list, cancel, toolCallTasks bool) ServerOption {
	return func(s *MCPServer) {
		// Always create a non-nil capability object
		s.capabilities.tasks = &taskCapabilities{
			list:          list,
			cancel:        cancel,
			toolCallTasks: toolCallTasks,
		}
	}
}

// WithInstructions sets the server instructions for the client returned in the initialize response
func WithInstructions(instructions string) ServerOption {
	return func(s *MCPServer) {
		s.instructions = instructions
	}
}

// WithCompletions enables the completion capability
func WithCompletions() ServerOption {
	return func(s *MCPServer) {
		s.capabilities.completions = mcp.ToBoolPtr(true)
	}
}

// WithExperimental sets experimental, non-standard capabilities on the server.
func WithExperimental(experimental map[string]any) ServerOption {
	return func(s *MCPServer) {
		s.capabilities.experimental = experimental
	}
}

// WithExtensions advertises support for optional MCP extensions beyond the
// core protocol, as a map of extension identifier to that extension's settings
// object. An empty object means the extension is supported with no additional
// settings.
//
// Extension identifiers follow the _meta key naming rules, so they carry a
// mandatory prefix - for example "io.modelcontextprotocol/tasks" for the Tasks
// extension, or "io.modelcontextprotocol/ui" for MCP Apps.
//
// Extensions were formalized in protocol version 2026-07-28. When one party
// supports an extension and the other does not, the supporting party must
// either fall back to core protocol behaviour or reject the request.
func WithExtensions(extensions map[string]any) ServerOption {
	return func(s *MCPServer) {
		s.capabilities.extensions = extensions
	}
}

// WithIcons sets the server icons for the implementation metadata returned
// during initialization. The icons slice and nested Sizes fields are defensively
// copied to prevent external mutation.
func WithIcons(icons ...mcp.Icon) ServerOption {
	return func(s *MCPServer) {
		copied := make([]mcp.Icon, len(icons))
		for i, icon := range icons {
			copied[i] = icon
			if icon.Sizes != nil {
				copied[i].Sizes = make([]string, len(icon.Sizes))
				copy(copied[i].Sizes, icon.Sizes)
			}
		}
		s.implementation.Icons = copied
	}
}

// WithTitle sets the human-readable display title for the server implementation.
func WithTitle(title string) ServerOption {
	return func(s *MCPServer) {
		s.implementation.Title = title
	}
}

// WithDescription sets the description for the server implementation.
func WithDescription(description string) ServerOption {
	return func(s *MCPServer) {
		s.implementation.Description = description
	}
}

// WithWebsiteURL sets the website URL for the server implementation.
func WithWebsiteURL(websiteURL string) ServerOption {
	return func(s *MCPServer) {
		s.implementation.WebsiteURL = websiteURL
	}
}

// NewMCPServer creates a new MCP server instance with the given name, version and options
func NewMCPServer(
	name, version string,
	opts ...ServerOption,
) *MCPServer {
	s := &MCPServer{
		resources:                  make(map[string]resourceEntry),
		resourceTemplates:          make(map[string]resourceTemplateEntry),
		prompts:                    make(map[string]mcp.Prompt),
		promptHandlers:             make(map[string]PromptHandlerFunc),
		tools:                      make(map[string]ServerTool),
		taskTools:                  make(map[string]ServerTaskTool),
		toolHeaderBindings:         make(map[string][]mcp.ParamHeaderBinding),
		toolHandlerMiddlewares:     make([]ToolHandlerMiddleware, 0),
		resourceHandlerMiddlewares: make([]ResourceHandlerMiddleware, 0),
		promptHandlerMiddlewares:   make([]PromptHandlerMiddleware, 0),
		name:                       name,
		version:                    version,
		notificationHandlers:       make(map[string]NotificationHandlerFunc),
		tasks:                      make(map[string]*taskEntry),
		expiredTasks:               make(map[string]time.Time),
		promptCompletionProvider:   &DefaultPromptCompletionProvider{},
		resourceCompletionProvider: &DefaultResourceCompletionProvider{},
		capabilities: serverCapabilities{
			tools:       nil,
			resources:   nil,
			prompts:     nil,
			logging:     nil,
			sampling:    nil,
			elicitation: nil,
			roots:       nil,
			tasks:       nil,
			completions: nil,
		},
		tracer:     tracing.NoopTracer(),
		propagator: tracing.NoopPropagator(),
	}

	for _, opt := range opts {
		opt(s)
	}

	return s
}

// GenerateInProcessSessionID generates a unique session ID for inprocess clients
func (s *MCPServer) GenerateInProcessSessionID() string {
	return GenerateInProcessSessionID()
}

// AddResources registers multiple resources at once
func (s *MCPServer) AddResources(resources ...ServerResource) {
	s.implicitlyRegisterResourceCapabilities()

	s.resourcesMu.Lock()
	for _, entry := range resources {
		s.resources[entry.Resource.URI] = resourceEntry{
			resource: entry.Resource,
			handler:  entry.Handler,
		}
	}
	s.resourcesMu.Unlock()

	// When the list of available resources changes, servers that declared the listChanged capability SHOULD send a notification
	if s.capabilities.resources.listChanged {
		// Send notification to all initialized sessions
		s.SendNotificationToAllClients(mcp.MethodNotificationResourcesListChanged, nil)
	}
}

// SetResources replaces all existing resources with the provided list
func (s *MCPServer) SetResources(resources ...ServerResource) {
	s.implicitlyRegisterResourceCapabilities()
	s.resourcesMu.Lock()
	s.resources = make(map[string]resourceEntry, len(resources))
	for _, item := range resources {
		s.resources[item.Resource.URI] = resourceEntry{resource: item.Resource, handler: item.Handler}
	}
	s.resourcesMu.Unlock()
	if s.capabilities.resources.listChanged {
		s.SendNotificationToAllClients(mcp.MethodNotificationResourcesListChanged, nil)
	}
}

// AddResource registers a new resource and its handler
func (s *MCPServer) AddResource(
	resource mcp.Resource,
	handler ResourceHandlerFunc,
) {
	s.AddResources(ServerResource{Resource: resource, Handler: handler})
}

// DeleteResources removes resources from the server
func (s *MCPServer) DeleteResources(uris ...string) {
	s.resourcesMu.Lock()
	var exists bool
	for _, uri := range uris {
		if _, ok := s.resources[uri]; ok {
			delete(s.resources, uri)
			exists = true
		}
	}
	s.resourcesMu.Unlock()

	// Send notification to all initialized sessions if listChanged capability is enabled and we actually remove a resource
	if exists && s.capabilities.resources != nil && s.capabilities.resources.listChanged {
		s.SendNotificationToAllClients(mcp.MethodNotificationResourcesListChanged, nil)
	}
}

// ListResources returns a copy of the registered resources map.
func (s *MCPServer) ListResources() map[string]*ServerResource {
	s.resourcesMu.RLock()
	defer s.resourcesMu.RUnlock()
	if len(s.resources) == 0 {
		return nil
	}
	resourcesCopy := make(map[string]*ServerResource, len(s.resources))
	for uri, entry := range s.resources {
		resourcesCopy[uri] = &ServerResource{
			Resource: entry.resource,
			Handler:  entry.handler,
		}
	}
	return resourcesCopy
}

// RemoveResource removes a resource from the server
func (s *MCPServer) RemoveResource(uri string) {
	s.resourcesMu.Lock()
	_, exists := s.resources[uri]
	if exists {
		delete(s.resources, uri)
	}
	s.resourcesMu.Unlock()

	// Send notification to all initialized sessions if listChanged capability is enabled and we actually remove a resource
	if exists && s.capabilities.resources != nil && s.capabilities.resources.listChanged {
		s.SendNotificationToAllClients(mcp.MethodNotificationResourcesListChanged, nil)
	}
}

// AddResourceTemplates registers multiple resource templates at once
func (s *MCPServer) AddResourceTemplates(resourceTemplates ...ServerResourceTemplate) {
	s.implicitlyRegisterResourceCapabilities()

	s.resourcesMu.Lock()
	for _, entry := range resourceTemplates {
		s.resourceTemplates[entry.Template.URITemplate.Raw()] = resourceTemplateEntry{
			template: entry.Template,
			handler:  entry.Handler,
		}
	}
	s.resourcesMu.Unlock()

	// When the list of available resources changes, servers that declared the listChanged capability SHOULD send a notification
	if s.capabilities.resources.listChanged {
		// Send notification to all initialized sessions
		s.SendNotificationToAllClients(mcp.MethodNotificationResourcesListChanged, nil)
	}
}

// SetResourceTemplates replaces all existing resource templates with the provided list
func (s *MCPServer) SetResourceTemplates(templates ...ServerResourceTemplate) {
	s.implicitlyRegisterResourceCapabilities()
	s.resourcesMu.Lock()
	s.resourceTemplates = make(map[string]resourceTemplateEntry, len(templates))
	for _, item := range templates {
		s.resourceTemplates[item.Template.URITemplate.Raw()] = resourceTemplateEntry{template: item.Template, handler: item.Handler}
	}
	s.resourcesMu.Unlock()
	if s.capabilities.resources.listChanged {
		s.SendNotificationToAllClients(mcp.MethodNotificationResourcesListChanged, nil)
	}
}

// AddResourceTemplate registers a new resource template and its handler
func (s *MCPServer) AddResourceTemplate(
	template mcp.ResourceTemplate,
	handler ResourceTemplateHandlerFunc,
) {
	s.AddResourceTemplates(ServerResourceTemplate{Template: template, Handler: handler})
}

// AddPrompts registers multiple prompts at once
func (s *MCPServer) AddPrompts(prompts ...ServerPrompt) {
	s.implicitlyRegisterPromptCapabilities()

	s.promptsMu.Lock()
	for _, entry := range prompts {
		s.prompts[entry.Prompt.Name] = entry.Prompt
		s.promptHandlers[entry.Prompt.Name] = entry.Handler
	}
	s.promptsMu.Unlock()

	// When the list of available prompts changes, servers that declared the listChanged capability SHOULD send a notification.
	if s.capabilities.prompts.listChanged {
		// Send notification to all initialized sessions
		s.SendNotificationToAllClients(mcp.MethodNotificationPromptsListChanged, nil)
	}
}

// AddPrompt registers a new prompt handler with the given name
func (s *MCPServer) AddPrompt(prompt mcp.Prompt, handler PromptHandlerFunc) {
	s.AddPrompts(ServerPrompt{Prompt: prompt, Handler: handler})
}

// SetPrompts replaces all existing prompts with the provided list
func (s *MCPServer) SetPrompts(prompts ...ServerPrompt) {
	s.implicitlyRegisterPromptCapabilities()
	s.promptsMu.Lock()
	s.prompts = make(map[string]mcp.Prompt, len(prompts))
	s.promptHandlers = make(map[string]PromptHandlerFunc, len(prompts))
	for _, item := range prompts {
		s.prompts[item.Prompt.Name] = item.Prompt
		s.promptHandlers[item.Prompt.Name] = item.Handler
	}
	s.promptsMu.Unlock()
	if s.capabilities.prompts.listChanged {
		s.SendNotificationToAllClients(mcp.MethodNotificationPromptsListChanged, nil)
	}
}

// DeletePrompts removes prompts from the server
func (s *MCPServer) DeletePrompts(names ...string) {
	s.promptsMu.Lock()
	var exists bool
	for _, name := range names {
		if _, ok := s.prompts[name]; ok {
			delete(s.prompts, name)
			delete(s.promptHandlers, name)
			exists = true
		}
	}
	s.promptsMu.Unlock()

	// Send notification to all initialized sessions if listChanged capability is enabled, and we actually remove a prompt
	if exists && s.capabilities.prompts != nil && s.capabilities.prompts.listChanged {
		// Send notification to all initialized sessions
		s.SendNotificationToAllClients(mcp.MethodNotificationPromptsListChanged, nil)
	}
}

// ListPrompts returns a copy of the registered prompts map.
func (s *MCPServer) ListPrompts() map[string]*ServerPrompt {
	s.promptsMu.RLock()
	defer s.promptsMu.RUnlock()
	if len(s.prompts) == 0 {
		return nil
	}
	promptsCopy := make(map[string]*ServerPrompt, len(s.prompts))
	for name, prompt := range s.prompts {
		promptsCopy[name] = &ServerPrompt{
			Prompt:  prompt,
			Handler: s.promptHandlers[name],
		}
	}
	return promptsCopy
}

// applyStrictInputSchemaDefault fills in additionalProperties:false on a
// registered tool's structured input schema when WithStrictInputSchemaDefault
// is set and the author has not configured the field. Tools that ship a
// RawInputSchema are skipped — those bypass the structured-schema helpers
// and own additionalProperties themselves.
func (s *MCPServer) applyStrictInputSchemaDefault(tool *mcp.Tool) {
	if !s.strictInputSchemaDefault {
		return
	}
	if len(tool.RawInputSchema) > 0 {
		return
	}
	if tool.InputSchema.AdditionalProperties != nil {
		return
	}
	tool.InputSchema.AdditionalProperties = false
}

// validateToolHeaderAnnotations rejects a tool definition whose x-mcp-header
// annotations violate the SEP-2243 constraints, rather than emitting headers
// that gateways cannot route on. Servers MUST refuse such definitions.
func validateToolHeaderAnnotations(tool *mcp.Tool) error {
	if err := mcp.ValidateParamHeaderAnnotations(tool); err != nil {
		return fmt.Errorf("tool %q has invalid x-mcp-header annotations: %w", tool.Name, err)
	}
	return nil
}

// AddTool registers a new tool and its handler
func (s *MCPServer) AddTool(tool mcp.Tool, handler ToolHandlerFunc) {
	s.AddTools(ServerTool{Tool: tool, Handler: handler})
}

// AddTaskTool registers a new task tool and its handler
func (s *MCPServer) AddTaskTool(tool mcp.Tool, handler TaskToolHandlerFunc) {
	s.AddTaskTools(ServerTaskTool{Tool: tool, Handler: handler})
}

// Register tool capabilities due to a tool being added.  Default to
// listChanged: true, but don't change the value if we've already explicitly
// registered tools.listChanged false.
func (s *MCPServer) implicitlyRegisterToolCapabilities() {
	s.implicitlyRegisterCapabilities(
		func() bool { return s.capabilities.tools != nil },
		func() { s.capabilities.tools = &toolCapabilities{listChanged: true} },
	)
}

func (s *MCPServer) implicitlyRegisterResourceCapabilities() {
	s.implicitlyRegisterCapabilities(
		func() bool { return s.capabilities.resources != nil },
		func() { s.capabilities.resources = &resourceCapabilities{} },
	)
}

func (s *MCPServer) implicitlyRegisterPromptCapabilities() {
	s.implicitlyRegisterCapabilities(
		func() bool { return s.capabilities.prompts != nil },
		func() { s.capabilities.prompts = &promptCapabilities{} },
	)
}

func (s *MCPServer) implicitlyRegisterCapabilities(check func() bool, register func()) {
	if s.beforeCapabilityRegistration != nil {
		s.beforeCapabilityRegistration()
	}
	s.capabilitiesMu.RLock()
	if check() {
		s.capabilitiesMu.RUnlock()
		return
	}
	s.capabilitiesMu.RUnlock()

	s.capabilitiesMu.Lock()
	if !check() {
		register()
	}
	s.capabilitiesMu.Unlock()
}

// AddTools registers multiple tools at once
func (s *MCPServer) AddTools(tools ...ServerTool) {
	s.implicitlyRegisterToolCapabilities()

	s.toolsMu.Lock()
	// Stage the whole batch before touching the registry so a rejected entry
	// leaves earlier ones unregistered as well.
	staged := make(map[string]ServerTool, len(tools))
	for _, entry := range tools {
		name := entry.Tool.Name
		// Check for collision with task tools
		if _, exists := s.taskTools[name]; exists {
			s.toolsMu.Unlock()
			panic(fmt.Sprintf("tool name '%s' already registered as task tool", name))
		}
		s.applyStrictInputSchemaDefault(&entry.Tool)
		if err := validateToolHeaderAnnotations(&entry.Tool); err != nil {
			s.toolsMu.Unlock()
			panic(err.Error())
		}
		staged[name] = entry
	}
	maps.Copy(s.tools, staged)
	for name, entry := range staged {
		s.toolHeaderBindings[name] = mcp.ExtractParamHeaderBindings(&entry.Tool)
	}
	s.toolsMu.Unlock()

	// When the list of available tools changes, servers that declared the listChanged capability SHOULD send a notification.
	if s.capabilities.tools.listChanged {
		// Send notification to all initialized sessions
		s.SendNotificationToAllClients(mcp.MethodNotificationToolsListChanged, nil)
	}
}

// AddTaskTools registers multiple task tools at once
func (s *MCPServer) AddTaskTools(taskTools ...ServerTaskTool) {
	s.implicitlyRegisterToolCapabilities()

	s.toolsMu.Lock()
	staged := make(map[string]ServerTaskTool, len(taskTools))
	for _, entry := range taskTools {
		name := entry.Tool.Name
		// Check for collision with regular tools
		if _, exists := s.tools[name]; exists {
			s.toolsMu.Unlock()
			panic(fmt.Sprintf("task tool name '%s' already registered as regular tool", name))
		}
		s.applyStrictInputSchemaDefault(&entry.Tool)
		if err := validateToolHeaderAnnotations(&entry.Tool); err != nil {
			s.toolsMu.Unlock()
			panic(err.Error())
		}
		staged[name] = entry
	}
	maps.Copy(s.taskTools, staged)
	for name, entry := range staged {
		s.toolHeaderBindings[name] = mcp.ExtractParamHeaderBindings(&entry.Tool)
	}
	s.toolsMu.Unlock()

	// When the list of available tools changes, servers that declared the listChanged capability SHOULD send a notification.
	if s.capabilities.tools.listChanged {
		// Send notification to all initialized sessions
		s.SendNotificationToAllClients(mcp.MethodNotificationToolsListChanged, nil)
	}
}

// SetTools replaces all existing tools with the provided list
func (s *MCPServer) SetTools(tools ...ServerTool) {
	s.implicitlyRegisterToolCapabilities()

	s.toolsMu.Lock()
	newTools := make(map[string]ServerTool, len(tools))
	for _, entry := range tools {
		name := entry.Tool.Name
		// Check for collision with task tools
		if _, exists := s.taskTools[name]; exists {
			s.toolsMu.Unlock()
			panic(fmt.Sprintf("tool name '%s' already registered as task tool", name))
		}
		s.applyStrictInputSchemaDefault(&entry.Tool)
		if err := validateToolHeaderAnnotations(&entry.Tool); err != nil {
			s.toolsMu.Unlock()
			panic(err.Error())
		}
		newTools[name] = entry
	}
	for name := range s.tools {
		delete(s.toolHeaderBindings, name)
	}
	s.tools = newTools
	for name, entry := range newTools {
		s.toolHeaderBindings[name] = mcp.ExtractParamHeaderBindings(&entry.Tool)
	}
	s.toolsMu.Unlock()
	s.inputValidator.invalidateAll()
	s.outputValidator.invalidateAll()

	// When the list of available tools changes, servers that declared the listChanged capability SHOULD send a notification.
	if s.capabilities.tools.listChanged {
		// Send notification to all initialized sessions
		s.SendNotificationToAllClients(mcp.MethodNotificationToolsListChanged, nil)
	}
}

// GetTool retrieves the specified tool
func (s *MCPServer) GetTool(toolName string) *ServerTool {
	s.toolsMu.RLock()
	defer s.toolsMu.RUnlock()
	if tool, ok := s.tools[toolName]; ok {
		return &tool
	}
	return nil
}

func (s *MCPServer) ListTools() map[string]*ServerTool {
	s.toolsMu.RLock()
	defer s.toolsMu.RUnlock()
	if len(s.tools) == 0 {
		return nil
	}
	// Create a copy to prevent external modification
	toolsCopy := make(map[string]*ServerTool, len(s.tools))
	for name, tool := range s.tools {
		toolsCopy[name] = &ServerTool{
			Tool:    tool.Tool,
			Handler: tool.Handler,
		}
	}
	return toolsCopy
}

// DeleteTools removes tools from the server
func (s *MCPServer) DeleteTools(names ...string) {
	s.toolsMu.Lock()
	var exists bool
	for _, name := range names {
		if _, ok := s.tools[name]; ok {
			delete(s.tools, name)
			delete(s.toolHeaderBindings, name)
			exists = true
		}
	}
	s.toolsMu.Unlock()

	// Drop any cached compiled input/output schemas for the removed tools so
	// a tool re-added later under the same name does not reuse a stale
	// compilation.
	s.inputValidator.invalidate(names...)
	s.outputValidator.invalidate(names...)

	// When the list of available tools changes, servers that declared the listChanged capability SHOULD send a notification.
	if exists && s.capabilities.tools != nil && s.capabilities.tools.listChanged {
		// Send notification to all initialized sessions
		s.SendNotificationToAllClients(mcp.MethodNotificationToolsListChanged, nil)
	}
}

// AddNotificationHandler registers a new handler for incoming notifications
func (s *MCPServer) AddNotificationHandler(
	method string,
	handler NotificationHandlerFunc,
) {
	s.notificationHandlersMu.Lock()
	defer s.notificationHandlersMu.Unlock()
	s.notificationHandlers[method] = handler
}

// serverCapabilities builds the capability set advertised by this server.
// It is shared by the legacy initialize handshake and the modern
// server/discover RPC.
func (s *MCPServer) serverCapabilitiesSnapshot() mcp.ServerCapabilities {
	// Capabilities are registered at runtime - AddTool implicitly enables the
	// tools capability, for example - so reads must be synchronized against
	// those writers.
	s.capabilitiesMu.RLock()
	defer s.capabilitiesMu.RUnlock()

	capabilities := mcp.ServerCapabilities{}

	// Only add resource capabilities if they're configured
	if s.capabilities.resources != nil {
		capabilities.Resources = &struct {
			Subscribe   bool `json:"subscribe,omitempty"`
			ListChanged bool `json:"listChanged,omitempty"`
		}{
			Subscribe:   s.capabilities.resources.subscribe,
			ListChanged: s.capabilities.resources.listChanged,
		}
	}

	// Only add prompt capabilities if they're configured
	if s.capabilities.prompts != nil {
		capabilities.Prompts = &struct {
			ListChanged bool `json:"listChanged,omitempty"`
		}{
			ListChanged: s.capabilities.prompts.listChanged,
		}
	}

	// Only add tool capabilities if they're configured
	if s.capabilities.tools != nil {
		capabilities.Tools = &struct {
			ListChanged bool `json:"listChanged,omitempty"`
		}{
			ListChanged: s.capabilities.tools.listChanged,
		}
	}

	if s.capabilities.logging != nil && *s.capabilities.logging {
		capabilities.Logging = &struct{}{}
	}

	if s.capabilities.sampling != nil && *s.capabilities.sampling {
		capabilities.Sampling = &mcp.SamplingCapability{}
	}

	if s.capabilities.elicitation != nil && *s.capabilities.elicitation {
		capabilities.Elicitation = &mcp.ElicitationCapability{}
	}

	if s.capabilities.roots != nil && *s.capabilities.roots {
		capabilities.Roots = &struct{}{}
	}

	// Only add task capabilities if they're configured
	if s.capabilities.tasks != nil {
		tasksCapability := &mcp.TasksCapability{}

		if s.capabilities.tasks.list {
			tasksCapability.List = &struct{}{}
		}

		if s.capabilities.tasks.cancel {
			tasksCapability.Cancel = &struct{}{}
		}

		if s.capabilities.tasks.toolCallTasks {
			tasksCapability.Requests = &mcp.TaskRequestsCapability{
				Tools: &struct {
					Call *struct{} `json:"call,omitempty"`
				}{
					Call: &struct{}{},
				},
			}
		}

		capabilities.Tasks = tasksCapability
	}

	if s.capabilities.completions != nil && *s.capabilities.completions {
		capabilities.Completions = &struct{}{}
	}

	if s.capabilities.experimental != nil {
		capabilities.Experimental = s.capabilities.experimental
	}

	if s.capabilities.extensions != nil {
		capabilities.Extensions = s.capabilities.extensions
	}

	return capabilities
}

// serverImplementation returns the identity this server reports to clients.
func (s *MCPServer) serverImplementation() mcp.Implementation {
	return mcp.Implementation{
		Name:        s.name,
		Version:     s.version,
		Title:       s.implementation.Title,
		Description: s.implementation.Description,
		WebsiteURL:  s.implementation.WebsiteURL,
		Icons:       s.implementation.Icons,
	}
}

func (s *MCPServer) handleInitialize(
	ctx context.Context,
	_ any,
	request mcp.InitializeRequest,
) (*mcp.InitializeResult, *requestError) {
	capabilities := s.serverCapabilitiesSnapshot()

	result := mcp.InitializeResult{
		ProtocolVersion: s.protocolVersion(request.Params.ProtocolVersion),
		ServerInfo:      s.serverImplementation(),
		Capabilities:    capabilities,
		Instructions:    s.instructions,
	}

	if session := ClientSessionFromContext(ctx); session != nil {
		session.Initialize()

		// Store client info if the session supports it
		if sessionWithClientInfo, ok := session.(SessionWithClientInfo); ok {
			sessionWithClientInfo.SetClientInfo(request.Params.ClientInfo)
			sessionWithClientInfo.SetClientCapabilities(request.Params.Capabilities)
		}
		if versioned, ok := session.(sessionProtocolVersionSetter); ok {
			versioned.SetProtocolVersion(result.ProtocolVersion)
		}
	}

	return &result, nil
}

// protocolVersion returns the protocol version to report in an
// InitializeResult, given the version the client requested.
//
// The initialize handshake was removed in protocol version 2026-07-28, so the
// negotiated version is always capped at [mcp.LATEST_LEGACY_PROTOCOL_VERSION].
// Clients reach the modern, stateless protocol via server/discover instead.
func (s *MCPServer) protocolVersion(clientVersion string) string {
	return mcp.NegotiateLegacyVersion(clientVersion)
}

func (s *MCPServer) handlePing(
	_ context.Context,
	_ any,
	_ mcp.PingRequest,
) (*mcp.EmptyResult, *requestError) {
	return &mcp.EmptyResult{}, nil
}

// handleSubscribe processes a resources/subscribe request. Servers that opt in
// to the resources.subscribe capability via WithResourceCapabilities must
// accept this request; otherwise it is rejected as unsupported. The default
// implementation only validates input and acknowledges the request. Users that
// need to react to subscriptions (for example to track which sessions should
// receive notifications/resources/updated) should register Hooks.AddBeforeSubscribe
// or Hooks.AddAfterSubscribe, or implement an optional SessionWithResourceSubscriptions
// interface on their ClientSession.
func (s *MCPServer) handleSubscribe(
	ctx context.Context,
	id any,
	request mcp.SubscribeRequest,
) (*mcp.EmptyResult, *requestError) {
	if s.capabilities.resources == nil || !s.capabilities.resources.subscribe {
		return nil, &requestError{
			id:   id,
			code: mcp.METHOD_NOT_FOUND,
			err:  fmt.Errorf("resources subscribe %w", ErrUnsupported),
		}
	}
	if request.Params.URI == "" {
		return nil, &requestError{
			id:   id,
			code: mcp.INVALID_PARAMS,
			err:  errors.New("uri is required"),
		}
	}

	if session := ClientSessionFromContext(ctx); session != nil {
		switch subs := session.(type) {
		case SessionWithResourceSubscriptionsErr:
			if err := subs.SubscribeToResourceErr(request.Params.URI); err != nil {
				return nil, &requestError{
					id:   id,
					code: resourceNotFoundCode(ctx),
					err:  err,
				}
			}
		case SessionWithResourceSubscriptions:
			subs.SubscribeToResource(request.Params.URI)
		}
	}

	return &mcp.EmptyResult{}, nil
}

// handleUnsubscribe processes a resources/unsubscribe request. The default
// implementation validates input, removes any tracked subscription on the
// current session if it implements SessionWithResourceSubscriptions, and
// acknowledges the request. Unsubscribing a URI that was never subscribed to
// is treated as a no-op for spec compatibility.
func (s *MCPServer) handleUnsubscribe(
	ctx context.Context,
	id any,
	request mcp.UnsubscribeRequest,
) (*mcp.EmptyResult, *requestError) {
	if s.capabilities.resources == nil || !s.capabilities.resources.subscribe {
		return nil, &requestError{
			id:   id,
			code: mcp.METHOD_NOT_FOUND,
			err:  fmt.Errorf("resources unsubscribe %w", ErrUnsupported),
		}
	}
	if request.Params.URI == "" {
		return nil, &requestError{
			id:   id,
			code: mcp.INVALID_PARAMS,
			err:  errors.New("uri is required"),
		}
	}

	if session := ClientSessionFromContext(ctx); session != nil {
		if subs, ok := session.(SessionWithResourceSubscriptions); ok {
			subs.UnsubscribeFromResource(request.Params.URI)
		}
	}

	return &mcp.EmptyResult{}, nil
}

func (s *MCPServer) handleSetLevel(
	ctx context.Context,
	id any,
	request mcp.SetLevelRequest,
) (*mcp.EmptyResult, *requestError) {
	clientSession := ClientSessionFromContext(ctx)
	if clientSession == nil || !clientSession.Initialized() {
		return nil, &requestError{
			id:   id,
			code: mcp.INTERNAL_ERROR,
			err:  ErrSessionNotInitialized,
		}
	}

	sessionLogging, ok := clientSession.(SessionWithLogging)
	if !ok {
		return nil, &requestError{
			id:   id,
			code: mcp.INTERNAL_ERROR,
			err:  ErrSessionDoesNotSupportLogging,
		}
	}

	level := request.Params.Level
	// Validate logging level
	switch level {
	case mcp.LoggingLevelDebug, mcp.LoggingLevelInfo, mcp.LoggingLevelNotice,
		mcp.LoggingLevelWarning, mcp.LoggingLevelError, mcp.LoggingLevelCritical,
		mcp.LoggingLevelAlert, mcp.LoggingLevelEmergency:
		// Valid level
	default:
		return nil, &requestError{
			id:   id,
			code: mcp.INVALID_PARAMS,
			err:  fmt.Errorf("invalid logging level '%s'", level),
		}
	}

	sessionLogging.SetLogLevel(level)

	return &mcp.EmptyResult{}, nil
}

// listByPagination returns the page of allElements that follows cursor.
// allElements must be sorted by name, then by pageTieBreak.
func listByPagination[T mcp.Named](
	_ context.Context,
	s *MCPServer,
	cursor mcp.Cursor,
	allElements []T,
) ([]T, mcp.Cursor, error) {
	startPos := 0
	if cursor != "" {
		encodedName, encodedTieBreak, hasTieBreak := strings.Cut(string(cursor), ".")
		c, err := base64.StdEncoding.DecodeString(encodedName)
		if err != nil {
			return nil, "", err
		}
		name := string(c)
		if !hasTieBreak {
			// Legacy cursors identify only a name. Preserve their continuation
			// after the whole name group instead of restarting at its first URI.
			startPos = sort.Search(len(allElements), func(i int) bool {
				return allElements[i].GetName() > name
			})
		} else {
			t, err := base64.StdEncoding.DecodeString(encodedTieBreak)
			if err != nil {
				return nil, "", err
			}
			tieBreak := string(t)
			startPos = sort.Search(len(allElements), func(i int) bool {
				return comparePageKey(&allElements[i], name, tieBreak) > 0
			})
		}
	}
	endPos := len(allElements)
	if s.paginationLimit != nil && *s.paginationLimit > 0 {
		if len(allElements)-startPos > *s.paginationLimit {
			endPos = startPos + *s.paginationLimit
		}
	}
	elementsToReturn := allElements[startPos:endPos]
	// Every list result holds its items in a required array. allElements can
	// be nil: the resource and task lists start out that way, and a filter
	// that hides every item may return nil. A nil slice would go out as null.
	if elementsToReturn == nil {
		elementsToReturn = []T{}
	}
	// set the next cursor
	nextCursor := func() mcp.Cursor {
		if s.paginationLimit != nil && *s.paginationLimit > 0 && len(elementsToReturn) >= *s.paginationLimit {
			return encodePageCursor(&elementsToReturn[len(elementsToReturn)-1])
		}
		return ""
	}()
	return elementsToReturn, nextCursor, nil
}

// pageTieBreak orders list elements that share a name. Tool, prompt and task
// names are unique, but resource and resource template names need not be, so
// those are ordered by URI or URI template within a name. Without it, the
// cursor could not say where among equally named elements a page ended, and
// the rest of them would be skipped.
func pageTieBreak[T mcp.Named](element *T) string {
	switch e := any(element).(type) {
	case *mcp.Resource:
		return e.URI
	case *mcp.ResourceTemplate:
		if e.URITemplate != nil {
			return e.URITemplate.Raw()
		}
	}
	return ""
}

// comparePageKey compares element with the position given by a name and a
// tie-break. The tie-break is only looked at when the names are equal.
func comparePageKey[T mcp.Named](element *T, name, tieBreak string) int {
	if c := cmp.Compare((*element).GetName(), name); c != 0 {
		return c
	}
	return cmp.Compare(pageTieBreak(element), tieBreak)
}

// encodePageCursor returns the cursor for the page after element: the base64
// of its name, followed for resources and templates by a dot and the base64 of
// their URI, even when empty. The dot distinguishes composite cursors from
// legacy name-only cursors and is outside the base64 alphabet.
func encodePageCursor[T mcp.Named](element *T) mcp.Cursor {
	cursor := base64.StdEncoding.EncodeToString([]byte((*element).GetName()))
	switch any(element).(type) {
	case *mcp.Resource, *mcp.ResourceTemplate:
		cursor += "." + base64.StdEncoding.EncodeToString([]byte(pageTieBreak(element)))
	}
	return mcp.Cursor(cursor)
}

func (s *MCPServer) handleListResources(
	ctx context.Context,
	id any,
	request mcp.ListResourcesRequest,
) (*mcp.ListResourcesResult, *requestError) {
	s.resourcesMu.RLock()
	resourceMap := make(map[string]mcp.Resource, len(s.resources))
	for uri, entry := range s.resources {
		resourceMap[uri] = entry.resource
	}
	s.resourcesMu.RUnlock()

	// Check if there are session-specific resources
	session := ClientSessionFromContext(ctx)
	if session != nil {
		if sessionWithResources, ok := session.(SessionWithResources); ok {
			if sessionResources := sessionWithResources.GetSessionResources(); sessionResources != nil {
				// Merge session-specific resources with global resources
				for uri, serverResource := range sessionResources {
					resourceMap[uri] = serverResource.Resource
				}
			}
		}
	}

	// Sort the resources by name, then URI
	resourcesList := slices.SortedFunc(maps.Values(resourceMap), func(a, b mcp.Resource) int {
		if c := cmp.Compare(a.Name, b.Name); c != 0 {
			return c
		}
		return cmp.Compare(a.URI, b.URI)
	})

	// Apply pagination
	resourcesToReturn, nextCursor, err := listByPagination(
		ctx,
		s,
		request.Params.Cursor,
		resourcesList,
	)
	if err != nil {
		return nil, &requestError{
			id:   id,
			code: mcp.INVALID_PARAMS,
			err:  err,
		}
	}

	result := mcp.ListResourcesResult{
		Resources: resourcesToReturn,
		PaginatedResult: mcp.PaginatedResult{
			NextCursor: nextCursor,
		},
	}
	return &result, nil
}

func (s *MCPServer) handleListResourceTemplates(
	ctx context.Context,
	id any,
	request mcp.ListResourceTemplatesRequest,
) (*mcp.ListResourceTemplatesResult, *requestError) {
	// Get global templates
	s.resourcesMu.RLock()
	templateMap := make(map[string]mcp.ResourceTemplate, len(s.resourceTemplates))
	for uri, entry := range s.resourceTemplates {
		templateMap[uri] = entry.template
	}
	s.resourcesMu.RUnlock()

	// Check if there are session-specific resource templates
	session := ClientSessionFromContext(ctx)
	if session != nil {
		if sessionWithTemplates, ok := session.(SessionWithResourceTemplates); ok {
			if sessionTemplates := sessionWithTemplates.GetSessionResourceTemplates(); sessionTemplates != nil {
				// Merge session-specific templates with global templates
				// Session templates override global ones
				for uriTemplate, serverTemplate := range sessionTemplates {
					templateMap[uriTemplate] = serverTemplate.Template
				}
			}
		}
	}

	// Convert map to slice for sorting and pagination
	templates := make([]mcp.ResourceTemplate, 0, len(templateMap))
	for _, template := range templateMap {
		templates = append(templates, template)
	}

	sort.Slice(templates, func(i, j int) bool {
		if c := strings.Compare(templates[i].Name, templates[j].Name); c != 0 {
			return c < 0
		}
		return pageTieBreak(&templates[i]) < pageTieBreak(&templates[j])
	})
	templatesToReturn, nextCursor, err := listByPagination(
		ctx,
		s,
		request.Params.Cursor,
		templates,
	)
	if err != nil {
		return nil, &requestError{
			id:   id,
			code: mcp.INVALID_PARAMS,
			err:  err,
		}
	}
	result := mcp.ListResourceTemplatesResult{
		ResourceTemplates: templatesToReturn,
		PaginatedResult: mcp.PaginatedResult{
			NextCursor: nextCursor,
		},
	}
	return &result, nil
}

func (s *MCPServer) handleReadResource(
	ctx context.Context,
	id any,
	request mcp.ReadResourceRequest,
) (*mcp.ReadResourceResult, *requestError) {
	s.resourcesMu.RLock()

	// First check session-specific resources
	var handler ResourceHandlerFunc
	var ok bool

	session := ClientSessionFromContext(ctx)
	if session != nil {
		if sessionWithResources, typeAssertOk := session.(SessionWithResources); typeAssertOk {
			if sessionResources := sessionWithResources.GetSessionResources(); sessionResources != nil {
				resource, sessionOk := sessionResources[request.Params.URI]
				if sessionOk {
					handler = resource.Handler
					ok = true
				}
			}
		}
	}

	// If not found in session tools, check global tools
	if !ok {
		globalResource, rok := s.resources[request.Params.URI]
		if rok {
			handler = globalResource.handler
			ok = true
		}
	}

	// First try direct resource handlers
	if ok {
		s.resourcesMu.RUnlock()

		finalHandler := handler
		s.resourceMiddlewareMu.RLock()
		mw := s.resourceHandlerMiddlewares
		// Apply middlewares in reverse order
		for _, m := range slices.Backward(mw) {
			finalHandler = m(finalHandler)
		}
		s.resourceMiddlewareMu.RUnlock()

		contents, err := finalHandler(ctx, request)
		if err != nil {
			return nil, handlerError(ctx, id, err)
		}
		return readResourceResult(contents), nil
	}

	// If no direct handler found, try matching against templates
	var matchedHandler ResourceTemplateHandlerFunc
	var matched bool

	// First check session templates if available
	if session != nil {
		if sessionWithTemplates, ok := session.(SessionWithResourceTemplates); ok {
			sessionTemplates := sessionWithTemplates.GetSessionResourceTemplates()
			for _, serverTemplate := range sessionTemplates {
				if serverTemplate.Template.URITemplate == nil {
					continue
				}
				if matchesTemplate(request.Params.URI, serverTemplate.Template.URITemplate) {
					matchedHandler = serverTemplate.Handler
					matched = true
					matchedVars := serverTemplate.Template.URITemplate.Match(request.Params.URI)
					// Convert matched variables to a map
					request.Params.Arguments = make(map[string]any, len(matchedVars))
					for name, value := range matchedVars {
						request.Params.Arguments[name] = value.V
					}
					break
				}
			}
		}
	}

	// If not found in session templates, check global templates
	if !matched {
		for _, entry := range s.resourceTemplates {
			template := entry.template
			if template.URITemplate == nil {
				continue
			}
			if matchesTemplate(request.Params.URI, template.URITemplate) {
				matchedHandler = entry.handler
				matched = true
				matchedVars := template.URITemplate.Match(request.Params.URI)
				// Convert matched variables to a map
				request.Params.Arguments = make(map[string]any, len(matchedVars))
				for name, value := range matchedVars {
					request.Params.Arguments[name] = value.V
				}
				break
			}
		}
	}
	s.resourcesMu.RUnlock()

	if matched {
		// If a match is found, then we have a final handler and can
		// apply middlewares.
		s.resourceMiddlewareMu.RLock()
		finalHandler := ResourceHandlerFunc(matchedHandler)
		mw := s.resourceHandlerMiddlewares
		// Apply middlewares in reverse order
		for _, m := range slices.Backward(mw) {
			finalHandler = m(finalHandler)
		}
		s.resourceMiddlewareMu.RUnlock()
		contents, err := finalHandler(ctx, request)
		if err != nil {
			return nil, handlerError(ctx, id, err)
		}
		return readResourceResult(contents), nil
	}

	return nil, &requestError{
		id:   id,
		code: resourceNotFoundCode(ctx),
		err: fmt.Errorf(
			"handler not found for resource URI '%s': %w",
			request.Params.URI,
			ErrResourceNotFound,
		),
	}
}

// readResourceResult wraps the contents a resource handler returned. contents
// is a required array, so a handler that found nothing still sends [] rather
// than null.
func readResourceResult(contents []mcp.ResourceContents) *mcp.ReadResourceResult {
	if contents == nil {
		contents = []mcp.ResourceContents{}
	}
	return &mcp.ReadResourceResult{Contents: contents}
}

// matchesTemplate checks if a URI matches a URI template pattern
func matchesTemplate(uri string, template *mcp.URITemplate) bool {
	return template.Regexp().MatchString(uri)
}

// filteredPrompts builds the full prompt candidate set and applies all
// registered prompt filters. This is the single source of truth for which
// prompts are visible in a given context, used by both handleListPrompts
// and handleGetPrompt to guarantee consistent behavior.
func (s *MCPServer) filteredPrompts(ctx context.Context) []mcp.Prompt {
	s.promptsMu.RLock()
	prompts := make([]mcp.Prompt, 0, len(s.prompts))
	for _, prompt := range s.prompts {
		prompts = append(prompts, prompt)
	}
	s.promptsMu.RUnlock()

	// sort prompts by name
	sort.Slice(prompts, func(i, j int) bool {
		return prompts[i].Name < prompts[j].Name
	})

	// Apply prompt filters if any are defined
	s.promptFiltersMu.RLock()
	if len(s.promptFilters) > 0 {
		for _, filter := range s.promptFilters {
			prompts = filter(ctx, prompts)
		}
	}
	s.promptFiltersMu.RUnlock()

	return prompts
}

func (s *MCPServer) passesPromptFilters(ctx context.Context, prompt mcp.Prompt) bool {
	s.promptFiltersMu.RLock()
	defer s.promptFiltersMu.RUnlock()
	if len(s.promptFilters) == 0 {
		return true
	}

	prompts := []mcp.Prompt{prompt}
	for _, filter := range s.promptFilters {
		prompts = filter(ctx, prompts)
		if len(prompts) == 0 {
			return false
		}
	}

	for _, candidate := range prompts {
		if candidate.Name == prompt.Name {
			return true
		}
	}
	return false
}

func (s *MCPServer) handleListPrompts(
	ctx context.Context,
	id any,
	request mcp.ListPromptsRequest,
) (*mcp.ListPromptsResult, *requestError) {
	prompts := s.filteredPrompts(ctx)

	promptsToReturn, nextCursor, err := listByPagination(
		ctx,
		s,
		request.Params.Cursor,
		prompts,
	)
	if err != nil {
		return nil, &requestError{
			id:   id,
			code: mcp.INVALID_PARAMS,
			err:  err,
		}
	}
	result := mcp.ListPromptsResult{
		Prompts: promptsToReturn,
		PaginatedResult: mcp.PaginatedResult{
			NextCursor: nextCursor,
		},
	}
	return &result, nil
}

func (s *MCPServer) handleGetPrompt(
	ctx context.Context,
	id any,
	request mcp.GetPromptRequest,
) (*mcp.GetPromptResult, *requestError) {
	s.promptsMu.RLock()
	handler, ok := s.promptHandlers[request.Params.Name]
	prompt := s.prompts[request.Params.Name]
	s.promptsMu.RUnlock()

	if !ok {
		return nil, &requestError{
			id:   id,
			code: mcp.INVALID_PARAMS,
			err:  fmt.Errorf("prompt '%s' not found: %w", request.Params.Name, ErrPromptNotFound),
		}
	}

	// Enforce prompt filters at get time to prevent access to filtered-out
	// prompts. Only the requested prompt is passed through the filter chain so
	// this access check does not rebuild and filter the full prompt list.
	if !s.passesPromptFilters(ctx, prompt) {
		return nil, &requestError{
			id:   id,
			code: mcp.INVALID_PARAMS,
			err:  fmt.Errorf("prompt '%s' not found: %w", request.Params.Name, ErrPromptNotFound),
		}
	}

	finalHandler := handler

	s.promptMiddlewareMu.RLock()
	mw := s.promptHandlerMiddlewares

	// Apply middlewares in reverse order
	for _, m := range slices.Backward(mw) {
		finalHandler = m(finalHandler)
	}
	s.promptMiddlewareMu.RUnlock()

	result, err := finalHandler(ctx, request)
	if err != nil {
		return nil, handlerError(ctx, id, err)
	}

	// Bridge a handler asking for more input to clients that predate the
	// multi round-trip pattern (SEP-2322).
	result, err = resolveMultiRoundTrip(ctx, s, result, getPromptResultNeedsInput,
		func(ctx context.Context, roundTrip mcp.MultiRoundTripParams) (*mcp.GetPromptResult, error) {
			retried := request
			retried.Params.MultiRoundTripParams = roundTrip
			return finalHandler(ctx, retried)
		})
	if err != nil {
		return nil, handlerError(ctx, id, err)
	}

	// messages is a required array, so a prompt with no messages still sends
	// [] rather than null. A result asking for input has no messages yet. The
	// handler's result is copied rather than modified, as it may be shared.
	if result != nil && result.Messages == nil && !result.NeedsInput() {
		withMessages := *result
		withMessages.Messages = []mcp.PromptMessage{}
		result = &withMessages
	}

	// A handler that returns neither a result nor an error, on the first call
	// or on a retry, must still produce a response. The dispatcher would
	// otherwise dereference the nil result and panic.
	if result == nil {
		return nil, &requestError{
			id:   id,
			code: mcp.INTERNAL_ERROR,
			err:  noResultError("prompt", request.Params.Name),
		}
	}

	return result, nil
}

// filteredTools builds the full tool candidate set (global + task + session)
// and applies all registered tool filters. This is the single source of truth
// for which tools are visible in a given context, used by both handleListTools
// and handleToolCall to guarantee consistent behavior.
func (s *MCPServer) filteredTools(ctx context.Context) []mcp.Tool {
	// Get the base tools from the server (both regular and task tools)
	s.toolsMu.RLock()
	tools := make([]mcp.Tool, 0, len(s.tools)+len(s.taskTools))

	// Get all tool names for consistent ordering
	toolNames := make([]string, 0, len(s.tools)+len(s.taskTools))
	for name := range s.tools {
		toolNames = append(toolNames, name)
	}
	for name := range s.taskTools {
		toolNames = append(toolNames, name)
	}

	// Sort the tool names for consistent ordering
	sort.Strings(toolNames)

	// Add tools in sorted order
	for _, name := range toolNames {
		if tool, ok := s.tools[name]; ok {
			tools = append(tools, tool.Tool)
		} else if taskTool, ok := s.taskTools[name]; ok {
			tools = append(tools, taskTool.Tool)
		}
	}
	s.toolsMu.RUnlock()

	// Check if there are session-specific tools
	session := ClientSessionFromContext(ctx)
	if session != nil {
		if sessionWithTools, ok := session.(SessionWithTools); ok {
			if sessionTools := sessionWithTools.GetSessionTools(); sessionTools != nil {
				// Override or add session-specific tools
				// We need to create a map first to merge the tools properly
				toolMap := make(map[string]mcp.Tool)

				// Add global tools first
				for _, tool := range tools {
					toolMap[tool.Name] = tool
				}

				// Then override with session-specific tools
				for name, serverTool := range sessionTools {
					toolMap[name] = serverTool.Tool
				}

				// Convert back to slice
				tools = make([]mcp.Tool, 0, len(toolMap))
				for _, tool := range toolMap {
					tools = append(tools, tool)
				}

				// Sort again to maintain consistent ordering
				sort.Slice(tools, func(i, j int) bool {
					return tools[i].Name < tools[j].Name
				})
			}
		}
	}

	// Apply tool filters if any are defined
	s.toolFiltersMu.RLock()
	if len(s.toolFilters) > 0 {
		for _, filter := range s.toolFilters {
			tools = filter(ctx, tools)
		}
	}
	s.toolFiltersMu.RUnlock()

	return tools
}

func (s *MCPServer) passesToolFilters(ctx context.Context, tool mcp.Tool) bool {
	s.toolFiltersMu.RLock()
	defer s.toolFiltersMu.RUnlock()
	if len(s.toolFilters) == 0 {
		return true
	}

	tools := []mcp.Tool{tool}
	for _, filter := range s.toolFilters {
		tools = filter(ctx, tools)
		if len(tools) == 0 {
			return false
		}
	}

	for _, candidate := range tools {
		if candidate.Name == tool.Name {
			return true
		}
	}
	return false
}

func (s *MCPServer) handleListTools(
	ctx context.Context,
	id any,
	request mcp.ListToolsRequest,
) (*mcp.ListToolsResult, *requestError) {
	tools := s.filteredTools(ctx)

	// Apply pagination
	toolsToReturn, nextCursor, err := listByPagination(
		ctx,
		s,
		request.Params.Cursor,
		tools,
	)
	if err != nil {
		return nil, &requestError{
			id:   id,
			code: mcp.INVALID_PARAMS,
			err:  err,
		}
	}

	result := mcp.ListToolsResult{
		Tools: toolsToReturn,
		PaginatedResult: mcp.PaginatedResult{
			NextCursor: nextCursor,
		},
	}
	return &result, nil
}

func (s *MCPServer) handleToolCall(
	ctx context.Context,
	id any,
	request mcp.CallToolRequest,
) (any, *requestError) {
	// First check session-specific tools
	var tool ServerTool
	var ok bool
	var taskToolOnly bool

	session := ClientSessionFromContext(ctx)
	if session != nil {
		if sessionWithTools, typeAssertOk := session.(SessionWithTools); typeAssertOk {
			if sessionTools := sessionWithTools.GetSessionTools(); sessionTools != nil {
				var sessionOk bool
				tool, sessionOk = sessionTools[request.Params.Name]
				if sessionOk {
					ok = true
				}
			}
		}
	}

	// If not found in session tools, check global tools
	if !ok {
		s.toolsMu.RLock()
		tool, ok = s.tools[request.Params.Name]
		// If not in regular tools, check task tools
		if !ok {
			if taskTool, taskOk := s.taskTools[request.Params.Name]; taskOk {
				// Convert ServerTaskTool to ServerTool for validation
				// The tool metadata is the same, we just need it for checking task support
				tool = ServerTool{
					Tool:    taskTool.Tool,
					Handler: nil, // Handler will be used from taskTool in handleTaskAugmentedToolCall
				}
				ok = true
				taskToolOnly = true
			}
		}
		s.toolsMu.RUnlock()
	}

	if !ok {
		return nil, &requestError{
			id:   id,
			code: mcp.INVALID_PARAMS,
			err:  fmt.Errorf("tool '%s' not found: %w", request.Params.Name, ErrToolNotFound),
		}
	}

	// Enforce tool filters at call time to prevent access to filtered-out
	// tools. Only the requested tool is passed through the filter chain so this
	// access check does not rebuild and filter the full tool list.
	if !s.passesToolFilters(ctx, tool.Tool) {
		return nil, &requestError{
			id:   id,
			code: mcp.INVALID_PARAMS,
			err:  fmt.Errorf("tool '%s' not found: %w", request.Params.Name, ErrToolNotFound),
		}
	}

	// Validate task support requirements
	if tool.Tool.Execution != nil && tool.Tool.Execution.TaskSupport == mcp.TaskSupportRequired {
		if request.Params.Task == nil {
			return nil, &requestError{
				id:   id,
				code: mcp.METHOD_NOT_FOUND,
				err:  fmt.Errorf("tool '%s' requires task augmentation", request.Params.Name),
			}
		}
	}

	// Check if this should be executed as a task (hybrid mode support)
	// Tools with TaskSupportOptional or TaskSupportRequired can be executed as tasks
	shouldExecuteAsTask := request.Params.Task != nil &&
		tool.Tool.Execution != nil &&
		(tool.Tool.Execution.TaskSupport == mcp.TaskSupportOptional ||
			tool.Tool.Execution.TaskSupport == mcp.TaskSupportRequired)

	if shouldExecuteAsTask {
		// Route to task-augmented execution handler
		return s.handleTaskAugmentedToolCall(ctx, id, request)
	}

	if taskToolOnly {
		return nil, &requestError{
			id:   id,
			code: mcp.METHOD_NOT_FOUND,
			err:  fmt.Errorf("tool '%s' does not support synchronous execution", request.Params.Name),
		}
	}

	// Validate the incoming arguments against the tool's input schema, when
	// schema validation has been enabled via WithInputSchemaValidation. A
	// validation failure is returned as a SEP-1303 tool execution error so the
	// model receives feedback in its context window and can self-correct.
	if s.inputValidator != nil {
		if _, err := s.inputValidator.validate(tool.Tool, request.GetRawArguments()); err != nil {
			return validationToolResult(err), nil
		}
	}

	finalHandler := tool.Handler

	s.toolMiddlewareMu.RLock()
	mw := slices.Clone(s.toolHandlerMiddlewares)
	s.toolMiddlewareMu.RUnlock()

	// Apply middlewares in reverse order
	for _, m := range slices.Backward(mw) {
		finalHandler = m(finalHandler)
	}

	result, err := finalHandler(ctx, request)
	if err != nil {
		return nil, handlerError(ctx, id, err)
	}

	// A handler may ask the client for more input before it can finish
	// (SEP-2322). Clients using protocol version 2026-07-28 or later receive
	// the request and retry; for older clients the requests are fulfilled here
	// with the server-initiated calls they understand, and the handler is
	// re-invoked with the answers.
	result, err = resolveMultiRoundTrip(ctx, s, result, callToolResultNeedsInput,
		func(ctx context.Context, roundTrip mcp.MultiRoundTripParams) (*mcp.CallToolResult, error) {
			retried := request
			retried.Params.MultiRoundTripParams = roundTrip
			return finalHandler(ctx, retried)
		})
	if err != nil {
		return nil, handlerError(ctx, id, err)
	}

	// Without this check a handler that returns neither a result nor an
	// error, on the first call or on a retry, would be answered with a null
	// result, which no client accepts.
	if result == nil {
		return nil, &requestError{
			id:   id,
			code: mcp.INTERNAL_ERROR,
			err:  noResultError("tool", request.Params.Name),
		}
	}

	// Validate the tool's StructuredContent against its declared output
	// schema when output schema validation has been enabled via
	// WithOutputSchemaValidation. A validation failure is surfaced as a
	// tool execution error so the client cannot silently receive a result
	// that violates the declared contract.
	if s.outputValidator != nil {
		if _, vErr := s.outputValidator.validate(tool.Tool, result); vErr != nil {
			return validationToolResult(vErr), nil
		}
	}

	return s.limitToolResult(result), nil
}

// limitToolResult returns result when it fits in the configured limit.
// An oversized payload is replaced with an error result so those bytes are
// not sent or stored. CreateTaskResult hides Content behind json:"-", so
// callers that store one must measure a CallToolResult view of the same fields.
func (s *MCPServer) limitToolResult(result *mcp.CallToolResult) *mcp.CallToolResult {
	if result == nil || s.toolResultSizeLimit <= 0 {
		return result
	}
	encoded, err := json.Marshal(result)
	if err != nil || len(encoded) <= s.toolResultSizeLimit {
		return result
	}
	return mcp.NewToolResultError(fmt.Sprintf("tool result exceeds %d bytes", s.toolResultSizeLimit))
}

// handleTaskAugmentedToolCall handles tool calls that are executed as tasks.
// It creates a task entry, starts async execution, and returns CreateTaskResult immediately.
func (s *MCPServer) handleTaskAugmentedToolCall(
	ctx context.Context,
	id any,
	request mcp.CallToolRequest,
) (*mcp.CreateTaskResult, *requestError) {
	// Look up the tool - check both taskTools and regular tools
	s.toolsMu.RLock()
	taskTool, isTaskTool := s.taskTools[request.Params.Name]
	regularTool, isRegularTool := s.tools[request.Params.Name]
	s.toolsMu.RUnlock()

	// A session's own tool takes precedence over the server's, as it does in
	// handleToolCall, which routed this call here after finding it there.
	if session := ClientSessionFromContext(ctx); session != nil {
		if sessionWithTools, ok := session.(SessionWithTools); ok {
			if sessionTool, ok := sessionWithTools.GetSessionTools()[request.Params.Name]; ok {
				regularTool, isRegularTool = sessionTool, true
				isTaskTool = false
			}
		}
	}

	// Determine which tool to use and validate task support
	var toolToUse ServerTaskTool
	var hasTaskHandler bool

	if isTaskTool {
		// Tool is registered as a task tool
		toolToUse = taskTool
		hasTaskHandler = true
	} else if isRegularTool {
		// Tool is a regular tool with task support
		// Validate that it actually supports task augmentation
		if regularTool.Tool.Execution == nil ||
			(regularTool.Tool.Execution.TaskSupport != mcp.TaskSupportOptional &&
				regularTool.Tool.Execution.TaskSupport != mcp.TaskSupportRequired) {
			return nil, &requestError{
				id:   id,
				code: mcp.METHOD_NOT_FOUND,
				err:  fmt.Errorf("tool '%s' does not support task augmentation", request.Params.Name),
			}
		}

		hasTaskHandler = false
	} else {
		// Tool not found in either map
		return nil, &requestError{
			id:   id,
			code: mcp.INVALID_PARAMS,
			err:  fmt.Errorf("tool '%s' not found", request.Params.Name),
		}
	}

	// Note: input schema validation (WithInputSchemaValidation) is currently
	// only applied on the synchronous tool call path. The task-augmented path
	// would need to surface validation failures through tasks/result rather
	// than the create-task response; that's deferred to a follow-up.

	// Generate task ID (UUID v4)
	taskID := uuid.New().String()

	// Extract TTL from task params
	var ttl *int64
	if request.Params.Task != nil {
		ttl = request.Params.Task.TTL
	}

	// Create task entry (pollInterval is nil - server doesn't set a default)
	entry, err := s.createTask(ctx, taskID, request.Params.Name, ttl, nil)
	if err != nil {
		return nil, &requestError{
			id:   id,
			code: mcp.INTERNAL_ERROR,
			err:  err,
		}
	}

	// Snapshot the task as "working" before launching execution, so the
	// CreateTaskResult reflects the just-created state even if the async
	// handler completes before we read it back (a fast/synchronous handler
	// can finish before this goroutine is scheduled).
	s.tasksMu.RLock()
	taskCopy := entry.task
	s.tasksMu.RUnlock()

	// Execute tool asynchronously
	// For regular tools being used as tasks, we need different execution logic
	if hasTaskHandler {
		go s.executeTaskTool(ctx, entry, toolToUse, request)
	} else {
		// Execute regular tool wrapped as a task
		go s.executeRegularToolAsTask(ctx, entry, regularTool, request)
	}

	// Return CreateTaskResult immediately with task as top-level field
	return &mcp.CreateTaskResult{
		Task: taskCopy,
	}, nil
}

// executeTaskTool executes a task tool handler asynchronously.
// It creates a cancellable context, stores the cancel function for potential cancellation,
// and executes the handler in the background, storing the result when complete.
func (s *MCPServer) executeTaskTool(
	ctx context.Context,
	entry *taskEntry,
	taskTool ServerTaskTool,
	request mcp.CallToolRequest,
) {
	defer func() {
		if r := recover(); r != nil {
			s.completeTask(entry, nil, fmt.Errorf("panic in task tool handler %s: %v", request.Params.Name, r))
		}
	}()

	// Create cancellable context for this task execution
	taskCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	// Register cancellation atomically with TTL cleanup, which may have
	// already removed the task, and with tasks/cancel, which may have ended
	// it while the created hook ran.
	s.tasksMu.Lock()
	entry.cancelFunc = cancel
	ended := s.tasks[entry.task.TaskId] != entry || entry.completed
	s.tasksMu.Unlock()
	if ended {
		cancel()
	}

	// Execute the task tool handler
	result, err := taskTool.Handler(taskCtx, request)

	if err != nil {
		// If the error is due to context cancellation, don't mark as failed.
		// The cancelTask method will handle setting the proper status.
		// However, if cancelTask hasn't been called yet, we should still mark it.
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			_ = s.cancelTaskEntry(ctx, entry, err.Error())
			return
		}

		// Task failed - complete with error
		s.completeTask(entry, nil, err)
		return
	}

	// tasks/result has nothing to report for a handler that returned neither
	// a result nor an error, so the task fails.
	if result == nil {
		s.completeTask(entry, nil, noResultError("tool", request.Params.Name))
		return
	}

	// Task succeeded - store the CreateTaskResult
	// Note: The actual result will be retrieved later via tasks/result
	//
	// Validate the StructuredContent against the tool's declared output
	// schema when WithOutputSchemaValidation is enabled. If validation fails,
	// persist a tool execution error in place of the bad result so the
	// client cannot retrieve a result that violates the schema via
	// tasks/result. handleTaskResult accepts both *CallToolResult and
	// *CreateTaskResult, so storing a *CallToolResult here is safe.
	if s.outputValidator != nil {
		if _, vErr := s.outputValidator.validateCreateTaskResult(taskTool.Tool, result); vErr != nil {
			s.completeTask(entry, validationToolResult(vErr), nil)
			return
		}
	}
	s.completeTask(entry, s.limitCreateTaskResult(result), nil)
}

// limitCreateTaskResult measures the payload tasks/result will copy out,
// including the handler's _meta. The content fields are omitted from
// CreateTaskResult's own JSON.
func (s *MCPServer) limitCreateTaskResult(result *mcp.CreateTaskResult) *mcp.CreateTaskResult {
	if result == nil {
		return nil
	}
	view := &mcp.CallToolResult{
		Result:            mcp.Result{Meta: result.Meta},
		Content:           result.Content,
		StructuredContent: result.StructuredContent,
		IsError:           result.IsError,
	}
	limited := s.limitToolResult(view)
	if limited == view {
		return result
	}
	stored := *result
	stored.Meta = nil
	stored.Content = limited.Content
	stored.StructuredContent = limited.StructuredContent
	stored.IsError = limited.IsError
	return &stored
}

// executeRegularToolAsTask executes a regular tool handler asynchronously as a task.
// This is used for hybrid mode where a tool with TaskSupportOptional is called with task params.
func (s *MCPServer) executeRegularToolAsTask(
	ctx context.Context,
	entry *taskEntry,
	regularTool ServerTool,
	request mcp.CallToolRequest,
) {
	// Create cancellable context for this task execution
	taskCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	// Register cancellation atomically with TTL cleanup, which may have
	// already removed the task, and with tasks/cancel, which may have ended
	// it while the created hook ran.
	s.tasksMu.Lock()
	entry.cancelFunc = cancel
	ended := s.tasks[entry.task.TaskId] != entry || entry.completed
	s.tasksMu.Unlock()
	if ended {
		cancel()
	}

	// Execute the regular tool handler with middleware applied
	finalHandler := regularTool.Handler

	s.toolMiddlewareMu.RLock()
	mw := slices.Clone(s.toolHandlerMiddlewares)
	s.toolMiddlewareMu.RUnlock()
	for _, m := range slices.Backward(mw) {
		finalHandler = m(finalHandler)
	}

	result, err := finalHandler(taskCtx, request)

	if err != nil {
		// If the error is due to context cancellation, don't mark as failed.
		// The cancelTask method will handle setting the proper status.
		// However, if cancelTask hasn't been called yet, we should still mark it.
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			_ = s.cancelTaskEntry(ctx, entry, err.Error())
			return
		}

		// Task failed - complete with error
		s.completeTask(entry, nil, err)
		return
	}

	// tasks/result has nothing to report for a handler that returned neither
	// a result nor an error, so the task fails.
	if result == nil {
		s.completeTask(entry, nil, noResultError("tool", request.Params.Name))
		return
	}

	// Task succeeded - store the CallToolResult directly
	// When retrieved via tasks/result, this will be returned to the client
	//
	// Mirror the synchronous path: validate the result's StructuredContent
	// against the tool's declared output schema when
	// WithOutputSchemaValidation is enabled. A validation failure replaces
	// the result with a tool execution error so the bad payload never
	// reaches the client via tasks/result.
	if s.outputValidator != nil {
		if _, vErr := s.outputValidator.validate(regularTool.Tool, result); vErr != nil {
			s.completeTask(entry, validationToolResult(vErr), nil)
			return
		}
	}
	s.completeTask(entry, s.limitToolResult(result), nil)
}

func (s *MCPServer) handleNotification(
	ctx context.Context,
	notification mcp.JSONRPCNotification,
) mcp.JSONRPCMessage {
	// Handle cancellation notifications per MCP spec
	if notification.Method == string(mcp.MethodNotificationCancelled) {
		if reqID, ok := notification.Params.AdditionalFields["requestId"]; ok {
			key := inflightKey(ctx, reqID)
			if cancel, loaded := s.inflightCancels.LoadAndDelete(key); loaded {
				if cancelFunc, ok := cancel.(context.CancelFunc); ok {
					cancelFunc()
				}
			}
		}
		return nil
	}

	s.notificationHandlersMu.RLock()
	handler, ok := s.notificationHandlers[notification.Method]
	s.notificationHandlersMu.RUnlock()

	if ok {
		handler(ctx, notification)
	}
	return nil
}

// inflightKey returns a session-scoped key for the inflight cancellation map.
// This prevents cross-session request ID collisions in multi-client scenarios.
func inflightKey(ctx context.Context, requestID any) string {
	requestID = mcp.NewRequestId(requestID).String()
	if session := ClientSessionFromContext(ctx); session != nil {
		return fmt.Sprintf("%s:%v", session.SessionID(), requestID)
	}
	return fmt.Sprintf(":%v", requestID)
}

func createResponse(id any, result any) mcp.JSONRPCMessage {
	return mcp.NewJSONRPCResultResponse(mcp.NewRequestId(id), result)
}

func createErrorResponse(
	id any,
	code int,
	message string,
) mcp.JSONRPCMessage {
	return mcp.JSONRPCError{
		JSONRPC: mcp.JSONRPC_VERSION,
		ID:      mcp.NewRequestId(id),
		Error:   mcp.NewJSONRPCErrorDetails(code, message, nil),
	}
}

//
// Task Request Handlers
//

// handleGetTask handles tasks/get requests to retrieve task status.
func (s *MCPServer) handleGetTask(
	ctx context.Context,
	id any,
	request mcp.GetTaskRequest,
) (*mcp.GetTaskResult, *requestError) {
	task, _, err := s.getTask(ctx, request.Params.TaskId)
	if err != nil {
		return nil, &requestError{
			id:   id,
			code: mcp.INVALID_PARAMS,
			err:  err,
		}
	}

	result := mcp.NewGetTaskResult(task)
	return &result, nil
}

// handleListTasks handles tasks/list requests to list all tasks.
func (s *MCPServer) handleListTasks(
	ctx context.Context,
	id any,
	request mcp.ListTasksRequest,
) (*mcp.ListTasksResult, *requestError) {
	tasks := s.listTasks(ctx)

	// Sort tasks by TaskId for consistent pagination
	sort.Slice(tasks, func(i, j int) bool {
		return tasks[i].TaskId < tasks[j].TaskId
	})

	// Apply pagination
	tasksToReturn, nextCursor, err := listByPagination(
		ctx,
		s,
		request.Params.Cursor,
		tasks,
	)
	if err != nil {
		return nil, &requestError{
			id:   id,
			code: mcp.INVALID_PARAMS,
			err:  err,
		}
	}

	result := mcp.ListTasksResult{
		Tasks: tasksToReturn,
		PaginatedResult: mcp.PaginatedResult{
			NextCursor: nextCursor,
		},
	}
	return &result, nil
}

// handleTaskResult handles tasks/result requests to get task results.
func (s *MCPServer) handleTaskResult(
	ctx context.Context,
	id any,
	request mcp.TaskResultRequest,
) (*mcp.TaskResultResult, *requestError) {
	task, done, err := s.getTask(ctx, request.Params.TaskId)
	if err != nil {
		return nil, &requestError{
			id:   id,
			code: mcp.INVALID_PARAMS,
			err:  err,
		}
	}

	// Wait for task completion if not terminal
	if !task.Status.IsTerminal() {
		select {
		case <-done:
			// Task completed
		case <-ctx.Done():
			return nil, &requestError{
				id:   id,
				code: mcp.REQUEST_INTERRUPTED,
				err:  ctx.Err(),
			}
		}
	}

	// Re-fetch the task entry to get the final result/error under lock
	entry, err := s.getTaskEntry(ctx, request.Params.TaskId)
	if err != nil {
		return nil, &requestError{
			id:   id,
			code: mcp.INVALID_PARAMS,
			err:  err,
		}
	}

	// Read result and error under lock
	s.tasksMu.RLock()
	storedResult := entry.result
	resultErr := entry.resultErr
	taskID := entry.task.TaskId
	s.tasksMu.RUnlock()

	// Return error if task failed
	if resultErr != nil {
		code := mcp.INTERNAL_ERROR
		if errors.Is(resultErr, context.Canceled) {
			code = mcp.REQUEST_INTERRUPTED
		}
		return nil, &requestError{
			id:   id,
			code: code,
			err:  resultErr,
		}
	}

	// Extract the CallToolResult and populate TaskResultResult
	result := &mcp.TaskResultResult{
		Result: mcp.Result{
			Meta: mcp.WithRelatedTask(taskID),
		},
	}

	switch taskResult := storedResult.(type) {
	case *mcp.CallToolResult:
		result.Content = taskResult.Content
		result.StructuredContent = taskResult.StructuredContent
		if len(taskResult.RawStructuredContent) > 0 {
			result.StructuredContent = append(json.RawMessage(nil), taskResult.RawStructuredContent...)
		}
		result.IsError = taskResult.IsError
		mergeTaskResultMeta(result, taskResult.Meta)
	case *mcp.CreateTaskResult:
		result.Content = taskResult.Content
		result.StructuredContent = taskResult.StructuredContent
		result.IsError = taskResult.IsError
		mergeTaskResultMeta(result, taskResult.Meta)
	}

	return result, nil
}

func mergeTaskResultMeta(result *mcp.TaskResultResult, meta *mcp.Meta) {
	if meta == nil {
		return
	}

	if result.Meta.AdditionalFields == nil {
		result.Meta.AdditionalFields = make(map[string]any)
	}

	for k, v := range meta.AdditionalFields {
		if k != mcp.RelatedTaskMetaKey {
			result.Meta.AdditionalFields[k] = v
		}
	}
}

// handleCancelTask handles tasks/cancel requests to cancel a task.
func (s *MCPServer) handleCancelTask(
	ctx context.Context,
	id any,
	request mcp.CancelTaskRequest,
) (*mcp.CancelTaskResult, *requestError) {
	err := s.cancelTask(ctx, request.Params.TaskId)
	if err != nil {
		return nil, &requestError{
			id:   id,
			code: mcp.INVALID_PARAMS,
			err:  err,
		}
	}

	// Get the updated task
	task, _, err := s.getTask(ctx, request.Params.TaskId)
	if err != nil {
		return nil, &requestError{
			id:   id,
			code: mcp.INVALID_PARAMS,
			err:  err,
		}
	}

	result := mcp.NewCancelTaskResult(task)
	return &result, nil
}

func (s *MCPServer) handleComplete(
	ctx context.Context,
	id any,
	request mcp.CompleteRequest,
) (*mcp.CompleteResult, *requestError) {
	var completion *mcp.Completion
	var err error
	switch ref := request.Params.Ref.(type) {
	case mcp.PromptReference:
		completion, err = s.promptCompletionProvider.CompletePromptArgument(
			ctx,
			ref.Name,
			request.Params.Argument,
			request.Params.Context,
		)
	case mcp.ResourceReference:
		completion, err = s.resourceCompletionProvider.CompleteResourceArgument(
			ctx,
			ref.URI,
			request.Params.Argument,
			request.Params.Context,
		)
	default:
		return nil, &requestError{
			id:   id,
			code: mcp.INVALID_REQUEST,
			err:  fmt.Errorf("unknown reference type: %v", ref),
		}
	}
	if err != nil {
		return nil, &requestError{
			id:   id,
			code: mcp.INTERNAL_ERROR,
			err:  err,
		}
	}

	// Defensive nil check: default providers always return non-nil completions,
	// but custom providers might erroneously return nil. Treat as empty result.
	if completion == nil {
		completion = &mcp.Completion{}
	}

	result := &mcp.CompleteResult{
		Completion: *completion,
	}
	// values is a required array, so a provider with no matches still sends []
	// rather than null.
	if result.Completion.Values == nil {
		result.Completion.Values = []string{}
	}
	return result, nil
}

//
// Task Management Methods
//

// createTask creates a new task entry and returns it.
// Returns an error if the max concurrent tasks limit is exceeded.
func (s *MCPServer) createTask(ctx context.Context, taskID string, toolName string, ttl *int64, pollInterval *int64) (*taskEntry, error) {
	// Build task entry first (no lock needed)
	opts := []mcp.TaskOption{}
	if ttl != nil {
		opts = append(opts, mcp.WithTaskTTL(*ttl))
	}
	if pollInterval != nil {
		opts = append(opts, mcp.WithTaskPollInterval(*pollInterval))
	}
	task := mcp.NewTask(taskID, opts...)
	createdAt := time.Now()

	entry := &taskEntry{
		task:      task,
		sessionID: getSessionID(ctx),
		toolName:  toolName,
		createdAt: createdAt,
		done:      make(chan struct{}),
	}

	// Single critical section for check + increment + insert
	s.tasksMu.Lock()

	// Check concurrent task limit
	if s.maxConcurrentTasks != nil && *s.maxConcurrentTasks > 0 {
		if s.activeTasks >= *s.maxConcurrentTasks {
			s.tasksMu.Unlock()
			return nil, fmt.Errorf("max concurrent tasks limit reached (%d)", *s.maxConcurrentTasks)
		}
	}

	// Increment active task counter and insert task atomically
	s.activeTasks++
	s.tasks[taskID] = entry
	// With no hooks there is nothing to wait for.
	entry.createdHookDone = s.taskHooks == nil
	s.tasksMu.Unlock()

	// Fire task created hook, outside the lock: a hook may take time, or
	// read task state through the server.
	if s.taskHooks != nil {
		metrics := TaskMetrics{
			TaskID:    taskID,
			ToolName:  toolName,
			Status:    task.Status,
			CreatedAt: createdAt,
			SessionID: getSessionID(ctx),
		}
		func() {
			// However the hook ends: one that panics must not leave the
			// task's later hooks waiting.
			defer s.finishCreatedHook(entry)
			s.taskHooks.taskCreated(ctx, metrics)
		}()
	}

	// Start TTL cleanup if specified
	if ttl != nil && *ttl > 0 {
		go s.scheduleTaskCleanup(taskID, entry, *ttl)
	}

	return entry, nil
}

// finishCreatedHook records that entry's created hook has returned and runs
// the hooks that waited for it, in the order they arrived.
func (s *MCPServer) finishCreatedHook(entry *taskEntry) {
	s.tasksMu.Lock()
	entry.createdHookDone = true
	pending := entry.pendingHooks
	entry.pendingHooks = nil
	s.tasksMu.Unlock()
	for _, fire := range pending {
		fire()
	}
}

// fireTaskHook runs fire, a hook of entry, with ctx now, or after the
// created hook when that is still running. A hook that waits runs once
// the request that raised it may have ended, so it gets ctx's values
// without its cancellation. Never under tasksMu.
func (s *MCPServer) fireTaskHook(ctx context.Context, entry *taskEntry, fire func(context.Context)) {
	s.tasksMu.Lock()
	if !entry.createdHookDone {
		later := context.WithoutCancel(ctx)
		entry.pendingHooks = append(entry.pendingHooks, func() { fire(later) })
		s.tasksMu.Unlock()
		return
	}
	s.tasksMu.Unlock()
	fire(ctx)
}

// getTask retrieves a task by ID, checking session isolation if applicable.
// Returns a copy of the task and the done channel for waiting on completion.
func (s *MCPServer) getTask(ctx context.Context, taskID string) (mcp.Task, chan struct{}, error) {
	s.tasksMu.RLock()
	entry, exists := s.tasks[taskID]
	if !exists {
		// Check if this task was recently expired
		if _, wasExpired := s.expiredTasks[taskID]; wasExpired {
			s.tasksMu.RUnlock()
			return mcp.Task{}, nil, fmt.Errorf("task has expired")
		}
		s.tasksMu.RUnlock()
		return mcp.Task{}, nil, fmt.Errorf("task not found")
	}

	// Verify session isolation
	sessionID := getSessionID(ctx)
	if entry.sessionID != "" && sessionID != "" && entry.sessionID != sessionID {
		s.tasksMu.RUnlock()
		return mcp.Task{}, nil, fmt.Errorf("task not found")
	}

	// Return a copy of the task and the done channel
	taskCopy := entry.task
	done := entry.done
	s.tasksMu.RUnlock()

	return taskCopy, done, nil
}

// getTaskEntry retrieves the raw task entry for internal use (requires caller to handle synchronization).
func (s *MCPServer) getTaskEntry(ctx context.Context, taskID string) (*taskEntry, error) {
	s.tasksMu.RLock()
	entry, exists := s.tasks[taskID]
	if !exists {
		// Check if this task was recently expired
		if _, wasExpired := s.expiredTasks[taskID]; wasExpired {
			s.tasksMu.RUnlock()
			return nil, fmt.Errorf("task has expired")
		}
		s.tasksMu.RUnlock()
		return nil, fmt.Errorf("task not found")
	}
	s.tasksMu.RUnlock()

	// Verify session isolation
	sessionID := getSessionID(ctx)
	if entry.sessionID != "" && sessionID != "" && entry.sessionID != sessionID {
		return nil, fmt.Errorf("task not found")
	}

	return entry, nil
}

// listTasks returns copies of all tasks for the current session.
func (s *MCPServer) listTasks(ctx context.Context) []mcp.Task {
	sessionID := getSessionID(ctx)

	s.tasksMu.RLock()
	defer s.tasksMu.RUnlock()

	var tasks []mcp.Task
	for _, entry := range s.tasks {
		// Filter by session if applicable
		if sessionID == "" || entry.sessionID == "" || entry.sessionID == sessionID {
			tasks = append(tasks, entry.task)
		}
	}

	return tasks
}

// completeTask marks a task as completed with the given result.
func (s *MCPServer) completeTask(entry *taskEntry, result any, err error) {
	s.tasksMu.Lock()

	// Guard against double completion
	if entry.completed {
		s.tasksMu.Unlock()
		return
	}

	completedAt := time.Now()
	duration := completedAt.Sub(entry.createdAt)

	if err != nil {
		entry.task.Status = mcp.TaskStatusFailed
		entry.task.StatusMessage = err.Error()
		entry.resultErr = err
	} else {
		entry.task.Status = mcp.TaskStatusCompleted
		entry.result = result
	}

	// Update the lastUpdatedAt timestamp
	entry.task.LastUpdatedAt = completedAt.UTC().Format(time.RFC3339)

	// Mark as completed and signal
	entry.completed = true
	close(entry.done)

	// Decrement active tasks counter
	s.activeTasks--
	task := entry.task
	metrics := TaskMetrics{
		TaskID:        task.TaskId,
		ToolName:      entry.toolName,
		Status:        task.Status,
		StatusMessage: task.StatusMessage,
		CreatedAt:     entry.createdAt,
		CompletedAt:   &completedAt,
		Duration:      duration,
		SessionID:     entry.sessionID,
		Error:         err,
	}
	s.tasksMu.Unlock()

	// Send task status notification
	s.sendTaskStatusNotification(task)

	// Fire task hooks, after the created hook if it is still running
	if s.taskHooks != nil {
		s.fireTaskHook(context.Background(), entry, func(ctx context.Context) {
			if err != nil {
				s.taskHooks.taskFailed(ctx, metrics)
			} else {
				s.taskHooks.taskCompleted(ctx, metrics)
			}
		})
	}
}

// cancelTask cancels a running task.
func (s *MCPServer) cancelTask(ctx context.Context, taskID string) error {
	entry, err := s.getTaskEntry(ctx, taskID)
	if err != nil {
		return err
	}
	return s.cancelTaskEntry(ctx, entry, "Task cancelled by request")
}

// cancelTaskEntry records a cancellation and invokes observers after unlocking.
func (s *MCPServer) cancelTaskEntry(ctx context.Context, entry *taskEntry, message string) error {
	s.tasksMu.Lock()
	if entry.completed {
		status := entry.task.Status
		s.tasksMu.Unlock()
		return fmt.Errorf("cannot cancel task in terminal status: %s", status)
	}
	cancel := entry.cancelFunc
	cancelledAt := time.Now()
	entry.task.Status = mcp.TaskStatusCancelled
	entry.task.StatusMessage = message
	entry.task.LastUpdatedAt = cancelledAt.UTC().Format(time.RFC3339)
	entry.resultErr = context.Canceled
	entry.completed = true
	close(entry.done)
	s.activeTasks--
	task := entry.task
	metrics := TaskMetrics{
		TaskID:        task.TaskId,
		ToolName:      entry.toolName,
		Status:        task.Status,
		StatusMessage: task.StatusMessage,
		CreatedAt:     entry.createdAt,
		CompletedAt:   &cancelledAt,
		Duration:      cancelledAt.Sub(entry.createdAt),
		SessionID:     entry.sessionID,
	}
	s.tasksMu.Unlock()
	if cancel != nil {
		cancel()
	}
	s.sendTaskStatusNotification(task)
	if s.taskHooks != nil {
		// After the created hook, if it is still running.
		s.fireTaskHook(ctx, entry, func(ctx context.Context) { s.taskHooks.taskCancelled(ctx, metrics) })
	}
	return nil
}

// scheduleTaskCleanup cancels unfinished task execution and removes the task from
// storage after its TTL expires so clients have the full TTL window to retrieve results.
// It only performs cleanup if the stored task entry matches expected.
func (s *MCPServer) scheduleTaskCleanup(taskID string, expected *taskEntry, ttlMs int64) {
	time.Sleep(time.Duration(ttlMs) * time.Millisecond)

	var cancel context.CancelFunc
	s.tasksMu.Lock()
	entry, ok := s.tasks[taskID]
	if !ok || entry != expected {
		s.tasksMu.Unlock()
		return
	}
	if !entry.completed {
		cancel = entry.cancelFunc
	}
	delete(s.tasks, taskID)
	s.expiredTasks[taskID] = time.Now()
	s.tasksMu.Unlock()

	if cancel != nil {
		cancel()
	}

	// Remove tombstone after 5 minutes.
	time.AfterFunc(5*time.Minute, func() {
		s.tasksMu.Lock()
		delete(s.expiredTasks, taskID)
		s.tasksMu.Unlock()
	})
}

// sendTaskStatusNotification sends a notification when a task's status changes.
func (s *MCPServer) sendTaskStatusNotification(task mcp.Task) {
	// Convert task to map[string]any for notification params
	taskMap := map[string]any{
		"taskId":        task.TaskId,
		"status":        task.Status,
		"createdAt":     task.CreatedAt,
		"lastUpdatedAt": task.LastUpdatedAt,
	}

	if task.StatusMessage != "" {
		taskMap["statusMessage"] = task.StatusMessage
	}
	if task.TTL != nil {
		taskMap["ttl"] = *task.TTL
	}
	if task.PollInterval != nil {
		taskMap["pollInterval"] = *task.PollInterval
	}

	s.SendNotificationToAllClients(mcp.MethodNotificationTasksStatus, taskMap)
}

// getSessionID extracts the session ID from the context.
func getSessionID(ctx context.Context) string {
	if session := ClientSessionFromContext(ctx); session != nil {
		return session.SessionID()
	}
	return ""
}
