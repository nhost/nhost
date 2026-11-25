package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"reflect"

	"github.com/mark3labs/mcp-go/mcp"
)

// defaultCacheTTLMs is the cache freshness hint applied to list and read
// results when the server does not configure one. Zero means "always
// revalidate", which preserves the polling behaviour of earlier protocol
// versions while still satisfying the SEP-2549 requirement that the field be
// present.
const defaultCacheTTLMs int64 = 0

// defaultCacheScope is the scope advertised when a server configures no
// caching hints. It is fail-closed: results may be reused only within the
// authorization context that fetched them, so a shared intermediary cannot
// serve one principal's data to another. Servers that want sharing declare it
// with [WithCacheHints].
const defaultCacheScope = mcp.CacheScopePrivate

// cacheHints describes the SEP-2549 caching hints a server advertises on a
// list or read result.
type cacheHints struct {
	ttlMs int64
	scope mcp.CacheScope
}

// decorateResponse applies the result metadata required by protocol version
// 2026-07-28 to an outgoing response.
//
// For modern requests it stamps resultType, the server identity in _meta, and
// the SEP-2549 caching hints. For legacy requests it is a no-op, so responses
// remain byte-identical to earlier releases.
func (s *MCPServer) decorateResponse(
	_ context.Context,
	info *RequestProtocolInfo,
	method mcp.MCPMethod,
	resp mcp.JSONRPCMessage,
) mcp.JSONRPCMessage {
	if info == nil || !info.Modern || resp == nil {
		return resp
	}

	response, ok := resp.(mcp.JSONRPCResponse)
	if !ok || response.Result == nil {
		return resp
	}

	decorated, ok := s.decorateResult(response.Result, method)
	if !ok {
		return resp
	}
	response.Result = decorated
	return response
}

// decorateResult stamps the modern result metadata onto a result value.
//
// The generated dispatcher stores results by value, so the value is copied
// into an addressable location before the pointer-receiver decoration
// interfaces are applied.
func (s *MCPServer) decorateResult(result any, method mcp.MCPMethod) (any, bool) {
	value := reflect.ValueOf(result)
	if !value.IsValid() {
		return nil, false
	}

	// Work on an addressable copy so that pointer-receiver methods promoted
	// from the embedded mcp.Result are reachable.
	byValue := value.Kind() != reflect.Pointer
	pointer := value
	if byValue {
		pointer = reflect.New(value.Type())
		pointer.Elem().Set(value)
	} else if value.IsNil() {
		return nil, false
	}

	metadata, ok := reflect.TypeAssert[mcp.ResultMetadata](pointer)
	if !ok {
		return nil, false
	}

	// resultType is required from 2026-07-28 onward. A handler that already
	// set it - to signal input_required, for example - keeps its value.
	if metadata.GetResultType() == "" {
		metadata.SetResultType(mcp.ResultTypeComplete)
	}

	// Servers SHOULD identify themselves in every result.
	if meta := metadata.EnsureResultMeta(); meta != nil && meta.ServerInfo() == nil {
		meta.SetServerInfo(s.serverImplementation())
	}

	// ttlMs and cacheScope are required on list and read results.
	if methodReturnsCacheableResult(method) {
		if cacheable, ok := reflect.TypeAssert[mcp.CacheHintSetter](pointer); ok {
			applyDefaultCacheHints(cacheable, s.cacheHintsFor(method))
		}
	}

	if byValue {
		return pointer.Elem().Interface(), true
	}
	return result, true
}

// cacheHintsFor returns the caching hints configured for the given method,
// falling back to the server-wide default.
func (s *MCPServer) cacheHintsFor(method mcp.MCPMethod) cacheHints {
	s.capabilitiesMu.RLock()
	defer s.capabilitiesMu.RUnlock()

	if s.cacheHints != nil {
		if configured, ok := s.cacheHints[method]; ok {
			return configured
		}
		if configured, ok := s.cacheHints[""]; ok {
			return configured
		}
	}
	return cacheHints{ttlMs: defaultCacheTTLMs, scope: defaultCacheScope}
}

// applyDefaultCacheHints populates caching hints on a result that has not
// already set them.
func applyDefaultCacheHints(result mcp.CacheHintSetter, hints cacheHints) {
	if cacheable, ok := result.(interface{ TTL() (int64, bool) }); ok {
		if _, alreadySet := cacheable.TTL(); alreadySet {
			return
		}
	}
	result.SetCacheHints(hints.ttlMs, hints.scope)
}

// methodReturnsCacheableResult reports whether protocol version 2026-07-28
// requires ttlMs and cacheScope on the result of the given method.
func methodReturnsCacheableResult(method mcp.MCPMethod) bool {
	switch method {
	case mcp.MethodToolsList,
		mcp.MethodPromptsList,
		mcp.MethodResourcesList,
		mcp.MethodResourcesTemplatesList,
		mcp.MethodResourcesRead,
		mcp.MethodServerDiscover:
		return true
	default:
		return false
	}
}

// errorResponseForProtocolError converts a protocol-level validation failure
// into the JSON-RPC error the specification prescribes.
func errorResponseForProtocolError(id any, err error) mcp.JSONRPCMessage {
	var unsupported mcp.UnsupportedProtocolVersionError
	if errors.As(err, &unsupported) {
		response := unsupported.JSONRPCError()
		response.ID = mcp.NewRequestId(id)
		return response
	}

	var mismatch mcp.HeaderMismatchError
	if errors.As(err, &mismatch) {
		return createErrorResponse(id, mcp.HEADER_MISMATCH, mismatch.Error())
	}

	var missing mcp.MissingRequiredClientCapabilityError
	if errors.As(err, &missing) {
		return createErrorResponse(id, mcp.MISSING_REQUIRED_CLIENT_CAPABILITY, missing.Error())
	}

	return createErrorResponse(id, mcp.INVALID_PARAMS, err.Error())
}

// validateStandardHeadersForMessage checks the Mcp-Method, Mcp-Name, and
// Mcp-Param-* headers against the JSON-RPC message body, as required from
// protocol version 2026-07-28 (SEP-2243).
//
// Requests that did not arrive over HTTP carry no headers, so validation is
// skipped: the header contract binds the Streamable HTTP transport only.
//
// message must be a JSON object that HandleMessage has already decoded. A
// large arguments object is scanned for the name only, and is copied only
// when the tool binds parameters to headers.
func (s *MCPServer) validateStandardHeadersForMessage(
	ctx context.Context,
	headers http.Header,
	protocolVersion string,
	method mcp.MCPMethod,
	message json.RawMessage,
) error {
	if len(headers) == 0 || headers.Get(mcp.HeaderProtocolVersion) == "" {
		return nil
	}

	needsName := mcp.RequiresStandardHeaders(protocolVersion) && mcp.MethodRequiresNameHeader(method)
	if !needsName && method != mcp.MethodToolsCall {
		return mcp.ValidateStandardHeaders(headers.Get, protocolVersion, method, nil)
	}
	if method == mcp.MethodToolsCall && needsName {
		if bindings := s.headerNamedToolBindings(ctx, headers); len(bindings) > 0 {
			return s.validateBoundToolHeaders(headers, protocolVersion, message, bindings)
		}
	}

	var probe struct {
		Params *headerFields `json:"params"`
	}
	if err := json.Unmarshal(message, &probe); err != nil || probe.Params == nil {
		return s.validateStandardHeadersWithParams(ctx, headers, protocolVersion, method, message)
	}

	field := probe.Params.Name
	if method == mcp.MethodResourcesRead {
		field = probe.Params.URI
	}
	if err := mcp.ValidateStandardHeadersFunc(headers.Get, protocolVersion, method, func() (string, bool) {
		return headerFieldString(field)
	}); err != nil {
		return err
	}

	// Tool parameters annotated with x-mcp-header travel in headers as well as
	// in the body, and the two must agree.
	if method != mcp.MethodToolsCall {
		return nil
	}
	name, ok := headerFieldString(probe.Params.Name)
	if !ok || name == "" {
		return nil
	}
	bindings, ok := s.headerBindingsForCall(ctx, name)
	if !ok || len(bindings) == 0 {
		return nil
	}

	var wrapper struct {
		Params json.RawMessage `json:"params"`
	}
	if err := json.Unmarshal(message, &wrapper); err != nil {
		return nil
	}
	return mcp.ValidateParamHeadersWithBindings(lookupHeader(headers), bindings, wrapper.Params)
}

// validateStandardHeadersWithParams validates a request whose params is
// missing, null, or not an object, reading params whole as
// mcp.ValidateStandardHeaders expects.
func (s *MCPServer) validateStandardHeadersWithParams(
	ctx context.Context,
	headers http.Header,
	protocolVersion string,
	method mcp.MCPMethod,
	message json.RawMessage,
) error {
	var wrapper struct {
		Params json.RawMessage `json:"params"`
	}
	if err := json.Unmarshal(message, &wrapper); err != nil {
		return nil
	}
	if err := mcp.ValidateStandardHeaders(headers.Get, protocolVersion, method, wrapper.Params); err != nil {
		return err
	}
	if method != mcp.MethodToolsCall {
		return nil
	}
	var call struct {
		Name string `json:"name"`
	}
	if err := json.Unmarshal(wrapper.Params, &call); err != nil || call.Name == "" {
		return nil
	}
	bindings, ok := s.headerBindingsForCall(ctx, call.Name)
	if !ok {
		return nil
	}
	return mcp.ValidateParamHeadersWithBindings(lookupHeader(headers), bindings, wrapper.Params)
}

// headerNamedToolBindings returns the header bindings of the tool named in
// the Mcp-Name header, or nil when it names none or the tool binds nothing.
func (s *MCPServer) headerNamedToolBindings(ctx context.Context, headers http.Header) []mcp.ParamHeaderBinding {
	name, ok := mcp.DecodeHeaderValue(headers.Get(mcp.HeaderName))
	if !ok || name == "" {
		return nil
	}
	bindings, _ := s.headerBindingsForCall(ctx, name)
	return bindings
}

// validateBoundToolHeaders validates a tools/call for a tool that binds
// parameters to headers, reading params whole in a single pass. The bindings
// come from the Mcp-Name header, which ValidateStandardHeaders requires to
// match the body name before they are used.
func (s *MCPServer) validateBoundToolHeaders(
	headers http.Header,
	protocolVersion string,
	message json.RawMessage,
	bindings []mcp.ParamHeaderBinding,
) error {
	var wrapper struct {
		Params json.RawMessage `json:"params"`
	}
	if err := json.Unmarshal(message, &wrapper); err != nil {
		return nil
	}
	if err := mcp.ValidateStandardHeaders(headers.Get, protocolVersion, mcp.MethodToolsCall, wrapper.Params); err != nil {
		return err
	}
	return mcp.ValidateParamHeadersWithBindings(lookupHeader(headers), bindings, wrapper.Params)
}

// headerFields holds the members of params that header validation reads.
type headerFields struct {
	Name json.RawMessage `json:"name"`
	URI  json.RawMessage `json:"uri"`
}

// headerFieldString decodes a name or uri member the way
// mcp.ExtractHeaderName does: absent is "", a string is its value, and any
// other JSON value cannot be read.
func headerFieldString(raw json.RawMessage) (string, bool) {
	if len(raw) == 0 {
		return "", true
	}
	var value string
	if err := json.Unmarshal(raw, &value); err != nil {
		return "", false
	}
	return value, true
}

// lookupHeader reports the first value of a header and whether it was sent at
// all, so that a header sent with an empty value is not taken for a missing
// one.
func lookupHeader(headers http.Header) func(string) (string, bool) {
	return func(name string) (string, bool) {
		values := headers.Values(name)
		if len(values) == 0 {
			return "", false
		}
		return values[0], true
	}
}

// headerBindingsForCall resolves the x-mcp-header bindings of the named tool
// of a tools/call request. A tool registered on the server has them cached
// from registration; a session tool is read on the call, since session tool
// maps can be replaced wholesale through SetSessionTools. It returns ok=false
// when the tool is unknown, leaving the not-found error to the handler.
func (s *MCPServer) headerBindingsForCall(ctx context.Context, name string) ([]mcp.ParamHeaderBinding, bool) {
	if session := ClientSessionFromContext(ctx); session != nil {
		if withTools, ok := session.(SessionWithTools); ok {
			if sessionTools := withTools.GetSessionTools(); sessionTools != nil {
				if tool, ok := sessionTools[name]; ok {
					return mcp.ExtractParamHeaderBindings(&tool.Tool), true
				}
			}
		}
	}

	s.toolsMu.RLock()
	defer s.toolsMu.RUnlock()
	if tool, ok := s.tools[name]; ok {
		return s.cachedHeaderBindings(name, &tool.Tool), true
	}
	if taskTool, ok := s.taskTools[name]; ok {
		return s.cachedHeaderBindings(name, &taskTool.Tool), true
	}
	return nil, false
}

// cachedHeaderBindings returns the bindings registration extracted for name.
// It reads the schema only when the map has no entry for the tool, so a
// registration path that forgets the cache degrades to the per-call read
// rather than switching the check off. Called with toolsMu held.
func (s *MCPServer) cachedHeaderBindings(name string, tool *mcp.Tool) []mcp.ParamHeaderBinding {
	if bindings, ok := s.toolHeaderBindings[name]; ok {
		return bindings
	}
	return mcp.ExtractParamHeaderBindings(tool)
}
