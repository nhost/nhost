package server

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"github.com/mark3labs/mcp-go/mcp"
)

// Multi round-trip requests (SEP-2322) are how a server asks a client for
// information mid-request from protocol version 2026-07-28 onward.
//
// A handler that needs a confirmation, a missing parameter, or an LLM
// completion returns a result whose ResultType is
// [mcp.ResultTypeInputRequired], carrying the requests it needs answered and
// an opaque RequestState. The client fulfils them and retries the original
// request with the answers in InputResponses and the state echoed back.
//
// Handlers written this way also work against clients using an earlier
// protocol version: this package performs the old server-initiated requests on
// their behalf and re-invokes the handler with the answers, so a single
// handler serves both eras.

// maxLegacyInputRoundTrips bounds how many times the legacy bridge will
// fulfil a handler's input requests and re-invoke it. It matches the client
// side bound.
const maxLegacyInputRoundTrips = 10

// ErrLoadShedding is returned when a handler sheds load by asking the client
// to retry later, but the client predates the multi round-trip pattern and has
// no way to act on that signal.
//
// Callers may detect it with errors.Is to map the condition onto a transport
// level backpressure response, such as HTTP 503 with Retry-After.
var ErrLoadShedding = errors.New("the server is busy, retry later")

// InputRequestBuilder accumulates the requests a handler needs answered before
// it can complete, and renders them as an [mcp.InputRequiredResult].
//
// The zero value is ready to use.
type InputRequestBuilder struct {
	requests mcp.InputRequests
	state    string
}

// NewInputRequestBuilder returns a builder for the input a handler needs.
// requestState is an opaque token the client echoes back on retry; use it to
// resume where the handler left off. It may be empty.
func NewInputRequestBuilder(requestState string) *InputRequestBuilder {
	return &InputRequestBuilder{state: requestState}
}

// Elicit asks the client to collect information from the user, keyed by id.
func (b *InputRequestBuilder) Elicit(id string, params mcp.ElicitationParams) *InputRequestBuilder {
	b.add(id, mcp.NewElicitationInputRequest(params))
	return b
}

// Sample asks the client to run an LLM completion, keyed by id.
func (b *InputRequestBuilder) Sample(id string, params mcp.CreateMessageParams) *InputRequestBuilder {
	b.add(id, mcp.NewSamplingInputRequest(params))
	return b
}

// Roots asks the client for its list of roots, keyed by id.
func (b *InputRequestBuilder) Roots(id string) *InputRequestBuilder {
	b.add(id, mcp.NewRootsInputRequest())
	return b
}

// RequestState sets the opaque token the client echoes back on retry.
func (b *InputRequestBuilder) RequestState(state string) *InputRequestBuilder {
	b.state = state
	return b
}

func (b *InputRequestBuilder) add(id string, request mcp.InputRequest) {
	if b.requests == nil {
		b.requests = make(mcp.InputRequests)
	}
	b.requests[id] = request
}

// ToolResult renders the accumulated requests as a tools/call result asking
// the client for more input.
func (b *InputRequestBuilder) ToolResult() *mcp.CallToolResult {
	return &mcp.CallToolResult{
		Result:               mcp.Result{ResultType: mcp.ResultTypeInputRequired},
		MultiRoundTripResult: b.multiRoundTripResult(),
	}
}

// PromptResult renders the accumulated requests as a prompts/get result asking
// the client for more input.
func (b *InputRequestBuilder) PromptResult() *mcp.GetPromptResult {
	return &mcp.GetPromptResult{
		Result:               mcp.Result{ResultType: mcp.ResultTypeInputRequired},
		MultiRoundTripResult: b.multiRoundTripResult(),
	}
}

// ResourceResult renders the accumulated requests as a resources/read result
// asking the client for more input.
//
// Resource handlers registered with AddResource return contents rather than a
// full result, so this is for servers that construct resources/read responses
// directly.
func (b *InputRequestBuilder) ResourceResult() *mcp.ReadResourceResult {
	result := &mcp.ReadResourceResult{MultiRoundTripResult: b.multiRoundTripResult()}
	result.ResultType = mcp.ResultTypeInputRequired
	return result
}

func (b *InputRequestBuilder) multiRoundTripResult() mcp.MultiRoundTripResult {
	return mcp.MultiRoundTripResult{
		InputRequests: b.requests,
		RequestState:  b.state,
	}
}

// InputResponse returns the client's answer to the input request recorded
// under id, and whether it was present.
//
// Use it at the top of a handler to detect a retry:
//
//	if answer, ok := server.InputResponse(request.Params.InputResponses, "confirm"); ok {
//	    // the user answered; finish the work
//	}
func InputResponse(responses mcp.InputResponses, id string) (mcp.InputResponse, bool) {
	response, ok := responses[id]
	return response, ok
}

// ElicitationResponse returns the elicitation result the client supplied under
// id, or nil when absent.
func ElicitationResponse(responses mcp.InputResponses, id string) *mcp.ElicitationResult {
	response, ok := responses[id]
	if !ok {
		return nil
	}
	if response.Elicitation == nil {
		if err := response.DecodeFor(mcp.MethodElicitationCreate); err != nil {
			return nil
		}
	}
	return response.Elicitation
}

// SamplingResponse returns the sampling result the client supplied under id,
// or nil when absent.
func SamplingResponse(responses mcp.InputResponses, id string) *mcp.CreateMessageResult {
	response, ok := responses[id]
	if !ok {
		return nil
	}
	if response.Sampling == nil {
		if err := response.DecodeFor(mcp.MethodSamplingCreateMessage); err != nil {
			return nil
		}
	}
	return response.Sampling
}

// RootsResponse returns the roots list the client supplied under id, or nil
// when absent.
func RootsResponse(responses mcp.InputResponses, id string) *mcp.ListRootsResult {
	response, ok := responses[id]
	if !ok {
		return nil
	}
	if response.Roots == nil {
		if err := response.DecodeFor(mcp.MethodListRoots); err != nil {
			return nil
		}
	}
	return response.Roots
}

// clientSupportsMultiRoundTrip reports whether the peer can handle an
// input_required result, which requires protocol version 2026-07-28 or later.
func clientSupportsMultiRoundTrip(ctx context.Context) bool {
	return mcp.IsModernProtocol(RequestProtocolVersion(ctx))
}

// resolveMultiRoundTrip bridges a handler that returned input requests to a
// client that predates the multi round-trip pattern.
//
// It performs the server-initiated elicitation/create, sampling/createMessage,
// and roots/list requests the handler asked for, then re-invokes the handler
// with the answers attached, repeating until the handler produces a final
// result.
//
// For clients that do support the pattern it is a no-op: the input_required
// result is returned to them unchanged.
func resolveMultiRoundTrip[T any](
	ctx context.Context,
	s *MCPServer,
	result *T,
	needsInput func(*T) (mcp.InputRequests, string, bool),
	retry func(context.Context, mcp.MultiRoundTripParams) (*T, error),
) (*T, error) {
	if clientSupportsMultiRoundTrip(ctx) {
		return result, nil
	}

	for attempt := 0; ; attempt++ {
		requests, state, pending := needsInput(result)
		if !pending {
			return result, nil
		}
		if len(requests) == 0 {
			return nil, fmt.Errorf("multi round-trip: %w", ErrLoadShedding)
		}
		if attempt >= maxLegacyInputRoundTrips {
			return nil, fmt.Errorf(
				"multi round-trip: handler asked for input more than %d times",
				maxLegacyInputRoundTrips)
		}

		responses, err := s.fulfillInputRequests(ctx, requests)
		if err != nil {
			return nil, err
		}

		result, err = retry(ctx, mcp.MultiRoundTripParams{
			InputResponses: responses,
			RequestState:   state,
		})
		if err != nil {
			return nil, err
		}
	}
}

// fulfillInputRequests answers a handler's input requests by issuing the
// server-initiated requests that protocol versions before 2026-07-28 used.
func (s *MCPServer) fulfillInputRequests(
	ctx context.Context,
	requests mcp.InputRequests,
) (mcp.InputResponses, error) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	var (
		mu        sync.Mutex
		wg        sync.WaitGroup
		responses = make(mcp.InputResponses, len(requests))
		firstErr  error
	)

	for id, request := range requests {
		wg.Add(1)
		go func(id string, request mcp.InputRequest) {
			defer wg.Done()
			response, err := s.fulfillInputRequest(ctx, request)
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				if firstErr == nil {
					firstErr = fmt.Errorf("fulfilling input request %q: %w", id, err)
					cancel()
				}
				return
			}
			responses[id] = response
		}(id, request)
	}
	wg.Wait()

	if firstErr != nil {
		return nil, fmt.Errorf("multi round-trip: %w", firstErr)
	}
	return responses, nil
}

// fulfillInputRequest issues a single server-initiated request.
func (s *MCPServer) fulfillInputRequest(
	ctx context.Context,
	request mcp.InputRequest,
) (mcp.InputResponse, error) {
	switch request.Method {
	case mcp.MethodElicitationCreate:
		if request.Elicitation == nil {
			return mcp.InputResponse{}, fmt.Errorf("elicitation input request has no params")
		}
		result, err := s.RequestElicitation(ctx, mcp.ElicitationRequest{
			Request: mcp.Request{Method: string(mcp.MethodElicitationCreate)},
			Params:  *request.Elicitation,
		})
		if err != nil {
			return mcp.InputResponse{}, err
		}
		if result == nil {
			return mcp.InputResponse{}, fmt.Errorf("session returned no elicitation result")
		}
		return mcp.NewElicitationInputResponse(*result), nil

	case mcp.MethodSamplingCreateMessage:
		if request.Sampling == nil {
			return mcp.InputResponse{}, fmt.Errorf("sampling input request has no params")
		}
		result, err := s.RequestSampling(ctx, mcp.CreateMessageRequest{
			Request:             mcp.Request{Method: string(mcp.MethodSamplingCreateMessage)},
			CreateMessageParams: *request.Sampling,
		})
		if err != nil {
			return mcp.InputResponse{}, err
		}
		if result == nil {
			return mcp.InputResponse{}, fmt.Errorf("session returned no sampling result")
		}
		return mcp.NewSamplingInputResponse(*result), nil

	case mcp.MethodListRoots:
		result, err := s.RequestRoots(ctx, mcp.ListRootsRequest{
			Request: mcp.Request{Method: string(mcp.MethodListRoots)},
		})
		if err != nil {
			return mcp.InputResponse{}, err
		}
		if result == nil {
			return mcp.InputResponse{}, fmt.Errorf("session returned no roots result")
		}
		return mcp.NewRootsInputResponse(*result), nil

	default:
		return mcp.InputResponse{}, fmt.Errorf("unsupported input request method %q", request.Method)
	}
}

// callToolResultNeedsInput reports whether a tools/call result asks the client
// for more input.
func callToolResultNeedsInput(result *mcp.CallToolResult) (mcp.InputRequests, string, bool) {
	if !result.NeedsInput() {
		return nil, "", false
	}
	return result.InputRequests, result.RequestState, true
}

// getPromptResultNeedsInput reports whether a prompts/get result asks the
// client for more input.
func getPromptResultNeedsInput(result *mcp.GetPromptResult) (mcp.InputRequests, string, bool) {
	if !result.NeedsInput() {
		return nil, "", false
	}
	return result.InputRequests, result.RequestState, true
}

// assertServerInitiatedRequestAllowed rejects a server-initiated request on a
// connection using protocol version 2026-07-28 or later, where the pattern was
// replaced by multi round-trip requests.
//
// The check is skipped for servers that opted in to
// [WithLegacyServerInitiatedRequests].
func (s *MCPServer) assertServerInitiatedRequestAllowed(ctx context.Context, method mcp.MCPMethod) error {
	if s != nil && s.allowServerInitiatedRequests {
		return nil
	}
	if !clientSupportsMultiRoundTrip(ctx) {
		return nil
	}
	// An in-process session dispatches to a handler directly, so no protocol
	// message is sent and the restriction does not apply.
	if session, ok := ClientSessionFromContext(ctx).(interface{ isInProcess() }); ok && session != nil {
		return nil
	}
	return fmt.Errorf("%q: %w", method, ErrServerInitiatedRequestUnsupported)
}
