package mcp

// ResultType indicates how a client should interpret a result, as introduced
// by protocol version 2026-07-28 (SEP-2322).
type ResultType string

const (
	// ResultTypeComplete indicates an ordinary, final result.
	//
	// Clients MUST treat a result from an earlier-protocol server that omits
	// the resultType field as complete.
	ResultTypeComplete ResultType = "complete"

	// ResultTypeInputRequired indicates the server needs additional input from
	// the client before it can finish the request. The client fulfils the
	// [InputRequiredResult.InputRequests] and retries the original request with
	// the answers attached. See the multi round-trip request pattern.
	ResultTypeInputRequired ResultType = "input_required"
)

// IsComplete reports whether the result type denotes a final result. An empty
// result type is treated as complete for backwards compatibility with servers
// implementing protocol versions earlier than 2026-07-28.
func (t ResultType) IsComplete() bool {
	return t == "" || t == ResultTypeComplete
}

// CacheScope indicates the intended scope of a cached response, analogous to
// the HTTP Cache-Control public and private directives (SEP-2549).
type CacheScope string

const (
	// CacheScopePublic indicates the response contains no user-specific data,
	// so any client or shared intermediary may cache and reuse it across
	// authorization contexts.
	CacheScopePublic CacheScope = "public"

	// CacheScopePrivate indicates the response may only be cached and reused
	// within the same authorization context.
	CacheScopePrivate CacheScope = "private"
)

// CacheableResult carries the caching hints required on results from
// tools/list, prompts/list, resources/list, resources/templates/list,
// resources/read, and server/discover in protocol version 2026-07-28 and later
// (SEP-2549).
//
// Both fields are omitted when responding to a request that used an earlier
// protocol version.
type CacheableResult struct {
	Result

	// TTLMs is a hint indicating how long, in milliseconds, the client may
	// cache this response before re-fetching. Semantics are analogous to HTTP
	// Cache-Control max-age. Zero means the response should be considered
	// immediately stale.
	//
	// It is a pointer so that an explicit zero can be distinguished from an
	// unset value; use [CacheableResult.SetCacheHints] to populate it.
	TTLMs *int64 `json:"ttlMs,omitempty"`

	// CacheScope controls whether shared intermediaries may cache the
	// response.
	CacheScope CacheScope `json:"cacheScope,omitempty"`
}

// SetCacheHints populates the caching hints on the result.
//
// An empty scope defaults to [CacheScopePrivate], so a result is never shared
// across authorization contexts unless the caller asks for it: list and read
// results are frequently scoped to the caller's identity, and a shared
// intermediary honouring a public scope would serve one principal's data to
// another. A nil receiver is a no-op.
func (r *CacheableResult) SetCacheHints(ttlMs int64, scope CacheScope) {
	if r == nil {
		return
	}
	if scope == "" {
		scope = CacheScopePrivate
	}
	r.TTLMs = &ttlMs
	r.CacheScope = scope
}

// TTL returns the cache freshness hint in milliseconds and whether the server
// supplied one.
func (r *CacheableResult) TTL() (int64, bool) {
	if r == nil || r.TTLMs == nil {
		return 0, false
	}
	return *r.TTLMs, true
}

// ResultMetadata is implemented by every MCP result type through its embedded
// [Result]. It allows transports and servers to decorate a result generically,
// without knowing its concrete type.
type ResultMetadata interface {
	// SetResultType records how the client should interpret the result.
	SetResultType(ResultType)
	// GetResultType returns the recorded result type.
	GetResultType() ResultType
	// SetResultMeta replaces the result's _meta.
	SetResultMeta(*Meta)
	// GetResultMeta returns the result's _meta, which may be nil.
	GetResultMeta() *Meta
	// EnsureResultMeta returns the result's _meta, allocating it when absent.
	EnsureResultMeta() *Meta
}

// SetResultType records how the client should interpret the result.
func (r *Result) SetResultType(t ResultType) {
	if r == nil {
		return
	}
	r.ResultType = t
}

// GetResultType returns the recorded result type.
func (r *Result) GetResultType() ResultType {
	if r == nil {
		return ""
	}
	return r.ResultType
}

// SetResultMeta replaces the result's _meta.
func (r *Result) SetResultMeta(meta *Meta) {
	if r == nil {
		return
	}
	r.Meta = meta
}

// GetResultMeta returns the result's _meta, which may be nil.
func (r *Result) GetResultMeta() *Meta {
	if r == nil {
		return nil
	}
	return r.Meta
}

// EnsureResultMeta returns the result's _meta, allocating it when absent.
func (r *Result) EnsureResultMeta() *Meta {
	if r == nil {
		return nil
	}
	if r.Meta == nil {
		r.Meta = &Meta{}
	}
	return r.Meta
}

// CacheHintSetter is implemented by result types that carry the SEP-2549
// caching hints through an embedded [CacheableResult].
type CacheHintSetter interface {
	SetCacheHints(ttlMs int64, scope CacheScope)
}

// Compile-time checks that the base result types satisfy the decoration
// interfaces, and therefore so does every type embedding them.
var (
	_ ResultMetadata  = (*Result)(nil)
	_ ResultMetadata  = (*CacheableResult)(nil)
	_ CacheHintSetter = (*CacheableResult)(nil)
)
