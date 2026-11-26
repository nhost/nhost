package mcp

import (
	"encoding/json"
	"fmt"
)

// Multi round-trip requests (MRTR), introduced in protocol version 2026-07-28
// (SEP-2322), replace server-initiated elicitation/create,
// sampling/createMessage, and roots/list requests.
//
// Instead of pushing a request down a held-open stream, a server returns an
// [InputRequiredResult]: a result whose resultType is
// [ResultTypeInputRequired] and which carries the requests it needs answered.
// The client fulfils them and retries the original request with the answers in
// inputResponses, echoing the opaque requestState back verbatim.

// InputRequest is a single server-initiated request embedded in an
// [InputRequiredResult]. Exactly one of its fields is populated, selected by
// the Method field.
type InputRequest struct {
	// Method is the JSON-RPC method of the embedded request: one of
	// [MethodElicitationCreate], [MethodSamplingCreateMessage], or
	// [MethodListRoots].
	Method MCPMethod `json:"method"`

	// Elicitation is set when Method is elicitation/create.
	Elicitation *ElicitationParams `json:"-"`
	// Sampling is set when Method is sampling/createMessage.
	Sampling *CreateMessageParams `json:"-"`
	// Roots is set when Method is roots/list. The roots/list request takes no
	// parameters, so this is an empty struct used only as a presence marker.
	Roots *ListRootsParams `json:"-"`
}

// ListRootsParams are the (empty) parameters of a roots/list request. It
// exists so that [InputRequest] can represent a roots/list request uniformly.
type ListRootsParams struct{}

// NewElicitationInputRequest builds an input request asking the client to
// elicit information from the user.
func NewElicitationInputRequest(params ElicitationParams) InputRequest {
	return InputRequest{Method: MethodElicitationCreate, Elicitation: &params}
}

// NewSamplingInputRequest builds an input request asking the client to sample
// from an LLM.
func NewSamplingInputRequest(params CreateMessageParams) InputRequest {
	return InputRequest{Method: MethodSamplingCreateMessage, Sampling: &params}
}

// NewRootsInputRequest builds an input request asking the client for its list
// of roots.
func NewRootsInputRequest() InputRequest {
	return InputRequest{Method: MethodListRoots, Roots: &ListRootsParams{}}
}

// MarshalJSON encodes the input request as a JSON-RPC request object carrying
// the method and its parameters.
func (r InputRequest) MarshalJSON() ([]byte, error) {
	out := map[string]any{"method": r.Method}
	switch r.Method {
	case MethodElicitationCreate:
		if r.Elicitation == nil {
			return nil, fmt.Errorf("input request %s: missing elicitation params", r.Method)
		}
		out["params"] = r.Elicitation
	case MethodSamplingCreateMessage:
		if r.Sampling == nil {
			return nil, fmt.Errorf("input request %s: missing sampling params", r.Method)
		}
		out["params"] = r.Sampling
	case MethodListRoots:
		// roots/list takes no parameters.
	default:
		return nil, fmt.Errorf("unsupported input request method %q", r.Method)
	}
	return json.Marshal(out)
}

// UnmarshalJSON decodes a JSON-RPC request object into the matching variant.
func (r *InputRequest) UnmarshalJSON(data []byte) error {
	var envelope struct {
		Method MCPMethod       `json:"method"`
		Params json.RawMessage `json:"params"`
	}
	if err := json.Unmarshal(data, &envelope); err != nil {
		return err
	}
	*r = InputRequest{Method: envelope.Method}
	switch envelope.Method {
	case MethodElicitationCreate:
		var params ElicitationParams
		if len(envelope.Params) > 0 {
			if err := json.Unmarshal(envelope.Params, &params); err != nil {
				return fmt.Errorf("input request %s: %w", envelope.Method, err)
			}
		}
		r.Elicitation = &params
	case MethodSamplingCreateMessage:
		var params CreateMessageParams
		if len(envelope.Params) > 0 {
			if err := json.Unmarshal(envelope.Params, &params); err != nil {
				return fmt.Errorf("input request %s: %w", envelope.Method, err)
			}
		}
		r.Sampling = &params
	case MethodListRoots:
		r.Roots = &ListRootsParams{}
	default:
		return fmt.Errorf("unsupported input request method %q", envelope.Method)
	}
	return nil
}

// InputResponse is a client's answer to a single [InputRequest]. Exactly one
// of its fields is populated, matching the method of the request it answers.
type InputResponse struct {
	// Elicitation answers an elicitation/create input request.
	Elicitation *ElicitationResult `json:"-"`
	// Sampling answers a sampling/createMessage input request.
	Sampling *CreateMessageResult `json:"-"`
	// Roots answers a roots/list input request.
	Roots *ListRootsResult `json:"-"`

	// raw preserves the original JSON so that a response can be round-tripped
	// and decoded against the method of the request it answers.
	raw json.RawMessage
}

// NewElicitationInputResponse builds an input response carrying an elicitation
// result.
func NewElicitationInputResponse(result ElicitationResult) InputResponse {
	return InputResponse{Elicitation: &result}
}

// NewSamplingInputResponse builds an input response carrying a sampling
// result.
func NewSamplingInputResponse(result CreateMessageResult) InputResponse {
	return InputResponse{Sampling: &result}
}

// NewRootsInputResponse builds an input response carrying a roots list.
func NewRootsInputResponse(result ListRootsResult) InputResponse {
	return InputResponse{Roots: &result}
}

// MarshalJSON encodes whichever variant is populated.
func (r InputResponse) MarshalJSON() ([]byte, error) {
	switch {
	case r.Elicitation != nil:
		return json.Marshal(r.Elicitation)
	case r.Sampling != nil:
		return json.Marshal(r.Sampling)
	case r.Roots != nil:
		return json.Marshal(r.Roots)
	case len(r.raw) > 0:
		return r.raw, nil
	default:
		return []byte("null"), nil
	}
}

// UnmarshalJSON stores the raw payload. Input responses are a union whose
// variant is determined by the method of the corresponding [InputRequest],
// which is not present in the response itself, so decoding into a concrete
// type is deferred to [InputResponse.DecodeFor].
func (r *InputResponse) UnmarshalJSON(data []byte) error {
	*r = InputResponse{raw: append(json.RawMessage(nil), data...)}
	return nil
}

// DecodeFor resolves the response against the method of the request it
// answers, populating the matching variant.
func (r *InputResponse) DecodeFor(method MCPMethod) error {
	if len(r.raw) == 0 {
		return nil
	}
	switch method {
	case MethodElicitationCreate:
		var result ElicitationResult
		if err := json.Unmarshal(r.raw, &result); err != nil {
			return fmt.Errorf("input response %s: %w", method, err)
		}
		r.Elicitation = &result
	case MethodSamplingCreateMessage:
		var result CreateMessageResult
		if err := json.Unmarshal(r.raw, &result); err != nil {
			return fmt.Errorf("input response %s: %w", method, err)
		}
		r.Sampling = &result
	case MethodListRoots:
		var result ListRootsResult
		if err := json.Unmarshal(r.raw, &result); err != nil {
			return fmt.Errorf("input response %s: %w", method, err)
		}
		r.Roots = &result
	default:
		return fmt.Errorf("unsupported input response method %q", method)
	}
	return nil
}

// InputRequests maps server-assigned identifiers to the requests a client must
// fulfil before retrying the original call.
type InputRequests map[string]InputRequest

// InputResponses maps the identifiers from an [InputRequests] map to the
// client's answers.
type InputResponses map[string]InputResponse

// DecodeFor resolves every response in the map against the methods of the
// corresponding requests.
func (r InputResponses) DecodeFor(requests InputRequests) error {
	for id, response := range r {
		request, ok := requests[id]
		if !ok {
			continue
		}
		if err := response.DecodeFor(request.Method); err != nil {
			return fmt.Errorf("input response %q: %w", id, err)
		}
		r[id] = response
	}
	return nil
}

// MultiRoundTripResult carries the multi round-trip fields on results that may
// ask the client for more input before completing. It is embedded in
// [CallToolResult], [GetPromptResult], and [ReadResourceResult].
type MultiRoundTripResult struct {
	// InputRequests are the requests the client must fulfil before retrying.
	// Present only when ResultType is [ResultTypeInputRequired].
	InputRequests InputRequests `json:"inputRequests,omitempty"`

	// RequestState is an opaque token the client must pass back verbatim when
	// it retries the original request. Clients MUST NOT interpret it.
	RequestState string `json:"requestState,omitempty"`
}

// InputRequiredResult is returned by a server to indicate that it needs
// additional input before it can complete a request.
//
// At least one of InputRequests or RequestState must be present. An empty
// InputRequests map with a RequestState is a load-shedding signal: the client
// should retry the request unchanged, echoing the state back.
type InputRequiredResult struct {
	Result
	MultiRoundTripResult
}

// NewInputRequiredResult builds a result asking the client for more input
// before the request can be completed. requestState is echoed back by the
// client on retry and may be empty.
func NewInputRequiredResult(requests InputRequests, requestState string) *InputRequiredResult {
	return &InputRequiredResult{
		Result: Result{ResultType: ResultTypeInputRequired},
		MultiRoundTripResult: MultiRoundTripResult{
			InputRequests: requests,
			RequestState:  requestState,
		},
	}
}

// MultiRoundTripParams carries the client's answers to a previous
// [InputRequiredResult] on a retry of the original request. It is embedded in
// the params of every request that may take part in a multi round-trip
// exchange.
type MultiRoundTripParams struct {
	// InputResponses answers the requests from a previous
	// [InputRequiredResult]. Each key present in that result's InputRequests
	// map must appear here.
	InputResponses InputResponses `json:"inputResponses,omitempty"`

	// RequestState echoes back, verbatim, the opaque state from a previous
	// [InputRequiredResult].
	RequestState string `json:"requestState,omitempty"`
}

// NeedsInput reports whether the result asks the client for more input before
// the original request can complete.
func (r *InputRequiredResult) NeedsInput() bool {
	return r != nil && r.ResultType == ResultTypeInputRequired
}

// NeedsInput reports whether the result asks the client for more input before
// the original request can complete.
func (r *CallToolResult) NeedsInput() bool {
	return r != nil && r.ResultType == ResultTypeInputRequired
}

// NeedsInput reports whether the result asks the client for more input before
// the original request can complete.
func (r *GetPromptResult) NeedsInput() bool {
	return r != nil && r.ResultType == ResultTypeInputRequired
}

// NeedsInput reports whether the result asks the client for more input before
// the original request can complete.
func (r *ReadResourceResult) NeedsInput() bool {
	return r != nil && r.ResultType == ResultTypeInputRequired
}
