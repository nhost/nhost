package server

import (
	"fmt"
	"net"
	"net/http"
	"net/netip"
	"strings"
)

// isLoopbackHost reports whether addr refers to a loopback interface. addr
// may be a bare host ("localhost", "127.0.0.1", "::1", "[::1]") or a
// host:port pair ("localhost:3000", "127.0.0.1:3000", "[::1]:3000").
//
// It is used to implement DNS rebinding protection: a request that arrives
// on a loopback connection must also carry a loopback Host header, otherwise
// a malicious website could rebind its own domain to 127.0.0.1 and drive a
// victim's browser to interact with a local MCP server.
func isLoopbackHost(addr string) bool {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		// addr might be a bare host without a port.
		host = strings.Trim(addr, "[]")
	}
	if strings.EqualFold(host, "localhost") {
		return true
	}
	ip, err := netip.ParseAddr(host)
	if err != nil {
		return false
	}
	return ip.IsLoopback()
}

// rejectDNSRebinding applies DNS rebinding protection to r. When the
// connection's local address (http.LocalAddrContextKey) is a loopback
// address but the request's Host header is not a loopback value, it writes a
// 403 Forbidden response and returns true. Otherwise it returns false and
// writes nothing.
//
// Requests arriving via non-loopback addresses are never rejected: DNS
// rebinding attacks only target servers reachable at localhost from the
// victim's browser.
//
// See https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices#local-mcp-server-compromise
func rejectDNSRebinding(w http.ResponseWriter, r *http.Request) bool {
	localAddr, ok := r.Context().Value(http.LocalAddrContextKey).(net.Addr)
	if !ok || localAddr == nil {
		return false
	}
	if isLoopbackHost(localAddr.String()) && !isLoopbackHost(r.Host) {
		http.Error(w, fmt.Sprintf("Forbidden: invalid Host header %q", r.Host), http.StatusForbidden)
		return true
	}
	return false
}
