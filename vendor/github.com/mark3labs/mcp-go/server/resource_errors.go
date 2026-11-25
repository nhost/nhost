package server

import (
	"context"

	"github.com/mark3labs/mcp-go/mcp"
)

// resourceNotFoundCode returns the JSON-RPC error code to report when a
// resource cannot be found.
//
// Protocol version 2026-07-28 aligns this condition with JSON-RPC by using
// InvalidParams; earlier revisions used the MCP-specific -32002. The code is
// chosen per request so that clients of either era see what their revision
// specifies.
func resourceNotFoundCode(ctx context.Context) int {
	if mcp.IsModernProtocol(RequestProtocolVersion(ctx)) {
		return mcp.INVALID_PARAMS
	}
	return mcp.RESOURCE_NOT_FOUND
}
