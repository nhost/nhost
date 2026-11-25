package client

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"slices"
	"time"

	"github.com/mark3labs/mcp-go/client/transport"
	"github.com/mark3labs/mcp-go/mcp"
)

// defaultDiscoverProbeTimeout bounds the server/discover probe sent during
// Initialize. Servers predating protocol version 2026-07-28 answer an unknown
// method with MethodNotFound, but some ignore it entirely, which on stdio
// would otherwise block the handshake indefinitely.
const defaultDiscoverProbeTimeout = 5 * time.Second

// Protocol version 2026-07-28 removed the initialize handshake: a client
// declares its protocol version, identity, and capabilities in the _meta of
// every request, and may learn a server's capabilities up front through the
// server/discover RPC (SEP-2575).
//
// This client speaks both eras. Connect probes with server/discover; if that
// fails with anything other than a recognized modern error, it falls back to
// initialize and stays on the legacy revision for the rest of the connection.

// isModern reports whether the client is speaking the stateless protocol core.
func (c *Client) isModern() bool {
	return mcp.IsModernProtocol(c.protocolVersion)
}

// legacyRequiringTransport is implemented by transports that have been
// configured in a way only protocol versions before 2026-07-28 can satisfy,
// such as a Streamable HTTP transport using continuous listening.
type legacyRequiringTransport interface {
	RequiresLegacyProtocol() bool
}

// transportRequiresLegacyProtocol reports whether the transport rules out the
// stateless protocol core.
func (c *Client) transportRequiresLegacyProtocol() bool {
	legacy, ok := c.transport.(legacyRequiringTransport)
	return ok && legacy.RequiresLegacyProtocol()
}

// ProtocolVersion returns the protocol version in effect for this client, or
// "" before the connection has been established.
func (c *Client) ProtocolVersion() string {
	return c.protocolVersion
}

// effectiveCapabilities returns the client capabilities to declare, merging
// the configured set with the capabilities implied by the registered handlers.
func (c *Client) effectiveCapabilities() mcp.ClientCapabilities {
	capabilities := c.clientCapabilities
	if c.samplingHandler != nil && capabilities.Sampling == nil {
		capabilities.Sampling = &mcp.SamplingCapability{}
	}
	if c.rootsHandler != nil && capabilities.Roots == nil {
		capabilities.Roots = &struct {
			ListChanged bool `json:"listChanged,omitempty"`
		}{ListChanged: true}
	}
	if c.elicitationHandler != nil && capabilities.Elicitation == nil {
		capabilities.Elicitation = &mcp.ElicitationCapability{}
	}
	return capabilities
}

// requestCapabilitiesKey carries per-request client capabilities on a context.
type requestCapabilitiesKey struct{}

// WithRequestClientCapabilities returns a context whose requests declare
// capabilities in _meta in place of the client's own, for a client acting on
// behalf of a caller that can answer less, or more, than the client's
// handlers. It applies to protocol version 2026-07-28 and later; earlier
// versions declare capabilities once, at initialize.
func WithRequestClientCapabilities(ctx context.Context, capabilities mcp.ClientCapabilities) context.Context {
	return context.WithValue(ctx, requestCapabilitiesKey{}, capabilities)
}

// applyRequestMeta merges the per-request protocol metadata that protocol
// version 2026-07-28 requires into a request's params.
//
// It is a no-op for legacy connections, whose protocol version, identity, and
// capabilities were fixed by the initialize handshake. Capabilities set with
// [WithRequestClientCapabilities] on ctx replace the client's own.
func (c *Client) applyRequestMeta(ctx context.Context, params any) any {
	if !c.isModern() {
		return params
	}

	fields := map[string]json.RawMessage{}
	if params != nil {
		encoded, err := json.Marshal(params)
		if err != nil {
			return params
		}
		if err := json.Unmarshal(encoded, &fields); err != nil {
			// Params that are not a JSON object cannot carry _meta.
			return params
		}
	}

	meta := map[string]any{}
	if raw, ok := fields["_meta"]; ok {
		_ = json.Unmarshal(raw, &meta)
	}
	meta[mcp.MetaKeyProtocolVersion] = c.protocolVersion
	capabilities := c.effectiveCapabilities()
	if override, ok := ctx.Value(requestCapabilitiesKey{}).(mcp.ClientCapabilities); ok {
		capabilities = override
	}
	meta[mcp.MetaKeyClientCapabilities] = capabilities
	if c.clientInfo.Name != "" {
		meta[mcp.MetaKeyClientInfo] = c.clientInfo
	}
	if level := c.currentLogLevel(); level != "" {
		meta[mcp.MetaKeyLogLevel] = level
	}

	encodedMeta, err := json.Marshal(meta)
	if err != nil {
		return params
	}
	fields["_meta"] = encodedMeta
	return fields
}

// currentLogLevel returns the per-request log level to declare, if any.
func (c *Client) currentLogLevel() mcp.LoggingLevel {
	c.logLevelMu.RLock()
	defer c.logLevelMu.RUnlock()
	return c.logLevel
}

// applyStandardHeaders adds the Mcp-Method and Mcp-Name headers that protocol
// version 2026-07-28 requires on Streamable HTTP requests (SEP-2243).
//
// Transports other than Streamable HTTP ignore them, so they are set
// unconditionally for modern connections.
func (c *Client) applyStandardHeaders(header http.Header, method string, params any) http.Header {
	if !c.isModern() {
		return header
	}

	encoded, err := json.Marshal(params)
	if err != nil {
		return header
	}

	standard := mcp.StandardHeaders(c.protocolVersion, mcp.MCPMethod(method), encoded)
	if len(standard) == 0 {
		return header
	}

	if header == nil {
		header = make(http.Header, len(standard))
	} else {
		header = header.Clone()
	}
	for name, value := range standard {
		header.Set(name, value)
	}

	// Tool parameters annotated with x-mcp-header must be mirrored into
	// Mcp-Param-* headers so gateways can route on them.
	if mcp.MCPMethod(method) == mcp.MethodToolsCall {
		if tool := c.toolForCall(encoded); tool != nil {
			for name, value := range mcp.GenerateParamHeaders(tool, encoded) {
				header.Set(name, value)
			}
		}
	}

	return header
}

// toolForCall returns the cached tool definition named by a tools/call
// request, or nil when the client has not listed tools yet.
func (c *Client) toolForCall(params json.RawMessage) *mcp.Tool {
	var call struct {
		Name string `json:"name"`
	}
	if err := json.Unmarshal(params, &call); err != nil || call.Name == "" {
		return nil
	}
	c.toolsMu.RLock()
	defer c.toolsMu.RUnlock()
	tool, ok := c.knownTools[call.Name]
	if !ok {
		return nil
	}
	return &tool
}

// InvalidToolHandler is called for each tool definition that ListTools,
// ListToolsByPage and IterTools exclude because its x-mcp-header annotations
// violate SEP-2243. err is the error returned by
// mcp.ValidateParamHeaderAnnotations.
//
// The handler runs synchronously on the goroutine that listed the tools, once
// per excluded tool and page, with that request's context, so a caller can
// correlate the call with its own span or request. It must not block.
type InvalidToolHandler func(ctx context.Context, tool mcp.Tool, err error)

// WithInvalidToolHandler sets the handler notified about tools excluded for
// their invalid x-mcp-header annotations.
//
// Exclusion itself is unchanged: the tool is still dropped from the listing and
// forgotten from the cache, and the warning is still logged. Without this
// option, that warning is the only signal that a tool disappeared.
func WithInvalidToolHandler(handler InvalidToolHandler) ClientOption {
	return func(c *Client) {
		c.invalidToolHandler = handler
	}
}

// withoutInvalidHeaderTools drops the tool definitions whose x-mcp-header
// annotations break the constraints of SEP-2243. A client using Streamable
// HTTP MUST exclude such a tool from the tools/list result, so that one bad
// definition does not stop the others from being used. A definition cached
// from an earlier listing is forgotten too, so the tool is not called with
// headers mirrored from it. Other transports may ignore the annotations, and
// connections before protocol version 2026-07-28 do not mirror them at all.
func (c *Client) withoutInvalidHeaderTools(ctx context.Context, tools []mcp.Tool) []mcp.Tool {
	if !c.isModern() {
		return tools
	}
	if _, ok := c.transport.(transport.HTTPConnection); !ok {
		return tools
	}
	valid := make([]mcp.Tool, 0, len(tools))
	for _, tool := range tools {
		if err := mcp.ValidateParamHeaderAnnotations(&tool); err != nil {
			slog.WarnContext(ctx, "mcp: excluding a tool with invalid x-mcp-header annotations", "tool", tool.Name, "err", err)
			if c.invalidToolHandler != nil {
				c.invalidToolHandler(ctx, tool, err)
			}
			c.forgetTool(tool.Name)
			continue
		}
		valid = append(valid, tool)
	}
	return valid
}

// forgetTool drops a cached tool definition.
func (c *Client) forgetTool(name string) {
	c.toolsMu.Lock()
	defer c.toolsMu.Unlock()
	delete(c.knownTools, name)
}

// rememberTools caches tool definitions so that subsequent tools/call requests
// can mirror x-mcp-header annotated parameters into HTTP headers.
func (c *Client) rememberTools(tools []mcp.Tool) {
	if len(tools) == 0 {
		return
	}
	c.toolsMu.Lock()
	defer c.toolsMu.Unlock()
	if c.knownTools == nil {
		c.knownTools = make(map[string]mcp.Tool, len(tools))
	}
	for _, tool := range tools {
		c.knownTools[tool.Name] = tool
	}
}

// Discover asks the server which protocol versions it supports, what its
// capabilities are, and who it is, without performing the legacy initialize
// handshake (SEP-2575).
//
// Servers implementing protocol version 2026-07-28 or later must support this
// method. Against an older server it fails, which is how [Client.Initialize]
// detects that it must fall back to the handshake.
func (c *Client) Discover(ctx context.Context, request mcp.DiscoverRequest) (*mcp.DiscoverResult, error) {
	response, err := c.sendRequest(
		ctx,
		string(mcp.MethodServerDiscover),
		c.applyRequestMeta(ctx, request.Params),
		outboundHeader(request.Header, request.Method),
	)
	if err != nil {
		return nil, err
	}

	if err := validateDiscoverResult(*response); err != nil {
		return nil, fmt.Errorf("invalid server/discover result: %w", err)
	}

	var result mcp.DiscoverResult
	if err := json.Unmarshal(*response, &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal discover result: %w", err)
	}
	return &result, nil
}

// validateDiscoverResult checks the fields that distinguish discovery from a
// legacy server's unrelated successful result. It is not a full schema check:
// absent resultType and cache hints retain their existing decoding behavior.
func validateDiscoverResult(data json.RawMessage) error {
	var shape struct {
		SupportedVersions []*string                  `json:"supportedVersions"`
		Capabilities      map[string]json.RawMessage `json:"capabilities"`
		Meta              json.RawMessage            `json:"_meta"`
	}
	if err := json.Unmarshal(data, &shape); err != nil {
		return err
	}
	if shape.SupportedVersions == nil {
		return errors.New("supportedVersions must be a non-null array of strings")
	}
	for _, version := range shape.SupportedVersions {
		if version == nil {
			return errors.New("supportedVersions must contain only strings")
		}
	}
	if shape.Capabilities == nil {
		return errors.New("capabilities must be an object")
	}
	if len(shape.Meta) == 0 {
		return nil
	}
	var meta map[string]json.RawMessage
	if err := json.Unmarshal(shape.Meta, &meta); err != nil {
		return err
	}
	if meta == nil {
		return errors.New("_meta must be an object")
	}
	if raw, ok := meta[mcp.MetaKeyServerInfo]; ok {
		var info struct {
			Name    *string `json:"name"`
			Version *string `json:"version"`
		}
		if err := json.Unmarshal(raw, &info); err != nil {
			return err
		}
		if info.Name == nil || info.Version == nil {
			return errors.New("_meta serverInfo must be an object with string name and version")
		}
	}
	return nil
}

// negotiateModern attempts to establish a modern, stateless connection.
//
// It sends server/discover at the client's preferred version. If the server
// rejects that version but names the ones it does support, the request is
// retried once at the highest mutually supported modern version, even when it
// matches the rejected version. It also reports whether a modern server was identified,
// so that a later failure cannot trigger the legacy initialize handshake.
//
// The probe is bounded by a timeout: a well-behaved JSON-RPC server answers an
// unknown method with MethodNotFound, but a server predating this method may
// simply ignore it, which on stdio would otherwise block forever.
func (c *Client) negotiateModern(ctx context.Context, preferred string) (*mcp.DiscoverResult, bool, error) {
	if preferred == "" {
		preferred = mcp.LATEST_PROTOCOL_VERSION
	}

	probeCtx := ctx
	if timeout := c.discoverProbeTimeout(); timeout > 0 {
		var cancel context.CancelFunc
		probeCtx, cancel = context.WithTimeout(ctx, timeout)
		defer cancel()
	}

	// The version travels in each request's _meta and, over HTTP, in the
	// Mcp-Protocol-Version header, which must agree. Both must therefore be in
	// place before the probe is sent; they are restored on failure.
	previous := c.protocolVersion
	c.applyNegotiatedVersion(preferred)

	var err error
	modern := false
	for attempt := range 2 {
		var result *mcp.DiscoverResult
		result, err = c.Discover(probeCtx, mcp.DiscoverRequest{})
		if err == nil {
			version := discoveredVersion(c.protocolVersion, result.SupportedVersions)
			if version == "" {
				c.applyNegotiatedVersion(previous)
				return nil, true, fmt.Errorf("server/discover result lists no modern version this client supports: %v", result.SupportedVersions)
			}
			c.applyNegotiatedVersion(version)
			return result, true, nil
		}

		// A recognized modern error identifies a modern server: renegotiate
		// rather than falling back. The retry remains bounded even when the
		// advertised version matches the version just rejected.
		var unsupported mcp.UnsupportedProtocolVersionError
		if !errors.As(err, &unsupported) || unsupported.Supported == nil {
			break
		}
		modern = true
		if attempt > 0 {
			break
		}
		negotiated := mcp.NegotiateMutuallySupportedVersion(unsupported.Supported)
		if !mcp.IsModernProtocol(negotiated) {
			break
		}
		c.applyNegotiatedVersion(negotiated)
	}

	c.applyNegotiatedVersion(previous)
	return nil, modern, err
}

// discoveredVersion picks the version to continue with after server/discover
// lists supported: the one the probe was sent with, when listed, or else the
// newest modern version both sides support. It returns "" when there is none.
func discoveredVersion(sent string, supported []string) string {
	if slices.Contains(supported, sent) {
		return sent
	}
	if negotiated := mcp.NegotiateMutuallySupportedVersion(supported); mcp.IsModernProtocol(negotiated) {
		return negotiated
	}
	return ""
}

// discoverProbeTimeout returns how long to wait for a server/discover reply
// before concluding the server is legacy.
func (c *Client) discoverProbeTimeout() time.Duration {
	if c.discoverTimeout != 0 {
		return c.discoverTimeout
	}
	return defaultDiscoverProbeTimeout
}

// initializeResultFromDiscover renders a DiscoverResult in the shape of an
// InitializeResult, so that callers of [Client.Initialize] observe the same
// value regardless of which era the connection settled on.
func initializeResultFromDiscover(protocolVersion string, result *mcp.DiscoverResult) *mcp.InitializeResult {
	initialized := &mcp.InitializeResult{
		ProtocolVersion: protocolVersion,
		Capabilities:    result.Capabilities,
		Instructions:    result.Instructions,
	}
	if info := result.GetResultMeta().ServerInfo(); info != nil {
		initialized.ServerInfo = *info
	}
	return initialized
}
