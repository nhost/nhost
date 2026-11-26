package mcp

import (
	"encoding/json"
	"errors"
	"fmt"
)

// Sentinel errors for common JSON-RPC error codes.
var (
	// ErrParseError indicates a JSON parsing error (code: PARSE_ERROR).
	ErrParseError = errors.New("parse error")

	// ErrInvalidRequest indicates an invalid JSON-RPC request (code: INVALID_REQUEST).
	ErrInvalidRequest = errors.New("invalid request")

	// ErrMethodNotFound indicates the requested method does not exist (code: METHOD_NOT_FOUND).
	ErrMethodNotFound = errors.New("method not found")

	// ErrInvalidParams indicates invalid method parameters (code: INVALID_PARAMS).
	ErrInvalidParams = errors.New("invalid params")

	// ErrInternalError indicates an internal JSON-RPC error (code: INTERNAL_ERROR).
	ErrInternalError = errors.New("internal error")

	// ErrRequestInterrupted indicates a request was cancelled or timed out (code: REQUEST_INTERRUPTED).
	ErrRequestInterrupted = errors.New("request interrupted")

	// ErrResourceNotFound indicates a requested resource was not found (code: RESOURCE_NOT_FOUND).
	ErrResourceNotFound = errors.New("resource not found")

	// ErrEmbeddedResourceMissingVariant indicates an embedded resource has neither text nor blob content.
	ErrEmbeddedResourceMissingVariant = errors.New("missing text or blob field")

	// ErrEmbeddedResourceMissingURI indicates an embedded resource content variant has no URI.
	ErrEmbeddedResourceMissingURI = errors.New("resource uri is missing")
)

// URLElicitationRequiredError is returned when the server requires URL elicitation to proceed.
type URLElicitationRequiredError struct {
	Elicitations []ElicitationParams `json:"elicitations"`
}

func (e URLElicitationRequiredError) Error() string {
	return fmt.Sprintf("URL elicitation required: %d elicitation(s) needed", len(e.Elicitations))
}

func (e URLElicitationRequiredError) JSONRPCError() JSONRPCError {
	return JSONRPCError{
		JSONRPC: JSONRPC_VERSION,
		Error: JSONRPCErrorDetails{
			Code:    URL_ELICITATION_REQUIRED,
			Message: e.Error(),
			Data: map[string]any{
				"elicitations": e.Elicitations,
			},
		},
	}
}

// UnsupportedProtocolVersionError is returned when a peer responds with, or
// rejects, a protocol version that this side does not support.
type UnsupportedProtocolVersionError struct {
	// Version is the protocol version that was rejected.
	Version string
	// Supported lists the versions the peer does support, when it told us.
	Supported []string
}

func (e UnsupportedProtocolVersionError) Error() string {
	if len(e.Supported) > 0 {
		return fmt.Sprintf("unsupported protocol version: %q (supported: %v)", e.Version, e.Supported)
	}
	return fmt.Sprintf("unsupported protocol version: %q", e.Version)
}

// UnsupportedProtocolVersionData is the JSON payload carried in the data field
// of an [UNSUPPORTED_PROTOCOL_VERSION] error.
type UnsupportedProtocolVersionData struct {
	// Supported lists the protocol versions the server implements.
	Supported []string `json:"supported"`
	// Requested is the version the rejected request declared.
	Requested string `json:"requested"`
}

// JSONRPCError renders the error as a JSON-RPC error response body.
func (e UnsupportedProtocolVersionError) JSONRPCError() JSONRPCError {
	return JSONRPCError{
		JSONRPC: JSONRPC_VERSION,
		Error: JSONRPCErrorDetails{
			Code:    UNSUPPORTED_PROTOCOL_VERSION,
			Message: e.Error(),
			Data: UnsupportedProtocolVersionData{
				Supported: e.Supported,
				Requested: e.Version,
			},
		},
	}
}

// HeaderMismatchError is returned when a standard MCP HTTP header is missing,
// malformed, or disagrees with the corresponding value in the request body
// (SEP-2243).
type HeaderMismatchError struct {
	// Header is the offending header name.
	Header string
	// Reason describes the mismatch.
	Reason string
}

func (e HeaderMismatchError) Error() string {
	if e.Header == "" {
		return fmt.Sprintf("header mismatch: %s", e.Reason)
	}
	return fmt.Sprintf("header mismatch: %s: %s", e.Header, e.Reason)
}

// Is implements the errors.Is interface for better error handling.
func (e HeaderMismatchError) Is(target error) bool {
	_, ok := target.(HeaderMismatchError)
	return ok
}

// MissingRequiredClientCapabilityError is returned when a request omits a
// client capability the server requires to serve it (SEP-2575).
type MissingRequiredClientCapabilityError struct {
	// Capability names the missing capability, e.g. "elicitation".
	Capability string
}

func (e MissingRequiredClientCapabilityError) Error() string {
	return fmt.Sprintf("missing required client capability: %q", e.Capability)
}

// Is implements the errors.Is interface for better error handling.
func (e MissingRequiredClientCapabilityError) Is(target error) bool {
	_, ok := target.(MissingRequiredClientCapabilityError)
	return ok
}

// Is implements the errors.Is interface for better error handling
func (e URLElicitationRequiredError) Is(target error) bool {
	_, ok := target.(URLElicitationRequiredError)
	return ok
}

// Is implements the errors.Is interface for better error handling
func (e UnsupportedProtocolVersionError) Is(target error) bool {
	_, ok := target.(UnsupportedProtocolVersionError)
	return ok
}

// IsUnsupportedProtocolVersion checks if an error is an UnsupportedProtocolVersionError
func IsUnsupportedProtocolVersion(err error) bool {
	var target UnsupportedProtocolVersionError
	var pointer *UnsupportedProtocolVersionError
	return errors.As(err, &target) || errors.As(err, &pointer)
}

// IsHeaderMismatch checks if an error is a [HeaderMismatchError].
func IsHeaderMismatch(err error) bool {
	var target HeaderMismatchError
	var pointer *HeaderMismatchError
	return errors.As(err, &target) || errors.As(err, &pointer)
}

// IsMissingRequiredClientCapability checks if an error is a
// [MissingRequiredClientCapabilityError].
func IsMissingRequiredClientCapability(err error) bool {
	var target MissingRequiredClientCapabilityError
	var pointer *MissingRequiredClientCapabilityError
	return errors.As(err, &target) || errors.As(err, &pointer)
}

// AsError maps JSONRPCErrorDetails to a Go error.
// Returns sentinel errors wrapped with custom messages for known codes.
// Defaults to a generic error with the original message when the code is not mapped.
func (e *JSONRPCErrorDetails) AsError() error {
	var err error

	switch e.Code {
	case PARSE_ERROR:
		err = ErrParseError
	case INVALID_REQUEST:
		err = ErrInvalidRequest
	case METHOD_NOT_FOUND:
		err = ErrMethodNotFound
	case INVALID_PARAMS:
		err = ErrInvalidParams
	case INTERNAL_ERROR:
		err = ErrInternalError
	case REQUEST_INTERRUPTED:
		err = ErrRequestInterrupted
	case RESOURCE_NOT_FOUND:
		err = ErrResourceNotFound
	case HEADER_MISMATCH:
		return HeaderMismatchError{Reason: e.Message}
	case MISSING_REQUIRED_CLIENT_CAPABILITY:
		capability := ""
		if e.Data != nil {
			if dataBytes, marshalErr := json.Marshal(e.Data); marshalErr == nil {
				var data struct {
					Capability string `json:"capability"`
				}
				if json.Unmarshal(dataBytes, &data) == nil {
					capability = data.Capability
				}
			}
		}
		return MissingRequiredClientCapabilityError{Capability: capability}
	case UNSUPPORTED_PROTOCOL_VERSION:
		var data UnsupportedProtocolVersionData
		if e.Data != nil {
			if dataBytes, marshalErr := json.Marshal(e.Data); marshalErr == nil {
				_ = json.Unmarshal(dataBytes, &data)
			}
		}
		return UnsupportedProtocolVersionError{
			Version:   data.Requested,
			Supported: data.Supported,
		}
	case URL_ELICITATION_REQUIRED:
		// Attempt to reconstruct URLElicitationRequiredError from Data
		if e.Data != nil {
			// Round-trip through JSON to parse into struct
			// This handles both map[string]any (from unmarshal) and other forms
			if dataBytes, marshalErr := json.Marshal(e.Data); marshalErr == nil {
				var data struct {
					Elicitations []ElicitationParams `json:"elicitations"`
				}
				if unmarshalErr := json.Unmarshal(dataBytes, &data); unmarshalErr == nil {
					return URLElicitationRequiredError{
						Elicitations: data.Elicitations,
					}
				}
			}
		}
		// Fallback if data is missing or invalid
		return URLElicitationRequiredError{}
	default:
		return errors.New(e.Message)
	}

	// Wrap the sentinel error with the custom message if it differs from the sentinel.
	if e.Message != "" && e.Message != err.Error() {
		return fmt.Errorf("%w: %s", err, e.Message)
	}

	return err
}
