package client

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sync"

	"github.com/mark3labs/mcp-go/mcp"
)

// Multi round-trip requests (SEP-2322) replace the server-initiated
// elicitation/create, sampling/createMessage, and roots/list requests that
// previously required a held-open bidirectional stream.
//
// When a server needs something from the user mid-call it returns a result
// whose resultType is "input_required", carrying the requests it needs
// answered and an opaque requestState. The client fulfils the requests with
// the handlers it already has registered, then retries the original call with
// the answers attached.
//
// By default the retry loop is transparent: callers of CallTool, GetPrompt, and
// ReadResource see only the final result. Set [WithMaxInputRoundTrips] to
// bound it. Set [WithManualInputRoundTrips] to disable it: each call sends one
// request and returns a result whose NeedsInput is true as-is, and the caller
// retries with InputResponses and RequestState in the request params.

const (
	// defaultMaxInputRoundTrips bounds how many times a single call may be
	// retried with fulfilled input before the client gives up.
	defaultMaxInputRoundTrips = 10

	// maxLoadSheddingRoundTrips bounds consecutive retries where the server
	// asked for no input at all. An empty inputRequests map is a
	// load-shedding signal - "retry later" - not a request for information.
	maxLoadSheddingRoundTrips = 3
)

// ErrMaxInputRoundTripsExceeded is returned when a server keeps asking for
// more input past the configured limit.
var ErrMaxInputRoundTripsExceeded = errors.New("multi round-trip: exceeded maximum retries")

// maxRoundTrips returns the configured retry bound.
func (c *Client) maxRoundTrips() int {
	if c.maxInputRoundTrips > 0 {
		return c.maxInputRoundTrips
	}
	return defaultMaxInputRoundTrips
}

// multiRoundTrip drives the SEP-2322 retry loop for a single request.
//
// send issues the request with the given multi round-trip params and returns
// the decoded result. The loop terminates as soon as a result comes back that
// does not ask for more input.
func multiRoundTrip[T any](
	ctx context.Context,
	c *Client,
	initial mcp.MultiRoundTripParams,
	send func(context.Context, mcp.MultiRoundTripParams) (*T, error),
	needsInput func(*T) (mcp.InputRequests, string, bool),
) (*T, error) {
	params := initial
	loadShedding := 0

	for attempt := 1; ; attempt++ {
		result, err := send(ctx, params)
		if err != nil {
			return nil, err
		}

		requests, state, pending := needsInput(result)
		if !pending {
			return result, nil
		}

		if c.manualInputRoundTrips {
			return result, nil
		}

		// An empty request map means the server is shedding load rather than
		// asking for information.
		if len(requests) == 0 {
			loadShedding++
			if loadShedding >= maxLoadSheddingRoundTrips {
				return nil, fmt.Errorf(
					"%w: server asked to retry %d times without requesting input",
					ErrMaxInputRoundTripsExceeded, loadShedding)
			}
		} else {
			loadShedding = 0
		}

		if attempt >= c.maxRoundTrips() {
			return nil, fmt.Errorf("%w (%d)", ErrMaxInputRoundTripsExceeded, c.maxRoundTrips())
		}

		if len(requests) > 0 {
			responses, err := c.fulfillInputRequests(ctx, requests)
			if err != nil {
				return nil, err
			}
			params.InputResponses = responses
		}
		params.RequestState = state
	}
}

// fulfillInputRequests answers a server's input requests using the handlers
// registered on the client. Requests are fulfilled concurrently, because they
// are independent by construction.
func (c *Client) fulfillInputRequests(
	ctx context.Context,
	requests mcp.InputRequests,
) (mcp.InputResponses, error) {
	if len(requests) == 0 {
		return nil, nil
	}

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
			response, err := c.fulfillInputRequest(ctx, request)
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

// fulfillInputRequest dispatches a single input request to the matching
// handler.
func (c *Client) fulfillInputRequest(
	ctx context.Context,
	request mcp.InputRequest,
) (mcp.InputResponse, error) {
	switch request.Method {
	case mcp.MethodElicitationCreate:
		if c.elicitationHandler == nil {
			return mcp.InputResponse{}, fmt.Errorf("no elicitation handler configured")
		}
		if request.Elicitation == nil {
			return mcp.InputResponse{}, fmt.Errorf("elicitation input request has no params")
		}
		result, err := c.elicitationHandler.Elicit(ctx, mcp.ElicitationRequest{
			Request: mcp.Request{Method: string(mcp.MethodElicitationCreate)},
			Params:  *request.Elicitation,
		})
		if err != nil {
			return mcp.InputResponse{}, err
		}
		if result == nil {
			return mcp.InputResponse{}, fmt.Errorf("elicitation handler returned no result")
		}
		return mcp.NewElicitationInputResponse(*result), nil

	case mcp.MethodSamplingCreateMessage:
		if c.samplingHandler == nil {
			return mcp.InputResponse{}, fmt.Errorf("no sampling handler configured")
		}
		if request.Sampling == nil {
			return mcp.InputResponse{}, fmt.Errorf("sampling input request has no params")
		}
		result, err := c.samplingHandler.CreateMessage(ctx, mcp.CreateMessageRequest{
			Request:             mcp.Request{Method: string(mcp.MethodSamplingCreateMessage)},
			CreateMessageParams: *request.Sampling,
		})
		if err != nil {
			return mcp.InputResponse{}, err
		}
		if result == nil {
			return mcp.InputResponse{}, fmt.Errorf("sampling handler returned no result")
		}
		return mcp.NewSamplingInputResponse(*result), nil

	case mcp.MethodListRoots:
		if c.rootsHandler == nil {
			return mcp.InputResponse{}, fmt.Errorf("no roots handler configured")
		}
		result, err := c.rootsHandler.ListRoots(ctx, mcp.ListRootsRequest{
			Request: mcp.Request{Method: string(mcp.MethodListRoots)},
		})
		if err != nil {
			return mcp.InputResponse{}, err
		}
		if result == nil {
			return mcp.InputResponse{}, fmt.Errorf("roots handler returned no result")
		}
		return mcp.NewRootsInputResponse(*withRootsArray(result)), nil

	default:
		return mcp.InputResponse{}, fmt.Errorf("unsupported input request method %q", request.Method)
	}
}

// callToolOnce issues a single tools/call request.
func (c *Client) callToolOnce(
	ctx context.Context,
	request mcp.CallToolRequest,
	roundTrip mcp.MultiRoundTripParams,
	header http.Header,
) (*mcp.CallToolResult, error) {
	params := request.Params
	params.MultiRoundTripParams = roundTrip

	response, err := c.sendRequest(ctx, string(mcp.MethodToolsCall), params, header)
	if err != nil {
		return nil, err
	}
	return mcp.ParseCallToolResult(response)
}

// getPromptOnce issues a single prompts/get request.
func (c *Client) getPromptOnce(
	ctx context.Context,
	request mcp.GetPromptRequest,
	roundTrip mcp.MultiRoundTripParams,
	header http.Header,
) (*mcp.GetPromptResult, error) {
	params := request.Params
	params.MultiRoundTripParams = roundTrip

	response, err := c.sendRequest(ctx, string(mcp.MethodPromptsGet), params, header)
	if err != nil {
		return nil, err
	}
	return mcp.ParseGetPromptResult(response)
}

// readResourceOnce issues a single resources/read request.
func (c *Client) readResourceOnce(
	ctx context.Context,
	request mcp.ReadResourceRequest,
	roundTrip mcp.MultiRoundTripParams,
	header http.Header,
) (*mcp.ReadResourceResult, error) {
	params := request.Params
	params.MultiRoundTripParams = roundTrip

	response, err := c.sendRequest(ctx, string(mcp.MethodResourcesRead), params, header)
	if err != nil {
		return nil, err
	}
	return mcp.ParseReadResourceResult(response)
}

// callToolNeedsInput reports whether a tools/call result asks for more input.
func callToolNeedsInput(result *mcp.CallToolResult) (mcp.InputRequests, string, bool) {
	if !result.NeedsInput() {
		return nil, "", false
	}
	return result.InputRequests, result.RequestState, true
}

// getPromptNeedsInput reports whether a prompts/get result asks for more input.
func getPromptNeedsInput(result *mcp.GetPromptResult) (mcp.InputRequests, string, bool) {
	if !result.NeedsInput() {
		return nil, "", false
	}
	return result.InputRequests, result.RequestState, true
}

// readResourceNeedsInput reports whether a resources/read result asks for more
// input.
func readResourceNeedsInput(result *mcp.ReadResourceResult) (mcp.InputRequests, string, bool) {
	if !result.NeedsInput() {
		return nil, "", false
	}
	return result.InputRequests, result.RequestState, true
}
